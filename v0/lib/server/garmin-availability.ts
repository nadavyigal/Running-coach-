import 'server-only'

import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { resolveGarminOAuthClientCredentials } from '@/lib/server/garmin-credentials'

export type GarminUnavailableReason = 'garmin_not_configured' | 'supabase_key_rejected'

// Messages the Supabase gateway returns when it does not accept the API key itself.
const REJECTED_KEY_MESSAGE = /unregistered api key|invalid api key|legacy api keys are disabled/i

// Module state: one log line per reason for each server instance (a cold start logs again).
const loggedReasons = new Set<GarminUnavailableReason>()

export function getGarminConfigGap(): GarminUnavailableReason | null {
  const hasSupabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  if (!hasSupabase) return 'garmin_not_configured'

  try {
    resolveGarminOAuthClientCredentials()
  } catch {
    return 'garmin_not_configured'
  }

  return null
}

export function getRejectedKeyReason(error: unknown): GarminUnavailableReason | null {
  const message = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && REJECTED_KEY_MESSAGE.test(message)
    ? 'supabase_key_rejected'
    : null
}

export function logGarminUnavailableOnce(reason: GarminUnavailableReason): void {
  if (loggedReasons.has(reason)) return
  loggedReasons.add(reason)
  logger.warn(
    reason === 'supabase_key_rejected'
      ? '[garmin] skipped: Supabase rejected SUPABASE_SERVICE_ROLE_KEY. Replace the key and redeploy.'
      : '[garmin] skipped: Garmin or Supabase environment variables are not configured.'
  )
}

/** Response for scheduled jobs: 200, so a known outage is not counted as a new error on every run. */
export function garminJobSkippedResponse(reason: GarminUnavailableReason) {
  logGarminUnavailableOnce(reason)
  return NextResponse.json({ success: false, skipped: true, reason })
}
