import type { PlanRequest } from '@/lib/plan/plan-core';

// Golden set for the plan-generator eval.
//
// Each case is a realistic persona (the `request` is a real PlanRequest body)
// plus `expect` bounds used by the deterministic safety checks in `checks.ts`.
// The LM-judge in `judge.ts` scores coaching quality on top of these.
//
// `expect.totalWeeks` must equal what `resolveTotalWeeks(request)` returns so
// the deterministic fallback plan also satisfies the offline checks.

export interface EvalExpectations {
  /** Must equal resolveTotalWeeks(request). */
  totalWeeks: number;
  /** Recovery/mindful plans must contain zero hard sessions. */
  noHardSessions?: boolean;
  /** Upper sanity bound (km) for any single workout for this persona. */
  maxWorkoutKm: number;
  /** Max allowed week-over-week total-volume growth ratio (10% rule + margin). */
  maxWeeklyGrowth: number;
}

export interface EvalCase {
  id: string;
  description: string;
  request: PlanRequest;
  expect: EvalExpectations;
}

export const cases: EvalCase[] = [
  {
    id: 'beginner-5k-habit',
    description: 'Brand-new runner building a habit, 3 days/week, 4 weeks.',
    request: {
      user: { experience: 'beginner', goal: 'habit', daysPerWeek: 3, preferredTimes: ['morning'] },
      totalWeeks: 4,
      targetDistance: '5k',
    },
    expect: { totalWeeks: 4, maxWorkoutKm: 8, maxWeeklyGrowth: 1.4 },
  },
  {
    id: 'beginner-rookie-2wk',
    description: 'Rookie challenge onboarding, defaults to a 2-week confidence block.',
    request: {
      user: { experience: 'beginner', goal: 'habit', daysPerWeek: 3, preferredTimes: ['evening'] },
      rookie_challenge: true,
    },
    expect: { totalWeeks: 2, maxWorkoutKm: 6, maxWeeklyGrowth: 1.4 },
  },
  {
    id: 'intermediate-half-marathon',
    description: 'Intermediate runner training for a half marathon, 4 days/week, 8 weeks.',
    request: {
      user: { experience: 'intermediate', goal: 'distance', daysPerWeek: 4, preferredTimes: ['morning'], averageWeeklyKm: 30 },
      totalWeeks: 8,
      planType: 'race',
      targetDistance: 'half-marathon',
    },
    expect: { totalWeeks: 8, maxWorkoutKm: 20, maxWeeklyGrowth: 1.3 },
  },
  {
    id: 'advanced-marathon',
    description: 'Advanced runner, 50km/week base, marathon build, 5 days/week, 12 weeks.',
    request: {
      user: { experience: 'advanced', goal: 'distance', daysPerWeek: 5, preferredTimes: ['morning'], averageWeeklyKm: 50 },
      totalWeeks: 12,
      planType: 'race',
      targetDistance: 'marathon',
      trainingHistory: { weeklyVolumeKm: 50, consistencyScore: 0.9 },
    },
    expect: { totalWeeks: 12, maxWorkoutKm: 34, maxWeeklyGrowth: 1.2 },
  },
  {
    id: 'masters-runner-58',
    description: 'Masters runner age 58, intermediate, 3 days/week, 6 weeks — needs conservative load.',
    request: {
      user: { experience: 'intermediate', goal: 'habit', daysPerWeek: 3, preferredTimes: ['morning'], age: 58, averageWeeklyKm: 20 },
      totalWeeks: 6,
    },
    expect: { totalWeeks: 6, maxWorkoutKm: 16, maxWeeklyGrowth: 1.25 },
  },
  {
    id: 'recovery-challenge',
    description: 'Recovery-focused challenge — must avoid all hard sessions.',
    request: {
      user: { experience: 'intermediate', goal: 'habit', daysPerWeek: 3, preferredTimes: ['evening'] },
      challenge: { name: 'Easy Reset', slug: 'easy-reset', category: 'recovery', durationDays: 14 },
    },
    expect: { totalWeeks: 2, noHardSessions: true, maxWorkoutKm: 10, maxWeeklyGrowth: 1.3 },
  },
  {
    id: 'mindful-challenge',
    description: 'Mindful challenge — mostly easy, no hard intervals.',
    request: {
      user: { experience: 'beginner', goal: 'habit', daysPerWeek: 3, preferredTimes: ['morning'] },
      challenge: { name: 'Mindful Miles', slug: 'mindful-miles', category: 'mindful', durationDays: 21 },
    },
    expect: { totalWeeks: 3, noHardSessions: true, maxWorkoutKm: 8, maxWeeklyGrowth: 1.4 },
  },
  {
    id: 'performance-challenge',
    description: 'Performance challenge — progressive overload with quality sessions allowed.',
    request: {
      user: { experience: 'intermediate', goal: 'speed', daysPerWeek: 4, preferredTimes: ['morning'], averageWeeklyKm: 35 },
      challenge: { name: 'Speed Surge', slug: 'speed-surge', category: 'performance', difficulty: 'intermediate', durationDays: 28 },
    },
    expect: { totalWeeks: 4, maxWorkoutKm: 18, maxWeeklyGrowth: 1.3 },
  },
  {
    id: 'speed-goal-5k',
    description: 'Intermediate runner chasing a faster 5k, 4 days/week, 6 weeks.',
    request: {
      user: { experience: 'intermediate', goal: 'speed', daysPerWeek: 4, preferredTimes: ['evening'], averageWeeklyKm: 28 },
      totalWeeks: 6,
      targetDistance: '5k',
      goals: { primaryGoal: { title: 'Sub-25 5k', goalType: 'time', target: '24:59', deadline: '2026-09-01' } },
    },
    expect: { totalWeeks: 6, maxWorkoutKm: 14, maxWeeklyGrowth: 1.3 },
  },
  {
    id: 'high-volume-history',
    description: 'High-volume runner (60km/week), 6 days/week, 8 weeks — no abrupt spikes.',
    request: {
      user: { experience: 'advanced', goal: 'distance', daysPerWeek: 6, preferredTimes: ['morning'], averageWeeklyKm: 60 },
      totalWeeks: 8,
      trainingHistory: { weeklyVolumeKm: 60, consistencyScore: 0.95 },
    },
    expect: { totalWeeks: 8, maxWorkoutKm: 36, maxWeeklyGrowth: 1.2 },
  },
  {
    id: 'low-consistency-return',
    description: 'Returning runner with low consistency — should rebuild conservatively.',
    request: {
      user: { experience: 'beginner', goal: 'habit', daysPerWeek: 3, preferredTimes: ['morning'], averageWeeklyKm: 8 },
      totalWeeks: 4,
      trainingHistory: {
        weeklyVolumeKm: 8,
        consistencyScore: 0.2,
        recentRuns: [{ date: '2026-06-01', distanceKm: 3, durationMinutes: 22, rpe: 6 }],
      },
    },
    expect: { totalWeeks: 4, maxWorkoutKm: 10, maxWeeklyGrowth: 1.3 },
  },
  {
    id: 'time-constrained-2day',
    description: 'Busy beginner who can only run 2 days/week, 4 weeks.',
    request: {
      user: { experience: 'beginner', goal: 'habit', daysPerWeek: 2, preferredTimes: ['evening'] },
      totalWeeks: 4,
      planPreferences: { trainingDays: ['Tue', 'Sat'], longRunDay: 'Sat' },
    },
    expect: { totalWeeks: 4, maxWorkoutKm: 8, maxWeeklyGrowth: 1.4 },
  },
];
