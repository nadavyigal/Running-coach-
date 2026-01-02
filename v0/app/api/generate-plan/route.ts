import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitizeForPrompt } from '@/lib/security';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  };
}

function resolveTotalWeeks(body: PlanRequest, experience: string) {
  if (typeof body.totalWeeks === 'number' && Number.isFinite(body.totalWeeks)) {
    return clampNumber(Math.round(body.totalWeeks), 1, 16);
  }
  if (body.rookie_challenge) {
    return 2;
  }
  return experience === 'beginner' ? 4 : experience === 'intermediate' ? 6 : 8;
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

  const baseDistance =
    user.experience === 'beginner' ? 3 : user.experience === 'intermediate' ? 5 : 7;

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
    const totalWeeks = resolveTotalWeeks(body, user.experience);
    const fallbackPlan = generateFallbackPlan(user, totalWeeks, body.planPreferences);

    const prompt = buildPlanPrompt(
      user,
      totalWeeks,
      body.planPreferences,
      body.planType,
      body.targetDistance
    );

    const result = await withSecureOpenAI(async () => {
      return generateText({
        model: openai('gpt-4o'),
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
          message: result.error?.message || 'AI service unavailable. Using fallback plan.',
          requestId,
        },
        { status: result.error?.status || 503 }
      );
    }

    const text = String((result.data as { text?: string }).text || '');
    const jsonText = extractJson(text);
    if (!jsonText) {
      logger.warn('[generate-plan] AI returned non-JSON output', { requestId });
      return NextResponse.json(
        {
          plan: fallbackPlan,
          source: 'fallback',
          message: 'AI response could not be parsed. Using fallback plan.',
          requestId,
        },
        { status: 502 }
      );
    }

    let parsed: PlanData;
    try {
      parsed = PlanSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      logger.warn('[generate-plan] AI output failed validation', { requestId, error });
      return NextResponse.json(
        {
          plan: fallbackPlan,
          source: 'fallback',
          message: 'AI output invalid. Using fallback plan.',
          requestId,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        plan: normalizePlan(parsed),
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
