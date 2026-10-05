import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { captureServerEvent } from "@/lib/server/posthog"
import { checkVoiceCueThrottle } from "@/lib/server/voice-cue-throttle"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Dedicated key for the voice coach so its spend is ring-fenced from the rest
// of RunSmart's OpenAI usage. Falls back to OPENAI_API_KEY when unset, so the
// route keeps working before the dedicated key is provisioned.
const VOICE_OPENAI_KEY = process.env.OPENAI_VOICE_KEY || process.env.OPENAI_API_KEY || ""
const voiceOpenAI = createOpenAI({ apiKey: VOICE_OPENAI_KEY })

// Rough per-cue cost in USD. TTS (tts-1, ~$15/1M chars) dominates; the
// gpt-4o-mini text call is ~$0.00005. Logged for spend visibility in PostHog.
function estimateCueCostUsd(cueText: string): number {
  const ttsUsd = (cueText.length / 1_000_000) * 15
  const textUsd = 0.00005
  return Number((ttsUsd + textUsd).toFixed(6))
}

interface VoiceCueRequest {
  elapsedMinutes: number
  distanceKm: number
  currentPaceMinPerKm: number
  targetPaceMinPerKm?: number
  workoutGoal?: string
  heartRateBPM?: number
  userId?: string
}

function throttleKey(request: Request, body: VoiceCueRequest): string {
  if (body.userId && body.userId.trim()) return `user:${body.userId.trim()}`
  const fwd = request.headers.get("x-forwarded-for") ?? ""
  const ip = fwd.split(",")[0]?.trim()
  return ip ? `ip:${ip}` : "anonymous"
}

const COACH_SYSTEM_PROMPT = `You are RunSmart, a calm encouraging running coach.
Give one short coaching cue (1–2 sentences, max 25 words).
Be specific to the data provided. Never open with "Great job".
Never advise running through pain — if the runner mentions pain, say stop and consult a professional.
Sound like a real coach, not a chatbot.`

export async function POST(request: Request): Promise<Response> {
  if (process.env.VOICE_COACH_ENABLED !== "true") {
    return NextResponse.json({ error: "Voice coach is not enabled" }, { status: 503 })
  }

  let body: VoiceCueRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const key = throttleKey(request, body)
  const throttle = checkVoiceCueThrottle(key)
  if (!throttle.allowed) {
    await captureServerEvent("voice_cue_throttled", {
      userId: body.userId,
      reason: throttle.reason,
    })
    return NextResponse.json(
      { error: "Too many voice cues. Slow down.", reason: throttle.reason },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds ?? 60) } }
    )
  }

  const { elapsedMinutes, distanceKm, currentPaceMinPerKm, targetPaceMinPerKm, workoutGoal, heartRateBPM } = body

  const userContext = [
    `Elapsed: ${elapsedMinutes.toFixed(1)} min`,
    `Distance: ${distanceKm.toFixed(2)} km`,
    `Current pace: ${currentPaceMinPerKm.toFixed(1)} min/km`,
    targetPaceMinPerKm ? `Target pace: ${targetPaceMinPerKm.toFixed(1)} min/km` : null,
    workoutGoal ? `Goal: ${workoutGoal}` : null,
    heartRateBPM ? `Heart rate: ${heartRateBPM} bpm` : null,
  ]
    .filter(Boolean)
    .join(", ")

  let cueText: string
  try {
    const result = await generateText({
      model: voiceOpenAI("gpt-4o-mini"),
      system: COACH_SYSTEM_PROMPT,
      prompt: userContext,
      maxTokens: 60,
    })
    cueText = result.text.trim()
  } catch {
    return NextResponse.json({ error: "Text generation failed" }, { status: 500 })
  }

  const apiKey = VOICE_OPENAI_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI key not configured" }, { status: 500 })
  }

  let audioBuffer: ArrayBuffer
  try {
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: cueText,
        voice: "nova",
        response_format: "aac",
        speed: 0.95,
      }),
    })
    if (!ttsResponse.ok) {
      return NextResponse.json({ error: "TTS generation failed" }, { status: 500 })
    }
    audioBuffer = await ttsResponse.arrayBuffer()
  } catch {
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 })
  }

  await captureServerEvent("voice_cue_served", {
    userId: body.userId,
    estimatedCostUsd: estimateCueCostUsd(cueText),
    cueChars: cueText.length,
  })

  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/aac",
      "X-Coach-Text": encodeURIComponent(cueText),
      "Cache-Control": "no-store",
    },
  })
}
