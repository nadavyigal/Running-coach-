import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type Workout } from './db'
import { dbUtils } from './dbUtils'
import { recordRunWithSideEffects } from './run-recording'

vi.mock('./featureFlags', () => ({
  ENABLE_COMPLETION_LOOP: true,
  ENABLE_WEEKLY_RECAP: false,
  ENABLE_AUTO_PAUSE: false,
  ENABLE_PACE_CHART: false,
  ENABLE_ENHANCED_SHARING: false,
  ENABLE_VIBRATION_COACH: false,
}))

global.indexedDB = new FDBFactory()

function getWeekdayKey(date: Date): Workout['day'] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] as Workout['day']
}

function resolveRunTypeForWorkout(type: string | undefined) {
  switch (type) {
    case 'easy':
    case 'tempo':
    case 'intervals':
    case 'long':
    case 'hill':
    case 'time-trial':
      return type
    case 'race-pace':
      return 'tempo'
    case 'recovery':
      return 'easy'
    case 'fartlek':
      return 'intervals'
    default:
      return 'other'
  }
}

function buildAdaptedPlanResponse(today: Workout['day']) {
  return {
    plan: {
      title: 'Adjusted Running Plan',
      description: 'Adapted after recent performance',
      totalWeeks: 2,
      workouts: [
        {
          week: 1,
          day: today,
          type: 'easy',
          distance: 4,
          duration: 28,
          notes: 'Recovery-focused reset session',
        },
        {
          week: 1,
          day: 'Sat',
          type: 'long',
          distance: 7,
          duration: 50,
          notes: 'Keep the long run conversational',
        },
      ],
    },
    source: 'ai',
    requestId: 'test-plan',
  }
}

describe('activation loop', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    vi.clearAllMocks()
  })

  it('covers onboarding completion, starter plan visibility, run save, and adaptive update', async () => {
    const today = getWeekdayKey(new Date())
    const runSavedEvents: Array<Record<string, unknown>> = []
    const adaptedEvents: Array<Record<string, unknown>> = []

    const onRunSaved = (event: Event) => {
      runSavedEvents.push((event as CustomEvent).detail)
    }
    const onPlanAdapted = (event: Event) => {
      adaptedEvents.push((event as CustomEvent).detail)
    }

    window.addEventListener('run-saved', onRunSaved)
    window.addEventListener('plan-adapted', onPlanAdapted)

    vi.mocked(global.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.includes('/api/generate-plan')) {
        return new Response(JSON.stringify(buildAdaptedPlanResponse(today)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      throw new Error(`Unexpected fetch request: ${url}`)
    })

    const { userId, planId } = await dbUtils.completeOnboardingAtomic({
      goal: 'distance',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      planPreferences: {
        trainingDays: [today, 'Thu', 'Sat'],
        longRunDay: 'Sat',
      } as any,
    })

    const user = await dbUtils.getUser(userId)
    const starterPlan = await dbUtils.getActivePlan(userId)
    const starterWorkouts = await db.workouts.where('planId').equals(planId).toArray()
    const todaysWorkout = await dbUtils.getTodaysWorkout(userId)
    const nextWorkout = await dbUtils.getNextWorkoutForPlan(planId, new Date(Date.now() - 60 * 1000))

    expect(user?.onboardingComplete).toBe(true)
    expect(starterPlan?.id).toBe(planId)
    expect(starterWorkouts.length).toBeGreaterThan(0)
    expect(todaysWorkout).not.toBeNull()
    expect(todaysWorkout?.planId).toBe(planId)
    expect(nextWorkout).not.toBeNull()

    const runResult = await recordRunWithSideEffects({
      userId,
      distanceKm: todaysWorkout?.distance ?? 3,
      durationSeconds: ((todaysWorkout?.duration ?? 30) * 60) + 120,
      completedAt: new Date(),
      workoutId: todaysWorkout?.id,
      autoMatchWorkout: true,
      type: resolveRunTypeForWorkout(todaysWorkout?.type),
    })

    const savedRun = await db.runs.get(runResult.runId)
    const completedWorkout = todaysWorkout?.id ? await db.workouts.get(todaysWorkout.id) : null
    const adaptedPlan = await dbUtils.getActivePlan(userId)
    const originalPlan = await dbUtils.getPlan(planId)

    expect(savedRun).not.toBeNull()
    expect(completedWorkout?.completed).toBe(true)
    expect(runResult.adaptationTriggered).toBe(true)
    expect(runResult.adaptationReason).toBe('performance_below_target')
    expect(runResult.adaptationError).toBeUndefined()
    expect(adaptedPlan?.id).not.toBe(planId)
    expect(adaptedPlan?.title).toBe('Adjusted Running Plan')
    expect(originalPlan?.isActive).toBe(false)
    expect(runSavedEvents).toHaveLength(1)
    expect(runSavedEvents[0]?.runId).toBe(runResult.runId)
    expect(adaptedEvents).toHaveLength(1)
    expect(adaptedEvents[0]?.adaptedPlanId).toBe(adaptedPlan?.id)

    window.removeEventListener('run-saved', onRunSaved)
    window.removeEventListener('plan-adapted', onPlanAdapted)
  })

  it('keeps the saved run and completed workout when adaptive update fails', async () => {
    const today = getWeekdayKey(new Date())
    const failedEvents: Array<Record<string, unknown>> = []
    const onPlanAdaptationFailed = (event: Event) => {
      failedEvents.push((event as CustomEvent).detail)
    }

    window.addEventListener('plan-adaptation-failed', onPlanAdaptationFailed)

    vi.mocked(global.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.includes('/api/generate-plan')) {
        return new Response(JSON.stringify({ error: 'AI unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      throw new Error(`Unexpected fetch request: ${url}`)
    })

    const { userId, planId } = await dbUtils.completeOnboardingAtomic({
      goal: 'distance',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      planPreferences: {
        trainingDays: [today, 'Thu', 'Sat'],
        longRunDay: 'Sat',
      } as any,
    })

    const todaysWorkout = await dbUtils.getTodaysWorkout(userId)
    const runResult = await recordRunWithSideEffects({
      userId,
      distanceKm: todaysWorkout?.distance ?? 3,
      durationSeconds: ((todaysWorkout?.duration ?? 30) * 60) + 120,
      completedAt: new Date(),
      workoutId: todaysWorkout?.id,
      autoMatchWorkout: true,
      type: resolveRunTypeForWorkout(todaysWorkout?.type),
    })

    const savedRun = await db.runs.get(runResult.runId)
    const completedWorkout = todaysWorkout?.id ? await db.workouts.get(todaysWorkout.id) : null
    const activePlan = await dbUtils.getActivePlan(userId)

    expect(savedRun).not.toBeNull()
    expect(completedWorkout?.completed).toBe(true)
    expect(runResult.adaptationTriggered).toBe(false)
    expect(runResult.adaptationReason).toBe('performance_below_target')
    expect(runResult.adaptationError).toBe('Failed to generate adapted plan')
    expect(activePlan?.id).toBe(planId)
    expect(failedEvents).toHaveLength(1)
    expect(failedEvents[0]?.error).toBe('Failed to generate adapted plan')
    expect(failedEvents[0]?.runId).toBe(runResult.runId)

    window.removeEventListener('plan-adaptation-failed', onPlanAdaptationFailed)
  })
})
