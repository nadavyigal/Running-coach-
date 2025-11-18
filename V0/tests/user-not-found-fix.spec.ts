import { test, expect } from '@playwright/test';

test.describe('User Not Found Bug Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('diagnose and fix user not found error', async ({ page }) => {
    console.log('🔍 Starting user not found diagnosis...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // Check if we're stuck on loading screen
    const loadingText = await page.locator('text=Loading RunSmart').isVisible();
    if (loadingText) {
      console.log('📍 App is stuck on loading screen');
    }
    
    // Get console logs to see what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Run the database test directly in the browser
    const testResult = await page.evaluate(async () => {
      try {
        console.log('🧪 Running emergency database test...');
        
        // Clear localStorage
        localStorage.clear();
        console.log('✅ localStorage cleared');
        
        // Import database
        const dbModule = await import('/lib/dbUtils.js');
        const { dbUtils } = dbModule;
        console.log('📦 Database module loaded');
        
        // Clear database
        await dbUtils.clearDatabase();
        console.log('✅ Database cleared');
        
        // Create user
        const userData = {
          goal: 'habit',
          experience: 'beginner',
          preferredTimes: ['morning'],
          daysPerWeek: 3,
          consents: { data: true, gdpr: true, push: false },
          onboardingComplete: true,
          age: 25
        };
        
        console.log('📋 Creating user with data:', userData);
        const userId = await dbUtils.createUser(userData);
        console.log('✅ User created with ID:', userId);
        
        // Try to get current user
        console.log('📋 Getting current user...');
        const user = await dbUtils.getCurrentUser();
        console.log('🔍 getCurrentUser result:', user);
        
        if (user) {
          return {
            success: true,
            message: 'User created and retrieved successfully',
            user: {
              id: user.id,
              onboardingComplete: user.onboardingComplete,
              goal: user.goal
            }
          };
        } else {
          // Check what's in the database
          const { getDatabase } = dbModule;
          const db = getDatabase();
          const allUsers = await db.users.toArray();
          console.log('📊 All users in database:', allUsers);
          
          return {
            success: false,
            message: 'User created but getCurrentUser returned null',
            debug: {
              allUsersCount: allUsers.length,
              firstUser: allUsers[0] || null
            }
          };
        }
        
      } catch (error) {
        console.error('❌ Test failed:', error);
        return {
          success: false,
          message: `Test failed: ${error.message}`,
          error: error.toString()
        };
      }
    });
    
    console.log('🔍 Test result:', testResult);
    
    // Log all console messages
    console.log('📜 Console logs:');
    consoleLogs.forEach(log => console.log(log));
    
    if (testResult.success) {
      console.log('🎉 Database operations work correctly!');
      
      // Now test if we can complete onboarding
      await page.evaluate(() => {
        localStorage.setItem('onboarding-complete', 'true');
      });
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Check if app shows main screen now
      const todayScreen = await page.locator('text=Today').isVisible();
      if (todayScreen) {
        console.log('✅ App successfully shows main screen after onboarding');
      } else {
        console.log('❌ App still not showing main screen');
      }
      
    } else {
      console.log('❌ Database operations failed:', testResult.message);
      console.log('🔍 Debug info:', testResult.debug);
      
      // This means we found the actual bug - let's report it
      throw new Error(`User not found bug confirmed: ${testResult.message}`);
    }
  });

  test('test onboarding completion flow', async ({ page }) => {
    console.log('🎓 Testing complete onboarding flow...');
    
    await page.goto('http://localhost:3000');
    
    // Wait for either loading screen or onboarding
    await page.waitForTimeout(3000);
    
    // Check if we see the simple onboarding test button
    const startButton = page.locator('text=Start My Journey Now');
    if (await startButton.isVisible()) {
      console.log('✅ Onboarding screen is visible');
      
      // Click the start button
      await startButton.click();
      
      // Wait for completion
      await page.waitForTimeout(2000);
      
      // Check if we navigate to main app
      const todayScreen = await page.locator('text=Today').isVisible();
      if (todayScreen) {
        console.log('✅ Onboarding completion successful - main app visible');
      } else {
        console.log('❌ Onboarding completion failed - still not on main app');
      }
      
    } else {
      console.log('❌ Onboarding screen not visible - app might be stuck');
    }
  });
});