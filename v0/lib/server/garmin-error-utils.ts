import 'server-only'

/**
 * Context identifies which Garmin API endpoint produced the error.
 * - 'permissions' / 'profile': token-only endpoints (no query params)
 * - 'wellness': data endpoints that use timestamp query parameters
 * - 'unknown': fallback when caller cannot determine context
 */
export type GarminErrorContext = 'permissions' | 'profile' | 'wellness' | 'unknown'

/**
 * Classify a Garmin API error as an authentication/token problem.
 *
 * The `context` parameter is critical: Garmin returns the same
 * "did not match the expected pattern" message for both a malformed
 * Bearer token AND malformed query parameters (e.g. timestamps).
 * We only treat it as auth when the request had no query parameters
 * (permissions/profile endpoints).
 */
export function isGarminAuthError(
  status: number,
  body: string,
  context: GarminErrorContext = 'unknown'
): boolean {
  if (status === 401) return true

  if (status === 403) {
    return /Unable to read oAuth header|invalid[_ ]token|expired|unauthorized/i.test(body)
  }

  if (status === 400) {
    // "invalid token" or "invalid grant" are always auth errors
    if (/invalid.{0,10}token|invalid.{0,10}grant/i.test(body)) return true

    // "did not match the expected pattern" is only auth when calling
    // token-only endpoints. For wellness endpoints this means a
    // malformed query parameter (e.g. bad timestamp), not a bad token.
    if (context === 'permissions' || context === 'profile') {
      if (/did not match the expected pattern/i.test(body)) return true
    }
  }

  return false
}

export function isInvalidPullToken(body: string): boolean {
  return /InvalidPullTokenException|invalid pull token/i.test(body)
}

export function isMissingTimeRange(body: string): boolean {
  return /Missing time range parameters/i.test(body)
}

export function isFallbackWorthyWellnessStatus(status: number): boolean {
  return status === 400 || status === 404
}

export function isActivityBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_ACTIVITY/i.test(body)
}

export function isSleepBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_SLEEP/i.test(body)
}

export function isSleepEndpointNotProvisioned(status: number, body: string): boolean {
  if (/Endpoint not enabled for summary type:\s*CONNECT_SLEEP/i.test(body)) return true
  if (status === 404 && /\/wellness-api\/rest\/(backfill\/)?sleeps/i.test(body)) return true
  return false
}

export function isDailiesBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_DAIL/i.test(body)
}

export function summarizeUpstreamBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ''

  try {
    const parsed = JSON.parse(trimmed) as {
      errorMessage?: unknown
      message?: unknown
      error?: unknown
      path?: unknown
    }
    const message = [parsed.errorMessage, parsed.message, parsed.error, parsed.path].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    if (message) return message.slice(0, 500)
  } catch {
    // keep text body
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page'
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed
}
