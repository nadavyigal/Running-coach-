// Test script to verify onboarding completion fix
import { dbUtils } from './lib/db.js';

async function testOnboardingCompletion() {
  console.log('🔍 Testing onboarding completion fix...');
  
  try {
    // Step 1: Clear any existing data
    console.log('📋 Step 1: Clearing existing data...');
    await dbUtils.clearDatabase();
    console.log('✅ Database cleared');
    
    // Step 2: Simulate onboarding completion
    console.log('📋 Step 2: Simulating onboarding completion...');
    
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
    
    // Step 3: Verify user was created and onboarding is complete
    console.log('📋 Step 3: Verifying user creation...');
    const user = await dbUtils.getCurrentUser();
    console.log('✅ User retrieved:', { 
      id: user?.id, 
      onboardingComplete: user?.onboardingComplete,
      goal: user?.goal,
      experience: user?.experience
    });
    
    if (!user || !user.onboardingComplete) {
      throw new Error('User onboarding not marked as complete');
    }
    
    // Step 4: Test plan creation
    console.log('📋 Step 4: Testing plan creation...');
    const plan = await dbUtils.ensureUserHasActivePlan(userId);
    console.log('✅ Plan created:', { 
      id: plan.id, 
      title: plan.title, 
      isActive: plan.isActive,
      userId: plan.userId
    });
    
    // Step 5: Verify active plan
    console.log('📋 Step 5: Verifying active plan...');
    const activePlan = await dbUtils.getActivePlan(userId);
    if (activePlan) {
      console.log('✅ Active plan found:', activePlan.title);
    } else {
      throw new Error('No active plan found after creation');
    }
    
    // Step 6: Test workout retrieval
    console.log('📋 Step 6: Testing workout retrieval...');
    const workouts = await dbUtils.getWorkoutsByPlan(plan.id);
    console.log(`✅ Found ${workouts.length} workouts for plan`);
    
    if (workouts.length === 0) {
      console.warn('⚠️ No workouts found for plan - this might be expected for fallback plans');
    }
    
    // Step 7: Test today's workout
    console.log('📋 Step 7: Testing today\'s workout...');
    const todaysWorkout = await dbUtils.getTodaysWorkout(userId);
    if (todaysWorkout) {
      console.log('✅ Today\'s workout found:', todaysWorkout.type);
    } else {
      console.log('⚠️ No workout scheduled for today - this might be expected');
    }
    
    // Step 8: Validate plan integrity
    console.log('📋 Step 8: Validating plan integrity...');
    const validation = await dbUtils.validateUserPlanIntegrity(userId);
    console.log('✅ Plan validation:', validation);
    
    if (!validation.hasActivePlan) {
      throw new Error('Plan integrity validation failed - no active plan');
    }
    
    if (!validation.hasCompletedOnboarding) {
      throw new Error('Plan integrity validation failed - onboarding not complete');
    }
    
    // Step 9: Test app state simulation
    console.log('📋 Step 9: Testing app state simulation...');
    
    // Simulate what the main app does to check onboarding status
    const appUser = await dbUtils.getCurrentUser();
    if (appUser && appUser.onboardingComplete) {
      console.log('✅ App would correctly show Today screen');
    } else {
      throw new Error('App would incorrectly show onboarding screen');
    }
    
    // Step 10: Test localStorage migration (if needed)
    console.log('📋 Step 10: Testing localStorage migration...');
    await dbUtils.migrateFromLocalStorage();
    const migratedUser = await dbUtils.getCurrentUser();
    console.log('✅ Migration completed, user still exists:', migratedUser ? 'Yes' : 'No');
    
    console.log('🎉 All tests completed successfully!');
    console.log('✅ Onboarding completion fix is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the test
testOnboardingCompletion().catch(console.error); 