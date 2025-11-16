import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/db';
import { adaptiveCoachingEngine } from '@/lib/adaptiveCoachingEngine';

const FeedbackSchema = z.object({
  userId: z.number(),
  interactionId: z.string().optional(),
  interactionType: z.enum(['workout_recommendation', 'chat_response', 'plan_adjustment', 'motivation', 'guidance']),
  feedbackType: z.enum(['rating', 'text', 'behavioral', 'quick_reaction']),
  rating: z.number().min(1).max(5).optional(),
  aspects: z.object({
    helpfulness: z.number().min(1).max(5).optional(),
    relevance: z.number().min(1).max(5).optional(),
    clarity: z.number().min(1).max(5).optional(),
    motivation: z.number().min(1).max(5).optional(),
    accuracy: z.number().min(1).max(5).optional(),
  }).optional(),
  feedbackText: z.string().optional(),
  context: z.object({
    weather: z.string().optional(),
    timeOfDay: z.string().optional(),
    userMood: z.string().optional(),
    recentPerformance: z.string().optional(),
    situationalFactors: z.array(z.string()).optional(),
  }).optional().default({}),
  coachingResponseId: z.string().optional(),
  improvementSuggestions: z.array(z.string()).optional(),
});

const FeedbackQuerySchema = z.object({
  userId: z.string().transform(Number).optional(),
  interactionType: z.string().optional(),
  limit: z.coerce.number().optional().default(50),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const feedbackData = FeedbackSchema.parse(body);
    
    // Process the feedback through the adaptive coaching engine
    await adaptiveCoachingEngine.processFeedback(feedbackData.userId, feedbackData);
    
    // Get updated coaching profile to show impact
    const updatedProfile = await dbUtils.getCoachingProfile(feedbackData.userId);
    
    // Get recent similar feedback to identify patterns
    const recentFeedback = await dbUtils.getCoachingFeedback(feedbackData.userId, 10);
    const similarFeedback = recentFeedback.filter(
      f => f.interactionType === feedbackData.interactionType
    );

    // Calculate impact on coaching effectiveness
    let effectivenessChange = 0;
    if (feedbackData.rating && updatedProfile) {
      const targetEffectiveness = (feedbackData.rating - 1) * 25; // Convert 1-5 to 0-100
      effectivenessChange = targetEffectiveness - updatedProfile.coachingEffectivenessScore;
    }

    // Identify if this feedback reveals new patterns
    const newPatterns = [];
    if (similarFeedback.length >= 3) {
      const avgRating = similarFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / similarFeedback.length;
      if (feedbackData.rating && Math.abs(feedbackData.rating - avgRating) > 1) {
        newPatterns.push(`Rating pattern change detected for ${feedbackData.interactionType}`);
      }
    }

    // Generate coaching response to the feedback
    let coachingResponse;
    try {
      coachingResponse = await adaptiveCoachingEngine.generatePersonalizedResponse(
        feedbackData.userId,
        `Thank you for the feedback on my ${feedbackData.interactionType.replace('_', ' ')}. ${feedbackData.feedbackText ? `You mentioned: "${feedbackData.feedbackText}". ` : ''}How can I improve my coaching for you?`,
        {
          currentGoals: ['improve coaching based on feedback'],
          recentActivity: `Provided feedback on ${feedbackData.interactionType}`,
          mood: feedbackData.context.userMood as any,
        }
      );
    } catch (error) {
      console.error('Error generating coaching response to feedback:', error);
    }

    const response = {
      success: true,
      message: 'Feedback received and processed successfully',
      impact: {
        effectivenessChange: Math.round(effectivenessChange * 10) / 10,
        newPatternsDetected: newPatterns.length,
        adaptationsMade: updatedProfile?.adaptationHistory.length || 0,
        coachingScore: updatedProfile?.coachingEffectivenessScore || 0,
      },
      insights: {
        similarFeedbackCount: similarFeedback.length,
        averageRatingForType: similarFeedback.length > 0 
          ? Math.round((similarFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / similarFeedback.length) * 10) / 10
          : null,
        newPatterns,
        improvementAreas: feedbackData.aspects ? 
          Object.entries(feedbackData.aspects)
            .filter(([, score]) => (score ?? 0) < 3)
            .map(([aspect]) => aspect) : [],
      },
      coachingResponse: coachingResponse ? {
        response: coachingResponse.response,
        adaptations: coachingResponse.adaptations,
        interactionId: coachingResponse.interactionId,
      } : null,
      nextSteps: [
        ...(effectivenessChange < -5 ? ['We\'ll adjust our coaching approach based on your feedback'] : []),
        ...(newPatterns.length > 0 ? ['New behavior patterns detected - coaching will adapt accordingly'] : []),
        ...(feedbackData.improvementSuggestions?.length ? ['Your suggestions will be incorporated into future interactions'] : []),
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing coaching feedback:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = FeedbackQuerySchema.parse({
      userId: searchParams.get('userId'),
      interactionType: searchParams.get('interactionType'),
      limit: searchParams.get('limit'),
    });

    const userId = params.userId || 1;
    
    // Get coaching feedback
    let feedback = await dbUtils.getCoachingFeedback(userId, params.limit);
    
    // Filter by interaction type if specified
    if (params.interactionType) {
      feedback = feedback.filter(f => f.interactionType === params.interactionType);
    }

    // Calculate summary statistics
    const totalFeedback = feedback.length;
    const averageRating = totalFeedback > 0 
      ? feedback.reduce((sum, f) => sum + (f.rating || 3), 0) / totalFeedback
      : 0;

    // Group by interaction type
    const byInteractionType = feedback.reduce((acc, f) => {
      if (!acc[f.interactionType]) {
        acc[f.interactionType] = [];
      }
      acc[f.interactionType].push(f);
      return acc;
    }, {} as Record<string, typeof feedback>);

    // Calculate trends (last 10 vs previous 10)
    const recent = feedback.slice(0, Math.min(10, feedback.length));
    const previous = feedback.slice(10, Math.min(20, feedback.length));
    
    const recentAvg = recent.length > 0 
      ? recent.reduce((sum, f) => sum + (f.rating || 3), 0) / recent.length
      : 0;
    const previousAvg = previous.length > 0 
      ? previous.reduce((sum, f) => sum + (f.rating || 3), 0) / previous.length
      : recentAvg;

    const trend = recentAvg - previousAvg;

    // Identify common themes in text feedback
    const textFeedback = feedback.filter(f => f.feedbackText).map(f => f.feedbackText!);
    const commonWords = textFeedback.flatMap(text => 
      text.toLowerCase().split(/\s+/).filter(word => 
        word.length > 3 && !['this', 'that', 'with', 'have', 'been', 'were', 'they', 'what', 'your', 'from', 'would'].includes(word)
      )
    );
    
    const wordFrequency = commonWords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topThemes = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    const response = {
      feedback: feedback.map(f => ({
        id: f.id,
        interactionType: f.interactionType,
        feedbackType: f.feedbackType,
        rating: f.rating,
        aspects: f.aspects,
        feedbackText: f.feedbackText,
        context: f.context,
        createdAt: f.createdAt,
        improvementSuggestions: f.improvementSuggestions,
      })),
      summary: {
        totalFeedback,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution: {
          5: feedback.filter(f => f.rating === 5).length,
          4: feedback.filter(f => f.rating === 4).length,
          3: feedback.filter(f => f.rating === 3).length,
          2: feedback.filter(f => f.rating === 2).length,
          1: feedback.filter(f => f.rating === 1).length,
        },
        trend: {
          direction: trend > 0.2 ? 'improving' : trend < -0.2 ? 'declining' : 'stable',
          change: Math.round(trend * 10) / 10,
          recentAverage: Math.round(recentAvg * 10) / 10,
          previousAverage: Math.round(previousAvg * 10) / 10,
        },
      },
      byInteractionType: Object.entries(byInteractionType).map(([type, feedbacks]) => ({
        type,
        count: feedbacks.length,
        averageRating: Math.round((feedbacks.reduce((sum, f) => sum + (f.rating || 3), 0) / feedbacks.length) * 10) / 10,
        recentFeedback: feedbacks.slice(0, 3),
      })),
      themes: {
        topWords: topThemes,
        commonConcerns: feedback
          .filter(f => f.rating && f.rating < 3)
          .map(f => f.feedbackText)
          .filter(Boolean)
          .slice(0, 5),
        positiveHighlights: feedback
          .filter(f => f.rating && f.rating > 4)
          .map(f => f.feedbackText)
          .filter(Boolean)
          .slice(0, 5),
      },
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        dateRange: {
          earliest: feedback.length > 0 ? feedback[feedback.length - 1].createdAt : null,
          latest: feedback.length > 0 ? feedback[0].createdAt : null,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching coaching feedback:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch coaching feedback' },
      { status: 500 }
    );
  }
}
