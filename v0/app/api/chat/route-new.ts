import { NextResponse } from 'next/server';
import { chatDriver, ChatRequest } from '@/lib/chatDriver';
import { dbUtils } from '@/lib/dbUtils';

export async function POST(req: Request) {
  const requestId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  console.log(`[chat:api] requestId=${requestId} Starting chat request`);
  
  try {
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`[chat:api] requestId=${requestId} Invalid content type:`, contentType);
      return NextResponse.json({
        error: 'Content-Type must be application/json',
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
      console.error(`[chat:api] requestId=${requestId} JSON parsing error:`, parseError);
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        requestId,
      }, { status: 400 });
    }
    
    const { 
      messages, 
      userId, 
      streaming = true, 
      maxTokens = 1000,
      model = 'gpt-4o-mini' 
    } = body;
    
    console.log(`[chat:api] requestId=${requestId} Request data:`, {
      messagesCount: messages?.length || 0,
      userId,
      streaming,
      maxTokens,
      model
    });
    
    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error(`[chat:api] requestId=${requestId} Invalid messages:`, messages);
      return NextResponse.json({
        error: 'Messages array is required and cannot be empty',
        requestId,
      }, { status: 400 });
    }
    
    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        console.error(`[chat:api] requestId=${requestId} Invalid message format:`, msg);
        return NextResponse.json({
          error: 'Each message must have role and content fields',
          requestId,
        }, { status: 400 });
      }
      
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        console.error(`[chat:api] requestId=${requestId} Invalid message role:`, msg.role);
        return NextResponse.json({
          error: 'Message role must be user, assistant, or system',
          requestId,
        }, { status: 400 });
      }
    }
    
    // Get user ID from request or try to resolve current user
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const user = await dbUtils.getCurrentUser();
        resolvedUserId = user?.id;
      } catch (error) {
        console.warn(`[chat:api] requestId=${requestId} Could not resolve user:`, error);
      }
    }
    
    // Check chat service health
    const health = await chatDriver.health();
    if (!health.available) {
      console.error(`[chat:api] requestId=${requestId} Chat service unavailable:`, health.lastError);
      return NextResponse.json({
        error: 'AI chat is temporarily unavailable. Please try again later.',
        available: false,
        requestId,
      }, { status: 503 });
    }
    
    // Prepare chat request
    const baseRequest: ChatRequest = {
      messages,
      streaming,
      maxTokens,
      model,
    };
    const chatRequest: ChatRequest =
      typeof resolvedUserId === 'number'
        ? { ...baseRequest, userId: resolvedUserId }
        : baseRequest;
    
    console.log(`[chat:api] requestId=${requestId} Sending to ChatDriver, streaming=${streaming}`);
    
    // Use ChatDriver for the actual AI request
    const response = await chatDriver.ask(chatRequest);
    
    if (!response.success) {
      const error = response.error!;
      console.error(`[chat:api] requestId=${requestId} ChatDriver error:`, error);
      
      // Map ChatDriver errors to appropriate HTTP responses
      const statusCode = error.code || 500;
      const headers: Record<string, string> = {
        'X-Request-ID': requestId,
      };
      
      if (error.retryAfter) {
        headers['Retry-After'] = error.retryAfter.toString();
      }
      
      return NextResponse.json({
        success: false,
        error: error.message,
        type: error.type,
        requestId: error.requestId,
        retryAfter: error.retryAfter,
      }, { 
        status: statusCode,
        headers 
      });
    }
    
    if (streaming && response.stream) {
      console.log(`[chat:api] requestId=${requestId} ✅ Returning streaming response`);
      
      return new Response(response.stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Request-ID': requestId,
        },
      });
      
    } else if (response.data) {
      console.log(`[chat:api] requestId=${requestId} ✅ Returning non-streaming response`);
      
      // Non-streaming response with full metrics
      return NextResponse.json({
        success: true,
        response: response.data.response,
        tokensIn: response.data.tokensIn,
        tokensOut: response.data.tokensOut,
        duration: response.data.duration,
        model: response.data.model,
        requestId: response.data.requestId,
      }, {
        headers: {
          'X-Request-ID': requestId,
        }
      });
    }
    
    // Should not reach here
    throw new Error('Invalid response from ChatDriver');
    
  } catch (error) {
    console.error(`[chat:api] requestId=${requestId} Unexpected error:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred. Please try again.',
      requestId,
    }, { status: 500 });
  }
}

// Health check endpoint as GET
export async function GET() {
  const requestId = `chat_health_${Date.now()}`;
  
  try {
    console.log(`[chat:api] requestId=${requestId} Health check requested`);
    
    const health = await chatDriver.health();
    const metrics = chatDriver.getMetrics();
    
    return NextResponse.json({
      success: true,
      available: health.available,
      model: health.model,
      latency: health.latency,
      quota: health.quota,
      metrics,
      lastError: health.lastError,
      timestamp: new Date().toISOString(),
      requestId,
    }, {
      headers: {
        'X-Request-ID': requestId,
      }
    });
    
  } catch (error) {
    console.error(`[chat:api] requestId=${requestId} Health check error:`, error);
    
    return NextResponse.json({
      success: false,
      available: false,
      error: 'Health check failed',
      requestId,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Allow CORS for development testing
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
