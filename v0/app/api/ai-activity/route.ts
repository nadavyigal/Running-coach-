import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { logger } from "@/lib/logger"

const activitySchema = z.object({
  type: z.string().optional(),
  distance: z.number().positive(),
  durationMinutes: z.number().positive(),
  paceSeconds: z.number().optional(),
  calories: z.number().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5

const getClientId = (req: Request) =>
  req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous"

const parsePaceToSeconds = (pace: unknown) => {
  if (typeof pace === "number" && Number.isFinite(pace)) return pace
  if (typeof pace === "string") {
    if (pace.includes(":")) {
      const [minutes, seconds] = pace.split(":").map((part) => Number.parseInt(part, 10))
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds
    }

    const numericPace = Number.parseFloat(pace)
    if (Number.isFinite(numericPace)) return Math.round(numericPace * 60)
  }

  return undefined
}

const sanitizeJson = (text: string) => {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    logger.error("Failed to parse AI response", error)
    return null
  }
}

const normalizeActivity = (raw: any) => {
  const distanceKm = raw?.distance_km ?? raw?.distance ?? raw?.km
  const durationMinutes =
    raw?.duration_minutes ?? raw?.duration ?? raw?.time_minutes ?? raw?.minutes ?? raw?.duration_min

  const miles = raw?.miles ?? raw?.distance_miles
  const distance = Number.parseFloat(distanceKm ?? (miles ? miles * 1.60934 : undefined))
  const duration = Number.parseFloat(durationMinutes)

  const paceSeconds = parsePaceToSeconds(raw?.pace_seconds ?? raw?.pace ?? raw?.pace_min_per_km)
  const confidence =
    typeof raw?.confidence === "number"
      ? raw.confidence
      : typeof raw?.confidence_score === "number"
        ? raw.confidence_score
        : undefined

  return activitySchema.parse({
    type: raw?.type || raw?.activity_type || "run",
    distance,
    durationMinutes: duration,
    paceSeconds,
    calories: raw?.calories ? Number.parseFloat(raw.calories) : undefined,
    notes: raw?.notes,
    date: raw?.date_iso || raw?.date || raw?.timestamp || raw?.datetime,
    confidence,
  })
}

const checkRateLimit = (clientId: string) => {
  const now = Date.now()
  const entry = rateLimit.get(clientId)

  if (!entry || now > entry.resetAt) {
    rateLimit.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  rateLimit.set(clientId, { ...entry, count: entry.count + 1 })
  return true
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    const clientId = getClientId(req)
    if (!checkRateLimit(clientId)) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again soon." }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Please upload images under 8MB." }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Image = buffer.toString("base64")
    const imageUrl = `data:${file.type};base64,${base64Image}`

    const prompt = `Extract running activity details from the provided image. Respond ONLY with JSON in this shape:
    {
      "type": "run|walk|bike|other",
      "distance_km": number,
      "duration_minutes": number,
      "pace_min_per_km": "m:ss" | number,
      "calories": number,
      "notes": string,
      "date_iso": ISO8601 string,
      "confidence": number between 0 and 1
    }`

    const result = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: imageUrl },
          ],
        },
      ],
      apiKey,
      maxTokens: 400,
    })

    const parsedJson = sanitizeJson(result.text())

    if (!parsedJson) {
      return NextResponse.json({ error: "Unable to parse activity details from the image" }, { status: 422 })
    }

    const normalized = normalizeActivity(parsedJson)

    const responsePayload = {
      activity: {
        type: normalized.type || "run",
        distance: normalized.distance,
        durationMinutes: normalized.durationMinutes,
        paceSeconds: normalized.paceSeconds,
        calories: normalized.calories,
        notes: normalized.notes,
        date: normalized.date || new Date().toISOString(),
      },
      confidence: normalized.confidence ?? 0.6,
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    logger.error("AI activity extraction failed", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid activity data returned from AI" }, { status: 422 })
    }
    return NextResponse.json({ error: "Failed to analyze activity" }, { status: 500 })
  }
}
