# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: RunSmart iOS v1.0.4 (build 17) confirmed LIVE on the App Store (founder-verified 2026-06-25). Web/backend Gate-4 work complete. Garmin reply drafted, not yet sent — pending founder review + manual Developer Portal action.
Active Story: Garmin reply draft ready for founder review (`docs/garmin-application/17-GARMIN-REPLY-DRAFT-2026-06-25.md`). Founder decided (2026-06-25) to park the Training API workout-push build rather than ship it — see Decisions below. Remaining before send: re-zip 6 screenshots, manually remove Training API from Garmin Developer Portal scope, decide USER_DEREG verification path.
Last Completed Story: 2026-06-25 — ran the Training API workout-push plan (`16-WORKOUT-PUSH-PLAN.md`) via a Cursor session; resulting spec confirmed the real blocker is Garmin's undocumented Training API contract (endpoint/schema), requiring direct Garmin engagement. Founder agreed to park the feature rather than build it now. Verified via direct Supabase query that Gate 2's GC_ACTIVITY_UPDATE coverage gap closed organically (11 real activity-webhook receipts in 21 days); USER_DEREG coverage confirmed still open (zero deregistration events received). Wrote the new Garmin reply draft covering corrected Gate-4 screenshots, the two Gate-2 coverage findings, and the Training API scope-removal decision.
Next Recommended Story: Founder reviews/edits `17-GARMIN-REPLY-DRAFT-2026-06-25.md`, re-zips the 6 corrected Gate-4 screenshots, removes Training API from the Garmin Developer Portal scope (manual portal action), decides the USER_DEREG verification path (wait for organic disconnect vs. controlled test), then sends the reply to ticket 213145/213165. Separately tracked, not blocking: `garmin_connections.scopes` is an empty array in production despite healthy active connections (cosmetic Permissions-UI bug); some `garmin_activities` rows are tagged `sport: "wheelchair_push_walk"`/`"unknown"` and excluded from the running feed (investigation prompt not yet written).
Estimated Completion: Web/backend Garmin work is complete for this resubmission cycle. Remaining steps are founder-only (Developer Portal scope edit, sending the reply) or external/async (Garmin's response).
Decisions: 2026-06-25 — Training API workout-push feature parked, not built. Founder's call after seeing the Cursor-session spec: building real Garmin workout-push requires Garmin's proprietary Training API contract details, which aren't publicly documented and would require petitioning the same Partner Services team gatekeeping Production approval. Not worth blocking the Gate-4 reply on, and not core to the roadmap at current traffic. Training API will be removed from Developer Portal scope; revisit only once usage volume justifies reopening that conversation with Garmin. `16-WORKOUT-PUSH-PLAN.md` kept as reference, marked parked.
Blockers: None blocking the reply technically — iOS v1.0.4 (build 17) is live and matches the evidence. Remaining steps are founder-only manual actions (Portal scope edit, send).
Risks: Migration drift — production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate finding, not blocking Garmin work, needs a dedicated cleanup session).
Last Validation: 2026-06-25 — direct Supabase query against `garmin_webhook_events.raw_payload` confirmed `activities` key present 11 times in the last 21 days (GC_ACTIVITY_UPDATE coverage resolved) and no `userDeregistration`/dereg-equivalent key present at all (USER_DEREG coverage still open).
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
Last Updated: 2026-06-25
