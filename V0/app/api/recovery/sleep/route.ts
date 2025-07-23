import { NextRequest, NextResponse } from 'next/server';
import { db, SleepData } from '../../../../lib/db';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Get sleep data for the specified date
    const sleepData = await RecoveryEngine.getSleepDataForDate(userId, date);
    
    return NextResponse.json({
      success: true,
      data: sleepData
    });
    
  } catch (error) {
    console.error('Error getting sleep data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get sleep data'
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
      date,
      bedTime,
      sleepTime,
      wakeTime,
      totalSleepTime,
      sleepEfficiency,
      deepSleepTime,
      lightSleepTime,
      remSleepTime,
      awakeDuration,
      sleepQualityScore
    } = body;
    
    if (!userId || !deviceId || !date) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID, device ID, and date are required'
        },
        { status: 400 }
      );
    }
    
    // Create sleep data object
    const sleepData: Omit<SleepData, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      deviceId,
      date: new Date(date),
      bedTime: new Date(bedTime),
      sleepTime: new Date(sleepTime),
      wakeTime: new Date(wakeTime),
      totalSleepTime,
      sleepEfficiency,
      deepSleepTime,
      lightSleepTime,
      remSleepTime,
      awakeDuration,
      sleepQualityScore
    };
    
    // Save sleep data
    const id = await RecoveryEngine.saveSleepData(sleepData);
    
    // Recalculate recovery score with new sleep data
    await RecoveryEngine.calculateRecoveryScore(userId, new Date(date));
    
    return NextResponse.json({
      success: true,
      data: { id, ...sleepData }
    });
    
  } catch (error) {
    console.error('Error saving sleep data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save sleep data'
      },
      { status: 500 }
    );
  }
} 