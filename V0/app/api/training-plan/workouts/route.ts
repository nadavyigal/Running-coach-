import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    
    if (!planId) {
      return NextResponse.json({
        error: 'Missing planId parameter'
      }, { status: 400 });
    }

    // Get workouts for the plan
    const workouts = await dbUtils.getWorkoutsByPlan(parseInt(planId));

    return NextResponse.json({
      success: true,
      workouts: workouts.map(workout => ({
        id: workout.id,
        week: workout.week,
        day: workout.day,
        type: workout.type,
        distance: workout.distance,
        duration: workout.duration,
        intensity: workout.intensity,
        notes: workout.notes,
        scheduledDate: workout.scheduledDate,
        completed: workout.completed,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching workouts:', error);
    return NextResponse.json({
      error: 'Failed to fetch workouts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}