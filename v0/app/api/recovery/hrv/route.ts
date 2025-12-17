import { NextRequest, NextResponse } from 'next/server';
import { db, HRVMeasurement } from '../../../../lib/db';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Get HRV data for the specified date
    const hrvData = await RecoveryEngine.getHRVDataForDate(userId, date);
    
    return NextResponse.json({
      success: true,
      data: hrvData
    });
    
  } catch (error) {
    logger.error('Error getting HRV data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get HRV data'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      deviceId,
      measurementDate,
      measurementTime,
      rmssd,
      pnn50,
      hrvScore,
      measurementQuality,
      measurementDuration,
      artifacts
    } = body;
    
    if (!userId || !deviceId || !measurementDate || !rmssd) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID, device ID, measurement date, and RMSSD are required'
        },
        { status: 400 }
      );
    }
    
    // Create HRV measurement object
    const hrvData: Omit<HRVMeasurement, 'id' | 'createdAt'> = {
      userId,
      deviceId,
      measurementDate: new Date(measurementDate),
      measurementTime: new Date(measurementTime),
      rmssd,
      pnn50,
      hrvScore,
      measurementQuality: measurementQuality || 'good',
      measurementDuration: measurementDuration || 60,
      artifacts
    };
    
    // Save HRV measurement
    const id = await RecoveryEngine.saveHRVMeasurement(hrvData);
    
    // Recalculate recovery score with new HRV data
    await RecoveryEngine.calculateRecoveryScore(userId, new Date(measurementDate));
    
    return NextResponse.json({
      success: true,
      data: { id, ...hrvData }
    });
    
  } catch (error) {
    logger.error('Error saving HRV data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save HRV data'
      },
      { status: 500 }
    );
  }
} 