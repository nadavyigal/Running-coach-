import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Schema for workout generation
const WorkoutSchema = z.object({
  week: z.number().min(1).max(12),
  day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest']),
  distance: z.number().min(0).max(50),
  duration: z.number().min(0).max(300).optional(),
  notes: z.string().optional()
});

const PlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  totalWeeks: z.number().min(1).max(12),
  workouts: z.array(WorkoutSchema)
});

export async function POST(req: NextRequest) {
  try {
    const { user, planType, targetDistance, rookie_challenge } = await req.json();

    // Check for OpenAI API key with structured error response
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here' || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.warn('OpenAI API key not configured or invalid - returning structured error for fallback');
      return NextResponse.json({ 
        error: 'OpenAI API key is not configured or is invalid',
        errorType: 'API_KEY_INVALID',
        fallbackRequired: true,
        message: 'AI plan generation is not available due to an invalid API key. The app will use a fallback plan instead.'
      }, { status: 422 });
    }

    // Build the prompt based on user preferences
    const prompt = buildPlanPrompt(user, planType, targetDistance, rookie_challenge);

    try {
      const { object: generatedPlan } = await generateObject({
        model: openai('gpt-4o'),
        schema: PlanSchema,
        prompt,
        temperature: 0.7,
      });

      return NextResponse.json({ 
        plan: generatedPlan,
        source: 'ai'
      });
    } catch (error) {
      console.error('Error generating plan with OpenAI:', error);
      return NextResponse.json({ 
        error: 'Failed to generate plan with OpenAI',
        errorType: 'GENERATION_ERROR',
        fallbackRequired: true,
        message: 'There was an issue creating the plan using AI. A fallback plan will be used instead.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to generate plan:', error);
    
    // Provide structured error information for better frontend handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ 
      error: 'Failed to generate training plan',
      errorType: 'GENERATION_ERROR',
      fallbackRequired: true,
      message: 'AI plan generation failed. The app will use a fallback plan instead.',
      details: errorMessage
    }, { status: 500 });
  }
}

/**
 * Build a detailed prompt for plan generation
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