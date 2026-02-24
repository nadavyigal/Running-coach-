import 'server-only'

import { runGarminSyncForUser } from '@/app/api/devices/garmin/sync/route'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { evaluateGarminRateLimit } from '@/lib/garmin/sync/rateLimit'

type GarminSyncTrigger = 'manual' | 'backfill'

const DEFAULT_INCREMENTAL_DAYS = 56
const DEFAULT_BACKFILL_DAYS = 90
const DEFAULT_ACTIVITY_DAYS = 90
const MAX_RETRIES = 3

export interface GarminConnectionStatus {
  connected: boolean
  status: string
  lastSyncAt: string | null
  lastSyncCursor: string | null
  errorState: Record<string, unknown> | null
}

export interface GarminSyncUserResult {
  status: number
  connected: boolean
  lastSyncAt: string | null
  errorState: Record<string, unknown> | null
  noOp: boolean
  activitiesUpserted: number
  dailyMetricsUpserted: number
  retryAfterSeconds?: number
  reason?: string
  body: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getGarminConnectionStatus(userId: number): Promise<GarminConnectionStatus> {
  const state = await getGarminOAuthState(userId)
  if (!state) {
    return {
      connected: false,
      status: 'disconnected',
      lastSyncAt: null,
      lastSyncCursor: null,
      errorState: null,
    }
  }

  return {
    connected: state.status === 'connected',
    status: state.status,
    lastSyncAt: state.lastSyncAt,
    lastSyncCursor: state.lastSyncCursor,
    errorState: state.errorState,
  }
}

export async function syncGarminUser(input: {
  userId: number
  trigger?: GarminSyncTrigger
  sinceIso?: string | null
}): Promise<GarminSyncUserResult> {
  const userId = input.userId
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Valid userId is required for Garmin sync')
  }

  const connection = await getGarminConnectionStatus(userId)
  if (!connection.connected) {
    return {
      status: 401,
      connected: false,
      lastSyncAt: connection.lastSyncAt,
      errorState: connection.errorState,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      reason: 'not_connected',
      body: {
        success: false,
        error: 'No Garmin connection found. Connect Garmin first.',
        needsReauth: true,
      },
    }
  }

  const rateLimit = evaluateGarminRateLimit({
    userId,
    lastSyncAt: connection.lastSyncAt,
  })

  if (!rateLimit.allowed) {
    return {
      status: 429,
      connected: true,
      lastSyncAt: connection.lastSyncAt,
      errorState: connection.errorState,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      reason: rateLimit.reason,
      body: {
        success: false,
        error: 'Garmin sync rate limit reached. Try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        reason: rateLimit.reason,
      },
    }
  }

  const trigger = input.trigger ?? 'manual'
  const isBackfill = trigger === 'backfill'
  const defaultLookbackDays = isBackfill ? DEFAULT_BACKFILL_DAYS : DEFAULT_INCREMENTAL_DAYS
  const activityLookbackDays = DEFAULT_ACTIVITY_DAYS

  let lastExecution: Awaited<ReturnType<typeof runGarminSyncForUser>> | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    lastExecution = await runGarminSyncForUser({
      userId,
      options: {
        trigger: isBackfill ? 'backfill' : 'manual',
        enforceRateLimit: false,
        defaultLookbackDays,
        activityLookbackDays,
        ...(input.sinceIso != null ? { sinceIso: input.sinceIso } : {}),
      },
    })

    if (lastExecution.status < 500) break
    if (attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** (attempt - 1))
    }
  }

  const execution = lastExecution ?? {
    status: 500,
    body: { success: false, error: 'Failed to execute Garmin sync' },
  }

  const responseBody = asRecord(execution.body)
  const persistence = asRecord(responseBody.persistence)
  const activitiesUpserted = getNumber(persistence.activitiesUpserted) ?? 0
  const dailyMetricsUpserted = getNumber(persistence.dailyMetricsUpserted) ?? 0
  const noOp = execution.status === 200 && activitiesUpserted === 0 && dailyMetricsUpserted === 0

  const refreshedConnection = await getGarminConnectionStatus(userId)

  return {
    status: execution.status,
    connected: refreshedConnection.connected,
    lastSyncAt: (responseBody.lastSyncAt as string | null | undefined) ?? refreshedConnection.lastSyncAt,
    errorState: refreshedConnection.errorState,
    noOp,
    activitiesUpserted,
    dailyMetricsUpserted,
    body: responseBody,
  }
}
