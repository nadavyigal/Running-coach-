import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      raceName,
      raceDate,
      distance,
      targetTime,
      priority,
      location,
      raceType,
      elevationGain,
      courseDifficulty,
      registrationStatus,
      notes
    } = await req.json();

    // Validate required fields
    if (!userId || !raceName || !raceDate || !distance || !priority) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'userId, raceName, raceDate, distance, and priority are required'
      }, { status: 400 });
    }

    // Validate priority
    if (!['A', 'B', 'C'].includes(priority)) {
      return NextResponse.json({
        error: 'Invalid priority',
        details: 'Priority must be A, B, or C'
      }, { status: 400 });
    }

    // Validate race type
    if (raceType && !['road', 'trail', 'track', 'virtual'].includes(raceType)) {
      return NextResponse.json({
        error: 'Invalid race type',
        details: 'Race type must be road, trail, track, or virtual'
      }, { status: 400 });
    }

    // Check if user already has an A-priority race
    if (priority === 'A') {
      const existingPrimaryGoal = await dbUtils.getPrimaryRaceGoal(userId);
      if (existingPrimaryGoal) {
        return NextResponse.json({
          error: 'Primary race goal already exists',
          details: 'You can only have one A-priority race goal at a time'
        }, { status: 409 });
      }
    }

    // Create race goal
    const raceGoalId = await dbUtils.createRaceGoal({
      userId,
      raceName,
      raceDate: new Date(raceDate),
      distance,
      targetTime,
      priority,
      location,
      raceType: raceType || 'road',
      elevationGain,
      courseDifficulty,
      registrationStatus,
      notes
    });

    // Retrieve the created race goal
    const raceGoal = await dbUtils.getRaceGoalById(raceGoalId);

    return NextResponse.json({
      success: true,
      raceGoal,
      message: 'Race goal created successfully'
    });

  } catch (error) {
    console.error('Error creating race goal:', error);
    return NextResponse.json({
      error: 'Failed to create race goal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        error: 'Missing userId parameter'
      }, { status: 400 });
    }

    const raceGoals = await dbUtils.getRaceGoalsByUser(parseInt(userId));

    return NextResponse.json({
      success: true,
      raceGoals
    });

  } catch (error) {
    console.error('Error fetching race goals:', error);
    return NextResponse.json({
      error: 'Failed to fetch race goals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const {
      id,
      userId,
      raceName,
      raceDate,
      distance,
      targetTime,
      priority,
      location,
      raceType,
      elevationGain,
      courseDifficulty,
      registrationStatus,
      notes
    } = await req.json();

    if (!id || !userId) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'id and userId are required'
      }, { status: 400 });
    }

    // Check if race goal exists and belongs to user
    const existingGoal = await dbUtils.getRaceGoalById(id);
    if (!existingGoal || existingGoal.userId !== userId) {
      return NextResponse.json({
        error: 'Race goal not found or unauthorized'
      }, { status: 404 });
    }

    // If changing to A priority, check for existing A-priority race
    if (priority === 'A' && existingGoal.priority !== 'A') {
      const existingPrimaryGoal = await dbUtils.getPrimaryRaceGoal(userId);
      if (existingPrimaryGoal) {
        return NextResponse.json({
          error: 'Primary race goal already exists',
          details: 'You can only have one A-priority race goal at a time'
        }, { status: 409 });
      }
    }

    // Update race goal
    await dbUtils.updateRaceGoal(id, {
      raceName,
      raceDate: raceDate ? new Date(raceDate) : undefined,
      distance,
      targetTime,
      priority,
      location,
      raceType,
      elevationGain,
      courseDifficulty,
      registrationStatus,
      notes
    });

    // Retrieve updated race goal
    const updatedGoal = await dbUtils.getRaceGoalById(id);

    return NextResponse.json({
      success: true,
      raceGoal: updatedGoal,
      message: 'Race goal updated successfully'
    });

  } catch (error) {
    console.error('Error updating race goal:', error);
    return NextResponse.json({
      error: 'Failed to update race goal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'id and userId are required'
      }, { status: 400 });
    }

    // Check if race goal exists and belongs to user
    const existingGoal = await dbUtils.getRaceGoalById(parseInt(id));
    if (!existingGoal || existingGoal.userId !== parseInt(userId)) {
      return NextResponse.json({
        error: 'Race goal not found or unauthorized'
      }, { status: 404 });
    }

    // Delete race goal
    await dbUtils.deleteRaceGoal(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Race goal deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting race goal:', error);
    return NextResponse.json({
      error: 'Failed to delete race goal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}