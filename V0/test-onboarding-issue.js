// Test script to reproduce onboarding issue
import { dbUtils } from './lib/dbUtils.js';

async function testOnboardingIssue() {
  console.log('🔍 Testing onboarding issue...');
  
  try {
    // Simulate a fresh user completing onboarding
    console.log('📋 Step 1: Creating test user...');
    
    const userId = await dbUtils.createUser({
      name: 'Test User',
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
      age: 25,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ Created test user with ID: ${userId}`);
    
    // Step 2: Try to ensure user has active plan
    console.log('📋 Step 2: Testing ensureUserHasActivePlan...');
    
    const plan = await dbUtils.ensureUserHasActivePlan(userId);
    
    console.log(`✅ Plan created successfully:`, {
      id: plan.id,
      title: plan.title,
      isActive: plan.isActive,
      totalWeeks: plan.totalWeeks
    });
    
    // Step 3: Verify the plan exists and is active
    console.log('📋 Step 3: Verifying active plan...');
    
    const activePlan = await dbUtils.getActivePlan(userId);
    
    if (activePlan) {
      console.log('✅ Active plan verification successful:', activePlan.title);
    } else {
      console.error('❌ No active plan found after creation!');
    }
    
    // Step 4: Clean up test data
    console.log('📋 Step 4: Cleaning up...');
    await dbUtils.deleteUser(userId);
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('❌ Stack trace:', error.stack);
  }
}

// Run the test
testOnboardingIssue().catch(console.error);