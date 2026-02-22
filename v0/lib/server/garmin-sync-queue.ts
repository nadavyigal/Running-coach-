import { Queue } from 'bullmq'
import { logger } from '@/lib/logger'

type QueueConnection = {
  host: string
  port: number
  password?: string
  tls?: Record<string, never>
}

export interface GarminSyncJobPayload {
  userId: number
  trigger: 'manual' | 'incremental' | 'nightly' | 'backfill'
  dailyLookbackDays: number
  activityLookbackDays: number
  sinceIso?: string | null
  requestedAt: string
}

export interface GarminDeriveJobPayload {
  userId?: number
  garminUserId?: string
  datasetKey?: string
  source: 'webhook' | 'sync'
  requestedAt: string
}

export interface AiInsightsJobPayload {
  userId: number
  insightType: 'daily' | 'weekly' | 'post_run'
  requestedAt: string
}

interface QueueEnqueueResult {
  queued: boolean
  jobId: string | null
  reason?: string
}

let garminSyncQueue: Queue<GarminSyncJobPayload> | null = null
let garminDeriveQueue: Queue<GarminDeriveJobPayload> | null = null
let aiInsightsQueue: Queue<AiInsightsJobPayload> | null = null

function parseRedisConnection(): QueueConnection | null {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl)
      const port = Number.parseInt(parsed.port || '6379', 10)
      const connection: QueueConnection = {
        host: parsed.hostname,
        port: Number.isFinite(port) ? port : 6379,
      }
      if (parsed.password) connection.password = parsed.password
      if (parsed.protocol === 'rediss:') connection.tls = {}
      return connection
    } catch (error) {
      logger.warn('Failed to parse REDIS_URL for Garmin queue:', error)
      return null
    }
  }

  const host = process.env.REDIS_HOST?.trim()
  if (!host) return null

  const portValue = process.env.REDIS_PORT?.trim()
  const parsedPort = portValue ? Number.parseInt(portValue, 10) : 6379
  const connection: QueueConnection = {
    host,
    port: Number.isFinite(parsedPort) ? parsedPort : 6379,
  }
  const password = process.env.REDIS_PASSWORD?.trim()
  if (password) connection.password = password
  if (process.env.REDIS_TLS === 'true') connection.tls = {}
  return connection
}

function isQueueConfigured(): boolean {
  return parseRedisConnection() != null
}

function getGarminSyncQueue(): Queue<GarminSyncJobPayload> | null {
  if (!isQueueConfigured()) return null
  if (garminSyncQueue) return garminSyncQueue

  const connection = parseRedisConnection()
  if (!connection) return null

  garminSyncQueue = new Queue<GarminSyncJobPayload>('garmin-sync', {
    connection,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 200,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 300,
      },
    },
  })

  return garminSyncQueue
}

function getGarminDeriveQueue(): Queue<GarminDeriveJobPayload> | null {
  if (!isQueueConfigured()) return null
  if (garminDeriveQueue) return garminDeriveQueue

  const connection = parseRedisConnection()
  if (!connection) return null

  garminDeriveQueue = new Queue<GarminDeriveJobPayload>('garmin-derive-metrics', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1500,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 200,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 300,
      },
    },
  })

  return garminDeriveQueue
}

function getAiInsightsQueue(): Queue<AiInsightsJobPayload> | null {
  if (!isQueueConfigured()) return null
  if (aiInsightsQueue) return aiInsightsQueue

  const connection = parseRedisConnection()
  if (!connection) return null

  aiInsightsQueue = new Queue<AiInsightsJobPayload>('ai-insights', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 200,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 300,
      },
    },
  })

  return aiInsightsQueue
}

export async function enqueueGarminSyncJob(payload: GarminSyncJobPayload): Promise<QueueEnqueueResult> {
  const queue = getGarminSyncQueue()
  if (!queue) {
    return {
      queued: false,
      jobId: null,
      reason: 'Garmin sync queue unavailable (Redis not configured)',
    }
  }

  const jobId = `garmin-sync:${payload.userId}`
  await queue.add('garmin-sync', payload, {
    jobId,
  })

  return { queued: true, jobId }
}

export async function enqueueGarminDeriveJob(payload: GarminDeriveJobPayload): Promise<QueueEnqueueResult> {
  const queue = getGarminDeriveQueue()
  if (!queue) {
    return {
      queued: false,
      jobId: null,
      reason: 'Garmin derive queue unavailable (Redis not configured)',
    }
  }

  const dedupeKey = payload.userId != null ? `user:${payload.userId}` : `garmin:${payload.garminUserId ?? 'unknown'}`
  const datasetKey = payload.datasetKey ?? 'unknown'
  const bucketIso = payload.requestedAt.slice(0, 16)
  const jobId = `garmin-derive:${dedupeKey}:${datasetKey}:${bucketIso}`
  await queue.add('garmin-derive', payload, {
    jobId,
  })

  return { queued: true, jobId }
}

export async function enqueueAiInsightsJob(payload: AiInsightsJobPayload): Promise<QueueEnqueueResult> {
  const queue = getAiInsightsQueue()
  if (!queue) {
    return {
      queued: false,
      jobId: null,
      reason: 'AI insights queue unavailable (Redis not configured)',
    }
  }

  const jobId = `ai-insights:${payload.userId}:${payload.insightType}`
  await queue.add('ai-insights', payload, {
    jobId,
  })

  return { queued: true, jobId }
}

export async function closeGarminQueuesForTests(): Promise<void> {
  const toClose: Promise<void>[] = []
  if (garminSyncQueue) toClose.push(garminSyncQueue.close())
  if (garminDeriveQueue) toClose.push(garminDeriveQueue.close())
  if (aiInsightsQueue) toClose.push(aiInsightsQueue.close())
  await Promise.all(toClose)
  garminSyncQueue = null
  garminDeriveQueue = null
  aiInsightsQueue = null
}
