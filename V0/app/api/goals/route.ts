import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils, Goal } from '@/lib/db';
import { goalProgressEngine } from '@/lib/goalProgressEngine';

// Validation schemas
const CreateGoalSchema = z.object({
  userId: z.number(),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().optional(),
  goalType: z.enum(['time_improvement', 'distance_achievement', 'frequency', 'race_completion', 'consistency', 'health']),
  category: z.enum(['speed', 'endurance', 'consistency', 'health', 'strength']),
  priority: z.number().min(1).max(3),
  specificTarget: z.object({
    metric: z.string(),
    value: z.number(),
    unit: z.string(),
    description: z.string()
  }),
  measurableMetrics: z.array(z.string()),
  achievableAssessment: z.object({
    currentLevel: z.number(),
    targetLevel: z.number(),
    feasibilityScore: z.number().min(0).max(100),
    recommendedAdjustments: z.array(z.string()).optional()
  }),
  relevantContext: z.string(),
  timeBound: z.object({
    deadline: z.string().transform(str => new Date(str)),
    startDate: z.string().transform(str => new Date(str)),
    totalDuration: z.number(),
    milestoneSchedule: z.array(z.number())
  }),
  baselineValue: z.number(),
  targetValue: z.number()
});

const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  goalId: z.number()
});

const GoalQuerySchema = z.object({
  userId: z.string().transform(Number),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']).optional(),
  includeProgress: z.string().transform(val => val === 'true').optional().default(false),
  includeAnalytics: z.string().transform(val => val === 'true').optional().default(false)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = GoalQuerySchema.parse({
      userId: searchParams.get('userId'),
      status: searchParams.get('status'),
      includeProgress: searchParams.get('includeProgress'),
      includeAnalytics: searchParams.get('includeAnalytics')
    });

    const goals = await dbUtils.getGoalsByUser(params.userId, params.status);
    
    // Enrich goals with progress and analytics if requested
    const enrichedGoals = await Promise.all(goals.map(async (goal) => {
      const baseGoal = { ...goal };
      
      if (params.includeProgress) {
        const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
        (baseGoal as any).progress = progress;
      }
      
      if (params.includeAnalytics) {
        const analytics = await goalProgressEngine.generateGoalAnalytics(goal.id!);
        (baseGoal as any).analytics = analytics;
      }
      
      return baseGoal;
    }));

    // Calculate overall user progress summary
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const averageProgress = activeGoals.length > 0 
      ? activeGoals.reduce((sum, goal) => sum + goal.progressPercentage, 0) / activeGoals.length 
      : 0;

    return NextResponse.json({
      goals: enrichedGoals,
      summary: {
        total: goals.length,
        active: activeGoals.length,
        completed: completedGoals.length,
        paused: goals.filter(g => g.status === 'paused').length,
        abandoned: goals.filter(g => g.status === 'abandoned').length,
        averageProgress: Math.round(averageProgress * 10) / 10
      }
    });

  } catch (error) {
    console.error('Error fetching goals:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const goalData = CreateGoalSchema.parse(body);

    // Validate SMART goal criteria
    const validation = dbUtils.validateSMARTGoal(goalData);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'SMART goal validation failed', 
          details: validation.errors,
          suggestions: validation.suggestions 
        },
        { status: 400 }
      );
    }

    // Create the goal
    const goalId = await dbUtils.createGoal({
      ...goalData,
      currentValue: goalData.baselineValue,
      progressPercentage: 0,
      status: 'active'
    });

    // Generate initial milestones
    await dbUtils.generateGoalMilestones(goalId);

    // Get the created goal with progress
    const createdGoal = await dbUtils.getGoal(goalId);
    const progress = await goalProgressEngine.calculateGoalProgress(goalId);
    const milestones = await dbUtils.getGoalMilestones(goalId);

    return NextResponse.json({
      goal: createdGoal,
      progress,
      milestones,
      validation: {
        isValid: true,
        suggestions: validation.suggestions
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating goal:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid goal data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updateData = UpdateGoalSchema.parse(body);
    const { goalId, ...updates } = updateData;

    // Check if goal exists
    const existingGoal = await dbUtils.getGoal(goalId);
    if (!existingGoal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    // Validate updated goal if SMART criteria are being changed
    const updatedGoal = { ...existingGoal, ...updates };
    const validation = dbUtils.validateSMARTGoal(updatedGoal);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Updated goal validation failed', 
          details: validation.errors,
          suggestions: validation.suggestions 
        },
        { status: 400 }
      );
    }

    // Update the goal
    await dbUtils.updateGoal(goalId, updates);

    // Recalculate progress if target or baseline changed
    if (updates.targetValue !== undefined || updates.baselineValue !== undefined) {
      await dbUtils.updateGoalCurrentProgress(goalId);
    }

    // Get updated goal with progress
    const goal = await dbUtils.getGoal(goalId);
    const progress = await goalProgressEngine.calculateGoalProgress(goalId);

    return NextResponse.json({
      goal,
      progress,
      validation: {
        isValid: true,
        suggestions: validation.suggestions
      }
    });

  } catch (error) {
    console.error('Error updating goal:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid update data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');
    
    if (!goalId) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      );
    }

    const goalIdNum = parseInt(goalId);
    const goal = await dbUtils.getGoal(goalIdNum);
    
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    await dbUtils.deleteGoal(goalIdNum);

    return NextResponse.json({
      message: 'Goal deleted successfully',
      deletedGoalId: goalIdNum
    });

  } catch (error) {
    console.error('Error deleting goal:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}