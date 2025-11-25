// Reset Onboarding State Script
// This script clears all onboarding-related data to force the app to show onboarding

console.log('🔄 Resetting onboarding state...');

// Clear localStorage
try {
  localStorage.clear();
  console.log('✅ localStorage cleared');
} catch (error) {
  console.log('⚠️ localStorage clear failed:', error);
}

// Clear IndexedDB
try {
  const dbName = 'RunSmartDB';
  const request = indexedDB.deleteDatabase(dbName);
  
  request.onsuccess = () => {
    console.log('✅ IndexedDB cleared successfully');
    console.log('🔄 Reloading page to show onboarding...');
    window.location.reload();
  };
  
  request.onerror = () => {
    console.log('❌ Failed to clear IndexedDB');
    console.log('🔄 Reloading page anyway...');
    window.location.reload();
  };
} catch (error) {
  console.log('⚠️ IndexedDB clear failed:', error);
  console.log('🔄 Reloading page...');
  window.location.reload();
}

console.log('📝 Instructions:');
console.log('1. Open your browser to http://localhost:3000');
console.log('2. Open browser console (F12)');
console.log('3. Paste and run this script');
console.log('4. The app should reload and show onboarding'); 