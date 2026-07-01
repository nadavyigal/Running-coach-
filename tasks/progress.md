# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: Garmin app deactivation response in progress. Marc confirmed Evaluation apps cannot serve external users and asked for two new Developer Portal apps: internal-test Evaluation and commercial Production-review. Production Garmin sync has no legitimate path for real users until the commercial app is approved.
Active Story: WP-24 web-side guard: hard-separate commercial and internal-test Garmin OAuth credentials so production cannot start OAuth, token exchange, refresh, or revoke using test/Evaluation credentials.
Last Completed Story: 2026-07-01 — checked live Garmin connection impact via Supabase aggregate read: 9 `garmin_connections` rows, 7 still `connected`, 2 `reauth_required`, 0 connected rows with `last_sync_error`, 7 connected rows with `last_successful_sync_at` inside the prior 24h; newest successful sync `2026-07-01T03:40:58.044+00:00`, newest webhook `2026-06-28T06:07:03.186+00:00`. Added Garmin credential resolver and route/store guards so production uses only commercial credentials and fails closed if test credentials are selected or aliased into production.
Next Recommended Story: Founder creates the two Garmin Developer Portal apps and stores the Internal Test app credentials only in non-production. Then archive/upload/confirm `1.0.7 (20)` live, recapture real-device Gate-4 screenshots, verify the tile asset, and submit the commercial application for Production review.
Estimated Completion: Web guard implemented; portal creation, production credential wiring, real-device screenshots, commercial submission, and user-facing outage messaging are still founder/manual or follow-up work.
Decisions: 2026-06-25 — Training API workout-push feature parked, not built. Founder's call after seeing the Cursor-session spec: building real Garmin workout-push requires Garmin's proprietary Training API contract details, which aren't publicly documented and would require petitioning the same Partner Services team gatekeeping Production approval. Not worth blocking the Gate-4 reply on, and not core to the roadmap at current traffic. Training API will be removed from Developer Portal scope; revisit only once usage volume justifies reopening that conversation with Garmin. `16-WORKOUT-PUSH-PLAN.md` kept as reference, marked parked.
Blockers: Garmin Developer Portal actions require founder-authenticated browser access; production Vercel env vars must not be rotated until commercial credentials exist and the guard is deployed.
Risks: Connected users may lose Garmin sync when the old Evaluation app is fully deactivated, even though the aggregate check at 2026-07-01T16:12:29Z still showed all 7 connected rows had recent successful syncs. Migration drift remains: production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate cleanup story).
Last Validation: 2026-07-01 — Supabase aggregate impact check passed as above; focused Garmin tests passed, 13 tests; `npm run type-check` passed; targeted `npx eslint` for the changed Garmin TypeScript files passed with no warnings.
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
Last Updated: 2026-07-01
