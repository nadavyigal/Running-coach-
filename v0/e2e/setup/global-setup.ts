import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Setup test environment
  const baseURL =
    config.projects[0]?.use?.baseURL ?? config.use?.baseURL ?? 'http://localhost:3010';
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  
  // Clear any existing test data
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    const dbNames = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB'];
    await Promise.all(
      dbNames.map(
        (dbName) =>
          new Promise((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(dbName);
              req.onsuccess = () => resolve(true);
              req.onerror = () => resolve(true);
              req.onblocked = () => resolve(true);
            } catch {
              resolve(true);
            }
          })
      )
    );
  });
  
  await browser.close();
}

export default globalSetup; 
