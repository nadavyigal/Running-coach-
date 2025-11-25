import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get running dynamics data for a specific run
export async function GET(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid run ID'
      }, { status: 400 });
    }

    const runningDynamics = await db.runningDynamicsData
      .where('runId')
      .equals(runId)
      .first();

    return NextResponse.json({
      success: true,
      runningDynamics
    });

  } catch (error) {
    console.error('Error fetching running dynamics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch running dynamics'
    }, { status: 500 });
  }
}

// POST - Add running dynamics data for a run
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);
    const dynamicsData = await req.json();

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid run ID'
      }, { status: 400 });
    }

    const { deviceId, ...dynamics } = dynamicsData;

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Device ID is required'
      }, { status: 400 });
    }

    // Validate running dynamics ranges
    if (dynamics.averageCadence && (dynamics.averageCadence < 120 || dynamics.averageCadence > 220)) {
      return NextResponse.json({
        success: false,
        error: 'Average cadence must be between 120-220 steps/min'
      }, { status: 400 });
    }

    if (dynamics.averageGroundContactTime && (dynamics.averageGroundContactTime < 100 || dynamics.averageGroundContactTime > 400)) {
      return NextResponse.json({
        success: false,
        error: 'Ground contact time must be between 100-400 milliseconds'
      }, { status: 400 });
    }

    if (dynamics.averageVerticalOscillation && (dynamics.averageVerticalOscillation < 3 || dynamics.averageVerticalOscillation > 15)) {
      return NextResponse.json({
        success: false,
        error: 'Vertical oscillation must be between 3-15 centimeters'
      }, { status: 400 });
    }

    if (dynamics.averageStrideLength && (dynamics.averageStrideLength < 0.5 || dynamics.averageStrideLength > 2.5)) {
      return NextResponse.json({
        success: false,
        error: 'Stride length must be between 0.5-2.5 meters'
      }, { status: 400 });
    }

    // Check if dynamics already exist for this run
    const existingDynamics = await db.runningDynamicsData
      .where({ runId, deviceId })
      .first();

    if (existingDynamics) {
      // Update existing dynamics
      await db.runningDynamicsData.update(existingDynamics.id!, {
        ...dynamics,
        updatedAt: new Date()
      });

      const updatedDynamics = await db.runningDynamicsData.get(existingDynamics.id!);
      
      return NextResponse.json({
        success: true,
        runningDynamics: updatedDynamics,
        message: 'Running dynamics updated successfully'
      });
    } else {
      // Create new dynamics entry
      const newDynamicsId = await db.runningDynamicsData.add({
        runId,
        deviceId,
        ...dynamics,
        createdAt: new Date()
      });

      const newDynamics = await db.runningDynamicsData.get(newDynamicsId);

      return NextResponse.json({
        success: true,
        runningDynamics: newDynamics,
        message: 'Running dynamics added successfully'
      });
    }

  } catch (error) {
    console.error('Error adding/updating running dynamics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process running dynamics'
    }, { status: 500 });
  }
}