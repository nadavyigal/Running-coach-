import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const cohortStatsSchema = z.object({
  userId: z.string().nullable().refine((val) => {
    if (!val) return false;
    const parsed = parseInt(val);
    return !isNaN(parsed) && parsed > 0;
  }, 'User ID must be a valid positive number'),
  includePerformance: z.string().nullable().transform(val => val === 'true').optional().default(false),
  timeRange: z.enum(['7d', '30d', '90d', '1y']).nullable().optional().default('30d'),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');
    const includePerformance = searchParams.get('includePerformance');
    const timeRange = searchParams.get('timeRange');
    
    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const validatedData = cohortStatsSchema.parse({ 
      userId, 
      includePerformance,
      timeRange 
    });

    // Get the user's cohort information
    const user = await dbUtils.getUserById(parseInt(validatedData.userId));
    if (!user || !user.cohortId) {
      // Return empty stats instead of error to prevent UI breaking
      return NextResponse.json({
        cohortId: null,
        totalMembers: 0,
        averageWeeklyRuns: 0,
        averageDistance: 0,
        topPerformers: [],
        recentActivities: [],
        message: 'User not in a cohort'
      });
    }

    // Get cohort statistics
    const stats = await dbUtils.getCohortStats(user.cohortId);
    
    // Add performance comparison data if requested
    if (validatedData.includePerformance) {
      const performanceComparison = await dbUtils.getCohortPerformanceComparison(
        user.cohortId,
        parseInt(validatedData.userId),
        validatedData.timeRange
      );
      
      stats.performanceComparison = performanceComparison;
    }
    
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    console.error('Error fetching cohort stats:', error);
    // Return empty stats instead of error to prevent UI breaking
    return NextResponse.json({
      cohortId: null,
      totalMembers: 0,
      averageWeeklyRuns: 0,
      averageDistance: 0,
      topPerformers: [],
      recentActivities: [],
      error: 'Failed to fetch cohort stats'
    });
  }
}