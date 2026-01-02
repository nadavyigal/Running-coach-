import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { sanitizeForPrompt, sanitizeDistance } from '@/lib/security';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WORKOUT_NAME_MAX = 80;
const WORKOUT_DESC_MAX = 200;
const MODEL_TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `You are an expert running coach. Create a detailed workout breakdown.

Format your response as a JSON object with this structure:
{
  "title": "Workout Name",
  "description": "Brief description",
  "duration": "estimated time range",
  "phases": [
    {
      "phase": "Warm-up",
      "color": "bg-gray-500",
      "repeat": "optional repeat label",
      "steps": [
        {
          "step": 1,
          "description": "detailed instruction",
          "detail": "additional guidance (optional)",
          "type": "RUN"
        }
      ]
    }
  ]
}

Rules:
- Always include Warm-up, Main Set, and Cool Down phases.
- For interval-style workouts, add a Strides/Activation phase and use "repeat" on the Main Set with RUN/RECOVER steps.
- Keep steps concise and action-oriented with short cues in "detail".
- Return valid JSON only.`;

type WorkoutRequest = {
  workout?: {
    name?: string;
    description?: string;
  };
  goalType?: 'distance' | 'duration';
  targetValue?: string | number;
  difficulty?: 'open' | 'easy' | 'medium';
};

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
  const requestId = `workout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json', requestId },
        { status: 400 }
      );
    }

    let body: WorkoutRequest = {};
    try {
      body = (await req.json()) as WorkoutRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const workout = body.workout || {};
    const goalType = body.goalType;
    const difficulty = body.difficulty;
    const rawTargetValue = String(body.targetValue || '').trim();

    if (!workout || (goalType !== 'distance' && goalType !== 'duration')) {
      return NextResponse.json({ error: 'Invalid workout request', requestId }, { status: 400 });
    }

    if (difficulty !== 'open' && difficulty !== 'easy' && difficulty !== 'medium') {
      return NextResponse.json({ error: 'Invalid workout difficulty', requestId }, { status: 400 });
    }

    const workoutName = sanitizeForPrompt(String(workout.name || ''), WORKOUT_NAME_MAX);
    const workoutDescription = sanitizeForPrompt(String(workout.description || ''), WORKOUT_DESC_MAX);

    if (!workoutName || !rawTargetValue) {
      return NextResponse.json(
        { error: 'Workout name and target value are required', requestId },
        { status: 400 }
      );
    }

    let cleanedTargetValue = '';
    if (goalType === 'distance') {
      const sanitizedDistance = sanitizeDistance(rawTargetValue);
      if (!sanitizedDistance) {
        return NextResponse.json({ error: 'Invalid target distance', requestId }, { status: 400 });
      }
      cleanedTargetValue = sanitizedDistance;
    } else {
      const durationValue = Number.parseFloat(rawTargetValue);
      if (!Number.isFinite(durationValue) || durationValue <= 0 || durationValue > 300) {
        return NextResponse.json({ error: 'Invalid target duration', requestId }, { status: 400 });
      }
      cleanedTargetValue = durationValue.toString();
    }

    const goalLabel =
      goalType === 'distance' ? `${cleanedTargetValue} km` : `${cleanedTargetValue} minutes`;
    const detailSuffix = workoutDescription
      ? ` The workout should be appropriate for: ${workoutDescription}.`
      : '';
    const prompt = `Create a ${workoutName} workout for ${goalLabel} at ${difficulty} difficulty level.${detailSuffix}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

    try {
      const result = await withSecureOpenAI(async () => {
        return generateText({
          model: openai('gpt-4o'),
          system: SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: 700,
          temperature: 0.7,
          abortSignal: controller.signal,
        });
      });

      if (!result.success || !result.data) {
        return NextResponse.json(
          {
            error: result.error?.message || 'AI service temporarily unavailable',
            fallback: true,
            requestId,
          },
          { status: result.error?.status || 503 }
        );
      }

      const text = String((result.data as { text?: string }).text || '');
      const jsonText = extractJson(text);
      if (!jsonText) {
        logger.warn('[workouts:generate] AI returned non-JSON output', { requestId });
        return NextResponse.json(
          { error: 'AI response could not be parsed', fallback: true, requestId },
          { status: 502 }
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        logger.warn('[workouts:generate] AI JSON parse failed', { requestId, error });
        return NextResponse.json(
          { error: 'AI response could not be parsed', fallback: true, requestId },
          { status: 502 }
        );
      }

      return NextResponse.json({ workout: parsed, requestId }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.error('[workouts:generate] Unexpected error', { requestId, error });
    return NextResponse.json(
      { error: 'Unexpected error', fallback: true, requestId },
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
