import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
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
  })

  test('should complete onboarding flow successfully', async ({ page }) => {
    await completeOnboarding(page)

    await expect.poll(async () => {
      return page.evaluate(() => localStorage.getItem('onboarding-complete'))
    }, { timeout: 15000 }).toBe('true')

    const completionState = await page.evaluate(() => {
      return {
        onboardingComplete: localStorage.getItem('onboarding-complete'),
        userData: localStorage.getItem('user-data')
      }
    })

    expect(completionState.onboardingComplete).toBe('true')
    expect(completionState.userData).toBeTruthy()

    const mainNav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(mainNav).toBeVisible({ timeout: 15000 })

    const todayNav = page.getByRole('button', { name: /navigate to today/i })
    await expect(todayNav).toHaveAttribute('aria-current', 'page', { timeout: 10000 })

    const onboardingStart = page.getByRole('button', { name: /get started/i })
    expect(await onboardingStart.count()).toBe(0)
  })

  test('should persist onboarding completion across page reloads', async ({ page }) => {
    await completeOnboarding(page)

    await expect.poll(async () => {
      return page.evaluate(() => localStorage.getItem('onboarding-complete'))
    }, { timeout: 15000 }).toBe('true')

    await page.reload()
    await page.waitForLoadState('networkidle')

    const mainNav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(mainNav).toBeVisible({ timeout: 15000 })

    const onboardingStart = page.getByRole('button', { name: /get started/i })
    expect(await onboardingStart.count()).toBe(0)
  })

  test('should create proper user data structure', async ({ page }) => {
    await completeOnboarding(page)

    await expect.poll(async () => {
      return page.evaluate(() => localStorage.getItem('user-data'))
    }, { timeout: 15000 }).toBeTruthy()

    const userData = await page.evaluate(() => {
      const raw = localStorage.getItem('user-data')
      return raw ? JSON.parse(raw) : null
    })

    expect(userData).toBeTruthy()
    expect(userData.experience).toBe('beginner')
    expect(userData.goal).toBe('habit')
    expect(userData.daysPerWeek).toBe(3)
    expect(userData.preferredTimes).toContain('morning')
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

  await page.getByText(/current race time/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/How many days per week/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByText(/Saturday/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByRole('button', { name: /start my journey/i }).click()
}
