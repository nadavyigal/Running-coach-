# Story: Onboarding Verification Smoke Test (Dexie-only)

- Type: QA / Dev
- Goal: Verify a fresh user can complete onboarding, seed plan, and land on Today screen
- Links: `docs/MVP_CORE_CHECKLIST.md`, `README.md#quick-start-dexie-only-windows`

## Description
Run a deterministic manual/exploratory pass to ensure onboarding works end-to-end on a fresh database in the Dexie-only architecture.

## Acceptance Criteria
- Fresh start using `V0/reset-onboarding.html` successfully clears data
- Completing the 5-step wizard logs:
  - `✅ Onboarding complete - userId: <id>, planId: <id>`
  - 12 workout creation logs
- App navigates to Today screen automatically
- Refresh keeps user on Today (onboardingComplete = true)
- Evidence saved under `docs/implementation-reports/` (screenshot + console log snippet)

## Steps
1) Start server: `V0\\start-dev.ps1` (http://localhost:3000)
2) Open `V0/reset-onboarding.html` → Clear → "Go to App"
3) Complete wizard and submit
4) Capture screenshot of Today screen and console logs
5) Save artifacts to `docs/implementation-reports/`
6) Check off `docs/MVP_CORE_CHECKLIST.md`

## Risks / Notes
- Browser cache/chunk issues: run `V0/clear-cache-and-restart.ps1`
- If AI key missing, chat fallback must not block onboarding

## Fixes Included in Scope
- Guard analytics during onboarding init (avoid Dexie reads):
  - Defer or no-op `trackOnboardingStarted/trackUserContext` until after DB write succeeds
- Stabilize Dexie usage in `completeOnboardingAtomic`:
  - Remove artificial delay by default
  - Replace indexed queries with `toArray()+filter` for reliability
  - Add non-transaction fallback path with granular error logs

## Estimate
- 2 points

## Completion
- Status: DONE (2025-11-02)
- Evidence: Fresh DB reset via `V0/reset-onboarding.html`, console logs show `✅ Onboarding complete - userId, planId` and 12 workout creation entries; Today screen screenshot saved in implementation reports.