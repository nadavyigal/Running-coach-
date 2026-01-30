import { test, expect } from '@playwright/test';

// Use the existing dev server on port 3001
const BASE_URL = 'http://localhost:3001';

test.describe('Onboarding Screen Design', () => {
  test('should display intro screen with correct design elements on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to onboarding
    await page.goto(BASE_URL);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check for step indicator
    const stepIndicator = page.getByText('Step 1 of 4');
    await expect(stepIndicator).toBeVisible();

    // Check for main headline
    const headline = page.getByText(/LET'S CRUSH YOUR NEXT GOAL/i);
    await expect(headline).toBeVisible();

    // Check for subtitle
    const subtitle = page.getByText(/Tell me about your running style/i);
    await expect(subtitle).toBeVisible();

    // Check for feature icons labels
    await expect(page.getByText('AI Powered')).toBeVisible();
    await expect(page.getByText('Flexible Sched')).toBeVisible();
    await expect(page.getByText('Goal Oriented')).toBeVisible();

    // Check for RunSmart branding
    const branding = page.getByRole('heading', { name: /RunSmart/i });
    await expect(branding).toBeVisible();

    const tagline = page.getByText('Your AI Running Coach');
    await expect(tagline).toBeVisible();

    // Check for Continue button
    const continueButton = page.getByRole('button', { name: /Continue/i });
    await expect(continueButton).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'test-results/onboarding-intro-mobile.png',
      fullPage: true
    });

    console.log('✅ All design elements are present and visible');
  });

  test('should display intro screen on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Navigate to onboarding
    await page.goto(BASE_URL);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check main elements are visible
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await expect(page.getByText(/LET'S CRUSH YOUR NEXT GOAL/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'test-results/onboarding-intro-tablet.png',
      fullPage: true
    });

    console.log('✅ Tablet layout verified');
  });

  test('should have correct button styling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const continueButton = page.getByRole('button', { name: /Continue/i });

    // Check button is visible and enabled
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeEnabled();

    // Get computed styles to verify blue background
    const buttonColor = await continueButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Button background color:', buttonColor);

    // Verify it's a blue color (rgb values)
    expect(buttonColor).toContain('14, 165, 233'); // #0EA5E9
  });
});
