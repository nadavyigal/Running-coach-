import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextRequest, NextResponse } from "next/server"
import { rateLimiter, securityConfig } from "@/lib/security.config"
import { securityMonitor } from "@/lib/security.monitoring"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple system prompt for running coach
const SYSTEM_PROMPT = `You are an expert AI endurance running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative.`;

// Get client IP for rate limiting
function getClientIP(request: Request): string {
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  if (realIP) return realIP;
  return '127.0.0.1';
}

export async function POST(req: Request): Promise<Response> {
  console.log('💬 Chat API: POST request received');

  // Rate limiting check (10 requests per minute for chat)
  const clientIP = getClientIP(req);
  const rateLimitResult = await rateLimiter.check(clientIP, securityConfig.apiSecurity.chatRateLimit);

  if (!rateLimitResult.success) {
    securityMonitor.trackSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'warning',
      message: 'Chat API rate limit exceeded',
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
    // Parse the request body
    const body = await req.json();
    console.log('📝 Request body received');

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      console.error('❌ Invalid messages format');
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    console.log(`📨 Processing ${messages.length} messages`);

    // Prepare messages with system prompt
    const apiMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content || '')
      }))
    ];

    console.log('🔄 Calling OpenAI streamText...');

    // Call streamText - this returns immediately with a stream
    const result = streamText({
      model: openai("gpt-4o"),
      messages: apiMessages,
      maxOutputTokens: 500,
      temperature: 0.7,
    });

    // Get the text stream
    const textStream = result.textStream;

    // Transform to the format the client expects
    const transformed = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const text of textStream) {
            if (text) {
              const chunk = `0:${JSON.stringify({ textDelta: text })}\n`;
              controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.close();
          console.log('✅ Stream completed successfully');
        } catch (streamError) {
          console.error('❌ Stream error:', streamError);
          const errorChunk = `0:${JSON.stringify({ textDelta: '\n\n[Error: Failed to complete response.]' })}\n`;
          controller.enqueue(encoder.encode(errorChunk));
          controller.close();
        }
      }
    });

    return new Response(transformed, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      }
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      {
        error: "An error occurred processing your request",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request): Promise<Response> {
  // Simple GET handler that returns empty history
  // The client-side handles local storage
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  console.log('💬 Chat API: GET request for userId:', userId);

  return NextResponse.json({
    messages: [],
    conversationId: 'default',
  });
}

export async function OPTIONS(req: Request): Promise<Response> {
  // Get allowed origins from config (localhost in dev, production domain in prod)
  const allowedOrigins = securityConfig.apiSecurity.cors.origin;
  const requestOrigin = req.headers.get('origin') || '';

  // Check if request origin is allowed
  const isAllowed = allowedOrigins.includes(requestOrigin) ||
    (process.env.NODE_ENV === 'development' && requestOrigin.startsWith('http://localhost'));

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? requestOrigin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
