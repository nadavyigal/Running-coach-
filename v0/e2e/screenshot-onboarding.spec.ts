import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Onboarding Screenshot', () => {
  test('capture mobile onboarding screen', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate and wait longer
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for content to be visible
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/onboarding-mobile-screenshot.png',
      fullPage: true
    });

    console.log('✅ Mobile screenshot captured');
  });
});
