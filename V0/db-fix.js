// Simple script to check and fix database issues
// This can be run in the browser console to diagnose and fix issues

console.log('Starting database diagnostics...');

// Check database version and schema
(async function() {
  try {
    console.log('Checking database status...');
    
    // Import the database
    const { db, dbUtils } = await import('./lib/db.js');
    
    // Check database version
    console.log('Database name:', db.name);
    console.log('Database version:', db.verno);
    
    // Check if tables exist
    const tables = db.tables.map(t => t.name);
    console.log('Available tables:', tables);
    
    // Check if goals table exists
    if (tables.includes('goals')) {
      console.log('✅ Goals table exists');
      const goalCount = await db.goals.count();
      console.log(`Goals table has ${goalCount} entries`);
    } else {
      console.log('❌ Goals table missing');
    }
    
    // Check coaching profiles
    if (tables.includes('coachingProfiles')) {
      console.log('✅ Coaching profiles table exists');
      const profileCount = await db.coachingProfiles.count();
      console.log(`Coaching profiles table has ${profileCount} entries`);
    } else {
      console.log('❌ Coaching profiles table missing');
    }
    
    // Check current user
    const user = await dbUtils.getCurrentUser();
    if (user) {
      console.log('✅ Current user found:', user.id);
      
      // Check if user has coaching profile
      const profile = await dbUtils.getCoachingProfile(user.id);
      if (profile) {
        console.log('✅ User has coaching profile');
      } else {
        console.log('❌ User missing coaching profile - should be auto-created');
      }
      
      // Check if user has active plan
      const plan = await dbUtils.getActivePlan(user.id);
      if (plan) {
        console.log('✅ User has active plan:', plan.id);
        
        // Check workouts for this plan
        const workouts = await dbUtils.getWorkoutsByPlan(plan.id);
        console.log(`Plan has ${workouts.length} workouts`);
        
        if (workouts.length === 0) {
          console.log('❌ No workouts found in plan - this might be the issue');
        }
      } else {
        console.log('❌ User has no active plan');
      }
    } else {
      console.log('❌ No current user found');
    }
    
    console.log('Database diagnostics complete!');
    
  } catch (error) {
    console.error('Database diagnostics failed:', error);
  }
})();