---
name: weekly-training-report
description: Produces a weekly Garmin-based training report with load, recovery, and next-week focus.
metadata:
  short-description: Weekly coaching summary from Garmin-derived metrics.
---

## When to use
- Weekly recap requests.
- Sunday/nightly reporting automation.
- Coach asks for weekly trend summary before adjusting plans.

## Inputs
- ACWR and weekly volume from `training_derived_metrics`
- Key runs from `garmin_activities`
- Sleep and stress averages from `garmin_daily_metrics`

## Output format
- 3 concise markdown bullets:
  - `Load`
  - `Recovery`
  - `Focus`

## Process
1. Build a structured weekly summary via `v0/lib/garminInsightBuilder.ts`.
2. Generate report text through `v0/app/api/ai/garmin-insights/route.ts` or the insights worker.
3. Store/report as `type = 'weekly'` in `ai_insights`.

## Guardrails
- No raw Garmin JSON in prompts.
- Keep context under 800 tokens.
- Include safety disclaimer.
- Raise telemetry events for insights and safety flags.
