import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    console.log('OpenAI API Key exists:', !!apiKey);
    console.log('OpenAI API Key prefix:', apiKey?.substring(0, 8));
    console.log('OpenAI API Key length:', apiKey?.length);

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return NextResponse.json({
        error: 'API key not configured correctly',
        hasKey: !!apiKey,
        prefix: apiKey?.substring(0, 8) || 'none'
      }, { status: 500 });
    }

    // Try a simple generation
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Say "Hello, API test successful!" in exactly those words.',
      maxOutputTokens: 50,
    });

    return NextResponse.json({
      success: true,
      message: result.text,
      usage: result.usage,
      apiKeyPrefix: apiKey.substring(0, 8)
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
