import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ultra-simple chat endpoint to test if basic POST works
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages || [];

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      maxOutputTokens: 150,
    });

    return NextResponse.json({
      success: true,
      message: result.text
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'chat-test endpoint ready' });
}
