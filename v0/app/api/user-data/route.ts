import { NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';
import { validateUserData } from '@/lib/userDataValidation';
import { calculateVDOT } from '@/lib/pace-zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PUT /api/user-data
 * Update user physiological data and training metrics
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, updates } = body;
    const resolvedUserId =
      typeof userId === 'string' ? parseInt(userId, 10) : userId;

    if (!resolvedUserId || !Number.isFinite(resolvedUserId)) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid updates object' },
        { status: 400 }
      );
    }

    const validation = validateUserData(updates);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const enrichedUpdates = { ...updates };

    if (updates.referenceRaceDistance && updates.referenceRaceTime) {
      enrichedUpdates.calculatedVDOT = calculateVDOT(
        updates.referenceRaceDistance,
        updates.referenceRaceTime
      );
    }

    enrichedUpdates.updatedAt = new Date();

    await dbUtils.updateUser(resolvedUserId, enrichedUpdates);

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates),
      calculated: enrichedUpdates.calculatedVDOT
        ? { vdot: enrichedUpdates.calculatedVDOT }
        : undefined,
    });
  } catch (error) {
    console.error('Error updating user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user-data
 * Retrieve user physiological data
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    if (!userIdParam) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId parameter' },
        { status: 400 }
      );
    }

    const user = await dbUtils.getUser(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const trainingData = {
      age: user.age,
      experience: user.experience,
      averageWeeklyKm: user.averageWeeklyKm,
      daysPerWeek: user.daysPerWeek,
      referenceRaceDistance: user.referenceRaceDistance,
      referenceRaceTime: user.referenceRaceTime,
      calculatedVDOT: user.calculatedVDOT,
      vo2Max: user.vo2Max,
      lactateThreshold: user.lactateThreshold,
      lactateThresholdHR: user.lactateThresholdHR,
      hrvBaseline: user.hrvBaseline,
      maxHeartRate: user.maxHeartRate,
      maxHeartRateSource: user.maxHeartRateSource,
      restingHeartRate: user.restingHeartRate,
      historicalRuns: user.historicalRuns,
    };

    return NextResponse.json(trainingData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
