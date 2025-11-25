import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';

export async function DELETE(req: NextRequest, { params }: { params: { workoutId: string } }) {
  try {
    const workoutId = params.workoutId;
    
    if (!workoutId) {
      return NextResponse.json({
        error: 'Missing workoutId parameter'
      }, { status: 400 });
    }

    // Delete the workout
    await dbUtils.deleteWorkout(parseInt(workoutId));

    return NextResponse.json({
      success: true,
      message: 'Workout deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting workout:', error);
    return NextResponse.json({
      error: 'Failed to delete workout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}