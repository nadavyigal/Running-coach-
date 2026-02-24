import 'server-only'

import {
  evaluateGarminSyncRateLimit,
  type GarminSyncRateLimitResult,
} from '@/lib/server/garmin-rate-limiter'

export interface GarminSyncRateLimitInput {
  userId: number
  lastSyncAt: string | null | undefined
  now?: Date
}

export function evaluateGarminRateLimit(input: GarminSyncRateLimitInput): GarminSyncRateLimitResult {
  return evaluateGarminSyncRateLimit(input)
}

