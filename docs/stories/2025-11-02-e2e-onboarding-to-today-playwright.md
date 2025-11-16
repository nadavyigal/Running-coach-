# Story: E2E – Onboarding → Today Smoke Test (Playwright)

- Type: QA / Dev
- Goal: Automatically verify that a fresh user completes onboarding and lands on Today with seeded plan
- Links: `V0/tests/onboarding-flow.spec.ts` (existing), `docs/MVP_CORE_CHECKLIST.md`

## Description
Automate the manual onboarding verification using Playwright. The test should reset the DB, run through onboarding, assert on the Today screen, and sanity‑check seeded workouts.

## Acceptance Criteria
- Reset step runs (or DB is clean) before test
- Onboarding wizard completes successfully
- Today screen is visible with active plan card
- At least one workout for the current week is present
- Test is stable on CI (no reliance on API keys)

## Implementation Notes
- Use existing spec `V0/tests/onboarding-flow.spec.ts` (extend if needed)
- Ensure port can be overridden via env (default 3010)
- If needed, call the reset page (`V0/reset-onboarding.html`) via context.newPage()

## Test Outline
1) Navigate to `http://localhost:${PORT || 3010}`
2) If not on onboarding, visit reset page and return
3) Complete steps (goal, experience, availability, privacy)
4) Submit; wait for route change and Today UI
5) Assert Today card texts and at least 1 workout seeded

## DoD
- Spec implemented and green locally
- Runs under `npm run test:e2e` with Playwright config
- CI job added/updated to execute this spec
- Evidence: screenshot on pass, attached to Playwright report





