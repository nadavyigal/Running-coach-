import { describe, it, expect } from 'vitest';
import { cases } from './cases';
import { runChecks, criticalFailures } from './checks';
import {
  derivePlanPolicy,
  enforcePlanSafety,
  computeMaxOutputTokens,
  generateFallbackPlan,
  resolveUser,
  resolveTotalWeeks,
  type PlanData,
} from '@/lib/plan/plan-core';

// Offline tests (no API): unit-test the Story 1b safety guardrails and the
// deterministic check engine. These run free in normal CI.

describe('enforcePlanSafety (Story 1b guardrails)', () => {
  const basePlan = (workouts: PlanData['workouts']): PlanData => ({
    title: 'Test Plan',
    description: 'A sufficiently long description for the rationale check to pass.',
    totalWeeks: Math.max(1, ...workouts.map((w) => w.week)),
    workouts,
  });

  it('strips ALL hard sessions from a low-intensity plan', () => {
    const policy = derivePlanPolicy({ user: { experience: 'beginner', goal: 'habit' } });
    expect(policy.lowIntensity).toBe(true);
    const plan = basePlan([
      { week: 1, day: 'Mon', type: 'easy', distance: 4, duration: 24 },
      { week: 1, day: 'Wed', type: 'tempo', distance: 5, duration: 30 },
      { week: 1, day: 'Fri', type: 'intervals', distance: 6, duration: 36 },
    ]);
    const safe = enforcePlanSafety(plan, policy);
    const hard = safe.workouts.filter((w) => ['tempo', 'intervals', 'hill', 'time-trial'].includes(w.type));
    expect(hard).toHaveLength(0);
  });

  it('caps quality sessions per week when hard sessions are allowed', () => {
    const policy = derivePlanPolicy({
      user: { experience: 'advanced', goal: 'distance', daysPerWeek: 5 },
    });
    expect(policy.lowIntensity).toBe(false);
    const plan = basePlan([
      { week: 1, day: 'Mon', type: 'tempo', distance: 8, duration: 48 },
      { week: 1, day: 'Tue', type: 'intervals', distance: 8, duration: 48 },
      { week: 1, day: 'Wed', type: 'hill', distance: 8, duration: 48 },
      { week: 1, day: 'Fri', type: 'tempo', distance: 8, duration: 48 },
      { week: 1, day: 'Sun', type: 'long', distance: 14, duration: 84 },
    ]);
    const safe = enforcePlanSafety(plan, policy);
    const hard = safe.workouts.filter((w) => ['tempo', 'intervals', 'hill', 'time-trial'].includes(w.type));
    expect(hard.length).toBeLessThanOrEqual(policy.maxHardPerWeek);
  });

  it('clamps any single workout to the experience distance bound', () => {
    const policy = derivePlanPolicy({ user: { experience: 'beginner', goal: 'distance' } });
    const plan = basePlan([{ week: 1, day: 'Sun', type: 'long', distance: 30, duration: 180 }]);
    const safe = enforcePlanSafety(plan, policy);
    expect(Math.max(...safe.workouts.map((w) => w.distance))).toBeLessThanOrEqual(policy.maxWorkoutKm);
  });

  it('caps week-over-week volume growth to the 10% rule', () => {
    const policy = derivePlanPolicy({ user: { experience: 'advanced', goal: 'distance', daysPerWeek: 3 } });
    const plan = basePlan([
      { week: 1, day: 'Mon', type: 'easy', distance: 10, duration: 60 },
      { week: 2, day: 'Mon', type: 'easy', distance: 20, duration: 120 }, // 100% jump
    ]);
    const safe = enforcePlanSafety(plan, policy);
    const w1 = safe.workouts.filter((w) => w.week === 1).reduce((s, w) => s + w.distance, 0);
    const w2 = safe.workouts.filter((w) => w.week === 2).reduce((s, w) => s + w.distance, 0);
    expect(w2 / w1).toBeLessThanOrEqual(policy.maxWeeklyGrowth + 0.1);
  });
});

describe('computeMaxOutputTokens', () => {
  it('scales above the old 1200 cap for long multi-week plans', () => {
    expect(computeMaxOutputTokens(2, 3)).toBeGreaterThanOrEqual(1200);
    expect(computeMaxOutputTokens(12, 5)).toBeGreaterThan(1200);
    expect(computeMaxOutputTokens(16, 6)).toBeLessThanOrEqual(8000);
  });
});

describe('plan-generator deterministic checks (offline)', () => {
  it('enforced fallback plans pass all critical checks for every golden case', () => {
    for (const c of cases) {
      const user = resolveUser(c.request);
      const weeks = resolveTotalWeeks(c.request);
      const raw = generateFallbackPlan(user, weeks, c.request.planPreferences, c.request.challenge);
      const safe = enforcePlanSafety(raw, derivePlanPolicy(c.request));
      const failures = criticalFailures(runChecks(safe, c));
      expect(failures.map((f) => `${f.id}: ${f.detail}`), c.id).toEqual([]);
    }
  });
});
