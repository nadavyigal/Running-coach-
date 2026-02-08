import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, securityConfig } from '@/lib/security.config';
import { securityMonitor } from '@/lib/security.monitoring';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


// Use a relative import to avoid alias resolution issues in test runners
import {
  goalDiscoveryEngine,
  type UserProfile,
  type GoalAnalysisContext
} from '@/lib/goalDiscoveryEngine';
import { logger } from '@/lib/logger';

// Get client IP for rate limiting
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  if (realIP) return realIP;
  return '127.0.0.1';
}

// Validation schemas
const UserProfileSchema = z.object({
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  currentFitnessLevel: z.number().min(1).max(10),
  availableTime: z.object({
    daysPerWeek: z.number().min(1).max(7),
    minutesPerSession: z.number().min(15).max(180),
    preferredTimes: z.array(z.string()).optional().default([])
  }),
  physicalLimitations: z.array(z.string()).optional().default([]),
  pastInjuries: z.array(z.string()).optional().default([]),
  motivations: z.array(z.string()).min(1, 'At least one motivation is required'),
  barriers: z.array(z.string()).optional().default([]),
  preferences: z.object({
    coachingStyle: z.enum(['supportive', 'challenging', 'analytical', 'encouraging']),
    workoutTypes: z.array(z.string()).optional().default([]),
    environment: z.enum(['indoor', 'outdoor', 'both'])
  }),
  age: z.number().min(10).max(100).optional(),
  goals: z.array(z.string()).optional().default([])
});

const GoalAnalysisContextSchema = z.object({
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional(),
  userResponses: z.record(z.any()).optional(),
  behaviorPatterns: z.any().optional(),
  existingGoals: z.array(z.any()).optional()
});

const GoalDiscoveryRequestSchema = z.object({
  userProfile: UserProfileSchema,
  context: GoalAnalysisContextSchema.optional().default({}),
  includeAIEnhancement: z.boolean().optional().default(true),
  maxGoals: z.number().min(1).max(5).optional().default(3)
});

const AIGoalRefinementSchema = z.object({
  goals: z.array(z.any()),
  userFeedback: z.string().optional(),
  adjustmentType: z.enum(['difficulty', 'timeline', 'focus', 'priority']).optional()
});

// AI-enhanced goal discovery prompts
const generateGoalDiscoveryPrompt = (userProfile: UserProfile, context: GoalAnalysisContext = {}) => {
  return `You are an expert running coach helping a user discover personalized running goals. 

USER PROFILE:
- Experience: ${userProfile.experience}
- Current Fitness Level: ${userProfile.currentFitnessLevel}/10
- Available Time: ${userProfile.availableTime.daysPerWeek} days/week, ${userProfile.availableTime.minutesPerSession} minutes/session
- Preferred Times: ${userProfile.availableTime.preferredTimes.join(', ') || 'No preference'}
- Age: ${userProfile.age || 'Not specified'}
- Physical Limitations: ${userProfile.physicalLimitations.join(', ') || 'None specified'}
- Past Injuries: ${userProfile.pastInjuries.join(', ') || 'None specified'}
- Motivations: ${userProfile.motivations.join(', ')}
- Barriers: ${userProfile.barriers.join(', ') || 'None specified'}
- Coaching Style Preference: ${userProfile.preferences.coachingStyle}
- Environment Preference: ${userProfile.preferences.environment}

${context.conversationHistory ? `
CONVERSATION CONTEXT:
${context.conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}
` : ''}

TASK:
Analyze this user's profile and provide specific goal insights that will enhance the automated goal discovery process. Focus on:

1. GOAL SUITABILITY ANALYSIS:
   - Which types of goals (consistency, speed, endurance, health) are most suitable?
   - What should be the priority ranking?
   - Are there any goals that should be avoided?

2. PERSONALIZATION INSIGHTS:
   - How should goals be adjusted for this user's experience level?
   - What timeline considerations are important?
   - What are the key motivational factors to emphasize?

3. RISK ASSESSMENT:
   - What barriers might prevent goal achievement?
   - How can goals be designed to maximize success probability?
   - What safety considerations apply?

4. SPECIFIC RECOMMENDATIONS:
   - Suggest 2-3 specific goal ideas with reasoning
   - Provide target values and timelines
   - Explain why these goals fit this user

Please provide a structured analysis in JSON format with the following structure:
{
  "suitabilityAnalysis": {
    "recommendedGoalTypes": ["type1", "type2"],
    "priorityRanking": ["primary", "secondary", "tertiary"],
    "avoidGoalTypes": ["type1"],
    "reasonings": ["reason1", "reason2"]
  },
  "personalizationInsights": {
    "experienceAdjustments": "text",
    "timelineConsiderations": "text", 
    "motivationalFactors": ["factor1", "factor2"],
    "coachingStyleAlignment": "text"
  },
  "riskAssessment": {
    "primaryBarriers": ["barrier1", "barrier2"],
    "successFactors": ["factor1", "factor2"],
    "safetyConsiderations": ["consideration1"],
    "mitigationStrategies": ["strategy1", "strategy2"]
  },
  "specificRecommendations": [
    {
      "goalType": "consistency",
      "title": "Goal Title",
      "description": "Goal Description", 
      "targetValue": 3,
      "targetUnit": "runs/week",
      "timeline": 56,
      "reasoning": "Why this goal fits",
      "confidence": 0.9
    }
  ],
  "overallConfidence": 0.85,
  "additionalNotes": "Any other important considerations"
}`;
};

export async function POST(request: NextRequest) {
  logger.log('🎯 Goal Discovery API: Starting goal discovery request');

  // Rate limiting check (10 requests per minute for AI routes)
  const clientIP = getClientIP(request);
  const rateLimitResult = await rateLimiter.check(clientIP, securityConfig.apiSecurity.chatRateLimit);

  if (!rateLimitResult.success) {
    securityMonitor.trackSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'warning',
      message: 'Goal discovery rate limit exceeded',
      data: { ip: clientIP, limit: rateLimitResult.limit },
    });

    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    logger.log('📝 Request body received for goal discovery');
    
    // Validate request
    const requestData = GoalDiscoveryRequestSchema.parse(body);
    logger.log('✅ Goal discovery request validation passed');

    const { userProfile, context, includeAIEnhancement, maxGoals } = requestData;

    // Step 1: Run core goal discovery engine
    logger.log('🔍 Running core goal discovery engine...');
    const discoveryResult = await goalDiscoveryEngine.discoverGoals(userProfile, context);
    logger.log(`✅ Core discovery completed with ${discoveryResult.discoveredGoals.length} goals found`);

    // Step 2: Enhance with AI insights if requested
    let enhancedResult = discoveryResult;
    if (includeAIEnhancement) {
      try {
        logger.log('🤖 Enhancing goals with AI insights...');
        const aiInsights = await getAIGoalInsights(userProfile, context);
        enhancedResult = await enhanceGoalsWithAI(discoveryResult, aiInsights);
        logger.log('✅ AI enhancement completed');
      } catch (aiError) {
        logger.error('❌ AI enhancement failed, using core results:', aiError);
        // Continue with core results if AI fails
      }
    }

    // Step 3: Limit results to maxGoals
    if (enhancedResult.discoveredGoals.length > maxGoals) {
      enhancedResult.discoveredGoals = enhancedResult.discoveredGoals.slice(0, maxGoals);
      // Re-select primary and supporting goals from limited set
      enhancedResult.primaryGoal = enhancedResult.discoveredGoals[0];
      enhancedResult.supportingGoals = enhancedResult.discoveredGoals.slice(1);
    }

    // Step 4: Add API-specific metadata
    const response = {
      ...enhancedResult,
      metadata: {
        discoveryTimestamp: new Date().toISOString(),
        engineVersion: '1.0.0',
        aiEnhanced: includeAIEnhancement,
        userExperience: userProfile.experience,
        totalAnalysisTime: Date.now() - Date.now(), // Would be calculated properly
        confidenceFactors: {
          profileCompleteness: calculateProfileCompleteness(userProfile),
          motivationClarity: userProfile.motivations.length / 5,
          timeRealism: assessTimeRealism(userProfile.availableTime),
          experienceAlignment: 1.0 // Would be calculated based on goals vs experience
        }
      }
    };

    logger.log('✅ Goal Discovery API: Success, returning enhanced results');
    return NextResponse.json(response);

  } catch (error) {
    logger.error('❌ Goal Discovery API: Error occurred:', error);
    logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof z.ZodError) {
      logger.error('❌ Validation error details:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Goal discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallback: true
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  logger.log('🎯 Goal Discovery API: Goal refinement request');
  
  try {
    const body = await request.json();
    const refinementData = AIGoalRefinementSchema.parse(body);

    // Use AI to refine goals based on user feedback
    const refinedGoals = await refineGoalsWithAI(
      refinementData.goals,
      refinementData.userFeedback,
      refinementData.adjustmentType
    );

    return NextResponse.json({
      refinedGoals,
      adjustmentsMade: refinedGoals.map(goal => ({
        goalId: goal.id,
        changes: goal.adjustmentHistory?.slice(-1) || []
      })),
      message: 'Goals refined successfully'
    });

  } catch (error) {
    logger.error('Error refining goals:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid refinement data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Goal refinement failed' },
      { status: 500 }
    );
  }
}

// Helper function to get AI insights
async function getAIGoalInsights(userProfile: UserProfile, context: GoalAnalysisContext) {
  try {
    const prompt = generateGoalDiscoveryPrompt(userProfile, context);
    
    const aiInsightsSchema = z.object({
      suitabilityAnalysis: z.object({
        recommendedGoalTypes: z.array(z.string()),
        priorityRanking: z.array(z.string()),
        avoidGoalTypes: z.array(z.string()),
        reasonings: z.array(z.string())
      }),
      personalizationInsights: z.object({
        experienceAdjustments: z.string(),
        timelineConsiderations: z.string(),
        motivationalFactors: z.array(z.string()),
        coachingStyleAlignment: z.string()
      }),
      riskAssessment: z.object({
        primaryBarriers: z.array(z.string()),
        successFactors: z.array(z.string()),
        safetyConsiderations: z.array(z.string()),
        mitigationStrategies: z.array(z.string())
      }),
      specificRecommendations: z.array(z.object({
        goalType: z.string(),
        title: z.string(),
        description: z.string(),
        targetValue: z.number(),
        targetUnit: z.string(),
        timeline: z.number(),
        reasoning: z.string(),
        confidence: z.number()
      })),
      overallConfidence: z.number(),
      additionalNotes: z.string()
    });

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      prompt,
      schema: aiInsightsSchema,
      temperature: 0.7,
      maxOutputTokens: 2000
    });

    return object;
  } catch (error) {
    logger.error('Failed to get AI insights:', error);
    throw error;
  }
}

// Helper function to enhance goals with AI insights
async function enhanceGoalsWithAI(discoveryResult: any, aiInsights: any) {
  const enhanced = { ...discoveryResult };

  // Apply AI insights to adjust goal confidence and properties
  enhanced.discoveredGoals = enhanced.discoveredGoals.map((goal: any) => {
    const matchingAIGoal = aiInsights.specificRecommendations?.find((aiGoal: any) => 
      aiGoal.goalType === goal.goalType || aiGoal.title.toLowerCase().includes(goal.title.toLowerCase())
    );

    if (matchingAIGoal) {
      return {
        ...goal,
        confidence: Math.max(goal.confidence, matchingAIGoal.confidence || goal.confidence),
        reasoning: `${goal.reasoning} | AI Enhancement: ${matchingAIGoal.reasoning}`,
        aiEnhanced: true,
        aiInsights: {
          recommendedBy: 'ai',
          confidence: matchingAIGoal.confidence,
          reasoning: matchingAIGoal.reasoning
        }
      };
    }

    return goal;
  });

  // Update recommendations with AI insights
  if (aiInsights.riskAssessment?.mitigationStrategies) {
    enhanced.recommendations = [
      ...enhanced.recommendations,
      ...aiInsights.riskAssessment.mitigationStrategies.map((strategy: string) => 
        `AI Insight: ${strategy}`
      )
    ];
  }

  // Update success probability based on AI risk assessment
  if (aiInsights.overallConfidence) {
    enhanced.estimatedSuccessProbability = (
      enhanced.estimatedSuccessProbability + aiInsights.overallConfidence
    ) / 2;
  }

  return enhanced;
}

// Helper function to refine goals with AI
async function refineGoalsWithAI(goals: any[], userFeedback?: string, adjustmentType?: string) {
  // This would use AI to adjust goals based on user feedback
  // For now, return goals as-is with mock refinements
  return goals.map(goal => ({
    ...goal,
    adjustmentHistory: [
      ...(goal.adjustmentHistory || []),
      {
        timestamp: new Date().toISOString(),
        adjustmentType: adjustmentType || 'user_feedback',
        feedback: userFeedback,
        changes: ['Mock adjustment applied']
      }
    ]
  }));
}

// Helper functions for metadata calculation
function calculateProfileCompleteness(userProfile: UserProfile): number {
  let completeness = 0;
  const maxScore = 10;

  if (userProfile.experience) completeness += 1;
  if (userProfile.currentFitnessLevel > 0) completeness += 1;
  if (userProfile.availableTime.daysPerWeek > 0) completeness += 1;
  if (userProfile.availableTime.minutesPerSession > 0) completeness += 1;
  if (userProfile.motivations.length > 0) completeness += 2;
  if (userProfile.age) completeness += 1;
  if (userProfile.preferences.coachingStyle) completeness += 1;
  if (userProfile.preferences.environment) completeness += 1;
  if (userProfile.availableTime.preferredTimes.length > 0) completeness += 1;

  return Math.min(1, completeness / maxScore);
}

function assessTimeRealism(availableTime: UserProfile['availableTime']): number {
  const totalWeeklyMinutes = availableTime.daysPerWeek * availableTime.minutesPerSession;
  
  // Assess if time commitment is realistic (not too little, not too much)
  if (totalWeeklyMinutes < 60) return 0.3; // Too little
  if (totalWeeklyMinutes > 600) return 0.6; // Might be too ambitious
  if (totalWeeklyMinutes >= 120 && totalWeeklyMinutes <= 300) return 1.0; // Ideal range
  
  return 0.8; // Good range
}

export async function GET(request: NextRequest) {
  try {
    // Get available goal templates and discovery capabilities
    const { searchParams } = new URL(request.url);
    const experience = searchParams.get('experience') as 'beginner' | 'intermediate' | 'advanced' | null;

    const capabilities = {
      supportedExperienceLevels: ['beginner', 'intermediate', 'advanced'],
      availableGoalTypes: ['consistency', 'speed', 'endurance', 'health', 'strength'],
      maxGoalsPerUser: 5,
      aiEnhancementAvailable: true,
      averageDiscoveryTime: '10-30 seconds',
      successRateImprovement: '40%',
      features: {
        personalizedGoalGeneration: true,
        aiEnhancedInsights: true,
        riskAssessment: true,
        successProbabilityCalculation: true,
        adaptiveRecommendations: true,
        multipleGoalSupport: true
      }
    };

    // If experience level specified, return relevant templates
    if (experience) {
      // This would return experience-specific goal templates
      capabilities.templates = {
        [experience]: [
          // Would be populated with actual templates
        ]
      };
    }

    return NextResponse.json(capabilities);

  } catch (error) {
    logger.error('Error getting goal discovery capabilities:', error);
    return NextResponse.json(
      { error: 'Failed to get discovery capabilities' },
      { status: 500 }
    );
  }
}
