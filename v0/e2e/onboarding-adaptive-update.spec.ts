import { test, expect } from '@playwright/test';
import { testDataFactory } from './utils/test-data-factory';

test.describe('Onboarding to First Adaptive Update E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data and start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase('running-coach-db');
    });
  });

  test('Scenario 1: Beginner Runner - Conservative Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile();
    const runData = testDataFactory.createBeginnerRun();

    // Step 1: Complete onboarding wizard
    await page.goto('/onboarding');
    await expect(page.getByText('Welcome to Run-Smart')).toBeVisible();
    
    // Fill onboarding form
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('Goal').selectOption('habit');
    await page.getByLabel('Days per Week').selectOption('3');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Complete onboarding
    await page.getByRole('button', { name: 'Finish Setup' }).click();
    
    // Verify onboarding completion
    await expect(page.getByText('Welcome to your personalized training plan')).toBeVisible();
    await expect(page.getByText('Your initial plan is ready')).toBeVisible();

    // Step 2: Verify initial training plan
    await page.goto('/today');
    await expect(page.getByText('Today\'s Workout')).toBeVisible();
    await expect(page.getByText('Easy Run')).toBeVisible();
    
    // Step 3: Record first run
    await page.getByRole('button', { name: 'Record Run' }).click();
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    await page.getByRole('button', { name: 'Save Run' }).click();
    
    // Verify run is recorded
    await expect(page.getByText('Run recorded successfully')).toBeVisible();
    await expect(page.getByText(`${runData.distance}km`)).toBeVisible();

    // Step 4: Wait for adaptive update (simulate processing time)
    await page.waitForTimeout(2000);
    
    // Step 5: Verify adaptive update notification
    await expect(page.getByText('Your plan has been updated')).toBeVisible();
    await expect(page.getByText('Based on your first run')).toBeVisible();
    
    // Step 6: Verify updated plan
    await page.getByRole('button', { name: 'View Updated Plan' }).click();
    await expect(page.getByText('Updated Training Plan')).toBeVisible();
    
    // Verify conservative adjustments for beginner
    const planText = await page.textContent('body');
    expect(planText).toContain('Easy Run');
    expect(planText).toContain('Recovery');
    expect(planText).not.toContain('Tempo');
    expect(planText).not.toContain('Intervals');
  });

  test('Scenario 2: Intermediate Runner - Moderate Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createIntermediateProfile();
    const runData = testDataFactory.createIntermediateRun();

    // Complete onboarding
    await page.goto('/onboarding');
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByLabel('Goal').selectOption('performance');
    await page.getByLabel('Days per Week').selectOption('4');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    // Record intermediate run
    await page.goto('/record');
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    await page.getByRole('button', { name: 'Save Run' }).click();

    // Wait for adaptive update
    await page.waitForTimeout(2000);
    
    // Verify moderate adjustments
    await expect(page.getByText('Your plan has been updated')).toBeVisible();
    await page.getByRole('button', { name: 'View Updated Plan' }).click();
    
    const planText = await page.textContent('body');
    expect(planText).toContain('Tempo Run');
    expect(planText).toContain('Long Run');
    expect(planText).toContain('Recovery');
  });

  test('Scenario 3: Advanced Runner - Aggressive Adjustment', async ({ page }) => {
    const userProfile = testDataFactory.createAdvancedProfile();
    const runData = testDataFactory.createAdvancedRun();

    // Complete onboarding
    await page.goto('/onboarding');
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption('advanced');
    await page.getByLabel('Goal').selectOption('race');
    await page.getByLabel('Days per Week').selectOption('5');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    // Record advanced run
    await page.goto('/record');
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    await page.getByRole('button', { name: 'Save Run' }).click();

    // Wait for adaptive update
    await page.waitForTimeout(2000);
    
    // Verify aggressive adjustments
    await expect(page.getByText('Your plan has been updated')).toBeVisible();
    await page.getByRole('button', { name: 'View Updated Plan' }).click();
    
    const planText = await page.textContent('body');
    expect(planText).toContain('Intervals');
    expect(planText).toContain('Tempo Run');
    expect(planText).toContain('Long Run');
    expect(planText).toContain('Race Pace');
  });

  test('Scenario 4: Edge Case - Very Slow Run', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile();
    const runData = testDataFactory.createSlowRun();

    // Complete onboarding
    await page.goto('/onboarding');
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('Goal').selectOption('habit');
    await page.getByLabel('Days per Week').selectOption('3');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    // Record very slow run
    await page.goto('/record');
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    await page.getByRole('button', { name: 'Save Run' }).click();

    // Wait for adaptive update
    await page.waitForTimeout(2000);
    
    // Verify supportive adjustments for struggling user
    await expect(page.getByText('Your plan has been updated')).toBeVisible();
    await page.getByRole('button', { name: 'View Updated Plan' }).click();
    
    const planText = await page.textContent('body');
    expect(planText).toContain('Easy Walk/Run');
    expect(planText).toContain('Recovery');
    expect(planText).not.toContain('Tempo');
  });

  test('Data Integrity - Verify No Data Loss', async ({ page }) => {
    const userProfile = testDataFactory.createBeginnerProfile();
    const runData = testDataFactory.createBeginnerRun();

    // Complete onboarding and record run
    await page.goto('/onboarding');
    await page.getByLabel('Name').fill(userProfile.name);
    await page.getByLabel('Experience Level').selectOption('beginner');
    await page.getByLabel('Goal').selectOption('habit');
    await page.getByLabel('Days per Week').selectOption('3');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    await page.goto('/record');
    await page.getByLabel('Distance (km)').fill(runData.distance.toString());
    await page.getByLabel('Duration (minutes)').fill(runData.duration.toString());
    await page.getByLabel('Pace (min/km)').fill(runData.pace.toString());
    await page.getByRole('button', { name: 'Save Run' }).click();

    // Wait for adaptive update
    await page.waitForTimeout(2000);

    // Verify data persistence
    await page.goto('/profile');
    await expect(page.getByText(userProfile.name)).toBeVisible();
    await expect(page.getByText('beginner')).toBeVisible();
    await expect(page.getByText('habit')).toBeVisible();

    await page.goto('/history');
    await expect(page.getByText(`${runData.distance}km`)).toBeVisible();
    await expect(page.getByText(`${runData.duration}min`)).toBeVisible();

    // Verify plan versioning
    await page.goto('/plan');
    await expect(page.getByText('Updated Training Plan')).toBeVisible();
    await expect(page.getByText('Version 2')).toBeVisible();
  });

  test('Performance - Response Time < 30 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    // Complete full journey
    await page.goto('/onboarding');
    await page.getByLabel('Name').fill('Performance Test User');
    await page.getByLabel('Experience Level').selectOption('intermediate');
    await page.getByLabel('Goal').selectOption('performance');
    await page.getByLabel('Days per Week').selectOption('4');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    await page.goto('/record');
    await page.getByLabel('Distance (km)').fill('5');
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByLabel('Pace (min/km)').fill('6');
    await page.getByRole('button', { name: 'Save Run' }).click();

    // Wait for adaptive update
    await page.waitForTimeout(2000);
    await expect(page.getByText('Your plan has been updated')).toBeVisible();

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    expect(totalTime).toBeLessThan(30);
  });
}); 