# Agent Task Board

## Current Task
WP-24 — Garmin two-app recovery: live-user impact check plus production/internal-test credential separation.

## Exact Story
As RunSmart, production Garmin OAuth must never use Evaluation/internal-test credentials, because Garmin confirmed Evaluation apps cannot connect real external users and is deactivating the old sole app.

## Goal
Check current Garmin user impact and implement the web-side guard that separates commercial credentials from internal-test credentials.

## Expected Files To Change
- `tasks/todo.md`
- `tasks/progress.md`
- `docs/garmin-application/GARMIN-STATUS.md`
- `v0/.env.example`
- `v0/lib/server/garmin-credentials.ts`
- `v0/lib/server/garmin-credentials.test.ts`
- `v0/lib/server/garmin-oauth-store.ts`
- `v0/app/api/devices/garmin/connect/route.ts`
- `v0/app/api/devices/garmin/connect/route.test.ts`
- `v0/app/api/devices/garmin/callback/route.ts`
- `v0/app/api/devices/garmin/callback/route.test.ts`

## Validation Plan
- Query aggregate `garmin_connections` health without printing user IDs or secrets.
- Run focused Garmin credential/OAuth tests from `v0/`.
- Run `npm run type-check` from `v0/`.
- Run targeted lint for changed TypeScript files if possible.

## Risks
- Garmin Developer Portal app creation/submission is founder-authenticated and cannot be completed from repo code.
- Production sync may still go dark once Garmin fully deactivates the old Evaluation app.
- Production Vercel env vars must not be rotated until commercial credentials exist.

## Will Not Change
- No production credential rotation.
- No Garmin portal submission or email to Marc.
- No iOS screenshot recapture.
- No schema changes.

## Checklist
- [x] Locate WP-24 and read current Garmin status.
- [x] Check aggregate live-user impact.
- [x] Add production/internal-test credential resolver.
- [x] Guard connect, callback, refresh, and revoke paths.
- [x] Add focused credential and route tests.
- [x] Run focused validation.
- [x] Run type-check and targeted lint.
- [x] Update final progress and status docs.

## Progress
- Supabase aggregate check at `2026-07-01T16:12:29.112Z`: 9 Garmin connection rows, 7 `connected`, 2 `reauth_required`, 0 connected rows with `last_sync_error`, 7 connected rows with successful sync in the prior 24h.
- Added `resolveGarminOAuthClientId()` / `resolveGarminOAuthClientCredentials()` with production fail-closed checks.
- Non-production can use `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET`; production always uses `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET`.
- Production errors if `GARMIN_USE_TEST_CREDENTIALS=true`, `GARMIN_CREDENTIAL_SET` selects test/evaluation, or `GARMIN_CLIENT_ID` matches `GARMIN_TEST_CLIENT_ID`.
- `npm run test -- lib/server/garmin-credentials.test.ts app/api/devices/garmin/connect/route.test.ts app/api/devices/garmin/callback/route.test.ts lib/server/garmin-oauth-store.test.ts --run`: passed, 13 tests.
- `npm run type-check`: passed.
- `npx eslint lib/server/garmin-credentials.ts lib/server/garmin-credentials.test.ts lib/server/garmin-oauth-store.ts app/api/devices/garmin/connect/route.ts app/api/devices/garmin/connect/route.test.ts app/api/devices/garmin/callback/route.ts app/api/devices/garmin/callback/route.test.ts`: passed with no warnings.

## Open Questions
- Founder still needs to decide user-facing outage messaging for connected Garmin users.
- Founder still needs to create the Internal Test and Commercial apps in the Garmin Developer Portal.

---

## Next Session — Story 1: Today Content Inventory + Preservation Map

Spec: docs/specs/2026-05-12-today-command-center.md (read this first)

Objective: Before any Today redesign, produce a complete inventory of what the current Today page renders,
where each data element comes from, and which elements must be preserved in the redesign.

Deliverable: A markdown table in tasks/today-content-inventory.md listing:
- Component name
- Data source (API route, Supabase table, or computed)
- Whether it is required in the new design or can be dropped
- Any known dependencies or side effects

Estimated time: 45-60 min session.

## Validation
- `npm run test -- app/api/devices/garmin/connect/route.test.ts app/api/devices/garmin/callback/route.test.ts app/api/devices/garmin/oauth-state.test.ts app/garmin/connect/route.test.ts --run`: passed, 10 tests.
- `npm run test -- app/api/devices/garmin/connect/route.test.ts app/api/devices/garmin/callback/route.test.ts app/api/devices/garmin/oauth-state.test.ts app/garmin/connect/route.test.ts components/device-connection-screen.test.tsx --run`: passed, 25 tests. Existing mocked DB console errors appear in device tests.
- `npm run type-check`: passed.
- `npx eslint ...changed TypeScript files...`: passed with existing warnings in `components/device-connection-screen.tsx` and `components/profile-screen.tsx`.
- `xcodebuild -project 'apps/ios-native/IOS RunSmart app.xcodeproj' -scheme 'IOS RunSmart app' -destination 'platform=iOS Simulator,name=iPhone 16' build`: not run to compile; simulator not installed.
- `xcodebuild -project 'apps/ios-native/IOS RunSmart app.xcodeproj' -scheme 'IOS RunSmart app' -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' build`: failed on pre-existing unrelated error: `GoalFocusEditor` is private in `SecondaryFlowView.swift` but extended from `SupabaseRunSmartServices.swift`.

## Review Notes
- Preserve pre-existing Garmin OAuth edits and build on them.
- iOS worktree had unrelated modified files before this task; only `IOS RunSmart app/Services/Garmin/GarminBridge.swift` was changed for this task.
