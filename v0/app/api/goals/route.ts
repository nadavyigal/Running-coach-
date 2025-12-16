import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Goal } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';
import { goalProgressEngine } from '@/lib/goalProgressEngine';
import { planAdaptationEngine } from '@/lib/planAdaptationEngine';
import { regenerateTrainingPlan } from '@/lib/plan-regeneration';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


// Validation schemas - Relaxed to accept minimal input
const CreateGoalSchema = z.object({
  // Required minimal fields
  userId: z.number(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  goalType: z.enum(['time_improvement', 'distance_achievement', 'frequency', 'race_completion', 'consistency', 'health']),
  category: z.enum(['speed', 'endurance', 'consistency', 'health', 'strength']),
  targetValue: z.number().positive(),

  // Optional fields with defaults
  description: z.string().optional(),
  priority: z.number().min(1).max(3).default(2),

  specificTarget: z.object({
    metric: z.string(),
    value: z.number(),
    unit: z.string(),
    description: z.string().optional()
  }),

  // Auto-generated fields (optional in request)
  measurableMetrics: z.array(z.string()).optional(),
  achievableAssessment: z.object({
    currentLevel: z.number().optional(),
    targetLevel: z.number().optional(),
    feasibilityScore: z.number().min(0).max(100).optional(),
    recommendedAdjustments: z.array(z.string()).optional()
  }).optional(),
  relevantContext: z.string().optional(),

  // Time-bound (deadline required, rest optional)
  timeBound: z.object({
    deadline: z.string().transform(str => new Date(str)),
    startDate: z.string().transform(str => new Date(str)).optional(),
    totalDuration: z.number().optional(),
    milestoneSchedule: z.array(z.number()).optional()
  }),

  baselineValue: z.number().optional(),
});

const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  goalId: z.number()
});

const GoalQuerySchema = z.object({
  userId: z.string().transform(Number),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
  includeProgress: z.string().transform(val => val === 'true').optional().default(false),
  includeAnalytics: z.string().transform(val => val === 'true').optional().default(false)
});

export async function GET(request: NextRequest) {
  logger.log('🎯 Goals API GET: Starting request');
  
  try {
    const { searchParams } = new URL(request.url);
    logger.log('🔍 Query parameters:', Object.fromEntries(searchParams.entries()));
    
    const params = GoalQuerySchema.parse({
      userId: searchParams.get('userId'),
      status: searchParams.get('status'),
      includeProgress: searchParams.get('includeProgress'),
      includeAnalytics: searchParams.get('includeAnalytics')
    });
    
    logger.log('✅ Parsed parameters:', params);

    logger.log(`🔍 Fetching goals for user ${params.userId}...`);
    const goals = await dbUtils.getUserGoals(params.userId, params.status);
    logger.log(`📊 Found ${goals.length} goals for user ${params.userId}`);
    
    // Enrich goals with progress and analytics if requested
    logger.log('🔍 Enriching goals with additional data...');
    const enrichedGoals = await Promise.all(goals.map(async (goal) => {
      const baseGoal = { ...goal };
      
      if (params.includeProgress) {
        try {
          const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
          (baseGoal as any).progress = progress;
          logger.log(`✅ Added progress for goal ${goal.id}`);
        } catch (progressError) {
          logger.error(`❌ Failed to calculate progress for goal ${goal.id}:`, progressError);
        }
      }
      
      if (params.includeAnalytics) {
        try {
          const analytics = await goalProgressEngine.generateGoalAnalytics(goal.id!);
          (baseGoal as any).analytics = analytics;
          logger.log(`✅ Added analytics for goal ${goal.id}`);
        } catch (analyticsError) {
          logger.error(`❌ Failed to generate analytics for goal ${goal.id}:`, analyticsError);
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
        cancelled: goals.filter(g => g.status === 'cancelled').length,
        averageProgress: Math.round(averageProgress * 10) / 10
      }
    };
    
    logger.log('✅ Goals API GET: Success, returning response');
    return NextResponse.json(response);

  } catch (error) {
    logger.error('❌ Goals API GET: Error occurred:', error);
    logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof z.ZodError) {
      logger.error('❌ Validation error details:', error.errors);
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
  logger.log('🎯 Goals API POST: Starting goal creation');

  try {
    const body = await request.json();
    logger.log('📝 Request body received');

    // Parse with relaxed schema
    logger.log('🔍 Validating goal data against schema...');
    const goalData = CreateGoalSchema.parse(body);
    logger.log('✅ Basic validation passed');

    // Auto-complete missing fields
    logger.log('🔄 Auto-completing goal fields...');
    const completedGoal = await dbUtils.autoCompleteGoalFields(goalData, goalData.userId);
    logger.log('✅ Goal fields auto-completed');

    // Validate SMART criteria (non-blocking - only errors block creation)
    logger.log('🔍 Validating SMART criteria...');
    const validation = dbUtils.validateSMARTGoal(completedGoal);
    logger.log(`✅ SMART score: ${validation.smartScore}/100`);

    // Only block if there are actual errors (not warnings)
    if (!validation.isValid) {
      logger.error('❌ SMART goal validation failed:', validation.errors);
      return NextResponse.json(
        {
          error: 'SMART goal validation failed',
          details: validation.errors,
          suggestions: validation.suggestions
        },
        { status: 400 }
      );
    }

    // Create the goal (validation warnings don't block)
    logger.log('🔍 Creating goal in database...');
    const goalCreateData = {
      ...completedGoal,
      currentValue: completedGoal.baselineValue,
      status: 'active' as const
    };

    logger.log('📝 Final goal data for creation');

    const goalId = await dbUtils.createGoal(goalCreateData);
    logger.log(`✅ Goal created successfully with ID: ${goalId}`);

    // Set goal as primary and regenerate training plan
    // CRITICAL: Both must succeed - if plan fails, rollback goal creation
    try {
      const goal = await dbUtils.getGoal(goalId);
      if (!goal) {
        throw new Error('Goal was created but could not be retrieved');
      }

      logger.log('🎯 Setting goal as primary and regenerating training plan...');

      // Step 1: Mark goal as primary and active
      await dbUtils.setPrimaryGoal(goal.userId, goalId);
      logger.log('✅ Goal set as primary');

      // Step 2: Regenerate training plan based on the new goal
      const regeneratedPlan = await regenerateTrainingPlan(goal.userId, goal);

      if (!regeneratedPlan) {
        // CRITICAL: Plan regeneration failed - rollback the goal
        logger.error('❌ Plan regeneration failed - rolling back goal creation');

        // Rollback: Delete the goal that was just created
        await dbUtils.deleteGoal(goalId);

        return NextResponse.json({
          success: false,
          error: 'Training plan could not be generated for this goal',
          details: 'Goal creation requires a valid training plan. The goal was not saved. Please check your goal parameters and try again.',
          recommendation: 'Try adjusting your goal timeline or target to allow for a realistic training plan.'
        }, { status: 400 }); // 400 Bad Request - goal creation failed
      }

      logger.log(`✅ Training plan regenerated: planId=${regeneratedPlan.id}`);

      // Step 3: Link goal to plan bidirectionally
      await dbUtils.updateGoal(goalId, {
        planId: regeneratedPlan.id,
        status: 'active' as const,
        updatedAt: new Date()
      });
      logger.log('✅ Goal-plan linkage established');

      // SUCCESS: Both goal and plan created successfully

    } catch (adaptationError) {
      logger.error('❌ Goal creation workflow failed:', adaptationError);

      // Attempt to rollback goal creation
      try {
        await dbUtils.deleteGoal(goalId);
        logger.log('✅ Goal rolled back after error');
      } catch (rollbackError) {
        logger.error('❌ Failed to rollback goal:', rollbackError);
      }

      // Return error - goal creation failed
      return NextResponse.json({
        success: false,
        error: 'Failed to create goal and training plan',
        details: adaptationError instanceof Error ? adaptationError.message : 'Unknown error',
        recommendation: 'Please check your goal parameters and try again. If the problem persists, contact support.'
      }, { status: 500 }); // 500 Internal Server Error
    }

    // Note: Milestone generation would happen here if implemented
    // For now, milestones can be added manually after goal creation
    logger.log('ℹ️ Skipping automatic milestone generation (not yet implemented)');

    // Get the created goal with progress
    logger.log('🔍 Fetching created goal with progress data...');
    const createdGoal = await dbUtils.getGoal(goalId);

    if (!createdGoal) {
      logger.error('❌ Failed to retrieve created goal');
      throw new Error('Goal was created but could not be retrieved');
    }

    let progress = null;
    let milestones = [];

    try {
      progress = await goalProgressEngine.calculateGoalProgress(goalId);
      logger.log('✅ Progress calculated successfully');
    } catch (progressError) {
      logger.error('❌ Failed to calculate progress:', progressError);
    }

    try {
      const goalWithMilestones = await dbUtils.getGoalWithMilestones(goalId);
      milestones = goalWithMilestones.milestones;
      logger.log(`✅ Retrieved ${milestones.length} milestones`);
    } catch (milestonesError) {
      logger.error('❌ Failed to retrieve milestones:', milestonesError);
    }

    // Return with SMART validation results
    const response = {
      success: true,
      goalId,
      goal: createdGoal,
      progress,
      milestones,
      validation: {
        smartScore: validation.smartScore,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
        autoGenerated: validation.autoGenerated,
        completeness: validation.completeness
      }
    };

    logger.log('✅ Goals API POST: Success, returning created goal');
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    logger.error('❌ Goals API POST: Error occurred:', error);
    logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    if (error instanceof z.ZodError) {
      logger.error('❌ Schema validation error details:', error.errors);
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

    // Note: Progress will be recalculated automatically on next fetch via goalProgressEngine
    // The updateGoalCurrentProgress function doesn't exist in dbUtils

    // Check if plan should be adapted based on goal update
    try {
      const goal = await dbUtils.getGoal(goalId);
      if (goal) {
        const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(goal.userId);
        
        if (adaptationAssessment.shouldAdapt && adaptationAssessment.confidence > 70) {
          logger.log('Goal update triggered plan adaptation:', adaptationAssessment.reason);
          
          // Get current active plan
          const currentPlan = await dbUtils.getActivePlan(goal.userId);
          if (currentPlan) {
            // Adapt the plan
            const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
              currentPlan.id!,
              `Goal update: ${adaptationAssessment.reason}`
            );
            
            logger.log('Plan adapted successfully after goal update:', adaptedPlan.title);
          }
        }
      }
    } catch (adaptationError) {
      logger.error('Plan adaptation failed after goal update:', adaptationError);
      // Don't fail the goal update if adaptation fails
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
    logger.error('Error updating goal:', error);
    
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
    logger.error('Error deleting goal:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}