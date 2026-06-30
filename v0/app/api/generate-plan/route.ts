import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { logger } from '@/lib/logger';
import { rateLimiter, securityConfig } from '@/lib/security.config';
import { securityMonitor } from '@/lib/security.monitoring';
import { PersonalizationContextBuilder, type PersonalizationContext } from '@/lib/personalizationContext';
import {
  PlanSchema,
  type PlanData,
  type PlanRequest,
  resolveUser,
  resolveTotalWeeks,
  generateFallbackPlan,
  buildPlanPrompt,
  normalizePlan,
  derivePlanPolicy,
  enforcePlanSafety,
  computeMaxOutputTokens,
} from '@/lib/plan/plan-core';
import { captureAIGeneration } from '@/lib/ai-observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Get client IP for rate limiting
function getClientIP(request: Request): string {
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  if (realIP) return realIP;
  return '127.0.0.1';
}


export async function POST(req: Request) {
  const requestId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = Date.now();

  // Rate limiting check (10 requests per minute for AI routes)
  const clientIP = getClientIP(req);
  const rateLimitConfig = { ...securityConfig.rateLimit, ...securityConfig.apiSecurity.chatRateLimit };
  const rateLimitResult = await rateLimiter.check(clientIP, rateLimitConfig);

  if (!rateLimitResult.success) {
    securityMonitor.trackSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'warning',
      message: 'Plan generation rate limit exceeded',
      data: { ip: clientIP, limit: rateLimitResult.limit, requestId },
    });

    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.', requestId },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
        },
      }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json', requestId },
        { status: 400 }
      );
    }

    let body: PlanRequest = {};
    try {
      body = (await req.json()) as PlanRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const user = resolveUser(body);
    const totalWeeks = resolveTotalWeeks(body);
    const fallbackPlan = generateFallbackPlan(user, totalWeeks, body.planPreferences, body.challenge);

    let advancedMetrics: PersonalizationContext['advancedMetrics'] | undefined;
    const resolvedUserId = body.userContext?.userId ?? body.userId;
    const parsedUserId =
      typeof resolvedUserId === 'string' ? parseInt(resolvedUserId, 10) : resolvedUserId;
    if (body.userContext?.userId || body.userId) {
      if (typeof parsedUserId === 'number' && Number.isFinite(parsedUserId)) {
        try {
          const context = await PersonalizationContextBuilder.build(parsedUserId);
          advancedMetrics = context.advancedMetrics;

          logger.info('[generate-plan] Using advanced metrics', {
            userId: parsedUserId,
            hasVDOT: Boolean(advancedMetrics?.vdot),
            hasVO2Max: Boolean(advancedMetrics?.vo2Max),
            hasLT: Boolean(advancedMetrics?.lactateThreshold),
          });
        } catch (error) {
          logger.warn('[generate-plan] Failed to fetch personalization context:', error);
        }
      }
    }

    const prompt = buildPlanPrompt(
      user,
      totalWeeks,
      body.planPreferences,
      body.planType,
      body.targetDistance,
      body.challenge,
      advancedMetrics,
      body.trainingHistory,
      body.goals
    );

    const modelName = 'gpt-4o';
    const maxOutputTokens = computeMaxOutputTokens(totalWeeks, user.daysPerWeek);

    const result = await withSecureOpenAI(async () => {
      return generateObject({
        model: openai(modelName),
        schema: PlanSchema,
        prompt,
        temperature: 0.7,
        maxOutputTokens,
      });
    });

    if (!result.success || !result.data) {
      await captureAIGeneration({
        traceName: 'generate-plan',
        distinctId: typeof parsedUserId === 'number' ? parsedUserId : user.id,
        model: modelName,
        input: prompt,
        latencyMs: Date.now() - startedAt,
        error: result.error?.message || 'AI service unavailable',
        properties: {
          request_id: requestId,
          streaming: false,
          total_weeks: totalWeeks,
          plan_type: body.planType,
          target_distance: body.targetDistance,
          max_output_tokens: maxOutputTokens,
        },
      });

      return NextResponse.json(
        {
          plan: fallbackPlan,
          source: 'fallback',
          error: result.error?.message || 'AI service unavailable. Using fallback plan.',
          fallbackRequired: Boolean(result.error?.fallbackRequired),
          requestId,
        },
        { status: result.error?.status || 503 }
      );
    }

    const generated = result.data as { object?: PlanData };
    if (!generated.object) {
      logger.warn('[generate-plan] AI returned empty plan object', { requestId });
      return NextResponse.json(
        {
          plan: fallbackPlan,
          source: 'fallback',
          error: 'AI response could not be parsed. Using fallback plan.',
          requestId,
        },
        { status: 502 }
      );
    }

    await captureAIGeneration({
      traceName: 'generate-plan',
      distinctId: typeof parsedUserId === 'number' ? parsedUserId : user.id,
      model: modelName,
      input: prompt,
      output: generated.object,
      usage: (result.data as any).usage,
      latencyMs: Date.now() - startedAt,
      properties: {
        request_id: requestId,
        streaming: false,
        total_weeks: totalWeeks,
        plan_type: body.planType,
        target_distance: body.targetDistance,
        max_output_tokens: maxOutputTokens,
      },
    });

    return NextResponse.json(
      {
        plan: enforcePlanSafety(normalizePlan(generated.object), derivePlanPolicy(body)),
        source: 'ai',
        requestId,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[generate-plan] Unexpected error', { requestId, error });
    return NextResponse.json(
      {
        plan: null,
        source: 'fallback',
        error: 'Unexpected error. Please try again.',
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
