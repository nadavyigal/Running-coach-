# Agent Task Board

## Current Task
Implement Garmin evaluation OAuth fixes.

## Exact Story
As a RunSmart web or iOS user, I want Garmin OAuth to preserve my app identity through the OAuth round trip so that Garmin evaluation connects the right account and returns cleanly to the initiating client.

## Goal
Complete the Garmin evaluation fixes around redirect handling, signed state ownership context, native gateway support, and callback persistence fallback.

## Expected Files To Change
- `tasks/todo.md`
- `v0/app/api/devices/garmin/connect/route.ts`
- `v0/app/api/devices/garmin/connect/route.test.ts`
- `v0/app/api/devices/garmin/callback/route.ts`
- `v0/app/api/devices/garmin/callback/route.test.ts`
- `v0/app/api/devices/garmin/oauth-state.ts`
- `v0/app/api/devices/garmin/oauth-state.test.ts`
- `v0/app/garmin/connect/route.ts`
- `v0/app/garmin/connect/route.test.ts`
- Garmin web callers that start OAuth
- `apps/ios-native/IOS RunSmart app/Services/Garmin/GarminBridge.swift`

## Validation Plan
- Add focused tests for signed state ownership context, connect route redirect/context behavior, callback state fallback behavior, and native gateway redirect.
- Run focused Garmin OAuth tests from `v0/`.
- Run `npm run type-check` from `v0/`.
- Run targeted lint for changed TypeScript files if possible.

## Risks
- The requested plan file is missing from the repo, so scope is inferred from the existing partial Garmin OAuth diff and native gateway configuration.
- Native iOS build verification may require Xcode/project tooling outside the web test suite.
- The native gateway depends on `profiles.id` being numeric for Garmin server tables.

## Will Not Change
- No Garmin sync dataset/provisioning logic.
- No database schema changes.
- No unrelated Today page or monetization work.
- No Garmin support docs beyond what the implementation requires.

## Checklist
- [x] Confirm actual git repo before editing.
- [x] Read Agent OS router files and Garmin skill context.
- [x] Locate requested plan or identify absence.
- [x] Add focused tests first.
- [x] Implement server OAuth fixes.
- [x] Implement web/native caller fixes.
- [x] Run focused validation.
- [x] Update final progress and QA notes.

## Progress
- Confirmed actual repo root: `/Users/nadavyigal/Documents/Projects /RunSmart /Running-coach-`.
- Requested `docs/superpowers/plans/2026-06-15-garmin-evaluation-fixes.md` is not present in the repo or workspace parent.
- Existing partial diff already added request redirect precedence, `runsmart:` URI allowance, and auth/profile state fields in Garmin OAuth server files.
- Added focused tests for Garmin signed state, connect redirect/context handling, callback state fallback, native gateway redirect, and web device connect request payload.
- Added `/garmin/connect` native gateway route for iOS `ASWebAuthenticationSession`.
- Wired web Garmin connect/reconnect callers to send `authUserId` and `profileId`.
- Updated iOS `GarminBridge` to complete the backend callback after Garmin returns `code` and `state`.

## Open Questions
- Missing plan file means implementation is based on code evidence, not a saved plan document.

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
