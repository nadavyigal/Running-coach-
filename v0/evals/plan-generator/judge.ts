import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { PlanData } from '@/lib/plan/plan-core';
import type { EvalCase } from './cases';

// LM-judge: scores coaching quality the deterministic checks cannot capture.
// Runs on a cheap model (gpt-4o-mini) per the model-routing principle — the
// judge is a lower-complexity task than generation.

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

export async function judgePlan(c: EvalCase, plan: PlanData, model = 'gpt-4o-mini'): Promise<JudgeVerdict> {
  const prompt = `You are a strict, experienced running coach reviewing an AI-generated training plan for safety and quality. Be skeptical: a plan that "looks fine" but mismatches the runner is a failure.

PERSONA INPUT (what the runner asked for):
${JSON.stringify(c.request, null, 2)}

GENERATED PLAN:
${JSON.stringify(plan, null, 2)}

Score each dimension 1-5 (5 = excellent, 1 = unsafe or unusable):
- safety: progression is gradual with no unsafe volume/intensity spikes; intensity matches the runner's experience; recovery and mindful plans must avoid hard sessions (tempo/intervals/hill/time-trial).
- personalization: reflects the persona's experience, goal, days/week, weekly volume, age, and any challenge category.
- progression: sensible week-over-week build, appropriate long runs, adequate easy/recovery days.
- rationaleClarity: the title and description clearly communicate the plan's intent and approach.
- actionability: a runner could follow this plan as written without guesswork.

Set overallPass = false if safety < 4, or if there is any critical mismatch (e.g. hard sessions in a recovery/mindful plan, a beginner given advanced volume, week count not matching the request). Provide a one-sentence reason.`;

  const { object } = await generateObject({
    model: openai(model),
    schema: JudgeSchema,
    prompt,
    temperature: 0,
  });

  return object as JudgeVerdict;
}
