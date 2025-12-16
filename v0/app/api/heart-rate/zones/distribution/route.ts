import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateZoneDistribution, getHeartRateZoneFromBpm } from '@/lib/heartRateZones';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET - Get zone distribution for a specific run
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const runId = searchParams.get('runId');
    const userId = searchParams.get('userId');
    
    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'Run ID is required' },
        { status: 400 }
      );
    }

    const runIdNumber = parseInt(runId);
    
    // Check if zone distribution already exists
    const existingDistribution = await db.zoneDistributions
      .where('runId')
      .equals(runIdNumber)
      .first();
    
    if (existingDistribution) {
      return NextResponse.json({
        success: true,
        distribution: existingDistribution
      });
    }

    // If not exists, calculate it from heart rate data
    const heartRateData = await db.heartRateData
      .where('runId')
      .equals(runIdNumber)
      .sortBy('timestamp');
    
    if (heartRateData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No heart rate data found for this run' },
        { status: 404 }
      );
    }

    // Get user's heart rate zones
    const run = await db.runs.get(runIdNumber);
    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Run not found' },
        { status: 404 }
      );
    }

    const runUserId = userId ? parseInt(userId) : run.userId;
    const zones = await db.heartRateZones
      .where('userId')
      .equals(runUserId)
      .sortBy('zoneNumber');
    
    if (zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No heart rate zones configured for this user' },
        { status: 404 }
      );
    }

    // Calculate zone distribution
    const distribution = calculateZoneDistribution(heartRateData, zones);
    
    // Save the distribution
    const savedDistribution = await db.zoneDistributions.add({
      runId: runIdNumber,
      ...distribution,
      createdAt: new Date()
    });

    const fullDistribution = await db.zoneDistributions.get(savedDistribution);

    return NextResponse.json({
      success: true,
      distribution: fullDistribution
    });
  } catch (error) {
    logger.error('Error calculating zone distribution:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate zone distribution' },
      { status: 500 }
    );
  }
}

// POST - Calculate and save zone distribution for multiple runs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runIds, userId } = body;
    
    if (!runIds || !Array.isArray(runIds)) {
      return NextResponse.json(
        { success: false, error: 'Run IDs array is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userIdNumber = parseInt(userId);
    const results = [];

    // Get user's heart rate zones
    const zones = await db.heartRateZones
      .where('userId')
      .equals(userIdNumber)
      .sortBy('zoneNumber');
    
    if (zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No heart rate zones configured for this user' },
        { status: 404 }
      );
    }

    for (const runId of runIds) {
      try {
        const runIdNumber = parseInt(runId);
        
        // Check if distribution already exists
        const existingDistribution = await db.zoneDistributions
          .where('runId')
          .equals(runIdNumber)
          .first();
        
        if (existingDistribution) {
          results.push({
            runId: runIdNumber,
            success: true,
            distribution: existingDistribution,
            message: 'Distribution already exists'
          });
          continue;
        }

        // Get heart rate data for this run
        const heartRateData = await db.heartRateData
          .where('runId')
          .equals(runIdNumber)
          .sortBy('timestamp');
        
        if (heartRateData.length === 0) {
          results.push({
            runId: runIdNumber,
            success: false,
            error: 'No heart rate data found'
          });
          continue;
        }

        // Calculate zone distribution
        const distribution = calculateZoneDistribution(heartRateData, zones);
        
        // Save the distribution
        const savedDistribution = await db.zoneDistributions.add({
          runId: runIdNumber,
          ...distribution,
          createdAt: new Date()
        });

        const fullDistribution = await db.zoneDistributions.get(savedDistribution);

        results.push({
          runId: runIdNumber,
          success: true,
          distribution: fullDistribution,
          message: 'Distribution calculated and saved'
        });
      } catch (error) {
        results.push({
          runId: parseInt(runId),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Error processing zone distributions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process zone distributions' },
      { status: 500 }
    );
  }
}