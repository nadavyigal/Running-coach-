# Agent Task Board

## Current Task
WP-25 — Garmin gate off new connections and land the credential guard.

## Exact Story
As RunSmart, new Garmin OAuth connection attempts must be blocked while Garmin production approval is pending, and the previously local-only credential guard must be merged so production cannot use internal-test/Evaluation credentials.

## Goal
Land the stranded credential guard branch, add a production-default-off `GARMIN_CONNECT_ENABLED` gate for new connection starts, preserve already-connected users' sync paths, and document the current env/approval state.

## Expected Files To Change
- `tasks/todo.md`
- `tasks/progress.md`
- `docs/garmin-application/GARMIN-STATUS.md`
- `v0/.env.example`
- `v0/lib/server/garmin-connect-gate.ts`
- `v0/lib/server/garmin-connect-gate.test.ts`
- `v0/app/api/devices/garmin/connect/route.ts`
- `v0/app/api/devices/garmin/connect/route.test.ts`
- `v0/app/garmin/connect/route.ts`
- `v0/app/garmin/connect/route.test.ts`
- `v0/app/garmin/details/page.tsx`
- `v0/components/device-connection-screen.tsx`
- `v0/components/profile-screen.tsx`

## Validation Plan
- Verify the credential guard branch exists locally and has no origin counterpart before push.
- Diff/rebase the guard branch against current `origin/main`, then push/open/merge PR.
- Run focused Garmin credential/OAuth/connect-gate tests from `v0/`.
- Run `npm run type-check` from `v0/`.
- Run targeted lint for changed TypeScript/TSX files.
- Read-only `vercel env ls production` to confirm Internal Test credentials are absent and production credentials are untouched.

## Risks
- Garmin Developer Portal app creation/submission is founder-authenticated and cannot be completed from repo code.
- Production sync may still go dark once Garmin fully deactivates the old Evaluation app.
- Production Vercel env vars must not be rotated until commercial credentials exist.
- The connection gate must not touch refresh/webhook/sync paths used by already-connected users.

## Will Not Change
- No production credential rotation.
- No Garmin portal submission or email to Marc.
- No iOS screenshot recapture.
- No schema changes.
- No Training/Courses API scope work.

## Checklist
- [x] Verify `codex/wp24-garmin-credential-guard` and `baa19aa` existed locally only before push.
- [x] Rebase/diff credential guard against current `origin/main`.
- [x] Push and merge the credential guard PR (#114).
- [x] Add `GARMIN_CONNECT_ENABLED` feature flag, default off in production.
- [x] Block `/api/devices/garmin/connect` and `/garmin/connect` when the flag is off.
- [x] Surface the exact temporary-unavailable message from Garmin connect CTAs.
- [x] Verify production Vercel env read-only; do not rotate credentials.
- [x] Run final focused Garmin tests, type-check, and targeted lint.
- [x] Push/open/merge the connection gate PR (#115).
- [x] Update final progress and status docs with PR/validation results.

## Progress
- Initial verification showed `codex/wp24-garmin-credential-guard` with commit `baa19aa` local-only and no remote counterpart.
- Credential guard branch was already aligned with current `origin/main`; no rebase conflicts.
- PR #114 merged to `main` at merge commit `d74348d`.
- Added `GARMIN_CONNECT_ENABLED`; production defaults to disabled unless explicitly truthy.
- When disabled, connect routes return: "Garmin sync is temporarily unavailable while we complete Garmin production approval. Existing activity data remains in RunSmart. We'll notify you when reconnection is available."
- Updated client CTA error handling so the exact server message reaches the user.
- Read-only `vercel env ls production` showed `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET` still present, and no `GARMIN_TEST_CLIENT_ID`, no `GARMIN_TEST_CLIENT_SECRET`, and no `GARMIN_CONNECT_ENABLED`.
- `npm run test -- lib/server/garmin-credentials.test.ts lib/server/garmin-connect-gate.test.ts app/api/devices/garmin/connect/route.test.ts app/api/devices/garmin/callback/route.test.ts app/garmin/connect/route.test.ts lib/server/garmin-oauth-store.test.ts components/device-connection-screen.test.tsx --run`: passed, 36 tests.
- `npm run type-check`: passed.
- `npx eslint lib/server/garmin-connect-gate.ts lib/server/garmin-connect-gate.test.ts app/api/devices/garmin/connect/route.ts app/api/devices/garmin/connect/route.test.ts app/garmin/connect/route.ts app/garmin/connect/route.test.ts app/garmin/details/page.tsx components/device-connection-screen.tsx components/profile-screen.tsx`: exited 0 with 14 existing warnings in the two component files.

## Open Questions
- Founder still needs to create the Internal Test and Commercial apps in the Garmin Developer Portal.
- Production env cutover remains blocked until a commercial application exists.

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
