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
  console.log('🎯 Goals API GET: Starting request');
  
  try {
    const { searchParams } = new URL(request.url);
    console.log('🔍 Query parameters:', Object.fromEntries(searchParams.entries()));
    
    const params = GoalQuerySchema.parse({
      userId: searchParams.get('userId'),
      status: searchParams.get('status'),
      includeProgress: searchParams.get('includeProgress'),
      includeAnalytics: searchParams.get('includeAnalytics')
    });
    
    console.log('✅ Parsed parameters:', params);

    console.log(`🔍 Fetching goals for user ${params.userId}...`);
    const goals = await dbUtils.getGoalsByUser(params.userId, params.status);
    console.log(`📊 Found ${goals.length} goals for user ${params.userId}`);
    
    // Enrich goals with progress and analytics if requested
    console.log('🔍 Enriching goals with additional data...');
    const enrichedGoals = await Promise.all(goals.map(async (goal) => {
      const baseGoal = { ...goal };
      
      if (params.includeProgress) {
        try {
          const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
          (baseGoal as any).progress = progress;
          console.log(`✅ Added progress for goal ${goal.id}`);
        } catch (progressError) {
          console.error(`❌ Failed to calculate progress for goal ${goal.id}:`, progressError);
        }
      }
      
      if (params.includeAnalytics) {
        try {
          const analytics = await goalProgressEngine.generateGoalAnalytics(goal.id!);
          (baseGoal as any).analytics = analytics;
          console.log(`✅ Added analytics for goal ${goal.id}`);
        } catch (analyticsError) {
          console.error(`❌ Failed to generate analytics for goal ${goal.id}:`, analyticsError);
        }
      }
      
      return baseGoal;
    }));

    // Calculate overall user progress summary
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const averageProgress = activeGoals.length > 0 
      ? activeGoals.reduce((sum, goal) => sum + goal.progressPercentage, 0) / activeGoals.length 
      : 0;

    const response = {
      goals: enrichedGoals,
      summary: {
        total: goals.length,
        active: activeGoals.length,
        completed: completedGoals.length,
        paused: goals.filter(g => g.status === 'paused').length,
        abandoned: goals.filter(g => g.status === 'abandoned').length,
        averageProgress: Math.round(averageProgress * 10) / 10
      }
    };
    
    console.log('✅ Goals API GET: Success, returning response');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Goals API GET: Error occurred:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error details:', error.errors);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch goals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('🎯 Goals API POST: Starting goal creation');
  
  try {
    const body = await request.json();
    console.log('📝 Request body received:', JSON.stringify(body, null, 2));
    
    console.log('🔍 Validating goal data against schema...');
    const goalData = CreateGoalSchema.parse(body);
    console.log('✅ Goal data validation passed');

    // Validate SMART goal criteria
    console.log('🔍 Validating SMART goal criteria...');
    const validation = dbUtils.validateSMARTGoal(goalData);
    
    if (!validation.isValid) {
      console.error('❌ SMART goal validation failed:', validation.errors);
      return NextResponse.json(
        { 
          error: 'SMART goal validation failed', 
          details: validation.errors,
          suggestions: validation.suggestions 
        },
        { status: 400 }
      );
    }
    
    console.log('✅ SMART goal validation passed');

    // Create the goal
    console.log('🔍 Creating goal in database...');
    const goalCreateData = {
      ...goalData,
      currentValue: goalData.baselineValue,
      progressPercentage: 0,
      status: 'active' as const
    };
    
    console.log('📝 Final goal data for creation:', JSON.stringify(goalCreateData, null, 2));
    
    const goalId = await dbUtils.createGoal(goalCreateData);
    console.log(`✅ Goal created successfully with ID: ${goalId}`);

    // Generate initial milestones
    console.log('🔍 Generating initial milestones...');
    try {
      await dbUtils.generateGoalMilestones(goalId);
      console.log('✅ Milestones generated successfully');
    } catch (milestoneError) {
      console.error('❌ Failed to generate milestones:', milestoneError);
      // Continue anyway - milestones are not critical for goal creation
    }

    // Get the created goal with progress
    console.log('🔍 Fetching created goal with progress data...');
    const createdGoal = await dbUtils.getGoal(goalId);
    
    if (!createdGoal) {
      console.error('❌ Failed to retrieve created goal');
      throw new Error('Goal was created but could not be retrieved');
    }
    
    let progress = null;
    let milestones = [];
    
    try {
      progress = await goalProgressEngine.calculateGoalProgress(goalId);
      console.log('✅ Progress calculated successfully');
    } catch (progressError) {
      console.error('❌ Failed to calculate progress:', progressError);
    }
    
    try {
      milestones = await dbUtils.getGoalMilestones(goalId);
      console.log(`✅ Retrieved ${milestones.length} milestones`);
    } catch (milestonesError) {
      console.error('❌ Failed to retrieve milestones:', milestonesError);
    }

    const response = {
      goal: createdGoal,
      progress,
      milestones,
      validation: {
        isValid: true,
        suggestions: validation.suggestions
      }
    };
    
    console.log('✅ Goals API POST: Success, returning created goal');
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('❌ Goals API POST: Error occurred:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof z.ZodError) {
      console.error('❌ Schema validation error details:', error.errors);
      return NextResponse.json(
        { error: 'Invalid goal data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create goal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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