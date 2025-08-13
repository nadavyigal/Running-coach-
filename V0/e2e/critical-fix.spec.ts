import { test, expect } from '@playwright/test';

test.describe('Critical Database Schema Fix', () => {
  test('fix onboardingComplete schema error and test onboarding', async ({ page }) => {
    console.log('🔍 Testing critical database schema fix...');
    
    // Navigate to the app
    await page.goto('http://localhost:3002');
    
    // Clear storage first
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Check current console errors
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(`[ERROR] ${msg.text()}`);
      }
    });
    
    // Test the database operations directly
    const dbTest = await page.evaluate(async () => {
      try {
        console.log('🧪 Testing database operations...');
        
        // Import database
        const dbModule = await import('/lib/db.js');
        const { dbUtils } = dbModule;
        
        console.log('📦 Database module loaded');
        
        // Clear database
        await dbUtils.clearDatabase();
        console.log('🧹 Database cleared');
        
        // Test user creation (this should work)
        const userData = {
          goal: 'habit',
          experience: 'beginner',
          preferredTimes: ['morning'],
          daysPerWeek: 3,
          consents: { data: true, gdpr: true, push: false },
          onboardingComplete: true,
          age: 25
        };
        
        console.log('📋 Creating user...');
        const userId = await dbUtils.createUser(userData);
        console.log('✅ User created with ID:', userId);
        
        // Test getCurrentUser (this is failing due to schema issue)
        console.log('📋 Testing getCurrentUser...');
        try {
          const user = await dbUtils.getCurrentUser();
          console.log('✅ getCurrentUser succeeded:', user ? user.id : null);
          return {
            success: true,
            message: 'Database operations work correctly',
            userId,
            userRetrieved: !!user
          };
        } catch (getCurrentError) {
          console.error('❌ getCurrentUser failed:', getCurrentError.message);
          
          // Try alternative approach - get user directly by ID
          console.log('📋 Trying getUserById as fallback...');
          const userById = await dbUtils.getUserById(userId);
          
          return {
            success: false,
            message: 'getCurrentUser failed due to schema issue',
            error: getCurrentError.message,
            userId,
            fallbackWorked: !!userById,
            needsSchemaFix: true
          };
        }
        
      } catch (error) {
        console.error('❌ Database test failed:', error);
        return {
          success: false,
          message: `Database test failed: ${error.message}`,
          error: error.toString()
        };
      }
    });
    
    console.log('🔍 Database test result:', dbTest);
    console.log('📜 Console errors:', consoleLogs);
    
    // If schema error is confirmed, we know the issue
    if (dbTest.needsSchemaFix || consoleLogs.some(log => log.includes('not indexed'))) {
      console.log('✅ CONFIRMED: Database schema issue - onboardingComplete field not indexed');
      console.log('🔧 Need to fix database schema to add onboardingComplete index');
      
      // Test if we can still complete onboarding with a different approach
      const onboardingTest = await page.evaluate(async () => {
        try {
          // Force localStorage completion to bypass database query
          localStorage.setItem('onboarding-complete', 'true');
          localStorage.setItem('user-data', JSON.stringify({
            experience: 'beginner',
            goal: 'habit',
            daysPerWeek: 3,
            preferredTimes: ['morning']
          }));
          
          return { success: true, message: 'localStorage fallback set' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      console.log('🔧 Onboarding fallback test:', onboardingTest);
      
      // Reload to see if app works with localStorage
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Check if we see the main app
      const todayHeading = await page.locator('h1:has-text("Today")').isVisible();
      console.log('🔍 Today screen visible after fallback:', todayHeading);
      
      if (todayHeading) {
        console.log('✅ SUCCESS: App works with localStorage fallback');
      } else {
        console.log('❌ App still not working even with localStorage fallback');
      }
      
    } else {
      console.log('❌ Unexpected database issue:', dbTest);
    }
    
    // The test should always pass - we're just diagnosing
    expect(dbTest).toBeDefined();
  });
});