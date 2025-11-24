import { NextRequest, NextResponse } from 'next/server';
import { DataFusionEngine } from '../../../../lib/dataFusionEngine';
import { db } from '../../../../lib/db';

const fusionEngine = new DataFusionEngine();

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/data-fusion/quality - Get data quality metrics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = parseInt(searchParams.get('userId') || '1');
    const days = parseInt(searchParams.get('days') || '7');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get data sources
    const dataSources = await fusionEngine.getDataSources(userId);
    
    // Get fused data points for the period
    const fusedPoints = await db.fusedDataPoints
      .where('userId')
      .equals(userId)
      .and(point => point.timestamp >= startDate)
      .toArray();
    
    // Get conflicts for the period
    const conflicts = await db.dataConflicts
      .where('createdAt')
      .above(startDate)
      .toArray();
    
    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(fusedPoints, conflicts, dataSources);
    
    // Get data completeness by type
    const completenessMetrics = await calculateCompletenessMetrics(userId, startDate, days);
    
    // Get source reliability trends
    const reliabilityTrends = await calculateReliabilityTrends(dataSources, fusedPoints);
    
    return NextResponse.json({
      success: true,
      data: {
        overallQuality: qualityMetrics,
        completeness: completenessMetrics,
        reliability: reliabilityTrends,
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        summary: {
          totalDataPoints: fusedPoints.length,
          totalConflicts: conflicts.length,
          conflictRate: fusedPoints.length > 0 ? (conflicts.length / fusedPoints.length * 100).toFixed(1) + '%' : '0%',
          avgConfidence: fusedPoints.length > 0 ? 
            Math.round(fusedPoints.reduce((sum, p) => sum + p.confidence, 0) / fusedPoints.length) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting data quality metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve data quality metrics'
      },
      { status: 500 }
    );
  }
}

// Calculate overall quality metrics
function calculateQualityMetrics(fusedPoints: any[], conflicts: any[], dataSources: any[]) {
  if (fusedPoints.length === 0) {
    return {
      overallScore: 0,
      confidenceScore: 0,
      accuracyScore: 0,
      reliabilityScore: 0,
      conflictScore: 100
    };
  }
  
  // Calculate average confidence
  const avgConfidence = fusedPoints.reduce((sum, p) => sum + p.confidence, 0) / fusedPoints.length;
  
  // Calculate average quality score
  const avgQuality = fusedPoints.reduce((sum, p) => sum + p.qualityScore, 0) / fusedPoints.length;
  
  // Calculate conflict score (lower conflicts = higher score)
  const conflictRate = conflicts.length / fusedPoints.length;
  const conflictScore = Math.max(0, 100 - (conflictRate * 100));
  
  // Calculate source reliability average
  const avgReliability = dataSources.length > 0 ? 
    dataSources.reduce((sum, s) => sum + s.reliability, 0) / dataSources.length : 0;
  
  // Overall score is weighted average
  const overallScore = Math.round(
    (avgConfidence * 0.3) +
    (avgQuality * 0.25) +
    (conflictScore * 0.25) +
    (avgReliability * 0.2)
  );
  
  return {
    overallScore,
    confidenceScore: Math.round(avgConfidence),
    accuracyScore: Math.round(avgQuality),
    reliabilityScore: Math.round(avgReliability),
    conflictScore: Math.round(conflictScore)
  };
}

// Calculate data completeness metrics
async function calculateCompletenessMetrics(userId: number, startDate: Date, days: number) {
  const dataTypes = ['heart_rate', 'steps', 'calories', 'distance', 'pace', 'sleep'];
  const completeness: { [key: string]: any } = {};
  
  for (const dataType of dataTypes) {
    const points = await db.fusedDataPoints
      .where('userId')
      .equals(userId)
      .and(point => point.dataType === dataType && point.timestamp >= startDate)
      .toArray();
    
    // Calculate expected data points (assuming hourly data)
    const expectedPoints = days * 24;
    const actualPoints = points.length;
    const completenessPercent = expectedPoints > 0 ? 
      Math.min(100, (actualPoints / expectedPoints) * 100) : 0;
    
    // Find gaps (periods with no data)
    const gaps = findDataGaps(points, startDate, new Date());
    
    completeness[dataType] = {
      percentage: Math.round(completenessPercent),
      actualPoints,
      expectedPoints,
      gaps: gaps.length,
      largestGapHours: gaps.length > 0 ? Math.max(...gaps.map(g => g.durationHours)) : 0,
      avgQuality: points.length > 0 ? 
        Math.round(points.reduce((sum, p) => sum + p.qualityScore, 0) / points.length) : 0
    };
  }
  
  return completeness;
}

// Calculate source reliability trends
async function calculateReliabilityTrends(dataSources: any[], fusedPoints: any[]) {
  const trends: { [key: string]: any } = {};
  
  for (const source of dataSources) {
    const sourcePoints = fusedPoints.filter(p => p.primarySource === source.deviceId);
    
    if (sourcePoints.length === 0) {
      trends[source.deviceId] = {
        deviceType: source.deviceType,
        dataPoints: 0,
        avgConfidence: 0,
        avgQuality: 0,
        trend: 'stable',
        lastSync: source.lastSync,
        status: 'inactive'
      };
      continue;
    }
    
    // Calculate averages
    const avgConfidence = Math.round(
      sourcePoints.reduce((sum, p) => sum + p.confidence, 0) / sourcePoints.length
    );
    const avgQuality = Math.round(
      sourcePoints.reduce((sum, p) => sum + p.qualityScore, 0) / sourcePoints.length
    );
    
    // Determine trend (simplified - could be more sophisticated)
    const recentPoints = sourcePoints.slice(-10);
    const olderPoints = sourcePoints.slice(0, -10);
    
    let trend = 'stable';
    if (recentPoints.length > 0 && olderPoints.length > 0) {
      const recentAvg = recentPoints.reduce((sum, p) => sum + p.confidence, 0) / recentPoints.length;
      const olderAvg = olderPoints.reduce((sum, p) => sum + p.confidence, 0) / olderPoints.length;
      
      if (recentAvg > olderAvg + 5) trend = 'improving';
      else if (recentAvg < olderAvg - 5) trend = 'declining';
    }
    
    trends[source.deviceId] = {
      deviceType: source.deviceType,
      dataPoints: sourcePoints.length,
      avgConfidence,
      avgQuality,
      trend,
      lastSync: source.lastSync,
      status: _determineSyncStatus(source.lastSync)
    };
  }
  
  return trends;
}

// Find gaps in data
function findDataGaps(points: any[], startDate: Date, endDate: Date) {
  if (points.length === 0) {
    return [{
      start: startDate,
      end: endDate,
      durationHours: (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
    }];
  }
  
  // Sort points by timestamp
  const sortedPoints = points.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const gaps = [];
  const gapThresholdHours = 2; // Consider a gap if no data for 2+ hours
  
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const current = new Date(sortedPoints[i].timestamp);
    const next = new Date(sortedPoints[i + 1].timestamp);
    const gapHours = (next.getTime() - current.getTime()) / (1000 * 60 * 60);
    
    if (gapHours > gapThresholdHours) {
      gaps.push({
        start: current,
        end: next,
        durationHours: gapHours
      });
    }
  }
  
  return gaps;
}

// Determine sync status
function _determineSyncStatus(lastSync: Date): 'online' | 'syncing' | 'offline' | 'error' {
  const now = new Date();
  const timeDiff = now.getTime() - lastSync.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff < 1) return 'online';
  if (hoursDiff < 6) return 'syncing';
  if (hoursDiff < 24) return 'offline';
  return 'error';
}