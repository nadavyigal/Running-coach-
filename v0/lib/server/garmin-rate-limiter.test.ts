import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  evaluateGarminSyncRateLimit,
  resetGarminSyncRateLimiterForTests,
} from '@/lib/server/garmin-rate-limiter'

describe('garmin-rate-limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-22T10:00:00.000Z'))
    resetGarminSyncRateLimiterForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetGarminSyncRateLimiterForTests()
  })

  it('blocks second sync within 10 minutes', () => {
    const nowIso = new Date().toISOString()
    const result = evaluateGarminSyncRateLimit({
      userId: 42,
      lastSyncAt: nowIso,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('cooldown')
    expect(result.retryAfterSeconds).toBe(600)
  })

  it('limits to at most 50 sync calls per hour per user', () => {
    for (let index = 0; index < 50; index += 1) {
      const result = evaluateGarminSyncRateLimit({
        userId: 77,
        lastSyncAt: null,
      })
      expect(result.allowed).toBe(true)
    }

    const blocked = evaluateGarminSyncRateLimit({
      userId: 77,
      lastSyncAt: null,
    })

    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe('hourly_limit')
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})

