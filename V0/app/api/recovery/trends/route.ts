import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get recovery trends
    const trends = await RecoveryEngine.getRecoveryTrends(userId, days);
    
    // Calculate trend statistics
    const overallScores = trends.map(t => t.overallScore);
    const sleepScores = trends.map(t => t.sleepScore);
    const hrvScores = trends.map(t => t.hrvScore);
    const restingHRScores = trends.map(t => t.restingHRScore);
    
    const calculateStats = (scores: number[]) => {
      if (scores.length === 0) return { avg: 0, min: 0, max: 0, trend: 'stable' };
      
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      
      // Calculate trend (simple linear regression)
      let trend = 'stable';
      if (scores.length >= 2) {
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 5) trend = 'improving';
        else if (secondAvg < firstAvg - 5) trend = 'declining';
      }
      
      return { avg: Math.round(avg), min, max, trend };
    };
    
    const stats = {
      overall: calculateStats(overallScores),
      sleep: calculateStats(sleepScores),
      hrv: calculateStats(hrvScores),
      restingHR: calculateStats(restingHRScores)
    };
    
    return NextResponse.json({
      success: true,
      data: {
        trends,
        stats,
        period: `${days} days`
      }
    });
    
  } catch (error) {
    console.error('Error getting recovery trends:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get recovery trends'
      },
      { status: 500 }
    );
  }
} 