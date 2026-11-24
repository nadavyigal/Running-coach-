import { PlanSchema, derivePlanPolicy, type PlanData } from '@/lib/plan/plan-core';
import type { EvalCase } from './cases';

// Deterministic, code-checked safety properties for a generated plan.
// Bounds come from the SAME policy (derivePlanPolicy) the production route
// enforces, so the eval verifies that enforcement actually held. Any critical
// failure fails the eval regardless of the LM-judge.

export interface CheckResult {
  id: string;
  pass: boolean;
  critical: boolean;
  detail: string;
}

const HARD_TYPES = new Set(['tempo', 'intervals', 'hill', 'time-trial']);
// Tolerance on the weekly-growth cap to absorb 0.1km rounding from enforcement.
const GROWTH_TOLERANCE = 0.1;

const HEBREW_LETTER = /[\u0590-\u05FF]/;

/**
 * `source` matters for language: the deterministic fallback plan is English by
 * design, so the Hebrew check is critical only for AI plans (fallbacks are
 * counted separately by the live eval).
 */
export function runChecks(plan: PlanData, c: EvalCase, source: 'ai' | 'fallback' = 'ai'): CheckResult[] {
  const results: CheckResult[] = [];
  const policy = derivePlanPolicy(c.request);
  const add = (id: string, pass: boolean, critical: boolean, detail: string) =>
    results.push({ id, pass, critical, detail });

  const parsed = PlanSchema.safeParse(plan);
  add(
    'schema-valid',
    parsed.success,
    true,
    parsed.success ? 'ok' : JSON.stringify(parsed.error.issues.slice(0, 3))
  );

  add('total-weeks', plan.totalWeeks === c.expect.totalWeeks, true, `got ${plan.totalWeeks}, want ${c.expect.totalWeeks}`);

  const weekNumbers = plan.workouts.map((w) => w.week);
  const maxWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0;
  add('weeks-in-range', maxWeek <= plan.totalWeeks, true, `max workout week ${maxWeek}`);

  const distances = plan.workouts.map((w) => w.distance);
  const maxDist = distances.length ? Math.max(...distances) : 0;
  add('distance-sanity', maxDist <= policy.maxWorkoutKm, true, `max ${maxDist}km, cap ${policy.maxWorkoutKm}km`);

  if (policy.lowIntensity) {
    const hard = plan.workouts.filter((w) => HARD_TYPES.has(w.type));
    add('no-hard-sessions', hard.length === 0, true, `hard sessions: ${hard.length} (low-intensity plan)`);
  } else {
    const byWeek = new Map<number, number>();
    for (const w of plan.workouts) if (HARD_TYPES.has(w.type)) byWeek.set(w.week, (byWeek.get(w.week) ?? 0) + 1);
    const worst = byWeek.size ? Math.max(...byWeek.values()) : 0;
    add('hard-per-week-cap', worst <= policy.maxHardPerWeek, true, `worst ${worst}/week, cap ${policy.maxHardPerWeek}`);
  }

  const weekly = new Map<number, number>();
  for (const w of plan.workouts) weekly.set(w.week, (weekly.get(w.week) ?? 0) + w.distance);
  const weeklyTotals = [...weekly.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));
  let worstGrowth = 1;
  let worstPair = 'n/a';
  let prev: { week: number; total: number } | null = null;
  for (const cur of weeklyTotals) {
    if (prev && prev.total > 0) {
      const g = cur.total / prev.total;
      if (g > worstGrowth) {
        worstGrowth = g;
        worstPair = `w${prev.week}->w${cur.week} ${g.toFixed(2)}x`;
      }
    }
    prev = cur;
  }
  add(
    'weekly-load-cap',
    worstGrowth <= policy.maxWeeklyGrowth + GROWTH_TOLERANCE,
    true,
    `worst ${worstPair}, cap ${policy.maxWeeklyGrowth}x`
  );

  let allHardWeek = false;
  for (const { week } of weeklyTotals) {
    const ws = plan.workouts.filter((w) => w.week === week);
    if (ws.length > 0 && ws.every((w) => HARD_TYPES.has(w.type))) allHardWeek = true;
  }
  add('recovery-presence', !allHardWeek, false, allHardWeek ? 'a week is entirely hard sessions' : 'ok');

  const descLen = plan.description?.trim().length ?? 0;
  add('has-rationale', descLen >= 20, false, `description length ${descLen}`);

  if (c.request.language === 'he') {
    const notes = plan.workouts.filter((w) => w.type !== 'rest' && w.notes?.trim()).map((w) => w.notes as string);
    const hebrewNotes = notes.filter((n) => HEBREW_LETTER.test(n)).length;
    const notesOk = notes.length === 0 || hebrewNotes / notes.length >= 0.8;
    const pass = HEBREW_LETTER.test(plan.title) && HEBREW_LETTER.test(plan.description) && notesOk;
    add(
      'hebrew-prose',
      pass,
      source === 'ai',
      `title ${HEBREW_LETTER.test(plan.title)}, description ${HEBREW_LETTER.test(plan.description)}, notes ${hebrewNotes}/${notes.length}`
    );
  }

  if (c.injuryReturn) {
    const earlyHard = plan.workouts.filter((w) => w.week <= 2 && HARD_TYPES.has(w.type)).length;
    const recent = (c.request.trainingHistory?.recentRuns ?? [])
      .map((r) => r.distanceKm)
      .filter((d): d is number => typeof d === 'number');
    const recentMax = recent.length ? Math.max(...recent) : null;
    const week1Max = Math.max(0, ...plan.workouts.filter((w) => w.week === 1).map((w) => w.distance));
    const shortStart = recentMax === null || week1Max <= recentMax * 1.1;
    add(
      'injury-return-easy-start',
      earlyHard === 0 && shortStart,
      false,
      `hard sessions in weeks 1-2: ${earlyHard}; week-1 longest ${week1Max}km vs recent max ${recentMax ?? 'n/a'}km`
    );
  }

  return results;
}

export function criticalFailures(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => r.critical && !r.pass);
}
