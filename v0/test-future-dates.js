// Test script to verify API accepts future dates
import { dbUtils } from './lib/dbUtils.js';

async function testFutureDates() {
  console.log('🧪 Testing API with future dates...');
  
  try {
    // Get current user
    const user = await dbUtils.getCurrentUser();
    console.log('👤 Current user:', user);
    
    if (!user || !user.id) {
      console.log('❌ No user found, skipping test');
      return;
    }
    
    // Ensure user has active plan
    const activePlan = await dbUtils.ensureUserHasActivePlan(user.id);
    console.log('📋 Active plan:', {
      id: activePlan.id,
      title: activePlan.title,
      startDate: activePlan.startDate,
      endDate: activePlan.endDate
    });
    
    // Test with future date (3 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    
    console.log('📅 Testing with future date:', futureDate.toISOString());
    
    // Calculate week number
    const planStartDate = new Date(activePlan.startDate);
    const daysDiff = Math.floor((futureDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysDiff / 7) + 1;
    
    console.log('📊 Week calculation:', { daysDiff, weekNumber });
    
    // Create workout with future date
    const workoutData = {
      planId: activePlan.id,
      week: weekNumber,
      day: 'Mon',
      type: 'easy',
      distance: 5,
      notes: 'Test future workout',
      completed: false,
      scheduledDate: futureDate
    };
    
    console.log('💾 Saving workout with data:', workoutData);
    
    const workoutId = await dbUtils.createWorkout(workoutData);
    console.log('✅ Workout saved successfully with ID:', workoutId);
    
    // Verify the workout was saved
    const savedWorkout = await dbUtils.getWorkoutsByPlan(activePlan.id);
    const futureWorkout = savedWorkout.find(w => w.scheduledDate.getTime() === futureDate.getTime());
    
    if (futureWorkout) {
      console.log('✅ Future workout found in database:', futureWorkout);
    } else {
      console.log('❌ Future workout not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error testing future dates:', error);
  }
}

// Run the test
testFutureDates(); 