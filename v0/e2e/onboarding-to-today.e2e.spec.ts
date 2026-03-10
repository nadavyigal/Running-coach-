import { test, expect } from '@playwright/test'

test.describe('Onboarding to Today - Atomic and Gated', () => {
  test('completes onboarding and lands on Today with plan loaded', async ({ page }) => {
    await resetAppState(page)
    await page.goto('/')

    await completeOnboarding(page)

    await expect(page.getByRole('heading', { name: /recovery and reset/i })).toBeVisible({ timeout: 15000 })
    await expect(
      page
        .locator('body')
        .getByText(/today's workout|next workout/i)
        .first()
    ).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /^view plan$/i }).first().click()

    await expect(page.getByRole('heading', { name: /training plan/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/easy|long|tempo|intervals|rest/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('falls back to the starter plan when AI generation fails', async ({ page }) => {
    await resetAppState(page)
    await page.route('**/api/generate-plan', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          fallbackRequired: true,
          error: 'AI temporarily unavailable',
        }),
      })
    })

    await page.goto('/')
    await completeOnboarding(page)

    await expect(page.getByRole('heading', { name: /recovery and reset/i })).toBeVisible({ timeout: 15000 })
    await expect(
      page
        .locator('body')
        .getByText(/today's workout|next workout/i)
        .first()
    ).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /^view plan$/i }).first().click()
    await expect(page.getByRole('heading', { name: /training plan/i })).toBeVisible({ timeout: 15000 })
  })
})

async function resetAppState(page: any) {
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()

    const dbNames = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB']
    await Promise.all(
      dbNames.map(
        (dbName) =>
          new Promise((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(dbName)
              req.onsuccess = () => resolve(true)
              req.onerror = () => resolve(true)
              req.onblocked = () => resolve(true)
            } catch {
              resolve(true)
            }
          })
      )
    )
  })
}

async function completeOnboarding(page: any) {
  await page.waitForLoadState('networkidle')

  const getStarted = page.getByRole('button', { name: /get started/i })
  await expect(getStarted).toBeVisible({ timeout: 10000 })
  await getStarted.click()

  const goalOption = page.getByText(/Build a Running Habit/i)
  await expect(goalOption).toBeVisible({ timeout: 10000 })
  await goalOption.click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  const experienceOption = page.getByText(/^Beginner$/i)
  await expect(experienceOption).toBeVisible({ timeout: 10000 })
  await experienceOption.click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByLabel(/your age/i).fill('25')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/current race time/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/How many days per week/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByText(/3 days/i).click()
  await page.getByText(/Saturday/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByLabel(/i have read and agree/i).click()
  await page.getByRole('button', { name: /complete setup/i }).click()
}
