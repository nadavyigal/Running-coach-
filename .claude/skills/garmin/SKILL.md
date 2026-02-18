---
name: garmin
description: Implement, debug, and operate Garmin Health API sync for RunSmart. Use when working on Garmin OAuth, permissions/provisioning issues, activities/sleep sync routes, diagnose output interpretation, or Garmin support escalation requests. Trigger for errors like InvalidPullTokenException, endpoint-not-enabled, reconnect loops, or missing Garmin data.
---

# Garmin

## Overview

Use this skill to keep RunSmart Garmin sync production-safe and aligned with Garmin Health API provisioning constraints. Prefer official Wellness API endpoints and explicit capability checks before adding new sync behavior.

Primary repo context:
- Server routes: `v0/app/api/devices/garmin/*`
- Client sync: `v0/lib/garminSync.ts`
- Diagnostics: `v0/app/api/devices/garmin/diagnose/route.ts`
- Enablement docs: `docs/garmin-application/*`

## Workflow Decision Tree

1. Verify token and permissions first.
2. Use only official Wellness API endpoints for production sync.
3. Map each failure to one of: auth, missing permission, endpoint not provisioned, pull-token state invalid.
4. Return actionable errors (required permission + next step), avoid reconnect loops unless auth is actually invalid.
5. Generate/refresh Garmin support request when provisioning blockers are detected.

## Implementation Rules

1. Do not rely on private `connectapi.garmin.com` or `connect.garmin.com/modern/proxy` endpoints for production sync.
2. Keep time windows `<= 86400` seconds for Garmin pull calls.
3. Treat `401` and auth-marked `403` as reauth-required; treat generic `403/404/400` as provisioning/capability issues.
4. Check `/wellness-api/rest/user/permissions` before sync attempts.
5. Fail with clear actions:
   - Missing permission: ask user to enable/reconnect.
   - Endpoint not enabled: ask Garmin to provision endpoint.
   - InvalidPullTokenException: request Garmin pull-token reset and/or backfill enablement.

## Endpoint Policy (RunSmart)

Use:
- `GET /wellness-api/rest/user/id`
- `GET /wellness-api/rest/user/permissions`
- Activities upload: `GET /wellness-api/rest/activities?uploadStartTimeInSeconds=...&uploadEndTimeInSeconds=...`
- Activities backfill: `GET /wellness-api/rest/backfill/activities?summaryStartTimeInSeconds=...&summaryEndTimeInSeconds=...`
- Sleep upload: `GET /wellness-api/rest/sleep?uploadStartTimeInSeconds=...&uploadEndTimeInSeconds=...`
- Sleep backfill: `GET /wellness-api/rest/backfill/sleep?summaryStartTimeInSeconds=...&summaryEndTimeInSeconds=...`

Avoid in production:
- `connectapi.garmin.com/*`
- `connect.garmin.com/modern/proxy/*`

## Error-to-Action Mapping

- `InvalidPullTokenException`
  - Meaning: upload pull token state is invalid for current app/user.
  - Action: if backfill is available, try backfill; otherwise open Garmin support request for pull-token reset.

- `Endpoint not enabled for summary type: CONNECT_ACTIVITY`
  - Meaning: app is not provisioned for activity backfill even if permission appears granted.
  - Action: request Garmin enable `CONNECT_ACTIVITY` summary backfill.

- Sleep endpoint `404` on Wellness API
  - Meaning: sleep dataset not provisioned on app environment.
  - Action: request Garmin enable `CONNECT_SLEEP` (upload + backfill endpoints).

## RunSmart Change Checklist

1. Update route logic in:
   - `v0/app/api/devices/garmin/activities/route.ts`
   - `v0/app/api/devices/garmin/sleep/route.ts`
   - `v0/app/api/devices/garmin/diagnose/route.ts`
2. Update tests:
   - `v0/app/api/devices/garmin/activities/route.test.ts`
   - `v0/app/api/devices/garmin/sleep/route.test.ts`
3. Validate:
   - `npm run test -- app/api/devices/garmin/activities/route.test.ts app/api/devices/garmin/sleep/route.test.ts`
   - `npx eslint app/api/devices/garmin/activities/route.ts app/api/devices/garmin/sleep/route.ts app/api/devices/garmin/diagnose/route.ts`
4. If provisioning blockers remain, update:
   - `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md`

## References

- Enablement matrix and decision table: `references/enablement-matrix.md`
- RunSmart Garmin file map: `references/runsmart-garmin-files.md`
