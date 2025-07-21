import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { dbUtils } from '@/lib/db';
import { OnboardingSessionManager } from '@/lib/onboardingSessionManager';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';

// Token budget configuration for onboarding
const ONBOARDING_TOKEN_BUDGET = 50000; // Dedicated budget for onboarding
const ONBOARDING_RATE_LIMIT = 20; // Requests per hour for onboarding

// In-memory tracking (in production, use Redis or database)
const onboardingTokenUsage = new Map<string, { tokens: number; lastReset: Date }>();
const onboardingRequestCounts = new Map<string, { count: number; lastReset: Date }>();

function trackOnboardingTokenUsage(userId: string, tokens: number): boolean {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const key = `onboarding-${userId}-${currentMonth}`;
  
  const usage = onboardingTokenUsage.get(key) || { tokens: 0, lastReset: now };
  usage.tokens += tokens;
  onboardingTokenUsage.set(key, usage);
  
  return usage.tokens < ONBOARDING_TOKEN_BUDGET;
}

function checkOnboardingRateLimit(userId: string): boolean {
  const now = new Date();
  const hourKey = `onboarding-${userId}-${now.getHours()}`;
  
  const requests = onboardingRequestCounts.get(hourKey) || { count: 0, lastReset: now };
  
  // Reset if it's a new hour
  if (now.getTime() - requests.lastReset.getTime() > 3600000) {
    requests.count = 0;
    requests.lastReset = now;
  }
  
  requests.count++;
  onboardingRequestCounts.set(hourKey, requests);
  
  return requests.count <= ONBOARDING_RATE_LIMIT;
}



export async function POST(req: Request) {
  try {
    const { messages, userId, userContext, currentPhase } = await req.json();

    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    // Check OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error('OpenAI API key is not configured');
      return new NextResponse('AI service is not configured', { status: 503 });
    }

    // Rate limiting for onboarding
    if (!checkOnboardingRateLimit(userId.toString())) {
      return new NextResponse('Rate limit exceeded for onboarding', { status: 429 });
    }

    // Estimate token usage for budget check
    const estimatedTokens = messages.reduce((acc: number, msg: any) => 
      acc + (msg.content?.length || 0) / 4, 0) + 500; // Add buffer for prompt
    
    if (!trackOnboardingTokenUsage(userId.toString(), estimatedTokens)) {
      return new NextResponse('Onboarding token budget exceeded', { status: 429 });
    }

    const onboardingSessionManager = new OnboardingSessionManager(parseInt(userId));
    let session = await onboardingSessionManager.loadSession();

    if (!session) {
      session = await onboardingSessionManager.createNewSession();
    }

    // Add user message to history
    const userMessage = messages[messages.length - 1];
    await onboardingSessionManager.addMessageToHistory(userMessage.role, userMessage.content);

    // Build onboarding-specific prompt
    const conversationHistory = await onboardingSessionManager.getConversationHistory();
    const onboardingPrompt = OnboardingPromptBuilder.buildPrompt(currentPhase as any, conversationHistory, userContext);

    // Prepare messages for OpenAI
    const apiMessages = [
      { role: "system" as const, content: onboardingPrompt },
      { role: "user" as const, content: userMessage.content }
    ];

    try {
      // Call OpenAI with streaming
      const result = streamText({
        model: openai("gpt-4o"),
        messages: apiMessages,
        maxTokens: 300, // Limit for onboarding responses
        temperature: 0.7,
      });

      // Get the response stream
      const stream = result.toDataStreamResponse();
      
      // Add onboarding metadata to headers
      const response = new Response(stream.body, {
        status: 200,
        headers: {
          ...stream.headers,
          'X-Coaching-Interaction-Id': `onboarding-${Date.now()}`,
          'X-Coaching-Confidence': '0.8', // High confidence for onboarding
          'X-Onboarding-Next-Phase': currentPhase, // Will be updated by frontend
        },
      });

      // Add AI response to history asynchronously
      setTimeout(async () => {
        try {
          // Extract response content from stream (simplified)
          const responseText = "AI response generated"; // In practice, would extract from stream
          await onboardingSessionManager.addMessageToHistory('assistant', responseText);
        } catch (error) {
          console.error('Failed to save AI response to history:', error);
        }
      }, 100);

      return response;

    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Fallback to guided form-based onboarding
      const fallbackResponse = {
        error: "AI service temporarily unavailable",
        fallback: true,
        message: "Let's continue with a guided form to set up your running goals.",
        nextPhase: 'fallback'
      };

      return new NextResponse(JSON.stringify(fallbackResponse), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Coaching-Interaction-Id': `onboarding-fallback-${Date.now()}`,
          'X-Coaching-Confidence': '0.3',
          'X-Onboarding-Next-Phase': 'fallback',
        },
      });
    }

  } catch (error) {
    console.error('Onboarding chat API error:', error);
    
    // Network or other errors
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return new NextResponse(JSON.stringify({
          error: "Network connection failed. Please check your internet and try again.",
          fallback: true
        }), { status: 503 });
      }
      
      if (error.message.includes('timeout')) {
        return new NextResponse(JSON.stringify({
          error: "Request timeout. Please try again.",
          fallback: true
        }), { status: 408 });
      }
    }

    return new NextResponse(JSON.stringify({
      error: "An unexpected error occurred. Please try again.",
      fallback: true
    }), { status: 500 });
  }
}
