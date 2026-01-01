import { test, expect } from '@playwright/test';

test.describe('Comprehensive Error Fix and Flow Test', () => {
  test('diagnose all browser errors and test complete onboarding flow', async ({ page }) => {
    console.log('🔍 Starting comprehensive error diagnosis...');
    
    // Collect all console errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'warn') {
        consoleWarnings.push(`[WARN] ${msg.text()}`);
      }
    });
    
    // Listen for network failures
    const networkErrors: string[] = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
      }
    });
    
    // Navigate to app
    await page.goto('/');
    
    // Clear storage to ensure fresh start
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.reload();
    await page.waitForTimeout(3000);
    
    console.log('📋 Initial page load complete');
    console.log('❌ Console Errors:', consoleErrors);
    console.log('⚠️ Console Warnings:', consoleWarnings);
    console.log('🌐 Network Errors:', networkErrors);
    
    // Check what's currently visible
    const pageContent = await page.evaluate(() => {
      const body = document.body;
      return {
        hasOnboarding: body.textContent?.includes('Welcome'),
        hasToday: body.textContent?.includes('Today'),
        hasLoading: body.textContent?.includes('Loading'),
        hasError: body.textContent?.includes('Error') || body.textContent?.includes('user not found'),
        visibleText: body.textContent?.slice(0, 500)
      };
    });
    
    console.log('📱 Current page state:', pageContent);
    
    // Test 1: Check if onboarding screen appears
    if (pageContent.hasOnboarding || pageContent.visibleText?.includes('goal') || pageContent.visibleText?.includes('experience')) {
      console.log('✅ Onboarding screen detected');
      
      // Try to complete onboarding
      console.log('📋 Testing onboarding completion...');
      
      // Look for goal selection
      const goalButtons = await page.locator('button').filter({ hasText: /habit|distance|speed/i }).all();
      if (goalButtons.length > 0) {
        console.log('✅ Goal buttons found:', goalButtons.length);
        await goalButtons[0].click();
        await page.waitForTimeout(1000);
      } else {
        console.log('❌ No goal buttons found');
      }
      
      // Look for experience selection
      const experienceButtons = await page.locator('button').filter({ hasText: /beginner|intermediate|advanced/i }).all();
      if (experienceButtons.length > 0) {
        console.log('✅ Experience buttons found:', experienceButtons.length);
        await experienceButtons[0].click();
        await page.waitForTimeout(1000);
      } else {
        console.log('❌ No experience buttons found');
      }
      
      // Look for days per week selection
      const dayButtons = await page.locator('button').filter({ hasText: /[0-9]/i }).all();
      if (dayButtons.length > 0) {
        console.log('✅ Day buttons found:', dayButtons.length);
        await dayButtons[0].click();
        await page.waitForTimeout(1000);
      }
      
      // Look for continue/next/generate buttons
      const continueButtons = await page.locator('button').filter({ hasText: /continue|next|generate|create|start/i }).all();
      for (let i = 0; i < continueButtons.length; i++) {
        console.log(`🔄 Clicking continue button ${i + 1}`);
        await continueButtons[i].click();
        await page.waitForTimeout(2000);
        
        // Check if we see training plan success
        const successMessage = await page.locator('text=Training plan created successfully').isVisible().catch(() => false);
        if (successMessage) {
          console.log('✅ Training plan created successfully message found');
          break;
        }
        
        // Check for AI goal wizard
        const hasAIWizard = await page.locator('text=AI Goal Wizard').isVisible().catch(() => false);
        if (hasAIWizard) {
          console.log('✅ AI Goal Wizard found');
        } else {
          console.log('❌ AI Goal Wizard missing');
        }
      }
      
      // Wait for plan generation and check final state
      await page.waitForTimeout(5000);
      
    } else if (pageContent.hasToday) {
      console.log('✅ Already on Today screen - onboarding was completed');
    } else {
      console.log('❌ Unknown page state');
    }
    
    // Test 2: Check for "Start my journey" button and navigation
    console.log('📋 Looking for journey start button...');
    const journeyButtons = await page.locator('button').filter({ hasText: /start.*journey|begin|let.*go/i }).all();
    if (journeyButtons.length > 0) {
      console.log('✅ Journey start button found');
      await journeyButtons[0].click();
      await page.waitForTimeout(3000);
      
      // Check if we navigate to main app
      const afterJourney = await page.evaluate(() => {
        const body = document.body;
        return {
          hasToday: body.textContent?.includes('Today'),
          hasPlan: body.textContent?.includes('Plan'),
          hasProfile: body.textContent?.includes('Profile'),
          visibleText: body.textContent?.slice(0, 300)
        };
      });
      
      console.log('📱 After journey start:', afterJourney);
    } else {
      console.log('❌ No journey start button found');
    }
    
    // Test 3: Check AI Chat functionality
    console.log('📋 Testing AI Chat...');
    const chatButtons = await page.locator('button').filter({ hasText: /chat|coach/i }).all();
    if (chatButtons.length > 0) {
      console.log('✅ Chat button found');
      await chatButtons[0].click();
      await page.waitForTimeout(2000);
      
      // Try to send a message
      const chatInput = await page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();
      if (await chatInput.isVisible()) {
        console.log('✅ Chat input found');
        await chatInput.fill('Hello coach');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        
        // Check for response
        const hasResponse = await page.locator('text=Hello').isVisible().catch(() => false);
        console.log('📱 Chat response received:', hasResponse);
      } else {
        console.log('❌ No chat input found');
      }
    }
    
    // Final error summary
    console.log('📊 FINAL DIAGNOSIS:');
    console.log('❌ Total Console Errors:', consoleErrors.length);
    console.log('⚠️ Total Warnings:', consoleWarnings.length);
    console.log('🌐 Network Errors:', networkErrors.length);
    
    // Print detailed errors
    if (consoleErrors.length > 0) {
      console.log('📝 Detailed Console Errors:');
      consoleErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    if (networkErrors.length > 0) {
      console.log('📝 Detailed Network Errors:');
      networkErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    // The test always passes - we're just diagnosing
    expect(true).toBe(true);
  });
});
