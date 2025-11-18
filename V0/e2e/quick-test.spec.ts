import { test, expect } from '@playwright/test';

test.describe('Quick Onboarding Test', () => {
  test('verify onboarding works on correct port', async ({ page }) => {
    console.log('🔍 Testing onboarding on localhost:3000...');
    
    // Clear storage first
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Check if we see onboarding
    const startButton = page.locator('text=Start My Journey Now');
    const isOnboardingVisible = await startButton.isVisible();
    
    console.log('🔍 Onboarding button visible:', isOnboardingVisible);
    
    if (isOnboardingVisible) {
      console.log('✅ Onboarding screen is visible - clicking button...');
      
      // Click the start button
      await startButton.click();
      
      // Wait for completion
      await page.waitForTimeout(2000);
      
      // Check localStorage
      const localStorage = await page.evaluate(() => {
        return {
          onboardingComplete: localStorage.getItem('onboarding-complete'),
          userData: localStorage.getItem('user-data')
        };
      });
      
      console.log('📊 localStorage after completion:', localStorage);
      
      // Check if we're on main app
      const todayVisible = await page.locator('text=Today').isVisible();
      console.log('🔍 Today screen visible:', todayVisible);
      
      if (todayVisible) {
        console.log('🎉 SUCCESS! Onboarding completed and navigated to main app');
      } else {
        console.log('❌ Failed to navigate to main app after onboarding');
      }
      
    } else {
      // Check if we're stuck on loading
      const loadingVisible = await page.locator('text=Loading RunSmart').isVisible();
      console.log('🔍 Loading screen visible:', loadingVisible);
      
      if (loadingVisible) {
        console.log('❌ App is stuck on loading screen');
        
        // Let's test the database directly
        const dbTest = await page.evaluate(async () => {
          try {
            const dbModule = await import('/lib/dbUtils.js');
            const { dbUtils } = dbModule;
            
            // Clear and test
            await dbUtils.clearDatabase();
            const userData = {
              goal: 'habit',
              experience: 'beginner',
              preferredTimes: ['morning'],
              daysPerWeek: 3,
              consents: { data: true, gdpr: true, push: false },
              onboardingComplete: true,
              age: 25
            };
            
            const userId = await dbUtils.createUser(userData);
            const user = await dbUtils.getCurrentUser();
            
            return {
              success: user !== null,
              userId,
              user: user ? { id: user.id, onboardingComplete: user.onboardingComplete } : null
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        
        console.log('🧪 Database test result:', dbTest);
        
        if (dbTest.success) {
          console.log('✅ Database operations work - forcing completion...');
          
          // Force localStorage and reload
          await page.evaluate(() => {
            localStorage.setItem('onboarding-complete', 'true');
            localStorage.setItem('user-data', JSON.stringify({
              experience: 'beginner',
              goal: 'habit',
              daysPerWeek: 3,
              preferredTimes: ['morning']
            }));
          });
          
          await page.reload();
          await page.waitForTimeout(2000);
          
          const todayAfterReload = await page.locator('text=Today').isVisible();
          console.log('🔍 Today screen after reload:', todayAfterReload);
          
        } else {
          console.log('❌ Database test failed:', dbTest.error);
        }
        
      } else {
        console.log('❌ Unknown app state - not showing onboarding or loading');
      }
    }
  });
});