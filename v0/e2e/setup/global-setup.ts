import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Setup test environment
  await page.goto('http://localhost:3000');
  
  // Clear any existing test data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    indexedDB.deleteDatabase('running-coach-db');
  });
  
  await browser.close();
}

export default globalSetup; 