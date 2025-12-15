import { test, expect, type Page } from '@playwright/test'

test.describe.configure({ timeout: 120_000 })

async function throwIfAppError(page: Page, context: string) {
  const errorHeading = page.getByRole('heading', { name: /application error/i })
  if (!(await errorHeading.isVisible().catch(() => false))) return

  const summary = page.getByRole('group', { name: /error details/i }).locator('summary')
  if (await summary.isVisible().catch(() => false)) {
    await summary.click()
  }

  const detailsText = await page
    .locator('details pre')
    .first()
    .textContent()
    .catch(() => '')

  throw new Error(`Application Error (${context}): ${detailsText?.trim() || 'unknown error'}`)
}

async function waitForVisibleOrAppError(
  page: Page,
  locator: ReturnType<Page['locator']> | ReturnType<Page['getByRole']>,
  context: string,
  timeout: number
) {
  const appErrorHeading = page.getByRole('heading', { name: /application error/i })

  await Promise.race([
    locator.waitFor({ state: 'visible', timeout }),
    appErrorHeading.waitFor({ state: 'visible', timeout }).then(() => throwIfAppError(page, context)),
  ])
}

async function clearAppData(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()

    const dbNames = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB']
    await Promise.all(
      dbNames.map(
        (dbName) =>
          new Promise((resolve) => {
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              resolve(true)
            }

            const timer = setTimeout(finish, 2000)

            try {
              const req = indexedDB.deleteDatabase(dbName)
              req.onsuccess = finish
              req.onerror = finish
              req.onblocked = finish
            } catch {
              finish()
            }
          })
      )
    )
  })
  await page.reload()
}

async function completeOnboarding(page: Page) {
  await page.getByRole('button', { name: /get started/i }).click()

  await page.getByText(/Build a Running Habit/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/^Beginner$/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByLabel(/Your age/i).fill('25')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/Morning/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByRole('button', { name: /start my journey/i }).click()
}

test.describe('Issue #43 - Smoke (multi-device)', () => {
  test('onboarding -> today -> plan -> record -> chat -> profile', async ({ page }, testInfo) => {
    const diagnostics: string[] = []
    const push = (line: string) => {
      diagnostics.push(line)
      if (diagnostics.length > 200) diagnostics.shift()
    }

    page.on('pageerror', (error) => push(`[pageerror] ${error?.stack || error}`))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        push(`[console:${message.type()}] ${message.text()}`)
      }
    })
    page.on('requestfailed', (request) => {
      push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`.trim())
    })
    page.on('response', (response) => {
      if (response.status() >= 400) {
        push(`[response] ${response.status()} ${response.url()}`)
      }
    })

    try {
      // Simulate GPS movement without relying on real device permissions.
      await page.addInitScript(() => {
      const route = [
        { lat: 37.7749, lng: -122.4194 },
        { lat: 37.7759, lng: -122.4194 },
        { lat: 37.7769, lng: -122.4194 },
      ]

      const makePosition = (point) => ({
        coords: {
          latitude: point.lat,
          longitude: point.lng,
          accuracy: 8,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: 1,
        },
        timestamp: Date.now(),
      })

      let nextId = 1
      const timers = new Map()

      const mockGeolocation = {
        getCurrentPosition: (success) => {
          success(makePosition(route[0]))
        },
        watchPosition: (success) => {
          const id = nextId++
          let i = 0
          const tick = () => {
            success(makePosition(route[Math.min(i, route.length - 1)]))
            i += 1
            if (i < route.length) {
              timers.set(id, setTimeout(tick, 700))
            } else {
              timers.delete(id)
            }
          }
          tick()
          return id
        },
        clearWatch: (id) => {
          const timer = timers.get(id)
          if (timer) clearTimeout(timer)
          timers.delete(id)
        },
      }

      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: mockGeolocation,
      })
      })

      await clearAppData(page)
      await throwIfAppError(page, 'after clearAppData')

      // Onboarding should remain visible after a refresh when incomplete (no auto-promote).
      await waitForVisibleOrAppError(
        page,
        page.getByRole('button', { name: /get started/i }),
        'waiting for onboarding start',
        20_000
      )
      await page.reload()
      await throwIfAppError(page, 'after onboarding reload')
      await waitForVisibleOrAppError(
        page,
        page.getByRole('button', { name: /get started/i }),
        'waiting for onboarding start (after reload)',
        20_000
      )

      await completeOnboarding(page)
      await throwIfAppError(page, 'after completing onboarding')

      // Main navigation appears only after onboarding completion.
      await waitForVisibleOrAppError(
        page,
        page.getByRole('navigation', { name: /main navigation/i }),
        'waiting for main navigation',
        20_000
      )
      const todayNavButton = page.getByRole('button', { name: /navigate to today/i })
      await expect(todayNavButton).toHaveAttribute('aria-current', 'page', { timeout: 20_000 })

      // Plan
      await page.getByRole('button', { name: /navigate to plan/i }).click()
      await throwIfAppError(page, 'after navigating to plan')
      await waitForVisibleOrAppError(
        page,
        page.getByRole('heading', { name: /Training Plan/i }),
        'waiting for plan heading',
        15_000
      )

      // Record
      await page.getByRole('button', { name: /navigate to record/i }).click()
      await throwIfAppError(page, 'after navigating to record')
      await waitForVisibleOrAppError(
        page,
        page.getByRole('heading', { name: /Record Run/i }),
        'waiting for record heading',
        15_000
      )

      await page.getByRole('button', { name: /^start run$/i }).click()
      const distanceValue = page.getByText('Distance (km)').locator('..').locator('p').first()
      await expect(distanceValue).not.toHaveText('0.00', { timeout: 15_000 })
      await page.waitForTimeout(2_000)
      await page.getByRole('button', { name: /^stop$/i }).click()
      await expect.poll(
        async () => {
          return page.evaluate(async () => {
            return new Promise<number>((resolve) => {
              const req = indexedDB.open('RunSmartDB')
              req.onsuccess = () => {
                try {
                  const db = req.result
                  const tx = db.transaction('runs', 'readonly')
                  const store = tx.objectStore('runs')
                  const countReq = store.count()
                  countReq.onsuccess = () => resolve(countReq.result)
                  countReq.onerror = () => resolve(0)
                } catch {
                  resolve(0)
                }
              }
              req.onerror = () => resolve(0)
            })
          })
        },
        { timeout: 15_000 }
      ).toBeGreaterThan(0)

    // Return to Today via nav (record uses router.push('/') which may not affect in-app screen state).
      await page.getByRole('button', { name: /navigate to today/i }).click()
      await throwIfAppError(page, 'after navigating to today')
      await expect(page.getByRole('button', { name: /navigate to today/i })).toHaveAttribute('aria-current', 'page', {
        timeout: 15_000,
      })

      // Chat
      await page.getByRole('button', { name: /navigate to coach/i }).click()
      await throwIfAppError(page, 'after navigating to chat')
      await waitForVisibleOrAppError(
        page,
        page.getByPlaceholder(/Ask your running coach anything/i),
        'waiting for chat input',
        15_000
      )
      await page.getByPlaceholder(/Ask your running coach anything/i).fill('Quick tip for an easy run?')
      await page.getByRole('button', { name: /send message/i }).click()
      await expect(page.getByText('Quick tip for an easy run?').first()).toBeVisible({ timeout: 15_000 })

      // Profile
      await page.getByRole('button', { name: /navigate to profile/i }).click()
      await waitForVisibleOrAppError(
        page,
        page.getByRole('heading', { name: /Profile/i }),
        'waiting for profile heading',
        15_000
      )
    } finally {
      await testInfo.attach('diagnostics', {
        body: diagnostics.join('\n'),
        contentType: 'text/plain',
      })
    }
  })
})
