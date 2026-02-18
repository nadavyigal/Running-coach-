# Garmin Enablement Request (Copy/Paste)

Use this exact template when contacting Garmin Developer Support from the approved app owner account.

---

## Subject

`RunSmart Health API enablement request: CONNECT_ACTIVITY backfill + CONNECT_SLEEP + pull token reset`

## Message Body

Hello Garmin Developer Support,

I am the owner of the RunSmart app in the Garmin Connect Developer Program and need help finalizing Health API provisioning in production.

### App details
- App name: `RunSmart`
- Environment: `Production`
- OAuth flow: `OAuth 2.0 PKCE`
- Redirect URI: `https://runsmart-ai.com/garmin/callback`

### Current behavior from diagnostics
- `GET /wellness-api/rest/user/id` returns `200` (token is valid)
- `GET /wellness-api/rest/user/permissions` returns `200` with:
  - `ACTIVITY_EXPORT`
  - `HISTORICAL_DATA_EXPORT`
  - `HEALTH_EXPORT`
  - `WORKOUT_IMPORT`
- `GET /wellness-api/rest/activities?uploadStartTimeInSeconds=...&uploadEndTimeInSeconds=...` returns:
  - `400` + `InvalidPullTokenException failure`
- `GET /wellness-api/rest/backfill/activities?summaryStartTimeInSeconds=...&summaryEndTimeInSeconds=...` returns:
  - `400` + `Endpoint not enabled for summary type: CONNECT_ACTIVITY`
- `GET /wellness-api/rest/sleep?...` and `GET /wellness-api/rest/backfill/sleep?...` return:
  - `404 Not Found`

### Request
Please confirm and enable the following for our production app:

1. Enable `CONNECT_ACTIVITY` summary backfill endpoint for our app.
2. Enable sleep export endpoints (`CONNECT_SLEEP`) for our app:
   - upload window (`/wellness-api/rest/sleep`)
   - backfill window (`/wellness-api/rest/backfill/sleep`)
3. Reset/repair pull token state for activity upload for affected users (`InvalidPullTokenException`).
4. Confirm which Health API datasets/endpoints are enabled for this app in production.

### Why we need this
RunSmart syncs user-authorized Garmin activities and sleep data for coaching, readiness, and training plan adaptation. We only use official Wellness API endpoints and user-granted permissions.

If you need app ID / team ID / sample user IDs, I can provide them immediately.

Thank you.

---

## Attach with the request

- Latest `/api/devices/garmin/diagnose` JSON output
- Timestamp (UTC)
- One affected Garmin user ID from `/wellness-api/rest/user/id`

---

## Expected success criteria after Garmin response

1. Activities upload OR backfill returns `200` (not `InvalidPullTokenException` / endpoint disabled).
2. Sleep upload/backfill returns `200` (or empty array when no data), not `404`.
3. RunSmart sync works without reconnect loops.
