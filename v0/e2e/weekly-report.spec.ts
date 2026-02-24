import { expect, test } from '@playwright/test'

test('weekly report page shows latest report and supports regenerate', async ({ page }) => {
  let content = '## Load\n- Initial weekly report.'

  await page.route('**/api/garmin/reports/weekly?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        report: {
          id: 1,
          type: 'weekly',
          periodStart: '2026-02-18',
          periodEnd: '2026-02-24',
          contentMd: content,
          confidence: 'medium',
          confidenceScore: 0.72,
          createdAt: '2026-02-24T09:00:00.000Z',
        },
      }),
    })
  })

  await page.route('**/api/garmin/reports/weekly', async (route) => {
    content = '## Load\n- Regenerated weekly report.'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated: true,
        report: {
          id: 2,
          type: 'weekly',
          periodStart: '2026-02-18',
          periodEnd: '2026-02-24',
          contentMd: content,
          confidence: 'high',
          confidenceScore: 0.9,
          createdAt: '2026-02-24T10:00:00.000Z',
        },
      }),
    })
  })

  await page.goto('/debug/weekly-report')

  await expect(page.getByTestId('weekly-report-card')).toBeVisible()
  await expect(page.getByTestId('weekly-report-content')).toContainText('Initial weekly report')

  await page.getByTestId('weekly-report-generate').click()
  await expect(page.getByTestId('weekly-report-content')).toContainText('Regenerated weekly report')
})
