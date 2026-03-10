import 'server-only'

import {
  enqueueGarminBackfillJob,
  getGarminSyncState,
  processPendingGarminJobs,
} from '@/lib/integrations/garmin/service'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { evaluateGarminRateLimit } from '@/lib/garmin/sync/rateLimit'

type GarminSyncTrigger = 'manual' | 'backfill'

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
    lastSyncAt: state.lastSuccessfulSyncAt ?? state.lastSyncAt,
    lastSyncCursor: state.lastSyncCursor,
    errorState: state.errorState,
  }
}

export async function syncGarminUser(input: {
  userId: number
  trigger?: GarminSyncTrigger
}): Promise<GarminSyncUserResult> {
  const userId = input.userId
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Valid userId is required for Garmin sync')
  }

  const connection = await getGarminOAuthState(userId)
  if (!connection || connection.status !== 'connected') {
    return {
      status: 401,
      connected: false,
      lastSyncAt: connection?.lastSuccessfulSyncAt ?? connection?.lastSyncAt ?? null,
      errorState: connection?.errorState ?? null,
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

  const lastSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncAt
  const rateLimit = evaluateGarminRateLimit({
    userId,
    lastSyncAt,
  })

  if (!rateLimit.allowed && input.trigger !== 'backfill') {
    return {
      status: 429,
      connected: true,
      lastSyncAt,
      errorState: connection.errorState,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      ...(rateLimit.retryAfterSeconds !== undefined ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
      ...(rateLimit.reason !== undefined ? { reason: rateLimit.reason } : {}),
      body: {
        success: false,
        error: 'Garmin sync rate limit reached. Try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        reason: rateLimit.reason,
      },
    }
  }

  await enqueueGarminBackfillJob({
    userId,
    profileId: connection.profileId,
    providerUserId: connection.providerUserId ?? connection.garminUserId,
  })

  const workerStats = await processPendingGarminJobs({
    limit: input.trigger === 'backfill' ? 8 : 4,
    workerId: `manual-sync-${userId}`,
  })
  const refreshedStatus = await getGarminSyncState(userId)

  return {
    status: 200,
    connected: refreshedStatus.connected,
    lastSyncAt: refreshedStatus.lastSuccessfulSyncAt ?? refreshedStatus.lastSyncAt,
    errorState: refreshedStatus.errorState,
    noOp: workerStats.imported === 0,
    activitiesUpserted: workerStats.imported,
    dailyMetricsUpserted: 0,
    body: {
      success: true,
      syncState: refreshedStatus.syncState,
      pendingJobs: refreshedStatus.pendingJobs,
      workerStats,
    },
  }
}
