# Garmin Enablement Matrix (RunSmart)

This matrix reflects what RunSmart can safely ship now vs what requires Garmin-side provisioning.

## Permission Signals

- `ACTIVITY_EXPORT`: activity upload stream access.
- `HISTORICAL_DATA_EXPORT`: historical/backfill access (dataset-specific enablement still required).
- `HEALTH_EXPORT`: health datasets (including sleep) when provisioned.
- `WORKOUT_IMPORT`: ability to import workouts into Garmin.

## Capability Matrix

| Capability | Permission prerequisite | Endpoint prerequisite | Current RunSmart status |
|---|---|---|---|
| Activity upload sync | `ACTIVITY_EXPORT` | `/wellness-api/rest/activities` working with valid pull token | Implemented |
| Activity backfill sync | `HISTORICAL_DATA_EXPORT` | `CONNECT_ACTIVITY` summary enabled | Implemented with explicit provisioning error |
| Sleep upload sync | `HEALTH_EXPORT` | `/wellness-api/rest/sleep` provisioned | Implemented with explicit provisioning error |
| Sleep backfill sync | `HEALTH_EXPORT` + `HISTORICAL_DATA_EXPORT` | `CONNECT_SLEEP` summary enabled | Implemented with explicit provisioning error |
| Workout import | `WORKOUT_IMPORT` | Garmin import endpoint enabled/configured | Not yet implemented in RunSmart routes |

## Common Diagnostic Interpretations

- `InvalidPullTokenException failure` (activities upload):
  - Upload token state mismatch; reconnect may not fix.
  - Request Garmin support to reset/fix pull-token state for app/user.

- `Endpoint not enabled for summary type: CONNECT_ACTIVITY`:
  - Backfill endpoint not provisioned for app despite permissions.
  - Requires Garmin-side enablement.

- Sleep endpoints return `404 Not Found`:
  - Sleep export routes not provisioned for app/environment.
  - Requires Garmin-side enablement for sleep dataset.
