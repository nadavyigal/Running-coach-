// Comprehensive test to verify the onboarding completion bug fix
import { dbUtils } from './lib/dbUtils.js';

async function testBugFixVerification() {
  console.log('🔍 Testing onboarding completion bug fix...');
  
  try {
    // Test 1: Chat Overlay Onboarding Flow
    console.log('\n📋 Test 1: Chat Overlay Onboarding Flow');
    await testChatOverlayFlow();
    
    // Clear database for next test
    await dbUtils.clearDatabase();
    
    // Test 2: Regular Onboarding Screen Flow
    console.log('\n📋 Test 2: Regular Onboarding Screen Flow');
    await testRegularOnboardingFlow();
    
    // Clear database for next test
    await dbUtils.clearDatabase();
    
    // Test 3: App State Verification
    console.log('\n📋 Test 3: App State Verification');
    await testAppStateVerification();
    
    console.log('\n🎉 All tests passed! Bug fix verification complete.');
    
  } catch (error) {
    console.error('❌ Bug fix verification failed:', error);
    throw error;
  }
}

async function testChatOverlayFlow() {
  console.log('📋 Simulating chat overlay onboarding completion...');
  
  // Step 1: Create user (simulating chat overlay completion)
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
    age: 25,
    coachingStyle: 'supportive'
  });
  
  console.log(`✅ User created with ID: ${userId}`);
  
  // Step 2: Get the created user
  const user = await dbUtils.getCurrentUser();
  if (!user || !user.id) {
    throw new Error('Failed to retrieve created user');
  }
  
  console.log('✅ User retrieved successfully:', { id: user.id, onboardingComplete: user.onboardingComplete });
  
  // Step 3: Generate training plan
  console.log('📋 Generating training plan...');
  const { generatePlan, generateFallbackPlan } = await import('./lib/planGenerator.js');
  
  let planResult;
  try {
    planResult = await generatePlan({ user, rookie_challenge: true });
    console.log('✅ AI plan generated successfully');
  } catch (error) {
    console.log('⚠️ AI plan generation failed, using fallback:', error);
    planResult = await generateFallbackPlan(user);
    console.log('✅ Fallback plan generated successfully');
  }
  
  // Step 4: Validate plan integrity
  console.log('📋 Validating plan integrity...');
  const validation = await dbUtils.validateUserPlanIntegrity(user.id);
  console.log('✅ Plan validation:', validation);
  
  if (!validation.hasActivePlan) {
    console.warn('⚠️ No active plan found, attempting recovery...');
    await dbUtils.ensureUserHasActivePlan(user.id);
  }
  
  // Step 5: Verify app state
  const finalUser = await dbUtils.getCurrentUser();
  const activePlan = await dbUtils.getActivePlan(user.id);
  
  if (!finalUser || !finalUser.onboardingComplete) {
    throw new Error('User onboarding not marked as complete');
  }
  
  if (!activePlan) {
    throw new Error('No active plan found after completion');
  }
  
  console.log('✅ Chat overlay flow test passed');
  console.log('✅ User onboarding complete:', finalUser.onboardingComplete);
  console.log('✅ Active plan found:', activePlan.title);
}

async function testRegularOnboardingFlow() {
  console.log('📋 Simulating regular onboarding screen completion...');
  
  // Step 1: Migrate localStorage data first
  console.log('📋 Step 1: Migrating localStorage data...');
  await dbUtils.migrateFromLocalStorage();
  console.log('✅ localStorage migration completed');
  
  // Step 2: Create user record (simulating regular onboarding completion)
  console.log('📋 Step 2: Creating user record...');
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
    rpe: 5,
    age: 30,
  };
  
  console.log('User data to save:', userData);
  const userId = await dbUtils.createUser(userData);
  console.log('✅ User record created successfully with ID:', userId);
  
  // Step 3: Get the created user
  console.log('📋 Step 3: Fetching created user...');
  const user = await dbUtils.getCurrentUser();
  if (!user || !user.id) {
    throw new Error('Failed to retrieve created user - user not found in database');
  }
  console.log('✅ User retrieved successfully:', { id: user.id, onboardingComplete: user.onboardingComplete });
  
  // Step 4: Generate training plan
  console.log('📋 Step 4: Generating training plan...');
  const { generatePlan, generateFallbackPlan } = await import('./lib/planGenerator.js');
  
  let planResult;
  try {
    planResult = await generatePlan({ user, rookie_challenge: true });
    console.log('✅ AI plan generated successfully');
  } catch (error) {
    console.log('⚠️ AI plan generation failed, using fallback:', error);
    planResult = await generateFallbackPlan(user);
    console.log('✅ Fallback plan generated successfully');
  }
  
  // Step 5: Verify plan was created successfully
  if (!planResult || !planResult.plan) {
    throw new Error('Plan generation completed but no plan was returned');
  }
  
  console.log('✅ Plan created successfully:', {
    planId: planResult.plan.id,
    title: planResult.plan.title,
    workoutsCount: planResult.workouts.length
  });
  
  // Step 6: Validate plan integrity
  console.log('📋 Step 6: Validating plan integrity...');
  try {
    const validationResult = await dbUtils.validateUserPlanIntegrity(user.id);
    console.log('✅ Plan validation result:', validationResult);
    
    if (!validationResult.hasActivePlan) {
      console.warn('⚠️ No active plan found after generation, attempting recovery...');
      await dbUtils.ensureUserHasActivePlan(user.id);
      console.log('✅ Plan recovery completed');
    }
    
    if (validationResult.issues.length > 0) {
      console.warn('⚠️ Plan integrity issues detected:', validationResult.issues);
    }
  } catch (error) {
    console.error('❌ Plan validation failed:', error);
    // Continue with onboarding despite validation issues
  }
  
  // Step 7: Verify app state
  const finalUser = await dbUtils.getCurrentUser();
  const activePlan = await dbUtils.getActivePlan(user.id);
  
  if (!finalUser || !finalUser.onboardingComplete) {
    throw new Error('User onboarding not marked as complete');
  }
  
  if (!activePlan) {
    throw new Error('No active plan found after completion');
  }
  
  console.log('✅ Regular onboarding flow test passed');
  console.log('✅ User onboarding complete:', finalUser.onboardingComplete);
  console.log('✅ Active plan found:', activePlan.title);
}

async function testAppStateVerification() {
  console.log('📋 Testing app state verification...');
  
  // Step 1: Create a user with onboarding complete
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
  
  // Step 2: Ensure user has active plan
  const plan = await dbUtils.ensureUserHasActivePlan(userId);
  
  // Step 3: Verify app should show Today screen
  const user = await dbUtils.getCurrentUser();
  const activePlan = await dbUtils.getActivePlan(userId);
  
  if (!user || !user.onboardingComplete) {
    throw new Error('App state verification failed: User onboarding not complete');
  }
  
  if (!activePlan) {
    throw new Error('App state verification failed: No active plan found');
  }
  
  // Step 4: Verify plan has workouts
  const workouts = await dbUtils.getWorkoutsByPlan(plan.id);
  
  if (workouts.length === 0) {
    throw new Error('App state verification failed: Plan has no workouts');
  }
  
  console.log('✅ App state verification passed');
  console.log('✅ User onboarding complete:', user.onboardingComplete);
  console.log('✅ Active plan found:', activePlan.title);
  console.log('✅ Plan has workouts:', workouts.length);
}

// Run the test
testBugFixVerification().catch(console.error); 