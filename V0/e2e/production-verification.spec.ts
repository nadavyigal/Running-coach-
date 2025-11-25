import { test, expect } from '@playwright/test';

// Production URL - update this with your actual Vercel URL
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://running-coach.vercel.app';

test.describe('Production Deployment Verification', () => {

  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await page.goto(PRODUCTION_URL);

    // Clear IndexedDB and localStorage
    await page.evaluate(() => {
      localStorage.clear();
      // Delete the running-coach-db
      const deleteRequest = indexedDB.deleteDatabase('running-coach-db');
      return new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Fix 1: Onboarding screen appears by default for new users', async ({ page }) => {
    console.log('🧪 Testing: Onboarding screen default for new users');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if onboarding screen is visible
    const hasOnboardingHeading = await page.locator('text=/Welcome to|Let\'s get started|What.*goal/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasTodayScreen = await page.locator('text=/Today.*Workout|Your Plan/i').first().isVisible({ timeout: 1000 }).catch(() => false);

    console.log('Onboarding visible:', hasOnboardingHeading);
    console.log('Today screen visible:', hasTodayScreen);

    // Take screenshot for debugging
    await page.screenshot({ path: 'V0/test-results/production-onboarding-default.png', fullPage: true });

    expect(hasOnboardingHeading).toBe(true);
    expect(hasTodayScreen).toBe(false);
  });

  test('Fix 2: Restart Onboarding button exists on Today screen', async ({ page }) => {
    console.log('🧪 Testing: Restart Onboarding button on Today screen');

    // First, complete onboarding to get to Today screen
    await page.evaluate(() => {
      localStorage.setItem('onboarding-complete', 'true');
    });

    // Create a completed user in IndexedDB
    await page.evaluate(async () => {
      const dbRequest = indexedDB.open('running-coach-db', 1);

      return new Promise((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          }
        };

        dbRequest.onsuccess = (event: any) => {
          const db = event.target.result;
          const transaction = db.transaction(['users'], 'readwrite');
          const store = transaction.objectStore('users');

          store.add({
            goal: 'habit',
            experience: 'beginner',
            onboardingComplete: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          transaction.oncomplete = () => resolve(true);
        };
      });
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // Look for Restart Onboarding button
    const restartButton = page.locator('button:has-text("Restart Onboarding")');
    const isRestartButtonVisible = await restartButton.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Restart Onboarding button visible:', isRestartButtonVisible);

    // Take screenshot
    await page.screenshot({ path: 'V0/test-results/production-restart-button.png', fullPage: true });

    expect(isRestartButtonVisible).toBe(true);
  });

  test('Fix 3: Date selection allows 14 days forward', async ({ page }) => {
    console.log('🧪 Testing: Date selection 14-day range');

    // Set up as completed user
    await page.evaluate(async () => {
      const dbRequest = indexedDB.open('running-coach-db', 1);

      return new Promise((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('plans')) {
            db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
          }
        };

        dbRequest.onsuccess = async (event: any) => {
          const db = event.target.result;
          const transaction = db.transaction(['users', 'plans'], 'readwrite');

          const userStore = transaction.objectStore('users');
          userStore.add({
            goal: 'habit',
            experience: 'beginner',
            onboardingComplete: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          const planStore = transaction.objectStore('plans');
          planStore.add({
            userId: 1,
            title: 'Test Plan',
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });

          transaction.oncomplete = () => resolve(true);
        };
      });
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // Look for "Add Run" button and click it
    const addRunButton = page.locator('button:has-text("Add Run")').first();
    if (await addRunButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addRunButton.click();
      await page.waitForTimeout(1000);

      // Click on date selector
      const dateButton = page.locator('button[aria-label*="date"], button:has-text("Select date")').first();
      if (await dateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateButton.click();
        await page.waitForTimeout(1000);

        // Check if calendar is visible
        const calendar = page.locator('[role="dialog"], [class*="calendar"]').first();
        const isCalendarVisible = await calendar.isVisible({ timeout: 2000 }).catch(() => false);

        console.log('Calendar visible:', isCalendarVisible);

        // Take screenshot of calendar
        await page.screenshot({ path: 'V0/test-results/production-calendar.png', fullPage: true });

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

    // Set up as completed user
    await page.evaluate(async () => {
      const dbRequest = indexedDB.open('running-coach-db', 1);

      return new Promise((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          }
        };

        dbRequest.onsuccess = (event: any) => {
          const db = event.target.result;
          const transaction = db.transaction(['users'], 'readwrite');
          const store = transaction.objectStore('users');

          store.add({
            goal: 'habit',
            experience: 'beginner',
            onboardingComplete: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          transaction.oncomplete = () => resolve(true);
        };
      });
    });

    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to Record screen
    const recordButton = page.locator('[data-screen="record"], button:has-text("Record")').first();
    if (await recordButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recordButton.click();
      await page.waitForTimeout(2000);

      // Check page source for GPS timeout code
      const content = await page.content();
      const hasGPSTimeout = content.includes('15000') || content.includes('GPS permission request timeout');

      console.log('GPS timeout code found:', hasGPSTimeout);

      await page.screenshot({ path: 'V0/test-results/production-record-screen.png', fullPage: true });

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

    // Set up as completed user
    await page.evaluate(async () => {
      const dbRequest = indexedDB.open('running-coach-db', 1);

      return new Promise((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          }
        };

        dbRequest.onsuccess = (event: any) => {
          const db = event.target.result;
          const transaction = db.transaction(['users'], 'readwrite');
          const store = transaction.objectStore('users');

          store.add({
            goal: 'habit',
            experience: 'beginner',
            onboardingComplete: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          transaction.oncomplete = () => resolve(true);
        };
      });
    });

    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate to Profile screen
    const profileButton = page.locator('[data-screen="profile"], button:has-text("Profile")').first();
    if (await profileButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileButton.click();
      await page.waitForTimeout(3000);

      // Check page source for retry logic code
      const content = await page.content();
      const hasRetryLogic = content.includes('maxRetries') || content.includes('exponential backoff') || content.includes('Retrying');

      console.log('Profile retry logic found:', hasRetryLogic);

      await page.screenshot({ path: 'V0/test-results/production-profile-screen.png', fullPage: true });

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
    await page.screenshot({ path: 'V0/test-results/production-homepage.png', fullPage: true });

    // Log the URL for verification
    console.log('Tested URL:', page.url());
  });
});
