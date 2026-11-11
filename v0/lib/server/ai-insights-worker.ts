import "server-only"

import { Worker, type Job } from "bullmq"

import { logger } from "@/lib/logger"
import { generateInsightForUser, persistGeneratedInsight } from "@/lib/server/garmin-insights-service"
import { captureServerEvent } from "@/lib/server/posthog"
import type { AiInsightsJobPayload } from "@/lib/server/garmin-sync-queue"

type QueueConnection = {
  host: string
  port: number
  password?: string
  tls?: Record<string, never>
}

export interface AiInsightsJobResult {
  userId: number
  insightType: AiInsightsJobPayload["insightType"]
  stored: boolean
  confidence: number | null
  safetyFlags: string[]
}

function parseRedisConnection(): QueueConnection | null {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl)
      const port = Number.parseInt(parsed.port || "6379", 10)
      const connection: QueueConnection = {
        host: parsed.hostname,
        port: Number.isFinite(port) ? port : 6379,
      }
      if (parsed.password) connection.password = parsed.password
      if (parsed.protocol === "rediss:") connection.tls = {}
      return connection
    } catch (error) {
      logger.warn("Failed to parse REDIS_URL for AI insights worker:", error)
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
  if (process.env.REDIS_TLS === "true") connection.tls = {}
  return connection
}

function getSafetyFlagsFromEvidence(evidence: Record<string, unknown>): string[] {
  const summary = evidence.summary
  if (!summary || typeof summary !== "object") return []
  const flags = (summary as Record<string, unknown>).safetyFlags
  if (!Array.isArray(flags)) return []
  return flags.filter((flag): flag is string => typeof flag === "string" && flag.trim().length > 0)
}

export async function processAiInsightsJob(job: Job<AiInsightsJobPayload>): Promise<AiInsightsJobResult> {
  const payload = job.data
  logger.info("Processing AI insights job", {
    jobId: job.id,
    userId: payload.userId,
    type: payload.insightType,
  })

  const generationRequest = {
    userId: payload.userId,
    insightType: payload.insightType,
    requestedAt: payload.requestedAt,
    ...(payload.activityId !== undefined ? { activityId: payload.activityId } : {}),
    ...(payload.activityDate !== undefined ? { activityDate: payload.activityDate } : {}),
    ...(payload.derivedSummary !== undefined ? { derivedSummary: payload.derivedSummary } : {}),
  }

  const generated = await generateInsightForUser(generationRequest)

  if (!generated) {
    return {
      userId: payload.userId,
      insightType: payload.insightType,
      stored: false,
      confidence: null,
      safetyFlags: [],
    }
  }

  await persistGeneratedInsight(generated)
  const safetyFlags = getSafetyFlagsFromEvidence(generated.evidence)

  await captureServerEvent("ai_insight_created", {
    type: generated.type,
    confidence: generated.confidenceLabel,
    userId: payload.userId,
  })

  for (const flag of safetyFlags) {
    await captureServerEvent("ai_safety_flag_raised", {
      flag,
      metric: generated.type,
      userId: payload.userId,
    })
  }

  return {
    userId: payload.userId,
    insightType: payload.insightType,
    stored: true,
    confidence: generated.confidenceScore,
    safetyFlags,
  }
}

export function createAiInsightsWorker(params?: { concurrency?: number }): Worker<AiInsightsJobPayload> | null {
  const connection = parseRedisConnection()
  if (!connection) {
    logger.warn("AI insights worker not started because Redis is not configured")
    return null
  }

  const worker = new Worker<AiInsightsJobPayload>("ai-insights", processAiInsightsJob, {
    connection,
    concurrency: Math.max(1, params?.concurrency ?? 2),
  })

  worker.on("completed", (job) => {
    logger.info("AI insights worker completed job", { jobId: job.id })
  })

  worker.on("failed", (job, error) => {
    logger.error("AI insights worker failed job", {
      jobId: job?.id,
      error: error.message,
    })
  })

  return worker
}
