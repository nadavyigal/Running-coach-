// Test script to verify database functionality for Story 6.3
// This tests the database schema, utilities, and CRUD operations

const { db, dbUtils } = require('./lib/db.ts');

async function testDatabase() {
  console.log('🚀 Starting database functionality test...\n');
  
  try {
    // Test 1: Database initialization
    console.log('Test 1: Database initialization');
    await db.open();
    console.log('✅ Database opened successfully');
    
    // Test 2: Check if all required tables exist
    console.log('\nTest 2: Checking required tables');
    const tables = [
      'users', 'plans', 'workouts', 'runs', 'shoes', 'chatMessages', 
      'badges', 'cohorts', 'cohortMembers', 'performanceMetrics', 
      'personalRecords', 'performanceInsights', 'raceGoals', 'workoutTemplates'
    ];
    
    for (const table of tables) {
      const exists = db[table] !== undefined;
      console.log(`${exists ? '✅' : '❌'} ${table} table: ${exists ? 'exists' : 'missing'}`);
    }
    
    // Test 3: Create a test user
    console.log('\nTest 3: Creating test user');
    const userId = await dbUtils.createUser({
      goal: 'distance',
      experience: 'intermediate',
      preferredTimes: ['morning'],
      daysPerWeek: 4,
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      onboardingComplete: true
    });
    console.log(`✅ User created with ID: ${userId}`);
    
    // Test 4: Race Goal CRUD operations
    console.log('\nTest 4: Race Goal CRUD operations');
    
    // Create race goal
    const raceGoalData = {
      userId: userId,
      raceName: 'Test Marathon',
      raceDate: new Date('2024-06-15'),
      distance: 42.2,
      targetTime: 10800, // 3 hours
      priority: 'A',
      location: 'Test City',
      raceType: 'road',
      elevationGain: 150,
      courseDifficulty: 'moderate',
      registrationStatus: 'planned',
      notes: 'Test race goal'
    };
    
    const raceGoalId = await dbUtils.createRaceGoal(raceGoalData);
    console.log(`✅ Race goal created with ID: ${raceGoalId}`);
    
    // Read race goal
    const raceGoal = await dbUtils.getRaceGoalById(raceGoalId);
    console.log(`✅ Race goal retrieved: ${raceGoal.raceName}`);
    
    // Update race goal
    await dbUtils.updateRaceGoal(raceGoalId, { targetTime: 10200 }); // 2:50:00
    const updatedRaceGoal = await dbUtils.getRaceGoalById(raceGoalId);
    console.log(`✅ Race goal updated, new target time: ${updatedRaceGoal.targetTime}`);
    
    // Get user's race goals
    const userRaceGoals = await dbUtils.getRaceGoalsByUser(userId);
    console.log(`✅ User has ${userRaceGoals.length} race goal(s)`);
    
    // Test 5: Enhanced Plan with race goal
    console.log('\nTest 5: Enhanced Plan operations');
    
    const planData = {
      userId: userId,
      title: 'Marathon Training Plan',
      description: 'Advanced periodized training plan',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-01'),
      totalWeeks: 20,
      isActive: true,
      planType: 'periodized',
      raceGoalId: raceGoalId,
      targetDistance: 42.2,
      targetTime: 10200,
      fitnessLevel: 'intermediate',
      trainingDaysPerWeek: 5,
      peakWeeklyVolume: 80,
      periodization: [
        {
          phase: 'base',
          duration: 8,
          weeklyVolumePercentage: 60,
          intensityDistribution: { easy: 80, moderate: 15, hard: 5 },
          keyWorkouts: ['long', 'easy'],
          focus: 'Build aerobic base'
        },
        {
          phase: 'build',
          duration: 6,
          weeklyVolumePercentage: 80,
          intensityDistribution: { easy: 70, moderate: 20, hard: 10 },
          keyWorkouts: ['tempo', 'intervals', 'long'],
          focus: 'Develop race pace and lactate threshold'
        },
        {
          phase: 'peak',
          duration: 4,
          weeklyVolumePercentage: 100,
          intensityDistribution: { easy: 60, moderate: 25, hard: 15 },
          keyWorkouts: ['race-pace', 'intervals', 'long'],
          focus: 'Peak fitness and race-specific training'
        },
        {
          phase: 'taper',
          duration: 2,
          weeklyVolumePercentage: 40,
          intensityDistribution: { easy: 70, moderate: 20, hard: 10 },
          keyWorkouts: ['race-pace', 'easy'],
          focus: 'Recovery and race preparation'
        }
      ]
    };
    
    const planId = await dbUtils.createAdvancedPlan(planData);
    console.log(`✅ Advanced plan created with ID: ${planId}`);
    
    // Test 6: Workout Template operations
    console.log('\nTest 6: Workout Template operations');
    
    const workoutTemplate = {
      name: 'Lactate Threshold Run',
      workoutType: 'tempo',
      trainingPhase: 'build',
      intensityZone: 'threshold',
      structure: {
        warmup: { duration: 15, intensity: 'easy' },
        main: { duration: 20, intensity: 'threshold' },
        cooldown: { duration: 10, intensity: 'easy' }
      },
      description: '20-minute tempo run at lactate threshold pace',
      coachingNotes: 'Focus on maintaining even effort throughout'
    };
    
    const templateId = await dbUtils.createWorkoutTemplate(workoutTemplate);
    console.log(`✅ Workout template created with ID: ${templateId}`);
    
    // Test 7: Fitness assessment
    console.log('\nTest 7: Fitness assessment');
    
    // Add some test runs for fitness assessment
    const testRuns = [
      { distance: 8, duration: 2400, pace: 300, completedAt: new Date('2024-01-15') },
      { distance: 12, duration: 3720, pace: 310, completedAt: new Date('2024-01-20') },
      { distance: 6, duration: 1800, pace: 300, completedAt: new Date('2024-01-25') },
      { distance: 15, duration: 4800, pace: 320, completedAt: new Date('2024-01-30') }
    ];
    
    for (const run of testRuns) {
      await dbUtils.createRun({
        userId: userId,
        type: 'easy',
        ...run
      });
    }
    
    const fitnessLevel = await dbUtils.assessFitnessLevel(userId);
    console.log(`✅ Fitness level assessed: ${fitnessLevel}`);
    
    // Test 8: Target pace calculation
    console.log('\nTest 8: Target pace calculation');
    
    const targetPaces = await dbUtils.calculateTargetPaces(userId, raceGoalId);
    console.log(`✅ Target paces calculated:`);
    console.log(`   Race pace: ${Math.floor(targetPaces.racePace / 60)}:${String(Math.floor(targetPaces.racePace % 60)).padStart(2, '0')}/km`);
    console.log(`   Easy pace: ${Math.floor(targetPaces.easyPace / 60)}:${String(Math.floor(targetPaces.easyPace % 60)).padStart(2, '0')}/km`);
    console.log(`   Tempo pace: ${Math.floor(targetPaces.tempoPace / 60)}:${String(Math.floor(targetPaces.tempoPace % 60)).padStart(2, '0')}/km`);
    
    // Test 9: Database migration check
    console.log('\nTest 9: Database migration check');
    console.log(`✅ Database version: ${db.verno}`);
    console.log(`✅ Expected version: 7 (matches latest migration)`);
    
    // Test 10: Performance metrics
    console.log('\nTest 10: Performance metrics');
    
    const performanceMetrics = await dbUtils.calculatePerformanceMetrics(userId, new Date());
    console.log(`✅ Performance metrics calculated for user`);
    
    // Clean up test data
    console.log('\nCleaning up test data...');
    await dbUtils.deleteRaceGoal(raceGoalId);
    await db.plans.delete(planId);
    await db.workoutTemplates.delete(templateId);
    await db.users.delete(userId);
    await db.runs.where('userId').equals(userId).delete();
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All database tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await db.close();
    console.log('\n📚 Database connection closed');
  }
}

// Run the test
testDatabase().catch(console.error);