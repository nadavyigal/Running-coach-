import { NextResponse } from 'next/server';
import { chatDriver, ChatRequest } from '@/lib/chatDriver';
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const requestId = `onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  logger.log(`[onboarding:chat] requestId=${requestId} Starting onboarding chat request`);
  
  try {
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      logger.error(`[onboarding:chat] requestId=${requestId} Invalid content type:`, contentType);
      return NextResponse.json({
        error: 'Content-Type must be application/json',
        fallback: true,
        requestId,
      }, { status: 400 });
    }
    
    // Parse and validate request body
    let body;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim() === '') {
        throw new Error('Empty request body');
      }
      body = JSON.parse(bodyText);
    } catch (parseError) {
      logger.error(`[onboarding:chat] requestId=${requestId} JSON parsing error:`, parseError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        fallback: true,
        requestId,
      }, { status: 400 });
    }
    
    const { messages, userId, userContext, currentPhase, streaming = true } = body;
    
    logger.log(`[onboarding:chat] requestId=${requestId} Request data:`, {
      messagesCount: messages?.length || 0,
      userId,
      currentPhase,
      streaming,
      hasUserContext: !!userContext
    });
    
    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(`[onboarding:chat] requestId=${requestId} Invalid messages:`, messages);
      return NextResponse.json({
        error: 'Messages array is required and cannot be empty',
        fallback: true,
        requestId,
      }, { status: 400 });
    }
    
    if (!currentPhase) {
      logger.error(`[onboarding:chat] requestId=${requestId} Missing currentPhase`);
      return NextResponse.json({
        error: 'Current phase is required',
        fallback: true,
        requestId,
      }, { status: 400 });
    }
    
    // Check chat service health first
    const health = await chatDriver.health();
    if (!health.available) {
      logger.error(`[onboarding:chat] requestId=${requestId} Chat service unavailable:`, health.lastError);
      return NextResponse.json({
        error: 'AI coaching is currently unavailable. Please use the guided form to complete your setup.',
        fallback: true,
        redirectToForm: true,
        requestId,
      }, { status: 503 });
    }
    
    // Build onboarding-specific context
    logger.log(`[onboarding:chat] requestId=${requestId} Building onboarding prompt for phase:`, currentPhase);
    
    const conversationHistory = messages.map((msg: any) => ({
      id: `${msg.role}-${Date.now()}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(),
    }));
    
    const onboardingPrompt = OnboardingPromptBuilder.buildPrompt(
      currentPhase as any, 
      conversationHistory, 
      userContext
    );
    
    // Prepare chat request with onboarding-specific system prompt
    const userMessage = messages[messages.length - 1];
    const chatMessages = [
      { role: "system" as const, content: onboardingPrompt },
      { role: "user" as const, content: userMessage.content }
    ];
    
    const chatRequest: ChatRequest = {
      messages: chatMessages,
      userId: userId ? parseInt(userId) : undefined,
      currentPhase,
      streaming,
      maxTokens: 300, // Limit for onboarding responses
      model: "gpt-4o",
    };
    
    logger.log(`[onboarding:chat] requestId=${requestId} Sending to ChatDriver, streaming=${streaming}`);
    
    // Use ChatDriver for the actual AI request
    const response = await chatDriver.ask(chatRequest);
    
    if (!response.success) {
      const error = response.error!;
      logger.error(`[onboarding:chat] requestId=${requestId} ChatDriver error:`, error);
      
      // Map ChatDriver errors to onboarding-specific responses
      if (error.type === 'auth') {
        return NextResponse.json({
          error: 'AI coaching is currently unavailable. Please use the guided form instead.',
          fallback: true,
          redirectToForm: true,
          requestId,
        }, { status: 503 });
      }
      
      if (error.type === 'rate_limit') {
        return NextResponse.json({
          error: 'Too many requests. Please wait a moment before continuing.',
          fallback: true,
          retryAfter: error.retryAfter,
          requestId,
        }, { status: 429 });
      }
      
      if (error.type === 'timeout') {
        return NextResponse.json({
          error: 'Request timed out. Please try with a shorter message.',
          fallback: true,
          requestId,
        }, { status: 408 });
      }
      
      // Generic error fallback
      return NextResponse.json({
        error: error.message || 'AI coaching temporarily unavailable',
        fallback: true,
        redirectToForm: true,
        requestId,
      }, { status: error.code });
    }
    
    if (streaming && response.stream) {
      logger.log(`[onboarding:chat] requestId=${requestId} ✅ Returning streaming response`);
      
      // Transform the stream to match the expected client format
      const reader = response.stream.getReader();
      const transformedStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const text = decoder.decode(value);
              const lines = text.split('\n').filter(Boolean);
              
              for (const line of lines) {
                // Only forward content lines (channel 0) in the expected format
                if (line.startsWith('0:')) {
                  controller.enqueue(encoder.encode(line + '\n'));
                }
              }
            }
          } catch (error) {
            logger.error(`[onboarding:chat] requestId=${requestId} Stream error:`, error);
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      });
      
      return new Response(transformedStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Request-ID': requestId,
        },
      });
      
    } else if (response.data) {
      logger.log(`[onboarding:chat] requestId=${requestId} ✅ Returning non-streaming response`);
      
      // Non-streaming response
      return NextResponse.json({
        success: true,
        response: response.data.response,
        tokensIn: response.data.tokensIn,
        tokensOut: response.data.tokensOut,
        duration: response.data.duration,
        requestId: response.data.requestId,
      });
    }
    
    // Should not reach here
    throw new Error('Invalid response from ChatDriver');
    
  } catch (error) {
    logger.error(`[onboarding:chat] requestId=${requestId} Unexpected error:`, error);
    
    return NextResponse.json({
      error: 'An unexpected error occurred. Please try again.',
      fallback: true,
      redirectToForm: true,
      requestId,
    }, { status: 500 });
  }
}

// Allow CORS for development testing
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}