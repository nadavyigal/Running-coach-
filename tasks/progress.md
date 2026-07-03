# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: Garmin track is maintenance-only per the 2026-07-02 priority-reset decision (Resumely primary). No relaunch work in progress; only breakage fixes.
Active Story: None — Garmin relaunch work (commercial app filing, real-device screenshots, reconnect flow) stays paused. See Nadav Builder OS vault `05-Decisions/2026-07-02-priority-reset-resumely-primary.md` and Agentic OS `DECISIONS.md`.
Last Completed Story: 2026-07-03 — Supabase aggregate check on `garmin_connections` found all 9 rows now `reauth_required`, 0 `connected` (newest successful sync `2026-07-01 03:40:58`, just before the app deactivation) — the "keep the 5 currently-synced users working" premise behind the maintenance-mode decision is stale; there are 0 users currently syncing, not 5. Verified the reconnect UX for affected users is not silently broken: `handleGarminConnect()` in `profile-screen.tsx` correctly surfaces WP-25's gated 503 message as a toast. Fixed one in-scope papercut: that toast was titled "Connection failed" for this planned-pause case, which reads more alarming than warranted; now shows "Garmin sync paused" (default variant) when the error matches `GARMIN_CONNECT_DISABLED_MESSAGE`, "Connection failed" (destructive) for genuine errors. `npx tsc --noEmit` clean, `npx eslint components/profile-screen.tsx` 0 errors/12 pre-existing warnings (none new), `profile-screen.test.tsx` 1/1 passed.
Next Recommended Story: **Still paused.** Restoring actual sync for the 9 reauth_required users needs either a working production/commercial credential set (WP-26 Steps 3-4) or pointing real users at the Evaluation-tier Internal Test app (the same Terms violation that got the old app deactivated) — there is no maintenance-mode-compatible fix available. This is a fact worth surfacing at the day-30 revisit (~2026-08-01), not a reason to resume now. See Agentic OS WP-26/27/28 for the paused relaunch scope.
Estimated Completion: N/A while paused. Credential guard + connection gate (WP-25) and the Internal Test app (WP-26 Step 2) remain the only completed Garmin infrastructure; everything past that stays parked.
Decisions: 2026-06-25 — Training API workout-push feature parked, not built. Founder's call after seeing the Cursor-session spec: building real Garmin workout-push requires Garmin's proprietary Training API contract details, which aren't publicly documented and would require petitioning the same Partner Services team gatekeeping Production approval. Not worth blocking the Gate-4 reply on, and not core to the roadmap at current traffic. Training API will be removed from Developer Portal scope; revisit only once usage volume justifies reopening that conversation with Garmin. `16-WORKOUT-PUSH-PLAN.md` kept as reference, marked parked. 2026-07-02 — Garmin relaunch (commercial app, real-device screenshots, reconnect flow) paused in favor of Resumely's 30-day activation push; see decision doc above.
Blockers: Garmin relaunch work is paused by decision, not blocked on founder action. `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET` remain intentionally absent from production; the WP-26 Internal Test app credentials stay non-production only, per WP-25's credential guard.
Risks: **Materialized, not hypothetical** — all 9 previously-connected users now show `reauth_required`, 0 `connected` (confirmed 2026-07-03, see Last Completed Story). No fix available without either resuming the paused commercial-app track or violating Garmin's Evaluation-tier Terms again. Migration drift remains: production has ~26 applied Supabase migrations with no matching file in v0/supabase/migrations/ (separate cleanup story).
Last Validation: 2026-07-03 — see Last Completed Story for today's checks. 2026-07-02 — credential-guard focused tests passed, 13 tests. Connection-gate focused Garmin suite passed, 36 tests; `npm run type-check` passed; targeted `npx eslint` on changed TS/TSX files exited 0 with 14 existing warnings in `components/device-connection-screen.tsx` and `components/profile-screen.tsx`. Read-only Vercel production env listing confirmed no `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET`, no `GARMIN_CONNECT_ENABLED`, and no production env rotation.
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
Last Updated: 2026-07-03
