# Plan-generator eval — baseline and remediation

History of where the plan-generator's AI output quality started and how it was
brought to green. Do not loosen thresholds to pass — fix the generator.

## Baseline (2026-06-26, before Story 1b) — 0/12

- Judge pass rate: **0 / 12 (0%)** (target 0.85)
- Fallbacks (AI generation failed → generic plan): `advanced-marathon`, `high-volume-history`
- Safety-critical deterministic failures: `intermediate-half-marathon`, `mindful-challenge`, `speed-goal-5k`

Findings:
1. Beginner/habit/mindful plans got tempo/interval/hard sessions.
2. 12-week plans truncated past `maxOutputTokens: 1200` and silently fell back to the generic plan.
3. Load-rule violations (e.g. 40% week-over-week jump).

## After Story 1b (2026-06-26) — 12/12

- Judge pass rate: **12 / 12 (100%)**
- Fallbacks: 0 (all cases now generate real AI plans)
- Safety-critical deterministic failures: 0
- Avg judge scores: safety 5.0, personalization 4.83, progression 4.67, rationale 5.0, actionability 5.0

What changed (all in `lib/plan/plan-core.ts`, enforced by the route and verified by the eval):
1. **`enforcePlanSafety`** — deterministic guardrail applied to every AI plan: strips hard sessions from low-intensity plans, caps quality sessions per week, clamps single-run distance by experience, and caps week-over-week volume growth to 10%. The model is no longer trusted to honor these; they are guaranteed.
2. **`computeMaxOutputTokens`** — token budget scales with plan size (was a fixed 1200), so long plans no longer truncate into the fallback.
3. **Prompt** tightened with explicit intensity/progression/distance rules (best-effort; enforcement is the guarantee).
4. **Judge** grounded in a computed weekly summary and told which safety properties are already guaranteed, so it judges coaching quality on real figures instead of hallucinating spikes.

Safety is now a deterministic guarantee (always 5); the judge's discriminating power has shifted to personalization and progression (4-5). Re-run with `npm run eval:plan` after any generator change and update this file.
