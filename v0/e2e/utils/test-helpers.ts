import { Page } from '@playwright/test';

export class TestHelpers {
  static async clearUserData(page: Page) {
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
  }

  static async waitForAdaptiveUpdate(page: Page, timeout = 5000) {
    try {
      await page.waitForSelector('[data-testid="adaptive-update-notification"]', { timeout });
    } catch {
      // If notification doesn't appear, continue anyway
      console.log('Adaptive update notification not found, continuing...');
    }
  }

  static async completeOnboarding(page: Page, userProfile: any) {
    await page.goto('/onboarding');
    
    // Fill onboarding form
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption(userProfile.experience);
    await page.getByLabel('Goal').selectOption(userProfile.goal);
    await page.getByLabel('Days per Week').selectOption(userProfile.daysPerWeek.toString());
    
    // Continue through onboarding
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();
    
    // Wait for onboarding completion
    await page.waitForSelector('[data-testid="onboarding-complete"]', { timeout: 10000 });
  }

  static async recordRun(page: Page, runData: any) {
    await page.goto('/record');
    
    // Fill run form
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    
    // Save run
    await page.getByRole('button', { name: 'Save Run' }).click();
    
    // Wait for run to be saved
    await page.waitForSelector('[data-testid="run-saved"]', { timeout: 10000 });
  }

  static async verifyPlanUpdate(page: Page) {
    // Wait for adaptive update notification
    await page.waitForSelector('[data-testid="plan-updated"]', { timeout: 10000 });
    
    // Click to view updated plan
    await page.getByRole('button', { name: 'View Updated Plan' }).click();
    
    // Verify plan update elements
    await page.waitForSelector('[data-testid="updated-plan"]', { timeout: 10000 });
  }

  static async verifyDataIntegrity(page: Page, userProfile: any, runData: any) {
    // Check profile data
    await page.goto('/profile');
    await page.waitForSelector(`[data-testid="user-name"]`, { timeout: 5000 });
    const profileText = await page.textContent('body');
    expect(profileText).toContain(userProfile.name);
    expect(profileText).toContain(userProfile.experience);
    expect(profileText).toContain(userProfile.goal);

    // Check run history
    await page.goto('/history');
    await page.waitForSelector(`[data-testid="run-${runData.distance}km"]`, { timeout: 5000 });
    const historyText = await page.textContent('body');
    expect(historyText).toContain(`${runData.distance}km`);
    expect(historyText).toContain(`${runData.duration}min`);
  }

  static async measurePerformance(page: Page, testFunction: () => Promise<void>) {
    const startTime = Date.now();
    await testFunction();
    const endTime = Date.now();
    return (endTime - startTime) / 1000;
  }

  static async mockExternalAPIs(page: Page) {
    // Mock weather API
    await page.route('**/api/weather**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 20,
          humidity: 60,
          conditions: 'sunny'
        })
      });
    });

    // Mock location services
    await page.route('**/api/location**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lat: 40.7128,
          lng: -74.0060,
          accuracy: 5
        })
      });
    });
  }
} 
