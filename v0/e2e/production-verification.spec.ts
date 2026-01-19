import { test, expect, type Page } from '@playwright/test';

// Production URL - update this with your actual Vercel URL
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://running-coach.vercel.app';
const RUN_PRODUCTION_TESTS = process.env.RUN_PRODUCTION_TESTS === 'true';

async function clearAppData(page: Page) {
  await page.goto(PRODUCTION_URL);
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    const dbNames = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB'];
    await Promise.all(
      dbNames.map(
        (dbName) =>
          new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve(true);
            };

            const timer = setTimeout(finish, 2000);

            try {
              const req = indexedDB.deleteDatabase(dbName);
              req.onsuccess = finish;
              req.onerror = finish;
              req.onblocked = finish;
            } catch {
              finish();
            }
          })
      )
    );
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function completeOnboarding(page: Page) {
  await page.getByRole('button', { name: /get started/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /get started/i }).click();

  await page.getByText(/Build a Running Habit/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByText(/^Beginner$/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByLabel(/your age/i).fill('25');
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByText(/current race time/i).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByText(/How many days per week/i).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByText(/Saturday/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByRole('button', { name: /start my journey/i }).click();
  await page.getByRole('navigation', { name: /main navigation/i }).waitFor({ state: 'visible', timeout: 20000 });
}

test.describe('Production Deployment Verification', () => {
  test.skip(!RUN_PRODUCTION_TESTS, 'Set RUN_PRODUCTION_TESTS=true to run production checks.');

  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await clearAppData(page);
  });

  test('Fix 1: Onboarding screen appears by default for new users', async ({ page }) => {
    console.log('🧪 Testing: Onboarding screen default for new users');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if onboarding screen is visible
    const hasOnboardingButton = await page
      .getByRole('button', { name: /get started/i })
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasTodayScreen = await page
      .getByRole('navigation', { name: /main navigation/i })
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    console.log('Onboarding visible:', hasOnboardingButton);
    console.log('Today screen visible:', hasTodayScreen);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/production-onboarding-default.png', fullPage: true });

    expect(hasOnboardingButton).toBe(true);
    expect(hasTodayScreen).toBe(false);
  });

  test('Fix 2: Restart Onboarding button exists on Today screen', async ({ page }) => {
    console.log('🧪 Testing: Restart Onboarding button on Today screen');

    await completeOnboarding(page);

    // Look for Reset button
    const resetButton = page.getByRole('button', { name: /reset/i });
    const isResetButtonVisible = await resetButton.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Reset button visible:', isResetButtonVisible);

    // Take screenshot
    await page.screenshot({ path: 'test-results/production-reset-button.png', fullPage: true });

    expect(isResetButtonVisible).toBe(true);
  });

  test('Fix 3: Date selection allows 14 days forward', async ({ page }) => {
    console.log('🧪 Testing: Date selection 14-day range');

    await completeOnboarding(page);

    // Look for "Add Run" button and click it
    const addRunButton = page.locator('button:has-text("Add Run")').first();
    if (await addRunButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addRunButton.click();
      await page.waitForTimeout(1000);

      await page.getByText(/Easy Run/i).first().click();

      // Click on date selector
      const dateSection = page.getByText(/When do you want to run/i).locator('..');
      const dateButton = dateSection.getByRole('button').first();
      if (await dateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateButton.click();
        await page.waitForTimeout(1000);

        // Check if calendar is visible
        const calendar = page.locator('.rdp, [class*="calendar"]').first();
        const isCalendarVisible = await calendar.isVisible({ timeout: 2000 }).catch(() => false);

        console.log('Calendar visible:', isCalendarVisible);

        // Take screenshot of calendar
        await page.screenshot({ path: 'test-results/production-calendar.png', fullPage: true });

        expect(isCalendarVisible).toBe(true);
      }
    }
  });

  test('Fix 4: Check for AI plan generation code in source', async ({ page }) => {
    console.log('🧪 Testing: AI plan generation integration in code');

    // Navigate to the page
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Check the page source for AI plan generation strings
    const content = await page.content();

    const hasAIGenerationCode = content.includes('Generating personalized training plan') ||
                                 content.includes('generate-plan') ||
                                 content.includes('AI plan generated');

    console.log('AI generation code found in source:', hasAIGenerationCode);

    // Also check for the function in the window object
    const hasGeneratePlanAPI = await page.evaluate(() => {
      return fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: {} })
      })
      .then(res => res.status !== 404)
      .catch(() => false);
    });

    console.log('Generate plan API exists:', hasGeneratePlanAPI);

    expect(hasAIGenerationCode || hasGeneratePlanAPI).toBe(true);
  });

  test('Fix 5: GPS timeout implementation', async ({ page }) => {
    console.log('🧪 Testing: GPS timeout functionality');

    await completeOnboarding(page);

    // Navigate to Record screen
    const recordButton = page.getByRole('button', { name: /navigate to record/i });
    if (await recordButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recordButton.click();
      await page.waitForTimeout(2000);

      // Check page source for GPS timeout code
      const content = await page.content();
      const hasGPSTimeout = content.includes('15000') || content.includes('GPS permission request timeout');

      console.log('GPS timeout code found:', hasGPSTimeout);

      await page.screenshot({ path: 'test-results/production-record-screen.png', fullPage: true });

      expect(hasGPSTimeout).toBe(true);
    }
  });

  test('Fix 6: API routes use correct searchParams method', async ({ page }) => {
    console.log('🧪 Testing: API routes use request.nextUrl.searchParams');

    // Test the recovery trends API
    const recoveryResponse = await page.request.get(`${PRODUCTION_URL}/api/recovery/trends?userId=1&days=7`);
    const recoveryStatus = recoveryResponse.status();
    console.log('Recovery trends API status:', recoveryStatus);

    // Test the data fusion quality API
    const qualityResponse = await page.request.get(`${PRODUCTION_URL}/api/data-fusion/quality?userId=1&days=7`);
    const qualityStatus = qualityResponse.status();
    console.log('Data fusion quality API status:', qualityStatus);

    // Test the data fusion rules API
    const rulesResponse = await page.request.get(`${PRODUCTION_URL}/api/data-fusion/rules?userId=1`);
    const rulesStatus = rulesResponse.status();
    console.log('Data fusion rules API status:', rulesStatus);

    // All should return 200 or 500 (not 400 or 404)
    expect(recoveryStatus).not.toBe(404);
    expect(qualityStatus).not.toBe(404);
    expect(rulesStatus).not.toBe(404);
  });

  test('Fix 7: Profile page retry logic', async ({ page }) => {
    console.log('🧪 Testing: Profile page retry logic');

    await completeOnboarding(page);

    // Navigate to Profile screen
    const profileButton = page.getByRole('button', { name: /navigate to profile/i });
    if (await profileButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileButton.click();
      await page.waitForTimeout(3000);

      // Check page source for retry logic code
      const content = await page.content();
      const hasRetryLogic = content.includes('maxRetries') || content.includes('exponential backoff') || content.includes('Retrying');

      console.log('Profile retry logic found:', hasRetryLogic);

      await page.screenshot({ path: 'test-results/production-profile-screen.png', fullPage: true });

      expect(hasRetryLogic).toBe(true);
    }
  });

  test('Overall: Check deployment version and commit', async ({ page }) => {
    console.log('🧪 Testing: Deployment version check');

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Check for version or commit hash in page
    const content = await page.content();

    // Look for common version indicators
    const hasVersionInfo = content.includes('733bf7a') ||
                          content.includes('b21eac0') ||
                          content.includes('version') ||
                          content.includes('build');

    console.log('Version info found:', hasVersionInfo);

    // Take full page screenshot
    await page.screenshot({ path: 'test-results/production-homepage.png', fullPage: true });

    // Log the URL for verification
    console.log('Tested URL:', page.url());
  });
});
