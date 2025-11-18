import { db, type User, type Plan, type Workout } from './db';
import { dbUtils } from '@/lib/dbUtils';

export interface GeneratePlanOptions {
  user: User;
  startDate?: Date;
  planType?: 'beginner' | 'intermediate' | 'advanced';
  targetDistance?: '5k' | '10k' | 'half-marathon' | 'marathon';
  rookie_challenge?: boolean; // If true, generate rookie challenge plan
}

export interface PlanData {
  plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>;
  workouts: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>[];
}

/**
 * Generate a personalized training plan using OpenAI via API route
 * Returns plan data without creating database records
 */
export async function generatePlan(options: GeneratePlanOptions): Promise<PlanData> {
  const { user, startDate = new Date(), planType, targetDistance, rookie_challenge } = options;
  
  try {
    // Call the API route to generate the plan
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user,
        planType,
        targetDistance,
        rookie_challenge
      })
    });

    // Handle different types of API errors more gracefully
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
      
      // Check if this is a configuration issue that should trigger fallback
      if (errorData.fallbackRequired || response.status === 422) {
        console.warn('API requires fallback:', errorData.message || errorData.error);
        throw new Error(`FALLBACK_REQUIRED: ${errorData.message || errorData.error}`);
      }
      
      // For other errors, provide detailed error information
      const errorMessage = errorData.error || `API request failed with status ${response.status}`;
      console.error('API plan generation failed:', errorMessage, errorData.details);
      throw new Error(`API_ERROR: ${errorMessage}`);
    }

    const { plan: generatedPlan, source } = await response.json();
    console.log(`Plan generated successfully using ${source || 'unknown'} source`);

    // Create the plan data structure without database operations
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (generatedPlan.totalWeeks * 7));

    const plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.id!,
      title: generatedPlan.title,
      description: generatedPlan.description,
      startDate,
      endDate,
      totalWeeks: generatedPlan.totalWeeks,
      isActive: true,
      planType: 'basic',
      targetDistance: generatedPlan.targetDistance,
      targetTime: generatedPlan.targetTime,
      fitnessLevel: user.experience,
      trainingDaysPerWeek: user.daysPerWeek,
      peakWeeklyVolume: generatedPlan.peakWeeklyVolume
    };

    // Create workout data structures without database operations
    const workouts: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    for (const workoutData of generatedPlan.workouts) {
      const workoutDate = calculateWorkoutDate(startDate, workoutData.week, workoutData.day);
      
      workouts.push({
        planId: 0, // Will be set by OnboardingManager
        week: workoutData.week,
        day: workoutData.day,
        type: workoutData.type,
        distance: workoutData.distance,
        duration: workoutData.duration,
        notes: workoutData.notes,
        completed: false,
        scheduledDate: workoutDate
      });
    }

    console.log('Generated AI plan data with', workouts.length, 'workouts for user:', user.id);
    return { plan, workouts };
  } catch (error) {
    console.error('❌ AI plan generation failed:', error);
    throw error;
  }
}



/**
 * Calculate the scheduled date for a workout based on week and day
 */
function calculateWorkoutDate(startDate: Date, week: number, day: string): Date {
  const dayMap: { [key: string]: number } = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };

  const workoutDate = new Date(startDate);
  
  // Add weeks
  workoutDate.setDate(workoutDate.getDate() + ((week - 1) * 7));
  
  // Set to the correct day of the week
  const currentDay = workoutDate.getDay();
  const targetDay = dayMap[day];
  const dayDiff = targetDay - currentDay;
  
  workoutDate.setDate(workoutDate.getDate() + dayDiff);
  
  return workoutDate;
}

/**
 * Generate a simple fallback plan if OpenAI fails
 * Returns plan data without creating database records
 */
export async function generateFallbackPlan(user: User, startDate: Date = new Date(), rookie_challenge?: boolean): Promise<PlanData> {
  const totalWeeks = rookie_challenge ? 2 : (user.experience === 'beginner' ? 4 : user.experience === 'intermediate' ? 6 : 8);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (totalWeeks * 7));

  const plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: user.id!,
    title: `${user.experience.charAt(0).toUpperCase() + user.experience.slice(1)} Running Plan`,
    description: `A ${totalWeeks}-week progressive running plan tailored for ${user.experience} runners.${rookie_challenge ? ' 21-Day Rookie Challenge!' : ''}`,
    startDate,
    endDate,
    totalWeeks,
    isActive: true,
    planType: 'basic',
    fitnessLevel: user.experience,
    trainingDaysPerWeek: user.daysPerWeek
  };

  console.log('Generated fallback plan data for user:', user.id);

  // Create a basic workout structure without database operations
  const workouts: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const weeklyPattern = user.daysPerWeek === 3 
    ? [{ day: 'Mon', type: 'easy' }, { day: 'Wed', type: 'tempo' }, { day: 'Sat', type: 'long' }]
    : user.daysPerWeek === 4
    ? [{ day: 'Mon', type: 'easy' }, { day: 'Wed', type: 'tempo' }, { day: 'Fri', type: 'easy' }, { day: 'Sat', type: 'long' }]
    : [{ day: 'Mon', type: 'easy' }, { day: 'Tue', type: 'intervals' }, { day: 'Thu', type: 'tempo' }, { day: 'Fri', type: 'easy' }, { day: 'Sat', type: 'long' }];

  for (let week = 1; week <= totalWeeks; week++) {
    for (const workout of weeklyPattern) {
      const baseDistance = user.experience === 'beginner' ? 3 : user.experience === 'intermediate' ? 5 : 7;
      const distance = workout.type === 'long' ? baseDistance * 1.5 + (week - 1) * 0.5 : baseDistance + (week - 1) * 0.3;
      
      const scheduledDate = calculateWorkoutDate(startDate, week, workout.day);
      
      workouts.push({
        planId: 0, // Will be set by OnboardingManager
        week,
        day: workout.day,
        type: workout.type as any,
        distance: Math.round(distance * 10) / 10,
        completed: false,
        scheduledDate,
        notes: getWorkoutNotes(workout.type as any)
      });
    }
  }

  console.log(`Fallback plan data completed: ${workouts.length} workouts for user ${user.id}`);
  return { plan, workouts };
}

/**
 * Get helpful notes for different workout types
 */
function getWorkoutNotes(type: string): string {
  const notes = {
    easy: 'Run at a comfortable, conversational pace. You should be able to speak in full sentences.',
    tempo: 'Run at a comfortably hard pace - about 80-85% effort. This should feel challenging but sustainable.',
    intervals: 'High-intensity intervals with recovery periods. Warm up well and cool down properly.',
    long: 'Build your endurance with a steady, easy pace. Focus on time on feet rather than speed.',
    'time-trial': 'Test your current fitness level. Run at your best sustainable pace for the distance.',
    hill: 'Run uphill at a hard effort, then recover on the way down. Great for building strength.',
    rest: 'Complete rest day. Light stretching or walking is fine, but no running.'
  };

  return notes[type as keyof typeof notes] || 'Follow your training plan and listen to your body.';
} 