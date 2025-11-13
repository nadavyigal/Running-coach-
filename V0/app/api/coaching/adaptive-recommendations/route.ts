import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';
import { adaptiveCoachingEngine, UserContext } from '@/lib/adaptiveCoachingEngine';

const RecommendationsQuerySchema = z.object({
  userId: z.string().transform(Number).optional(),
  context: z.object({
    goals: z.array(z.string()).optional(),
    recentActivity: z.string().optional(),
    mood: z.enum(['energetic', 'tired', 'motivated', 'stressed', 'neutral']).optional(),
    environment: z.enum(['indoor', 'outdoor', 'gym', 'home']).optional(),
    timeConstraints: z.string().optional(),
    weather: z.object({
      condition: z.enum(['sunny', 'cloudy', 'rain', 'snow', 'windy']),
      temperature: z.number(),
      humidity: z.number().optional(),
    }).optional(),
    schedule: z.object({
      hasTime: z.boolean(),
      preferredDuration: z.number().optional(),
      flexibility: z.enum(['high', 'medium', 'low']),
    }).optional(),
  }).optional().default({}),
  includeAnalysis: z.string().transform(val => val === 'true').optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = RecommendationsQuerySchema.parse({
      userId: searchParams.get('userId'),
      context: searchParams.get('context') ? JSON.parse(searchParams.get('context')!) : {},
      includeAnalysis: searchParams.get('includeAnalysis'),
    });

    const userId = params.userId || 1;
    
    // Build user context
    const userContext: UserContext = {
      currentGoals: params.context.goals || ['improve fitness', 'stay consistent'],
      recentActivity: params.context.recentActivity || 'Regular training',
      mood: params.context.mood,
      environment: params.context.environment,
      timeConstraints: params.context.timeConstraints,
      weather: params.context.weather,
      schedule: params.context.schedule,
    };

    // Get adaptive recommendations
    const recommendations = await adaptiveCoachingEngine.generateAdaptiveRecommendations(userId, userContext);
    
    // Get coaching profile for context
    const profile = await dbUtils.getCoachingProfile(userId);
    
    // Analyze user patterns if requested
    let analysis = null;
    if (params.includeAnalysis) {
      const patterns = await dbUtils.getBehaviorPatterns(userId);
      const recentFeedback = await dbUtils.getCoachingFeedback(userId, 10);
      const recentRuns = await dbUtils.getRunsByUser(userId);
      const recentRunsLimited = recentRuns.slice(0, 20);

      // Analyze workout completion patterns
      const workoutCompletion = recentRunsLimited.length > 0 ? {
        totalPlanned: 20, // Assuming some planned workouts
        completed: recentRunsLimited.length,
        completionRate: (recentRunsLimited.length / 20) * 100,
        avgPerWeek: recentRunsLimited.length / 4, // Last 4 weeks
      } : null;

      // Analyze preferences
      const dayPreferences = recentRunsLimited.reduce((acc, run) => {
        const day = new Date(run.completedAt).toLocaleDateString('en', { weekday: 'long' });
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const typePreferences = recentRunsLimited.reduce((acc, run) => {
        acc[run.type] = (acc[run.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      analysis = {
        behaviorPatterns: patterns.map(p => ({
          type: p.patternType,
          confidence: p.confidenceScore,
          pattern: p.patternData.pattern,
          lastObserved: p.lastObserved,
        })),
        workoutAnalysis: workoutCompletion,
        preferences: {
          bestDays: Object.entries(dayPreferences)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([day, count]) => ({ day, count })),
          favoriteTypes: Object.entries(typePreferences)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type, count]) => ({ type, count })),
        },
        coachingEffectiveness: {
          score: profile?.coachingEffectivenessScore || 50,
          trend: recentFeedback.length > 5 ? 
            (recentFeedback.slice(0, 3).reduce((sum, f) => sum + (f.rating || 3), 0) / 3) -
            (recentFeedback.slice(3, 6).reduce((sum, f) => sum + (f.rating || 3), 0) / 3) : 0,
          totalFeedback: recentFeedback.length,
        },
      };
    }

    // Identify contextual factors
    const contextualFactors = [];
    
    if (userContext.weather) {
      if (userContext.weather.condition === 'rain') {
        contextualFactors.push('Rainy weather - indoor alternatives prepared');
      } else if (userContext.weather.temperature < 5) {
        contextualFactors.push('Cold weather - warm-up emphasis needed');
      } else if (userContext.weather.temperature > 25) {
        contextualFactors.push('Warm weather - hydration and heat management important');
      }
    }

    if (userContext.schedule?.hasTime === false) {
      contextualFactors.push('Limited time - shorter, efficient workouts prioritized');
    }

    if (userContext.mood === 'tired' || userContext.mood === 'stressed') {
      contextualFactors.push('Low energy detected - recovery-focused recommendations');
    }

    if (profile?.behavioralPatterns.workoutPreferences.preferredDays.length > 0) {
      const today = new Date().toLocaleDateString('en', { weekday: 'long' });
      if (profile.behavioralPatterns.workoutPreferences.preferredDays.includes(today)) {
        contextualFactors.push('Today matches your preferred workout days');
      }
    }

    // Add coaching insights
    const insights = [];
    
    if (profile) {
      if (profile.coachingEffectivenessScore > 80) {
        insights.push('Coaching rapport is strong - maintaining current approach');
      } else if (profile.coachingEffectivenessScore < 50) {
        insights.push('Coaching approach adapting based on your feedback');
      }

      const lastAdaptation = profile.adaptationHistory[profile.adaptationHistory.length - 1];
      if (lastAdaptation && new Date().getTime() - new Date(lastAdaptation.date).getTime() < 7 * 24 * 60 * 60 * 1000) {
        insights.push(`Recent coaching adaptation: ${lastAdaptation.adaptation}`);
      }
    }

    const response = {
      recommendations: recommendations.map(rec => ({
        type: rec.type,
        title: rec.title,
        description: rec.description,
        confidence: Math.round(rec.confidence * 100),
        reasoning: rec.reasoning,
        priority: rec.priority,
        actionable: rec.actionable,
        contextualFactors: rec.contextualFactors,
      })),
      contextualFactors: {
        detected: contextualFactors,
        userContext: {
          mood: userContext.mood || 'not specified',
          environment: userContext.environment || 'not specified',
          timeConstraints: userContext.timeConstraints || 'flexible',
          weather: userContext.weather ? 
            `${userContext.weather.condition}, ${userContext.weather.temperature}°C` : 'not provided',
        },
        adaptations: profile ? [
          `Communication: ${profile.communicationStyle.motivationLevel} motivation`,
          `Detail level: ${profile.communicationStyle.detailPreference}`,
          `Personality: ${profile.communicationStyle.personalityType}`,
        ] : [],
      },
      coachingInsights: insights,
      analysis: analysis,
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        profileAge: profile ? Math.floor((new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        recommendationCount: recommendations.length,
        highPriorityCount: recommendations.filter(r => r.priority === 'high').length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating adaptive recommendations:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate adaptive recommendations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, query, context } = body;

    if (!userId || !query) {
      return NextResponse.json(
        { error: 'User ID and query are required' },
        { status: 400 }
      );
    }

    // Build user context
    const userContext: UserContext = {
      currentGoals: context?.goals || ['get personalized coaching'],
      recentActivity: context?.recentActivity || 'Seeking guidance',
      mood: context?.mood,
      environment: context?.environment,
      timeConstraints: context?.timeConstraints,
      weather: context?.weather,
      schedule: context?.schedule,
    };

    // Generate personalized coaching response
    const coachingResponse = await adaptiveCoachingEngine.generatePersonalizedResponse(
      userId,
      query,
      userContext
    );

    // Also generate specific recommendations if requested
    let recommendations = [];
    if (query.toLowerCase().includes('recommend') || query.toLowerCase().includes('suggest')) {
      recommendations = await adaptiveCoachingEngine.generateAdaptiveRecommendations(userId, userContext);
    }

    const response = {
      coachingResponse: {
        response: coachingResponse.response,
        confidence: Math.round(coachingResponse.confidence * 100),
        adaptations: coachingResponse.adaptations,
        interactionId: coachingResponse.interactionId,
        contextUsed: coachingResponse.contextUsed,
        suggestedActions: coachingResponse.suggestedActions,
      },
      recommendations: recommendations.length > 0 ? recommendations.map(rec => ({
        type: rec.type,
        title: rec.title,
        description: rec.description,
        confidence: Math.round(rec.confidence * 100),
        priority: rec.priority,
      })) : [],
      requestFeedback: coachingResponse.requestFeedback,
      followUp: {
        suggestedQuestions: [
          'How does this recommendation feel to you?',
          'What aspects would you like me to adjust?',
          'Is there anything specific you\'d like me to focus on?',
        ],
        feedbackPrompt: coachingResponse.requestFeedback ? 
          'Your feedback helps me provide better coaching. Please rate this response and let me know how I can improve.' : null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing coaching request:', error);
    
    return NextResponse.json(
      { error: 'Failed to process coaching request' },
      { status: 500 }
    );
  }
}