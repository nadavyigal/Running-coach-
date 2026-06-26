import { z } from 'zod';
import { sanitizeForPrompt } from '@/lib/security';
import { formatPace } from '@/lib/userDataValidation';
import type { PersonalizationContext } from '@/lib/personalizationContext';

// Pure, deterministic plan-generation core.
//
// This module holds the prompt building, output schema, and normalization logic
// for the training-plan generator. It is extracted from
// `app/api/generate-plan/route.ts` so the exact same logic can be exercised by
// the eval harness (`evals/plan-generator/`) without going through the HTTP
// layer. The route imports from here; behavior is unchanged.

export const WeekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

export const WorkoutSchema = z.object({
  week: z.number().min(1).max(16),
  day: WeekdaySchema,
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest']),
  distance: z.number().min(0).max(50),
  duration: z.number().min(0).max(300).optional(),
  notes: z.string().optional(),
});

export const PlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  totalWeeks: z.number().min(1).max(16),
  workouts: z.array(WorkoutSchema).min(1),
});

export type WeekdayShort = z.infer<typeof WeekdaySchema>;
export type PlanData = z.infer<typeof PlanSchema>;

export const DEFAULT_PACE_MIN_PER_KM = 6;

export type PlanRequest = {
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

export function resolveUser(body: PlanRequest) {
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

export function resolveTotalWeeks(body: PlanRequest) {
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

export function normalizePlan(plan: PlanData): PlanData {
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

// ---------------------------------------------------------------------------
// Safety policy + enforcement (Story 1b)
//
// The eval showed the model cannot be trusted to honor intensity/progression
// rules from the prompt alone. These deterministic guardrails are the source of
// truth: the route enforces them on generated output, and the eval verifies the
// same properties. Prompt wording (below) is best-effort; enforcement is the
// guarantee.
// ---------------------------------------------------------------------------

export const HARD_WORKOUT_TYPES = ['tempo', 'intervals', 'hill', 'time-trial'] as const;

export interface PlanPolicy {
  /** No hard sessions at all (beginners, habit goals, recovery/mindful/habit challenges). */
  lowIntensity: boolean;
  /** Max quality (hard) sessions per week when hard sessions are allowed. */
  maxHardPerWeek: number;
  /** Max week-over-week total-distance growth ratio (10% rule). */
  maxWeeklyGrowth: number;
  /** Max distance (km) for any single workout, by experience. */
  maxWorkoutKm: number;
}

export function isLowIntensity(
  experience: 'beginner' | 'intermediate' | 'advanced',
  goal: 'habit' | 'distance' | 'speed',
  category?: string
): boolean {
  return (
    category === 'recovery' ||
    category === 'mindful' ||
    category === 'habit' ||
    experience === 'beginner' ||
    goal === 'habit'
  );
}

export function planPolicyFor(
  experience: 'beginner' | 'intermediate' | 'advanced',
  goal: 'habit' | 'distance' | 'speed',
  daysPerWeek: number,
  category?: string
): PlanPolicy {
  const lowIntensity = isLowIntensity(experience, goal, category);
  const maxWorkoutKm = experience === 'beginner' ? 15 : experience === 'advanced' ? 42 : 28;
  return {
    lowIntensity,
    maxHardPerWeek: lowIntensity ? 0 : daysPerWeek >= 4 ? 2 : 1,
    maxWeeklyGrowth: 1.1,
    maxWorkoutKm,
  };
}

export function derivePlanPolicy(body: PlanRequest): PlanPolicy {
  const user = resolveUser(body);
  return planPolicyFor(user.experience, user.goal, user.daysPerWeek, body.challenge?.category);
}

// Output-token budget scaled to plan size. The fixed 1200-token cap truncated
// long plans (12+ weeks), which silently fell back to the generic plan.
export function computeMaxOutputTokens(totalWeeks: number, daysPerWeek: number): number {
  const expectedWorkouts = Math.max(1, totalWeeks) * Math.max(2, daysPerWeek);
  return clampNumber(400 + expectedWorkouts * 90, 1200, 8000);
}

function isHardType(type: PlanData['workouts'][number]['type']): boolean {
  return (HARD_WORKOUT_TYPES as readonly string[]).includes(type);
}

// Deterministically force a generated plan to satisfy the policy:
// clamp distances, drop disallowed hard sessions, cap quality volume per week,
// and cap week-over-week load growth.
export function enforcePlanSafety(plan: PlanData, policy: PlanPolicy): PlanData {
  const easyNote = 'Keep a conversational, easy pace.';

  // 1. Clamp single-workout distance and recompute duration when changed.
  let workouts = plan.workouts.map((w) => {
    if (w.type === 'rest') return { ...w, distance: 0 };
    const distance = clampNumber(w.distance, 0, policy.maxWorkoutKm);
    if (distance === w.distance) return w;
    return { ...w, distance, duration: clampNumber(Math.round(distance * DEFAULT_PACE_MIN_PER_KM), 0, 300) };
  });

  // 2. Intensity policy: drop or cap hard sessions.
  const hardSeenPerWeek = new Map<number, number>();
  workouts = workouts.map((w) => {
    if (!isHardType(w.type)) return w;
    const seen = hardSeenPerWeek.get(w.week) ?? 0;
    const allowed = policy.lowIntensity ? 0 : policy.maxHardPerWeek;
    if (seen < allowed) {
      hardSeenPerWeek.set(w.week, seen + 1);
      return w;
    }
    return {
      ...w,
      type: 'easy' as const,
      duration: clampNumber(Math.round(w.distance * DEFAULT_PACE_MIN_PER_KM), 0, 300),
      notes: easyNote,
    };
  });

  // 3. Cap week-over-week total-distance growth (10% rule), cumulatively.
  const weeks = [...new Set(workouts.map((w) => w.week))].sort((a, b) => a - b);
  let prevTotal: number | null = null;
  for (const week of weeks) {
    const weekWorkouts = workouts.filter((w) => w.week === week && w.type !== 'rest');
    const total = weekWorkouts.reduce((sum, w) => sum + w.distance, 0);
    let allowedTotal = total;
    if (prevTotal !== null && total > 0 && total > prevTotal * policy.maxWeeklyGrowth) {
      allowedTotal = prevTotal * policy.maxWeeklyGrowth;
      const factor = allowedTotal / total;
      workouts = workouts.map((w) => {
        if (w.week !== week || w.type === 'rest') return w;
        const distance = Math.round(w.distance * factor * 10) / 10;
        return { ...w, distance, duration: clampNumber(Math.round(distance * DEFAULT_PACE_MIN_PER_KM), 0, 300) };
      });
    }
    prevTotal = allowedTotal;
  }

  return { ...plan, workouts };
}

export function generateFallbackPlan(
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

export function buildPlanPrompt(
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

  const policy = planPolicyFor(user.experience, user.goal, user.daysPerWeek, challenge?.category);
  const intensityRule = policy.lowIntensity
    ? "- This runner needs a low-intensity plan. Use ONLY 'easy', 'long', and 'rest' workout types. Do NOT include any tempo, intervals, hill, or time-trial sessions."
    : `- Include at most ${policy.maxHardPerWeek} quality session(s) (tempo, intervals, or hill) per week; keep every other run easy or long.`;

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
${intensityRule}
- Do NOT increase total weekly distance by more than 10% versus the previous week.
- No single run may exceed ${policy.maxWorkoutKm} km.
- Distances are in kilometers, durations in minutes.
- Keep progression gradual and safe.
- ${advancedMetrics?.vdot ? 'Use VDOT-based pace zones for all workout intensities.' : 'Use conservative pace progression.'}`;
}
