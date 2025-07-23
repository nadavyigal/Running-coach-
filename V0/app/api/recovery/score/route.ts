import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or use a default for testing
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    
    // Get or calculate recovery score
    let recoveryScore = await RecoveryEngine.getRecoveryScore(userId, date);
    
    if (!recoveryScore) {
      // Calculate new recovery score if none exists
      recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, date);
    }
    
    return NextResponse.json({
      success: true,
      data: recoveryScore
    });
    
  } catch (error) {
    console.error('Error getting recovery score:', error);
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
    console.error('Error calculating recovery score:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate recovery score'
      },
      { status: 500 }
    );
  }
} 