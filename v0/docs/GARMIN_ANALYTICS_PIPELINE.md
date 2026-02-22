# Garmin Analytics Pipeline

This document describes the Garmin analytics + AI insight flow end-to-end, with operational checks for support and debugging.

## Data Flow

1. OAuth Flow  
   - Entry points: Garmin connect/callback routes.  
   - Storage: `v0/lib/server/garmin-oauth-store.ts` writes encrypted tokens into `garmin_tokens` and connection state into `garmin_connections`.

2. Webhook / Pull Ingestion  
   - Entry points: Garmin webhook + manual/incremental sync routes.  
   - Storage: `v0/lib/server/garmin-analytics-store.ts` writes normalized records into:
     - `garmin_activities`
     - `garmin_daily_metrics`

3. Derivation Job  
   - Worker: `v0/lib/server/garmin-derive-worker.ts`  
   - Compute modules:
     - `v0/lib/garminAcwr.ts`
     - `v0/lib/garminReadinessComputer.ts`
   - Output table: `training_derived_metrics`

4. AI Insight Job  
   - Queue payload: `AiInsightsJobPayload` via `v0/lib/server/garmin-sync-queue.ts`
   - Worker: `v0/lib/server/ai-insights-worker.ts`
   - Prompt summarization: `v0/lib/garminInsightBuilder.ts`
   - API surface (streaming): `v0/app/api/ai/garmin-insights/route.ts`
   - Output table: `ai_insights`

5. UI Consumption  
   - Server/client consumers read from `ai_insights` using API route and/or server helpers.
   - Chat context injection uses structured Garmin context (no raw JSON).

## Insight Types

- `daily`: readiness + sleep/HRV + today context.
- `weekly`: ACWR + weekly load + recovery averages + key runs.
- `post_run`: latest run quality vs baseline + near-term recovery cue.

## Prompting Rules

- Pass structured summaries only.  
- Never send raw Garmin JSON to the model.  
- Garmin context is capped to 800 tokens.  
- System prompts include an explicit safety disclaimer.

## Telemetry Events

- `ai_insight_created`
- `ai_safety_flag_raised`
- `garmin_sync_completed`

Events are emitted through server telemetry helpers and mirrored to logs.

## Troubleshooting

### 1) Diagnose endpoint

- Use Garmin diagnose route:
  - `GET /api/devices/garmin/diagnose?userId=<id>`
- Confirms:
  - token validity / refresh status
  - webhook storage visibility
  - upstream permissions

### 2) Webhook debug checks

- Verify `GARMIN_WEBHOOK_SECRET` is configured.
- Confirm Garmin callback URL includes path secret endpoint.
- Check recent export rows in storage and ingestion counters.
- Validate queue enqueue responses (`deriveQueue`, `ai-insights`).

### 3) Token refresh flow

- `getValidGarminAccessToken()` auto-refreshes near expiry.
- If refresh fails:
  - connection state is marked with auth error
  - sync/diagnose routes return reconnect hints
- Reconnect Garmin if refresh token is unavailable/revoked.

### 4) AI insight missing

- Confirm `training_derived_metrics` exists for the user/date.
- Confirm AI queue is configured (Redis env vars).
- Inspect worker logs for `ai-insights` job failures.
- Validate `OPENAI_API_KEY` and `OPENAI_MODEL`.

### 5) Chat lacks Garmin context

- Ensure chat request includes valid numeric `userId`.
- Check `buildGarminContext()` output shape in logs/tests.
- Confirm context summary token budget logic did not drop all fields due missing data.
