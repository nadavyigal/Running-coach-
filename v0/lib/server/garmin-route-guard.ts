import 'server-only'

import { NextResponse } from 'next/server'

import { GARMIN_CONNECT_DISABLED_MESSAGE } from '@/lib/server/garmin-connect-gate'

export const GARMIN_UNAVAILABLE_CODE = 'GARMIN_UNAVAILABLE'

/**
 * Switches off the client-facing Garmin routes. Garmin is not live for users.
 *
 * Deliberately not controlled by an env var. Before a route is opened again it
 * needs a signed-in user (`requireApiUser`) and must take the account and the
 * rows it touches from that session, not from the request.
 *
 * The body must not carry `connected` or `needsReauth`, and the status must not
 * be 401: the web app would mark the athlete's device as needing a reconnect.
 *
 * Usage:
 *   const blocked = blockGarminRoute()
 *   if (blocked) return blocked
 */
export function blockGarminRoute(): NextResponse | null {
  return NextResponse.json(
    { success: false, error: GARMIN_CONNECT_DISABLED_MESSAGE, code: GARMIN_UNAVAILABLE_CODE },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
