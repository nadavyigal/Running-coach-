# Garmin Auto-Sync Setup

## Environment

Set these variables for the Garmin pipeline:

- `GARMIN_CLIENT_ID`
- `GARMIN_CLIENT_SECRET`
- `GARMIN_OAUTH_REDIRECT_URI`
- `GARMIN_WEBHOOK_SECRET`
- `INTERNAL_JOBS_SECRET`
- `CRON_SECRET`
- `ENCRYPTION_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`INTERNAL_JOBS_SECRET` is used by `/api/internal/jobs/garmin` and `/api/internal/jobs/garmin/replay`.

## Garmin Portal

Configure Garmin Connect IQ / Health API with:

- OAuth callback URL:
  `https://<your-domain>/garmin/callback`
- Server callback handler:
  `https://<your-domain>/api/devices/garmin/callback`
- Webhook URL:
  `https://<your-domain>/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>`

Enable the activity export scopes your app was approved for. The import path is built for push-first delivery, with historical backfill pulled by the worker after first connect.

## Background Processing

The Garmin worker route is:

- `GET /api/internal/jobs/garmin`

Vercel cron runs it every minute from [vercel.json](/c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/Running coach/Running-coach--2/vercel.json).

For local/manual runs:

```bash
curl -H "Authorization: Bearer $INTERNAL_JOBS_SECRET" \
  http://localhost:3000/api/internal/jobs/garmin
```

To replay a failed job:

```bash
curl -X POST \
  -H "Authorization: Bearer $INTERNAL_JOBS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"<garmin_import_job_id>"}' \
  http://localhost:3000/api/internal/jobs/garmin/replay
```

## Local Webhook Testing

Example Garmin webhook payload:

```json
{
  "activities": [
    {
      "userId": "garmin-user-1",
      "activityId": "run-1",
      "activityType": "running",
      "startTimeInSeconds": 1770000000,
      "distanceInMeters": 5000,
      "durationInSeconds": 1800
    }
  ]
}
```

POST it locally:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/devices/garmin/webhook?secret=$GARMIN_WEBHOOK_SECRET" \
  -d @sample-garmin-webhook.json
```

Then run the worker route once to process the queued import job.

## Notes

- Tokens stay encrypted through the existing Garmin token crypto helper.
- `runs.source_provider = 'garmin'` is now the canonical dedupe key for imported Garmin runs.
- Historical backfill and live webhook imports both flow through `garmin_import_jobs`, so retries stay idempotent.
