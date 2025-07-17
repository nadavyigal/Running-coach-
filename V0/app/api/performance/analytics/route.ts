import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/db';

const AnalyticsQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y', 'all-time']).nullable().optional().default('30d'),
  userId: z.string().transform(Number).optional(),
  metrics: z.array(z.enum(['pace', 'distance', 'consistency', 'performance', 'records'])).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = AnalyticsQuerySchema.parse({
      timeRange: searchParams.get('timeRange'),
      userId: searchParams.get('userId'),
      metrics: searchParams.get('metrics')?.split(','),
    });

    const userId = params.userId || 1; // Default to user 1 for now
    const timeRange = params.timeRange;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all-time':
        startDate.setFullYear(2000); // Far back date
        break;
    }

    // Get performance metrics for the time range
    const performanceMetrics = await dbUtils.getPerformanceMetrics(userId, startDate, endDate);
    
    // Get runs for trend analysis
    const runs = await dbUtils.getRunsInTimeRange(userId, startDate, endDate);
    
    // Calculate performance trends
    const trends = await dbUtils.calculatePerformanceTrends(runs);
    
    // Get personal records
    const personalRecords = await dbUtils.getPersonalRecords(userId);
    
    // Get performance insights
    const insights = await dbUtils.getPerformanceInsights(userId, startDate, endDate);
    
    // Get period comparison data
    const previousPeriodStart = new Date(startDate);
    const previousPeriodEnd = new Date(endDate);
    const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    previousPeriodStart.setDate(previousPeriodStart.getDate() - rangeDays);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - rangeDays);
    
    const previousPeriodRuns = await dbUtils.getRunsInTimeRange(userId, previousPeriodStart, previousPeriodEnd);
    const previousPeriodTrends = await dbUtils.calculatePerformanceTrends(previousPeriodRuns);
    
    // Calculate comparison metrics
    const comparison = {
      totalRuns: {
        current: runs.length,
        previous: previousPeriodRuns.length,
        change: runs.length - previousPeriodRuns.length,
      },
      totalDistance: {
        current: runs.reduce((sum, run) => sum + run.distance, 0),
        previous: previousPeriodRuns.reduce((sum, run) => sum + run.distance, 0),
        change: runs.reduce((sum, run) => sum + run.distance, 0) - previousPeriodRuns.reduce((sum, run) => sum + run.distance, 0),
      },
      averagePace: {
        current: trends.averagePace,
        previous: previousPeriodTrends.averagePace,
        change: trends.averagePace - previousPeriodTrends.averagePace,
      },
      consistencyScore: {
        current: trends.consistencyScore,
        previous: previousPeriodTrends.consistencyScore,
        change: trends.consistencyScore - previousPeriodTrends.consistencyScore,
      },
    };

    // Format response
    const response = {
      timeRange,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalRuns: runs.length,
        totalDistance: runs.reduce((sum, run) => sum + run.distance, 0),
        totalDuration: runs.reduce((sum, run) => sum + run.duration, 0),
        averagePace: trends.averagePace,
        consistencyScore: trends.consistencyScore,
        performanceScore: trends.performanceScore,
      },
      trends: {
        paceProgression: trends.paceProgression,
        distanceProgression: trends.distanceProgression,
        consistencyProgression: trends.consistencyProgression,
        performanceProgression: trends.performanceProgression,
      },
      personalRecords,
      insights,
      comparison,
      performanceMetrics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch performance analytics' },
      { status: 500 }
    );
  }
}