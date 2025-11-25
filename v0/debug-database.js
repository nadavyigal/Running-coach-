// Enhanced database debugging script
// Paste this in browser console to diagnose database issues

async function debugDatabase() {
  console.log('🔍 Starting enhanced database debugging...');
  
  try {
    // Import database
    const { db } = await import('./lib/db.js');
    const { dbUtils } = await import('./lib/dbUtils.js');
    
    console.log('📊 Database Info:');
    console.log('- Name:', db.name);
    console.log('- Version:', db.verno);
    console.log('- Tables:', db.tables.map(t => t.name));
    
    // Check current user
    console.log('\n👤 User Analysis:');
    const user = await dbUtils.getCurrentUser();
    if (user) {
      console.log('✅ Current user found:', {
        id: user.id,
        experience: user.experience,
        goal: user.goal,
        onboardingComplete: user.onboardingComplete
      });
      
      // Check coaching profile
      console.log('\n🧠 Coaching Profile Check:');
      const profile = await dbUtils.getCoachingProfile(user.id);
      if (profile) {
        console.log('✅ Coaching profile exists');
        console.log('- Communication style:', profile.communicationStyle);
        console.log('- Effectiveness score:', profile.coachingEffectivenessScore);
      } else {
        console.log('❌ No coaching profile found');
      }
      
      // Check active plan
      console.log('\n📋 Training Plan Analysis:');
      const activePlan = await dbUtils.getActivePlan(user.id);
      if (activePlan) {
        console.log('✅ Active plan found:', {
          id: activePlan.id,
          title: activePlan.title,
          totalWeeks: activePlan.totalWeeks,
          startDate: activePlan.startDate,
          endDate: activePlan.endDate
        });
        
        // Check workouts
        const workouts = await dbUtils.getWorkoutsByPlan(activePlan.id);
        console.log(`📅 Plan has ${workouts.length} total workouts`);
        
        if (workouts.length > 0) {
          // Check today's workout
          const today = new Date();
          const todaysWorkouts = workouts.filter(w => {
            const workoutDate = new Date(w.scheduledDate);
            const todayDate = new Date();
            return workoutDate.toDateString() === todayDate.toDateString();
          });
          
          console.log(`🏃 Today's workouts: ${todaysWorkouts.length}`);
          if (todaysWorkouts.length > 0) {
            console.log('- Today\'s workout:', todaysWorkouts[0]);
          }
          
          // Check next 7 days
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          const nextWeekWorkouts = workouts.filter(w => {
            const workoutDate = new Date(w.scheduledDate);
            return workoutDate >= today && workoutDate <= nextWeek;
          });
          
          console.log(`📅 Next 7 days: ${nextWeekWorkouts.length} workouts`);
          nextWeekWorkouts.slice(0, 5).forEach((w, i) => {
            console.log(`  ${i+1}. ${w.day} - ${w.type} (${w.distance}km)`);
          });
        } else {
          console.log('❌ No workouts found in plan!');
        }
      } else {
        console.log('❌ No active training plan found');
        
        // Check all plans for this user
        const allPlans = await db.plans.where('userId').equals(user.id).toArray();
        console.log(`📋 Total plans for user: ${allPlans.length}`);
        allPlans.forEach(plan => {
          console.log(`- Plan ${plan.id}: ${plan.title} (active: ${plan.isActive})`);
        });
      }
      
      // Check goals
      console.log('\n🎯 Goals Analysis:');
      try {
        const goals = await dbUtils.getGoalsByUser(user.id);
        console.log(`✅ Found ${goals.length} goals`);
        goals.forEach((goal, i) => {
          console.log(`  ${i+1}. ${goal.title} (${goal.status})`);
        });
      } catch (goalError) {
        console.log('❌ Error checking goals:', goalError.message);
      }
      
    } else {
      console.log('❌ No current user found');
    }
    
    // Database table counts
    console.log('\n📊 Table Statistics:');
    const tableStats = {};
    for (const table of db.tables) {
      try {
        const count = await table.count();
        tableStats[table.name] = count;
        console.log(`- ${table.name}: ${count} records`);
      } catch (error) {
        console.log(`- ${table.name}: Error counting (${error.message})`);
      }
    }
    
    console.log('\n✅ Database debugging complete!');
    console.log('📊 Summary:', tableStats);
    
    return {
      user,
      tableStats,
      hasCoachingProfile: !!(user && await dbUtils.getCoachingProfile(user.id)),
      hasActivePlan: !!(user && await dbUtils.getActivePlan(user.id))
    };
    
  } catch (error) {
    console.error('💥 Database debugging failed:', error);
    return { error: error.message };
  }
}

// Run the debug function
debugDatabase().then(result => {
  console.log('🎯 Debug result:', result);
});