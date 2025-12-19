import { NextResponse } from "next/server"
import { generateObject, generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { preprocessActivityImage } from "@/lib/server/activityImagePreprocess"
import {
  parseActivityFromText,
  parseDurationStringToSeconds,
  parseLocaleNumber,
  parsePaceToSecondsPerKm,
} from "@/lib/activityParsing"

const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

const PARSER_VERSION = "v2"
const PRIMARY_MODEL = process.env.AI_ACTIVITY_MODEL || "gpt-4o"
const OCR_FALLBACK_MODEL = process.env.AI_ACTIVITY_OCR_MODEL || "gpt-4o-mini"

type ExtractionMethod = "vision_structured" | "vision_text_fallback"

const activitySchema = z.object({
  type: z.string().optional(),
  distance: z.number().positive(),
  durationMinutes: z.number().positive(),
  paceSeconds: z.number().optional(),
  calories: z.number().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
})

const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5

const getClientId = (req: Request) =>
  req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous"

const checkRateLimit = (clientId: string) => {
  const now = Date.now()
  const entry = rateLimit.get(clientId)

  if (!entry || now > entry.resetAt) {
    rateLimit.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false

  rateLimit.set(clientId, { ...entry, count: entry.count + 1 })
  return true
}

const normalizeConfidencePct = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  if (value <= 1) return Math.round(value * 100)
  return Math.max(0, Math.min(100, Math.round(value)))
}

const normalizeStructured = (raw: any, exifDateIso?: string) => {
  const distanceKmValue =
    (typeof raw?.distance_km === "number" ? raw.distance_km : parseLocaleNumber(raw?.distance_km)) ??
    (typeof raw?.distanceKm === "number" ? raw.distanceKm : parseLocaleNumber(raw?.distanceKm))
  const milesValue =
    (typeof raw?.distance_miles === "number" ? raw.distance_miles : parseLocaleNumber(raw?.distance_miles)) ??
    (typeof raw?.distanceMiles === "number" ? raw.distanceMiles : parseLocaleNumber(raw?.distanceMiles))

  const distanceKm =
    typeof distanceKmValue === "number" ? distanceKmValue : typeof milesValue === "number" ? milesValue * 1.60934 : undefined

  const durationSeconds =
    (typeof raw?.duration_seconds === "number" ? raw.duration_seconds : parseLocaleNumber(raw?.duration_seconds)) ??
    (typeof raw?.durationSeconds === "number" ? raw.durationSeconds : parseLocaleNumber(raw?.durationSeconds)) ??
    (typeof raw?.duration_minutes === "number" ? raw.duration_minutes * 60 : undefined) ??
    (typeof raw?.durationMinutes === "number" ? raw.durationMinutes * 60 : undefined) ??
    (typeof raw?.duration_text === "string" ? parseDurationStringToSeconds(raw.duration_text) : undefined)

  const paceSeconds =
    (typeof raw?.pace_seconds_per_km === "number" ? raw.pace_seconds_per_km : parseLocaleNumber(raw?.pace_seconds_per_km)) ??
    (typeof raw?.paceSecondsPerKm === "number" ? raw.paceSecondsPerKm : parseLocaleNumber(raw?.paceSecondsPerKm)) ??
    (typeof raw?.pace_text === "string" ? parsePaceToSecondsPerKm(raw.pace_text) : undefined)

  const calories =
    (typeof raw?.calories === "number" ? raw.calories : parseLocaleNumber(raw?.calories)) ??
    (typeof raw?.kcal === "number" ? raw.kcal : parseLocaleNumber(raw?.kcal))

  const dateIso =
    (typeof raw?.date_iso === "string" ? raw.date_iso : undefined) ||
    (typeof raw?.completedAtIso === "string" ? raw.completedAtIso : undefined) ||
    exifDateIso

  const confidence =
    normalizeConfidencePct(raw?.confidence_pct) ??
    normalizeConfidencePct(raw?.confidence) ??
    normalizeConfidencePct(raw?.confidencePct)

  return {
    type: typeof raw?.type === "string" ? raw.type : "run",
    distanceKm,
    durationSeconds,
    paceSecondsPerKm: typeof paceSeconds === "number" ? paceSeconds : undefined,
    calories: typeof calories === "number" ? calories : undefined,
    notes: typeof raw?.notes === "string" ? raw.notes : undefined,
    completedAtIso: dateIso,
    confidencePct: confidence ?? 50,
  }
}

const validateAndNormalizeExtracted = (extracted: {
  distanceKm: number
  durationSeconds: number
  paceSecondsPerKm?: number
  calories?: number
  confidencePct: number
}) => {
  const warnings: string[] = []
  let { paceSecondsPerKm } = extracted
  let confidencePct = extracted.confidencePct

  if (extracted.distanceKm < 0.2 || extracted.distanceKm > 200) {
    warnings.push("distance_out_of_range")
    confidencePct = Math.min(confidencePct, 45)
  }

  if (extracted.durationSeconds < 60 || extracted.durationSeconds > 24 * 3600) {
    warnings.push("duration_out_of_range")
    confidencePct = Math.min(confidencePct, 45)
  }

  const derivedPace = extracted.durationSeconds / extracted.distanceKm
  if (Number.isFinite(derivedPace) && (derivedPace < 120 || derivedPace > 1200)) {
    warnings.push("derived_pace_out_of_range")
    confidencePct = Math.min(confidencePct, 50)
  }

  if (typeof paceSecondsPerKm === "number") {
    if (paceSecondsPerKm < 120 || paceSecondsPerKm > 1200) {
      warnings.push("pace_out_of_range")
      paceSecondsPerKm = undefined
      confidencePct = Math.min(confidencePct, 55)
    } else {
      const delta = Math.abs(paceSecondsPerKm - derivedPace) / derivedPace
      if (Number.isFinite(delta) && delta > 0.2) {
        warnings.push("pace_inconsistent")
        paceSecondsPerKm = undefined
        confidencePct = Math.min(confidencePct, 60)
      }
    }
  }

  return { paceSecondsPerKm, confidencePct, warnings }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured", errorCode: "missing_api_key", requestId },
        { status: 500 },
      )
    }

    const clientId = getClientId(req)
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again soon.", errorCode: "rate_limited", requestId },
        { status: 429 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required", errorCode: "missing_file", requestId }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload a JPG, PNG, or WebP image.",
          errorCode: "unsupported_type",
          requestId,
        },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Please upload images under 6MB.", errorCode: "too_large", requestId },
        { status: 413 },
      )
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer())
    const preprocessed = await preprocessActivityImage(originalBuffer, file.type)

    const structuredSchema = {
      type: "object",
      properties: {
        type: { type: "string" },
        distance_km: { type: "number" },
        distance_miles: { type: "number" },
        duration_seconds: { type: "number" },
        duration_minutes: { type: "number" },
        duration_text: { type: "string" },
        pace_seconds_per_km: { type: "number" },
        pace_text: { type: "string" },
        calories: { type: "number" },
        notes: { type: "string" },
        date_iso: { type: "string" },
        confidence_pct: { type: "number" },
      },
      required: [],
      additionalProperties: false,
    } as const

    const prompt = `You are extracting a running activity from a fitness screenshot/photo.
Return ONLY the fields you are confident about. Prefer totals (total distance, total time, average pace).

Rules:
- If distance is shown in km, put it in distance_km. If miles, use distance_miles.
- Duration should be total elapsed/moving time in duration_seconds. If only a text duration exists, use duration_text.
- If average pace is shown, output pace_seconds_per_km or pace_text.
- If a date is visible, output date_iso as ISO-8601. If no date is visible but EXIF exists, you may use it.
- confidence_pct must be 0..100 (percentage).

EXIF date hint (optional): ${preprocessed.exifDateIso ?? "none"}`

    let method: ExtractionMethod = "vision_structured"
    let structuredRaw: any | null = null

    try {
      const structured = await generateObject({
        model: openai(PRIMARY_MODEL),
        schema: structuredSchema,
        prompt,
        input: [
          {
            type: "input_image",
            image: preprocessed.buffer,
            mimeType: preprocessed.mimeType,
          },
        ],
      })
      structuredRaw = structured.object
    } catch (error) {
      logger.warn("Structured vision extraction failed", { requestId, error })
    }

    let extracted = structuredRaw ? normalizeStructured(structuredRaw, preprocessed.exifDateIso) : null
    const hasMinimum = extracted?.distanceKm && extracted?.durationSeconds

    let ocrText: string | undefined
    if (!hasMinimum) {
      method = "vision_text_fallback"
      const imageUrl = `data:${preprocessed.mimeType};base64,${preprocessed.buffer.toString("base64")}`
      const ocrPrompt =
        "Transcribe all text visible in the image. Preserve line breaks. Do not infer missing values. Return plain text only."

      const ocrResult = await generateText({
        model: openai(OCR_FALLBACK_MODEL),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ocrPrompt },
              { type: "image", image: imageUrl },
            ],
          },
        ],
        maxOutputTokens: 800,
      })

      ocrText = ocrResult.text
      const parsedFromText = parseActivityFromText(ocrText)
      extracted = {
        type: extracted?.type || "run",
        distanceKm: parsedFromText.distanceKm ?? extracted?.distanceKm,
        durationSeconds: parsedFromText.durationSeconds ?? extracted?.durationSeconds,
        paceSecondsPerKm: parsedFromText.paceSecondsPerKm ?? extracted?.paceSecondsPerKm,
        calories: parsedFromText.calories ?? extracted?.calories,
        notes: extracted?.notes,
        completedAtIso: extracted?.completedAtIso ?? preprocessed.exifDateIso,
        confidencePct: Math.min(extracted?.confidencePct ?? 40, 55),
      }
    }

    if (!extracted?.distanceKm || !extracted?.durationSeconds) {
      return NextResponse.json(
        {
          error: "Unable to extract distance and duration from the image. Please crop/zoom and try again, or enter manually.",
          errorCode: "ai_unparseable",
          requestId,
          meta: {
            parserVersion: PARSER_VERSION,
            model: PRIMARY_MODEL,
            method,
            preprocessing: preprocessed.steps,
          },
        },
        { status: 422 },
      )
    }

    const { paceSecondsPerKm, confidencePct, warnings } = validateAndNormalizeExtracted({
      distanceKm: extracted.distanceKm,
      durationSeconds: extracted.durationSeconds,
      paceSecondsPerKm: extracted.paceSecondsPerKm,
      calories: extracted.calories,
      confidencePct: extracted.confidencePct,
    })

    const normalized = activitySchema.parse({
      type: extracted.type,
      distance: extracted.distanceKm,
      durationMinutes: extracted.durationSeconds / 60,
      paceSeconds: paceSecondsPerKm,
      calories: extracted.calories,
      notes: extracted.notes,
      date: extracted.completedAtIso,
      confidence: confidencePct,
    })

    return NextResponse.json({
      activity: {
        type: normalized.type || "run",
        distance: normalized.distance,
        durationMinutes: normalized.durationMinutes,
        durationSeconds: Math.round(normalized.durationMinutes * 60),
        paceSeconds: normalized.paceSeconds,
        calories: normalized.calories,
        notes: normalized.notes,
        date: normalized.date || new Date().toISOString(),
      },
      confidence: normalized.confidence ?? 60,
      requestId,
      meta: {
        parserVersion: PARSER_VERSION,
        model: PRIMARY_MODEL,
        method,
        preprocessing: preprocessed.steps,
        exifDateIso: preprocessed.exifDateIso,
        warnings,
        ...(process.env.AI_ACTIVITY_INCLUDE_OCR_TEXT === "true" ? { ocrText } : {}),
      },
    })
  } catch (error) {
    logger.error("AI activity extraction failed", { requestId, error })
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid activity data returned from AI", errorCode: "ai_invalid_data", requestId },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: "Failed to analyze activity", errorCode: "unknown", requestId }, { status: 500 })
  }
}
