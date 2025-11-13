import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';

const MilestonesQuerySchema = z.object({
  goalId: z.string().transform(Number),
  status: z.enum(['pending', 'active', 'achieved', 'missed']).optional(),
  includeAchieved: z.string().transform(val => val === 'true').optional().default(true)
});

const CreateMilestoneSchema = z.object({
  goalId: z.number(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  targetValue: z.number(),
  targetDate: z.string().transform(str => new Date(str)),
  category: z.enum(['minor', 'major', 'critical']).default('major'),
  sequenceOrder: z.number().optional()
});

const UpdateMilestoneSchema = z.object({
  milestoneId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  targetDate: z.string().transform(str => new Date(str)).optional(),
  category: z.enum(['minor', 'major', 'critical']).optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'active', 'achieved', 'missed']).optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = MilestonesQuerySchema.parse({
      goalId: searchParams.get('goalId'),
      status: searchParams.get('status'),
      includeAchieved: searchParams.get('includeAchieved')
    });

    // Verify goal exists
    const goal = await dbUtils.getGoal(params.goalId);
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    let milestones = await dbUtils.getGoalMilestones(params.goalId);

    // Filter by status if specified
    if (params.status) {
      milestones = milestones.filter(m => m.status === params.status);
    }

    // Filter out achieved milestones if not requested
    if (!params.includeAchieved) {
      milestones = milestones.filter(m => m.status !== 'achieved');
    }

    // Calculate additional metadata for each milestone
    const enrichedMilestones = milestones.map(milestone => {
      const now = new Date();
      const daysUntilTarget = Math.ceil(
        (milestone.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...milestone,
        daysUntilTarget: daysUntilTarget > 0 ? daysUntilTarget : 0,
        isOverdue: daysUntilTarget < 0 && milestone.status !== 'achieved',
        isUpcoming: daysUntilTarget <= 7 && daysUntilTarget > 0,
        isNext: milestone.status === 'active' // This could be more sophisticated
      };
    });

    // Calculate milestone statistics
    const stats = {
      total: milestones.length,
      achieved: milestones.filter(m => m.status === 'achieved').length,
      active: milestones.filter(m => m.status === 'active').length,
      pending: milestones.filter(m => m.status === 'pending').length,
      missed: milestones.filter(m => m.status === 'missed').length,
      overdue: enrichedMilestones.filter(m => m.isOverdue).length,
      upcoming: enrichedMilestones.filter(m => m.isUpcoming).length
    };

    return NextResponse.json({
      milestones: enrichedMilestones,
      statistics: stats,
      goalTitle: goal.title
    });

  } catch (error) {
    console.error('Error fetching goal milestones:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch goal milestones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const milestoneData = CreateMilestoneSchema.parse(body);

    // Verify goal exists
    const goal = await dbUtils.getGoal(milestoneData.goalId);
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    // Auto-assign sequence order if not provided
    if (!milestoneData.sequenceOrder) {
      const existingMilestones = await dbUtils.getGoalMilestones(milestoneData.goalId);
      milestoneData.sequenceOrder = existingMilestones.length + 1;
    }

    // Create the milestone
    const milestoneId = await dbUtils.createGoalMilestone({
      ...milestoneData,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const createdMilestone = await dbUtils.goalMilestones?.get(milestoneId);

    return NextResponse.json({
      milestone: createdMilestone,
      message: 'Milestone created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating milestone:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid milestone data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updateData = UpdateMilestoneSchema.parse(body);
    const { milestoneId, ...updates } = updateData;

    // Check if milestone exists
    const existingMilestone = await dbUtils.goalMilestones?.get(milestoneId);
    if (!existingMilestone) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // Update the milestone
    await dbUtils.updateGoalMilestone(milestoneId, {
      ...updates,
      updatedAt: new Date()
    });

    const updatedMilestone = await dbUtils.goalMilestones?.get(milestoneId);

    return NextResponse.json({
      milestone: updatedMilestone,
      message: 'Milestone updated successfully'
    });

  } catch (error) {
    console.error('Error updating milestone:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid update data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');
    
    if (!milestoneId) {
      return NextResponse.json(
        { error: 'Milestone ID is required' },
        { status: 400 }
      );
    }

    const milestoneIdNum = parseInt(milestoneId);
    const milestone = await dbUtils.goalMilestones?.get(milestoneIdNum);
    
    if (!milestone) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    await dbUtils.deleteGoalMilestone(milestoneIdNum);

    return NextResponse.json({
      message: 'Milestone deleted successfully',
      deletedMilestoneId: milestoneIdNum
    });

  } catch (error) {
    console.error('Error deleting milestone:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    );
  }
}