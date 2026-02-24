# RunSmart - Execution Prompts Pack (Groups A-D + Top 10)
Repo: https://github.com/nadavyigal/Running-coach-  
App root: `/v0` (Next.js)  
Goal: Implement high-ROI adoption ideas with exact tasks, file paths, migrations, and acceptance tests.

---

## Global Rules (apply to everything)
- Do a short repo scan first and adjust paths only if the repo differs.
- Never store Garmin access/refresh tokens client-side (`Dexie`, `localStorage`, etc.).
- Add data freshness and confidence labels. Never guess missing metrics.
- Sync must be idempotent with retries/backoff and clear error states.
- Supabase: enforce RLS on all user tables.
- Conservative language only: no medical claims, no injury diagnosis.

---

## Shared Repo Discovery (run at start)
1. Confirm key folders:
   - Next.js app: `v0/`
   - API routes: `v0/app/api/**`
   - Libraries: `v0/lib/**` (or `v0/src/**`)
   - Supabase migrations (use whichever exists):
     - `supabase/migrations/` OR `v0/supabase/migrations/`
   - Tests:
     - Unit: `v0/tests/unit/` OR `v0/__tests__/`
     - Integration: `v0/tests/integration/`
     - E2E: `v0/tests/e2e/` (Playwright)
2. Find Garmin code entry points:
   - `rg -n "garmin" v0/`
   - `rg -n "devices/garmin" v0/app/api/`
   - `rg -n "Dexie|dexie" v0/`
   - `rg -n "access_token|refresh_token" v0/`
3. Create canonical folders if absent:
   - `v0/lib/garmin/`
   - `v0/lib/garmin/auth/`
   - `v0/lib/garmin/sync/`
   - `v0/lib/garmin/normalize/`
   - `v0/lib/garmin/metrics/`
   - `v0/components/garmin/`
   - `v0/components/insights/panels/`

---

# GROUP A - P0 Adoption Blockers / Parity (Fix First)

## Objective
Make Garmin integration secure, reliable, and trustable (build stability + token lifecycle + idempotent sync + first-class data).

## Tasks (exact)
### A1) Fix corrupted Garmin signals file (build stability)
- Locate:
  - `rg -n "garminRecoverySignals" v0/`
- Fix in place (likely): `v0/lib/**/garminRecoverySignals.ts`
- Requirements:
  - Valid TypeScript exports and types
  - No runtime assumptions about missing fields
- Add unit test:
  - `v0/tests/unit/garminRecoverySignals.test.ts` (imports + validates export shape)

### A2) Server-side token storage + refresh + revoke (remove Dexie token storage)
- Find Dexie token persistence:
  - `rg -n "Dexie|dexie" v0/`
  - `rg -n "access_token|refresh_token" v0/`
- Replace with server-only persistence:
  - Create: `v0/lib/garmin/auth/refresh.ts`
  - Create: `v0/lib/garmin/auth/revoke.ts`
  - Update Garmin API client to auto-refresh on expiry/401
  - Update disconnect route to call revoke + delete tokens:
    - Existing routes likely under: `v0/app/api/devices/garmin/**`
    - If needed, add: `v0/app/api/garmin/disconnect/route.ts`

### A3) Idempotent sync + sync status + error states
- Create sync service:
  - `v0/lib/garmin/sync/syncUser.ts`
  - `v0/lib/garmin/sync/upsert.ts` (idempotent upserts)
  - `v0/lib/garmin/sync/rateLimit.ts`
- Create/ensure endpoints:
  - `v0/app/api/garmin/sync/route.ts` (POST)
  - `v0/app/api/garmin/status/route.ts` (GET: connected, last_sync_at, error_state)
- Add UI component:
  - `v0/components/garmin/SyncStatus.tsx`
- Render `SyncStatus` on today/dashboard page:
  - Locate: `v0/app/**/page.tsx`

### A4) Increase history depth + incremental backfill
- In `syncUser.ts`:
  - Backfill daily metrics: 56-90 days
  - Backfill activities: 30-90 days
  - Persist cursor/timestamps:
    - `garmin_connections.last_sync_cursor`
    - `garmin_connections.last_sync_at`

### A5) Promote Garmin core datasets to first-class storage
- Normalizers:
  - `v0/lib/garmin/normalize/normalizeDaily.ts`
  - `v0/lib/garmin/normalize/normalizeActivity.ts`
- Must store if available:
  - HRV, Resting HR, Sleep score/duration, Stress, Body Battery, VO2max, Steps, Calories
- Always store `raw_json` alongside normalized fields.

## Migrations (Supabase SQL) - Group A
Create: `YYYYMMDDHHMMSS_garmin_core_tables.sql`

```sql
create table if not exists public.garmin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  garmin_user_id text,
  scopes text,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_sync_at timestamptz,
  last_sync_cursor text,
  error_state jsonb
);

create table if not exists public.garmin_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  rotated_at timestamptz not null default now()
);

create table if not exists public.garmin_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null,
  start_time timestamptz not null,
  sport text,
  duration_s integer,
  distance_m numeric,
  avg_hr integer,
  max_hr integer,
  avg_pace_s_per_km numeric,
  elevation_gain_m numeric,
  calories numeric,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index if not exists idx_garmin_activities_user_time
on public.garmin_activities (user_id, start_time desc);

create table if not exists public.garmin_daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  steps integer,
  sleep_score numeric,
  sleep_duration_s integer,
  hrv numeric,
  resting_hr integer,
  stress numeric,
  body_battery numeric,
  vo2max numeric,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists idx_garmin_daily_user_day
on public.garmin_daily_metrics (user_id, day desc);

alter table public.garmin_connections enable row level security;
alter table public.garmin_tokens enable row level security;
alter table public.garmin_activities enable row level security;
alter table public.garmin_daily_metrics enable row level security;

create policy "garmin_connections_rw_own" on public.garmin_connections
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "garmin_tokens_rw_own" on public.garmin_tokens
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "garmin_activities_rw_own" on public.garmin_activities
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "garmin_daily_metrics_rw_own" on public.garmin_daily_metrics
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Acceptance Tests - Group A
Unit
- `v0/tests/unit/garminRecoverySignals.test.ts`
  - imports fixed file, validates expected exports exist
- `v0/tests/unit/garminSyncIdempotency.test.ts`
  - runs upsert twice, asserts no duplicates

Integration
- `v0/tests/integration/garminStatus.test.ts`
  - GET `/api/garmin/status` returns `{connected,lastSyncAt,errorState}`
- `v0/tests/integration/garminSync.test.ts`
  - POST `/api/garmin/sync` twice, second run is no-op/no duplicates

E2E (Playwright)
- `v0/tests/e2e/garmin-sync-status.spec.ts`
  - user sees `SyncStatus`
  - refresh triggers loading and updates "last sync"

---

# GROUP B - P1 Differentiators (Unfair Advantage)

## Objective
Make RunSmart feel like a recovery-first, explainable coach via panel dashboard, readiness drivers, weekly digest, plan-adjusted visibility, and post-run recap.

## Tasks (exact)
### B1) Panel-first dashboard (8-12 panels)
- Create panels:
  - `v0/components/insights/panels/ReadinessPanel.tsx`
  - `v0/components/insights/panels/RecoveryPanel.tsx`
  - `v0/components/insights/panels/LoadPanel.tsx`
  - `v0/components/insights/panels/ConsistencyPanel.tsx`
  - `v0/components/insights/panels/PerformancePanel.tsx`
  - `v0/components/insights/panels/RecentRunPanel.tsx`
  - `v0/components/insights/panels/DataQualityPanel.tsx`
- Compose in today page:
  - `v0/app/(app)/today/page.tsx` (create if absent) or update existing `v0/app/**/page.tsx`

### B2) Deterministic readiness score + drivers + confidence
- Metric engine:
  - `v0/lib/garmin/metrics/readiness.ts`
  - `v0/lib/garmin/metrics/baseline.ts` (28-day baseline)
  - `v0/lib/garmin/metrics/confidence.ts`
- API:
  - `v0/app/api/garmin/metrics/readiness/route.ts` (GET)
- Response:
  - `{ score, state, drivers[], confidence, confidenceReason, lastSyncAt, missingSignals[] }`

### B3) Under-recovery signature (conservative)
- `v0/lib/garmin/metrics/underRecovery.ts`
- Show result inside `ReadinessPanel`.

### B4) Weekly digest (in-app)
- Storage: reuse `ai_insights` with `kind='weekly'`
- API:
  - `v0/app/api/garmin/reports/weekly/route.ts` (GET latest, POST generate)
- UI:
  - `v0/app/(app)/insights/weekly/page.tsx`
  - `v0/components/insights/WeeklyReportCard.tsx`

### B5) Plan-adjusted visibility + audit log
- Locate plan adaptation:
  - `rg -n "planAdaptationEngine|adapt" v0/`
- Add audit log to `plan_adjustments` whenever adaptation runs.
- UI:
  - `v0/components/plan/PlanAdjustmentNotice.tsx`
  - Render on today + plan pages.

### B6) Post-run recap ("1 thing to improve")
- API:
  - `v0/app/api/garmin/activities/[activityId]/recap/route.ts`
- UI:
  - `v0/app/(app)/activities/[id]/page.tsx`
  - `v0/components/insights/PostRunRecap.tsx`

## Migrations (Supabase SQL) - Group B
Create: `YYYYMMDDHHMMSS_metrics_reports_adjustments.sql`

```sql
create table if not exists public.training_derived_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  readiness_score numeric,
  readiness_state text,
  drivers jsonb,
  confidence text,
  confidence_reason text,
  acute_load_7d numeric,
  chronic_load_28d numeric,
  acwr numeric,
  monotony_7d numeric,
  strain_7d numeric,
  flags jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- daily|weekly|post_run
  period_start date,
  period_end date,
  content_md text not null,
  evidence jsonb,
  confidence text,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  session_date date,
  old_session jsonb,
  new_session jsonb,
  reasons jsonb,
  evidence jsonb
);

alter table public.training_derived_metrics enable row level security;
alter table public.ai_insights enable row level security;
alter table public.plan_adjustments enable row level security;

create policy "training_derived_metrics_rw_own" on public.training_derived_metrics
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_insights_rw_own" on public.ai_insights
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plan_adjustments_rw_own" on public.plan_adjustments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Acceptance Tests - Group B
Unit
- `v0/tests/unit/readiness.test.ts` (deterministic score/state/drivers)
- `v0/tests/unit/underRecovery.test.ts` (multi-signal alignment only)

Integration
- `v0/tests/integration/readinessEndpoint.test.ts` (GET readiness shape)
- `v0/tests/integration/weeklyReport.test.ts` (POST generate, then GET latest)

E2E
- `v0/tests/e2e/dashboard-panels.spec.ts` (panels render, "Why" expands, confidence visible)
- `v0/tests/e2e/weekly-report.spec.ts` (weekly insights page shows report)

---

# GROUP C - P2 Sticky Loops + Retention (Habit + Community-lite)

## Objective
Add habit loops without a full social graph: challenges, streaks, weekly goals, share moments, confidence-based nudges.

## Tasks (exact)
### C1) 21-day challenges framework
- API:
  - `v0/app/api/challenges/route.ts` (GET list, POST join)
  - `v0/app/api/challenges/[id]/progress/route.ts` (GET progress)
- UI:
  - `v0/app/(app)/challenges/page.tsx`
  - `v0/components/challenges/ChallengeCard.tsx`
  - `v0/components/challenges/ChallengeProgress.tsx`
- Mechanics:
  - Daily completion from Garmin activity or self-report fallback
  - Streak counter and completion badge

### C2) Shareable weekly card (v1 fast)
- Share page:
  - `v0/app/(share)/weekly/[week]/page.tsx`
- Add share button:
  - `v0/components/insights/ShareWeeklyButton.tsx`
- Optional v2 image endpoint:
  - `v0/app/api/share/weekly/[week]/route.ts` (PNG)

### C3) Streaks + goals tied to readiness
- Logic:
  - `v0/lib/goals/recommendDailyGoal.ts` (uses readiness)
- UI:
  - `v0/components/goals/WeeklyGoalCard.tsx`
  - Render on today page

### C4) Confidence-driven nudges (opt-in)
- `v0/lib/notifications/nudges.ts`
- Only nudge if confidence >= medium and user opted in
- Instrument:
  - `nudge_sent`, `nudge_clicked`, `nudge_opt_out`

## Migrations (Supabase SQL) - Group C
Create: `YYYYMMDDHHMMSS_challenges_loops.sql`

```sql
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  duration_days int not null default 21,
  rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  started_at date not null default current_date,
  completed_at date,
  progress jsonb,
  primary key (user_id, challenge_id)
);

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_active_day date,
  updated_at timestamptz not null default now()
);

alter table public.challenges enable row level security;
alter table public.challenge_enrollments enable row level security;
alter table public.user_streaks enable row level security;

create policy "challenge_enrollments_rw_own" on public.challenge_enrollments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_streaks_rw_own" on public.user_streaks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "challenges_read_all" on public.challenges
for select using (auth.role() = 'authenticated');
```

## Acceptance Tests - Group C
Unit
- `v0/tests/unit/challengeProgress.test.ts` (progress increments, completion)
- `v0/tests/unit/streaks.test.ts` (streak increments/resets)

Integration
- `v0/tests/integration/challengesJoin.test.ts` (join creates enrollment)
- `v0/tests/integration/challengesProgress.test.ts` (progress endpoint state)

E2E
- `v0/tests/e2e/challenges-flow.spec.ts` (browse/join/see progress)
- `v0/tests/e2e/share-weekly.spec.ts` (share button opens share page)

---

# GROUP D - P3 Monetization Levers (Packaging + Conversion)

## Objective
Package the experience into Free/Pro/Premium tiers, server-enforce entitlements, add pricing UX, and instrument conversion.

## Tasks (exact)
### D1) Feature gating (server enforced)
- Entitlements:
  - `v0/lib/billing/entitlements.ts`
  - `v0/lib/billing/requireEntitlement.ts`
- Gate examples:
  - 90-day history panels
  - Weekly report generation frequency
  - Unlimited AI coach questions
  - Advanced analytics panels

### D2) Pricing page + upgrade CTA surfaces
- Pages/components:
  - `v0/app/(marketing)/pricing/page.tsx`
  - `v0/components/billing/PricingTable.tsx`
  - `v0/components/billing/UpgradeCTA.tsx`
- Add CTAs on:
  - Weekly report screen
  - AI coach panel
  - Advanced panels

### D3) Trial after Garmin connect
- `v0/app/(app)/onboarding/trial/page.tsx`
- Auto-offer after successful Garmin connect

### D4) Instrumentation (PostHog)
- Centralize:
  - `v0/lib/analytics/events.ts`
- Events:
  - `trial_started`, `paywall_viewed`, `upgrade_clicked`, `subscription_started`

## Migrations (Supabase SQL) - Group D
Create: `YYYYMMDDHHMMSS_entitlements.sql`

```sql
create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free', -- free|pro|premium
  trial_ends_at timestamptz,
  subscription_status text,
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

create policy "user_entitlements_rw_own" on public.user_entitlements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Acceptance Tests - Group D
Unit
- `v0/tests/unit/entitlements.test.ts` (free vs pro checks)

Integration
- `v0/tests/integration/paywall.test.ts` (locked endpoint returns 403/402 with reason)

E2E
- `v0/tests/e2e/pricing-upgrade-cta.spec.ts` (locked feature shows CTA, pricing page loads)

---

# TOP 10 - Single Execution Backlog (same format)

## Objective
Ship the top 10 in order for maximum perceived value and stability.

## Order (must follow)
Fast wins (<= 1 week each)
1. Fix corrupted Garmin signals + build stability
2. Surface recovery/readiness widget (trend arrow + confidence)
3. Sync status bar (last sync + refresh + errors)

Differentiators (2-4 weeks each)
4. Panel-first dashboard (8-12 panels)
5. Readiness drivers + confidence model
6. Weekly digest (in-app)
7. Plan-adjusted explanations + notifications

Moats (4-8 weeks each)
8. Server-side token lifecycle + robust incremental sync/backfill
9. Under-recovery signature + conservative recommendations
10. Explainable AI coach (structured context only)

## Tasks with exact paths
### T1) Fix corrupted Garmin signals
- Fix: `v0/lib/**/garminRecoverySignals.ts` (find via `rg`)
- Test: `v0/tests/unit/garminRecoverySignals.test.ts`

### T2) Readiness widget surfaced
- Panel: `v0/components/insights/panels/ReadinessPanel.tsx`
- API: `v0/app/api/garmin/metrics/readiness/route.ts`
- Render on today page: `v0/app/**/page.tsx`

### T3) Sync status bar
- Component: `v0/components/garmin/SyncStatus.tsx`
- Endpoints:
  - `v0/app/api/garmin/status/route.ts`
  - `v0/app/api/garmin/sync/route.ts`
- E2E: `v0/tests/e2e/garmin-sync-status.spec.ts`

### T4) Panel-first dashboard
- Panels: `v0/components/insights/panels/*`
- Dashboard page: `v0/app/(app)/today/page.tsx` (or existing page route)
- E2E: `v0/tests/e2e/dashboard-panels.spec.ts`

### T5) Readiness drivers + confidence
- Engine:
  - `v0/lib/garmin/metrics/readiness.ts`
  - `v0/lib/garmin/metrics/baseline.ts`
  - `v0/lib/garmin/metrics/confidence.ts`
- Storage: `training_derived_metrics` (Group B migration)
- Unit: `v0/tests/unit/readiness.test.ts`

### T6) Weekly digest
- API: `v0/app/api/garmin/reports/weekly/route.ts`
- UI: `v0/app/(app)/insights/weekly/page.tsx`
- Store: `ai_insights` with `kind=weekly`
- E2E: `v0/tests/e2e/weekly-report.spec.ts`

### T7) Plan-adjusted explanations
- Locate engine: `rg -n "planAdaptationEngine|adapt" v0/`
- Log table: `plan_adjustments` (Group B migration)
- UI: `v0/components/plan/PlanAdjustmentNotice.tsx`
- Integration: `v0/tests/integration/planAdjustments.test.ts`

### T8) Token lifecycle + robust sync/backfill
- Auth:
  - `v0/lib/garmin/auth/refresh.ts`
  - `v0/lib/garmin/auth/revoke.ts`
- Sync:
  - `v0/lib/garmin/sync/syncUser.ts`
  - `v0/lib/garmin/sync/upsert.ts`
  - `v0/lib/garmin/normalize/*`
- Migration: Group A tables
- Integration: `v0/tests/integration/garminSync.test.ts`

### T9) Under-recovery signature
- Metric: `v0/lib/garmin/metrics/underRecovery.ts`
- UI: surfaced in `ReadinessPanel`
- Unit: `v0/tests/unit/underRecovery.test.ts`

### T10) Explainable AI coach (structured summaries only)
- Context builder:
  - `v0/lib/ai/coachContextBuilder.ts`
- Endpoint:
  - `v0/app/api/ai/coach/route.ts` (or integrate into existing chat route)
- UI:
  - `v0/components/ai/AICoachPanel.tsx`
- Tests:
  - `v0/tests/unit/coachContextBuilder.test.ts` (no raw payloads)
  - `v0/tests/integration/aiCoachGuardrails.test.ts` (reject raw JSON dumps)

## Required migrations for Top 10
- Group A: `garmin_connections`, `garmin_tokens`, `garmin_activities`, `garmin_daily_metrics` (+ RLS)
- Group B: `training_derived_metrics`, `ai_insights`, `plan_adjustments` (+ RLS)

## Acceptance Criteria (Top 10)
### A) Trust/Parity
- Typecheck passes; corrupted TypeScript fixed.
- Tokens are not stored client-side; refresh + revoke works.
- Sync is idempotent; status bar shows last sync + errors.

### B) Differentiation
- Dashboard shows readiness state + drivers + confidence.
- Weekly report exists and includes 3 actions + evidence bullets.
- Plan adjustments are visible with "what changed" + "why".

### C) Moat
- Under-recovery triggers only with multi-signal evidence.
- AI coach cites evidence and never invents metrics.

## How to run tests (adjust to repo scripts)
- Typecheck: `pnpm typecheck` or `npm run type-check`
- Unit: `pnpm test` or `npm test`
- E2E: `pnpm test:e2e` or `npm run test:e2e`
- Lint: `pnpm lint` or `npm run lint`

END.
