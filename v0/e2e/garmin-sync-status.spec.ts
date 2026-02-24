import { expect, test } from "@playwright/test"

test("logged-in user sees Garmin SyncStatus and refresh updates last sync", async ({ page }) => {
  let lastSyncAt = "2026-02-24T08:00:00.000Z"

  await page.route("**/api/garmin/status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: true,
        connectionStatus: "connected",
        lastSyncAt,
        errorState: null,
        freshnessLabel: "stale",
        confidenceLabel: "medium",
      }),
    })
  })

  await page.route("**/api/garmin/sync**", async (route) => {
    lastSyncAt = "2026-02-24T09:05:00.000Z"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        connected: true,
        lastSyncAt,
        errorState: null,
        noOp: false,
        activitiesUpserted: 1,
        dailyMetricsUpserted: 1,
        freshnessLabel: "fresh",
        confidenceLabel: "high",
      }),
    })
  })

  await page.goto("/debug/garmin-sync-status")

  const statusBar = page.getByTestId("garmin-sync-status")
  await expect(statusBar).toBeVisible()

  const lastSyncText = page.getByTestId("garmin-sync-last-sync")
  const beforeRefresh = await lastSyncText.textContent()

  await page.getByTestId("garmin-sync-refresh").click()
  await expect(page.getByTestId("garmin-sync-refresh")).toContainText("Refresh")
  await expect(lastSyncText).not.toHaveText(beforeRefresh ?? "")
})
