import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitizeForPrompt } from '@/lib/security';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { logger } from '@/lib/logger';
import { rateLimiter, securityConfig } from '@/lib/security.config';
import { securityMonitor } from '@/lib/security.monitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Get client IP for rate limiting
function getClientIP(request: Request): string {
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  if (realIP) return realIP;
  return '127.0.0.1';
}

const WeekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

const WorkoutSchema = z.object({
  week: z.number().min(1).max(16),
  day: WeekdaySchema,
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest']),
  distance: z.number().min(0).max(50),
  duration: z.number().min(0).max(300).optional(),
  notes: z.string().optional(),
});

const PlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  totalWeeks: z.number().min(1).max(16),
  workouts: z.array(WorkoutSchema).min(1),
});

type WeekdayShort = z.infer<typeof WeekdaySchema>;
type PlanData = z.infer<typeof PlanSchema>;

const DEFAULT_PACE_MIN_PER_KM = 6;

type PlanRequest = {
  user?: {
    goal?: 'habit' | 'distance' | 'speed';
    experience?: 'beginner' | 'intermediate' | 'advanced';
    daysPerWeek?: number;
    preferredTimes?: string[];
    age?: number;
    averageWeeklyKm?: number;
  };
  userContext?: {
    goal?: 'habit' | 'distance' | 'speed';
    experience?: 'beginner' | 'intermediate' | 'advanced';
    daysPerWeek?: number;
    preferredTimes?: string[];
    age?: number;
    motivations?: string[];
    barriers?: string[];
    coachingStyle?: string;
    averageWeeklyKm?: number;
  };
  planType?: string;
  targetDistance?: string;
  rookie_challenge?: boolean;
  totalWeeks?: number;
  planPreferences?: {
    trainingDays?: string[];
    availableDays?: string[];
    longRunDay?: string;
    trainingVolume?: string;
    difficulty?: string;
  };
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isWeekdayShort(value: unknown): value is WeekdayShort {
  return WeekdaySchema.safeParse(value).success;
}

function resolveDaysPerWeek(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampNumber(Math.round(value), 2, 6);
  }
  return 3;
}

function resolveUser(body: PlanRequest) {
  const source = body.userContext ?? body.user ?? {};
  const goal =
    source.goal === 'habit' || source.goal === 'distance' || source.goal === 'speed'
      ? source.goal
      : 'habit';
  const experience =
    source.experience === 'beginner' ||
    source.experience === 'intermediate' ||
    source.experience === 'advanced'
      ? source.experience
      : 'beginner';
  const daysPerWeek = resolveDaysPerWeek(source.daysPerWeek);
  const preferredTimes =
    Array.isArray(source.preferredTimes) && source.preferredTimes.length > 0
      ? source.preferredTimes
      : ['morning'];

  return {
    goal,
    experience,
    daysPerWeek,
    preferredTimes,
    age: typeof source.age === 'number' ? source.age : undefined,
    averageWeeklyKm: typeof source.averageWeeklyKm === 'number' ? source.averageWeeklyKm : undefined,
  };
}

function resolveTotalWeeks(body: PlanRequest) {
  if (typeof body.totalWeeks === 'number' && Number.isFinite(body.totalWeeks)) {
    return clampNumber(Math.round(body.totalWeeks), 1, 16);
  }
  if (body.rookie_challenge) return 2;
  return 2;
}

function resolveTrainingDays(daysPerWeek: number, planPreferences?: PlanRequest['planPreferences']) {
  const trainingDaysRaw = planPreferences?.trainingDays ?? planPreferences?.availableDays;
  const preferredDays = Array.isArray(trainingDaysRaw)
    ? trainingDaysRaw.filter((day) => isWeekdayShort(day))
    : [];

  const defaultPattern =
    daysPerWeek === 2
      ? (['Tue', 'Sat'] as WeekdayShort[])
      : daysPerWeek === 3
        ? (['Mon', 'Wed', 'Fri'] as WeekdayShort[])
        : daysPerWeek === 4
          ? (['Mon', 'Wed', 'Fri', 'Sun'] as WeekdayShort[])
          : daysPerWeek === 5
            ? (['Mon', 'Tue', 'Thu', 'Fri', 'Sun'] as WeekdayShort[])
            : (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as WeekdayShort[]);

  const resolvedDays =
    preferredDays.length >= daysPerWeek ? preferredDays.slice(0, daysPerWeek) : defaultPattern;

  const longRunDay = isWeekdayShort(planPreferences?.longRunDay)
    ? (planPreferences?.longRunDay as WeekdayShort)
    : resolvedDays[resolvedDays.length - 1];

  return { trainingDays: resolvedDays, longRunDay };
}

function normalizePlan(plan: PlanData): PlanData {
  const workouts = plan.workouts.map((workout) => {
    const distance = Number.isFinite(workout.distance) ? workout.distance : 0;
    const duration =
      typeof workout.duration === 'number' && Number.isFinite(workout.duration)
        ? workout.duration
        : Math.round(distance * DEFAULT_PACE_MIN_PER_KM);

    if (workout.type === 'rest') {
      return {
        ...workout,
        distance: 0,
        duration: duration || 0,
      };
    }

    return {
      ...workout,
      distance: clampNumber(distance, 0, 50),
      duration: clampNumber(duration, 0, 300),
    };
  });

  return {
    ...plan,
    workouts,
  };
}

function generateFallbackPlan(
  user: ReturnType<typeof resolveUser>,
  totalWeeks: number,
  planPreferences?: PlanRequest['planPreferences']
): PlanData {
  const daysPerWeek = resolveDaysPerWeek(user.daysPerWeek);
  const { trainingDays, longRunDay } = resolveTrainingDays(daysPerWeek, planPreferences);

  let baseDistance: number;
  if (typeof user.averageWeeklyKm === 'number' && user.averageWeeklyKm > 0) {
    baseDistance = (user.averageWeeklyKm * 0.9) / daysPerWeek;
  } else {
    baseDistance =
      user.experience === 'beginner' ? 3 : user.experience === 'intermediate' ? 5 : 7;
  }

  const workouts: PlanData['workouts'] = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    const weeklyBase = baseDistance + (week - 1) * 0.5;

    for (const day of trainingDays) {
      const isLongRun = day === longRunDay;
      const type: PlanData['workouts'][number]['type'] = isLongRun
        ? 'long'
        : week % 2 === 0 && trainingDays.length >= 3 && day === trainingDays[1]
          ? 'tempo'
          : 'easy';

      const distance = isLongRun ? weeklyBase * 1.4 : weeklyBase;
      const duration =
        type === 'tempo'
          ? Math.round(distance * (DEFAULT_PACE_MIN_PER_KM - 0.5))
          : Math.round(distance * DEFAULT_PACE_MIN_PER_KM);

      workouts.push({
        week,
        day,
        type,
        distance: clampNumber(Math.round(distance * 10) / 10, 0, 50),
        duration: clampNumber(duration, 0, 300),
        notes:
          type === 'easy'
            ? 'Keep a conversational pace.'
            : type === 'long'
              ? 'Focus on steady effort, not speed.'
              : 'Comfortably hard effort with controlled breathing.',
      });
    }
  }

  return {
    title:
      user.goal === 'habit'
        ? 'Build Your Running Habit'
        : user.goal === 'distance'
          ? 'Increase Your Distance'
          : 'Improve Your Speed',
    description: `A ${totalWeeks}-week plan for ${user.experience} runners focused on ${user.goal}.`,
    totalWeeks,
    workouts,
  };
}

function buildPlanPrompt(
  user: ReturnType<typeof resolveUser>,
  totalWeeks: number,
  planPreferences?: PlanRequest['planPreferences'],
  planType?: string,
  targetDistance?: string
) {
  const sanitizedPlanType = planType ? sanitizeForPrompt(planType, 50) : '';
  const sanitizedTarget = targetDistance ? sanitizeForPrompt(targetDistance, 50) : '';
  const sanitizedVolume = planPreferences?.trainingVolume
    ? sanitizeForPrompt(planPreferences.trainingVolume, 50)
    : '';
  const sanitizedDifficulty = planPreferences?.difficulty
    ? sanitizeForPrompt(planPreferences.difficulty, 50)
    : '';
  const weeklyKmContext = user.averageWeeklyKm
    ? `- Current weekly volume: ${user.averageWeeklyKm}km/week (use as starting baseline)`
    : '';

  const { trainingDays, longRunDay } = resolveTrainingDays(user.daysPerWeek, planPreferences);

  return `Create a running training plan. Return JSON only with this shape:
{
  "title": "string",
  "description": "string",
  "totalWeeks": ${totalWeeks},
  "workouts": [
    {"week": 1, "day": "Mon", "type": "easy", "distance": 4, "duration": 24, "notes": "string"}
  ]
}

Runner profile:
- Experience: ${user.experience}
- Goal: ${user.goal}
- Days per week: ${user.daysPerWeek}
- Preferred times: ${user.preferredTimes.join(', ')}
${weeklyKmContext}
${sanitizedPlanType ? `- Plan type: ${sanitizedPlanType}` : ''}
${sanitizedTarget ? `- Target distance: ${sanitizedTarget}` : ''}
${sanitizedVolume ? `- Training volume: ${sanitizedVolume}` : ''}
${sanitizedDifficulty ? `- Difficulty: ${sanitizedDifficulty}` : ''}

Constraints:
- totalWeeks must be ${totalWeeks}
- Schedule workouts only on: ${trainingDays.join(', ')}
- Long run day: ${longRunDay}
- Include easy, tempo, intervals, and long runs across the plan.
- Distances are in kilometers, durations in minutes.
- Keep progression gradual and safe.`;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return '';
}

export async function POST(req: Request) {
  const requestId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Rate limiting check (10 requests per minute for AI routes)
  const clientIP = getClientIP(req);
  const rateLimitResult = await rateLimiter.check(clientIP, securityConfig.apiSecurity.chatRateLimit);

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
    const fallbackPlan = generateFallbackPlan(user, totalWeeks, body.planPreferences);

    const prompt = buildPlanPrompt(
      user,
      totalWeeks,
      body.planPreferences,
      body.planType,
      body.targetDistance
    );

    const result = await withSecureOpenAI(async () => {
      return generateObject({
        model: openai('gpt-4o'),
        schema: PlanSchema,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 1200,
      });
    });

    if (!result.success || !result.data) {
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

    return NextResponse.json(
      {
        plan: normalizePlan(generated.object),
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
