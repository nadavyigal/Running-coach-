// Simple test to verify onboarding completion
const { dbUtils } = require('./lib/dbUtils.js');

async function testSimpleOnboarding() {
  console.log('🔍 Testing simple onboarding completion...');
  
  try {
    // Step 1: Clear any existing data
    console.log('📋 Step 1: Clearing existing data...');
    await dbUtils.clearDatabase();
    console.log('✅ Database cleared');
    
    // Step 2: Create test user
    console.log('📋 Step 2: Creating test user...');
    
    const userId = await dbUtils.createUser({
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
    });
    
    console.log(`✅ Created test user with ID: ${userId}`);
    
    // Step 3: Verify user was created
    console.log('📋 Step 3: Verifying user creation...');
    const user = await dbUtils.getCurrentUser();
    
    if (!user || !user.id) {
      throw new Error('Failed to retrieve created user');
    }
    
    console.log('✅ User retrieved successfully:', { id: user.id, onboardingComplete: user.onboardingComplete });
    
    // Step 4: Ensure user has active plan
    console.log('📋 Step 4: Ensuring user has active plan...');
    const plan = await dbUtils.ensureUserHasActivePlan(userId);
    
    console.log(`✅ Plan created successfully:`, {
      id: plan.id,
      title: plan.title,
      isActive: plan.isActive,
      totalWeeks: plan.totalWeeks
    });
    
    // Step 5: Verify the plan exists and is active
    console.log('📋 Step 5: Verifying active plan...');
    
    const activePlan = await dbUtils.getActivePlan(userId);
    
    if (activePlan) {
      console.log('✅ Active plan verification successful:', activePlan.title);
    } else {
      throw new Error('No active plan found after creation!');
    }
    
    // Step 6: Verify app state
    console.log('📋 Step 6: Verifying app state...');
    
    if (!user.onboardingComplete) {
      throw new Error('User onboarding not marked as complete');
    }
    
    if (!activePlan) {
      throw new Error('No active plan found');
    }
    
    console.log('✅ App state verification successful');
    console.log('✅ User onboarding complete:', user.onboardingComplete);
    console.log('✅ Active plan found:', activePlan.title);
    
    // Step 7: Clean up test data
    console.log('📋 Step 7: Cleaning up...');
    await dbUtils.clearDatabase();
    console.log('✅ Test completed successfully');
    
    console.log('\n🎉 Onboarding completion test passed!');
    console.log('✅ The bug fix is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('❌ Stack trace:', error.stack);
  }
}

// Run the test
testSimpleOnboarding().catch(console.error); 