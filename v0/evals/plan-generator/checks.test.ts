import { describe, it, expect } from 'vitest';
import { cases } from './cases';
import { runChecks } from './checks';
import { generateFallbackPlan, resolveUser, resolveTotalWeeks } from '@/lib/plan/plan-core';

// Offline test (no API): proves the deterministic check engine runs across the
// whole golden set, and that the deterministic fallback plan — the plan users
// get when the LLM is unavailable — is itself schema-valid, correctly sized,
// and free of hard sessions for recovery/mindful challenges.

describe('plan-generator deterministic checks (offline)', () => {
  it('every golden case has a matching deterministic fallback plan that passes structural checks', () => {
    for (const c of cases) {
      const user = resolveUser(c.request);
      const weeks = resolveTotalWeeks(c.request);
      const plan = generateFallbackPlan(user, weeks, c.request.planPreferences, c.request.challenge);
      const byId = Object.fromEntries(runChecks(plan, c).map((r) => [r.id, r]));

      expect(byId['schema-valid'].pass, `${c.id} schema`).toBe(true);
      expect(byId['total-weeks'].pass, `${c.id} total-weeks: ${byId['total-weeks'].detail}`).toBe(true);
      expect(byId['weeks-in-range'].pass, `${c.id} weeks-in-range`).toBe(true);
    }
  });

  it('recovery and mindful fallback plans contain zero hard sessions', () => {
    const safetyCases = cases.filter((c) => c.expect.noHardSessions);
    expect(safetyCases.length).toBeGreaterThan(0);
    for (const c of safetyCases) {
      const user = resolveUser(c.request);
      const weeks = resolveTotalWeeks(c.request);
      const plan = generateFallbackPlan(user, weeks, c.request.planPreferences, c.request.challenge);
      const noHard = runChecks(plan, c).find((r) => r.id === 'no-hard-sessions');
      expect(noHard?.pass, `${c.id}: ${noHard?.detail}`).toBe(true);
    }
  });
});
