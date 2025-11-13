import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';
import { goalProgressEngine } from '@/lib/goalProgressEngine';

const ProgressQuerySchema = z.object({
  goalId: z.string().nullable().transform(val => val ? Number(val) : undefined).optional(),
  userId: z.string().nullable().transform(val => val ? Number(val) : undefined).optional(),
  includeHistory: z.string().nullable().transform(val => val === 'true').optional().default(false),
  includeAnalytics: z.string().nullable().transform(val => val === 'true').optional().default(false),
  historyLimit: z.string().nullable().transform(val => val ? Number(val) : 20).optional().default(20)
});

const RecordProgressSchema = z.object({
  goalId: z.number(),
  measuredValue: z.number(),
  measurementDate: z.string().transform(str => new Date(str)).optional(),
  contributingActivityId: z.number().optional(),
  contributingActivityType: z.enum(['run', 'workout', 'manual']).optional(),
  notes: z.string().optional(),
  context: z.object({
    weather: z.string().optional(),
    mood: z.string().optional(),
    conditions: z.array(z.string()).optional()
  }).optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = ProgressQuerySchema.parse({
      goalId: searchParams.get('goalId'),
      userId: searchParams.get('userId'),
      includeHistory: searchParams.get('includeHistory'),
      includeAnalytics: searchParams.get('includeAnalytics'),
      historyLimit: searchParams.get('historyLimit')
    });

    if (!params.goalId && !params.userId) {
      return NextResponse.json(
        { error: 'Either goalId or userId is required' },
        { status: 400 }
      );
    }

    let goals: any[] = [];
    
    if (params.goalId) {
      // Get progress for specific goal
      const goal = await dbUtils.getGoal(params.goalId);
      if (!goal) {
        return NextResponse.json(
          { error: 'Goal not found' },
          { status: 404 }
        );
      }
      goals = [goal];
    } else if (params.userId) {
      // Get progress for all active goals of user
      goals = await dbUtils.getGoalsByUser(params.userId, 'active');
    }

    const progressData = await Promise.all(goals.map(async (goal) => {
      const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
      const milestones = await dbUtils.getGoalMilestones(goal.id!);
      
      let history = null;
      let analytics = null;
      
      if (params.includeHistory) {
        history = await dbUtils.getGoalProgressHistory(goal.id!, params.historyLimit);
      }
      
      if (params.includeAnalytics) {
        analytics = await goalProgressEngine.generateGoalAnalytics(goal.id!);
      }

      // Check for new milestone achievements
      const achievedMilestones = await goalProgressEngine.checkMilestoneAchievements(goal.id!);
      
      // Generate completion prediction
      const prediction = await goalProgressEngine.predictGoalCompletion(goal.id!);

      return {
        goal: {
          id: goal.id,
          title: goal.title,
          description: goal.description,
          goalType: goal.goalType,
          category: goal.category,
          priority: goal.priority,
          status: goal.status,
          deadline: goal.timeBound.deadline,
          specificTarget: goal.specificTarget
        },
        progress,
        milestones: milestones.map(m => ({
          ...m,
          isNext: progress?.nextMilestone?.id === m.id,
          daysUntilTarget: m.targetDate ? Math.ceil((m.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
        })),
        achievedMilestones,
        prediction,
        history,
        analytics
      };
    }));

    // If single goal requested, return single object
    if (params.goalId) {
      return NextResponse.json(progressData[0]);
    }

    // Calculate overall progress summary for user
    const activeProgressData = progressData.filter(p => p.goal.status === 'active');
    const summary = {
      totalActiveGoals: activeProgressData.length,
      averageProgress: activeProgressData.length > 0 
        ? activeProgressData.reduce((sum, p) => sum + (p.progress?.progressPercentage || 0), 0) / activeProgressData.length 
        : 0,
      goalsOnTrack: activeProgressData.filter(p => 
        p.progress?.trajectory === 'on_track' || p.progress?.trajectory === 'ahead'
      ).length,
      goalsAtRisk: activeProgressData.filter(p => 
        p.progress?.trajectory === 'at_risk'
      ).length,
      recentAchievements: activeProgressData.flatMap(p => p.achievedMilestones).length,
      upcomingDeadlines: activeProgressData
        .filter(p => p.progress?.daysUntilDeadline && p.progress.daysUntilDeadline < 30)
        .map(p => ({
          goalId: p.goal.id,
          goalTitle: p.goal.title,
          daysRemaining: p.progress?.daysUntilDeadline
        }))
    };

    return NextResponse.json({
      goals: progressData,
      summary
    });

  } catch (error) {
    console.error('Error fetching goal progress:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch goal progress' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const progressData = RecordProgressSchema.parse(body);

    // Verify goal exists
    const goal = await dbUtils.getGoal(progressData.goalId);
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    // Calculate progress percentage
    const progressPercentage = dbUtils.calculateGoalProgressPercentage(
      goal.baselineValue,
      progressData.measuredValue,
      goal.targetValue,
      goal.goalType
    );

    // Record the progress
    const progressId = await dbUtils.recordGoalProgress({
      goalId: progressData.goalId,
      measurementDate: progressData.measurementDate || new Date(),
      measuredValue: progressData.measuredValue,
      progressPercentage,
      contributingActivityId: progressData.contributingActivityId,
      contributingActivityType: progressData.contributingActivityType || 'manual',
      notes: progressData.notes,
      autoRecorded: false,
      context: progressData.context
    });

    // Check for milestone achievements
    const achievedMilestones = await goalProgressEngine.checkMilestoneAchievements(progressData.goalId);

    // Get updated progress
    const updatedProgress = await goalProgressEngine.calculateGoalProgress(progressData.goalId);
    const prediction = await goalProgressEngine.predictGoalCompletion(progressData.goalId);

    // Generate insights about this progress entry
    const insights: string[] = [];
    if (updatedProgress) {
      if (updatedProgress.recentTrend === 'improving') {
        insights.push('Great improvement! You\'re trending in the right direction.');
      }
      
      if (updatedProgress.trajectory === 'ahead') {
        insights.push('You\'re ahead of schedule! Consider challenging yourself further.');
      } else if (updatedProgress.trajectory === 'behind') {
        insights.push('You\'re behind pace, but there\'s still time to catch up.');
      }

      // Check if this measurement represents a new personal best
      if (goal.goalType === 'time_improvement' && progressData.measuredValue < goal.baselineValue) {
        insights.push('New personal best! Excellent work.');
      } else if (goal.goalType === 'distance_achievement' && progressData.measuredValue > goal.baselineValue) {
        insights.push('New distance record! Keep pushing your limits.');
      }
    }

    return NextResponse.json({
      progressId,
      progress: updatedProgress,
      achievedMilestones,
      prediction,
      insights,
      celebration: achievedMilestones.length > 0 ? {
        type: 'milestone_achievement',
        message: `Congratulations! You've achieved ${achievedMilestones.length} milestone${achievedMilestones.length > 1 ? 's' : ''}!`,
        milestones: achievedMilestones.map(m => m.title)
      } : null
    }, { status: 201 });

  } catch (error) {
    console.error('Error recording goal progress:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid progress data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to record goal progress' },
      { status: 500 }
    );
  }
}