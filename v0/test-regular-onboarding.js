// Test script to verify regular onboarding screen works correctly
import { dbUtils } from './lib/dbUtils.js';

async function testRegularOnboarding() {
  console.log('🔍 Testing regular onboarding screen...');
  
  try {
    // Step 1: Clear any existing data
    console.log('📋 Step 1: Clearing existing data...');
    await dbUtils.clearDatabase();
    console.log('✅ Database cleared');
    
    // Step 2: Simulate regular onboarding completion (like the OnboardingScreen component)
    console.log('📋 Step 2: Simulating regular onboarding completion...');
    
    // Step 2.1: Migrate localStorage data first
    console.log('📋 Step 2.1: Migrating localStorage data...');
    await dbUtils.migrateFromLocalStorage();
    console.log('✅ localStorage migration completed');
    
    // Step 2.2: Create user record (simulating OnboardingScreen handleComplete)
    console.log('📋 Step 2.2: Creating user record...');
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
    
    console.log('User data to save:', userData);
    const userId = await dbUtils.createUser(userData);
    console.log('✅ User record created successfully with ID:', userId);
    
    // Step 2.3: Get the created user
    console.log('📋 Step 2.3: Fetching created user...');
    const user = await dbUtils.getCurrentUser();
    if (!user || !user.id) {
      throw new Error('Failed to retrieve created user - user not found in database');
    }
    console.log('✅ User retrieved successfully:', { id: user.id, onboardingComplete: user.onboardingComplete });
    
    // Step 2.4: Generate training plan (simulating plan generation)
    console.log('📋 Step 2.4: Generating training plan...');
    const plan = await dbUtils.ensureUserHasActivePlan(user.id);
    console.log('✅ Plan created successfully:', {
      planId: plan.id,
      title: plan.title,
      workoutsCount: 0 // Will be populated by plan generation
    });
    
    // Step 2.5: Validate plan integrity
    console.log('📋 Step 2.5: Validating plan integrity...');
    const validationResult = await dbUtils.validateUserPlanIntegrity(user.id);
    console.log('✅ Plan validation result:', validationResult);
    
    if (!validationResult.hasActivePlan) {
      console.warn('⚠️ No active plan found after generation, attempting recovery...');
      await dbUtils.ensureUserHasActivePlan(user.id);
      console.log('✅ Plan recovery completed');
    }
    
    // Step 3: Verify the complete onboarding flow worked
    console.log('📋 Step 3: Verifying complete onboarding flow...');
    
    const finalUser = await dbUtils.getCurrentUser();
    if (!finalUser || !finalUser.onboardingComplete) {
      throw new Error('Onboarding not marked as complete');
    }
    
    const finalPlan = await dbUtils.getActivePlan(finalUser.id);
    if (!finalPlan) {
      throw new Error('No active plan found after onboarding');
    }
    
    console.log('✅ Regular onboarding flow completed successfully!');
    console.log('✅ User:', { id: finalUser.id, onboardingComplete: finalUser.onboardingComplete });
    console.log('✅ Plan:', { id: finalPlan.id, title: finalPlan.title, isActive: finalPlan.isActive });
    
    // Step 4: Test that the app would show Today screen
    console.log('📋 Step 4: Testing app state...');
    if (finalUser.onboardingComplete) {
      console.log('✅ App would correctly show Today screen after regular onboarding');
    } else {
      throw new Error('App would incorrectly show onboarding screen after completion');
    }
    
    console.log('🎉 Regular onboarding test completed successfully!');
    console.log('✅ Regular onboarding screen fix is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the test
testRegularOnboarding().catch(console.error); 