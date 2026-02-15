import { startChallenge } from './challengeEngine'
import { dbUtils } from './dbUtils'
import type { ChallengeTemplate, Goal, Run, User } from './db'

type ChallengeTemplateInput = Pick<
  ChallengeTemplate,
  | 'slug'
  | 'name'
  | 'category'
  | 'difficulty'
  | 'durationDays'
  | 'workoutPattern'
  | 'coachTone'
  | 'targetAudience'
  | 'promise'
>

export type ChallengePlanSyncResult = {
  planUpdated: boolean
  source: 'ai' | 'fallback' | 'none'
  error?: string
}

type StartChallengeAndSyncInput = {
  userId: number
  planId: number
  challenge: ChallengeTemplateInput
  startDate?: Date
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function formatPaceSecondsPerKm(paceSeconds?: number): string | undefined {
  if (typeof paceSeconds !== 'number' || !Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return undefined
  }
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.round(paceSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}/km`
}

function toIsoDate(value?: Date | string): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) {
    return value.toISOString()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function resolveAverageWeeklyKm(user: User, recentRuns: Run[]): number | undefined {
  if (typeof user.averageWeeklyKm === 'number' && user.averageWeeklyKm > 0) {
    return Math.round(user.averageWeeklyKm * 10) / 10
  }

  const now = Date.now()
  const recent28Days = recentRuns.filter((run) => {
    const completedAt = new Date(run.completedAt).getTime()
    return now - completedAt <= 28 * MS_PER_DAY
  })

  if (!recent28Days.length) return undefined
  const distanceKm = recent28Days.reduce((sum, run) => sum + (run.distance || 0), 0)
  return Math.round((distanceKm / 4) * 10) / 10
}

function buildConsistencyScore(user: User, recentRuns: Run[]): number | undefined {
  if (!recentRuns.length) return undefined
  const now = Date.now()
  const recent28Days = recentRuns.filter((run) => {
    const completedAt = new Date(run.completedAt).getTime()
    return now - completedAt <= 28 * MS_PER_DAY
  })
  if (!recent28Days.length) return undefined

  const targetSessions = Math.max(1, (user.daysPerWeek || 3) * 4)
  return Math.round(clamp01(recent28Days.length / targetSessions) * 100) / 100
}

function summarizeGoal(goal: Goal): {
  title: string
  goalType: Goal['goalType']
  category: Goal['category']
  deadline?: string
  priority?: Goal['priority']
  target?: string
  progressPercentage?: number
} {
  const targetValue = goal.specificTarget?.value
  const targetUnit = goal.specificTarget?.unit
  const targetMetric = goal.specificTarget?.metric
  const composedTarget =
    typeof targetValue === 'number' || typeof targetValue === 'string'
      ? `${targetValue}${targetUnit ? ` ${targetUnit}` : ''}${targetMetric ? ` (${targetMetric})` : ''}`
      : undefined

  return {
    title: goal.title,
    goalType: goal.goalType,
    category: goal.category,
    deadline: toIsoDate(goal.timeBound?.deadline),
    priority: goal.priority,
    target: composedTarget,
    progressPercentage:
      typeof goal.progressPercentage === 'number' ? Math.round(goal.progressPercentage) : undefined,
  }
}

async function buildChallengePlanRequestBody(
  userId: number,
  challenge: ChallengeTemplateInput
): Promise<Record<string, unknown> | null> {
  const [user, primaryGoal, activeGoals, recentRuns] = await Promise.all([
    dbUtils.getUserById(userId),
    dbUtils.getPrimaryGoal(userId),
    dbUtils.getUserGoals(userId, 'active'),
    dbUtils.getUserRuns(userId, 12),
  ])

  if (!user) return null

  const averageWeeklyKm = resolveAverageWeeklyKm(user, recentRuns)
  const consistencyScore = buildConsistencyScore(user, recentRuns)

  const recentRunContext = recentRuns.slice(0, 8).map((run) => ({
    date: toIsoDate(run.completedAt),
    distanceKm: Math.round((run.distance || 0) * 100) / 100,
    durationMinutes: Math.round(((run.duration || 0) / 60) * 10) / 10,
    avgPace: formatPaceSecondsPerKm(run.pace),
    rpe: typeof run.rpe === 'number' ? run.rpe : undefined,
    notes: run.notes || undefined,
  }))

  const goalSummaries = activeGoals.slice(0, 5).map(summarizeGoal)

  return {
    userId,
    user: {
      goal: user.goal,
      experience: user.experience,
      daysPerWeek: user.daysPerWeek,
      preferredTimes: user.preferredTimes,
      age: user.age,
      averageWeeklyKm,
    },
    userContext: {
      userId,
      goal: user.goal,
      experience: user.experience,
      daysPerWeek: user.daysPerWeek,
      preferredTimes: user.preferredTimes,
      age: user.age,
      motivations: user.motivations || [],
      barriers: user.barriers || [],
      coachingStyle: user.coachingStyle,
      averageWeeklyKm,
    },
    challenge: {
      slug: challenge.slug,
      name: challenge.name,
      category: challenge.category,
      difficulty: challenge.difficulty,
      durationDays: challenge.durationDays,
      workoutPattern: challenge.workoutPattern,
      coachTone: challenge.coachTone,
      targetAudience: challenge.targetAudience,
      promise: challenge.promise,
    },
    totalWeeks: Math.max(1, Math.ceil(challenge.durationDays / 7)),
    planType: 'challenge',
    planPreferences: user.planPreferences,
    trainingHistory: {
      weeklyVolumeKm: averageWeeklyKm,
      consistencyScore,
      recentRuns: recentRunContext,
    },
    goals: {
      primaryGoal: primaryGoal ? summarizeGoal(primaryGoal) : undefined,
      activeGoals: goalSummaries,
    },
  }
}

export async function syncPlanWithChallenge(
  userId: number,
  planId: number,
  challenge: ChallengeTemplateInput
): Promise<ChallengePlanSyncResult> {
  if (typeof window === 'undefined') {
    return {
      planUpdated: false,
      source: 'none',
      error: 'Plan sync is only available in the client runtime.',
    }
  }

  try {
    const requestBody = await buildChallengePlanRequestBody(userId, challenge)
    if (!requestBody) {
      return {
        planUpdated: false,
        source: 'none',
        error: 'User profile was not found for challenge plan sync.',
      }
    }

    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    let data: {
      plan?: { workouts?: unknown[] }
      source?: string
      error?: string
    } | null = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    const generatedPlan = data?.plan
    if (generatedPlan?.workouts && Array.isArray(generatedPlan.workouts)) {
      await dbUtils.updatePlanWithAIWorkouts(planId, generatedPlan)
      return {
        planUpdated: true,
        source: data?.source === 'ai' ? 'ai' : 'fallback',
      }
    }

    return {
      planUpdated: false,
      source: 'none',
      error: data?.error || `Plan generation failed with status ${response.status}.`,
    }
  } catch (error) {
    return {
      planUpdated: false,
      source: 'none',
      error: error instanceof Error ? error.message : 'Unknown challenge plan sync error.',
    }
  }
}

export async function startChallengeAndSyncPlan({
  userId,
  planId,
  challenge,
  startDate,
}: StartChallengeAndSyncInput): Promise<ChallengePlanSyncResult> {
  await startChallenge(userId, challenge.slug, planId, startDate)
  return syncPlanWithChallenge(userId, planId, challenge)
}
