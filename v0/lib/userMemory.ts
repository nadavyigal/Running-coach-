import Dexie from 'dexie'
import type { Goal, Plan, Route, Run, User, Workout } from '@/lib/db'
import { db } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'
import { logger } from '@/lib/logger'

const DEVICE_ID_KEY = 'runsmart_device_id'
const SNAPSHOT_VERSION = 1
const RUN_LIMIT = 200

type UserMemorySummary = {
  name?: string
  goal?: User['goal']
  experience?: User['experience']
  daysPerWeek?: number
  onboardingComplete?: boolean
  activePlanId?: number | null
  workoutsCompleted?: number
  workoutsTotal?: number
  routesCount?: number
  runsCount?: number
  lastRunAt?: string | null
  lastSeenAt?: string
}

export type UserMemorySnapshot = {
  version: number
  user: User
  plan: Plan | null
  workouts: Workout[]
  goals: Goal[]
  runs: Run[]
  routes: Route[]
  capturedAt: string
  summary: UserMemorySummary
}

const isIsoDateString = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false
  if (!value.includes('T')) return false
  const parsed = Date.parse(value)
  return !Number.isNaN(parsed)
}

const reviveDates = <T>(input: T): T => {
  if (Array.isArray(input)) {
    return input.map((item) => reviveDates(item)) as T
  }

  if (!input || typeof input !== 'object') {
    return input
  }

  const result = { ...(input as Record<string, unknown>) }
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' && (key.endsWith('At') || key.endsWith('Date')) && isIsoDateString(value)) {
      result[key] = new Date(value)
      continue
    }
    if (value && typeof value === 'object') {
      result[key] = reviveDates(value as Record<string, unknown>)
    }
  }

  return result as T
}

export const getDeviceId = (): string | null => {
  if (typeof window === 'undefined') return null

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing

    const generated = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    window.localStorage.setItem(DEVICE_ID_KEY, generated)
    return generated
  } catch (error) {
    logger.warn('[user-memory] Failed to access localStorage for device ID:', error)
    return null
  }
}

const summarizeSnapshot = (user: User, plan: Plan | null, workouts: Workout[], routes: Route[], runs: Run[]): UserMemorySummary => {
  const completedWorkouts = workouts.filter((workout) => workout.completed).length
  const lastRun = runs.find((run) => run.completedAt) ?? null

  return {
    name: user.name,
    goal: user.goal,
    experience: user.experience,
    daysPerWeek: user.daysPerWeek,
    onboardingComplete: user.onboardingComplete,
    activePlanId: plan?.id ?? null,
    workoutsCompleted: completedWorkouts,
    workoutsTotal: workouts.length,
    routesCount: routes.length,
    runsCount: runs.length,
    lastRunAt: lastRun?.completedAt ? new Date(lastRun.completedAt).toISOString() : null,
    lastSeenAt: new Date().toISOString(),
  }
}

export const buildUserMemorySnapshot = async (userId: number): Promise<UserMemorySnapshot | null> => {
  try {
    const user = await db.users.get(userId)
    if (!user) return null

    const plan = await dbUtils.getActivePlan(userId)
    const workouts = plan?.id ? await db.workouts.where('planId').equals(plan.id).toArray() : []
    const goals = await db.goals.where('userId').equals(userId).toArray()
    const routes = await db.routes.toArray()

    const runs = await db.runs
      .where('[userId+completedAt]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .reverse()
      .limit(RUN_LIMIT)
      .toArray()

    const summary = summarizeSnapshot(user, plan, workouts, routes, runs)

    return {
      version: SNAPSHOT_VERSION,
      user,
      plan,
      workouts,
      goals,
      runs,
      routes,
      capturedAt: new Date().toISOString(),
      summary,
    }
  } catch (error) {
    logger.error('[user-memory] Failed to build snapshot:', error)
    return null
  }
}

export const syncUserMemory = async (userId: number): Promise<void> => {
  if (typeof window === 'undefined') return

  const deviceId = getDeviceId()
  if (!deviceId) return

  const snapshot = await buildUserMemorySnapshot(userId)
  if (!snapshot) return

  try {
    const response = await fetch('/api/user-memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, userId, snapshot }),
    })

    if (!response.ok) {
      logger.warn('[user-memory] Sync failed:', await response.text())
    }
  } catch (error) {
    logger.error('[user-memory] Sync request failed:', error)
  }
}

export const restoreUserMemory = async (): Promise<User | null> => {
  if (typeof window === 'undefined') return null

  const deviceId = getDeviceId()
  if (!deviceId) return null

  try {
    const response = await fetch(`/api/user-memory?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    const snapshot = payload?.snapshot as UserMemorySnapshot | undefined
    if (!snapshot?.user) {
      return null
    }

    const restoredUser = reviveDates(snapshot.user)

    await db.transaction('rw', db.users, db.plans, db.workouts, db.goals, db.runs, db.routes, async () => {
      await db.users.put(restoredUser)

      if (snapshot.plan) {
        await db.plans.put(reviveDates(snapshot.plan))
      }

      if (snapshot.workouts?.length) {
        await db.workouts.bulkPut(snapshot.workouts.map((workout) => reviveDates(workout)))
      }

      if (snapshot.goals?.length) {
        await db.goals.bulkPut(snapshot.goals.map((goal) => reviveDates(goal)))
      }

      if (snapshot.runs?.length) {
        await db.runs.bulkPut(snapshot.runs.map((run) => reviveDates(run)))
      }

      if (snapshot.routes?.length) {
        await db.routes.bulkPut(snapshot.routes.map((route) => reviveDates(route)))
      }
    })

    return restoredUser
  } catch (error) {
    logger.warn('[user-memory] Restore failed:', error)
    return null
  }
}
