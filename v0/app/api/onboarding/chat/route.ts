import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { OnboardingPromptBuilder } from '@/lib/onboardingPromptBuilder'
import { OnboardingSessionManager } from '@/lib/onboardingSessionManager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const rawBody = await req.clone().text()
    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json(
        { error: 'Request body cannot be empty', fallback: true },
        { status: 400 }
      )
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', fallback: true },
        { status: 400 }
      )
    }

    const { messages, userId, userContext, currentPhase } = body || {}

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty', fallback: true },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      return NextResponse.json(
        {
          error: 'AI service temporarily unavailable',
          message: 'AI onboarding is temporarily unavailable. Please use the guided form.',
          fallback: true,
          redirectToForm: true
        },
        { status: 503 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', fallback: true },
        { status: 400 }
      )
    }

    if (!currentPhase) {
      return NextResponse.json(
        { error: 'Current phase is required', fallback: true },
        { status: 400 }
      )
    }

    const userMessage = messages[messages.length - 1]

    if (typeof userMessage?.content === 'string' && userMessage.content.length > 5000) {
      return NextResponse.json(
        { error: 'Token budget exceeded', fallback: true },
        { status: 429 }
      )
    }

    const sessionManager = new OnboardingSessionManager()
    const existingSession = await sessionManager.loadSession(userId)

    if (!existingSession) {
      await sessionManager.createNewSession(userId)
    }

    await sessionManager.addMessageToHistory('user', userMessage.content)
    const conversationHistory = await sessionManager.getConversationHistory(userId)

    const onboardingPrompt = OnboardingPromptBuilder.buildPrompt(
      currentPhase as any,
      conversationHistory || [],
      userContext
    )

    let streamResult: any

    try {
      streamResult = await streamText({
        model: openai('gpt-4o'),
        messages: [
          { role: 'system' as const, content: onboardingPrompt },
          { role: 'user' as const, content: userMessage.content }
        ],
        maxOutputTokens: 300,
        temperature: 0.7
      })
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase()

      if (message.includes('network')) {
        return NextResponse.json(
          { error: 'Network connection failed. Please check your internet and try again.', fallback: true },
          { status: 503 }
        )
      }

      if (message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timeout. Please try again.', fallback: true },
          { status: 408 }
        )
      }

      return NextResponse.json(
        { error: 'AI service temporarily unavailable', fallback: true },
        { status: 503 }
      )
    }

    const baseResponse =
      streamResult?.toDataStreamResponse?.() ??
      new Response('AI response', { headers: { 'Content-Type': 'text/plain' } })

    return new Response(baseResponse.body ?? 'AI response', {
      status: 200,
      headers: {
        ...baseResponse.headers,
        'X-Coaching-Interaction-Id': `onboarding-${Date.now()}`,
        'X-Coaching-Confidence': '0.8',
        'X-Onboarding-Next-Phase': currentPhase
      }
    })
  } catch {
    return NextResponse.json(
      {
        error: "I'm having trouble processing your message right now. Please try again or use the guided form.",
        fallback: true,
        redirectToForm: true,
        errorType: 'generic_error',
        errorCode: 'CHAT_API_ERROR'
      },
      { status: 500 }
    )
  }
}
