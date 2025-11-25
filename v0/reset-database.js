// Reset Database Utility
// Run this in the browser console to reset everything and see the onboarding

console.log('🔄 RunSmart Database Reset Utility');
console.log('This will clear all data and show the onboarding flow');

// Clear localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear IndexedDB
const clearIndexedDB = async () => {
  try {
    // Delete the database
    const deleteRequest = indexedDB.deleteDatabase('RunSmartDB');
    
    deleteRequest.onsuccess = function() {
      console.log('✅ IndexedDB cleared successfully');
      console.log('🔄 Please refresh the page to see the onboarding');
    };
    
    deleteRequest.onerror = function() {
      console.log('⚠️ Failed to clear IndexedDB, but localStorage is cleared');
      console.log('🔄 Please refresh the page to see the onboarding');
    };
  } catch (error) {
    console.log('⚠️ Error clearing IndexedDB:', error);
    console.log('🔄 Please refresh the page to see the onboarding');
  }
};

clearIndexedDB();

// Instructions
console.log('');
console.log('📋 Instructions:');
console.log('1. Wait for the database to be cleared');
console.log('2. Refresh the page (F5 or Ctrl+R)');
console.log('3. You should now see the onboarding flow');
console.log('');
console.log('If you still see loading issues:');
console.log('- Try opening in incognito/private mode');
console.log('- Clear browser cache and cookies');
console.log('- Try a different browser'); 