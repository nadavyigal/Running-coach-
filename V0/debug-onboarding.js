// Quick test to reproduce onboarding completion issue
const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Starting onboarding debug test...');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: true,
    slowMo: 100 
  });
  
  const page = await browser.newPage();
  
  // Listen for console logs
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.text()}`);
  });
  
  // Navigate to the app
  console.log('🌐 Navigating to http://localhost:3002...');
  await page.goto('http://localhost:3002');
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  // Check initial localStorage state
  const initialOnboarding = await page.evaluate(() => {
    return localStorage.getItem('onboarding-complete');
  });
  console.log('📝 Initial localStorage onboarding-complete:', initialOnboarding);
  
  // Look for the onboarding button
  console.log('🔍 Looking for onboarding button...');
  await page.waitForSelector('button', { timeout: 5000 });
  
  // Get button text
  const buttonText = await page.evaluate(() => {
    const button = document.querySelector('button');
    return button ? button.textContent : null;
  });
  console.log('🔘 Found button with text:', buttonText);
  
  // Click the button
  console.log('👆 Clicking onboarding button...');
  await page.click('button');
  
  // Wait a moment for state changes
  await page.waitForTimeout(3000);
  
  // Check localStorage after click
  const afterClickOnboarding = await page.evaluate(() => {
    return localStorage.getItem('onboarding-complete');
  });
  console.log('📝 After click localStorage onboarding-complete:', afterClickOnboarding);
  
  // Check current URL and page content
  const currentUrl = page.url();
  console.log('🌐 Current URL:', currentUrl);
  
  // Check for today screen elements
  const hasBottomNav = await page.evaluate(() => {
    return document.querySelector('[data-testid="bottom-navigation"]') !== null;
  });
  console.log('🧭 Has bottom navigation (today screen indicator):', hasBottomNav);
  
  // Keep browser open for manual inspection
  console.log('🔍 Browser will stay open for manual inspection...');
  
  // Don't close automatically - let user inspect
  // await browser.close();
})().catch(console.error);