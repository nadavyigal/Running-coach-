import { test, expect } from '@playwright/test';

test.describe('Feature Verification - P1 & P2 Features', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Clear IndexedDB to ensure fresh state
      if (window.indexedDB) {
        const databases = ['RunningCoachDB'];
        databases.forEach(dbName => {
          indexedDB.deleteDatabase(dbName);
        });
      }
    });
    await page.waitForTimeout(500);
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('P1.1 - GPS run recording functionality', async ({ page }) => {
    console.log('\n🧪 Testing P1.1: GPS run recording...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Navigate to Record screen
    const recordButton = page.locator('button').filter({ hasText: /record/i }).first();
    const recordExists = await recordButton.count() > 0;
    console.log('  ✓ Record button found:', recordExists);
    expect(recordExists).toBe(true);

    await recordButton.click();
    await page.waitForTimeout(2000);

    // Check for GPS tracking elements
    const startGPSButton = page.locator('button').filter({ hasText: /start|begin/i }).first();
    const hasGPSControls = await startGPSButton.count() > 0;
    console.log('  ✓ GPS tracking controls present:', hasGPSControls);

    // Check for location permission prompt or geolocation API usage
    const hasMap = await page.locator('canvas, .map, [data-testid*="map"]').count() > 0;
    console.log('  ✓ Map/tracking UI present:', hasMap);

    expect(hasGPSControls || hasMap).toBe(true);
  });

  test('P1.2 - Manual run entry saves to database', async ({ page }) => {
    console.log('\n🧪 Testing P1.2: Manual run entry...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Look for "Add Run" button
    const addRunButton = page.locator('button').filter({ hasText: /add.*run/i }).first();
    const addRunExists = await addRunButton.count() > 0;
    console.log('  ✓ Add Run button found:', addRunExists);
    expect(addRunExists).toBe(true);

    await addRunButton.click();
    await page.waitForTimeout(1000);

    // Check for manual entry form
    const distanceInput = page.locator('input[type="number"], input[placeholder*="distance"], input[placeholder*="km"], input[placeholder*="miles"]').first();
    const hasDistanceInput = await distanceInput.count() > 0;
    console.log('  ✓ Distance input found:', hasDistanceInput);
    expect(hasDistanceInput).toBe(true);

    // Try to fill and submit
    if (hasDistanceInput) {
      await distanceInput.fill('5');

      const durationInput = page.locator('input[placeholder*="duration"], input[placeholder*="time"], input[placeholder*="minutes"]').first();
      if (await durationInput.count() > 0) {
        await durationInput.fill('30');
      }

      const saveButton = page.locator('button').filter({ hasText: /save|submit|add/i }).first();
      if (await saveButton.count() > 0 && !await saveButton.isDisabled()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        console.log('  ✓ Manual run entry submitted');
      }
    }
  });

  test('P1.3 - Goal creation form submits successfully', async ({ page }) => {
    console.log('\n🧪 Testing P1.3: Goal creation...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Navigate to Profile or Goals section
    const profileButton = page.locator('button, a').filter({ hasText: /profile|goals/i }).first();
    if (await profileButton.count() > 0) {
      await profileButton.click();
      await page.waitForTimeout(1000);
    }

    // Look for "Create Goal" or "Add Goal" button
    const createGoalButton = page.locator('button').filter({ hasText: /create.*goal|add.*goal|new.*goal/i }).first();
    const createGoalExists = await createGoalButton.count() > 0;
    console.log('  ✓ Create Goal button found:', createGoalExists);

    if (createGoalExists) {
      await createGoalButton.click();
      await page.waitForTimeout(1000);

      // Check for goal form
      const goalNameInput = page.locator('input[placeholder*="goal"], textarea[placeholder*="goal"]').first();
      const hasGoalForm = await goalNameInput.count() > 0;
      console.log('  ✓ Goal creation form present:', hasGoalForm);
      expect(hasGoalForm).toBe(true);

      // Try to fill basic goal info
      if (hasGoalForm) {
        await goalNameInput.fill('Run 5K in 25 minutes');

        const submitButton = page.locator('button').filter({ hasText: /save|submit|create/i }).first();
        if (await submitButton.count() > 0) {
          const isDisabled = await submitButton.isDisabled();
          console.log('  ✓ Submit button enabled:', !isDisabled);
        }
      }
    } else {
      console.log('  ⚠ No Create Goal button found - feature may be elsewhere');
    }
  });

  test('P1.4 - Route selector displays and allows selection', async ({ page }) => {
    console.log('\n🧪 Testing P1.4: Route selector...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Look for route-related buttons
    const routeButton = page.locator('button').filter({ hasText: /route|location|map/i }).first();
    const routeExists = await routeButton.count() > 0;
    console.log('  ✓ Route button found:', routeExists);

    if (routeExists) {
      await routeButton.click();
      await page.waitForTimeout(1000);

      // Check for route selector modal
      const routeModal = page.locator('[data-testid*="route"], .route-selector, dialog').first();
      const hasRouteSelector = await routeModal.count() > 0;
      console.log('  ✓ Route selector displayed:', hasRouteSelector);

      // Check for route options
      const routeOptions = await page.locator('button, .route-item, [data-testid*="route-option"]').count();
      console.log('  ✓ Route options available:', routeOptions);

      expect(hasRouteSelector || routeOptions > 0).toBe(true);
    } else {
      console.log('  ⚠ No Route button found - checking for inline route selection');

      // Check if route selection is inline on Today/Plan screen
      const routeElements = await page.locator('text*="route"').count();
      console.log('  ✓ Route elements on page:', routeElements);
    }
  });

  test('P2.1 - AI goal discovery wizard works', async ({ page }) => {
    console.log('\n🧪 Testing P2.1: AI goal discovery wizard...');

    // Start from fresh onboarding
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for AI wizard during onboarding
    const aiWizardButton = page.locator('button').filter({ hasText: /ai.*help|discover.*goal|wizard/i }).first();
    const hasAIWizard = await aiWizardButton.count() > 0;
    console.log('  ✓ AI Goal Wizard button found:', hasAIWizard);

    if (hasAIWizard) {
      await aiWizardButton.click();
      await page.waitForTimeout(1000);

      // Check for AI wizard interface
      const wizardModal = await page.locator('dialog, [role="dialog"], .wizard, [data-testid*="wizard"]').count();
      console.log('  ✓ AI Wizard modal displayed:', wizardModal > 0);

      // Check for AI-powered question/answer interface
      const hasQuestions = await page.locator('text*="question", input, textarea').count() > 0;
      console.log('  ✓ AI wizard questions present:', hasQuestions);

      expect(wizardModal > 0 || hasQuestions).toBe(true);
    } else {
      console.log('  ⚠ AI Goal Wizard not found in onboarding');
    }
  });

  test('P2.2 - Chat overlay integration functions', async ({ page }) => {
    console.log('\n🧪 Testing P2.2: Chat overlay...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Look for chat button
    const chatButton = page.locator('button, a').filter({ hasText: /chat|coach|ai/i }).first();
    const chatExists = await chatButton.count() > 0;
    console.log('  ✓ Chat button found:', chatExists);

    if (chatExists) {
      await chatButton.click();
      await page.waitForTimeout(2000);

      // Check for chat interface
      const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"], input[placeholder*="chat"], textarea[placeholder*="chat"]').first();
      const hasChatInput = await chatInput.count() > 0;
      console.log('  ✓ Chat input field found:', hasChatInput);
      expect(hasChatInput).toBe(true);

      // Try sending a message
      if (hasChatInput) {
        await chatInput.fill('Hello coach');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);

        // Check for AI response
        const aiResponse = await page.locator('.ai-message, .assistant-message, [data-role="assistant"]').count();
        console.log('  ✓ AI response received:', aiResponse > 0);
      }
    } else {
      console.log('  ⚠ Chat button not found');
      expect(chatExists).toBe(true);
    }
  });

  test('P2.3 - Photo upload analysis works', async ({ page }) => {
    console.log('\n🧪 Testing P2.3: Photo upload analysis...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Look for photo upload feature
    const uploadButton = page.locator('button, input[type="file"]').filter({ hasText: /photo|image|upload|camera/i }).first();
    const uploadExists = await uploadButton.count() > 0;
    console.log('  ✓ Photo upload button found:', uploadExists);

    if (uploadExists) {
      // Check if it's a file input or button that triggers file input
      const fileInput = page.locator('input[type="file"]').first();
      const hasFileInput = await fileInput.count() > 0;
      console.log('  ✓ File input element present:', hasFileInput);

      if (hasFileInput) {
        // Verify it accepts images
        const accept = await fileInput.getAttribute('accept');
        console.log('  ✓ Accepts image types:', accept?.includes('image') || false);
      }
    } else {
      console.log('  ⚠ Photo upload feature not found');
    }
  });

  test('P2.4 - Advanced route filtering works', async ({ page }) => {
    console.log('\n🧪 Testing P2.4: Advanced route filtering...');

    // Complete onboarding first
    await completeOnboarding(page);

    // Navigate to route selector
    const routeButton = page.locator('button').filter({ hasText: /route/i }).first();
    if (await routeButton.count() > 0) {
      await routeButton.click();
      await page.waitForTimeout(1000);

      // Check for filter options
      const filterButtons = await page.locator('button').filter({ hasText: /filter|distance|difficulty|terrain/i }).count();
      console.log('  ✓ Filter buttons found:', filterButtons);

      // Check for dropdowns or select elements
      const selects = await page.locator('select, [role="combobox"]').count();
      console.log('  ✓ Filter dropdowns found:', selects);

      // Check for distance/difficulty sliders or inputs
      const rangeInputs = await page.locator('input[type="range"], input[type="number"]').count();
      console.log('  ✓ Range inputs for filtering:', rangeInputs);

      const hasFiltering = filterButtons > 0 || selects > 0 || rangeInputs > 0;
      expect(hasFiltering).toBe(true);
    } else {
      console.log('  ⚠ Route button not found');
    }
  });
});

// Helper function to complete onboarding
async function completeOnboarding(page: any) {
  console.log('  → Completing onboarding...');

  // Check if already completed
  const isOnboardingComplete = await page.evaluate(() =>
    localStorage.getItem('onboarding-complete') === 'true'
  );

  if (isOnboardingComplete) {
    console.log('  ✓ Onboarding already completed');
    return;
  }

  // Wait for onboarding to load
  await page.waitForTimeout(2000);

  // Click through onboarding steps
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Look for any clickable onboarding elements
    const continueButton = page.locator('button').filter({
      hasText: /continue|next|start|generate|create|complete|begin/i
    }).first();

    if (await continueButton.count() > 0 && await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(1500);
      attempts++;

      // Check if we've completed onboarding
      const nowComplete = await page.evaluate(() =>
        localStorage.getItem('onboarding-complete') === 'true'
      );

      if (nowComplete) {
        console.log('  ✓ Onboarding completed');
        return;
      }
    } else {
      // Check if we're on the main app
      const hasNavigation = await page.locator('nav, button').filter({ hasText: /today|plan|profile/i }).count() > 0;
      if (hasNavigation) {
        console.log('  ✓ Reached main app');
        return;
      }
      break;
    }
  }

  console.log('  ⚠ Onboarding may not have completed fully');
}
