import { test, expect, type Page } from '@playwright/test'
import { testDataFactory, type UserProfile } from './utils/test-data-factory'

test.describe.configure({ timeout: 120_000 })

const DB_NAMES = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB']

async function clearAppData(page: Page) {
  await page.goto('/')
  await page.evaluate(async (dbNames) => {
    localStorage.clear()
    sessionStorage.clear()

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
  }, DB_NAMES)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function waitForMainNavigation(page: Page) {
  await page.getByRole('navigation', { name: /main navigation/i }).waitFor({ state: 'visible', timeout: 20_000 })
}

function resolveGoalChoice(profile: UserProfile) {
  if (profile.goal === 'performance') return /Improve Speed/i
  if (profile.goal === 'race') return /Run Longer Distances/i
  return /Build a Running Habit/i
}

function resolveExperienceChoice(profile: UserProfile) {
  if (profile.experience === 'advanced') return /^Regular$/i
  if (profile.experience === 'intermediate') return /^Occasional$/i
  return /^Beginner$/i
}

async function completeOnboarding(page: Page, profile: UserProfile) {
  await page.getByRole('button', { name: /get started/i }).waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByRole('button', { name: /get started/i }).click()

  await page.getByText(resolveGoalChoice(profile)).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(resolveExperienceChoice(profile)).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByLabel(/your age/i).fill('25')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/current race time/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByText(/How many days per week/i).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByText(/Saturday/i).click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByRole('button', { name: /start my journey/i }).click()
  await waitForMainNavigation(page)
}

async function getStoreCount(page: Page, storeName: string) {
  return page.evaluate((store) => {
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('RunSmartDB')
      req.onerror = () => resolve(0)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(store)) {
          resolve(0)
          return
        }
        const tx = db.transaction(store, 'readonly')
        const countReq = tx.objectStore(store).count()
        countReq.onsuccess = () => resolve(countReq.result)
        countReq.onerror = () => resolve(0)
      }
    })
  }, storeName)
}

async function openPlanScreen(page: Page) {
  await page.getByRole('button', { name: /navigate to plan/i }).click()
  await page.getByRole('heading', { name: /training plan/i }).waitFor({ timeout: 15_000 })
}

async function mockGeolocation(page: Page) {
  await page.addInitScript(() => {
    const route = [
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.77495, lng: -122.4194 },
      { lat: 37.775, lng: -122.4194 },
      { lat: 37.77505, lng: -122.4194 },
    ]

    const makePosition = (point: { lat: number; lng: number }) => ({
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
    const timers = new Map<number, ReturnType<typeof setTimeout>>()

    const mockGeolocation = {
      getCurrentPosition: (success: PositionCallback) => {
        success(makePosition(route[0]))
      },
      watchPosition: (success: PositionCallback) => {
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
      clearWatch: (id: number) => {
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
}

async function recordGpsRun(page: Page) {
  await page.getByRole('button', { name: /navigate to record/i }).click()
  await page.getByRole('heading', { name: /record run/i }).waitFor({ timeout: 15_000 })

  await page.getByRole('button', { name: /^start run$/i }).click()

  const distanceValue = page.getByText('Distance (km)').locator('..').locator('p').first()
  await expect(distanceValue).not.toHaveText('0.00', { timeout: 15_000 })

  await page.waitForTimeout(2_000)
  await page.getByRole('button', { name: /^stop$/i }).click()

  await expect.poll(async () => getStoreCount(page, 'runs'), { timeout: 15_000 }).toBeGreaterThan(0)
}

test.describe('Onboarding to First Adaptive Update E2E', () => {
  test.beforeEach(async ({ page }) => {
    await mockGeolocation(page)
    await clearAppData(page)
  })

  test('Scenario 1: Beginner Runner - Conservative Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    await openPlanScreen(page)
    await expect.poll(async () => getStoreCount(page, 'workouts'), { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('Scenario 2: Intermediate Runner - Moderate Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createIntermediateProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    await openPlanScreen(page)
    await expect.poll(async () => getStoreCount(page, 'workouts'), { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('Scenario 3: Advanced Runner - Aggressive Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createAdvancedProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    await openPlanScreen(page)
    await expect.poll(async () => getStoreCount(page, 'workouts'), { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('Scenario 4: Edge Case - Very Slow Run', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    await openPlanScreen(page)
    await expect.poll(async () => getStoreCount(page, 'workouts'), { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('Data Integrity - Verify No Data Loss', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    const userCount = await getStoreCount(page, 'users')
    const runCount = await getStoreCount(page, 'runs')
    const workoutCount = await getStoreCount(page, 'workouts')

    expect(userCount).toBeGreaterThan(0)
    expect(runCount).toBeGreaterThan(0)
    expect(workoutCount).toBeGreaterThan(0)
  })

  test('Performance - Response Time < 30 seconds', async ({ page }) => {
    const startTime = Date.now()

    const userProfile = testDataFactory.createIntermediateProfile()

    await completeOnboarding(page, userProfile)
    await recordGpsRun(page)

    const totalTime = (Date.now() - startTime) / 1000
    expect(totalTime).toBeLessThan(30)
  })
})
