import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface VoiceCueRequest {
  elapsedMinutes: number
  distanceKm: number
  currentPaceMinPerKm: number
  targetPaceMinPerKm?: number
  workoutGoal?: string
  heartRateBPM?: number
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
      model: openai("gpt-4o-mini"),
      system: COACH_SYSTEM_PROMPT,
      prompt: userContext,
      maxTokens: 60,
    })
    cueText = result.text.trim()
  } catch {
    return NextResponse.json({ error: "Text generation failed" }, { status: 500 })
  }

  const apiKey = process.env.OPENAI_API_KEY
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

  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/aac",
      "X-Coach-Text": encodeURIComponent(cueText),
      "Cache-Control": "no-store",
    },
  })
}
