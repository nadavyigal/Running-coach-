import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  PlanSchema,
  buildPlanPrompt,
  normalizePlan,
  generateFallbackPlan,
  enforcePlanSafety,
  derivePlanPolicy,
  computeMaxOutputTokens,
  resolveUser,
  resolveTotalWeeks,
  type PlanData,
  type PlanRequest,
} from '@/lib/plan/plan-core';

export interface EvalGenerationResult {
  plan: PlanData;
  /** 'ai' when the model produced a valid plan; 'fallback' when generation failed and the deterministic plan was used. */
  source: 'ai' | 'fallback';
  error?: string;
}

// Generates a plan exactly as production does: the SAME prompt + schema + token
// budget (imported from lib/plan/plan-core), and the SAME fallback behavior —
// if generation fails (e.g. the model truncates a long plan past maxOutputTokens),
// the route returns the deterministic fallback plan. The eval evaluates whatever
// the user would actually receive, and records which path produced it.
export async function generatePlanForEval(
  body: PlanRequest,
  model = 'gpt-4o'
): Promise<EvalGenerationResult> {
  const user = resolveUser(body);
  const totalWeeks = resolveTotalWeeks(body);
  const prompt = buildPlanPrompt(
    user,
    totalWeeks,
    body.planPreferences,
    body.planType,
    body.targetDistance,
    body.challenge,
    undefined,
    body.trainingHistory,
    body.goals
  );

  try {
    const { object } = await generateObject({
      model: openai(model),
      schema: PlanSchema,
      prompt,
      temperature: 0.7,
      maxOutputTokens: computeMaxOutputTokens(totalWeeks, user.daysPerWeek),
    });
    const safe = enforcePlanSafety(normalizePlan(object as PlanData), derivePlanPolicy(body));
    return { plan: safe, source: 'ai' };
  } catch (err) {
    return {
      plan: generateFallbackPlan(user, totalWeeks, body.planPreferences, body.challenge),
      source: 'fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
