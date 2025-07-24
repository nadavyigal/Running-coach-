import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';

export async function POST(req: Request) {
  console.log('🎯 Onboarding Chat API: Starting request');
  
  try {
    // Add request timeout
    const TIMEOUT_MS = 30000; // 30 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS);
    });
    
    // Add request body validation
    const contentType = req.headers.get('content-type');
    console.log('📋 Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Invalid content type:', contentType);
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
    
    console.log('📨 Request data:', {
      messagesCount: messages?.length || 0,
      userId,
      currentPhase,
      hasUserContext: !!userContext
    });

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('❌ Invalid messages array:', messages);
      return NextResponse.json({
        error: 'Messages array is required and cannot be empty',
        fallback: true
      }, { status: 400 });
    }

    if (!currentPhase) {
      console.error('❌ Missing currentPhase');
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
    
    console.log('🤖 Building onboarding prompt for phase:', currentPhase);
    const onboardingPrompt = OnboardingPromptBuilder.buildPrompt(currentPhase as any, conversationHistory, userContext);

    // Prepare messages for OpenAI
    const userMessage = messages[messages.length - 1];
    const apiMessages = [
      { role: "system" as const, content: onboardingPrompt },
      { role: "user" as const, content: userMessage.content }
    ];
    
    console.log('📤 Calling OpenAI with messages:', apiMessages.length);

    // Call OpenAI with streaming and timeout
    const streamResult = await Promise.race([
      streamText({
        model: openai("gpt-4o"),
        messages: apiMessages,
        maxTokens: 300, // Limit for onboarding responses
        temperature: 0.7,
      }),
      timeoutPromise
    ]) as any;

    console.log('✅ OpenAI response received');
    
    // Get the response stream and return
    const stream = streamResult.toDataStreamResponse();
    
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
    console.error('❌ Onboarding chat API error:', error);
    console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        console.log('⏱️ Request timed out');
        return NextResponse.json({
          error: "I'm taking a bit longer than usual to respond. Let me try a simpler approach - what specific running question can I help you with?",
          fallback: true
        }, { status: 408 });
      }
      
      if (error.message.includes('rate limit')) {
        console.log('🚫 Rate limit hit');
        return NextResponse.json({
          error: "I'm getting a lot of questions right now. Please try again in a moment.",
          fallback: true
        }, { status: 429 });
      }
      
      if (error.message.includes('API key') || error.message.includes('unauthorized')) {
        console.log('🔑 API key issue');
        return NextResponse.json({
          error: "AI service is temporarily unavailable. Please try the guided form instead.",
          fallback: true,
          redirectToForm: true
        }, { status: 503 });
      }
    }
    
    return NextResponse.json({
      error: "I'm having trouble processing your message right now. Please try again or use the guided form.",
      fallback: true,
      redirectToForm: true
    }, { status: 500 });
  }
}
