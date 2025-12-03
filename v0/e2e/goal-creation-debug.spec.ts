import { test, expect } from '@playwright/test';

test.describe('Goal Creation Investigation', () => {
  test('should investigate goal creation flow and capture errors', async ({ page }) => {
    // Capture console logs and errors
    const consoleLogs: string[] = [];
    const errors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      console.log(`Browser console [${msg.type()}]:`, text);
    });

    page.on('pageerror', error => {
      errors.push(error.message);
      console.error('Page error:', error.message);
    });

    // Navigate to the app
    console.log('Navigating to app...');
    await page.goto('https://running-coach-60dhm7ppd-nadavyigal-gmailcoms-projects.vercel.app/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('Page loaded');

    // Look for Profile or Goals section
    // First, let's see what's on the page
    const pageContent = await page.textContent('body');
    console.log('Page contains "Profile":', pageContent?.includes('Profile'));
    console.log('Page contains "Goal":', pageContent?.includes('Goal'));

    // Try to find and click "Create" button for goals
    const createButtons = page.getByRole('button', { name: /create.*goal/i });
    const count = await createButtons.count();
    console.log(`Found ${count} "Create Goal" buttons`);

    if (count > 0) {
      // Click the first one
      console.log('Clicking "Create Goal" button...');
      await createButtons.first().click();

      // Wait a bit for modal to open
      await page.waitForTimeout(1000);

      // Check if modal opened
      const modalVisible = await page.getByRole('dialog').isVisible();
      console.log('Modal visible:', modalVisible);

      if (modalVisible) {
        console.log('Modal opened successfully');

        // Look for form fields
        const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i));
        const targetInput = page.getByLabel(/target/i).or(page.getByPlaceholder(/target/i));

        const hasTitleInput = await titleInput.count() > 0;
        const hasTargetInput = await targetInput.count() > 0;

        console.log('Has title input:', hasTitleInput);
        console.log('Has target input:', hasTargetInput);

        if (hasTitleInput && hasTargetInput) {
          // Fill out the form
          console.log('Filling out form...');
          await titleInput.first().fill('Test Goal - Run Faster');
          await targetInput.first().fill('25');

          // Try to find and set deadline
          const dateInputs = page.locator('input[type="date"]').or(page.getByLabel(/deadline/i));
          if (await dateInputs.count() > 0) {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const dateString = futureDate.toISOString().split('T')[0];
            await dateInputs.first().fill(dateString);
            console.log('Set deadline to:', dateString);
          } else {
            console.log('No date input found - checking for calendar picker');
            // Look for calendar/popover button
            const calendarButton = page.getByRole('button', { name: /deadline|calendar|date/i });
            if (await calendarButton.count() > 0) {
              await calendarButton.first().click();
              await page.waitForTimeout(500);
              // Click any future date in calendar
              const calendarDates = page.locator('[role="gridcell"]:not([aria-disabled="true"])');
              if (await calendarDates.count() > 0) {
                await calendarDates.first().click();
                console.log('Selected date from calendar');
              }
            }
          }

          await page.waitForTimeout(500);

          // Look for submit button
          const submitButton = page.getByRole('button', { name: /create.*goal|submit/i });
          const submitCount = await submitButton.count();
          console.log(`Found ${submitCount} submit buttons`);

          if (submitCount > 0) {
            const isDisabled = await submitButton.first().isDisabled();
            console.log('Submit button disabled:', isDisabled);

            if (!isDisabled) {
              console.log('Clicking submit button...');
              await submitButton.first().click();

              // Wait for any response
              await page.waitForTimeout(3000);

              // Check for success/error toasts
              const toasts = page.locator('[role="status"], [role="alert"], .toast');
              const toastCount = await toasts.count();
              console.log(`Found ${toastCount} toast notifications`);

              if (toastCount > 0) {
                for (let i = 0; i < toastCount; i++) {
                  const toastText = await toasts.nth(i).textContent();
                  console.log(`Toast ${i}:`, toastText);
                }
              }
            } else {
              console.log('Submit button is disabled - form validation failed');
              // Take a screenshot
              await page.screenshot({ path: 'goal-form-disabled.png', fullPage: true });
            }
          }
        }
      } else {
        console.log('Modal did not open');
      }
    } else {
      console.log('No "Create Goal" button found on page');
      // Take a screenshot to see what's on the page
      await page.screenshot({ path: 'page-state.png', fullPage: true });
    }

    // Log all captured console messages
    console.log('\n=== ALL CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));

    // Log all errors
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(err => console.error(err));
    } else {
      console.log('\n=== NO JAVASCRIPT ERRORS ===');
    }

    // Don't fail the test - we're just investigating
    expect(true).toBe(true);
  });
});
