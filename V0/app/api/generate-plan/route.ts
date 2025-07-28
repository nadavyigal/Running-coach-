import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { withErrorHandling, ErrorResponses } from '@/lib/errorHandler.middleware';
import { withSecureOpenAI } from '@/lib/apiKeyManager';
import { withApiSecurity } from '@/lib/security.middleware';

/**
 * Zod schema for user context from onboarding data
 * 
 * Defines the structure for comprehensive user context including
 * motivations, barriers, coaching style, and other onboarding data.
 */
const UserContextSchema = z.object({
  goal: z.enum(['habit', 'distance', 'speed']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().min(1).max(7),
  preferredTimes: z.array(z.string()),
  age: z.number().optional(),
  motivations: z.array(z.string()),
  barriers: z.array(z.string()),
  coachingStyle: z.enum(['supportive', 'challenging', 'analytical', 'encouraging'])
});

/**
 * Zod schema for recent run data
 * 
 * Defines the structure for recent run data used in plan adaptation.
 */
const RunSchema = z.object({
  id: z.number().optional(),
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'other']),
  distance: z.number(),
  duration: z.number(),
  pace: z.number().optional(),
  completedAt: z.string().transform(str => new Date(str))
});

/**
 * Zod schema for current goals
 * 
 * Defines the structure for current user goals used in plan generation.
 */
const GoalSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  goalType: z.enum(['time_improvement', 'distance_achievement', 'frequency', 'race_completion', 'consistency', 'health']),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']),
  currentValue: z.number(),
  targetValue: z.number()
});

/**
 * Zod schema for enhanced plan request with onboarding data
 * 
 * Defines the structure for plan generation requests that include
 * comprehensive user context, recent runs, and adaptation triggers.
 */
const EnhancedPlanRequest = z.object({
  userId: z.number(),
  userContext: UserContextSchema,
  recentRuns: z.array(RunSchema).optional(),
  currentGoals: z.array(GoalSchema).optional(),
  adaptationTrigger: z.enum(['completion', 'goal_update', 'feedback', 'manual']).optional()
});

/**
 * Zod schema for individual workout validation
 * 
 * Defines the structure and constraints for a single workout in a training plan.
 * Used by AI generation to ensure consistent workout format.
 */
const WorkoutSchema = z.object({
  /** Week number in the training plan (1-12) */
  week: z.number().min(1).max(12),
  /** Day of the week for the workout */
  day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  /** Type of workout to perform */
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest']),
  /** Distance to run in kilometers (0-50) */
  distance: z.number().min(0).max(50),
  /** Optional duration in minutes (0-300) */
  duration: z.number().min(0).max(300).optional(),
  /** Optional notes with specific instructions */
  notes: z.string().optional()
});

/**
 * Zod schema for complete training plan validation
 * 
 * Ensures the generated training plan has all required fields
 * and maintains consistency across the entire plan structure.
 */
const PlanSchema = z.object({
  /** Human-readable title for the training plan */
  title: z.string(),
  /** Detailed description of the plan's purpose and approach */
  description: z.string(),
  /** Total duration of the plan in weeks (1-12) */
  totalWeeks: z.number().min(1).max(12),
  /** Array of all workouts in the plan */
  workouts: z.array(WorkoutSchema)
});

/**
 * Generates a personalized training plan using AI based on user preferences and goals.
 * 
 * This endpoint creates customized running training plans by leveraging OpenAI's GPT-4o
 * to generate structured workout schedules. The plan takes into account the user's
 * experience level, goals, available training days, and specific preferences.
 * 
 * @param req - Next.js request object containing user data and plan options
 * @param req.body.user - User profile with experience, goals, and preferences
 * @param req.body.planType - Optional specific type of training plan
 * @param req.body.targetDistance - Optional target race distance
 * @param req.body.rookie_challenge - Whether to include 14-day rookie challenge
 * 
 * @returns Promise<NextResponse> JSON response containing:
 *   - Success: `{ plan: PlanSchema, source: 'ai' }`
 *   - Error: `{ error: string, errorType: string, fallbackRequired: boolean }`
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/generate-plan', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     user: {
 *       experience: 'beginner',
 *       goal: 'habit',
 *       daysPerWeek: 3,
 *       preferredTimes: ['morning']
 *     },
 *     rookie_challenge: true
 *   })
 * });
 * ```
 * 
 * @throws {ValidationError} When user data is missing required fields
 * @throws {APIKeyError} When OpenAI API key is invalid or missing
 * @throws {GenerationError} When AI plan generation fails
 * 
 * @since 1.0.0
 */
async function generatePlanHandler(req: NextRequest) {
  const body = await req.json();
  
  // Check if this is an enhanced request with onboarding data
  if (body.userContext) {
    return await handleEnhancedPlanRequest(body);
  }
  
  // Handle legacy request format
  const { user, planType, targetDistance, rookie_challenge } = body;

  // Build the comprehensive prompt based on user preferences
  const prompt = buildPlanPrompt(user, planType, targetDistance, rookie_challenge);

  // Use secure OpenAI wrapper
  const result = await withSecureOpenAI(
    async () => {
      const { object: generatedPlan } = await generateObject({
        model: openai('gpt-4o'),
        schema: PlanSchema,
        prompt,
        temperature: 0.7,
      });
      return generatedPlan;
    }
  );

  if (!result.success) {
    return NextResponse.json(result.error, { status: result.error.status });
  }

  return NextResponse.json({ 
    plan: result.data,
    source: 'ai'
  });
}

export const POST = withApiSecurity(withErrorHandling(generatePlanHandler, 'GeneratePlan'));

/**
 * Handles enhanced plan requests with onboarding data integration
 * 
 * @param body - Enhanced plan request with user context, recent runs, and goals
 * @returns Promise<NextResponse> JSON response with personalized plan
 */
async function handleEnhancedPlanRequest(body: any) {
  // Validate the enhanced request
  const requestData = EnhancedPlanRequest.parse(body);
  
  // Build enhanced prompt with onboarding data
  const prompt = buildEnhancedPlanPrompt(requestData);

  // Use secure OpenAI wrapper
  const result = await withSecureOpenAI(
    async () => {
      const { object: generatedPlan } = await generateObject({
        model: openai('gpt-4o'),
        schema: PlanSchema,
        prompt,
        temperature: 0.7,
      });
      return generatedPlan;
    }
  );

  if (!result.success) {
    return NextResponse.json(result.error, { status: result.error.status });
  }

  return NextResponse.json({ 
    plan: result.data,
    source: 'ai',
    adaptationTrigger: requestData.adaptationTrigger,
    userContext: requestData.userContext
  });
}

/**
 * Builds a comprehensive prompt for AI-powered training plan generation.
 * 
 * This function constructs a detailed prompt that guides the AI in creating
 * personalized training plans based on user characteristics, goals, and preferences.
 * The prompt includes specific requirements for workout types, progression patterns,
 * and safety guidelines to ensure the generated plan is appropriate and effective.
 * 
 * @param user - User profile object containing training preferences and experience
 * @param user.experience - User's running experience level ('beginner' | 'intermediate' | 'advanced')
 * @param user.goal - Primary training goal ('habit' | 'distance' | 'speed')
 * @param user.daysPerWeek - Number of training days per week
 * @param user.preferredTimes - Array of preferred training times
 * @param planType - Optional specific plan type for specialized training
 * @param targetDistance - Optional target race distance for goal-specific training
 * @param rookie_challenge - Whether to generate a 14-day beginner-focused plan
 * 
 * @returns Detailed prompt string for AI plan generation
 * 
 * @throws {Error} When required user data fields are missing or invalid
 * 
 * @example
 * ```typescript
 * const prompt = buildPlanPrompt(
 *   {
 *     experience: 'beginner',
 *     goal: 'habit',
 *     daysPerWeek: 3,
 *     preferredTimes: ['morning', 'evening']
 *   },
 *   undefined,
 *   undefined,
 *   true
 * );
 * ```
 * 
 * @since 1.0.0
 */
function buildPlanPrompt(user: any, planType?: string, targetDistance?: string, rookie_challenge?: boolean): string {
  if (!user || !user.experience || !user.goal || !user.daysPerWeek || !user.preferredTimes) {
    throw new Error('Invalid user data provided for plan generation');
  }

  const basePrompt = `Create a personalized running training plan for a runner with the following profile:

**Runner Profile:**
- Experience Level: ${user.experience}
- Primary Goal: ${user.goal === 'habit' ? 'Build consistent running habit' : user.goal === 'distance' ? 'Increase running distance' : 'Improve running speed'}
- Preferred Training Days: ${user.daysPerWeek} days per week
- Preferred Times: ${user.preferredTimes.join(', ')}
${planType ? `- Plan Type: ${planType}` : ''}
${targetDistance ? `- Target Distance: ${targetDistance}` : ''}
${rookie_challenge ? '\n- This user is a rookie and should receive a 14-day rookie challenge plan focused on habit-building and gradual progression.' : ''}

**Requirements:**
- Create a ${user.experience === 'beginner' ? '4-week' : user.experience === 'intermediate' ? '6-week' : '8-week'} progressive training plan
- Include variety: easy runs, tempo runs, intervals, long runs, and rest days
- Follow the 80/20 rule (80% easy, 20% hard efforts)
- Progress gradually to avoid injury
- Include specific distances in kilometers
- Add helpful notes for each workout type

**Workout Types to Include:**
- easy: Comfortable pace runs for building aerobic base
- tempo: Comfortably hard pace runs for lactate threshold
- intervals: High-intensity interval training
- long: Weekly long runs for endurance
- time-trial: Occasional time trials for progress testing
- hill: Hill repeats for strength (if appropriate)
- rest: Complete rest days for recovery

**Guidelines:**
- Start conservatively and build gradually
- Include at least 1-2 rest days per week
- Long runs should be 20-30% of weekly volume
- Tempo runs: 20-40 minutes at threshold pace
- Intervals: 4-8 x 400m-1000m with recovery
- Easy runs: 3-8km depending on experience
- Include recovery notes and tips

Generate a structured plan that will help this runner achieve their goals safely and effectively.`;

  return basePrompt;
}

/**
 * Builds an enhanced prompt using comprehensive onboarding data
 * 
 * This function constructs a detailed prompt that incorporates user motivations,
 * barriers, coaching style, recent performance, and current goals to create
 * highly personalized training plans.
 * 
 * @param requestData - Enhanced plan request with full user context
 * @returns Detailed prompt string for AI plan generation
 */
function buildEnhancedPlanPrompt(requestData: any): string {
  const { userContext, recentRuns, currentGoals, adaptationTrigger } = requestData;
  
  const prompt = `Create a highly personalized running training plan using comprehensive user context:

**Runner Profile:**
- Experience Level: ${userContext.experience}
- Primary Goal: ${userContext.goal === 'habit' ? 'Build consistent running habit' : userContext.goal === 'distance' ? 'Increase running distance' : 'Improve running speed'}
- Training Days: ${userContext.daysPerWeek} days per week
- Preferred Times: ${userContext.preferredTimes.join(', ')}
${userContext.age ? `- Age: ${userContext.age} years old` : ''}

**Personal Context:**
- Motivations: ${userContext.motivations.join(', ')}
- Barriers: ${userContext.barriers.join(', ')}
- Coaching Style: ${userContext.coachingStyle} (adjust tone and detail level accordingly)

**Recent Performance:**
${recentRuns && recentRuns.length > 0 ? 
  `- Recent Runs: ${recentRuns.map((run: any) => 
    `${run.type} run: ${run.distance}km in ${Math.round(run.duration/60)}min (${Math.round(run.pace || 0)}s/km pace)`
  ).join(', ')}` : 
  '- No recent run data available'
}

**Current Goals:**
${currentGoals && currentGoals.length > 0 ? 
  currentGoals.map((goal: any) => 
    `- ${goal.title}: ${goal.currentValue}/${goal.targetValue} (${goal.status})`
  ).join('\n') : 
  '- No specific goals set'
}

**Adaptation Context:**
${adaptationTrigger ? `- Trigger: ${adaptationTrigger} (adjust plan accordingly)` : '- New plan generation'}

**Requirements:**
- Create a ${userContext.experience === 'beginner' ? '4-week' : userContext.experience === 'intermediate' ? '6-week' : '8-week'} progressive training plan
- Address specific barriers: ${userContext.barriers.join(', ')}
- Align with motivations: ${userContext.motivations.join(', ')}
- Use ${userContext.coachingStyle} coaching style with appropriate tone and detail
- Include variety: easy runs, tempo runs, intervals, long runs, and rest days
- Follow the 80/20 rule (80% easy, 20% hard efforts)
- Progress gradually to avoid injury
- Include specific distances in kilometers
- Add personalized notes addressing motivations and barriers

**Workout Types to Include:**
- easy: Comfortable pace runs for building aerobic base
- tempo: Comfortably hard pace runs for lactate threshold
- intervals: High-intensity interval training
- long: Weekly long runs for endurance
- time-trial: Occasional time trials for progress testing
- hill: Hill repeats for strength (if appropriate)
- rest: Complete rest days for recovery

**Personalization Guidelines:**
- Start conservatively and build gradually
- Include at least 1-2 rest days per week
- Long runs should be 20-30% of weekly volume
- Tempo runs: 20-40 minutes at threshold pace
- Intervals: 4-8 x 400m-1000m with recovery
- Easy runs: 3-8km depending on experience
- Include motivational notes that address specific barriers
- Use coaching style appropriate language and detail level
- Consider recent performance trends for progression

Generate a structured plan that will help this runner achieve their goals safely and effectively, addressing their specific motivations and barriers.`;

  return prompt;
} 