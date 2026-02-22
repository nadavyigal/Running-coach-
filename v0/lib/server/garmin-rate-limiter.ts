const TEN_MINUTES_MS = 10 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_SYNC_CALLS_PER_HOUR = 50

const hourlySyncAttempts = new Map<number, number[]>()

export interface GarminSyncRateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
  reason?: 'cooldown' | 'hourly_limit'
}

function clampRetryAfter(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1
  return Math.max(1, Math.ceil(seconds))
}

function parseIsoTime(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pruneHourlyAttempts(userId: number, nowMs: number): number[] {
  const attempts = hourlySyncAttempts.get(userId) ?? []
  const cutoff = nowMs - ONE_HOUR_MS
  const recent = attempts.filter((timestamp) => timestamp > cutoff)
  hourlySyncAttempts.set(userId, recent)
  return recent
}

export function evaluateGarminSyncRateLimit(params: {
  userId: number
  lastSyncAt: string | null | undefined
  now?: Date
}): GarminSyncRateLimitResult {
  const nowMs = (params.now ?? new Date()).getTime()
  const lastSyncMs = parseIsoTime(params.lastSyncAt)

  if (lastSyncMs != null) {
    const msSinceLastSync = nowMs - lastSyncMs
    if (msSinceLastSync < TEN_MINUTES_MS) {
      return {
        allowed: false,
        retryAfterSeconds: clampRetryAfter((TEN_MINUTES_MS - msSinceLastSync) / 1000),
        reason: 'cooldown',
      }
    }
  }

  const attempts = pruneHourlyAttempts(params.userId, nowMs)
  if (attempts.length >= MAX_SYNC_CALLS_PER_HOUR) {
    const oldestAttempt = attempts[0]
    if (oldestAttempt == null) {
      return {
        allowed: false,
        retryAfterSeconds: 1,
        reason: 'hourly_limit',
      }
    }
    const retryAfterMs = oldestAttempt + ONE_HOUR_MS - nowMs
    return {
      allowed: false,
      retryAfterSeconds: clampRetryAfter(retryAfterMs / 1000),
      reason: 'hourly_limit',
    }
  }

  attempts.push(nowMs)
  hourlySyncAttempts.set(params.userId, attempts)
  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}

export function resetGarminSyncRateLimiterForTests(): void {
  hourlySyncAttempts.clear()
}
