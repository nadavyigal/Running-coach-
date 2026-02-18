# RunSmart Garmin File Map

## API Routes

- `v0/app/api/devices/garmin/connect/route.ts`
  - Starts OAuth 2.0 PKCE flow.

- `v0/app/api/devices/garmin/callback/route.ts`
  - Exchanges auth code for token and returns device payload to client.

- `v0/app/api/devices/garmin/activities/route.ts`
  - Syncs activities via Wellness API upload/backfill with permission + provisioning checks.

- `v0/app/api/devices/garmin/sleep/route.ts`
  - Syncs sleep via Wellness API upload/backfill with permission + provisioning checks.

- `v0/app/api/devices/garmin/diagnose/route.ts`
  - Executes endpoint probes and emits capability + blocker summary.

## Client-Side Sync

- `v0/lib/garminSync.ts`
  - Reads Garmin token from Dexie wearable device.
  - Calls activities/sleep routes.
  - Updates Dexie connection state only on reauth-required failures.

## Tests

- `v0/app/api/devices/garmin/activities/route.test.ts`
- `v0/app/api/devices/garmin/sleep/route.test.ts`

## Operations Docs

- `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md`
  - Copy/paste request to Garmin support for endpoint provisioning.
