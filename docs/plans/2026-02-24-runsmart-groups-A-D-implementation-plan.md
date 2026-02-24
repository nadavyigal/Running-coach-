# RunSmart - Grouped Implementation Plan (A-D, Separate Chats)

Source prompt pack: `docs/plans/2026-02-24-runsmart-execution-prompts-pack.md`  
Execution model: implement one group per chat, in order: A -> B -> C -> D.

---

## Execution Strategy
- Chat 1: Group A only (P0 trust/parity foundations).
- Chat 2: Group B only (P1 differentiators on top of A data model).
- Chat 3: Group C only (P2 retention loops on top of B UX/insights).
- Chat 4: Group D only (P3 monetization gates on top of stable value).

Hard rule between chats:
- Do not start next group until current group passes its acceptance tests and type-check.

---

## Global Checklist (run at start of every chat)
1. Repo/path validation:
   - Confirm `v0/`, `v0/app/api`, `v0/lib`, `v0/tests`, and `v0/supabase/migrations` (or `supabase/migrations`).
2. Garmin scan:
   - `rg -n "garmin" v0/`
   - `rg -n "devices/garmin" v0/app/api/`
   - `rg -n "Dexie|dexie|access_token|refresh_token" v0/`
3. Folder scaffolding if missing:
   - `v0/lib/garmin/{auth,sync,normalize,metrics}`
   - `v0/components/garmin`
   - `v0/components/insights/panels`
4. Safety checks:
   - No client token persistence
   - RLS on every new user table
   - Freshness/confidence labels where required

---

## Chat 1 - Group A (P0 Adoption Blockers)

### Goal
Deliver secure Garmin lifecycle, idempotent sync, and stable core Garmin data ingestion.

### Tasks
1. A1 build stability:
   - Fix `garminRecoverySignals.ts` (found via `rg -n "garminRecoverySignals" v0/`).
   - Add `v0/tests/unit/garminRecoverySignals.test.ts`.
2. A2 server-only token lifecycle:
   - Remove/replace any Dexie token storage paths.
   - Add `v0/lib/garmin/auth/refresh.ts`.
   - Add `v0/lib/garmin/auth/revoke.ts`.
   - Update Garmin API client to auto-refresh on expiry/401.
   - Ensure disconnect revokes token and clears DB records.
3. A3 sync reliability:
   - Add `v0/lib/garmin/sync/syncUser.ts`.
   - Add `v0/lib/garmin/sync/upsert.ts` (idempotent).
   - Add `v0/lib/garmin/sync/rateLimit.ts` (retry/backoff + throttle).
   - Add/normalize:
     - `v0/app/api/garmin/sync/route.ts`
     - `v0/app/api/garmin/status/route.ts`
   - Add `v0/components/garmin/SyncStatus.tsx` and render on today/dashboard.
4. A4 history/backfill:
   - Implement incremental backfill windows in `syncUser.ts`:
     - Daily metrics: 56-90 days
     - Activities: 30-90 days
   - Persist `last_sync_cursor` and `last_sync_at`.
5. A5 first-class Garmin storage:
   - Add `v0/lib/garmin/normalize/normalizeDaily.ts`.
   - Add `v0/lib/garmin/normalize/normalizeActivity.ts`.
   - Ensure normalized + `raw_json` storage.
6. Group A migration:
   - Add `YYYYMMDDHHMMSS_garmin_core_tables.sql` in active migration folder.
   - Use `ALTER` instead of `CREATE` where schema already exists.

### Required tests
- Unit:
  - `v0/tests/unit/garminRecoverySignals.test.ts`
  - `v0/tests/unit/garminSyncIdempotency.test.ts`
- Integration:
  - `v0/tests/integration/garminStatus.test.ts`
  - `v0/tests/integration/garminSync.test.ts`
- E2E:
  - `v0/tests/e2e/garmin-sync-status.spec.ts`

### Exit criteria
- Type-check passes.
- No client-side Garmin token storage remains.
- Two consecutive sync calls are no-op/idempotent for existing records.
- UI shows connected state, last sync timestamp, and sync errors.

---

## Chat 2 - Group B (P1 Differentiators)

### Goal
Ship explainable recovery-first value on top of Group A data pipeline.

### Tasks
1. B1 dashboard panels:
   - Add panel components under `v0/components/insights/panels/`.
   - Compose in `v0/app/(app)/today/page.tsx` or existing today route.
2. B2 readiness engine:
   - Add:
     - `v0/lib/garmin/metrics/readiness.ts`
     - `v0/lib/garmin/metrics/baseline.ts`
     - `v0/lib/garmin/metrics/confidence.ts`
   - Add API:
     - `v0/app/api/garmin/metrics/readiness/route.ts`
   - Return deterministic shape:
     - `{ score, state, drivers[], confidence, confidenceReason, lastSyncAt, missingSignals[] }`
3. B3 under-recovery signature:
   - Add `v0/lib/garmin/metrics/underRecovery.ts`.
   - Render in `ReadinessPanel`.
4. B4 weekly digest:
   - Add API: `v0/app/api/garmin/reports/weekly/route.ts` (GET/POST).
   - Add UI:
     - `v0/app/(app)/insights/weekly/page.tsx`
     - `v0/components/insights/WeeklyReportCard.tsx`
   - Store in `ai_insights` with `kind='weekly'`.
5. B5 plan adjustment visibility:
   - Find adaptation hooks with `rg -n "planAdaptationEngine|adapt" v0/`.
   - Persist changes to `plan_adjustments`.
   - Add `v0/components/plan/PlanAdjustmentNotice.tsx`.
6. B6 post-run recap:
   - Add API: `v0/app/api/garmin/activities/[activityId]/recap/route.ts`.
   - Add UI: `v0/components/insights/PostRunRecap.tsx` on activity detail route.
7. Group B migration:
   - Add `YYYYMMDDHHMMSS_metrics_reports_adjustments.sql`.

### Required tests
- Unit:
  - `v0/tests/unit/readiness.test.ts`
  - `v0/tests/unit/underRecovery.test.ts`
- Integration:
  - `v0/tests/integration/readinessEndpoint.test.ts`
  - `v0/tests/integration/weeklyReport.test.ts`
- E2E:
  - `v0/tests/e2e/dashboard-panels.spec.ts`
  - `v0/tests/e2e/weekly-report.spec.ts`

### Exit criteria
- Readiness score and drivers are deterministic and explainable.
- Weekly report generation and retrieval works.
- Plan changes show "what changed" and "why".
- Confidence + freshness labels are visible in panel/insight surfaces.

---

## Chat 3 - Group C (P2 Sticky Loops + Retention)

### Goal
Add habit loops with minimal social complexity: challenges, streaks, goals, sharing, nudges.

### Tasks
1. C1 21-day challenges:
   - APIs:
     - `v0/app/api/challenges/route.ts`
     - `v0/app/api/challenges/[id]/progress/route.ts`
   - UI:
     - `v0/app/(app)/challenges/page.tsx`
     - `v0/components/challenges/ChallengeCard.tsx`
     - `v0/components/challenges/ChallengeProgress.tsx`
   - Mechanics:
     - completion via Garmin activity or self-report fallback
     - streak and completion badge
2. C2 shareable weekly card:
   - Add `v0/app/(share)/weekly/[week]/page.tsx`.
   - Add `v0/components/insights/ShareWeeklyButton.tsx`.
   - Optional later: `v0/app/api/share/weekly/[week]/route.ts` (PNG).
3. C3 readiness-tied goals:
   - Add `v0/lib/goals/recommendDailyGoal.ts`.
   - Add `v0/components/goals/WeeklyGoalCard.tsx` to today page.
4. C4 confidence nudges:
   - Add `v0/lib/notifications/nudges.ts`.
   - Enforce `confidence >= medium` + user opt-in.
   - Instrument `nudge_sent`, `nudge_clicked`, `nudge_opt_out`.
5. Group C migration:
   - Add `YYYYMMDDHHMMSS_challenges_loops.sql`.

### Required tests
- Unit:
  - `v0/tests/unit/challengeProgress.test.ts`
  - `v0/tests/unit/streaks.test.ts`
- Integration:
  - `v0/tests/integration/challengesJoin.test.ts`
  - `v0/tests/integration/challengesProgress.test.ts`
- E2E:
  - `v0/tests/e2e/challenges-flow.spec.ts`
  - `v0/tests/e2e/share-weekly.spec.ts`

### Exit criteria
- Users can join challenge, progress updates daily, streaks behave correctly.
- Weekly share flow works end-to-end.
- Goal recommendations reflect readiness state and are visible on today page.

---

## Chat 4 - Group D (P3 Monetization Levers)

### Goal
Add server-enforced packaging and upgrade flows without degrading trust.

### Tasks
1. D1 entitlements and gating:
   - Add `v0/lib/billing/entitlements.ts`.
   - Add `v0/lib/billing/requireEntitlement.ts`.
   - Gate premium surfaces server-side (history depth, advanced panels, AI limits, report frequency).
2. D2 pricing and CTA surfaces:
   - Add `v0/app/(marketing)/pricing/page.tsx`.
   - Add:
     - `v0/components/billing/PricingTable.tsx`
     - `v0/components/billing/UpgradeCTA.tsx`
   - Place CTAs in weekly report, AI coach panel, and advanced panels.
3. D3 trial flow:
   - Add `v0/app/(app)/onboarding/trial/page.tsx`.
   - Trigger offer immediately after Garmin connection success.
4. D4 analytics instrumentation:
   - Add `v0/lib/analytics/events.ts`.
   - Emit:
     - `trial_started`
     - `paywall_viewed`
     - `upgrade_clicked`
     - `subscription_started`
5. Group D migration:
   - Add `YYYYMMDDHHMMSS_entitlements.sql`.

### Required tests
- Unit:
  - `v0/tests/unit/entitlements.test.ts`
- Integration:
  - `v0/tests/integration/paywall.test.ts`
- E2E:
  - `v0/tests/e2e/pricing-upgrade-cta.spec.ts`

### Exit criteria
- Locked features are server-enforced, not UI-only.
- Pricing page + CTAs are visible and functional.
- Key conversion events fire consistently.

---

## Cross-Group Dependency Gates
- A -> B:
  - Garmin data and sync status must be reliable before readiness/confidence UI.
- B -> C:
  - Weekly insights and readiness signals should exist before loops/nudges depend on them.
- C -> D:
  - Engagement loops should be live before aggressive upgrade surfaces.

---

## Chat Kickoff Prompts (copy/paste)

### Prompt for Chat 1 (Group A)
"Implement Group A from `docs/plans/2026-02-24-runsmart-execution-prompts-pack.md` only. Do repo scan first, then execute A1-A5, add Group A migration, and implement Group A unit/integration/e2e tests. Do not start Group B."

### Prompt for Chat 2 (Group B)
"Implement Group B from `docs/plans/2026-02-24-runsmart-execution-prompts-pack.md` only, assuming Group A is complete. Execute B1-B6, add Group B migration, and implement Group B tests. Keep readiness deterministic and explainable. Do not start Group C."

### Prompt for Chat 3 (Group C)
"Implement Group C from `docs/plans/2026-02-24-runsmart-execution-prompts-pack.md` only, assuming Group B is complete. Execute C1-C4, add Group C migration, and implement Group C tests. Do not start Group D."

### Prompt for Chat 4 (Group D)
"Implement Group D from `docs/plans/2026-02-24-runsmart-execution-prompts-pack.md` only, assuming Groups A-C are complete. Execute D1-D4, add Group D migration, and implement Group D tests with server-side entitlement enforcement."

---

## Final Verification After Each Chat
Run from `v0/`:
- `npm run type-check`
- `npm run lint`
- `npm run test`
- `npm run test:e2e` (targeted spec(s) for that group at minimum)

If any command fails, fix before moving to the next group.
