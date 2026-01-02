import { NextResponse } from 'next/server';
import { chatDriver, ChatRequest } from '@/lib/chatDriver';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const requestId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json', requestId },
        { status: 400 }
      );
    }

    const bodyText = await req.text();
    if (!bodyText.trim()) {
      return NextResponse.json(
        { error: 'Request body cannot be empty', requestId },
        { status: 400 }
      );
    }

    let body: {
      messages?: ChatRequest['messages'];
      userId?: number;
      streaming?: boolean;
      maxTokens?: number;
      maxOutputTokens?: number;
      model?: string;
    };

    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
    }

    const {
      messages,
      userId,
      streaming = true,
      maxTokens,
      maxOutputTokens,
      model,
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required', requestId },
        { status: 400 }
      );
    }

    const chatRequest: ChatRequest = {
      messages,
      streaming,
      ...(model ? { model } : {}),
      ...(typeof (maxOutputTokens ?? maxTokens) === 'number'
        ? { maxOutputTokens: maxOutputTokens ?? maxTokens }
        : {}),
      ...(typeof userId === 'number' ? { userId } : {}),
    };

    const response = await chatDriver.ask(chatRequest);
    if (!response.success) {
      const err = response.error;
      return NextResponse.json(
        {
          success: false,
          error: err?.message ?? 'Chat request failed',
          type: err?.type,
          requestId: err?.requestId ?? requestId,
        },
        { status: err?.code || 500 }
      );
    }

    if (streaming && response.stream) {
      return new Response(response.stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Request-ID': requestId,
        },
      });
    }

    return NextResponse.json(
      { success: true, ...response.data, requestId },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`[chat:api] requestId=${requestId} Unexpected error:`, error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.', requestId },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId')?.trim() || 'default';

  return NextResponse.json({ messages: [], conversationId }, { status: 200 });
}
