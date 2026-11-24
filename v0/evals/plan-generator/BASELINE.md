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

## 2026-11-23: model comparison before the gpt-4o shutdown (2027-01-14)

Same 12 cases, prompt and schema unchanged. Generator set with `OPENAI_MODEL_PLAN`, judge with
`EVAL_JUDGE_MODEL`. Latency and cost are for the generation call; cost per plan counts AI plans only.

| Generator | Judge | Judge pass | Fallbacks | Critical | p50 / p95 | Tokens in / out / reasoning | Cost per plan |
|---|---|---|---|---|---|---|---|
| gpt-4o (current) | gpt-4o-mini | 12/12 | **2** | 0 | 4.4 s / 17.5 s | 4,376 / 5,751 / 0 (10 plans) | $0.0068 |
| gpt-6.2-sol (low) | gpt-4o-mini | 12/12 | 0 | 0 | 14.5 s / 37.1 s | 5,202 / 12,759 / 71 | $0.0115 |
| gpt-6.1-terra (none) | gpt-4o-mini | 12/12 | 0 | 0 | 9.7 s / 26.8 s | 5,202 / 12,696 / 1,414 | $0.0057 |
| gpt-6.2-sol (low) | gpt-6-luna | 12/12 | 0 | 0 | 15.9 s / 39.9 s | 5,202 / 12,525 / 146 | $0.0113 |

- gpt-4o fell back on `intermediate-half-marathon` and `advanced-marathon` ("response did not match
  schema"), so those users got the generic plan. Both new models produced all 12.
- Judge averages, gpt-4o-mini judge: gpt-4o safety 5 / personalization 5 / progression 4.92;
  sol 5 / 4.75 / 4.33; terra 5 / 4.75 / 4.5. gpt-6-luna judge on sol: 4.92 / 5 / 4.75.
- terra ran at effort none: the tier's default effort (low) was not in this batch; the 1,414
  reasoning tokens are terra's own.

## 2026-11-24: prompt upgrade, before vs after

Generator `gpt-6.2-sol` (effort low), judge `gpt-6-luna`. Baseline = the prompt on `origin/main` (12 cases).
Candidate = the rewritten `buildPlanPrompt` (the same 12 plus 3 new cases). One run each.

| Run | Cases | Judge pass | Fallbacks | Critical | p50 / p95 | Cost per plan | Safety / personalization / progression (judge avg) |
|---|---|---|---|---|---|---|---|
| Baseline (main) | 12 | 11/12 | 0 | 0 | 15.0 s / 33.5 s | $0.0117 | 4.92 / 4.92 / 4.83 |
| Candidate, same 12 cases | 12 | 11/12 | 0 | 0 | | | 4.67 / 4.83 / 4.42 |
| Candidate, all 15 | 15 | 14/15 | 0 | 0 | 15.8 s / 40.7 s | $0.0130 | 4.67 / 4.80 / 4.40 |

- Both runs fail the same case, `advanced-marathon`. Baseline scored it safety 4; the candidate scored safety 1:
  it put the full 42 km race in the last week with no taper. That one case explains the whole safety-average drop
  (the other 11 shared cases score safety 5 in both). Progression dropped one point on `high-volume-history`
  and `low-consistency-return`. One run each, so some of this is run-to-run variance.
- A race-taper rule was added afterwards; it is measured in the next section.
- New cases: `hebrew-beginner-5k` passes 5/5/5 with Hebrew title, description and notes (gender-neutral
  infinitives). `injury-return-intermediate` passes (safety 4); `injury-return-easy-start` passes: no hard
  sessions in weeks 1-2, week-1 longest run 4.5 km vs a recent max of 5 km, and the description says to stop and
  see a professional if pain returns. `hebrew-advanced-vdot` passes with Hebrew notes that keep LT-based paces
  (for example 4:00-4:10 לק״מ, HR 166-172).
- Gate held: 0 critical failures, judge pass 93% (threshold 85%).

## 2026-11-24 (later): race-taper rule measured, gate passed

Same setup (`gpt-6.2-sol` low, judge `gpt-6-luna`), RunSmart's own OpenAI key, prompt at `7449c996`
(race-taper rule in Nadav's wording). Gate set by Nadav: 0 critical, judge pass >= 14/15,
`advanced-marathon` safety >= 4, average safety >= 4.8.

| Run | Cases | Judge pass | Fallbacks | Critical | p50 / p95 | Cost per plan | Safety / personalization / progression |
|---|---|---|---|---|---|---|---|
| Before rewrite (main) | 12 | 11/12 | 0 | 0 | 15.0 s / 33.5 s | $0.0117 | 4.92 / 4.92 / 4.83 |
| Rewrite, no taper rule | 15 | 14/15 | 0 | 0 | 15.8 s / 40.7 s | $0.0130 | 4.67 / 4.80 / 4.40 |
| Rewrite + taper rule | 15 | **15/15** | 0 | 0 | 16.3 s / 40.2 s | $0.0136 | **4.80** / 4.80 / 4.53 |
| Rewrite + taper rule, same 12 as main | 12 | 12/12 | 0 | 0 | | | 4.83 / 4.83 / 4.58 |

- `advanced-marathon`: safety 1 → **4**, now passes. Long runs peak at 32 km, the last weeks drop (80 → 75 → 53 →
  about 47-49 km including the race), the two days before race day are rest, and the race-day note names it.
  A two-case re-check (`advanced-marathon`, `intermediate-half-marathon`) passed first: both safety 4.
- Gate: **passed**, average safety exactly at the 4.8 threshold. Safety 4 (not 5) on `intermediate-half-marathon`,
  `advanced-marathon` and `injury-return-intermediate`; every other case 5.
- Spend for this measurement: $0.045 (two-case re-check) + $0.208 (full set).
