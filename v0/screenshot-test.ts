import { chromium } from 'playwright';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 } // iPhone 14 Pro dimensions
  });
  const page = await context.newPage();

  // Clear localStorage to ensure we see onboarding
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('run-smart-db');
  });

  // Reload to trigger onboarding
  await page.reload();
  await page.waitForTimeout(2000);

  // Take screenshot - full page to see all content
  await page.screenshot({
    path: 'onboarding-screenshot.png',
    fullPage: true
  });

  console.log('Screenshot saved to onboarding-screenshot.png');

  await browser.close();
}

takeScreenshot().catch(console.error);
