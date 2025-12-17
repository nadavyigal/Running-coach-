import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';
import { logger } from '@/lib/logger';

export async function PUT(req: NextRequest) {
  try {
    const {
      userId,
      planId,
      workoutId,
      modifications
    } = await req.json();

    // Validate required fields
    if (!userId || !planId || !workoutId || !modifications) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'userId, planId, workoutId, and modifications are required'
      }, { status: 400 });
    }

    // Get plan to verify ownership
    const plan = await dbUtils.getActivePlan(userId);
    if (!plan || plan.id !== planId) {
      return NextResponse.json({
        error: 'Plan not found or unauthorized'
      }, { status: 404 });
    }

    // Get workout to verify it belongs to the plan
    const workout = await dbUtils.getWorkoutsByPlan(planId);
    const targetWorkout = workout.find(w => w.id === workoutId);
    if (!targetWorkout) {
      return NextResponse.json({
        error: 'Workout not found in plan'
      }, { status: 404 });
    }

    // Validate modifications
    const validatedMods = validateModifications(modifications);
    if (validatedMods.errors.length > 0) {
      return NextResponse.json({
        error: 'Invalid modifications',
        details: validatedMods.errors
      }, { status: 400 });
    }

    // Check for safety violations
    const safetyCheck = await checkSafetyViolations(
      userId,
      planId,
      workoutId,
      validatedMods.data
    );

    if (safetyCheck.violations.length > 0) {
      return NextResponse.json({
        error: 'Safety violations detected',
        violations: safetyCheck.violations,
        warnings: safetyCheck.warnings,
        canOverride: safetyCheck.canOverride
      }, { status: 409 });
    }

    // Apply modifications
    await dbUtils.updateWorkout(workoutId, validatedMods.data);

    // Get updated workout
    const updatedWorkout = await dbUtils.getWorkoutsByPlan(planId);
    const modifiedWorkout = updatedWorkout.find(w => w.id === workoutId);

    return NextResponse.json({
      success: true,
      workout: modifiedWorkout,
      warnings: safetyCheck.warnings,
      message: 'Workout customized successfully'
    });

  } catch (error) {
    logger.error('Error customizing workout:', error);
    return NextResponse.json({
      error: 'Failed to customize workout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Validate workout modifications
function validateModifications(modifications: any): { data: any; errors: string[] } {
  const errors: string[] = [];
  const data: any = {};

  // Validate distance
  if (modifications.distance !== undefined) {
    if (typeof modifications.distance !== 'number' || modifications.distance < 0) {
      errors.push('Distance must be a positive number');
    } else if (modifications.distance > 50) {
      errors.push('Distance cannot exceed 50km for safety');
    } else {
      data.distance = modifications.distance;
    }
  }

  // Validate duration
  if (modifications.duration !== undefined) {
    if (typeof modifications.duration !== 'number' || modifications.duration < 0) {
      errors.push('Duration must be a positive number');
    } else if (modifications.duration > 480) {
      errors.push('Duration cannot exceed 8 hours for safety');
    } else {
      data.duration = modifications.duration;
    }
  }

  // Validate workout type
  if (modifications.type !== undefined) {
    const validTypes = ['easy', 'tempo', 'intervals', 'long', 'race-pace', 'recovery', 'time-trial', 'hill', 'fartlek', 'rest'];
    if (!validTypes.includes(modifications.type)) {
      errors.push('Invalid workout type');
    } else {
      data.type = modifications.type;
    }
  }

  // Validate intensity
  if (modifications.intensity !== undefined) {
    const validIntensities = ['easy', 'moderate', 'threshold', 'vo2max', 'anaerobic'];
    if (!validIntensities.includes(modifications.intensity)) {
      errors.push('Invalid intensity level');
    } else {
      data.intensity = modifications.intensity;
    }
  }

  // Validate notes
  if (modifications.notes !== undefined) {
    if (typeof modifications.notes !== 'string' || modifications.notes.length > 500) {
      errors.push('Notes must be a string with maximum 500 characters');
    } else {
      data.notes = modifications.notes;
    }
  }

  // Validate scheduled date
  if (modifications.scheduledDate !== undefined) {
    const date = new Date(modifications.scheduledDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid scheduled date');
    } else {
      data.scheduledDate = date;
    }
  }

  return { data, errors };
}

// Check for safety violations
async function checkSafetyViolations(
  userId: number,
  planId: number,
  workoutId: number,
  modifications: any
): Promise<{
  violations: string[];
  warnings: string[];
  canOverride: boolean;
}> {
  const violations: string[] = [];
  const warnings: string[] = [];
  let canOverride = true;

  // Get user's fitness level
  const fitnessLevel = await dbUtils.assessFitnessLevel(userId);
  
  // Get current and surrounding workouts
  const allWorkouts = await dbUtils.getWorkoutsByPlan(planId);
  const currentWorkout = allWorkouts.find(w => w.id === workoutId);
  if (!currentWorkout) {
    violations.push('Workout not found');
    return { violations, warnings, canOverride: false };
  }

  // Check for dramatic distance increases
  if (modifications.distance !== undefined) {
    const weekWorkouts = allWorkouts.filter(w => w.week === currentWorkout.week);
    const weeklyVolume = weekWorkouts.reduce((sum, w) => sum + (w.id === workoutId ? modifications.distance : w.distance), 0);
    
    // Maximum weekly volume based on fitness level
    const maxWeeklyVolume = {
      beginner: 40,
      intermediate: 60,
      advanced: 80
    };

    if (weeklyVolume > maxWeeklyVolume[fitnessLevel]) {
      violations.push(`Weekly volume exceeds safe limit for ${fitnessLevel} level`);
      canOverride = false;
    }

    // Check for >50% increase in single workout
    const originalDistance = currentWorkout.distance;
    if (modifications.distance > originalDistance * 1.5) {
      warnings.push('Distance increase >50% may increase injury risk');
    }
  }

  // Check for back-to-back high-intensity workouts
  if (modifications.intensity === 'vo2max' || modifications.intensity === 'anaerobic') {
    const workoutDate = new Date(currentWorkout.scheduledDate);
    const nextDay = new Date(workoutDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const prevDay = new Date(workoutDate);
    prevDay.setDate(prevDay.getDate() - 1);

    const adjacentWorkouts = allWorkouts.filter(w => {
      const wDate = new Date(w.scheduledDate);
      return (wDate.getTime() === nextDay.getTime() || wDate.getTime() === prevDay.getTime()) &&
             (w.intensity === 'vo2max' || w.intensity === 'anaerobic');
    });

    if (adjacentWorkouts.length > 0) {
      warnings.push('Back-to-back high-intensity workouts detected - ensure adequate recovery');
    }
  }

  // Check for proper rest days
  if (modifications.type !== 'rest') {
    const weekWorkouts = allWorkouts.filter(w => w.week === currentWorkout.week);
    const restDays = weekWorkouts.filter(w => w.type === 'rest').length;
    
    if (restDays < 1) {
      warnings.push('Week has no rest days - recovery is important for adaptation');
    }
  }

  return { violations, warnings, canOverride };
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      planId,
      workoutData
    } = await req.json();

    // Validate required fields
    if (!userId || !planId || !workoutData) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'userId, planId, and workoutData are required'
      }, { status: 400 });
    }

    // Get plan to verify ownership
    const plan = await dbUtils.getActivePlan(userId);
    if (!plan || plan.id !== planId) {
      return NextResponse.json({
        error: 'Plan not found or unauthorized'
      }, { status: 404 });
    }

    // Validate workout data
    const validatedWorkout = validateWorkoutData(workoutData);
    if (validatedWorkout.errors.length > 0) {
      return NextResponse.json({
        error: 'Invalid workout data',
        details: validatedWorkout.errors
      }, { status: 400 });
    }

    // Create new workout
    const workoutId = await dbUtils.createWorkout({
      ...validatedWorkout.data,
      planId,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Get created workout
    const newWorkout = await dbUtils.getWorkoutsByPlan(planId);
    const createdWorkout = newWorkout.find(w => w.id === workoutId);

    return NextResponse.json({
      success: true,
      workout: createdWorkout,
      message: 'Workout added successfully'
    });

  } catch (error) {
    logger.error('Error adding workout:', error);
    return NextResponse.json({
      error: 'Failed to add workout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Validate new workout data
function validateWorkoutData(workoutData: any): { data: any; errors: string[] } {
  const errors: string[] = [];
  const data: any = {};

  // Required fields
  if (!workoutData.week || typeof workoutData.week !== 'number') {
    errors.push('Week is required and must be a number');
  } else {
    data.week = workoutData.week;
  }

  if (!workoutData.day || typeof workoutData.day !== 'string') {
    errors.push('Day is required and must be a string');
  } else {
    data.day = workoutData.day;
  }

  if (!workoutData.type) {
    errors.push('Workout type is required');
  } else {
    const validTypes = ['easy', 'tempo', 'intervals', 'long', 'race-pace', 'recovery', 'time-trial', 'hill', 'fartlek', 'rest'];
    if (!validTypes.includes(workoutData.type)) {
      errors.push('Invalid workout type');
    } else {
      data.type = workoutData.type;
    }
  }

  if (!workoutData.scheduledDate) {
    errors.push('Scheduled date is required');
  } else {
    const date = new Date(workoutData.scheduledDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid scheduled date');
    } else {
      data.scheduledDate = date;
    }
  }

  // Optional fields with validation
  if (workoutData.distance !== undefined) {
    if (typeof workoutData.distance !== 'number' || workoutData.distance < 0) {
      errors.push('Distance must be a positive number');
    } else {
      data.distance = workoutData.distance;
    }
  }

  if (workoutData.duration !== undefined) {
    if (typeof workoutData.duration !== 'number' || workoutData.duration < 0) {
      errors.push('Duration must be a positive number');
    } else {
      data.duration = workoutData.duration;
    }
  }

  if (workoutData.intensity !== undefined) {
    const validIntensities = ['easy', 'moderate', 'threshold', 'vo2max', 'anaerobic'];
    if (!validIntensities.includes(workoutData.intensity)) {
      errors.push('Invalid intensity level');
    } else {
      data.intensity = workoutData.intensity;
    }
  }

  if (workoutData.notes !== undefined) {
    if (typeof workoutData.notes !== 'string') {
      errors.push('Notes must be a string');
    } else {
      data.notes = workoutData.notes;
    }
  }

  return { data, errors };
}