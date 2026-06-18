# Garmin Evaluation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three silent bugs that prevent Garmin daily wellness data from being stored, token refresh from working, and HRV from being extracted — all within the Evaluation environment.

**Architecture:** Four self-contained changes: (1) correct the OAuth domain constant used by token refresh, (2) add a migration for the columns the analytics store already tries to write but that don't exist in the DB, (3) fix HRV field name extraction to match Garmin's actual API response, (4) surface sync results clearly in the UI so users know what was imported.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres (migrations via `supabase/migrations/`), Vitest unit tests, TypeScript.

---

## Context: How the Bugs Were Found

Run `cd v0 && npm run type-check` and `npm run test` before starting. At least one test will fail because the analytics store upserts columns that don't exist in the schema. This is Task 2 below.

Quick verification of the three bugs before touching anything:
```bash
# Bug 1: token URL domain mismatch
grep "GARMIN_OAUTH_TOKEN_URL\|GARMIN_OAUTH_REVOKE_URL\|diauth\|connectapi" v0/lib/server/garmin-endpoints.ts v0/app/api/devices/garmin/callback/route.ts

# Bug 2: columns the store writes that don't exist in any migration
grep -r "body_battery_charged\|spo2\|respiration_rate\|skin_temp_c\|blood_pressure_systolic" v0/supabase/migrations/

# Bug 3: HRV field names
grep "lastNightAvg\|dailyAvg\|lastNight\|weeklyAvg" v0/lib/server/garmin-analytics-store.ts
```

Expected: Bug 1 shows two different domains; Bug 2 returns nothing (columns not in any migration); Bug 3 shows `lastNightAvg` / `dailyAvg` (wrong names).

---

## File Map

| Action | File |
|---|---|
| Modify | `v0/lib/server/garmin-endpoints.ts` |
| Modify | `v0/lib/server/garmin-analytics-store.ts` |
| Create | `v0/supabase/migrations/20260615000000_garmin_daily_metrics_extended_columns.sql` |
| Modify | `v0/components/garmin-sync-panel.tsx` |
| Modify | `v0/lib/server/garmin-analytics-store.test.ts` |
| Modify | `v0/app/api/devices/garmin/sync/route.test.ts` (minor — verify notices on storage failure) |

---

## Task 1: Fix OAuth token and revoke URL domain

The `callback/route.ts` (which works) hardcodes `https://diauth.garmin.com/di-oauth2-service/oauth/token`. The shared constant in `garmin-endpoints.ts` uses `https://connectapi.garmin.com/...` instead. `garmin-oauth-store.ts` uses the shared constant for **token refresh** and **revoke** — so both silently fail after the initial 90-day token expires.

**Files:**
- Modify: `v0/lib/server/garmin-endpoints.ts`

- [ ] **Step 1: Write a failing test for the correct token URL**

In `v0/lib/server/garmin-analytics-store.test.ts` (or a new `v0/lib/server/garmin-endpoints.test.ts`), add:

```typescript
// v0/lib/server/garmin-endpoints.test.ts
import { describe, it, expect } from 'vitest'
import {
  GARMIN_OAUTH_TOKEN_URL,
  GARMIN_OAUTH_REVOKE_URL,
} from './garmin-endpoints'

describe('garmin-endpoints', () => {
  it('token URL uses diauth.garmin.com domain', () => {
    expect(GARMIN_OAUTH_TOKEN_URL).toBe(
      'https://diauth.garmin.com/di-oauth2-service/oauth/token'
    )
  })

  it('revoke URL uses diauth.garmin.com domain', () => {
    expect(GARMIN_OAUTH_REVOKE_URL).toBe(
      'https://diauth.garmin.com/di-oauth2-service/oauth/revoke'
    )
  })
})
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
cd v0 && npx vitest run lib/server/garmin-endpoints.test.ts
```

Expected: 2 tests fail with "expected 'https://connectapi.garmin.com/...' to be 'https://diauth.garmin.com/...'".

- [ ] **Step 3: Fix `garmin-endpoints.ts`**

Open `v0/lib/server/garmin-endpoints.ts`. Replace the entire file with:

```typescript
export const GARMIN_WEB_BASE_URL = 'https://connect.garmin.com'
export const GARMIN_HEALTH_API_BASE_URL = 'https://apis.garmin.com'

// OAuth 2.0 PKCE endpoints (diauth domain — matches the callback route)
export const GARMIN_OAUTH_AUTHORIZE_URL = `${GARMIN_WEB_BASE_URL}/oauth2Confirm`
export const GARMIN_OAUTH_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'
export const GARMIN_OAUTH_REVOKE_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/revoke'
export const GARMIN_PROFILE_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/id`
export const GARMIN_PERMISSIONS_URL = `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/permissions`
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
cd v0 && npx vitest run lib/server/garmin-endpoints.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Confirm nothing else references the old constant**

```bash
grep -r "GARMIN_CONNECT_API_BASE_URL" v0/lib v0/app --include="*.ts" --include="*.tsx"
```

Expected: no results (it was only used internally in `garmin-endpoints.ts`).

- [ ] **Step 6: Run type-check and full test suite**

```bash
cd v0 && npm run type-check && npx vitest run
```

Expected: type-check passes; tests that mock `GARMIN_OAUTH_TOKEN_URL` should now assert the right value.

- [ ] **Step 7: Commit**

```bash
cd v0 && git add lib/server/garmin-endpoints.ts lib/server/garmin-endpoints.test.ts
git commit -m "fix: correct Garmin OAuth token/revoke domain from connectapi to diauth"
```

---

## Task 2: Migration — add missing `garmin_daily_metrics` columns

`garmin-analytics-store.ts` writes these columns on every sync: `body_battery_charged`, `body_battery_drained`, `body_battery_balance`, `spo2`, `respiration_rate`, `skin_temp_c`, `blood_pressure_systolic`, `blood_pressure_diastolic`. None of them exist in any migration. Postgres rejects the upsert; the error is caught and swallowed as a notice at `sync/route.ts:1704`. **Daily metrics — including steps, sleep, HRV, stress, and body battery — are never stored in production.** This is the root cause of most of the "not working" experience.

**Files:**
- Create: `v0/supabase/migrations/20260615000000_garmin_daily_metrics_extended_columns.sql`

- [ ] **Step 1: Write a failing analytics-store test that verifies all columns are written**

In `v0/lib/server/garmin-analytics-store.test.ts`, locate the existing test that calls `persistGarminSyncSnapshot`. Add an assertion that verifies the extended columns appear in the upserted row:

```typescript
it('stores extended daily metric columns including body battery and spo2', async () => {
  const datasets: Record<string, Record<string, unknown>[]> = {
    dailies: [
      {
        calendarDate: '2026-06-15',
        bodyBatteryChargedValue: 70,
        bodyBatteryDrainedValue: 30,
        bodyBatteryBalance: 40,
      },
    ],
    pulseox: [
      { calendarDate: '2026-06-15', averageSpo2: 98 },
    ],
    allDayRespiration: [
      { calendarDate: '2026-06-15', avgWakingRespirationValue: 14.5 },
    ],
    skinTemp: [
      { calendarDate: '2026-06-15', averageSkinTemp: 36.2 },
    ],
    bloodPressures: [
      { calendarDate: '2026-06-15', systolic: 120, diastolic: 80 },
    ],
    // empty required keys
    activities: [], manuallyUpdatedActivities: [], activityDetails: [],
    sleeps: [], epochs: [], bodyComps: [], stressDetails: [], userMetrics: [],
    hrv: [], healthSnapshot: [], bloodPressures2: [],
  }

  await persistGarminSyncSnapshot({
    userId: 1,
    activities: [],
    sleep: [],
    datasets: datasets as never,
  })

  const row = dailyByKey.get('1:2026-06-15')
  expect(row).toBeDefined()
  expect(row?.body_battery_charged).toBe(70)
  expect(row?.body_battery_drained).toBe(30)
  expect(row?.body_battery_balance).toBe(40)
  expect(row?.spo2).toBe(98)
  expect(row?.respiration_rate).toBe(14.5)
  expect(row?.skin_temp_c).toBe(36.2)
  expect(row?.blood_pressure_systolic).toBe(120)
  expect(row?.blood_pressure_diastolic).toBe(80)
})
```

> **Note:** the existing test uses a mock admin client that stores upserted rows in `dailyByKey`. The test above checks that the right column names reach that map — i.e., that the analytics store is emitting the right keys. The migration itself is verified by running `supabase db push` (Step 5 below).

- [ ] **Step 2: Run the test — expect PASS (the store already emits these keys; the bug is on the DB side)**

```bash
cd v0 && npx vitest run lib/server/garmin-analytics-store.test.ts
```

Expected: the new test passes because the mock client doesn't validate column names. This confirms the store code is correct and the DB is the missing piece.

- [ ] **Step 3: Create the migration file**

Create `v0/supabase/migrations/20260615000000_garmin_daily_metrics_extended_columns.sql`:

```sql
-- Migration 20260615000000: Add extended wellness columns to garmin_daily_metrics
-- The analytics store (garmin-analytics-store.ts) already writes these columns but
-- they were never added to the schema, causing every daily-metrics upsert to fail silently.

ALTER TABLE public.garmin_daily_metrics
  ADD COLUMN IF NOT EXISTS body_battery_charged   double precision NULL,
  ADD COLUMN IF NOT EXISTS body_battery_drained    double precision NULL,
  ADD COLUMN IF NOT EXISTS body_battery_balance    double precision NULL,
  ADD COLUMN IF NOT EXISTS spo2                    double precision NULL,
  ADD COLUMN IF NOT EXISTS respiration_rate        double precision NULL,
  ADD COLUMN IF NOT EXISTS skin_temp_c             double precision NULL,
  ADD COLUMN IF NOT EXISTS blood_pressure_systolic double precision NULL,
  ADD COLUMN IF NOT EXISTS blood_pressure_diastolic double precision NULL;

CREATE INDEX IF NOT EXISTS idx_garmin_daily_metrics_spo2
  ON public.garmin_daily_metrics(user_id, spo2)
  WHERE spo2 IS NOT NULL;
```

- [ ] **Step 4: Type-check and lint the migration (syntax check)**

```bash
cd v0 && npm run type-check
```

Expected: passes (migration is SQL, not TS).

- [ ] **Step 5: Apply the migration locally and verify the columns exist**

```bash
cd v0 && npx supabase db push
```

If you use local Supabase:
```bash
cd v0 && npx supabase migration up
```

Then verify:
```bash
cd v0 && npx supabase db diff
```

Expected: diff is empty (migration matches the live schema).

Alternatively, run in Supabase Studio SQL editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'garmin_daily_metrics'
ORDER BY ordinal_position;
```

Expected: all 8 new columns appear.

- [ ] **Step 6: Run the full test suite**

```bash
cd v0 && npx vitest run
```

Expected: all tests pass. If any test was failing because of a missing-column error, it should now pass.

- [ ] **Step 7: Commit**

```bash
cd v0 && git add supabase/migrations/20260615000000_garmin_daily_metrics_extended_columns.sql lib/server/garmin-analytics-store.test.ts
git commit -m "fix: add missing garmin_daily_metrics extended columns to schema"
```

---

## Task 3: Fix HRV field name extraction

The Garmin HRV API returns `lastNight` (not `lastNightAvg`) and `weeklyAvg` (not `dailyAvg`). The analytics store currently tries the wrong names first, so `hrv` is always stored as `null` even when Garmin sends HRV data.

Actual Garmin HRV API response shape:
```json
{
  "calendarDate": "2026-06-14",
  "weeklyAvg": 45,
  "lastNight": 48,
  "lastNight5MinHigh": 62,
  "baseline": { "lowUpper": 40, "balancedLow": 45, "balancedUpper": 55 },
  "status": "BALANCED"
}
```

**Files:**
- Modify: `v0/lib/server/garmin-analytics-store.ts` (line ~287)

- [ ] **Step 1: Write a failing test**

In `v0/lib/server/garmin-analytics-store.test.ts`, add:

```typescript
it('extracts HRV lastNight value from Garmin HRV API response', async () => {
  const datasets = {
    hrv: [
      {
        calendarDate: '2026-06-14',
        weeklyAvg: 45,
        lastNight: 48,
        lastNight5MinHigh: 62,
        baseline: { lowUpper: 40, balancedLow: 45, balancedUpper: 55 },
        status: 'BALANCED',
      },
    ],
    dailies: [], sleeps: [], epochs: [], bodyComps: [], stressDetails: [],
    userMetrics: [], pulseox: [], allDayRespiration: [], healthSnapshot: [],
    hrv2: [], bloodPressures: [], skinTemp: [],
    activities: [], manuallyUpdatedActivities: [], activityDetails: [],
  }

  await persistGarminSyncSnapshot({
    userId: 1,
    activities: [],
    sleep: [],
    datasets: datasets as never,
  })

  const row = dailyByKey.get('1:2026-06-14')
  expect(row).toBeDefined()
  expect(row?.hrv).toBe(48) // lastNight value, not weeklyAvg
})

it('falls back to weeklyAvg when lastNight is absent', async () => {
  const datasets = {
    hrv: [{ calendarDate: '2026-06-13', weeklyAvg: 45 }],
    dailies: [], sleeps: [], epochs: [], bodyComps: [], stressDetails: [],
    userMetrics: [], pulseox: [], allDayRespiration: [], healthSnapshot: [],
    hrv2: [], bloodPressures: [], skinTemp: [],
    activities: [], manuallyUpdatedActivities: [], activityDetails: [],
  }

  await persistGarminSyncSnapshot({
    userId: 1,
    activities: [],
    sleep: [],
    datasets: datasets as never,
  })

  const row = dailyByKey.get('1:2026-06-13')
  expect(row?.hrv).toBe(45)
})
```

- [ ] **Step 2: Run the tests — expect FAIL**

```bash
cd v0 && npx vitest run lib/server/garmin-analytics-store.test.ts
```

Expected: the HRV tests fail with `expected null to be 48`.

- [ ] **Step 3: Fix the HRV field name order in `garmin-analytics-store.ts`**

Find this line (~line 287):
```typescript
metric.hrv = pickNumber(hrv, ['hrvValue', 'value', 'dailyAvg', 'lastNightAvg']) ?? metric.hrv
```

Replace with:
```typescript
metric.hrv = pickNumber(hrv, ['lastNight', 'weeklyAvg', 'lastNightAvg', 'dailyAvg', 'hrvValue', 'value']) ?? metric.hrv
```

`lastNight` is the most useful coaching value (last night's HRV, not a weekly average). `weeklyAvg` is the fallback for devices that only report weekly.

- [ ] **Step 4: Run the tests — expect PASS**

```bash
cd v0 && npx vitest run lib/server/garmin-analytics-store.test.ts
```

Expected: all tests pass including the two new HRV tests.

- [ ] **Step 5: Run the full test suite**

```bash
cd v0 && npx vitest run
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
cd v0 && git add lib/server/garmin-analytics-store.ts lib/server/garmin-analytics-store.test.ts
git commit -m "fix: correct HRV field name extraction to match Garmin API response (lastNight, weeklyAvg)"
```

---

## Task 4: Show sync results clearly in the panel

After a manual sync, the user currently sees the capability grid with amber/green badges but no plain-language summary of what was actually imported. The `syncGarminEnabledData()` call already returns `activitiesImported`, `additionalSummaryImported`, `notices`, and `errors` — they just aren't surfaced.

**Files:**
- Modify: `v0/components/garmin-sync-panel.tsx`

- [ ] **Step 1: Read the existing sync result display section**

Open `v0/components/garmin-sync-panel.tsx`. Find where `syncResult` (the return value of `syncGarminEnabledData()`) is used and identify which fields are already rendered.

Look for any rendering of `syncResult.activitiesImported`, `syncResult.additionalSummaryImported`, `syncResult.notices`, and `syncResult.errors`.

- [ ] **Step 2: Add a sync result summary component inline**

After the existing sync button in `garmin-sync-panel.tsx`, add a result summary block. Find the section that shows the sync button (likely a `<Button onClick={...}>Sync Garmin</Button>`). Below it, add:

```tsx
{syncResult && !syncResult.needsReauth && (
  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
    <p className="font-medium text-slate-800">Last sync result</p>

    {syncResult.errors.length > 0 ? (
      syncResult.errors.map((err, i) => (
        <p key={i} className="text-red-600 flex items-start gap-1.5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {err}
        </p>
      ))
    ) : (
      <>
        <p className="text-slate-700">
          {syncResult.activitiesImported > 0
            ? `${syncResult.activitiesImported} ${syncResult.activitiesImported === 1 ? 'activity' : 'activities'} imported`
            : 'No new activities'}
          {syncResult.additionalSummaryImported > 0
            ? ` · ${syncResult.additionalSummaryImported} days of wellness data`
            : ''}
        </p>
        {syncResult.lastSyncAt && (
          <p className="text-slate-500 text-xs">
            Synced {new Date(syncResult.lastSyncAt).toLocaleString()}
          </p>
        )}
      </>
    )}

    {syncResult.notices.filter(n =>
      !n.toLowerCase().includes('webhook') &&
      !n.toLowerCase().includes('ping/pull')
    ).map((notice, i) => (
      <p key={i} className="text-amber-700 text-xs">{notice}</p>
    ))}
  </div>
)}
```

> **Note on the notices filter:** The webhook and ping/pull notices are developer-facing setup messages. They confuse users in Evaluation mode. Filter them out of the user-visible notice list. They still appear in server logs.

- [ ] **Step 3: Verify `syncResult` state is typed correctly**

In `garmin-sync-panel.tsx`, confirm `syncResult` is typed as `GarminEnabledSyncResult | null`. The `GarminEnabledSyncResult` interface (from `lib/garminSync.ts`) has:
- `activitiesImported: number`
- `additionalSummaryImported: number`
- `lastSyncAt: Date | null`
- `notices: string[]`
- `errors: string[]`
- `needsReauth: boolean`

If the state is typed as a subset, extend the type or cast correctly. Do not change the `garminSync.ts` interface.

- [ ] **Step 4: Build and manual QA**

```bash
cd v0 && npm run build
```

Expected: build passes with no new type errors.

Then start the dev server and do a manual Garmin sync:
1. Go to the profile/device screen
2. Click "Sync Garmin"
3. After sync completes, the result summary block should appear with activity count and wellness data count
4. If sync returns empty (no webhook rows), the "No new activities" message should display cleanly without the webhook setup notices

- [ ] **Step 5: Run lint and type-check**

```bash
cd v0 && npm run lint && npm run type-check
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
cd v0 && git add components/garmin-sync-panel.tsx
git commit -m "feat: show sync result summary in Garmin sync panel"
```

---

## Final Verification

- [ ] **Run the full test suite one last time**

```bash
cd v0 && npx vitest run
```

Expected: all tests pass.

- [ ] **Run lint, type-check, and build**

```bash
cd v0 && npm run lint && npm run type-check && npm run build
```

Expected: all pass.

- [ ] **Push and confirm CI is green**

```bash
git push
```

Check the CI run. The migration (Task 2) fixes the column-not-found error that was silently failing every daily-metrics upsert. Task 1 fixes token refresh. Task 3 fixes HRV extraction. All three together mean: after the next manual sync, `garmin_daily_metrics` rows will actually be stored with real HRV, body battery, stress, and sleep values.

---

## What This Does NOT Do

- Does not request Production environment approval (out of scope, async Garmin process)
- Does not configure the Garmin webhook URL in the Developer Portal (manual step: set `https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>` in the portal under Health Export Callback)
- Does not add a new Supabase column for `hrv_status` string (`BALANCED` / `LOW`) — the status is stored in `raw_json` and accessible from there
- Does not touch the CI system configuration itself — the CI failure should resolve once the migration is applied in the test environment

---

## Post-Deploy: Manual Smoke Test

After deploying:

1. Open RunSmart, go to profile → device settings
2. If Garmin is connected: click Sync Garmin
3. After sync: open Supabase Studio → `garmin_daily_metrics` table → filter by your `user_id`
4. Verify rows exist with non-null values in `hrv`, `steps`, `stress`, `body_battery`, `spo2` (if your Garmin device supports them)
5. Verify `garmin_activities` rows exist for recent runs
6. If `hrv` is still null: check the raw Garmin HRV API response by hitting `/api/devices/garmin/diagnose?userId=<id>` — the endpoint probes all Garmin endpoints and returns raw responses
