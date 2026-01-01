import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3010);
const USE_PROD = process.env.PLAYWRIGHT_USE_PROD === 'true';
const IS_WINDOWS = process.platform === 'win32';
const PROD_COMMAND = IS_WINDOWS
  ? `set PORT=${PORT}&& npm run start`
  : `PORT=${PORT} npm run start`;
const DEV_COMMAND = `npm run dev -- --webpack -p ${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  globalSetup: './e2e/setup/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: USE_PROD ? PROD_COMMAND : DEV_COMMAND,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
}); 
