import { expect, test, type Page } from "@playwright/test"

async function seedGarminDashboardData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
      new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

    const waitForDb = async (): Promise<IDBDatabase> => {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("RunSmartDB")
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const hasStores =
          db.objectStoreNames.contains("users") &&
          db.objectStoreNames.contains("wearableDevices") &&
          db.objectStoreNames.contains("garminSummaryRecords")

        if (hasStores) return db
        db.close()
        await wait(200)
      }

      throw new Error("RunSmartDB stores were not ready in time")
    }

    const db = await waitForDb()

    const tx = db.transaction(
      ["users", "wearableDevices", "garminSummaryRecords", "sleepData", "hrvMeasurements", "runs", "plans", "workouts"],
      "readwrite"
    )

    const users = tx.objectStore("users")
    const wearables = tx.objectStore("wearableDevices")
    const summaries = tx.objectStore("garminSummaryRecords")
    const sleepData = tx.objectStore("sleepData")
    const hrv = tx.objectStore("hrvMeasurements")
    const runs = tx.objectStore("runs")
    const plans = tx.objectStore("plans")
    const workouts = tx.objectStore("workouts")

    const firstUser = await new Promise<any | null>((resolve, reject) => {
      const request = users.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        resolve(cursor ? cursor.value : null)
      }
      request.onerror = () => reject(request.error)
    })

    const now = new Date()
    let userId: number

    if (firstUser?.id) {
      userId = Number(firstUser.id)
      await requestToPromise(
        users.put({
          ...firstUser,
          onboardingComplete: true,
          updatedAt: now,
        })
      )
    } else {
      userId = Number(
        await requestToPromise(
          users.add({
            goal: "habit",
            experience: "intermediate",
            preferredTimes: ["morning"],
            daysPerWeek: 4,
            consents: { data: true, gdpr: true, push: true },
            onboardingComplete: true,
            createdAt: now,
            updatedAt: now,
          })
        )
      )
    }

    const clearByUser = async (store: IDBObjectStore) => {
      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) {
            resolve()
            return
          }

          const value = cursor.value as { userId?: number }
          if (value?.userId === userId) {
            const deleteRequest = cursor.delete()
            deleteRequest.onsuccess = () => cursor.continue()
            deleteRequest.onerror = () => reject(deleteRequest.error)
            return
          }

          cursor.continue()
        }
        request.onerror = () => reject(request.error)
      })
    }

    await clearByUser(wearables)
    await clearByUser(summaries)
    await clearByUser(sleepData)
    await clearByUser(hrv)
    await clearByUser(runs)
    await clearByUser(plans)
    await clearByUser(workouts)

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    await requestToPromise(
      wearables.add({
        userId,
        type: "garmin",
        name: "Garmin Forerunner",
        deviceId: "garmin-test-device",
        connectionStatus: "connected",
        lastSync: twoHoursAgo,
        capabilities: ["dailies", "hrv", "pulseox", "stressDetails"],
        settings: {},
        createdAt: now,
        updatedAt: now,
      })
    )

    const endDate = new Date()
    endDate.setUTCHours(0, 0, 0, 0)

    for (let index = 0; index < 28; index += 1) {
      const date = new Date(endDate)
      date.setUTCDate(endDate.getUTCDate() - (27 - index))

      const isoDate = date.toISOString().slice(0, 10)
      const recordedAt = new Date(`${isoDate}T06:00:00.000Z`)
      const isRecentLoadDay = index >= 23
      const isLatestDay = index === 27

      const runDuration = isRecentLoadDay ? 5400 : 1200
      const sleepScore = isLatestDay ? 92 : 82
      const restingHr = isLatestDay ? 47 : 52
      const hrvValue = isLatestDay ? 70 : 52
      const stressLevel = isLatestDay ? 15 : 35
      const bodyBattery = isLatestDay ? 84 : 68
      const spo2 = isLatestDay ? 97 : 96

      await requestToPromise(
        summaries.add({
          userId,
          datasetKey: "dailies",
          summaryId: `dailies:${isoDate}`,
          source: "garmin",
          recordedAt,
          payload: JSON.stringify({
            calendarDate: isoDate,
            restingHeartRateInBeatsPerMinute: restingHr,
            averageStressLevel: stressLevel,
            bodyBatteryMostRecentValue: bodyBattery,
            moderateIntensityDurationInSeconds: runDuration,
          }),
          importedAt: now,
        })
      )

      await requestToPromise(
        summaries.add({
          userId,
          datasetKey: "hrv",
          summaryId: `hrv:${isoDate}`,
          source: "garmin",
          recordedAt,
          payload: JSON.stringify({
            calendarDate: isoDate,
            hrvValue,
          }),
          importedAt: now,
        })
      )

      await requestToPromise(
        summaries.add({
          userId,
          datasetKey: "pulseox",
          summaryId: `pulseox:${isoDate}`,
          source: "garmin",
          recordedAt,
          payload: JSON.stringify({
            calendarDate: isoDate,
            averageSpo2: spo2,
          }),
          importedAt: now,
        })
      )

      await requestToPromise(
        summaries.add({
          userId,
          datasetKey: "stressDetails",
          summaryId: `stress:${isoDate}`,
          source: "garmin",
          recordedAt,
          payload: JSON.stringify({
            calendarDate: isoDate,
            stressLevel,
          }),
          importedAt: now,
        })
      )

      await requestToPromise(
        sleepData.add({
          userId,
          deviceId: "garmin-test-device",
          sleepDate: new Date(`${isoDate}T00:00:00.000Z`),
          totalSleepTime: 430,
          deepSleepTime: 85,
          lightSleepTime: 250,
          remSleepTime: 95,
          sleepEfficiency: 88,
          sleepScore,
          createdAt: now,
          updatedAt: now,
        })
      )

      await requestToPromise(
        hrv.add({
          userId,
          deviceId: "garmin-test-device",
          measurementDate: new Date(`${isoDate}T05:00:00.000Z`),
          hrvValue,
          hrvType: "rmssd",
          measurementDuration: 300,
          confidence: 95,
          restingHeartRate: restingHr,
          stressLevel,
          createdAt: now,
        })
      )

      await requestToPromise(
        runs.add({
          userId,
          type: "easy",
          distance: Number((runDuration / 3600 * 10).toFixed(2)),
          duration: runDuration,
          heartRate: isRecentLoadDay ? 152 : 136,
          completedAt: new Date(`${isoDate}T06:30:00.000Z`),
          createdAt: now,
          updatedAt: now,
          importSource: "garmin",
          importRequestId: `run-${isoDate}`,
        })
      )
    }

    const planId = Number(
      await requestToPromise(
        plans.add({
          userId,
          title: "Garmin Test Plan",
          description: "Synthetic plan for Garmin UX tests",
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          totalWeeks: 3,
          isActive: true,
          planType: "basic",
          createdAt: now,
          updatedAt: now,
        })
      )
    )

    const workoutDays = ["Mon", "Wed", "Sat"]
    const workoutTypes = ["easy", "tempo", "long"]
    for (let index = 0; index < 3; index += 1) {
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + index)
      scheduledDate.setHours(6, 0, 0, 0)

      await requestToPromise(
        workouts.add({
          userId,
          planId,
          week: 1,
          day: workoutDays[index],
          type: workoutTypes[index],
          distance: index === 2 ? 14 : index === 1 ? 8 : 6,
          completed: false,
          scheduledDate,
          createdAt: now,
          updatedAt: now,
        })
      )
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    db.close()

    localStorage.setItem("beta_signup_complete", "true")
    localStorage.setItem("onboarding-complete", "true")
    localStorage.setItem(
      "user-data",
      JSON.stringify({
        id: userId,
        goal: "habit",
        experience: "intermediate",
        daysPerWeek: 4,
        preferredTimes: ["morning"],
      })
    )
  })
}

test.describe("PR05 Garmin UX dashboards", () => {
  test("renders readiness, chart danger zone, and sync freshness with mocked IndexedDB data", async ({ page }) => {
    let syncCalls = 0

    await page.route("**/api/devices/garmin/sync**", async (route) => {
      const request = route.request()
      if (request.method() === "POST") {
        syncCalls += 1
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          syncName: "RunSmart Garmin Export Sync",
          permissions: ["dailies", "hrv", "pulseox", "stressDetails"],
          availableToEnable: [],
          capabilities: [
            {
              key: "dailies",
              label: "Daily summaries",
              permissionGranted: true,
              endpointReachable: true,
              enabledForSync: true,
              supportedByRunSmart: true,
            },
          ],
          ingestion: {
            lookbackDays: 28,
            storeAvailable: true,
            recordsInWindow: 28,
            latestReceivedAt: new Date().toISOString(),
          },
          datasets: {},
          activities: [],
          sleep: [],
          notices: [],
        }),
      })
    })

    await page.goto("/")
    await page.waitForTimeout(2500)
    await seedGarminDashboardData(page)

    await page.goto("/?screen=profile")

    await expect(page.getByTestId("garmin-readiness-card")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId("garmin-readiness-tone-ready-to-train")).toBeVisible()

    const readinessSyncStatus = page.getByTestId("garmin-readiness-sync-status")
    await expect(readinessSyncStatus).toContainText("2h ago")

    await page.getByTestId("garmin-readiness-details-toggle").click()
    await expect(page.getByTestId("garmin-acwr-danger-zone")).toBeVisible()

    await readinessSyncStatus.getByTestId("garmin-sync-refresh-button").click()

    await expect.poll(() => syncCalls).toBeGreaterThan(0)
    await expect.poll(async () => (await readinessSyncStatus.textContent()) ?? "").toMatch(/just now|1m ago/i)
  })

  test("chat mentions readiness when user asks how am I doing", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [], conversationId: "default" }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: '0:{"textDelta":"Your readiness is 84 today. Keep the quality session short and controlled."}\n',
      })
    })

    await page.goto("/")
    await page.waitForTimeout(2500)
    await seedGarminDashboardData(page)

    await page.goto("/?screen=chat")
    await page.getByPlaceholder(/Ask your running coach anything/i).fill("how am i doing")
    await page.getByRole("button", { name: /send message/i }).click()

    await expect(page.getByText(/readiness is 84/i)).toBeVisible({ timeout: 20_000 })
  })

  test("weekly report card renders AI insight text", async ({ page }) => {
    await page.route("**/api/devices/garmin/connect**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "disabled in e2e test" }),
      })
    })

    await page.route("**/api/ai/garmin-insights**", async (route) => {
      const url = route.request().url()
      if (url.includes("type=weekly")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            insight: {
              type: "weekly",
              text: "Load: You trained 42km this week. Recovery: sleep averaged 7.2h. Focus: keep one quality session.",
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, insight: null }),
      })
    })

    await page.goto("/")
    await page.waitForTimeout(2500)
    await seedGarminDashboardData(page)

    await page.goto("/?screen=profile")
    await expect(page.getByTestId("garmin-readiness-card")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId("weekly-ai-insight-text")).toContainText("Load: You trained 42km this week", {
      timeout: 20_000,
    })
  })

  test("post-run insight shows in run detail view", async ({ page }) => {
    await page.route("**/api/ai/garmin-insights**", async (route) => {
      const url = route.request().url()
      if (url.includes("type=post_run")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            insight: {
              type: "post_run",
              text: "Strong effort. Your next 2 days should stay easy to absorb this load.",
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, insight: null }),
      })
    })

    await page.goto("/")
    await page.waitForTimeout(2500)
    await seedGarminDashboardData(page)

    await page.goto("/?screen=plan")
    await page.getByRole("button", { name: /biweekly/i }).click()
    await page.getByRole("button", { name: /view workout details/i }).first().click()

    await expect(page.getByTestId("post-run-ai-insight")).toContainText("next 2 days should stay easy", {
      timeout: 20_000,
    })
  })
})
