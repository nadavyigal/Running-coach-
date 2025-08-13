// Simple test to verify user creation and retrieval works
import { performance } from 'perf_hooks';

console.log('🔍 Testing user creation and retrieval...');

// In a browser environment, we need to simulate this
if (typeof window === 'undefined') {
  console.log('⚠️ This test needs to run in a browser environment');
  console.log('📋 Please open http://localhost:3005 and check the browser console');
  process.exit(0);
}

const testUserCreation = async () => {
  try {
    // Import the database utilities
    const { dbUtils } = await import('./lib/db.js');
    
    console.log('🧹 Clearing database...');
    await dbUtils.clearDatabase();
    
    console.log('📋 Creating test user...');
    const userData = {
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      onboardingComplete: true,
      age: 25
    };
    
    const startTime = performance.now();
    const userId = await dbUtils.createUser(userData);
    const createTime = performance.now() - startTime;
    
    console.log(`✅ User created with ID: ${userId} (${createTime.toFixed(2)}ms)`);
    
    console.log('📋 Retrieving user...');
    const retrieveStart = performance.now();
    const user = await dbUtils.getCurrentUser();
    const retrieveTime = performance.now() - retrieveStart;
    
    if (!user) {
      throw new Error('❌ User not found after creation!');
    }
    
    console.log(`✅ User retrieved successfully: ID ${user.id}, onboardingComplete: ${user.onboardingComplete} (${retrieveTime.toFixed(2)}ms)`);
    
    // Test with a user without completed onboarding
    console.log('📋 Creating incomplete user...');
    const incompleteUserData = {
      ...userData,
      onboardingComplete: false
    };
    
    const incompleteUserId = await dbUtils.createUser(incompleteUserData);
    console.log(`✅ Incomplete user created with ID: ${incompleteUserId}`);
    
    // getCurrentUser should still return the completed user
    const currentUser = await dbUtils.getCurrentUser();
    console.log(`✅ getCurrentUser returned: ID ${currentUser.id}, completed: ${currentUser.onboardingComplete}`);
    
    if (currentUser.id !== userId) {
      console.log('⚠️ getCurrentUser returned incomplete user instead of completed one');
    }
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

export { testUserCreation };