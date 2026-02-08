import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Goal } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';
import { goalProgressEngine } from '@/lib/goalProgressEngine';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const AnalyticsQuerySchema = z.object({
  userId: z.string().transform(Number),
  goalId: z.string().transform(Number).optional(),
  timeRange: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  includeDetailed: z.coerce.boolean().optional().default(false)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params = AnalyticsQuerySchema.parse({
      userId: searchParams.get('userId'),
      goalId: searchParams.get('goalId'),
      timeRange: searchParams.get('timeRange'),
      includeDetailed: searchParams.get('includeDetailed')
    });

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (params.timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01'); // Far back date
        break;
    }

    // Get goals for analysis
    let goals: Goal[] = [];
    if (params.goalId) {
      const goal = await dbUtils.getGoal(params.goalId);
      if (!goal) {
        return NextResponse.json(
          { error: 'Goal not found' },
          { status: 404 }
        );
      }
      goals = [goal];
    } else {
      goals = await dbUtils.getUserGoals(params.userId);
    }

    // Filter goals by date range
    goals = goals.filter(goal => new Date(goal.createdAt) >= startDate);

    // Generate comprehensive analytics
    const analytics = await generateGoalAnalytics(params.userId, goals, startDate, now, params.includeDetailed);

    return NextResponse.json(analytics);

  } catch (error) {
    logger.error('Error generating goal analytics:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate goal analytics' },
      { status: 500 }
    );
  }
}

async function generateGoalAnalytics(
  userId: number, 
  goals: any[], 
  startDate: Date, 
  endDate: Date, 
  _includeDetailed: boolean
) {
  // Overview metrics
  const totalGoals = goals.length;
  const activeGoals = goals.filter(g => g.status === 'active').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const pausedGoals = goals.filter(g => g.status === 'paused').length;
  const cancelledGoals = goals.filter(g => g.status === 'cancelled').length;

  // Calculate success rate
  const finishedGoals = completedGoals + cancelledGoals;
  const successRate = finishedGoals > 0 ? (completedGoals / finishedGoals) * 100 : 0;

  // Calculate average completion time
  const completedGoalsWithDates = goals.filter(g => g.status === 'completed' && g.completedAt);
  const averageCompletionTime = completedGoalsWithDates.length > 0
    ? completedGoalsWithDates.reduce((sum, goal) => {
        const days = Math.ceil((new Date(goal.completedAt).getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / completedGoalsWithDates.length
    : 0;

  // Calculate current streak
  const recentGoals = goals
    .filter(g => g.updatedAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  let streak = 0;
  for (const goal of recentGoals) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(goal.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate <= 1) {
      streak++;
    } else {
      break;
    }
  }

  // Progress trends over time
  const progressTrends = await generateProgressTrends(goals, startDate, endDate);

  // Goal performance analysis
  const goalPerformance = await Promise.all(
    goals.map(async (goal) => {
      const daysActive = Math.ceil((Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const progressRate = daysActive > 0 ? (goal.progressPercentage || 0) / daysActive : 0;
      const prediction = await goalProgressEngine.predictGoalCompletion(goal.id!);

      return {
        goalId: goal.id,
        title: goal.title,
        category: goal.category,
        progressRate: Math.round(progressRate * 100) / 100,
        daysActive,
        completionProbability: prediction?.probability || 0,
        status: goal.status
      };
    })
  );

  // Category breakdown
  const categoryGroups = goals.reduce((acc, goal) => {
    const category = goal.category;
    if (!acc[category]) {
      acc[category] = { goals: [], completed: 0 };
    }
    acc[category].goals.push(goal);
    if (goal.status === 'completed') {
      acc[category].completed++;
    }
    return acc;
  }, {} as Record<string, { goals: any[]; completed: number }>);

  const categoryEntries = Object.entries(categoryGroups) as Array<
    [string, { goals: Goal[]; completed: number }]
  >;
  const categoryBreakdown = categoryEntries.map(([category, data]) => ({
    category,
    count: data.goals.length,
    successRate: data.goals.length > 0 ? (data.completed / data.goals.length) * 100 : 0,
    averageProgress: data.goals.reduce((sum, g) => sum + (g.progressPercentage || 0), 0) / data.goals.length
  }));

  // Milestone achievements
  const milestoneAchievements = await generateMilestoneAnalytics(goals, startDate, endDate);

  // Generate insights
  const insights = await generateInsights(goals, goalPerformance, categoryBreakdown);

  // Generate predictions
  const predictions = await generatePredictions(goals);

  return {
    overview: {
      totalGoals,
      activeGoals,
      completedGoals,
      pausedGoals,
      cancelledGoals,
      averageCompletionTime: Math.round(averageCompletionTime),
      successRate: Math.round(successRate * 10) / 10,
      streak
    },
    progressTrends,
    goalPerformance,
    categoryBreakdown,
    milestoneAchievements,
    insights,
    predictions
  };
}

async function generateProgressTrends(goals: any[], startDate: Date, endDate: Date) {
  const trends = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const interval = Math.max(1, Math.floor(daysDiff / 20)); // Max 20 data points

  for (let i = 0; i <= daysDiff; i += interval) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // Calculate metrics for this date
    const goalsActiveAtDate = goals.filter(g => 
      new Date(g.createdAt) <= date && 
      (g.status === 'active' || (g.status === 'completed' && new Date(g.completedAt || Date.now()) > date))
    ).length;
    
    const goalsCompletedByDate = goals.filter(g => 
      g.status === 'completed' && 
      new Date(g.completedAt || Date.now()) <= date
    ).length;

    // Average progress of active goals at this date
    const activeGoalsAtDate = goals.filter(g => 
      new Date(g.createdAt) <= date && 
      g.status === 'active'
    );
    
    const averageProgress = activeGoalsAtDate.length > 0
      ? activeGoalsAtDate.reduce((sum, g) => sum + (g.progressPercentage || 0), 0) / activeGoalsAtDate.length
      : 0;

    trends.push({
      date: dateStr,
      progress: Math.round(averageProgress),
      goalsActive: goalsActiveAtDate,
      goalsCompleted: goalsCompletedByDate
    });
  }

  return trends;
}

async function generateMilestoneAnalytics(goals: any[], startDate: Date, endDate: Date) {
  const milestoneData = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i <= daysDiff; i += 7) { // Weekly intervals
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const weekStart = new Date(date);
    const weekEnd = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let totalMilestones = 0;
    const categoryCount: Record<string, number> = {};

    for (const goal of goals) {
      const milestones = await dbUtils.getGoalMilestones(goal.id!);
      const achievedInWeek = milestones.filter(m => 
        m.status === 'achieved' &&
        m.achievedDate &&
        new Date(m.achievedDate) >= weekStart &&
        new Date(m.achievedDate) < weekEnd
      );

      totalMilestones += achievedInWeek.length;
      categoryCount[goal.category] = (categoryCount[goal.category] || 0) + achievedInWeek.length;
    }

    milestoneData.push({
      date: date.toISOString().split('T')[0],
      count: totalMilestones,
      category: Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b, 'none'
      )
    });
  }

  return milestoneData;
}

async function generateInsights(goals: any[], goalPerformance: any[], categoryBreakdown: any[]) {
  const insights = [];

  // High performing goals
  const highPerformers = goalPerformance.filter(g => g.completionProbability > 0.8);
  if (highPerformers.length > 0) {
    insights.push({
      type: 'success',
      title: 'Strong Goal Performance',
      description: `${highPerformers.length} of your goals have a high probability of completion (>80%). Keep up the excellent work!`,
      actionable: false,
      metric: highPerformers.length,
      trend: 'up'
    });
  }

  // At-risk goals
  const atRiskGoals = goalPerformance.filter(g => g.status === 'active' && g.completionProbability < 0.3);
  if (atRiskGoals.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Goals Need Attention',
      description: `${atRiskGoals.length} goals are at risk of not being completed. Consider adjusting timelines or breaking them into smaller milestones.`,
      actionable: true,
      metric: atRiskGoals.length,
      trend: 'down'
    });
  }

  // Category performance
  const bestCategory = categoryBreakdown.reduce((best, cat) => 
    cat.successRate > best.successRate ? cat : best, 
    { category: 'none', successRate: 0 }
  );
  
  if (bestCategory.category !== 'none') {
    insights.push({
      type: 'achievement',
      title: `Excelling in ${bestCategory.category} Goals`,
      description: `Your ${bestCategory.category} goals have a ${Math.round(bestCategory.successRate)}% success rate. Consider applying similar strategies to other goal categories.`,
      actionable: true,
      metric: Math.round(bestCategory.successRate),
      trend: 'up'
    });
  }

  // Progress rate insights
  const slowProgress = goalPerformance.filter(g => g.status === 'active' && g.progressRate < 0.5);
  if (slowProgress.length > 0) {
    insights.push({
      type: 'info',
      title: 'Slow Progress Detected',
      description: `${slowProgress.length} goals are progressing slowly (<0.5% per day). Consider increasing effort or adjusting expectations.`,
      actionable: true,
      metric: slowProgress.length,
      trend: 'stable'
    });
  }

  // Recent activity
  const recentActivity = goals.filter(g => {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(g.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate <= 3;
  });

  if (recentActivity.length > 0) {
    insights.push({
      type: 'success',
      title: 'Active Goal Management',
      description: `You've updated ${recentActivity.length} goals in the last 3 days. Consistent tracking leads to better outcomes!`,
      actionable: false,
      metric: recentActivity.length,
      trend: 'up'
    });
  }

  return insights;
}

async function generatePredictions(goals: any[]) {
  // Next milestone prediction
  let nextMilestone = null;
  let earliestDate = null;

  for (const goal of goals.filter(g => g.status === 'active')) {
    const milestones = await dbUtils.getGoalMilestones(goal.id!);
    const nextMilestoneForGoal = milestones
      .filter(m => m.status === 'pending')
      .sort((a, b) => a.milestoneOrder - b.milestoneOrder)[0];

    if (nextMilestoneForGoal) {
      const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
      const prediction = await goalProgressEngine.predictGoalCompletion(goal.id!);
      if (progress?.projectedCompletion) {
        const projectedDate = new Date(progress.projectedCompletion);
        if (!earliestDate || projectedDate < earliestDate) {
          earliestDate = projectedDate;
          nextMilestone = {
            goalTitle: goal.title,
            milestoneTitle: nextMilestoneForGoal.title,
            estimatedDate: projectedDate.toISOString(),
            confidence: prediction?.probability || 0.5
          };
        }
      }
    }
  }

  // Goal completion predictions
  const goalCompletion = await Promise.all(
    goals.filter(g => g.status === 'active').map(async (goal) => {
      const prediction = await goalProgressEngine.predictGoalCompletion(goal.id!);
      const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
      
      return {
        goalId: goal.id,
        goalTitle: goal.title,
        estimatedCompletion: progress?.projectedCompletion || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        probability: prediction?.probability || 0.5
      };
    })
  );

  // Recommended actions
  const recommendedActions = [];

  const strugglingGoals = goals.filter(g => g.status === 'active' && g.progressPercentage < 25);
  if (strugglingGoals.length > 0) {
    recommendedActions.push({
      action: 'Break down large goals into smaller milestones',
      reason: `${strugglingGoals.length} goals are showing slow initial progress`,
      impact: 'high'
    });
  }

  const overdueGoals = goals.filter(g => {
    if (g.status !== 'active') return false;
    const deadline = new Date(g.timeBound?.deadline);
    return deadline < new Date() && g.progressPercentage < 100;
  });

  if (overdueGoals.length > 0) {
    recommendedActions.push({
      action: 'Review and adjust goal deadlines',
      reason: `${overdueGoals.length} goals are past their deadline`,
      impact: 'high'
    });
  }

  const highPerformanceGoals = goals.filter(g => g.status === 'active' && g.progressPercentage > 80);
  if (highPerformanceGoals.length > 0) {
    recommendedActions.push({
      action: 'Consider setting more challenging targets',
      reason: `${highPerformanceGoals.length} goals are ahead of schedule`,
      impact: 'medium'
    });
  }

  return {
    nextMilestone,
    goalCompletion,
    recommendedActions
  };
}
