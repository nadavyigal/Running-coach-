import { test, expect } from '@playwright/test';

test.describe('Running Coach Application Diagnosis', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('1. Check console errors on page load', async ({ page }) => {
    console.log('🔍 Testing console errors on page load...');
    
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
    
    // Capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // Load the page and wait for network idle
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more to capture any delayed errors
    await page.waitForTimeout(3000);
    
    console.log('📊 Console Errors:', consoleErrors);
    console.log('📊 Console Warnings:', consoleWarnings);
    console.log('📊 Page Errors:', pageErrors);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'diagnosis-page-load.png' });
    
    // Report findings
    expect(pageErrors.length).toBe(0); // No JavaScript errors should occur
  });

  test('2. Verify onboarding elements and goal wizard', async ({ page }) => {
    console.log('🔍 Testing onboarding elements...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if onboarding screen is visible
    const onboardingScreen = page.locator('[data-testid="onboarding-screen"], .onboarding-screen');
    const isOnboardingVisible = await onboardingScreen.count() > 0;
    console.log('🎯 Onboarding screen visible:', isOnboardingVisible);
    
    // Look for goal selection elements
    const goalElements = await page.locator('button:has-text("5K"), button:has-text("10K"), button:has-text("Half Marathon"), button:has-text("Marathon")').count();
    console.log('🎯 Goal selection buttons found:', goalElements);
    
    // Look for experience selection elements
    const experienceElements = await page.locator('button:has-text("Beginner"), button:has-text("Intermediate"), button:has-text("Advanced")').count();
    console.log('🎯 Experience selection buttons found:', experienceElements);
    
    // Look for AI goal wizard elements
    const goalWizardElements = await page.locator('[data-testid="goal-wizard"], .goal-wizard, .goal-discovery').count();
    console.log('🎯 AI Goal wizard elements found:', goalWizardElements);
    
    // Take screenshot
    await page.screenshot({ path: 'diagnosis-onboarding.png' });
    
    // Check what's actually visible on the page
    const pageContent = await page.textContent('body');
    console.log('📄 Page content preview:', pageContent?.substring(0, 500));
  });

  test('3. Test Start my journey button functionality', async ({ page }) => {
    console.log('🔍 Testing Start my journey button...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for start journey button with various possible texts
    const startButton = page.locator('button:has-text("Start my journey"), button:has-text("Start My Journey"), button:has-text("Begin Journey"), button:has-text("Get Started")').first();
    const buttonExists = await startButton.count() > 0;
    console.log('🔘 Start journey button exists:', buttonExists);
    
    if (buttonExists) {
      const buttonText = await startButton.textContent();
      console.log('🔘 Button text:', buttonText);
      
      // Check if button is enabled
      const isDisabled = await startButton.isDisabled();
      console.log('🔘 Button disabled:', isDisabled);
      
      if (!isDisabled) {
        // Try clicking the button
        await startButton.click();
        console.log('👆 Clicked start journey button');
        
        // Wait for potential navigation or state change
        await page.waitForTimeout(3000);
        
        // Check for success message
        const successMessage = await page.locator('text*="training plan created successfully", text*="success", text*="complete"').count();
        console.log('✅ Success message found:', successMessage > 0);
        
        // Check localStorage for completion state
        const storageState = await page.evaluate(() => ({
          onboardingComplete: localStorage.getItem('onboarding-complete'),
          userData: localStorage.getItem('user-data')
        }));
        console.log('💾 Storage state:', storageState);
        
        // Take screenshot after click
        await page.screenshot({ path: 'diagnosis-after-start-journey.png' });
      }
    }
  });

  test('4. Test AI coach chat functionality', async ({ page }) => {
    console.log('🔍 Testing AI coach chat...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for chat-related elements
    const chatButton = page.locator('button:has-text("Chat"), [data-testid="chat-button"], .chat-button').first();
    const chatExists = await chatButton.count() > 0;
    console.log('💬 Chat button exists:', chatExists);
    
    // Look for chat input field
    const chatInput = page.locator('input[placeholder*="chat"], textarea[placeholder*="chat"], input[placeholder*="message"], textarea[placeholder*="message"]').first();
    const chatInputExists = await chatInput.count() > 0;
    console.log('💬 Chat input exists:', chatInputExists);
    
    // Look for AI coach elements
    const coachElements = await page.locator('text="AI Coach"').or(page.locator('text="coach"')).or(page.locator('.coach')).count();
    console.log('🤖 AI Coach elements found:', coachElements);
    
    if (chatExists) {
      await chatButton.click();
      await page.waitForTimeout(1000);
      
      // Check if chat interface opened
      const chatInterface = await page.locator('.chat-interface, [data-testid="chat-interface"]').count();
      console.log('💬 Chat interface visible after click:', chatInterface > 0);
    }
    
    if (chatInputExists) {
      // Try to send a test message
      await chatInput.fill('Hello coach');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check for AI response
      const aiResponse = await page.locator('.ai-message, .coach-message, [data-role="assistant"]').count();
      console.log('🤖 AI response received:', aiResponse > 0);
    }
    
    await page.screenshot({ path: 'diagnosis-chat.png' });
  });

  test('5. Test navigation between main screens', async ({ page }) => {
    console.log('🔍 Testing main screen navigation...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // First, try to complete onboarding if needed
    const onboardingButton = page.locator('button:has-text("Start my journey"), button:has-text("Start My Journey")').first();
    const hasOnboarding = await onboardingButton.count() > 0;
    
    if (hasOnboarding) {
      console.log('🎯 Completing onboarding first...');
      await onboardingButton.click();
      await page.waitForTimeout(3000);
    }
    
    // Look for main navigation elements
    const todayButton = page.locator('button:has-text("Today"), nav a:has-text("Today"), [data-testid="today-nav"]').first();
    const planButton = page.locator('button:has-text("Plan"), button:has-text("My Plan"), nav a:has-text("Plan"), [data-testid="plan-nav"]').first();
    const profileButton = page.locator('button:has-text("Profile"), nav a:has-text("Profile"), [data-testid="profile-nav"]').first();
    
    const navElements = {
      today: await todayButton.count() > 0,
      plan: await planButton.count() > 0,
      profile: await profileButton.count() > 0
    };
    
    console.log('🧭 Navigation elements found:', navElements);
    
    // Try navigating to each screen
    if (navElements.today) {
      await todayButton.click();
      await page.waitForTimeout(1000);
      const todayScreen = await page.locator('h1:has-text("Today"), [data-testid="today-screen"]').count();
      console.log('📅 Today screen accessible:', todayScreen > 0);
      await page.screenshot({ path: 'diagnosis-today-screen.png' });
    }
    
    if (navElements.plan) {
      await planButton.click();
      await page.waitForTimeout(1000);
      const planScreen = await page.locator('h1:has-text("Plan"), h1:has-text("My Plan"), [data-testid="plan-screen"]').count();
      console.log('📋 Plan screen accessible:', planScreen > 0);
      await page.screenshot({ path: 'diagnosis-plan-screen.png' });
    }
    
    if (navElements.profile) {
      await profileButton.click();
      await page.waitForTimeout(1000);
      const profileScreen = await page.locator('h1:has-text("Profile"), [data-testid="profile-screen"]').count();
      console.log('👤 Profile screen accessible:', profileScreen > 0);
      await page.screenshot({ path: 'diagnosis-profile-screen.png' });
    }
  });

  test('6. Check for missing UI elements and functionality', async ({ page }) => {
    console.log('🔍 Checking for missing UI elements...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for key UI elements that should be present
    const uiElements = {
      logo: await page.locator('img[alt*="logo"], .logo, [data-testid="logo"]').count(),
      navigation: await page.locator('nav, .navigation, [data-testid="navigation"]').count(),
      buttons: await page.locator('button').count(),
      inputs: await page.locator('input, textarea').count(),
      headings: await page.locator('h1, h2, h3').count(),
      images: await page.locator('img').count()
    };
    
    console.log('🎨 UI Elements count:', uiElements);
    
    // Check for specific missing elements based on user report
    const specificElements = {
      goalWizard: await page.locator('[data-testid="goal-wizard"], .goal-wizard').count(),
      chatInterface: await page.locator('[data-testid="chat"], .chat').count(),
      onboardingFlow: await page.locator('[data-testid="onboarding"], .onboarding').count(),
      mainApp: await page.locator('[data-testid="main-app"], .main-app').count()
    };
    
    console.log('🎯 Specific Elements:', specificElements);
    
    // Check for error states
    const errorElements = {
      errorMessages: await page.locator('.error, [role="alert"], .alert-error').count(),
      notFound: await page.locator('text="not found"').or(page.locator('text="404"')).count(),
      loading: await page.locator('.loading, .spinner, [data-testid="loading"]').count()
    };
    
    console.log('❌ Error Elements:', errorElements);
    
    // Get all visible text content
    const allText = await page.textContent('body');
    const hasContent = allText && allText.trim().length > 0;
    console.log('📄 Page has content:', hasContent);
    console.log('📄 Content length:', allText?.length || 0);
    
    await page.screenshot({ path: 'diagnosis-full-page.png' });
    
    // Check if page is completely blank
    const bodyContent = await page.locator('body').innerHTML();
    console.log('🌐 Body HTML length:', bodyContent.length);
    
    if (bodyContent.length < 100) {
      console.log('⚠️ Page appears to be nearly empty');
      console.log('🔧 Body content:', bodyContent);
    }
  });

  test('7. Test full onboarding to main app flow', async ({ page }) => {
    console.log('🔍 Testing complete user flow...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('🎬 Starting complete flow test...');
    
    // Take initial screenshot
    await page.screenshot({ path: 'diagnosis-flow-start.png' });
    
    // Step 1: Check initial state
    const initialState = await page.evaluate(() => ({
      onboarding: localStorage.getItem('onboarding-complete'),
      url: window.location.href,
      title: document.title
    }));
    console.log('🎯 Initial state:', initialState);
    
    // Step 2: Look for any interactive elements
    const interactiveElements = {
      buttons: await page.locator('button:visible').count(),
      links: await page.locator('a:visible').count(),
      inputs: await page.locator('input:visible, textarea:visible').count()
    };
    console.log('🎮 Interactive elements:', interactiveElements);
    
    // Step 3: Try to find and interact with the first available button
    const firstButton = page.locator('button:visible').first();
    const hasButton = await firstButton.count() > 0;
    
    if (hasButton) {
      const buttonText = await firstButton.textContent();
      console.log('🔘 First button text:', buttonText);
      
      await firstButton.click();
      await page.waitForTimeout(2000);
      
      // Check what changed after click
      const afterClickState = await page.evaluate(() => ({
        onboarding: localStorage.getItem('onboarding-complete'),
        url: window.location.href,
        title: document.title
      }));
      console.log('🔄 State after button click:', afterClickState);
      
      await page.screenshot({ path: 'diagnosis-flow-after-click.png' });
    }
    
    // Step 4: Final state assessment
    const finalElements = {
      todayScreen: await page.locator('h1:has-text("Today"), [data-testid="today"]').count(),
      planScreen: await page.locator('h1:has-text("Plan"), [data-testid="plan"]').count(),
      profileScreen: await page.locator('h1:has-text("Profile"), [data-testid="profile"]').count(),
      onboardingStillVisible: await page.locator('button:has-text("Start"), .onboarding').count()
    };
    console.log('🏁 Final screen elements:', finalElements);
    
    await page.screenshot({ path: 'diagnosis-flow-end.png' });
  });
});