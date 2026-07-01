import type { GarminFirstAhaResult, StarterDayType } from '@/lib/garminFirstAhaTypes'
import { createPlan, createWorkout, getActivePlan } from '@/lib/dbUtils'
import type { Workout } from '@/lib/db'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function mapStarterType(type: StarterDayType): Workout['type'] {
  if (type === 'long_run') return 'long'
  if (type === 'recovery') return 'recovery'
  if (type === 'rest') return 'rest'
  if (type === 'walk_run') return 'easy'
  return 'easy'
}

function parseDurationMinutes(target?: string): number | undefined {
  if (!target) return undefined
  const match = target.match(/(\d+)\s*-\s*(\d+)\s*min/i) ?? target.match(/(\d+)\s*min/i)
  if (!match) return undefined
  if (match[2]) return Number.parseInt(match[2], 10)
  return Number.parseInt(match[1], 10)
}

function weekNumberForDate(startDate: Date, sessionDate: Date): number {
  const diffMs = sessionDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return diffDays < 7 ? 1 : 2
}

export async function acceptGarminFirstAhaPlan(params: {
  userId: number
  result: GarminFirstAhaResult
  replaceExisting?: boolean
}): Promise<{ planId: number; replacedExisting: boolean }> {
  const existingPlan = await getActivePlan(params.userId)
  if (existingPlan?.id && !params.replaceExisting) {
    throw new Error('ACTIVE_PLAN_EXISTS')
  }

  const sessionDays = params.result.starterPlan.days.filter((day) => day.type !== 'rest')
  const startDate = params.result.starterPlan.days[0]
    ? new Date(`${params.result.starterPlan.days[0].date}T09:00:00.000Z`)
    : new Date()
  const endDate = params.result.starterPlan.days.at(-1)
    ? new Date(`${params.result.starterPlan.days.at(-1)!.date}T09:00:00.000Z`)
    : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)

  const planId = await createPlan({
    userId: params.userId,
    title: params.result.starterPlan.title,
    description: params.result.starterPlan.rationale,
    startDate,
    endDate,
    totalWeeks: 2,
    isActive: true,
    planType: 'basic',
    trainingDaysPerWeek: Math.max(2, Math.min(5, Math.round(sessionDays.length / 2))),
    fitnessLevel: 'beginner',
    difficulty: 'beginner',
    complexityLevel: 'basic',
    complexityScore: 20,
  })

  for (const day of params.result.starterPlan.days) {
    if (day.type === 'rest') continue
    const scheduledDate = new Date(`${day.date}T09:00:00.000Z`)
    const week = weekNumberForDate(startDate, scheduledDate)
    await createWorkout({
      planId,
      week,
      day: DAY_NAMES[scheduledDate.getUTCDay()],
      type: mapStarterType(day.type),
      distance: day.type === 'walk_run' ? 2 : day.type === 'long_run' ? 6 : 4,
      duration: parseDurationMinutes(day.target) ?? 30,
      intensity: day.intensity === 'hard' ? 'threshold' : day.intensity === 'moderate' ? 'moderate' : 'easy',
      notes: day.purpose,
      completed: false,
      scheduledDate,
    })
  }

  return { planId, replacedExisting: Boolean(existingPlan?.id) }
}

export async function startGarminFirstAhaChallenge(params: {
  userId: number
  challengeSlug: string
}): Promise<void> {
  const response = await fetch('/api/challenges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': String(params.userId),
    },
    credentials: 'include',
    body: JSON.stringify({
      userId: params.userId,
      slug: params.challengeSlug,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'Failed to join challenge')
  }
}
