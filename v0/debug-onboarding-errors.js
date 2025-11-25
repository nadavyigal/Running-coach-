// Debug script for onboarding errors after database deletion
// Run this in the browser console to diagnose and fix issues

console.log('🔍 Starting onboarding error diagnosis...');

// 1. Check database state
async function checkDatabaseState() {
  try {
    console.log('📊 Checking database state...');
    
    // Check if database exists and is accessible
    const db = window.indexedDB.open('RunSmartDB');
    
    db.onsuccess = function(event) {
      console.log('✅ Database is accessible');
      const database = event.target.result;
      
      // Check if tables exist
      const tables = database.objectStoreNames;
      console.log('📋 Available tables:', Array.from(tables));
      
      // Check if users table has data
      const transaction = database.transaction(['users'], 'readonly');
      const userStore = transaction.objectStore('users');
      const userCount = userStore.count();
      
      userCount.onsuccess = function() {
        console.log(`👥 Users in database: ${userCount.result}`);
        
        if (userCount.result === 0) {
          console.log('⚠️ No users found - this is expected after database deletion');
          console.log('💡 The app should create a new user during onboarding');
        }
      };
      
      database.close();
    };
    
    db.onerror = function(event) {
      console.error('❌ Database access error:', event.target.error);
      console.log('💡 This might be causing the onboarding errors');
    };
    
  } catch (error) {
    console.error('❌ Error checking database state:', error);
  }
}

// 2. Check localStorage state
function checkLocalStorage() {
  console.log('💾 Checking localStorage...');
  
  const keys = Object.keys(localStorage);
  console.log('📋 localStorage keys:', keys);
  
  // Check for any onboarding-related data
  const onboardingKeys = keys.filter(key => 
    key.includes('onboarding') || 
    key.includes('user') || 
    key.includes('plan')
  );
  
  console.log('🎯 Onboarding-related localStorage keys:', onboardingKeys);
  
  if (onboardingKeys.length > 0) {
    console.log('⚠️ Found old onboarding data in localStorage');
    console.log('💡 This might be causing conflicts');
  }
}

// 3. Check for console errors
function checkConsoleErrors() {
  console.log('🚨 Checking for console errors...');
  
  // Override console.error to capture errors
  const originalError = console.error;
  const errors = [];
  
  console.error = function(...args) {
    errors.push(args.join(' '));
    originalError.apply(console, args);
  };
  
  // Wait a bit and then report
  setTimeout(() => {
    console.log(`📊 Captured ${errors.length} errors:`);
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    
    // Restore original console.error
    console.error = originalError;
  }, 2000);
}

// 4. Clear problematic data
function clearProblematicData() {
  console.log('🧹 Clearing potentially problematic data...');
  
  // Clear localStorage
  const keysToRemove = [
    'onboardingComplete',
    'currentUser',
    'userPreferences',
    'onboardingStep',
    'onboardingData'
  ];
  
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed ${key} from localStorage`);
    }
  });
  
  console.log('✅ Data cleanup completed');
}

// 5. Force database reset
async function forceDatabaseReset() {
  console.log('🔄 Force resetting database...');
  
  try {
    // Delete the database completely
    const deleteRequest = window.indexedDB.deleteDatabase('RunSmartDB');
    
    deleteRequest.onsuccess = function() {
      console.log('✅ Database deleted successfully');
      console.log('💡 Refresh the page to reinitialize the database');
    };
    
    deleteRequest.onerror = function() {
      console.error('❌ Failed to delete database');
    };
    
  } catch (error) {
    console.error('❌ Error during database reset:', error);
  }
}

// 6. Check React component errors
function checkReactErrors() {
  console.log('⚛️ Checking for React component errors...');
  
  // Look for error boundaries
  const errorBoundaries = document.querySelectorAll('[data-error-boundary]');
  console.log(`🛡️ Found ${errorBoundaries.length} error boundaries`);
  
  // Check for any error states in the DOM
  const errorElements = document.querySelectorAll('[data-error], .error, [role="alert"]');
  console.log(`⚠️ Found ${errorElements.length} error elements in DOM`);
  
  errorElements.forEach((element, index) => {
    console.log(`Error element ${index + 1}:`, element.textContent);
  });
}

// 7. Main diagnostic function
async function diagnoseOnboardingIssues() {
  console.log('🔍 Starting comprehensive onboarding diagnosis...');
  console.log('='.repeat(50));
  
  // Run all checks
  await checkDatabaseState();
  checkLocalStorage();
  checkConsoleErrors();
  checkReactErrors();
  
  console.log('='.repeat(50));
  console.log('📋 Diagnosis Summary:');
  console.log('1. Database state checked');
  console.log('2. localStorage checked');
  console.log('3. Console errors being monitored');
  console.log('4. React errors checked');
  console.log('');
  console.log('💡 If you see many errors, try:');
  console.log('   - Running clearProblematicData()');
  console.log('   - Running forceDatabaseReset() and refreshing');
  console.log('   - Check the browser console for specific error messages');
}

// 8. Quick fix function
async function quickFix() {
  console.log('🚀 Applying quick fix...');
  
  // Clear problematic data
  clearProblematicData();
  
  // Force database reset
  await forceDatabaseReset();
  
  console.log('✅ Quick fix applied!');
  console.log('🔄 Please refresh the page now');
}

// Export functions for manual use
window.debugOnboarding = {
  diagnose: diagnoseOnboardingIssues,
  clearData: clearProblematicData,
  resetDatabase: forceDatabaseReset,
  quickFix: quickFix,
  checkDatabase: checkDatabaseState,
  checkStorage: checkLocalStorage,
  checkErrors: checkConsoleErrors,
  checkReact: checkReactErrors
};

// Auto-run diagnosis
diagnoseOnboardingIssues();

console.log('🔧 Debug functions available:');
console.log('- debugOnboarding.diagnose() - Run full diagnosis');
console.log('- debugOnboarding.clearData() - Clear problematic data');
console.log('- debugOnboarding.resetDatabase() - Reset database');
console.log('- debugOnboarding.quickFix() - Apply quick fix'); 