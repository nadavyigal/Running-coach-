import { expect, test } from '@playwright/test'

test('dashboard panels render and readiness why is expandable', async ({ page }) => {
  await page.route('**/api/garmin/metrics/readiness**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        score: 76,
        state: 'ready',
        drivers: [
          {
            signal: 'sleep_score',
            impact: 'positive',
            value: 82,
            baseline: 75,
            contribution: 22,
            explanation: 'Sleep score is 82.',
          },
        ],
        confidence: 'high',
        confidenceReason: 'Strong signal coverage with a fresh sync in the last 24 hours.',
        lastSyncAt: '2026-02-24T09:00:00.000Z',
        missingSignals: [],
        underRecovery: {
          flagged: false,
          triggerCount: 0,
          triggers: [],
          confidence: 'low',
          recommendation: 'No clear under-recovery signature detected right now.',
        },
        load: {
          acuteLoad7d: 320,
          chronicLoad28d: 300,
          acwr: 1.06,
        },
      }),
    })
  })

  await page.goto('/debug/group-b-dashboard')

  await expect(page.getByTestId('dashboard-panel-readiness')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-recovery')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-load')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-consistency')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-performance')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-recent-run')).toBeVisible()
  await expect(page.getByTestId('dashboard-panel-data-quality')).toBeVisible()

  await expect(page.getByTestId('readiness-confidence')).toContainText('high')
  await page.getByTestId('readiness-why-toggle').click()
  await expect(page.getByTestId('readiness-why-content')).toBeVisible()
})
