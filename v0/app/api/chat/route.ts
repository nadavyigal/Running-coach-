import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextResponse } from "next/server"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple system prompt for running coach
const SYSTEM_PROMPT = `You are an expert AI endurance running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative.`;

export async function POST(req: Request): Promise<Response> {
  console.log('💬 Chat API: POST request received');

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

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    },
  });
}
