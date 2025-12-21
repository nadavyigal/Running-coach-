import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/dbUtils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const cohortStatsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  includePerformance: z.string().optional().default('false').transform((val) => val === 'true'),
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
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
      includePerformance: includePerformance ?? undefined,
      timeRange: timeRange ?? undefined,
    });

    // Get the user's cohort information
    const user = await dbUtils.getUserById(validatedData.userId);
    if (!user || !user.cohortId) {
      return NextResponse.json({ message: 'User not in a cohort' }, { status: 404 });
    }

    // Get cohort statistics
    const stats = await dbUtils.getCohortStats(user.cohortId);
    
    // Add performance comparison data if requested
    if (validatedData.includePerformance) {
      const performanceComparison = await dbUtils.getCohortPerformanceComparison(
        user.cohortId,
        validatedData.userId,
        validatedData.timeRange
      );
      
      stats.performanceComparison = performanceComparison;
    }
    
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    logger.error('Error fetching cohort stats:', error);
    return NextResponse.json({
      message: 'Internal server error'
    }, { status: 500 });
  }
}
