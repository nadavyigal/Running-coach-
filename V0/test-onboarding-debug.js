// Test script to debug onboarding completion issue
import { dbUtils } from './lib/db.js';

async function testOnboardingDebug() {
  console.log('🔍 Testing onboarding completion issue...');
  
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
    console.log('✅ User retrieved:', { id: user?.id, onboardingComplete: user?.onboardingComplete });
    
    // Step 4: Test plan creation
    console.log('📋 Step 4: Testing plan creation...');
    const plan = await dbUtils.ensureUserHasActivePlan(userId);
    console.log('✅ Plan created:', { id: plan.id, title: plan.title, isActive: plan.isActive });
    
    // Step 5: Verify active plan
    console.log('📋 Step 5: Verifying active plan...');
    const activePlan = await dbUtils.getActivePlan(userId);
    if (activePlan) {
      console.log('✅ Active plan found:', activePlan.title);
    } else {
      console.error('❌ No active plan found!');
    }
    
    // Step 6: Test workout retrieval
    console.log('📋 Step 6: Testing workout retrieval...');
    const workouts = await dbUtils.getWorkoutsByPlan(plan.id);
    console.log(`✅ Found ${workouts.length} workouts for plan`);
    
    // Step 7: Test today's workout
    console.log('📋 Step 7: Testing today\'s workout...');
    const todaysWorkout = await dbUtils.getTodaysWorkout(userId);
    if (todaysWorkout) {
      console.log('✅ Today\'s workout found:', todaysWorkout.type);
    } else {
      console.log('⚠️ No workout scheduled for today');
    }
    
    // Step 8: Validate plan integrity
    console.log('📋 Step 8: Validating plan integrity...');
    const validation = await dbUtils.validateUserPlanIntegrity(userId);
    console.log('✅ Plan validation:', validation);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOnboardingDebug().catch(console.error); 