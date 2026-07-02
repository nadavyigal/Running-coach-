# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: WP-25 Garmin app deactivation response in progress. The production/internal-test credential guard is merged; new Garmin OAuth connection attempts are gated off by default in production while Garmin production approval is pending.
Active Story: WP-25 — gate off new Garmin connections and land the credential guard. Existing authenticated sync paths remain in place; only new OAuth starts are blocked.
Last Completed Story: 2026-07-02 — PR #114 merged the stranded Garmin credential guard into `main`. Added `GARMIN_CONNECT_ENABLED`, defaulting off in production, to block `/api/devices/garmin/connect` and `/garmin/connect` before any OAuth state or Garmin authorize URL is generated. The blocked response uses the approved temporary-unavailable message and the client CTAs surface that message. Read-only `vercel env ls production` confirmed `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET` are not set in production, and production `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET` were not rotated.
Next Recommended Story: Founder creates the Internal Test Garmin Developer Portal application and stores its credentials only in non-production; separately, founder creates/submits the commercial Production-review application when the evidence package is ready. Production env cutover waits for commercial credentials.
Estimated Completion: Credential guard merged and connection gate implemented in code; production deployment/merge of the gate PR, Developer Portal app creation, internal-test credential wiring, commercial credential cutover, real-device screenshots, and commercial submission remain open.
Decisions: 2026-06-25 — Training API workout-push feature parked, not built. Founder's call after seeing the Cursor-session spec: building real Garmin workout-push requires Garmin's proprietary Training API contract details, which aren't publicly documented and would require petitioning the same Partner Services team gatekeeping Production approval. Not worth blocking the Gate-4 reply on, and not core to the roadmap at current traffic. Training API will be removed from Developer Portal scope; revisit only once usage volume justifies reopening that conversation with Garmin. `16-WORKOUT-PUSH-PLAN.md` kept as reference, marked parked.
Blockers: Garmin Developer Portal actions require founder-authenticated browser access; production Vercel env vars must not be rotated until commercial credentials exist. `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET` are intentionally absent from production until WP-26 creates an Internal Test app.
Risks: Connected users may lose Garmin sync when the old Evaluation app is fully deactivated, even though the aggregate check at 2026-07-01T16:12:29Z still showed all 7 connected rows had recent successful syncs. Migration drift remains: production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate cleanup story).
Last Validation: 2026-07-02 — credential-guard focused tests passed, 13 tests. Connection-gate focused Garmin suite passed, 36 tests; `npm run type-check` passed; targeted `npx eslint` on changed TS/TSX files exited 0 with 14 existing warnings in `components/device-connection-screen.tsx` and `components/profile-screen.tsx`. Read-only Vercel production env listing confirmed no `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET`, no `GARMIN_CONNECT_ENABLED`, and no production env rotation.
Latest QA Report: PR #101 — CodeRabbit found 2 real correctness issues + 1 doc-accuracy issue + 1 deferred nitpick (DB-level CHECK constraints, reasonable to skip since app-level clamping already enforces 0-100 and columns are already live); all addressed before merge.

<!--
Seeded 2026-06-12 per Agentic OS MANUAL.md "How to make a project reach High confidence"
(open decision in Agentic OS tasks/progress.md, approved by founder 2026-06-12).
The app lives in v0/ — run lint/type-check/test from there. Keep the keyed block above
current after each significant validation; the Agentic OS refresh parser reads it.

Note found during seeding: v0/node_modules was inconsistent with package-lock.json
(eslint-scope missing, lint crashed). Fixed with npm ci on 2026-06-12. If lint crashes
with "Cannot find module", run npm ci in v0/ first.
-->
Last Updated: 2026-07-02
