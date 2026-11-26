import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { rateLimiter, securityConfig } from "@/lib/security.config"
import { securityMonitor } from "@/lib/security.monitoring"
import { captureAIGeneration } from "@/lib/ai-observability"
import { requireApiUser } from "@/lib/api-auth"
import { providerOptionsFor, selectModel } from "@/lib/ai/models"
import { WEB_CHAT_SYSTEM_PROMPT } from "@/lib/ai/coach-chat-core"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// OPENAI_MODEL (older shared override) keeps priority over OPENAI_MODEL_WRITER.
const CHAT_MODEL = selectModel("WRITER", { overrideEnv: ["OPENAI_MODEL"] })
const OPENAI_MODEL = CHAT_MODEL.model

// Shared safety core plus web extras; see lib/ai/coach-chat-core.ts.
const SYSTEM_PROMPT = WEB_CHAT_SYSTEM_PROMPT

interface ChatInputMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatRequestBody {
  messages?: Array<{ role?: unknown; content?: unknown }>
  userContext?: unknown
  userId?: unknown
}

function getClientIP(request: Request): string {
  const headers = request.headers
  const forwardedFor = headers.get("x-forwarded-for")
  const realIP = headers.get("x-real-ip")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  if (realIP) return realIP
  return "127.0.0.1"
}

function parseUserId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function toChatMessage(input: { role?: unknown; content?: unknown }): ChatInputMessage {
  const role =
    input.role === "assistant" || input.role === "system" || input.role === "user" ? input.role : "user"
  return {
    role,
    content: String(input.content ?? ""),
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiUser(req)
  if (auth.response) return auth.response
  const requestId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "OpenAI API key not configured", fallback: true }, { status: 503 })
  }

  const clientIP = getClientIP(req)
  const rateLimitConfig = { ...securityConfig.rateLimit, ...securityConfig.apiSecurity.chatRateLimit }
  const rateLimitResult = await rateLimiter.check(clientIP, rateLimitConfig)

  if (!rateLimitResult.success) {
    securityMonitor.trackSecurityEvent({
      type: "rate_limit_exceeded",
      severity: "warning",
      message: "Chat API rate limit exceeded",
      data: { ip: clientIP, limit: rateLimitResult.limit },
    })

    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
        },
      }
    )
  }

  try {
    const body = (await req.json()) as ChatRequestBody
    const rawMessages = Array.isArray(body.messages) ? body.messages : null
    if (!rawMessages) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    const messages = rawMessages.map((message) => toChatMessage(message))
    const userContext = typeof body.userContext === "string" ? body.userContext.trim() : ""
    // Client-sent, so it only labels analytics. Never load stored data with it.
    const parsedUserId = parseUserId(body.userId)

    const systemSections = [SYSTEM_PROMPT]
    if (userContext) {
      systemSections.push(`CONTEXT FROM USER APP:\n${userContext}`)
    }

    const apiMessages = [
      { role: "system" as const, content: systemSections.join("\n\n") },
      ...messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    ]

    const result = streamText({
      model: openai(OPENAI_MODEL),
      providerOptions: providerOptionsFor(CHAT_MODEL),
      messages: apiMessages,
      maxOutputTokens: 500,
      temperature: 0.7,
    })

    const textStream = result.textStream
    const transformed = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let output = ""
        try {
          for await (const text of textStream) {
            if (!text) continue
            output += text
            const chunk = `0:${JSON.stringify({ textDelta: text })}\n`
            controller.enqueue(encoder.encode(chunk))
          }
          const usage = await Promise.resolve((result as any).usage).catch(() => undefined)
          await captureAIGeneration({
            traceName: "chat",
            distinctId: parsedUserId,
            model: OPENAI_MODEL,
            input: apiMessages,
            output,
            usage,
            latencyMs: Date.now() - startedAt,
            properties: {
              request_id: requestId,
              streaming: true,
            },
          })
          controller.close()
        } catch (streamError) {
          logger.error("Chat stream error:", streamError)
          await captureAIGeneration({
            traceName: "chat",
            distinctId: parsedUserId,
            model: OPENAI_MODEL,
            input: apiMessages,
            output,
            latencyMs: Date.now() - startedAt,
            error: streamError,
            properties: {
              request_id: requestId,
              streaming: true,
            },
          })
          const errorChunk = `0:${JSON.stringify({ textDelta: "\n\n[Error: Failed to complete response.]" })}\n`
          controller.enqueue(encoder.encode(errorChunk))
          controller.close()
        }
      },
    })

    return new Response(transformed, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      },
    })
  } catch (error) {
    logger.error("Chat API error:", error)
    return NextResponse.json(
      {
        error: "An error occurred processing your request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const userId = url.searchParams.get("userId")

  logger.log("Chat API GET for userId:", userId)

  return NextResponse.json({
    messages: [],
    conversationId: "default",
  })
}

export async function OPTIONS(req: Request): Promise<Response> {
  const allowedOrigins = securityConfig.apiSecurity.cors.origin
  const requestOrigin = req.headers.get("origin") || ""
  const isAllowed =
    allowedOrigins.includes(requestOrigin) ||
    (process.env.NODE_ENV === "development" && requestOrigin.startsWith("http://localhost"))

  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": isAllowed ? requestOrigin : "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  })
}
