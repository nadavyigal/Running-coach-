const { chromium } = require('playwright');

async function checkConsoleErrors() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    
    if (msg.type() === 'error') {
      errors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  // Collect network failures
  const networkErrors = [];
  page.on('response', response => {
    if (!response.ok()) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  console.log('🔍 Loading application at http://localhost:3003...');
  
  try {
    // Navigate to the application
    await page.goto('http://localhost:3003', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for potential hydration issues
    await page.waitForTimeout(5000);
    
    // Check if the page loaded successfully
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check for specific elements that should exist
    const bodyExists = await page.locator('body').count() > 0;
    console.log(`🏗️  Body element exists: ${bodyExists}`);
    
    // Check for React root
    const reactRoot = await page.locator('#__next').count() > 0;
    console.log(`⚛️  React root exists: ${reactRoot}`);
    
    // Check for main content
    const mainContent = await page.locator('main').count();
    console.log(`📝 Main content elements: ${mainContent}`);
    
    // Check for navigation
    const navigation = await page.locator('nav').count();
    console.log(`🧭 Navigation elements: ${navigation}`);
    
    // Check for buttons
    const buttons = await page.locator('button').count();
    console.log(`🔘 Button elements: ${buttons}`);
    
    // Test specific functionality
    console.log('\n🔍 Checking for race conditions...');
    
    // Look for active plan functionality
    try {
      const activePlanButton = await page.locator('text=Active Plan').first();
      if (await activePlanButton.count() > 0) {
        console.log('✅ Active Plan button found');
        await activePlanButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('⚠️  Active Plan interaction failed:', e.message);
    }
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`🌐 Current URL: ${currentUrl}`);
    
    // Take a screenshot for visual inspection
    await page.screenshot({ 
      path: 'debug-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as debug-screenshot.png');
    
  } catch (error) {
    console.error('❌ Navigation error:', error.message);
  }
  
  // Report findings
  console.log('\n📊 SUMMARY:');
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Console errors: ${errors.length}`);
  console.log(`Page errors: ${pageErrors.length}`);
  console.log(`Network errors: ${networkErrors.length}`);
  
  if (errors.length > 0) {
    console.log('\n🚨 CONSOLE ERRORS:');
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.text}`);
      if (error.location) {
        console.log(`   Location: ${error.location.url}:${error.location.lineNumber}`);
      }
    });
  }
  
  if (pageErrors.length > 0) {
    console.log('\n💥 PAGE ERRORS:');
    pageErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n')[1]}`);
      }
    });
  }
  
  if (networkErrors.length > 0) {
    console.log('\n🌐 NETWORK ERRORS:');
    networkErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.status} ${error.statusText} - ${error.url}`);
    });
  }
  
  if (consoleMessages.length > 0) {
    console.log('\n📝 ALL CONSOLE MESSAGES:');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
    });
  }
  
  await browser.close();
}

checkConsoleErrors().catch(console.error);