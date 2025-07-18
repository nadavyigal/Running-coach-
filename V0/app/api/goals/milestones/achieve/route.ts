import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/db';
import { goalProgressEngine } from '@/lib/goalProgressEngine';

const AchieveMilestoneSchema = z.object({
  milestoneId: z.number(),
  achievedAt: z.string().transform(str => new Date(str)).optional(),
  achievedValue: z.number().optional(),
  notes: z.string().optional(),
  celebrationLevel: z.enum(['bronze', 'silver', 'gold', 'diamond']).optional(),
  shareAchievement: z.boolean().optional().default(false)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const achievementData = AchieveMilestoneSchema.parse(body);

    // Get the milestone
    const milestone = await dbUtils.goalMilestones?.get(achievementData.milestoneId);
    if (!milestone) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // Check if milestone is already achieved
    if (milestone.status === 'achieved') {
      return NextResponse.json(
        { error: 'Milestone already achieved' },
        { status: 400 }
      );
    }

    // Get the goal for context
    const goal = await dbUtils.getGoal(milestone.goalId);
    if (!goal) {
      return NextResponse.json(
        { error: 'Associated goal not found' },
        { status: 404 }
      );
    }

    const achievedAt = achievementData.achievedAt || new Date();

    // Update milestone status
    await dbUtils.updateGoalMilestone(achievementData.milestoneId, {
      status: 'achieved',
      achievedAt,
      achievedValue: achievementData.achievedValue,
      notes: achievementData.notes,
      updatedAt: new Date()
    });

    // Check if this achievement triggers any streaks or special recognition
    const allMilestones = await dbUtils.getGoalMilestones(milestone.goalId);
    const achievedMilestones = allMilestones.filter(m => m.status === 'achieved');
    const consecutiveAchievements = calculateConsecutiveAchievements(achievedMilestones);

    // Determine celebration level
    let celebrationLevel = achievementData.celebrationLevel;
    if (!celebrationLevel) {
      celebrationLevel = determineCelebrationLevel(milestone, consecutiveAchievements, goal);
    }

    // Check if this is a personal best
    const isPersonalBest = await checkPersonalBest(milestone, achievementData.achievedValue, goal);

    // Update goal progress
    await goalProgressEngine.updateGoalProgressFromMilestone(milestone.goalId, achievementData.milestoneId);

    // Activate next milestone if available
    const nextMilestone = allMilestones
      .filter(m => m.status === 'pending')
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
    
    if (nextMilestone) {
      await dbUtils.updateGoalMilestone(nextMilestone.id!, { status: 'active' });
    }

    // Generate motivational message
    const motivationalMessage = generateMotivationalMessage(
      milestone,
      goal,
      celebrationLevel,
      consecutiveAchievements,
      isPersonalBest
    );

    // Check for goal completion
    const goalProgress = await goalProgressEngine.calculateGoalProgress(milestone.goalId);
    const isGoalCompleted = goalProgress && goalProgress.progressPercentage >= 100;

    if (isGoalCompleted) {
      await dbUtils.updateGoal(milestone.goalId, { 
        status: 'completed',
        completedAt: achievedAt
      });
    }

    // Create achievement record for history
    const achievementRecord = {
      milestoneId: achievementData.milestoneId,
      goalId: milestone.goalId,
      userId: goal.userId,
      achievedAt,
      celebrationLevel,
      consecutiveAchievements,
      isPersonalBest,
      notes: achievementData.notes
    };

    // Log achievement in progress history
    await dbUtils.recordGoalProgress({
      goalId: milestone.goalId,
      measurementDate: achievedAt,
      measuredValue: achievementData.achievedValue || milestone.targetValue,
      progressPercentage: goalProgress?.progressPercentage || 0,
      contributingActivityId: null,
      contributingActivityType: 'milestone',
      notes: `Milestone achieved: ${milestone.title}`,
      autoRecorded: false,
      context: {
        milestoneId: achievementData.milestoneId,
        celebrationLevel,
        isPersonalBest
      }
    });

    // Prepare celebration data
    const celebrationData = {
      milestone: {
        ...milestone,
        achievedAt,
        celebrationLevel,
        personalBest: isPersonalBest,
        streakCount: consecutiveAchievements
      },
      goal: {
        title: goal.title,
        type: goal.goalType
      },
      achievement: achievementRecord,
      nextMilestone: nextMilestone ? {
        id: nextMilestone.id,
        title: nextMilestone.title,
        targetValue: nextMilestone.targetValue
      } : null
    };

    return NextResponse.json({
      success: true,
      message: motivationalMessage,
      celebration: true,
      celebrationData,
      goalCompleted: isGoalCompleted,
      nextMilestone: nextMilestone ? {
        id: nextMilestone.id,
        title: nextMilestone.title,
        description: nextMilestone.description,
        targetValue: nextMilestone.targetValue,
        targetDate: nextMilestone.targetDate
      } : null,
      statistics: {
        totalMilestones: allMilestones.length,
        achievedMilestones: achievedMilestones.length + 1, // Include this one
        consecutiveAchievements,
        progressPercentage: goalProgress?.progressPercentage || 0
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error achieving milestone:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid achievement data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to mark milestone as achieved' },
      { status: 500 }
    );
  }
}

function calculateConsecutiveAchievements(achievedMilestones: any[]): number {
  if (achievedMilestones.length === 0) return 1;
  
  // Sort by sequence order
  const sortedMilestones = achievedMilestones.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  
  // Count consecutive achievements from the end
  let consecutive = 1;
  for (let i = sortedMilestones.length - 1; i > 0; i--) {
    if (sortedMilestones[i].sequenceOrder === sortedMilestones[i-1].sequenceOrder + 1) {
      consecutive++;
    } else {
      break;
    }
  }
  
  return consecutive;
}

function determineCelebrationLevel(
  milestone: any, 
  consecutiveAchievements: number, 
  goal: any
): 'bronze' | 'silver' | 'gold' | 'diamond' {
  // Diamond: Critical milestones or major streaks
  if (milestone.category === 'critical' || consecutiveAchievements >= 5) {
    return 'diamond';
  }
  
  // Gold: Major milestones or good streaks
  if (milestone.category === 'major' || consecutiveAchievements >= 3) {
    return 'gold';
  }
  
  // Silver: First few achievements or moderate streaks
  if (consecutiveAchievements >= 2) {
    return 'silver';
  }
  
  // Bronze: Standard achievements
  return 'bronze';
}

async function checkPersonalBest(milestone: any, achievedValue: number | undefined, goal: any): Promise<boolean> {
  if (!achievedValue) return false;
  
  // For time-based goals, lower is better
  if (goal.goalType === 'time_improvement') {
    return achievedValue < goal.baselineValue;
  }
  
  // For distance/frequency goals, higher is better
  if (['distance_achievement', 'frequency'].includes(goal.goalType)) {
    return achievedValue > goal.baselineValue;
  }
  
  return false;
}

function generateMotivationalMessage(
  milestone: any,
  goal: any,
  celebrationLevel: string,
  consecutiveAchievements: number,
  isPersonalBest: boolean
): string {
  const messages = {
    diamond: [
      "🏆 LEGENDARY ACHIEVEMENT! You've reached an extraordinary milestone!",
      "💎 Outstanding! This is what peak performance looks like!",
      "👑 Incredible work! You're setting the gold standard!"
    ],
    gold: [
      "🥇 Fantastic achievement! You're on fire!",
      "🔥 Excellent progress! Your dedication is paying off!",
      "⭐ Amazing work! You're crushing your goals!"
    ],
    silver: [
      "🥈 Great job! You're building serious momentum!",
      "📈 Solid achievement! Keep this progress going!",
      "💪 Well done! You're getting stronger every day!"
    ],
    bronze: [
      "🥉 Nice work! Every step counts towards your goal!",
      "🌟 Good progress! You're on the right track!",
      "🎯 Way to go! Consistency leads to success!"
    ]
  };

  let baseMessage = messages[celebrationLevel as keyof typeof messages][
    Math.floor(Math.random() * messages[celebrationLevel as keyof typeof messages].length)
  ];

  // Add streak bonus
  if (consecutiveAchievements > 2) {
    baseMessage += ` That's ${consecutiveAchievements} milestones in a row! 🔥`;
  }

  // Add personal best recognition
  if (isPersonalBest) {
    baseMessage += " Plus, that's a new personal best! 🚀";
  }

  return baseMessage;
}