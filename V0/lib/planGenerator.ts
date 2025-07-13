import { db, dbUtils, type User, type Plan, type Workout } from './db';

export interface GeneratePlanOptions {
  user: User;
  startDate?: Date;
  planType?: 'beginner' | 'intermediate' | 'advanced';
  targetDistance?: '5k' | '10k' | 'half-marathon' | 'marathon';
}

/**
 * Generate a personalized training plan using OpenAI via API route
 */
export async function generatePlan(options: GeneratePlanOptions): Promise<{ plan: Plan; workouts: Workout[] }> {
  const { user, startDate = new Date(), planType, targetDistance } = options;
  
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
        targetDistance
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate plan');
    }

    const { plan: generatedPlan } = await response.json();

    // Create the plan in the database
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (generatedPlan.totalWeeks * 7));

    const planId = await dbUtils.createPlan({
      userId: user.id!,
      title: generatedPlan.title,
      description: generatedPlan.description,
      startDate,
      endDate,
      totalWeeks: generatedPlan.totalWeeks,
      isActive: true
    });

    // Create workouts and calculate scheduled dates
    const workouts: Workout[] = [];
    const plan = await db.plans.get(planId);
    
    if (!plan) {
      throw new Error('Failed to create plan');
    }

    for (const workoutData of generatedPlan.workouts) {
      const scheduledDate = calculateWorkoutDate(startDate, workoutData.week, workoutData.day);
      
      const workoutId = await dbUtils.createWorkout({
        planId,
        week: workoutData.week,
        day: workoutData.day,
        type: workoutData.type,
        distance: workoutData.distance,
        duration: workoutData.duration,
        notes: workoutData.notes,
        completed: false,
        scheduledDate
      });

      const workout = await db.workouts.get(workoutId);
      if (workout) {
        workouts.push(workout);
      }
    }

    return { plan, workouts };
  } catch (error) {
    console.error('Failed to generate plan:', error);
    throw new Error('Failed to generate training plan. Please try again.');
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
 */
export async function generateFallbackPlan(user: User, startDate: Date = new Date()): Promise<{ plan: Plan; workouts: Workout[] }> {
  const totalWeeks = user.experience === 'beginner' ? 4 : user.experience === 'intermediate' ? 6 : 8;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (totalWeeks * 7));

  const planId = await dbUtils.createPlan({
    userId: user.id!,
    title: `${user.experience.charAt(0).toUpperCase() + user.experience.slice(1)} Running Plan`,
    description: `A ${totalWeeks}-week progressive running plan tailored for ${user.experience} runners.`,
    startDate,
    endDate,
    totalWeeks,
    isActive: true
  });

  const plan = await db.plans.get(planId);
  if (!plan) {
    throw new Error('Failed to create fallback plan');
  }

  // Create a basic workout structure
  const workouts: Workout[] = [];
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
      
      const workoutId = await dbUtils.createWorkout({
        planId,
        week,
        day: workout.day,
        type: workout.type as any,
        distance: Math.round(distance * 10) / 10,
        completed: false,
        scheduledDate,
        notes: getWorkoutNotes(workout.type as any)
      });

      const createdWorkout = await db.workouts.get(workoutId);
      if (createdWorkout) {
        workouts.push(createdWorkout);
      }
    }
  }

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