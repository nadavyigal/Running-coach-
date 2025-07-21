import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';
import { PeriodizationEngine } from '@/lib/periodization';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');
    const raceGoalId = searchParams.get('raceGoalId');
    const trainingDaysPerWeek = searchParams.get('trainingDaysPerWeek');

    if (!userId || !raceGoalId || !trainingDaysPerWeek) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'userId, raceGoalId, and trainingDaysPerWeek are required'
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
    const fitnessLevel = await dbUtils.assessFitnessLevel(parseInt(userId));

    // Create periodization config
    const config = {
      totalWeeks,
      raceDate,
      trainingDaysPerWeek: parseInt(trainingDaysPerWeek),
      fitnessLevel,
      targetDistance: raceGoal.distance,
      targetTime: raceGoal.targetTime
    };

    // Generate preview (without saving to database)
    const previewPlan = PeriodizationEngine.generatePeriodizedPlan(
      parseInt(userId),
      0, // Temporary plan ID for preview
      raceGoal,
      config
    );

    // Calculate summary statistics
    const summary = calculatePlanSummary(previewPlan.workouts);

    // Calculate target paces
    let targetPaces = null;
    if (raceGoal.targetTime) {
      try {
        targetPaces = await dbUtils.calculateTargetPaces(parseInt(userId), parseInt(raceGoalId));
      } catch (error) {
        console.warn('Could not calculate target paces:', error);
      }
    }

    // Generate phase breakdown
    const phaseBreakdown = previewPlan.phases.map(phase => ({
      phase: phase.phase,
      duration: phase.duration,
      focus: phase.focus,
      weeklyVolumePercentage: phase.weeklyVolumePercentage,
      intensityDistribution: phase.intensityDistribution,
      keyWorkouts: phase.keyWorkouts
    }));

    // Generate key milestones
    const keyMilestones = generateKeyMilestones(previewPlan.workouts, raceGoal);

    // Generate weekly breakdown
    const weeklyBreakdown = generateWeeklyBreakdown(previewPlan.workouts, previewPlan.phases);

    return NextResponse.json({
      success: true,
      preview: {
        raceGoal,
        totalWeeks,
        fitnessLevel,
        summary,
        phaseBreakdown,
        keyMilestones,
        weeklyBreakdown,
        taperStrategy: previewPlan.taperStrategy,
        targetPaces,
        peakWeeklyVolume: previewPlan.peakWeeklyVolume
      }
    });

  } catch (error) {
    console.error('Error generating plan preview:', error);
    return NextResponse.json({
      error: 'Failed to generate plan preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Calculate plan summary statistics
function calculatePlanSummary(workouts: any[]) {
  const runningWorkouts = workouts.filter(w => w.type !== 'rest');
  
  const totalDistance = runningWorkouts.reduce((sum, w) => sum + w.distance, 0);
  const totalDuration = runningWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
  const averageWeeklyDistance = totalDistance / (workouts.length / 7);

  // Calculate workout type distribution
  const workoutTypeCount = runningWorkouts.reduce((acc, w) => {
    acc[w.type] = (acc[w.type] || 0) + 1;
    return acc;
  }, {});

  const workoutDistribution = Object.entries(workoutTypeCount).map(([type, count]) => ({
    type,
    count: count as number,
    percentage: Math.round(((count as number) / runningWorkouts.length) * 100)
  }));

  // Calculate intensity distribution
  const intensityCount = runningWorkouts.reduce((acc, w) => {
    const intensity = w.intensity || 'easy';
    acc[intensity] = (acc[intensity] || 0) + 1;
    return acc;
  }, {});

  const intensityDistribution = Object.entries(intensityCount).map(([intensity, count]) => ({
    intensity,
    count: count as number,
    percentage: Math.round(((count as number) / runningWorkouts.length) * 100)
  }));

  // Find peak week
  const weeklyDistances = {};
  runningWorkouts.forEach(w => {
    const week = w.week;
    weeklyDistances[week] = (weeklyDistances[week] || 0) + w.distance;
  });

  const peakWeekDistance = Math.max(...Object.values(weeklyDistances));
  const peakWeek = Object.entries(weeklyDistances).find(([_, distance]) => distance === peakWeekDistance)?.[0];

  return {
    totalDistance: Math.round(totalDistance),
    totalDuration: Math.round(totalDuration),
    averageWeeklyDistance: Math.round(averageWeeklyDistance),
    totalWorkouts: runningWorkouts.length,
    workoutDistribution,
    intensityDistribution,
    peakWeekDistance: Math.round(peakWeekDistance),
    peakWeek: parseInt(peakWeek || '0')
  };
}

// Generate key milestones
function generateKeyMilestones(workouts: any[], raceGoal: any) {
  const milestones = [];
  
  // Find first long run
  const firstLongRun = workouts.find(w => w.type === 'long');
  if (firstLongRun) {
    milestones.push({
      week: firstLongRun.week,
      milestone: `First long run (${firstLongRun.distance}km)`,
      description: 'Building endurance foundation'
    });
  }

  // Find first tempo run
  const firstTempo = workouts.find(w => w.type === 'tempo');
  if (firstTempo) {
    milestones.push({
      week: firstTempo.week,
      milestone: 'First tempo run',
      description: 'Beginning lactate threshold development'
    });
  }

  // Find first interval session
  const firstIntervals = workouts.find(w => w.type === 'intervals');
  if (firstIntervals) {
    milestones.push({
      week: firstIntervals.week,
      milestone: 'First interval session',
      description: 'VO2 max and speed development begins'
    });
  }

  // Find first race-pace run
  const firstRacePace = workouts.find(w => w.type === 'race-pace');
  if (firstRacePace) {
    milestones.push({
      week: firstRacePace.week,
      milestone: 'First race-pace run',
      description: 'Practicing target race rhythm'
    });
  }

  // Find peak week
  const weeklyDistances = {};
  workouts.filter(w => w.type !== 'rest').forEach(w => {
    weeklyDistances[w.week] = (weeklyDistances[w.week] || 0) + w.distance;
  });
  const peakWeekDistance = Math.max(...Object.values(weeklyDistances));
  const peakWeek = Object.entries(weeklyDistances).find(([_, distance]) => distance === peakWeekDistance)?.[0];
  
  if (peakWeek) {
    milestones.push({
      week: parseInt(peakWeek),
      milestone: `Peak training week (${Math.round(peakWeekDistance)}km)`,
      description: 'Maximum training volume reached'
    });
  }

  // Find time trial
  const timeTrial = workouts.find(w => w.type === 'time-trial');
  if (timeTrial) {
    milestones.push({
      week: timeTrial.week,
      milestone: 'Fitness test time trial',
      description: 'Assess progress and adjust targets'
    });
  }

  // Race week
  const lastWeek = Math.max(...workouts.map(w => w.week));
  milestones.push({
    week: lastWeek,
    milestone: `${raceGoal.raceName} - Race Day!`,
    description: 'Put your training to the test'
  });

  return milestones.sort((a, b) => a.week - b.week);
}

// Generate weekly breakdown
function generateWeeklyBreakdown(workouts: any[], phases: any[]) {
  const weeklyBreakdown = [];
  const weeks = [...new Set(workouts.map(w => w.week))].sort((a, b) => a - b);

  weeks.forEach(week => {
    const weekWorkouts = workouts.filter(w => w.week === week);
    const runningWorkouts = weekWorkouts.filter(w => w.type !== 'rest');
    
    const totalDistance = runningWorkouts.reduce((sum, w) => sum + w.distance, 0);
    const totalDuration = runningWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    
    // Find which phase this week belongs to
    let currentPhase = phases[0];
    let weekCount = 0;
    for (const phase of phases) {
      if (week <= weekCount + phase.duration) {
        currentPhase = phase;
        break;
      }
      weekCount += phase.duration;
    }

    const workoutTypes = runningWorkouts.map(w => w.type);
    const keyWorkout = workoutTypes.find(t => t !== 'easy' && t !== 'recovery') || 'easy';

    weeklyBreakdown.push({
      week,
      phase: currentPhase.phase,
      totalDistance: Math.round(totalDistance),
      totalDuration: Math.round(totalDuration),
      workoutCount: runningWorkouts.length,
      keyWorkout,
      focus: currentPhase.focus,
      workouts: weekWorkouts.map(w => ({
        day: w.day,
        type: w.type,
        distance: w.distance,
        duration: w.duration,
        intensity: w.intensity,
        notes: w.notes
      }))
    });
  });

  return weeklyBreakdown;
}