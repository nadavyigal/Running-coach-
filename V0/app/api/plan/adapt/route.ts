import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';
import { planAdaptationEngine } from '@/lib/planAdaptationEngine';

// Validation schema for manual adaptation requests
const ManualAdaptationRequestSchema = z.object({
  userId: z.number(),
  reason: z.string().min(1).max(500),
  adaptationType: z.enum(['progressive', 'regressive', 'maintenance']).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    return NextResponse.json({
      success: true,
      message: 'Plan adapted successfully',
      plan: adaptedPlan,
      assessment: adaptationAssessment
    });

  } catch (error) {
    console.error('Manual plan adaptation failed:', error);
    
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
    console.error('Plan adaptation assessment failed:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 