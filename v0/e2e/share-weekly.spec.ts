import { expect, test } from '@playwright/test'

test('weekly insights page share button opens share page', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'share', {
      value: undefined,
      configurable: true,
    })
  })

  await page.goto('/insights/weekly')

  await expect(page.getByTestId('share-weekly-button')).toBeVisible()
  await page.getByTestId('share-weekly-button').click()

  await expect(page).toHaveURL(/\/weekly\//)
  await expect(page.getByTestId('weekly-share-card')).toBeVisible()
})
