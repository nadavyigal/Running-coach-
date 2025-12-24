import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import { logger } from '@/lib/logger'

const RunTypeSchema = z.enum(['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'other'])

const RunReportRequestSchema = z
  .object({
    run: z
      .object({
        id: z.number().int().positive().optional(),
        type: RunTypeSchema,
        distanceKm: z.number().positive(),
        durationSeconds: z.number().positive(),
        avgPaceSecondsPerKm: z.number().positive().optional(),
        completedAt: z.string().optional(),
      })
      .strict(),
    gps: z
      .object({
        points: z.number().int().nonnegative().optional(),
        startAccuracy: z.number().optional(),
        endAccuracy: z.number().optional(),
        averageAccuracy: z.number().optional(),
      })
      .optional(),
  })
  .strict()

const CoachNotesSchema = z
  .object({
    shortSummary: z.string().min(1),
    positives: z.array(z.string()).max(5),
    flags: z.array(z.string()).max(5),
    recoveryNext24h: z.string().min(1),
    suggestedNextWorkout: z.string().min(1),
  })
  .strict()

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--'
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function fallbackCoachNotes(input: z.infer<typeof RunReportRequestSchema>): z.infer<typeof CoachNotesSchema> {
  const distance = input.run.distanceKm
  const duration = input.run.durationSeconds
  const pace = input.run.avgPaceSecondsPerKm ?? duration / distance

  const positives: string[] = []
  const flags: string[] = []

  positives.push(`You got it done: ${distance.toFixed(2)}km in ${formatTime(duration)}.`)

  if (distance >= 7) positives.push('Solid aerobic volume for a weekday run.')
  else if (distance >= 3) positives.push('Nice consistency-building session.')
  else positives.push('Short runs still count—great for building the habit.')

  const avgAcc = input.gps?.averageAccuracy
  if (typeof avgAcc === 'number' && avgAcc > 80) {
    flags.push(`GPS accuracy was low (avg ±${Math.round(avgAcc)}m), so distance/route may be unreliable.`)
  }

  if (input.run.type === 'intervals' || input.run.type === 'tempo' || input.run.type === 'time-trial' || input.run.type === 'hill') {
    positives.push('Quality session logged—nice work staying intentional.')
  }

  let recoveryNext24h = 'Hydrate, get a normal carb + protein meal, and aim for a full night of sleep.'
  if (duration >= 60 * 60) recoveryNext24h = 'Hydrate, add some extra carbs today, and prioritize sleep; keep legs easy for 24h.'

  let suggestedNextWorkout = 'Easy 20–40 min or a rest day, depending on how you feel.'
  if (input.run.type === 'easy' || input.run.type === 'long') {
    suggestedNextWorkout = 'If you feel good: 30–45 min easy. If not: rest + light walk/mobility.'
  } else {
    suggestedNextWorkout = 'Next: 30–45 min easy (Zone 2 feel) to absorb the work.'
  }

  return {
    shortSummary: `Run logged: ${distance.toFixed(2)}km in ${formatTime(duration)} (${formatPace(pace)}/km).`,
    positives,
    flags,
    recoveryNext24h,
    suggestedNextWorkout,
  }
}

export async function POST(req: Request) {
  let rawBody: unknown = null
  try {
    rawBody = await req.json()
    const input = RunReportRequestSchema.parse(rawBody)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ report: fallbackCoachNotes(input), source: 'fallback' as const })
    }

    const { object } = await generateObject({
      model: openai(process.env.RUN_REPORT_MODEL || 'gpt-4o-mini'),
      schema: CoachNotesSchema,
      prompt: [
        {
          role: 'system',
          content:
            'You are Run-Smart, an evidence-based running coach. Produce concise, practical post-run notes. Avoid medical claims. If data is missing, make minimal assumptions.',
        },
        {
          role: 'user',
          content: `Create a post-run report for this run:\n\n${JSON.stringify(input, null, 2)}\n\nReturn JSON that matches the provided schema.`,
        },
      ],
    })

    return NextResponse.json({ report: object, source: 'ai' as const })
  } catch (error) {
    logger.error('[run-report] Failed to generate run report, falling back', error)
    const input = RunReportRequestSchema.safeParse(rawBody)
    if (input.success) {
      return NextResponse.json({ report: fallbackCoachNotes(input.data), source: 'fallback' as const })
    }
    return NextResponse.json({ error: 'Failed to generate run report' }, { status: 500 })
  }
}
