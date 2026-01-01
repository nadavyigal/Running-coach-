import { test, expect } from '@playwright/test'

test.describe('Onboarding to Today - Atomic and Gated', () => {
  test('completes onboarding and lands on Today with plan loaded', async ({ page }) => {
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

    await completeOnboarding(page)

    const mainNav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(mainNav).toBeVisible({ timeout: 15000 })

    const todayNav = page.getByRole('button', { name: /navigate to today/i })
    await expect(todayNav).toHaveAttribute('aria-current', 'page', { timeout: 10000 })

    const planNav = page.getByRole('button', { name: /navigate to plan/i })
    await planNav.click()

    await expect(page.getByRole('heading', { name: /training plan/i })).toBeVisible({ timeout: 15000 })
  })
})

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

  await page.getByText(/Morning/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByRole('button', { name: /start my journey/i }).click()
}
