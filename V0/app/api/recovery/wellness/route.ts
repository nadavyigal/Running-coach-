import { NextRequest, NextResponse } from 'next/server';
import { db, SubjectiveWellness } from '../../../../lib/db';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Get wellness data for the specified date
    const wellnessData = await RecoveryEngine.getSubjectiveWellnessForDate(userId, date);
    
    return NextResponse.json({
      success: true,
      data: wellnessData
    });
    
  } catch (error) {
    console.error('Error getting wellness data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get wellness data'
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
      date,
      energyLevel,
      moodScore,
      sorenessLevel,
      stressLevel,
      motivationLevel,
      notes
    } = body;
    
    if (!userId || !date) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID and date are required'
        },
        { status: 400 }
      );
    }
    
    // Validate wellness scores (1-10 scale)
    const scores = [energyLevel, moodScore, sorenessLevel, stressLevel, motivationLevel];
    const isValidScore = (score: number) => score >= 1 && score <= 10;
    
    if (scores.some(score => !isValidScore(score))) {
      return NextResponse.json(
        {
          success: false,
          error: 'All wellness scores must be between 1 and 10'
        },
        { status: 400 }
      );
    }
    
    // Create wellness data object
    const wellnessData: Omit<SubjectiveWellness, 'id' | 'createdAt'> = {
      userId,
      date: new Date(date),
      energyLevel,
      moodScore,
      sorenessLevel,
      stressLevel,
      motivationLevel,
      notes
    };
    
    // Save wellness data
    const id = await RecoveryEngine.saveSubjectiveWellness(wellnessData);
    
    // Recalculate recovery score with new wellness data
    await RecoveryEngine.calculateRecoveryScore(userId, new Date(date));
    
    return NextResponse.json({
      success: true,
      data: { id, ...wellnessData }
    });
    
  } catch (error) {
    console.error('Error saving wellness data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save wellness data'
      },
      { status: 500 }
    );
  }
} 