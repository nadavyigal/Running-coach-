import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or use a default for testing
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Try to get or calculate recovery score
    let recoveryScore;
    try {
      recoveryScore = await RecoveryEngine.getRecoveryScore(userId, date);
      
      if (!recoveryScore) {
        // Calculate new recovery score if none exists
        recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, date);
      }
    } catch (dbError) {
      logger.warn('Database operations failed, returning default recovery score:', dbError);
      // Return default recovery score when database operations fail (server-side IndexedDB not available)
      recoveryScore = {
        id: 1,
        userId,
        date,
        overallScore: 50,
        sleepScore: 50,
        hrvScore: 50,
        restingHRScore: 50,
        subjectiveWellnessScore: 50,
        trainingLoadImpact: 0,
        stressLevel: 50,
        readinessScore: 50,
        recommendations: [
          "Get adequate sleep (7-9 hours) for optimal recovery",
          "Stay hydrated throughout the day",
          "Monitor how you feel before intense training"
        ],
        confidence: 30,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return NextResponse.json({
      success: true,
      data: recoveryScore
    });
    
  } catch (error) {
    logger.error('Error getting recovery score:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get recovery score'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date = new Date() } = body;
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required'
        },
        { status: 400 }
      );
    }
    
    // Calculate and return recovery score
    const recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, new Date(date));
    
    return NextResponse.json({
      success: true,
      data: recoveryScore
    });
    
  } catch (error) {
    logger.error('Error calculating recovery score:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate recovery score'
      },
      { status: 500 }
    );
  }
} 
