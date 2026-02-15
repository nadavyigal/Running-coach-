import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitizeForPrompt } from '@/lib/security';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { logger } from '@/lib/logger';
import { rateLimiter, securityConfig } from '@/lib/security.config';
import { securityMonitor } from '@/lib/security.monitoring';
import { PersonalizationContextBuilder, type PersonalizationContext } from '@/lib/personalizationContext';
import { formatPace } from '@/lib/userDataValidation';

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
  userId?: number;
  user?: {
    goal?: 'habit' | 'distance' | 'speed';
    experience?: 'beginner' | 'intermediate' | 'advanced';
    daysPerWeek?: number;
    preferredTimes?: string[];
    age?: number;
    averageWeeklyKm?: number;
  };
  trainingHistory?: {
    weeklyVolumeKm?: number;
    consistencyScore?: number;
    recentRuns?: Array<{
      date?: string;
      distanceKm?: number;
      durationMinutes?: number;
      avgPace?: string;
      rpe?: number;
      notes?: string;
      surface?: string;
    }>;
  };
  goals?: {
    primaryGoal?: {
      title?: string;
      goalType?: string;
      category?: string;
      target?: string;
      deadline?: string;
      progressPercentage?: number;
    };
    activeGoals?: Array<{
      title?: string;
      goalType?: string;
      category?: string;
      target?: string;
      deadline?: string;
      progressPercentage?: number;
    }>;
  };
  challenge?: {
    slug?: string;
    name?: string;
    category?: 'habit' | 'mindful' | 'performance' | 'recovery' | string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | string;
    durationDays?: number;
    workoutPattern?: string;
    coachTone?: string;
    targetAudience?: string;
    promise?: string;
  };
  userContext?: {
    userId?: number;
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

  const historyWeeklyVolume =
    typeof body.trainingHistory?.weeklyVolumeKm === 'number' ? body.trainingHistory.weeklyVolumeKm : undefined;
  const averageWeeklyKm =
    typeof source.averageWeeklyKm === 'number' ? source.averageWeeklyKm : historyWeeklyVolume;

  return {
    goal,
    experience,
    daysPerWeek,
    preferredTimes,
    age: typeof source.age === 'number' ? source.age : undefined,
    averageWeeklyKm,
  };
}

function resolveTotalWeeks(body: PlanRequest) {
  if (typeof body.totalWeeks === 'number' && Number.isFinite(body.totalWeeks)) {
    return clampNumber(Math.round(body.totalWeeks), 1, 16);
  }
  if (typeof body.challenge?.durationDays === 'number' && Number.isFinite(body.challenge.durationDays)) {
    return clampNumber(Math.ceil(body.challenge.durationDays / 7), 1, 16);
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
  planPreferences?: PlanRequest['planPreferences'],
  challenge?: PlanRequest['challenge']
): PlanData {
  const daysPerWeek = resolveDaysPerWeek(user.daysPerWeek);
  const { trainingDays, longRunDay } = resolveTrainingDays(daysPerWeek, planPreferences);
  const challengeCategory = challenge?.category;
  const allowIntensity = challengeCategory === 'performance';
  const mindfulFocus = challengeCategory === 'mindful';
  const recoveryFocus = challengeCategory === 'recovery';

  let baseDistance: number;
  if (typeof user.averageWeeklyKm === 'number' && user.averageWeeklyKm > 0) {
    baseDistance = (user.averageWeeklyKm * 0.9) / daysPerWeek;
  } else {
    baseDistance =
      user.experience === 'beginner' ? 3 : user.experience === 'intermediate' ? 5 : 7;
  }

  const workouts: PlanData['workouts'] = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    const weeklyBaseRaw = baseDistance + (week - 1) * 0.5;
    const weeklyBase = recoveryFocus ? weeklyBaseRaw * 0.8 : weeklyBaseRaw;

    for (const day of trainingDays) {
      const isLongRun = day === longRunDay;
      const type: PlanData['workouts'][number]['type'] = recoveryFocus
        ? 'easy'
        : isLongRun
          ? 'long'
          : allowIntensity && week % 2 === 0 && trainingDays.length >= 3 && day === trainingDays[1]
            ? 'tempo'
            : 'easy';

      const distance = isLongRun ? weeklyBase * 1.4 : weeklyBase;
      const duration =
        type === 'tempo'
          ? Math.round(distance * (DEFAULT_PACE_MIN_PER_KM - 0.5))
          : Math.round(distance * DEFAULT_PACE_MIN_PER_KM);

      const mindfulNote = 'Keep a relaxed pace and focus on steady breathing.';
      const easyNote = 'Keep a conversational pace.';
      const longNote = 'Focus on steady effort, not speed.';
      const tempoNote = 'Comfortably hard effort with controlled breathing.';

      workouts.push({
        week,
        day,
        type,
        distance: clampNumber(Math.round(distance * 10) / 10, 0, 50),
        duration: clampNumber(duration, 0, 300),
        notes:
          type === 'easy'
            ? mindfulFocus
              ? mindfulNote
              : easyNote
            : type === 'long'
              ? longNote
              : tempoNote,
      });
    }
  }

  return {
    title: challenge?.name
      ? `${challenge.name} Plan`
      : user.goal === 'habit'
        ? 'Build Your Running Habit'
        : user.goal === 'distance'
          ? 'Increase Your Distance'
          : 'Improve Your Speed',
    description: challenge?.name
      ? `A ${totalWeeks}-week plan aligned to the ${challenge.name} challenge for ${user.experience} runners.`
      : `A ${totalWeeks}-week plan for ${user.experience} runners focused on ${user.goal}.`,
    totalWeeks,
    workouts,
  };
}

function buildTrainingHistoryContext(trainingHistory?: PlanRequest['trainingHistory']) {
  if (!trainingHistory) return '';

  const weeklyVolumeLine =
    typeof trainingHistory.weeklyVolumeKm === 'number'
      ? `- Recent weekly volume: ${Math.round(trainingHistory.weeklyVolumeKm * 10) / 10}km`
      : '';
  const consistencyLine =
    typeof trainingHistory.consistencyScore === 'number'
      ? `- 4-week consistency score: ${Math.round(trainingHistory.consistencyScore * 100)}%`
      : '';

  const runLines = Array.isArray(trainingHistory.recentRuns)
    ? trainingHistory.recentRuns
        .slice(0, 6)
        .map((run, index) => {
          const date = run.date ? sanitizeForPrompt(run.date, 30) : `Run ${index + 1}`;
          const distance =
            typeof run.distanceKm === 'number' ? `${Math.round(run.distanceKm * 10) / 10}km` : 'n/a';
          const duration =
            typeof run.durationMinutes === 'number'
              ? `${Math.round(run.durationMinutes)}min`
              : 'n/a';
          const pace = run.avgPace ? sanitizeForPrompt(run.avgPace, 20) : 'n/a';
          const rpe = typeof run.rpe === 'number' ? `RPE ${Math.round(run.rpe)}` : 'RPE n/a';
          return `  - ${date}: ${distance}, ${duration}, ${pace}, ${rpe}`;
        })
        .join('\n')
    : '';

  if (!weeklyVolumeLine && !consistencyLine && !runLines) return '';

  return `

RECENT TRAINING HISTORY:
${weeklyVolumeLine}
${consistencyLine}
${runLines ? `- Last runs:\n${runLines}` : ''}
- Respect recent load; avoid abrupt spikes in frequency or intensity.
`;
}

function buildGoalsContext(goals?: PlanRequest['goals']) {
  if (!goals) return '';

  const primary = goals.primaryGoal;
  const primaryLine = primary?.title
    ? `- Primary goal: ${sanitizeForPrompt(primary.title, 120)}${
        primary.goalType ? ` (${sanitizeForPrompt(primary.goalType, 40)})` : ''
      }${
        primary.target ? ` target: ${sanitizeForPrompt(primary.target, 80)}` : ''
      }${
        primary.deadline ? ` by ${sanitizeForPrompt(primary.deadline, 30)}` : ''
      }`
    : '';

  const activeGoalLines = Array.isArray(goals.activeGoals)
    ? goals.activeGoals
        .slice(0, 4)
        .filter((goal) => Boolean(goal?.title))
        .map((goal) => {
          const title = goal.title ? sanitizeForPrompt(goal.title, 100) : 'Goal';
          const goalType = goal.goalType ? sanitizeForPrompt(goal.goalType, 40) : '';
          const target = goal.target ? sanitizeForPrompt(goal.target, 70) : '';
          return `  - ${title}${goalType ? ` (${goalType})` : ''}${target ? ` -> ${target}` : ''}`;
        })
        .join('\n')
    : '';

  if (!primaryLine && !activeGoalLines) return '';

  return `

GOAL CONTEXT:
${primaryLine}
${activeGoalLines ? `- Additional active goals:\n${activeGoalLines}` : ''}
- Prioritize alignment with goals without violating challenge intent or safety.
`;
}

function buildWorkoutMixConstraint(challenge?: PlanRequest['challenge']) {
  if (challenge?.category === 'performance') {
    return '- Include easy, tempo/interval, and long-run stimuli with progressive overload.';
  }
  if (challenge?.category === 'mindful') {
    return '- Keep sessions mostly easy and mindful. Avoid hard intervals unless clearly justified.';
  }
  if (challenge?.category === 'recovery') {
    return '- Keep intensity low and recovery-focused. Prefer easy or rest days; avoid hard workouts.';
  }
  if (challenge?.category === 'habit') {
    return '- Prioritize consistency and confidence with mostly easy efforts. Keep intensity optional and conservative.';
  }
  return '- Keep workout mix conservative: mostly easy runs with at most one quality workout each week.';
}

function buildPlanPrompt(
  user: ReturnType<typeof resolveUser>,
  totalWeeks: number,
  planPreferences?: PlanRequest['planPreferences'],
  planType?: string,
  targetDistance?: string,
  challenge?: PlanRequest['challenge'],
  advancedMetrics?: PersonalizationContext['advancedMetrics'],
  trainingHistory?: PlanRequest['trainingHistory'],
  goals?: PlanRequest['goals']
) {
  const sanitizedPlanType = planType ? sanitizeForPrompt(planType, 50) : '';
  const sanitizedTarget = targetDistance ? sanitizeForPrompt(targetDistance, 50) : '';
  const sanitizedVolume = planPreferences?.trainingVolume
    ? sanitizeForPrompt(planPreferences.trainingVolume, 50)
    : '';
  const sanitizedDifficulty = planPreferences?.difficulty
    ? sanitizeForPrompt(planPreferences.difficulty, 50)
    : '';
  const sanitizedChallengeName = challenge?.name ? sanitizeForPrompt(challenge.name, 80) : '';
  const sanitizedChallengeSlug = challenge?.slug ? sanitizeForPrompt(challenge.slug, 60) : '';
  const sanitizedChallengeCategory = challenge?.category ? sanitizeForPrompt(challenge.category, 30) : '';
  const sanitizedChallengeDifficulty = challenge?.difficulty ? sanitizeForPrompt(challenge.difficulty, 30) : '';
  const sanitizedChallengePattern = challenge?.workoutPattern
    ? sanitizeForPrompt(challenge.workoutPattern, 220)
    : '';
  const sanitizedChallengeTone = challenge?.coachTone ? sanitizeForPrompt(challenge.coachTone, 30) : '';
  const sanitizedChallengeAudience = challenge?.targetAudience
    ? sanitizeForPrompt(challenge.targetAudience, 120)
    : '';
  const sanitizedChallengePromise = challenge?.promise ? sanitizeForPrompt(challenge.promise, 140) : '';
  const weeklyKmContext = user.averageWeeklyKm
    ? `- Current weekly volume: ${user.averageWeeklyKm}km/week (use as starting baseline)`
    : '';
  const trainingHistoryContext = buildTrainingHistoryContext(trainingHistory);
  const goalsContext = buildGoalsContext(goals);

  const { trainingDays, longRunDay } = resolveTrainingDays(user.daysPerWeek, planPreferences);

  const advancedMetricsContext = advancedMetrics
    ? `

ADVANCED TRAINING METRICS:
${advancedMetrics.vdot ? `- VDOT: ${advancedMetrics.vdot.toFixed(1)} (use Jack Daniels pace zones)` : ''}
${advancedMetrics.vo2Max ? `- VO2 Max: ${advancedMetrics.vo2Max} ml/kg/min` : ''}
${advancedMetrics.lactateThreshold ? `- Lactate Threshold: ${formatPace(advancedMetrics.lactateThreshold)}/km` : ''}
${advancedMetrics.lactateThresholdHR ? `- LT Heart Rate: ${advancedMetrics.lactateThresholdHR} bpm` : ''}
${advancedMetrics.maxHeartRate ? `- Max Heart Rate: ${advancedMetrics.maxHeartRate} bpm` : ''}
${advancedMetrics.restingHeartRate ? `- Resting Heart Rate: ${advancedMetrics.restingHeartRate} bpm` : ''}

CRITICAL INSTRUCTIONS FOR USING THESE METRICS:
1. Tempo runs: set pace at or slightly below (5-10 sec/km slower) lactate threshold pace.
2. Easy runs: keep 60-90 sec/km slower than LT pace for aerobic adaptation.
3. Interval workouts: use VDOT to calculate interval pace from Jack Daniels tables.
4. Long runs: keep 90-120 sec/km slower than LT pace.
5. Heart rate guidance: if LT HR provided, include HR ranges in workout notes.
6. Progressive overload: increase volume/intensity safely based on VDOT fitness level.

PACE ZONE CALCULATIONS (if VDOT available):
- E-pace: recovery runs and easy mileage
- M-pace: marathon-specific workouts
- T-pace: threshold/tempo runs
- I-pace: VO2 max intervals (3-5 min efforts)
- R-pace: short, fast intervals (200m-400m)

Do not use generic paces when VDOT is available. Calculate specific paces.
`
    : '';

  const challengeContext = sanitizedChallengeName
    ? `

CHALLENGE CONTEXT:
- Challenge: ${sanitizedChallengeName}${sanitizedChallengeSlug ? ` (${sanitizedChallengeSlug})` : ''}
- Duration: ${typeof challenge?.durationDays === 'number' ? `${challenge.durationDays} days` : 'n/a'}
- Category: ${sanitizedChallengeCategory || 'n/a'}
- Difficulty: ${sanitizedChallengeDifficulty || 'n/a'}
- Target audience: ${sanitizedChallengeAudience || 'n/a'}
- Promise: ${sanitizedChallengePromise || 'n/a'}
- Workout pattern: ${sanitizedChallengePattern || 'n/a'}
- Coach tone: ${sanitizedChallengeTone || 'n/a'}

INSTRUCTIONS:
- Align workouts to the challenge workout pattern and tone.
- Keep the plan length aligned to the challenge duration.
- Preserve the user's experience level and weekly availability.
`
    : '';

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
${advancedMetricsContext}
${trainingHistoryContext}
${goalsContext}
${sanitizedPlanType ? `- Plan type: ${sanitizedPlanType}` : ''}
${sanitizedTarget ? `- Target distance: ${sanitizedTarget}` : ''}
${sanitizedVolume ? `- Training volume: ${sanitizedVolume}` : ''}
${sanitizedDifficulty ? `- Difficulty: ${sanitizedDifficulty}` : ''}
${challengeContext}

Constraints:
- totalWeeks must be ${totalWeeks}
- Schedule workouts only on: ${trainingDays.join(', ')}
- Long run day: ${longRunDay}
- ${buildWorkoutMixConstraint(challenge)}
- Distances are in kilometers, durations in minutes.
- Keep progression gradual and safe.
- ${advancedMetrics?.vdot ? 'Use VDOT-based pace zones for all workout intensities.' : 'Use conservative pace progression.'}`;
}

export async function POST(req: Request) {
  const requestId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
    if (body.userContext?.userId || body.userId) {
      const resolvedUserId = body.userContext?.userId ?? body.userId;
      const parsedUserId =
        typeof resolvedUserId === 'string' ? parseInt(resolvedUserId, 10) : resolvedUserId;
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
