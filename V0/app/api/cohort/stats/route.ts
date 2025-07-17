import { NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';
import { z } from 'zod';

const cohortStatsSchema = z.object({
  userId: z.string().min(1, 'User ID is required').refine((val) => {
    const parsed = parseInt(val);
    return !isNaN(parsed) && parsed > 0;
  }, 'User ID must be a valid positive number'),
  includePerformance: z.string().transform(val => val === 'true').optional().default(false),
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
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
      return NextResponse.json({ message: 'User not in a cohort' }, { status: 404 });
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
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}