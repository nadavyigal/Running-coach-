import { expect, test, type Page } from '@playwright/test'

test.describe('Today redesign', () => {
  test('renders high-value layout across required viewports', async ({ page }) => {
    test.setTimeout(120000)
    await ensureUserOnToday(page)

    const viewportChecks = [
      { width: 390, height: 844, name: 'mobile-390x844' },
      { width: 430, height: 932, name: 'mobile-430x932' },
      { width: 1366, height: 900, name: 'desktop-1366x900' },
    ] as const

    for (const viewport of viewportChecks) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.waitForTimeout(250)

      await expect(page.locator('#today-daily-focus-heading')).toBeVisible({ timeout: 12000 })
      await expect(page.getByText(/key metrics/i).first()).toBeVisible()
      await expect(page.getByText(/coach insights/i).first()).toBeVisible()
      await expect(page.getByText(/live snapshot/i).first()).toBeVisible()
      await expect(page.getByText(/7-day trend/i).first()).toBeVisible()
      await expect(page.getByText(/plan and activities/i).first()).toBeVisible()
      await expect(page.getByText(/advanced analytics/i).first()).toBeVisible()

      if (viewport.width <= 430) {
        await expect(page.getByRole('button', { name: /open training plan/i })).toBeVisible()
      }

      const heroCard = page.locator('section[aria-labelledby="today-daily-focus-heading"]').first()
      await expect(heroCard).toBeVisible()
      await heroCard.screenshot({
        path: `test-results/today-redesign-component-hero-${viewport.name}.png`,
      })

      const metricsSection = page.locator('section[aria-labelledby="today-key-metrics-heading"]').first()
      await expect(metricsSection).toBeVisible()
      await metricsSection.screenshot({
        path: `test-results/today-redesign-component-metrics-${viewport.name}.png`,
      })

      const progressSection = page.locator('section[aria-labelledby="today-progress-heading"]').first()
      await expect(progressSection).toBeVisible()
      await progressSection.screenshot({
        path: `test-results/today-redesign-component-progress-${viewport.name}.png`,
      })

      const dataQualityBanner = page.getByText(/partial data today|device connected|profile setup incomplete|sync issue detected/i).first()
      if (await dataQualityBanner.isVisible().catch(() => false)) {
        await expect(dataQualityBanner).toBeVisible()
      }

      await page.screenshot({
        path: `test-results/today-redesign-fold-${viewport.name}.png`,
        fullPage: false,
      })

      await page.screenshot({
        path: `test-results/today-redesign-${viewport.name}.png`,
        fullPage: true,
      })
    }
  })
})

async function ensureUserOnToday(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('beta_signup_complete', 'true')
    localStorage.setItem('onboarding-complete', 'true')
    localStorage.setItem(
      'user-data',
      JSON.stringify({
        id: 999,
        name: 'Playwright Runner',
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: true,
      })
    )
  })

  await page.goto('/?screen=today')
  await page.waitForLoadState('networkidle')

  await completeOnboarding(page)

  const todayNav = page.getByRole('button', { name: /navigate to today/i })
  if (await todayNav.isVisible().catch(() => false)) {
    await todayNav.click()
  }

  await expect(page.locator('#today-daily-focus-heading')).toBeVisible({
    timeout: 30000,
  })
}

async function completeOnboarding(page: Page) {
  const todayHeading = page.locator('#today-daily-focus-heading')
  if (await todayHeading.isVisible().catch(() => false)) return

  await Promise.race([
    page.getByRole('button', { name: /get started/i }).waitFor({ state: 'visible', timeout: 10000 }),
    page.getByRole('heading', { name: /what is your main goal/i }).waitFor({ state: 'visible', timeout: 10000 }),
  ]).catch(() => null)

  const getStarted = page.getByRole('button', { name: /get started/i })
  if (await getStarted.isVisible().catch(() => false)) await getStarted.click()

  try {
    const goalOption = page.getByRole('button', { name: /build a running habit/i }).first()
    await goalOption.waitFor({ state: 'visible', timeout: 5000 })
    await goalOption.click()
    await page.getByRole('button', { name: /^continue$/i }).click()
  } catch {
    // Step not currently visible.
  }

  try {
    const experienceOption = page.getByText(/^Beginner$/i)
    await experienceOption.waitFor({ state: 'visible', timeout: 5000 })
    await experienceOption.click()
    await page.getByRole('button', { name: /^continue$/i }).click()
  } catch {
    // Step not currently visible.
  }

  try {
    const ageInput = page.getByLabel(/your age/i)
    await ageInput.waitFor({ state: 'visible', timeout: 5000 })
    await ageInput.fill('25')
    await page.getByRole('button', { name: /^continue$/i }).click()
  } catch {
    // Step not currently visible.
  }

  try {
    const raceTimeStep = page.getByText(/current race time/i)
    await raceTimeStep.waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('button', { name: /^continue$/i }).click()
  } catch {
    // Step not currently visible.
  }

  try {
    const daysStep = page.getByText(/How many days per week/i)
    await daysStep.waitFor({ state: 'visible', timeout: 5000 })
    await page.getByText(/Saturday/i).click()
    await page.getByRole('button', { name: /^continue$/i }).click()
  } catch {
    // Step not currently visible.
  }

  try {
    const privacyCheckbox = page.getByRole('checkbox', { name: /privacy policy/i })
    await privacyCheckbox.waitFor({ state: 'visible', timeout: 5000 })
    await privacyCheckbox.check()
  } catch {
    // Optional confirmation step.
  }

  const finishPatterns = [
    /complete setup/i,
    /start my journey/i,
    /create my plan/i,
    /finish/i,
    /^continue$/i,
  ]

  for (let i = 0; i < 14; i++) {
    if (await todayHeading.isVisible().catch(() => false)) break

    const selectableGoal = page
      .getByRole('button', { name: /build a running habit|run longer distances|improve speed/i })
      .first()
    if (await selectableGoal.isVisible().catch(() => false)) {
      await selectableGoal.click().catch(() => null)
    }

    const selectableDay = page.getByText(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i).first()
    if (await selectableDay.isVisible().catch(() => false)) {
      await selectableDay.click().catch(() => null)
    }

    const hasTodayNav = await page.getByRole('button', { name: /navigate to today/i }).isVisible().catch(() => false)
    if (hasTodayNav) break

    let clicked = false
    for (const pattern of finishPatterns) {
      const button = page.getByRole('button', { name: pattern }).first()
      if ((await button.isVisible().catch(() => false)) && (await button.isEnabled().catch(() => false))) {
        await button.click().catch(() => null)
        clicked = true
        break
      }
    }

    if (!clicked) break
    await page.waitForTimeout(500)
  }

  await page.waitForLoadState('networkidle')
}
