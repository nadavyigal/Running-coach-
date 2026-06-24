# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: Garmin Gate-4 brand resubmission — web/backend side complete; blocked on iOS 1.0.4(17) Apple App Review before replying to Garmin again.
Active Story: Waiting on Apple App Review approval for RunSmart iOS 1.0.4 (build 17), submitted 2026-06-24. Founder's standing rule: do not reply to Garmin's ticket until the live App Store build matches the submitted evidence.
Last Completed Story: 2026-06-24 — investigated and fixed Garmin Body Battery being permanently NULL in `garmin_daily_metrics` for all accounts. Root cause: Garmin sends the absolute Body Battery level only as a time series under `stressDetails[].timeOffsetBodyBatteryValues`, not as a flat daily field. Added `extractBodyBatteryDailySummary()` (`v0/lib/garmin/bodyBatteryTimeSeries.ts`), wired into `buildDailyMetricsRows()`, added `body_battery_start/peak/end` columns, backfilled 81 existing rows (PR #101, merged). Also fixed two CodeRabbit-flagged correctness bugs in the same PR: a NaN-timestamp crash risk in `garminBodyBattery.ts`, and a same-day multi-entry overwrite bug in `garmin-analytics-store.ts` (now merges min-start/max-peak/max-end across entries instead of last-write-wins). Confirmed live via direct Supabase query: Body Battery now populating correctly (e.g. 77, 34, 36 across recent days for the founder's account).
Next Recommended Story: Once iOS 1.0.4(17) is live on the App Store, reply to Garmin's ticket (213145/213165) with the corrected Gate-4 evidence (brand fixes to shots 01/04/05, new shot 06 Garmin Wellness, now with a real in-app entry point per iOS WP-15/PR #61). Separately tracked, not blocking: Gate 2's `GC_ACTIVITY_UPDATE`/`USER_DEREG` Partner Verification coverage gap remains open (needs a real webhook receipt for each, then a portal re-run); `garmin_connections.scopes` is an empty array in production despite healthy active connections (cosmetic Permissions-UI bug); some `garmin_activities` rows are tagged `sport: "wheelchair_push_walk"`/`"unknown"` and excluded from the running feed (unclear yet if genuine Garmin classification or a mapping gap — investigation prompt not yet written for this one).
Estimated Completion: Web/backend Garmin work is complete for this resubmission cycle. Remaining steps are all external/async (Apple review) or founder-only (the actual Garmin reply email).
Blockers: Apple App Review turnaround for iOS 1.0.4(17) (external). Garmin reply is explicitly gated on that build going live per founder's sequencing rule.
Risks: Migration drift — production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate finding, not blocking Garmin work, needs a dedicated cleanup session).
Last Validation: 2026-06-24 — Supabase migrations for Body Battery (`20260623000000_garmin_body_battery_daily_summary.sql`, `20260623000001_garmin_body_battery_backfill.sql`) confirmed applied to project `dxqglotcyirxzyqaxqln`; direct SQL query confirmed 81 rows populated and founder's own account showing correct recent Body Battery values.
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
Last Updated: 2026-06-24
