import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';

export async function POST(req: Request) {
  try {
    // Add request body validation
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      return NextResponse.json({
        error: 'Content-Type must be application/json',
        fallback: true
      }, { status: 400 });
    }

    // Check if request body is empty
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      console.error('Empty request body received');
      return NextResponse.json({
        error: 'Request body cannot be empty',
        fallback: true
      }, { status: 400 });
    }

    // Parse JSON with error handling
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        fallback: true
      }, { status: 400 });
    }

    const { messages, userId, userContext, currentPhase } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        error: 'Messages array is required and cannot be empty',
        fallback: true
      }, { status: 400 });
    }

    if (!currentPhase) {
      return NextResponse.json({
        error: 'Current phase is required',
        fallback: true
      }, { status: 400 });
    }

    // Check OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json({
        error: 'AI service is not configured',
        fallback: true,
        message: 'Please configure your OpenAI API key to use the AI coach.'
      }, { status: 503 });
    }

    // Build onboarding prompt using conversation history from request
    const conversationHistory = messages.map((msg: any) => ({
      id: `${msg.role}-${Date.now()}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(),
    }));
    
    const onboardingPrompt = OnboardingPromptBuilder.buildPrompt(currentPhase as any, conversationHistory, userContext);

    // Prepare messages for OpenAI
    const userMessage = messages[messages.length - 1];
    const apiMessages = [
      { role: "system" as const, content: onboardingPrompt },
      { role: "user" as const, content: userMessage.content }
    ];

    // Call OpenAI with streaming
    const result = streamText({
      model: openai("gpt-4o"),
      messages: apiMessages,
      maxTokens: 300, // Limit for onboarding responses
      temperature: 0.7,
    });

    // Get the response stream and return
    const stream = result.toDataStreamResponse();
    
    return new Response(stream.body, {
      status: 200,
      headers: {
        ...stream.headers,
        'X-Coaching-Interaction-Id': `onboarding-${Date.now()}`,
        'X-Coaching-Confidence': '0.8',
        'X-Onboarding-Next-Phase': currentPhase,
      },
    });

  } catch (error) {
    console.error('Onboarding chat API error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      fallback: true
    }, { status: 500 });
  }
}
