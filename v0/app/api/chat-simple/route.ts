import { NextResponse } from 'next/server';

// Ultra-simple chat endpoint for diagnostics
export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Chat endpoint is reachable',
      receivedMessages: body.messages?.length || 0,
      environment: process.env.NODE_ENV,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'chat-simple',
    timestamp: new Date().toISOString()
  });
}
