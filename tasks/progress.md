# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: `1.0.6 (19)` confirmed live on App Store (2026-07-01, real Garmin Connect square tile now wired in). Gate-4 Garmin reply is READY TO SEND — all 6 screenshots recaptured, verified, and re-zipped.
Active Story: Founder sends `20-GARMIN-REPLY-DRAFT-2026-06-26.md` as a reply in ticket 213145/213165 from `nadav.yigal@runsmart-ai.com`, attaching `docs/garmin-application/runsmart-garmin-screenshots-ios-2026-07-01.zip`.
Last Completed Story: 2026-07-01 — recaptured, reviewed, and packaged all 6 Gate-4 screenshots against live `1.0.6 (19)`; updated `GARMIN-STATUS.md` and the reply draft to match. Discovered and confirmed root cause of a cosmetic, non-blocking bug (in-app Permissions list shows all-Off because `garmin_connections.scopes` is never written, despite the connection being healthy) — worked around it for the screenshot, didn't fix the underlying column (separate story).
Next Recommended Story: Founder sends the reply email (only remaining step). Separately, non-blocking: populate `garmin_connections.scopes` on write so the Permissions UI stops showing all-Off for healthy Garmin connections.
Estimated Completion: All code, screenshot, and doc work complete. Only remaining step is manual: founder sends the email.
Decisions: 2026-06-25 — Training API workout-push feature parked, not built. Founder's call after seeing the Cursor-session spec: building real Garmin workout-push requires Garmin's proprietary Training API contract details, which aren't publicly documented and would require petitioning the same Partner Services team gatekeeping Production approval. Not worth blocking the Gate-4 reply on, and not core to the roadmap at current traffic. Training API will be removed from Developer Portal scope; revisit only once usage volume justifies reopening that conversation with Garmin. `16-WORKOUT-PUSH-PLAN.md` kept as reference, marked parked.
Blockers: None — the 01-03 Connect-tile asset risk (previously the wordmark fallback) is resolved as of build 19; screenshots are done. Only remaining step is founder sending the email.
Risks: Migration drift — production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate finding, not blocking Garmin work, needs a dedicated cleanup session). `garmin_connections.scopes` never written (cosmetic Permissions-UI gap, not a real data-access issue).
Last Validation: 2026-07-01 — `1.0.6 (19)` confirmed live on App Store by founder; device screenshot shows "Last sync 1 Jul 2026 at 6:40" confirming the live build was captured against.
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
