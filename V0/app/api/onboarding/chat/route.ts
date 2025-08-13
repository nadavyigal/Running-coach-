import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';

// Cancellable timeout helper to guard long-running OpenAI calls without leaking unhandled rejections
function createTimeout(ms: number) {
  let timer: NodeJS.Timeout | null = null;
  let rejectFn: ((reason?: any) => void) | null = null;
  const promise = new Promise((_, reject) => {
    rejectFn = reject;
    timer = setTimeout(() => reject(new Error('Request timeout')), ms);
  });
  const cancel = () => {
    if (timer) clearTimeout(timer);
    // ensure no further rejection
    rejectFn = null;
    timer = null;
  };
  return { promise, cancel } as const;
}

export async function POST(req: Request) {
  console.log('🎯 Onboarding Chat API: Starting request');
  
  try {
    // Check OpenAI API key first before doing anything else
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || openaiKey === 'your_openai_api_key_here') {
      console.error('❌ OpenAI API key not configured, returning fallback immediately');
      return NextResponse.json({
        error: 'AI coaching is currently unavailable. Please use the guided form to complete your setup.',
        fallback: true,
        message: 'AI chat is not available right now. Let\'s continue with the step-by-step form instead.',
        redirectToForm: true
      }, { status: 503 });
    }
    
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

    // OpenAI key check already done at the beginning of the function

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

    // Call OpenAI with streaming and a cancellable timeout
    const { promise: timeout, cancel } = createTimeout(20000);
    const streamPromise = streamText({
      model: openai("gpt-4o"),
      messages: apiMessages,
      maxTokens: 300, // Limit for onboarding responses
      temperature: 0.7,
    });
    const streamResult = await Promise.race([streamPromise, timeout]) as any;
    // clear timeout so we don't get an unhandledRejection later
    cancel();

    console.log('✅ OpenAI response received');
    
    // Transform stream into '0:{"textDelta": ...}' lines expected by client parser
    const original = streamResult.toDataStreamResponse();
    const reader = original.body?.getReader();
    if (!reader) return original;
    const transformed = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(Boolean);
          for (const line of lines) {
            // Only forward content lines (channel 0). Drop control/error channels like '2:' and '3:'.
            if (line.startsWith('0:')) {
              controller.enqueue(encoder.encode(line + '\n'))
            }
          }
        }
        controller.close();
      }
    });

    // Naive phase advancement: after at least one user+assistant exchange in a phase, move forward.
    // In a real system this could be driven by an LLM tool result or heuristics.
    const phaseOrder = ["motivation","assessment","creation","refinement","complete"] as const
    const currentIndex = Math.max(0, phaseOrder.indexOf((currentPhase as string) as any))
    const nextPhaseHeader = currentIndex >= 0 && currentIndex < phaseOrder.length - 1
      ? phaseOrder[currentIndex + 1]
      : "complete"

    return new Response(transformed, {
      status: 200,
      headers: {
        ...original.headers,
        'X-Coaching-Interaction-Id': `onboarding-${Date.now()}`,
        'X-Coaching-Confidence': '0.8',
        // Drive client phase progression
        'X-Onboarding-Next-Phase': nextPhaseHeader,
        'X-Debug-Onboarding-Phase': String(currentPhase),
        'X-Debug-Messages-Count': String(messages?.length || 0),
      },
    });

  } catch (error) {
    console.error('❌ Onboarding chat API error:', error);
    console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    // Enhanced error handling with proper categorization
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Timeout errors
      if (error.message === 'Request timeout' || errorMessage.includes('timeout')) {
        console.log('⏱️ Request timed out');
        return NextResponse.json({
          error: "I'm taking a bit longer than usual to respond. Let me try a simpler approach - what specific running question can I help you with?",
          fallback: true,
          errorType: 'timeout',
          retryAfter: 5000
        }, { status: 408 });
      }
      
      // Rate limiting errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('too many requests')) {
        console.log('🚫 Rate limit hit');
        return NextResponse.json({
          error: "I'm getting a lot of questions right now. Please try again in a moment.",
          fallback: true,
          errorType: 'rate_limit',
          retryAfter: 60000
        }, { status: 429 });
      }
      
      // Authentication/API key errors
      if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        console.log('🔑 API key issue');
        return NextResponse.json({
          error: "AI service is temporarily unavailable. Please try the guided form instead.",
          fallback: true,
          redirectToForm: true,
          errorType: 'auth_error'
        }, { status: 503 });
      }
      
      // Service unavailable errors
      if (errorMessage.includes('503') || errorMessage.includes('service unavailable') || errorMessage.includes('temporarily unavailable')) {
        console.log('🛑 Service unavailable');
        return NextResponse.json({
          error: "AI service is temporarily down. Let's continue with the guided form instead.",
          fallback: true,
          redirectToForm: true,
          errorType: 'service_unavailable',
          retryAfter: 300000 // 5 minutes
        }, { status: 503 });
      }
      
      // Network/connection errors
      if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('fetch failed')) {
        console.log('🌐 Network error');
        return NextResponse.json({
          error: "Connection issue detected. Please check your internet and try again.",
          fallback: true,
          errorType: 'network_error',
          retryAfter: 10000
        }, { status: 502 });
      }
      
      // Token/context limit errors
      if (errorMessage.includes('token') || errorMessage.includes('context length') || errorMessage.includes('too long')) {
        console.log('📏 Token limit exceeded');
        return NextResponse.json({
          error: "Your message is too complex. Let's continue with the guided form instead.",
          fallback: true,
          redirectToForm: true,
          errorType: 'token_limit'
        }, { status: 413 });
      }
    }
    
    // Generic error fallback with enhanced logging
    console.error('❌ Unhandled error in onboarding chat:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      error: "I'm having trouble processing your message right now. Please try again or use the guided form.",
      fallback: true,
      redirectToForm: true,
      errorType: 'generic_error',
      errorCode: 'CHAT_API_ERROR'
    }, { status: 500 });
  }
}
