import { dbUtils } from './lib/dbUtils.js';

async function testTrainingPlanError() {
  console.log('🔍 Testing training plan error reproduction...');
  
  try {
    // First, check if there are any users in the system
    console.log('\n📊 Step 1: Checking existing users...');
    const allUsers = await dbUtils.getAllUsers();
    console.log(`Found ${allUsers.length} users in database`);
    
    if (allUsers.length === 0) {
      console.log('❌ No users found. Creating a test user...');
      
      // Create a test user
      const testUserData = {
        name: 'Test User',
        goal: 'fitness',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { analytics: true, notifications: true },
        onboardingComplete: true
      };
      
      const userId = await dbUtils.createUser(testUserData);
      console.log(`✅ Created test user with ID: ${userId}`);
      
      // Now test ensureUserHasActivePlan
      console.log('\n📋 Step 2: Testing ensureUserHasActivePlan with new user...');
      const plan = await dbUtils.ensureUserHasActivePlan(userId);
      console.log(`✅ Plan created/retrieved: ${plan.title} (ID: ${plan.id})`);
      
    } else {
      // Use existing user
      const user = allUsers[0];
      console.log(`Using existing user: ${user.name} (ID: ${user.id}, onboarding: ${user.onboardingComplete})`);
      
      console.log('\n📋 Step 2: Testing ensureUserHasActivePlan...');
      const plan = await dbUtils.ensureUserHasActivePlan(user.id);
      console.log(`✅ Plan created/retrieved: ${plan.title} (ID: ${plan.id})`);
    }
    
    console.log('\n✅ Test completed successfully - no training plan error reproduced');
    
  } catch (error) {
    console.error('\n❌ Training plan error reproduced!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Check detailed database state
    console.log('\n🔍 Database debugging...');
    try {
      const users = await dbUtils.getAllUsers();
      console.log(`Users in DB: ${users.length}`);
      users.forEach(user => {
        console.log(`- User ${user.id}: ${user.name}, onboarding: ${user.onboardingComplete}`);
      });
      
      if (users.length > 0) {
        const plans = await dbUtils.getAllPlans();
        console.log(`Plans in DB: ${plans.length}`);
        plans.forEach(plan => {
          console.log(`- Plan ${plan.id}: "${plan.title}", user: ${plan.userId}, active: ${plan.isActive}`);
        });
      }
    } catch (debugError) {
      console.error('Debug error:', debugError.message);
    }
  }
}

// Run the test
testTrainingPlanError().then(() => {
  console.log('Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});