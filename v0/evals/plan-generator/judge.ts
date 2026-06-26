import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { derivePlanPolicy, type PlanData } from '@/lib/plan/plan-core';
import type { EvalCase } from './cases';

// LM-judge: scores coaching quality the deterministic checks cannot capture.
// Runs on a cheap model (gpt-4o-mini) per the model-routing principle — the
// judge is a lower-complexity task than generation.
//
// The judge is GROUNDED in a pre-computed weekly summary (totals + growth) so it
// cannot hallucinate "volume spikes" that the deterministic enforcement already
// prevents. It is told which safety properties are guaranteed and must judge on
// the actual numbers, not vibes.

export const JudgeSchema = z.object({
  safety: z.number().min(1).max(5),
  personalization: z.number().min(1).max(5),
  progression: z.number().min(1).max(5),
  rationaleClarity: z.number().min(1).max(5),
  actionability: z.number().min(1).max(5),
  overallPass: z.boolean(),
  reason: z.string(),
});

export type JudgeVerdict = z.infer<typeof JudgeSchema>;

function weeklySummary(plan: PlanData): string {
  const totals = new Map<number, number>();
  const hard = new Map<number, number>();
  const HARD = new Set(['tempo', 'intervals', 'hill', 'time-trial']);
  for (const w of plan.workouts) {
    totals.set(w.week, (totals.get(w.week) ?? 0) + w.distance);
    if (HARD.has(w.type)) hard.set(w.week, (hard.get(w.week) ?? 0) + 1);
  }
  const weeks = [...totals.keys()].sort((a, b) => a - b);
  let prev: number | null = null;
  const lines = weeks.map((wk) => {
    const total = Math.round((totals.get(wk) ?? 0) * 10) / 10;
    const growth = prev && prev > 0 ? ` (${Math.round((total / prev - 1) * 100)}% vs prev)` : '';
    prev = total;
    return `  week ${wk}: ${total}km${growth}, ${hard.get(wk) ?? 0} hard session(s)`;
  });
  return lines.join('\n');
}

export async function judgePlan(c: EvalCase, plan: PlanData, model = 'gpt-4o-mini'): Promise<JudgeVerdict> {
  const policy = derivePlanPolicy(c.request);
  const guarantees = [
    `week-over-week volume growth is capped at ${Math.round((policy.maxWeeklyGrowth - 1) * 100)}%`,
    policy.lowIntensity
      ? 'this is a low-intensity plan and contains zero hard sessions'
      : `at most ${policy.maxHardPerWeek} hard session(s) per week`,
    `no single run exceeds ${policy.maxWorkoutKm}km`,
  ].join('; ');

  const prompt = `You are an experienced, fair running coach reviewing an AI-generated training plan. Judge on the ACTUAL NUMBERS below, not on general worries.

PERSONA INPUT (what the runner asked for):
${JSON.stringify(c.request, null, 2)}

WEEKLY SUMMARY (computed from the plan — use these exact figures):
${weeklySummary(plan)}

ALREADY-GUARANTEED SAFETY (enforced deterministically — do NOT fail the plan for these): ${guarantees}.

FULL PLAN:
${JSON.stringify(plan, null, 2)}

Score each dimension 1-5 (5 = excellent):
- safety: given the guarantees above, is the progression appropriate for this runner's experience? Only lower this if the numbers in the weekly summary show a genuine problem you can name.
- personalization: reflects the persona's experience, goal, days/week, weekly volume, age, and any challenge category.
- progression: sensible week-over-week build, appropriate long runs, adequate easy/recovery days.
- rationaleClarity: the title and description communicate the plan's intent.
- actionability: a runner could follow this plan as written.

Do NOT claim a volume spike or unsafe progression unless a specific week in the summary shows it — the growth is capped, so such claims are usually wrong. Minor stylistic preferences (e.g. "could be slightly easier") are NOT failures.

Set overallPass = true when safety >= 4 and there is no concrete, data-supported problem. Set overallPass = false ONLY for a real defect you can cite from the numbers: an experience/volume mismatch, hard sessions in a low-intensity plan, or week count not matching the request. Give a one-sentence reason that cites specific figures.`;

  const { object } = await generateObject({
    model: openai(model),
    schema: JudgeSchema,
    prompt,
    temperature: 0,
  });

  return object as JudgeVerdict;
}
