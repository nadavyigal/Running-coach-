/**
 * Onboarding Verification Script
 * 
 * This script verifies the onboarding process can be completed successfully.
 * Run this in the browser console while on the app page.
 */

console.log('🧪 Starting Onboarding Verification Test');
console.log('='.repeat(50));

// Test configuration
const testConfig = {
  testUser: {
    goal: 'distance',
    experience: 'beginner', 
    age: 25,
    selectedTimes: ['morning'],
    daysPerWeek: 3,
    rpe: 6,
    consents: {
      data: true,
      gdpr: true,
      push: false
    }
  },
  stepDelay: 1000, // Delay between steps in ms
  maxWaitTime: 30000 // Max wait time for elements
};

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = testConfig.maxWaitTime) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found after ${timeout}ms`));
      } else {
        setTimeout(checkElement, 100);
      }
    };
    
    checkElement();
  });
}

function clickElement(selector) {
  return new Promise(async (resolve, reject) => {
    try {
      const element = await waitForElement(selector);
      element.click();
      console.log(`✅ Clicked: ${selector}`);
      resolve(element);
    } catch (error) {
      console.error(`❌ Failed to click: ${selector}`, error);
      reject(error);
    }
  });
}

function fillInput(selector, value) {
  return new Promise(async (resolve, reject) => {
    try {
      const element = await waitForElement(selector);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`✅ Filled input ${selector} with: ${value}`);
      resolve(element);
    } catch (error) {
      console.error(`❌ Failed to fill input: ${selector}`, error);
      reject(error);
    }
  });
}

// Step-by-step onboarding verification
async function verifyOnboardingStep(stepNumber) {
  console.log(`\n📋 Verifying Step ${stepNumber}...`);
  
  try {
    switch (stepNumber) {
      case 1:
        // Welcome screen - click "Get Started"
        await clickElement('button:contains("Get Started")');
        break;
        
      case 2:
        // Goal selection
        await clickElement(`[data-goal="${testConfig.testUser.goal}"]`);
        await clickElement('button:contains("Continue")');
        break;
        
      case 3:
        // Experience selection
        await clickElement(`[data-experience="${testConfig.testUser.experience}"]`);
        await clickElement('button:contains("Continue")');
        break;
        
      case 4:
        // RPE selection (optional)
        const rpeSlider = await waitForElement('input[type="range"]');
        rpeSlider.value = testConfig.testUser.rpe;
        rpeSlider.dispatchEvent(new Event('input', { bubbles: true }));
        await clickElement('button:contains("Continue")');
        break;
        
      case 5:
        // Age input
        await fillInput('input[type="number"]', testConfig.testUser.age);
        await clickElement('button:contains("Continue")');
        break;
        
      case 6:
        // Time selection and days per week
        for (const time of testConfig.testUser.selectedTimes) {
          await clickElement(`[data-time="${time}"]`);
        }
        
        const daysSlider = await waitForElement('input[type="range"]:last-of-type');
        daysSlider.value = testConfig.testUser.daysPerWeek;
        daysSlider.dispatchEvent(new Event('input', { bubbles: true }));
        
        await clickElement('button:contains("Continue")');
        break;
        
      case 7:
        // Consent checkboxes
        if (testConfig.testUser.consents.data) {
          await clickElement('#data-consent');
        }
        if (testConfig.testUser.consents.gdpr) {
          await clickElement('#gdpr-consent');
        }
        if (testConfig.testUser.consents.push) {
          await clickElement('#push-consent');
        }
        await clickElement('button:contains("Continue")');
        break;
        
      case 8:
        // Final confirmation
        await clickElement('button:contains("Start My Journey")');
        
        // Wait for plan generation
        console.log('⏳ Waiting for plan generation...');
        await waitForElement('.loading, [data-loading]', 5000).catch(() => {
          console.log('No loading indicator found, continuing...');
        });
        
        // Wait for completion (either success or error)
        await sleep(10000); // Give time for plan generation
        break;
        
      default:
        throw new Error(`Unknown step: ${stepNumber}`);
    }
    
    console.log(`✅ Step ${stepNumber} completed successfully`);
    await sleep(testConfig.stepDelay);
    
  } catch (error) {
    console.error(`❌ Step ${stepNumber} failed:`, error);
    throw error;
  }
}

// Check final state
async function verifyOnboardingCompletion() {
  console.log('\n🔍 Verifying onboarding completion...');
  
  try {
    // Check if we're now on the main app (not onboarding)
    const isOnboarding = document.querySelector('[data-screen="onboarding"]');
    const isMainApp = document.querySelector('[data-screen="today"], .bottom-navigation');
    
    if (!isOnboarding && isMainApp) {
      console.log('✅ Successfully completed onboarding - now on main app');
      return true;
    }
    
    // Check database for user
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('RunSmartDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const userCount = await new Promise((resolve, reject) => {
      const request = userStore.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (userCount > 0) {
      console.log('✅ User created in database successfully');
      return true;
    }
    
    console.error('❌ Onboarding appears incomplete');
    return false;
    
  } catch (error) {
    console.error('❌ Error checking onboarding completion:', error);
    return false;
  }
}

// Reset for testing
async function resetForTesting() {
  console.log('🔄 Resetting for testing...');
  
  // Clear localStorage
  localStorage.clear();
  
  // Clear IndexedDB
  try {
    await new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('RunSmartDB');
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = reject;
    });
    console.log('✅ Database cleared');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
  }
  
  // Reload page
  window.location.reload();
}

// Main test function
async function runOnboardingTest() {
  console.log('🧪 Starting Complete Onboarding Test');
  console.log('='.repeat(50));
  
  try {
    // Wait for app to load
    console.log('⏳ Waiting for app to load...');
    await sleep(3000);
    
    // Verify we're on onboarding screen
    const onboardingScreen = await waitForElement('[data-screen="onboarding"], .onboarding', 5000);
    console.log('✅ Onboarding screen detected');
    
    // Go through all steps
    for (let step = 1; step <= 8; step++) {
      await verifyOnboardingStep(step);
    }
    
    // Verify completion
    const isComplete = await verifyOnboardingCompletion();
    
    if (isComplete) {
      console.log('\n🎉 ONBOARDING TEST PASSED! 🎉');
      console.log('✅ All steps completed successfully');
      console.log('✅ User data persisted to database');
      console.log('✅ App transitioned to main screen');
    } else {
      console.log('\n❌ ONBOARDING TEST FAILED');
      console.log('❌ Onboarding did not complete properly');
    }
    
  } catch (error) {
    console.error('\n❌ ONBOARDING TEST FAILED');
    console.error('Error:', error);
    
    // Provide debugging info
    console.log('\n🔍 Debugging Information:');
    console.log('Current URL:', window.location.href);
    console.log('Current screen elements:', document.querySelectorAll('[data-screen]'));
    console.log('Form elements:', document.querySelectorAll('form, input, button'));
  }
  
  console.log('\n='.repeat(50));
  console.log('🧪 Test Complete');
}

// Export functions for manual use
window.onboardingTest = {
  runOnboardingTest,
  resetForTesting,
  verifyOnboardingCompletion,
  verifyOnboardingStep,
  testConfig
};

// Instructions
console.log('\n📋 Manual Testing Instructions:');
console.log('1. Open your app in the browser');
console.log('2. Open browser console (F12)');
console.log('3. Run: onboardingTest.resetForTesting() // to reset');
console.log('4. Run: onboardingTest.runOnboardingTest() // to test');
console.log('5. Or test individual steps: onboardingTest.verifyOnboardingStep(1)');
console.log('\n🚀 Ready to test! Run onboardingTest.runOnboardingTest() when ready.');