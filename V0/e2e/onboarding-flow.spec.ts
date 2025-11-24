import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage before each test
    await context.clearCookies();
    await page.goto('http://localhost:3000'); // Using port 3000 where our app is running
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should complete onboarding flow successfully', async ({ page }) => {
    console.log('🧪 Testing onboarding completion flow...');
    
    // Wait for page to load and show onboarding
    await page.waitForLoadState('networkidle');
    
    // Check initial state
    const initialOnboardingState = await page.evaluate(() => {
      return localStorage.getItem('onboarding-complete');
    });
    expect(initialOnboardingState).toBeNull();
    console.log('✅ Initial state: onboarding not complete');
    
    // Look for the onboarding button
    const onboardingButton = page.locator('button:has-text("Start My Journey Now"), button:has-text("Starting Your Journey...")');
    await expect(onboardingButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Found onboarding button');
    
    // Get button text before clicking
    const buttonText = await onboardingButton.textContent();
    console.log('🔘 Button text:', buttonText);
    
    // Click the onboarding button
    await onboardingButton.click();
    console.log('👆 Clicked onboarding button');
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Check if localStorage was set
    const completionState = await page.evaluate(() => {
      return {
        onboardingComplete: localStorage.getItem('onboarding-complete'),
        userData: localStorage.getItem('user-data')
      };
    });
    
    expect(completionState.onboardingComplete).toBe('true');
    expect(completionState.userData).toBeTruthy();
    console.log('✅ localStorage set correctly:', completionState);
    
    // Wait for navigation to today screen
    await page.waitForTimeout(3000);
    
    // Check if we're now on the today screen (should not see onboarding anymore)
    const hasOnboardingButton = await page.locator('button:has-text("Start My Journey")').count();
    expect(hasOnboardingButton).toBe(0);
    console.log('✅ No longer showing onboarding screen');
    
    // Look for today screen elements
    const todayHeader = page.locator('h1:has-text("Today")');
    await expect(todayHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ Successfully navigated to Today screen');
  });

  test('should persist onboarding completion across page reloads', async ({ page }) => {
    console.log('🧪 Testing persistence across reloads...');
    
    // Complete onboarding first
    await page.waitForLoadState('networkidle');
    const onboardingButton = page.locator('button:has-text("Start My Journey Now")');
    await expect(onboardingButton).toBeVisible({ timeout: 10000 });
    await onboardingButton.click();
    await page.waitForTimeout(2000);
    
    // Verify completion
    const completionState = await page.evaluate(() => {
      return localStorage.getItem('onboarding-complete');
    });
    expect(completionState).toBe('true');
    console.log('✅ Initial completion verified');
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should not see onboarding screen after reload
    const hasOnboardingAfterReload = await page.locator('button:has-text("Start My Journey")').count();
    expect(hasOnboardingAfterReload).toBe(0);
    console.log('✅ Onboarding not shown after reload');
    
    // Should see today screen
    const todayHeader = page.locator('h1:has-text("Today")');
    await expect(todayHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ Today screen persisted after reload');
  });

  test('should create proper user data structure', async ({ page }) => {
    console.log('🧪 Testing user data creation...');
    
    await page.waitForLoadState('networkidle');
    const onboardingButton = page.locator('button:has-text("Start My Journey Now")');
    await expect(onboardingButton).toBeVisible({ timeout: 10000 });
    await onboardingButton.click();
    await page.waitForTimeout(2000);
    
    const userData = await page.evaluate(() => {
      const raw = localStorage.getItem('user-data');
      return raw ? JSON.parse(raw) : null;
    });
    
    expect(userData).toBeTruthy();
    expect(userData.experience).toBe('beginner');
    expect(userData.goal).toBe('habit');
    expect(userData.daysPerWeek).toBe(3);
    expect(userData.preferredTimes).toContain('morning');
    expect(userData.coachingStyle).toBe('supportive');
    
    console.log('✅ User data structure correct:', userData);
  });
});