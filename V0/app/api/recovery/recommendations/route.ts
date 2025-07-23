import { NextRequest, NextResponse } from 'next/server';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Get current recovery score to generate recommendations
    const recoveryScore = await RecoveryEngine.getRecoveryScore(userId, date);
    
    if (!recoveryScore) {
      // Calculate recovery score if none exists
      const newScore = await RecoveryEngine.calculateRecoveryScore(userId, date);
      return NextResponse.json({
        success: true,
        data: {
          recommendations: newScore.recommendations,
          recoveryScore: newScore.overallScore,
          confidence: newScore.confidence
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        recommendations: recoveryScore.recommendations,
        recoveryScore: recoveryScore.overallScore,
        confidence: recoveryScore.confidence
      }
    });
    
  } catch (error) {
    console.error('Error getting recovery recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get recovery recommendations'
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
    
    // Calculate recovery score and get recommendations
    const recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, new Date(date));
    
    return NextResponse.json({
      success: true,
      data: {
        recommendations: recoveryScore.recommendations,
        recoveryScore: recoveryScore.overallScore,
        confidence: recoveryScore.confidence,
        breakdown: {
          sleepScore: recoveryScore.sleepScore,
          hrvScore: recoveryScore.hrvScore,
          restingHRScore: recoveryScore.restingHRScore,
          subjectiveWellnessScore: recoveryScore.subjectiveWellnessScore,
          trainingLoadImpact: recoveryScore.trainingLoadImpact,
          stressLevel: recoveryScore.stressLevel
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating recovery recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate recovery recommendations'
      },
      { status: 500 }
    );
  }
} 