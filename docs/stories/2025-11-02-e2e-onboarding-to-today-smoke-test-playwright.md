# Story: E2E – Onboarding → Today Smoke Test (Playwright)

- Type: E2E / QA
- Goal: Validate that a fresh user completes onboarding and lands on Today screen; refresh persists Today state
- Links: `docs/MVP_CORE_CHECKLIST.md`, `docs/implementation-reports/STORY_DOD_CHECKLIST_2025-11-02.md`, `V0/reset-onboarding.html`

## User Story
As a QA engineer,
I want an automated smoke test that verifies onboarding to Today works end-to-end,
So that regressions in the core habit loop are caught immediately.

## Story Context
- Existing System Integration:
  - Integrates with: Web app (Dexie-only local DB)
  - Technology: Playwright (Node), Windows PowerShell scripts
  - Follows pattern: Use `V0/reset-onboarding.html` to clear IndexedDB before run
  - Touch points: Onboarding wizard, plan seeding, Today screen

## Acceptance Criteria
- Fresh start using `V0/reset-onboarding.html` clears all local data
- Completing the 5-step wizard results in:
  - Console contains `✅ Onboarding complete - userId: <id>, planId: <id>`
  - 12 workout creation logs exist
- App navigates to Today screen automatically
- Refresh keeps user on Today (persisted `onboardingComplete = true`)
- Test artifacts saved (screenshot of Today + console log snippet)

## Steps
1) Start dev server: `V0\\start-dev.ps1` (expected at http://localhost:3000)
2) Open `V0/reset-onboarding.html` and click “Clear Database & Reset Onboarding”, then “Go to App”
3) Execute Playwright smoke test against http://localhost:3000
4) Save artifacts to `docs/implementation-reports/`
5) Check off `docs/MVP_CORE_CHECKLIST.md`

## Playwright Test Outline (example)
```ts
// e2e/onboarding-to-today.spec.ts (outline)
import { test, expect } from '@playwright/test'

test('Onboarding → Today smoke', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // Complete onboarding wizard (selectors are illustrative)
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.getByLabel('Name').fill('Test User')
  await page.getByRole('button', { name: 'Next' }).click()
  // ... fill remaining steps ...
  await page.getByRole('button', { name: 'Finish' }).click()

  // Expect navigation to Today
  await expect(page).toHaveURL(/.*today/i)
  await expect(page.getByRole('heading', { name: /today/i })).toBeVisible()

  // Optional: verify key console message if exposed to UI/logs API
  // Capture screenshot
  await page.screenshot({ path: 'docs/implementation-reports/today-smoke.png', fullPage: true })
})
```

Notes:
- This story does not install or modify dependencies; assumes Playwright exists or will be handled in a separate task.
- Selectors in the outline must be updated to match actual UI.

## Technical Notes
- Integration Approach: Use browser automation to drive onboarding and verify Today rendering and persistence via reload
- Existing Pattern Reference: Manual steps mirror `2025-11-02-onboarding-verification-smoke-test.md`
- Key Constraints: No external services; Dexie-only

## Definition of Done
- [ ] Functional requirements met (test automates onboarding and verifies Today)
- [ ] Integration requirements verified (works with current Dexie-only setup)
- [ ] Existing functionality regression tested (reload persists Today)
- [ ] Code follows existing patterns and standards
- [ ] Tests pass locally (when Playwright is configured)
- [ ] Documentation updated with artifacts

## Risks / Rollback
- Primary Risk: UI selector drift breaks test
- Mitigation: Prefer role/name-based selectors; centralize data-testids if needed
- Rollback: Remove/skip the spec file; no app code changes

## Artifacts
- `docs/implementation-reports/today-smoke.png`
- `docs/implementation-reports/onboarding-console-snippet.txt`

## Estimate
- 2 points

