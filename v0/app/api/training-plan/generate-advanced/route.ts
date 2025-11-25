import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';
import { PeriodizationEngine } from '@/lib/periodization';

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      raceGoalId,
      trainingDaysPerWeek,
      planTitle,
      planDescription
    } = await req.json();

    // Validate required fields
    if (!userId || !raceGoalId || !trainingDaysPerWeek) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'userId, raceGoalId, and trainingDaysPerWeek are required'
      }, { status: 400 });
    }

    // Get race goal
    const raceGoal = await dbUtils.getRaceGoalById(raceGoalId);
    if (!raceGoal) {
      return NextResponse.json({
        error: 'Race goal not found'
      }, { status: 404 });
    }

    // Check if race goal belongs to user
    if (raceGoal.userId !== userId) {
      return NextResponse.json({
        error: 'Unauthorized access to race goal'
      }, { status: 403 });
    }

    // Calculate weeks until race
    const now = new Date();
    const raceDate = new Date(raceGoal.raceDate);
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((raceDate.getTime() - now.getTime()) / millisecondsPerWeek);

    if (totalWeeks < 4) {
      return NextResponse.json({
        error: 'Insufficient time for training plan',
        details: 'At least 4 weeks are required for a proper training plan'
      }, { status: 400 });
    }

    // Assess fitness level
    const fitnessLevel = await dbUtils.assessFitnessLevel(userId);

    // Create periodization config
    const config = {
      totalWeeks,
      raceDate,
      trainingDaysPerWeek,
      fitnessLevel,
      targetDistance: raceGoal.distance,
      targetTime: raceGoal.targetTime
    };

    // Create plan record
    const planId = await dbUtils.createAdvancedPlan({
      userId,
      title: planTitle || `${raceGoal.raceName} Training Plan`,
      description: planDescription || `Periodized training plan for ${raceGoal.raceName}`,
      startDate: now,
      endDate: raceDate,
      totalWeeks,
      isActive: true,
      planType: 'periodized',
      raceGoalId,
      targetDistance: raceGoal.distance,
      targetTime: raceGoal.targetTime,
      fitnessLevel,
      trainingDaysPerWeek,
      peakWeeklyVolume: 0 // Will be calculated by periodization engine
    });

    // Generate periodized plan
    const workoutPlan = PeriodizationEngine.generatePeriodizedPlan(
      userId,
      planId,
      raceGoal,
      config
    );

    // Update plan with periodization data
    await dbUtils.updatePlan(planId, {
      periodization: workoutPlan.phases,
      peakWeeklyVolume: workoutPlan.peakWeeklyVolume
    });

    // Create workout records
    for (const workout of workoutPlan.workouts) {
      await dbUtils.createWorkout({
        ...workout,
        planId
      });
    }

    // Calculate target paces
    let targetPaces = null;
    if (raceGoal.targetTime) {
      try {
        targetPaces = await dbUtils.calculateTargetPaces(userId, raceGoalId);
      } catch (error) {
        console.warn('Could not calculate target paces:', error);
      }
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: planId,
        title: planTitle || `${raceGoal.raceName} Training Plan`,
        description: planDescription || `Periodized training plan for ${raceGoal.raceName}`,
        totalWeeks,
        raceGoal,
        periodization: workoutPlan.phases,
        peakWeeklyVolume: workoutPlan.peakWeeklyVolume,
        taperStrategy: workoutPlan.taperStrategy,
        fitnessLevel,
        targetPaces
      },
      workoutCount: workoutPlan.workouts.length,
      message: 'Advanced training plan generated successfully'
    });

  } catch (error) {
    console.error('Error generating advanced training plan:', error);
    return NextResponse.json({
      error: 'Failed to generate training plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const raceGoalId = searchParams.get('raceGoalId');

    if (!userId || !raceGoalId) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'userId and raceGoalId are required'
      }, { status: 400 });
    }

    // Get race goal
    const raceGoal = await dbUtils.getRaceGoalById(parseInt(raceGoalId));
    if (!raceGoal) {
      return NextResponse.json({
        error: 'Race goal not found'
      }, { status: 404 });
    }

    // Check authorization
    if (raceGoal.userId !== parseInt(userId)) {
      return NextResponse.json({
        error: 'Unauthorized access to race goal'
      }, { status: 403 });
    }

    // Get existing plans for this race goal
    const plans = await dbUtils.getPlansByRaceGoal(parseInt(raceGoalId));

    return NextResponse.json({
      success: true,
      raceGoal,
      plans
    });

  } catch (error) {
    console.error('Error fetching advanced training plans:', error);
    return NextResponse.json({
      error: 'Failed to fetch training plans',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}