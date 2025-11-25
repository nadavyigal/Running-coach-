import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoalRecommendation } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';
import { goalProgressEngine } from '@/lib/goalProgressEngine';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


const RecommendationsQuerySchema = z.object({
  userId: z.string().transform(Number),
  type: z.enum(['new_goal', 'adjustment', 'milestone', 'motivation', 'priority_change']).nullable().optional(),
  status: z.enum(['pending', 'accepted', 'dismissed', 'expired']).nullable().optional().default('pending'),
  includeExpired: z.string().transform(val => val === 'true').optional().default(false)
}).transform(data => ({
  ...data,
  // Convert null values to undefined for optional fields
  type: data.type === null ? undefined : data.type,
  status: data.status === null ? 'pending' : data.status
}));

const CreateRecommendationSchema = z.object({
  userId: z.number(),
  recommendationType: z.enum(['new_goal', 'adjustment', 'milestone', 'motivation', 'priority_change']),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number().min(0).max(1),
  recommendationData: z.object({
    goalId: z.number().optional(),
    suggestedChanges: z.record(z.any()).optional(),
    newGoalTemplate: z.record(z.any()).optional(),
    actionRequired: z.string().optional(),
    benefits: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional()
  }),
  expiresAt: z.string().transform(str => new Date(str)).optional()
});

const RespondToRecommendationSchema = z.object({
  recommendationId: z.number(),
  action: z.enum(['accepted', 'dismissed', 'modified']),
  feedback: z.string().optional(),
  modifications: z.record(z.any()).optional()
});

export async function GET(request: NextRequest) {
  try {
    // Temporary fix: Return mock data during onboarding to prevent API loops
    return NextResponse.json({
      success: true,
      data: [
        {
          id: 1,
          type: 'new_goal',
          title: 'Complete Onboarding',
          message: 'Finish setting up your profile to unlock personalized goal recommendations',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      ]
    });
    
    const { searchParams } = new URL(request.url);
    const params = RecommendationsQuerySchema.parse({
      userId: searchParams.get('userId'),
      type: searchParams.get('type'),
      status: searchParams.get('status'),
      includeExpired: searchParams.get('includeExpired')
    });

    // Get stored recommendations
    let recommendations = await dbUtils.getGoalRecommendations(params.userId, params.status);

    // Filter by type if specified
    if (params.type) {
      recommendations = recommendations.filter(r => r.recommendationType === params.type);
    }

    // Filter out expired recommendations unless explicitly requested
    if (!params.includeExpired) {
      const now = new Date();
      recommendations = recommendations.filter(r => !r.expiresAt || r.expiresAt > now);
    }

    // Generate dynamic recommendations based on current goal progress
    const dynamicRecommendations = await generateDynamicRecommendations(params.userId);

    return NextResponse.json({
      stored: recommendations,
      dynamic: dynamicRecommendations,
      summary: {
        total: recommendations.length + dynamicRecommendations.length,
        highPriority: [...recommendations, ...dynamicRecommendations]
          .filter(r => r.confidenceScore > 0.7).length,
        newGoals: [...recommendations, ...dynamicRecommendations]
          .filter(r => r.recommendationType === 'new_goal').length,
        adjustments: [...recommendations, ...dynamicRecommendations]
          .filter(r => r.recommendationType === 'adjustment').length
      }
    });

  } catch (error) {
    console.error('Error fetching goal recommendations:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    // Return empty recommendations instead of error to prevent UI breaking
    return NextResponse.json({
      stored: [],
      dynamic: [],
      summary: {
        total: 0,
        highPriority: 0,
        newGoals: 0,
        adjustments: 0
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recommendationData = CreateRecommendationSchema.parse(body);

    const recommendationId = await dbUtils.createGoalRecommendation(recommendationData);

    const created = await dbUtils.goalRecommendations?.get(recommendationId);

    return NextResponse.json({
      recommendation: created,
      message: 'Recommendation created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating goal recommendation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid recommendation data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create goal recommendation' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const responseData = RespondToRecommendationSchema.parse(body);

    // Update the recommendation with user response
    await dbUtils.updateGoalRecommendation(responseData.recommendationId, {
      status: responseData.action === 'accepted' ? 'accepted' : 'dismissed',
      userResponse: {
        action: responseData.action,
        feedback: responseData.feedback,
        modifications: responseData.modifications
      }
    });

    // If accepted, potentially take action
    if (responseData.action === 'accepted') {
      await handleAcceptedRecommendation(responseData.recommendationId, responseData.modifications);
    }

    return NextResponse.json({
      message: 'Recommendation response recorded successfully'
    });

  } catch (error) {
    console.error('Error responding to goal recommendation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid response data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to respond to recommendation' },
      { status: 500 }
    );
  }
}

async function generateDynamicRecommendations(userId: number): Promise<Partial<GoalRecommendation>[]> {
  const recommendations: Partial<GoalRecommendation>[] = [];
  
  // Get user's goals and their progress
  const activeGoals = await dbUtils.getGoalsByUser(userId, 'active');
  const completedGoals = await dbUtils.getGoalsByUser(userId, 'completed');
  const allGoals = await dbUtils.getGoalsByUser(userId);
  
  // Get recent runs for analysis
  const recentRuns = await dbUtils.getRunsByUser(userId);
  const last30DaysRuns = recentRuns.filter(run => {
    const runDate = new Date(run.completedAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return runDate >= thirtyDaysAgo;
  });

  // 1. Goal adjustment recommendations
  for (const goal of activeGoals) {
    const progress = await goalProgressEngine.calculateGoalProgress(goal.id!);
    if (progress) {
      // Recommend timeline adjustment if behind schedule
      if (progress.trajectory === 'at_risk' && progress.daysUntilDeadline > 14) {
        recommendations.push({
          userId,
          recommendationType: 'adjustment',
          title: `Adjust timeline for "${goal.title}"`,
          description: `Consider extending the deadline by ${Math.ceil(progress.daysUntilDeadline * 0.5)} days`,
          reasoning: `Current progress rate suggests the original timeline may be too aggressive. You're at ${Math.round(progress.progressPercentage)}% with ${progress.daysUntilDeadline} days remaining.`,
          confidenceScore: 0.8,
          recommendationData: {
            goalId: goal.id,
            suggestedChanges: {
              deadline: new Date(goal.timeBound.deadline.getTime() + (progress.daysUntilDeadline * 0.5 * 24 * 60 * 60 * 1000)),
              reasoning: 'Extended timeline for better success probability'
            },
            benefits: ['Higher success probability', 'Reduced stress', 'More sustainable progress'],
            risks: ['Delayed achievement', 'Potential loss of momentum']
          }
        });
      }

      // Recommend target adjustment if way ahead
      if (progress.trajectory === 'ahead' && progress.progressPercentage > 80) {
        recommendations.push({
          userId,
          recommendationType: 'adjustment',
          title: `Increase target for "${goal.title}"`,
          description: 'You\'re ahead of schedule - consider setting a more challenging target',
          reasoning: `You're at ${Math.round(progress.progressPercentage)}% progress with ${progress.daysUntilDeadline} days remaining. This indicates you could achieve more.`,
          confidenceScore: 0.7,
          recommendationData: {
            goalId: goal.id,
            suggestedChanges: {
              targetValue: goal.targetValue * (goal.goalType === 'time_improvement' ? 0.95 : 1.1)
            },
            benefits: ['Maximize potential', 'Maintain motivation', 'Greater achievement'],
            risks: ['Potential overreach', 'Increased pressure']
          }
        });
      }
    }
  }

  // 2. New goal recommendations
  if (activeGoals.length < 3) {
    // Recommend consistency goal if lacking regular activity
    const weeklyRunCount = last30DaysRuns.length / 4;
    if (weeklyRunCount < 2 && !activeGoals.some(g => g.goalType === 'frequency')) {
      recommendations.push({
        userId,
        recommendationType: 'new_goal',
        title: 'Build Running Consistency',
        description: 'Set a goal to run 2-3 times per week for the next 8 weeks',
        reasoning: `You've averaged ${Math.round(weeklyRunCount * 10) / 10} runs per week recently. Building consistency will improve all other goals.`,
        confidenceScore: 0.9,
        recommendationData: {
          newGoalTemplate: {
            title: 'Run 2-3 Times Per Week',
            goalType: 'frequency',
            category: 'consistency',
            priority: 1,
            specificTarget: {
              metric: 'weekly_runs',
              value: 2.5,
              unit: 'runs',
              description: 'Average 2-3 runs per week'
            },
            baselineValue: weeklyRunCount,
            targetValue: 2.5
          },
          benefits: ['Improved fitness base', 'Better performance in other goals', 'Habit formation'],
          actionRequired: 'Create new consistency goal'
        }
      });
    }

    // Recommend speed goal if only has endurance goals
    if (activeGoals.every(g => g.category !== 'speed') && last30DaysRuns.length > 8) {
      const avgPace = last30DaysRuns.reduce((sum, run) => sum + run.pace, 0) / last30DaysRuns.length;
      recommendations.push({
        userId,
        recommendationType: 'new_goal',
        title: 'Improve 5K Time',
        description: 'Add a speed goal to complement your endurance training',
        reasoning: `You have good training consistency but no speed-focused goals. Your current average pace is ${Math.round(avgPace)} seconds/km.`,
        confidenceScore: 0.75,
        recommendationData: {
          newGoalTemplate: {
            title: 'Improve 5K Personal Record',
            goalType: 'time_improvement',
            category: 'speed',
            priority: 2,
            specificTarget: {
              metric: '5k_time',
              value: 1500, // 25 minutes
              unit: 'seconds',
              description: 'Run 5K in under 25 minutes'
            }
          },
          benefits: ['Improved speed', 'Better racing performance', 'Training variety']
        }
      });
    }
  }

  // 3. Motivation recommendations
  if (activeGoals.length > 0) {
    const goalsNeedingMotivation = activeGoals.filter(g => {
      const daysSinceLastProgress = Math.floor((new Date().getTime() - g.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastProgress > 7;
    });

    if (goalsNeedingMotivation.length > 0) {
      recommendations.push({
        userId,
        recommendationType: 'motivation',
        title: 'Reconnect with Your Goals',
        description: `You haven't made progress on ${goalsNeedingMotivation.length} goal${goalsNeedingMotivation.length > 1 ? 's' : ''} recently`,
        reasoning: 'Regular progress tracking and small wins help maintain motivation and momentum.',
        confidenceScore: 0.8,
        recommendationData: {
          actionRequired: 'Schedule goal review session',
          benefits: ['Renewed motivation', 'Clear next steps', 'Progress momentum'],
          suggestedChanges: {
            addReminders: true,
            breakIntoSmallerSteps: true
          }
        }
      });
    }
  }

  // 4. Priority recommendations
  if (activeGoals.length > 2) {
    const multipleHighPriority = activeGoals.filter(g => g.priority === 1);
    if (multipleHighPriority.length > 1) {
      recommendations.push({
        userId,
        recommendationType: 'priority_change',
        title: 'Clarify Goal Priorities',
        description: `You have ${multipleHighPriority.length} high-priority goals which may compete for attention`,
        reasoning: 'Having too many high-priority goals can dilute focus and reduce success probability.',
        confidenceScore: 0.7,
        recommendationData: {
          suggestedChanges: {
            recommendedPrimary: multipleHighPriority[0].id,
            recommendedSecondary: multipleHighPriority.slice(1).map(g => g.id)
          },
          benefits: ['Clearer focus', 'Better resource allocation', 'Higher success rate'],
          actionRequired: 'Review and adjust goal priorities'
        }
      });
    }
  }

  return recommendations;
}

async function handleAcceptedRecommendation(recommendationId: number, modifications?: Record<string, any>): Promise<void> {
  const recommendation = await dbUtils.goalRecommendations?.get(recommendationId);
  if (!recommendation) return;

  try {
    switch (recommendation.recommendationType) {
      case 'adjustment':
        if (recommendation.recommendationData.goalId) {
          const changes = modifications || recommendation.recommendationData.suggestedChanges;
          await dbUtils.updateGoal(recommendation.recommendationData.goalId, changes);
        }
        break;

      case 'new_goal':
        if (recommendation.recommendationData.newGoalTemplate) {
          const goalTemplate = { ...recommendation.recommendationData.newGoalTemplate, ...modifications };
          
          // Set required fields for new goal
          const now = new Date();
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + (goalTemplate.totalDuration || 84)); // 12 weeks default

          await dbUtils.createGoal({
            userId: recommendation.userId,
            ...goalTemplate,
            timeBound: {
              startDate: now,
              deadline,
              totalDuration: goalTemplate.totalDuration || 84,
              milestoneSchedule: [25, 50, 75]
            },
            measurableMetrics: goalTemplate.measurableMetrics || [goalTemplate.specificTarget?.metric],
            achievableAssessment: {
              currentLevel: goalTemplate.baselineValue || 0,
              targetLevel: goalTemplate.targetValue || 0,
              feasibilityScore: 80
            },
            relevantContext: goalTemplate.relevantContext || 'Recommended goal based on analysis',
            currentValue: goalTemplate.baselineValue || 0,
            progressPercentage: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now
          });
        }
        break;

      case 'priority_change':
        const priorityChanges = modifications || recommendation.recommendationData.suggestedChanges;
        if (priorityChanges.recommendedPrimary) {
          await dbUtils.updateGoal(priorityChanges.recommendedPrimary, { priority: 1 });
        }
        if (priorityChanges.recommendedSecondary) {
          for (const goalId of priorityChanges.recommendedSecondary) {
            await dbUtils.updateGoal(goalId, { priority: 2 });
          }
        }
        break;
    }
  } catch (error) {
    console.error('Error handling accepted recommendation:', error);
  }
}