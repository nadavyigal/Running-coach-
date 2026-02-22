import { NextResponse } from "next/server"
import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"

import { buildInsightPrompts, type GarminInsightType } from "@/lib/garminInsightBuilder"
import { logger } from "@/lib/logger"
import {
  buildInsightSummaryForUser,
  fetchLatestInsight,
  type GenerateGarminInsightRequest,
} from "@/lib/server/garmin-insights-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"

function parseInsightType(value: unknown): GarminInsightType {
  if (value === "weekly" || value === "post_run" || value === "daily") return value
  return "daily"
}

function parseUserId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const userId = parseUserId(searchParams.get("userId"))
  if (!userId) {
    return NextResponse.json({ success: false, error: "Valid userId is required" }, { status: 400 })
  }

  const typeParam = searchParams.get("type")
  const insightType =
    typeParam === "daily" || typeParam === "weekly" || typeParam === "post_run"
      ? (typeParam as GarminInsightType)
      : undefined

  try {
    const latest = await fetchLatestInsight({
      userId,
      ...(insightType ? { type: insightType } : {}),
    })

    if (!latest) {
      return NextResponse.json({ success: true, insight: null })
    }

    return NextResponse.json({
      success: true,
      insight: {
        id: latest.id,
        type: latest.type,
        periodStart: latest.period_start,
        periodEnd: latest.period_end,
        text: latest.insight_markdown,
        confidence: latest.confidence,
        evidence: latest.evidence_json ?? {},
        createdAt: latest.created_at,
      },
    })
  } catch (error) {
    logger.error("Failed to fetch Garmin insight:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch Garmin insight" }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "OpenAI API key not configured", fallback: true }, { status: 503 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const userId = parseUserId(body.userId)
  if (!userId) {
    return NextResponse.json({ error: "Valid userId is required" }, { status: 400 })
  }

  const insightType = parseInsightType(body.insightType ?? body.type)
  const generationRequest: GenerateGarminInsightRequest = {
    userId,
    insightType,
    requestedAt: new Date().toISOString(),
    plannedWorkout: parseOptionalString(body.plannedWorkout),
    activityId: parseOptionalString(body.activityId),
    activityDate: parseOptionalString(body.activityDate),
  }

  try {
    const summary = await buildInsightSummaryForUser(generationRequest)
    if (!summary) {
      return NextResponse.json({ error: "Unable to build Garmin insight summary" }, { status: 424 })
    }

    const prompts = buildInsightPrompts(summary)
    const result = streamText({
      model: openai(OPENAI_MODEL),
      messages: [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      maxOutputTokens: 220,
      temperature: 0.35,
    })

    const streamResult = result as unknown as {
      toDataStreamResponse?: () => Response
      toTextStreamResponse: () => Response
    }
    const streamed =
      typeof streamResult.toDataStreamResponse === "function"
        ? streamResult.toDataStreamResponse()
        : streamResult.toTextStreamResponse()
    return new Response(streamed.body, {
      status: 200,
      headers: {
        ...Object.fromEntries(streamed.headers.entries()),
        "X-Insight-Type": summary.type,
        "X-Insight-Confidence": summary.confidence,
      },
    })
  } catch (error) {
    logger.error("Garmin insight generation failed:", error)
    return NextResponse.json(
      {
        error: "Failed to generate Garmin insight",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
