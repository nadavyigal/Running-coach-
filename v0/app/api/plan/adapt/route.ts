import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';
import { planAdaptationEngine } from '@/lib/planAdaptationEngine';
import { logger } from '@/lib/logger';
import { recordPlanAdjustment } from '@/lib/server/plan-adjustments';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


// Validation schema for manual adaptation requests
const ManualAdaptationRequestSchema = z.object({
  userId: z.number(),
  reason: z.string().min(1).max(500),
  adaptationType: z.enum(['progressive', 'regressive', 'maintenance']).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

const AutoAdaptationRequestSchema = z.object({
  planId: z.number(),
  userId: z.number(),
  adaptationReason: z.enum(['performance_below_target', 'distance_not_met', 'consecutive_misses']),
  recentRun: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const autoParse = AutoAdaptationRequestSchema.safeParse(body);
    if (autoParse.success) {
      const { userId, planId, adaptationReason } = autoParse.data;

      const plan = await dbUtils.getPlan(planId);
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }

      if (plan.userId !== userId) {
        return NextResponse.json(
          { error: 'User does not own requested plan' },
          { status: 403 }
        );
      }

      const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
        planId,
        adaptationReason
      );

      await recordPlanAdjustment({
        userId,
        sessionDate: new Date().toISOString(),
        oldSession: {
          planId: plan.id,
          title: plan.title,
          description: plan.description,
        },
        newSession: {
          planId: adaptedPlan.id,
          title: adaptedPlan.title,
          description: adaptedPlan.description,
        },
        reasons: [adaptationReason],
        evidence: {
          source: 'api/plan/adapt:auto',
        },
      }).catch(() => {
        // Do not fail adaptation when logging fails.
      });

      return NextResponse.json({
        success: true,
        message: 'Plan adapted successfully',
        plan: adaptedPlan,
      });
    }

    const { userId, reason, adaptationType, confidence } = ManualAdaptationRequestSchema.parse(body);

    // Verify user exists
    const user = await dbUtils.getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current active plan
    const currentPlan = await dbUtils.getActivePlan(userId);
    if (!currentPlan) {
      return NextResponse.json(
        { error: 'No active plan found for user' },
        { status: 404 }
      );
    }

    // Perform adaptation assessment
    const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(userId);
    
    // Override assessment if manual trigger is provided
    if (adaptationType && confidence) {
      adaptationAssessment.shouldAdapt = true;
      adaptationAssessment.adaptationType = adaptationType;
      adaptationAssessment.confidence = confidence;
      adaptationAssessment.reason = reason;
    }

    if (!adaptationAssessment.shouldAdapt) {
      return NextResponse.json({
        message: 'No adaptation needed',
        assessment: adaptationAssessment
      });
    }

    // Adapt the plan
    const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
      currentPlan.id!,
      reason
    );

    await recordPlanAdjustment({
      userId,
      sessionDate: new Date().toISOString(),
      oldSession: {
        planId: currentPlan.id,
        title: currentPlan.title,
        description: currentPlan.description,
      },
      newSession: {
        planId: adaptedPlan.id,
        title: adaptedPlan.title,
        description: adaptedPlan.description,
      },
      reasons: [reason],
      evidence: {
        source: 'api/plan/adapt:manual',
        assessment: adaptationAssessment,
      },
    }).catch(() => {
      // Do not fail adaptation when logging fails.
    });

    return NextResponse.json({
      success: true,
      message: 'Plan adapted successfully',
      plan: adaptedPlan,
      assessment: adaptationAssessment
    });

  } catch (error) {
    logger.error('Manual plan adaptation failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if plan should be adapted
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await dbUtils.getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current active plan
    const currentPlan = await dbUtils.getActivePlan(userId);
    if (!currentPlan) {
      return NextResponse.json(
        { error: 'No active plan found for user' },
        { status: 404 }
      );
    }

    // Perform adaptation assessment
    const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(userId);

    return NextResponse.json({
      assessment: adaptationAssessment,
      currentPlan: {
        id: currentPlan.id,
        title: currentPlan.title,
        startDate: currentPlan.startDate,
        endDate: currentPlan.endDate
      }
    });

  } catch (error) {
    logger.error('Plan adaptation assessment failed:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
