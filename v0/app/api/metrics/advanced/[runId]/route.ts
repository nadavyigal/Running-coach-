import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET - Get advanced metrics for a specific run
export async function GET(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid run ID'
      }, { status: 400 });
    }

    const advancedMetrics = await db.advancedMetrics
      .where('runId')
      .equals(runId)
      .first();

    return NextResponse.json({
      success: true,
      advancedMetrics
    });

  } catch (error) {
    logger.error('Error fetching advanced metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch advanced metrics'
    }, { status: 500 });
  }
}

// POST - Add advanced metrics for a run
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);
    const metricsData = await req.json();

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid run ID'
      }, { status: 400 });
    }

    const { deviceId, ...metrics } = metricsData;

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Device ID is required'
      }, { status: 400 });
    }

    // Validate metric ranges
    if (metrics.vo2Max && (metrics.vo2Max < 20 || metrics.vo2Max > 90)) {
      return NextResponse.json({
        success: false,
        error: 'VO2 Max must be between 20-90'
      }, { status: 400 });
    }

    if (metrics.lactateThresholdHR && (metrics.lactateThresholdHR < 60 || metrics.lactateThresholdHR > 200)) {
      return NextResponse.json({
        success: false,
        error: 'Lactate Threshold HR must be between 60-200 BPM'
      }, { status: 400 });
    }

    if (metrics.trainingStressScore && (metrics.trainingStressScore < 0 || metrics.trainingStressScore > 500)) {
      return NextResponse.json({
        success: false,
        error: 'Training Stress Score must be between 0-500'
      }, { status: 400 });
    }

    // Check if metrics already exist for this run
    const existingMetrics = await db.advancedMetrics
      .where({ runId, deviceId })
      .first();

    if (existingMetrics) {
      // Update existing metrics
      await db.advancedMetrics.update(existingMetrics.id!, {
        ...metrics,
        updatedAt: new Date()
      });

      const updatedMetrics = await db.advancedMetrics.get(existingMetrics.id!);
      
      return NextResponse.json({
        success: true,
        advancedMetrics: updatedMetrics,
        message: 'Advanced metrics updated successfully'
      });
    } else {
      // Create new metrics entry
      const newMetricsId = await db.advancedMetrics.add({
        runId,
        deviceId,
        ...metrics,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const newMetrics = await db.advancedMetrics.get(newMetricsId);

      return NextResponse.json({
        success: true,
        advancedMetrics: newMetrics,
        message: 'Advanced metrics added successfully'
      });
    }

  } catch (error) {
    logger.error('Error adding/updating advanced metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process advanced metrics'
    }, { status: 500 });
  }
}