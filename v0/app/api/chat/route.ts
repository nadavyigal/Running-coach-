import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simplified chat endpoint - rebuilt for Next.js 16 compatibility
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, userId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Stream the response
    const result = streamText({
      model: openai('gpt-4o'),
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      system: `You are an AI running coach. Provide helpful, motivating advice about running, training plans, injury prevention, and general fitness. Be encouraging and supportive.`,
      maxTokens: 500,
    });

    // Return streaming response
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}

// Chat history endpoint
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const conversationId = url.searchParams.get('conversationId') || 'default';

    // For now, return empty history
    // TODO: Implement actual chat history storage
    return NextResponse.json({
      messages: [],
      conversationId,
      user: userId ? { id: parseInt(userId) } : null
    });

  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 }
    );
  }
}
