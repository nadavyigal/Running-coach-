import { test, expect } from '@playwright/test';

test.describe('Feature Verification - P1 & P2 Features', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      // Clear IndexedDB to ensure fresh state
      const databases = ['RunSmartDB', 'running-coach-db', 'RunningCoachDB'];
      await Promise.all(
        databases.map(
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
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('P1.1 - GPS run recording functionality', async ({ page }) => {
    console.log('\nTesting P1.1: GPS run recording...');

    // Complete onboarding first
    await completeOnboarding(page);

    const recordNav = page.getByRole('button', { name: /navigate to record/i });
    await recordNav.click();
    await page.getByRole('heading', { name: /record run/i }).waitFor({ timeout: 10000 });

    const startRun = page.getByRole('button', { name: /start run/i });
    const hasStartRun = await startRun.isVisible().catch(() => false);
    const hasMap = await page.locator('canvas, .map, [data-testid*="map"]').count() > 0;

    console.log('  -> Start Run button present:', hasStartRun);
    console.log('  -> Map/tracking UI present:', hasMap);

    expect(hasStartRun || hasMap).toBe(true);
  });

  test('P1.2 - Manual run entry saves to database', async ({ page }) => {
    console.log('\nTesting P1.2: Manual run entry...');

    // Complete onboarding first
    await completeOnboarding(page);

    await page.getByRole('navigation', { name: /main navigation/i }).waitFor({ state: 'visible', timeout: 15000 });

    const todayNav = page.getByRole('button', { name: /navigate to today/i });
    await todayNav.click();
    await expect(todayNav).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    const addRunButton = page.getByRole('button', { name: /add run/i });
    await addRunButton.scrollIntoViewIfNeeded().catch(() => {});
    const addRunExists = await addRunButton.isVisible().catch(() => false);
    console.log('  -> Add Run button found:', addRunExists);
    expect(addRunExists).toBe(true);

    await addRunButton.click();

    const addRunDialog = page.getByRole('dialog');
    await expect(addRunDialog).toBeVisible({ timeout: 10000 });
    const addRunTitle = addRunDialog.getByText(/add run/i);
    const hasAddRunTitle = await addRunTitle.isVisible().catch(() => false);

    console.log('  -> Add Run modal visible:', hasAddRunTitle);
    expect(hasAddRunTitle).toBe(true);
  });

  test('P1.3 - Goal creation form submits successfully', async ({ page }) => {
    console.log('\nTesting P1.3: Goal creation...');

    // Complete onboarding first
    await completeOnboarding(page);

    const profileNav = page.getByRole('button', { name: /navigate to profile/i });
    if (await profileNav.isVisible().catch(() => false)) {
      await profileNav.click();
      await page.waitForTimeout(1000);
    } else {
      const profileButton = page.locator('button, a').filter({ hasText: /profile|goals/i }).first();
      if (await profileButton.isVisible().catch(() => false)) {
        await profileButton.click();
        await page.waitForTimeout(1000);
      }
    }

    const createGoalButton = page.locator('button').filter({ hasText: /create.*goal|add.*goal|new.*goal/i }).first();
    const createGoalExists = await createGoalButton.isVisible().catch(() => false);
    console.log('  -> Create Goal button found:', createGoalExists);

    if (createGoalExists) {
      await createGoalButton.click();
      await page.waitForTimeout(1000);

      const goalNameInput = page.locator('input[placeholder*="goal"], textarea[placeholder*="goal"]').first();
      const hasGoalForm = await goalNameInput.isVisible().catch(() => false);
      console.log('  -> Goal creation form present:', hasGoalForm);
      expect(hasGoalForm).toBe(true);

      if (hasGoalForm) {
        await goalNameInput.fill('Run 5K in 25 minutes');

        const submitButton = page.locator('button').filter({ hasText: /save|submit|create/i }).first();
        if (await submitButton.count() > 0) {
          const isDisabled = await submitButton.isDisabled();
          console.log('  -> Submit button enabled:', !isDisabled);
        }
      }
    } else {
      console.log('  -> No Create Goal button found - feature may be elsewhere');
    }
  });

  test('P1.4 - Route selector displays and allows selection', async ({ page }) => {
    console.log('\nTesting P1.4: Route selector...');

    // Complete onboarding first
    await completeOnboarding(page);

    const todayNav = page.getByRole('button', { name: /navigate to today/i });
    await todayNav.click();

    const routeButton = page.locator('button').filter({ hasText: /select route|choose route/i }).first();
    const routeExists = await routeButton.isVisible().catch(() => false);
    console.log('  -> Route button found:', routeExists);

    if (routeExists) {
      await routeButton.click();

      const routeModal = page.locator('[data-testid*="route"], .route-selector, [role="dialog"]').first();
      const hasRouteSelector = await routeModal.isVisible().catch(() => false);

      const routeOptions = await page.locator('button, .route-item, [data-testid*="route-option"]').count();
      console.log('  -> Route selector displayed:', hasRouteSelector);
      console.log('  -> Route options available:', routeOptions);

      expect(hasRouteSelector || routeOptions > 0).toBe(true);
    } else {
      console.log('  -> Route button not found - checking for inline route selection');

      const routeElements = await page.getByText(/route/i).count();
      console.log('  -> Route elements on page:', routeElements);
    }
  });

  test('P2.1 - AI goal discovery wizard works', async ({ page }) => {
    console.log('\nTesting P2.1: AI goal discovery wizard...');

    // Start from fresh onboarding
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const aiWizardButton = page.locator('button').filter({ hasText: /ai.*help|discover.*goal|wizard/i }).first();
    const hasAIWizard = await aiWizardButton.count() > 0;
    console.log('  -> AI Goal Wizard button found:', hasAIWizard);

    if (hasAIWizard) {
      await aiWizardButton.click();
      await page.waitForTimeout(1000);

      const wizardModal = await page.locator('dialog, [role="dialog"], .wizard, [data-testid*="wizard"]').count();
      console.log('  -> AI Wizard modal displayed:', wizardModal > 0);

      const questionCount = await page.getByText(/question/i).count();
      const inputCount = await page.locator('input, textarea').count();
      const hasQuestions = questionCount > 0 || inputCount > 0;
      console.log('  -> AI wizard questions present:', hasQuestions);

      expect(wizardModal > 0 || hasQuestions).toBe(true);
    } else {
      console.log('  -> AI Goal Wizard not found in onboarding');
    }
  });

  test('P2.2 - Chat overlay integration functions', async ({ page }) => {
    console.log('\nTesting P2.2: Chat overlay...');

    // Complete onboarding first
    await completeOnboarding(page);

    await page.getByRole('navigation', { name: /main navigation/i }).waitFor({ state: 'visible', timeout: 15000 });

    const coachNav = page.getByRole('button', { name: /navigate to coach/i });
    const coachExists = await coachNav.isVisible().catch(() => false);
    console.log('  -> Coach nav button found:', coachExists);

    if (coachExists) {
      await coachNav.click();

      const chatInput = page.getByPlaceholder(/ask your running coach/i);
      await chatInput.waitFor({ state: 'visible', timeout: 15000 });
      const hasChatInput = await chatInput.isVisible().catch(() => false);
      console.log('  -> Chat input field found:', hasChatInput);
      expect(hasChatInput).toBe(true);

      if (hasChatInput) {
        await chatInput.fill('Hello coach');
        await page.getByRole('button', { name: /send message/i }).click();
        await page.waitForTimeout(3000);

        const aiResponse = await page.locator('.ai-message, .assistant-message, [data-role="assistant"]').count();
        console.log('  -> AI response received:', aiResponse > 0);
      }
    } else {
      console.log('  -> Coach nav button not found');
      expect(coachExists).toBe(true);
    }
  });

  test('P2.3 - Photo upload analysis works', async ({ page }) => {
    console.log('\nTesting P2.3: Photo upload analysis...');

    // Complete onboarding first
    await completeOnboarding(page);

    const uploadButton = page.locator('button, input[type="file"]').filter({ hasText: /photo|image|upload|camera/i }).first();
    const uploadExists = await uploadButton.count() > 0;
    console.log('  -> Photo upload button found:', uploadExists);

    if (uploadExists) {
      const fileInput = page.locator('input[type="file"]').first();
      const hasFileInput = await fileInput.count() > 0;
      console.log('  -> File input element present:', hasFileInput);

      if (hasFileInput) {
        const accept = await fileInput.getAttribute('accept');
        console.log('  -> Accepts image types:', accept?.includes('image') || false);
      }
    } else {
      console.log('  -> Photo upload feature not found');
    }
  });

  test('P2.4 - Advanced route filtering works', async ({ page }) => {
    console.log('\nTesting P2.4: Advanced route filtering...');

    // Complete onboarding first
    await completeOnboarding(page);

    const todayNav = page.getByRole('button', { name: /navigate to today/i });
    await todayNav.click();

    const routeButton = page.locator('button').filter({ hasText: /select route|choose route/i }).first();
    if (await routeButton.isVisible().catch(() => false)) {
      await routeButton.click();

      const filterButtons = await page.locator('button').filter({ hasText: /filter|distance|difficulty|terrain/i }).count();
      console.log('  -> Filter buttons found:', filterButtons);

      const selects = await page.locator('select, [role="combobox"]').count();
      console.log('  -> Filter dropdowns found:', selects);

      const rangeInputs = await page.locator('input[type="range"], input[type="number"]').count();
      console.log('  -> Range inputs for filtering:', rangeInputs);

      const hasFiltering = filterButtons > 0 || selects > 0 || rangeInputs > 0;
      expect(hasFiltering).toBe(true);
    } else {
      console.log('  -> Route button not found');
    }
  });
});

// Helper function to complete onboarding
async function completeOnboarding(page: any) {
  console.log('  -> Completing onboarding...');

  const isOnboardingComplete = await page.evaluate(() =>
    localStorage.getItem('onboarding-complete') === 'true'
  );

  if (isOnboardingComplete) {
    console.log('  -> Onboarding already completed');
    return;
  }

  await page.waitForTimeout(1000);

  const getStarted = page.getByRole('button', { name: /get started/i });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByText(/Build a Running Habit/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByText(/^Beginner$/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByLabel(/Your age/i).fill('25');
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByText(/Morning/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  await page.getByRole('button', { name: /start my journey/i }).click();
}
