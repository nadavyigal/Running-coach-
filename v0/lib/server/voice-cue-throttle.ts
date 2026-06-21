import "server-only"

/**
 * In-memory throttle for the voice-cue endpoint.
 *
 * This is a first-line guard against request loops and casual abuse. It is
 * per-serverless-instance and resets on cold start, so it is NOT the hard
 * spend ceiling. The hard ceiling is the monthly budget cap on the dedicated
 * OPENAI_VOICE_KEY project (see .env.example). Treat this as defense-in-depth.
 *
 * Two rules per caller key (userId, else client IP):
 *  - MIN_INTERVAL_MS: minimum gap between two cues
 *  - MAX_PER_WINDOW within WINDOW_MS: rolling-hour ceiling
 */

export const MIN_INTERVAL_MS = 45_000 // 45s between cues
export const WINDOW_MS = 60 * 60 * 1000 // 1 hour
export const MAX_PER_WINDOW = 30 // ceiling per caller per hour

export interface ThrottleResult {
  allowed: boolean
  retryAfterSeconds?: number
  reason?: "min_interval" | "hourly_cap"
}

// key -> ascending list of accepted-request timestamps (ms)
const hits = new Map<string, number[]>()

/**
 * Check the throttle for `key` at time `now` and, if allowed, record the hit.
 * `now` is injectable for deterministic tests.
 */
export function checkVoiceCueThrottle(key: string, now: number = Date.now()): ThrottleResult {
  const windowStart = now - WINDOW_MS
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart)

  const last = recent.length ? recent[recent.length - 1] : undefined
  if (last !== undefined && now - last < MIN_INTERVAL_MS) {
    hits.set(key, recent)
    return {
      allowed: false,
      reason: "min_interval",
      retryAfterSeconds: Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000),
    }
  }

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent)
    const retryAfterSeconds = Math.ceil((recent[0] + WINDOW_MS - now) / 1000)
    return { allowed: false, reason: "hourly_cap", retryAfterSeconds }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true }
}

/** Test-only: clear all recorded state. */
export function __resetVoiceCueThrottle(): void {
  hits.clear()
}
