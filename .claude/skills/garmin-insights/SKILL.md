---
name: garmin-insights
description: Generates structured Garmin coaching insights (daily, weekly, post-run) from derived metrics and stores them via the AI insight pipeline.
metadata:
  short-description: Garmin AI insight pipeline orchestration skill.
---

## When to use
- User asks for Garmin-derived coaching insights.
- A sync/derive flow needs to trigger insight generation.
- You need a concise AI summary from Garmin metrics without exposing raw JSON.

## Workflow
1. Read normalized metrics from:
   - `training_derived_metrics`
   - `garmin_daily_metrics`
   - `garmin_activities`
2. Build a structured summary using `v0/lib/garminInsightBuilder.ts`.
3. Generate insight text through:
   - `v0/app/api/ai/garmin-insights/route.ts` (streaming API), or
   - `v0/lib/server/ai-insights-worker.ts` (background job).
4. Persist into `ai_insights` with evidence metadata.

## Insight types
- `daily`
- `weekly`
- `post_run`

## Guardrails
- Never send raw Garmin JSON to the model.
- Keep context under 800 tokens.
- Include a safety disclaimer in the system prompt.
- Emit telemetry events:
  - `ai_insight_created`
  - `ai_safety_flag_raised`

## Integration points
- Queue payload + enqueue: `v0/lib/server/garmin-sync-queue.ts`
- Worker: `v0/lib/server/ai-insights-worker.ts`
- Shared generation service: `v0/lib/server/garmin-insights-service.ts`
