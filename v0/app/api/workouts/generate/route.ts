import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { sanitizeForPrompt, sanitizeDistance } from '@/lib/security'
import { withSecureOpenAI } from '@/lib/apiKeyManager'
import { withApiSecurity, validateAndSanitizeInput, type ApiRequest } from '@/lib/security.middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORKOUT_NAME_MAX = 80
const WORKOUT_DESC_MAX = 200
const MODEL_TIMEOUT_MS = 20000

const SYSTEM_PROMPT = `You are an expert running coach. Create a detailed workout breakdown.

Format your response as a JSON object with this structure:
{
  "title": "Workout Name",
  "description": "Brief description",
  "duration": "estimated time range",
  "phases": [
    {
      "phase": "Warm-up",
      "color": "bg-gray-500",
      "repeat": "optional repeat label",
      "steps": [
        {
          "step": 1,
          "description": "detailed instruction",
          "detail": "additional guidance (optional)",
          "type": "RUN"
        }
      ]
    }
  ]
}

Rules:
- Always include Warm-up, Main Set, and Cool Down phases.
- For interval-style workouts, add a Strides/Activation phase and use "repeat" on the Main Set with RUN/RECOVER steps.
- Keep steps concise and action-oriented with short cues in "detail".
- Return valid JSON only.`

function isValidDifficulty(value: string | undefined): value is 'open' | 'easy' | 'medium' {
  return value === 'open' || value === 'easy' || value === 'medium'
}

function isValidGoalType(value: string | undefined): value is 'distance' | 'duration' {
  return value === 'distance' || value === 'duration'
}

async function generateWorkoutHandler(req: ApiRequest) {
  const validation = await validateAndSanitizeInput(req, 500)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error || 'Invalid request' }, { status: 400 })
  }

  const body = validation.sanitized ?? (await req.json())
  const workout = body?.workout || {}
  const goalType = body?.goalType
  const targetValue = body?.targetValue
  const difficulty = body?.difficulty

  if (!workout || !isValidGoalType(goalType) || !isValidDifficulty(difficulty)) {
    return NextResponse.json({ error: 'Invalid workout request' }, { status: 400 })
  }

  const workoutName = sanitizeForPrompt(String(workout.name || ''), WORKOUT_NAME_MAX)
  const workoutDescription = sanitizeForPrompt(String(workout.description || ''), WORKOUT_DESC_MAX)
  const rawTargetValue = String(targetValue || '').trim()

  if (!workoutName || !rawTargetValue) {
    return NextResponse.json({ error: 'Workout name and target value are required' }, { status: 400 })
  }

  let cleanedTargetValue = ''
  if (goalType === 'distance') {
    const sanitizedDistance = sanitizeDistance(rawTargetValue)
    if (!sanitizedDistance) {
      return NextResponse.json({ error: 'Invalid target distance' }, { status: 400 })
    }
    cleanedTargetValue = sanitizedDistance
  } else {
    const durationValue = Number.parseFloat(rawTargetValue)
    if (!Number.isFinite(durationValue) || durationValue <= 0 || durationValue > 300) {
      return NextResponse.json({ error: 'Invalid target duration' }, { status: 400 })
    }
    cleanedTargetValue = durationValue.toString()
  }

  const goalLabel = goalType === 'distance' ? `${cleanedTargetValue} km` : `${cleanedTargetValue} minutes`
  const detailSuffix = workoutDescription ? ` The workout should be appropriate for: ${workoutDescription}.` : ''
  const prompt = `Create a ${workoutName} workout for ${goalLabel} at ${difficulty} difficulty level.${detailSuffix}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS)

  try {
    const result = await withSecureOpenAI(async () => {
      return generateText({
        model: openai('gpt-4o'),
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 700,
        temperature: 0.7,
        abortSignal: controller.signal,
      })
    })

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error?.message || 'AI service temporarily unavailable', fallback: true },
        { status: result.error?.status || 503 }
      )
    }

    const text = String((result.data as any).text || '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      return NextResponse.json(
        { error: 'AI response could not be parsed', fallback: true },
        { status: 502 }
      )
    }

    return NextResponse.json({ workout: parsed }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed'
    return NextResponse.json({ error: message, fallback: true }, { status: 503 })
  } finally {
    clearTimeout(timeoutId)
  }
}

const securedGenerateWorkoutHandler = withApiSecurity(generateWorkoutHandler)

export async function POST(req: ApiRequest) {
  return securedGenerateWorkoutHandler(req)
}
