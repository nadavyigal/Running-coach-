import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get heart rate data for a specific run
export async function GET(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid run ID'
      }, { status: 400 });
    }

    // Get heart rate data for the run
    const heartRateData = await db.heartRateData
      .where('runId')
      .equals(runId)
      .orderBy('timestamp')
      .toArray();

    // Calculate statistics if data exists
    let stats = null;
    if (heartRateData.length > 0) {
      const heartRates = heartRateData.map(d => d.heartRate);
      const avgHR = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
      const maxHR = Math.max(...heartRates);
      const minHR = Math.min(...heartRates);

      stats = {
        averageHeartRate: avgHR,
        maxHeartRate: maxHR,
        minHeartRate: minHR,
        dataPoints: heartRateData.length,
        duration: heartRateData.length > 0 ? 
          (new Date(heartRateData[heartRateData.length - 1].timestamp).getTime() - 
           new Date(heartRateData[0].timestamp).getTime()) / 1000 : 0
      };
    }

    return NextResponse.json({
      success: true,
      heartRateData,
      stats
    });

  } catch (error) {
    console.error('Error fetching heart rate data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch heart rate data'
    }, { status: 500 });
  }
}

// POST - Add heart rate data for a run
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  try {
    const runId = parseInt(params.runId);
    const { deviceId, heartRatePoints } = await req.json();

    if (!runId || !deviceId || !heartRatePoints) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: deviceId, heartRatePoints'
      }, { status: 400 });
    }

    // Validate heart rate points
    if (!Array.isArray(heartRatePoints)) {
      return NextResponse.json({
        success: false,
        error: 'heartRatePoints must be an array'
      }, { status: 400 });
    }

    // Add heart rate data points
    const dataToAdd = heartRatePoints.map(point => ({
      runId,
      deviceId,
      timestamp: new Date(point.timestamp),
      heartRate: point.heartRate,
      accuracy: point.accuracy || 'medium' as const,
      createdAt: new Date()
    }));

    // Validate heart rate values (30-220 BPM is reasonable range)
    const invalidData = dataToAdd.filter(d => d.heartRate < 30 || d.heartRate > 220);
    if (invalidData.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Invalid heart rate values detected. Heart rate must be between 30-220 BPM.`,
        invalidCount: invalidData.length
      }, { status: 400 });
    }

    await db.heartRateData.bulkAdd(dataToAdd);

    return NextResponse.json({
      success: true,
      message: `Added ${dataToAdd.length} heart rate data points`,
      addedCount: dataToAdd.length
    });

  } catch (error) {
    console.error('Error adding heart rate data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add heart rate data'
    }, { status: 500 });
  }
}