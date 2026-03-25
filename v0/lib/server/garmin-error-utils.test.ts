import { describe, expect, it, vi } from 'vitest'

// Mock 'server-only' to allow testing outside of server context
vi.mock('server-only', () => ({}))

import {
  isGarminAuthError,
  isInvalidPullToken,
  isMissingTimeRange,
  isFallbackWorthyWellnessStatus,
  isActivityBackfillNotProvisioned,
  isSleepBackfillNotProvisioned,
  isSleepEndpointNotProvisioned,
  isDailiesBackfillNotProvisioned,
  summarizeUpstreamBody,
} from './garmin-error-utils'

describe('isGarminAuthError', () => {
  it('returns true for 401 regardless of context', () => {
    expect(isGarminAuthError(401, '', 'unknown')).toBe(true)
    expect(isGarminAuthError(401, '', 'wellness')).toBe(true)
    expect(isGarminAuthError(401, '', 'permissions')).toBe(true)
  })

  it('returns true for 403 with OAuth header error', () => {
    expect(isGarminAuthError(403, 'Unable to read oAuth header', 'wellness')).toBe(true)
  })

  it('returns true for 403 with invalid token', () => {
    expect(isGarminAuthError(403, 'invalid_token: token expired', 'wellness')).toBe(true)
  })

  it('returns true for 403 with expired token', () => {
    expect(isGarminAuthError(403, 'Token has expired', 'wellness')).toBe(true)
  })

  it('returns false for 403 without auth keywords', () => {
    expect(isGarminAuthError(403, 'Access denied for this resource', 'wellness')).toBe(false)
  })

  it('returns true for 400 with "invalid token" regardless of context', () => {
    expect(isGarminAuthError(400, 'invalid token format', 'wellness')).toBe(true)
    expect(isGarminAuthError(400, 'invalid token format', 'permissions')).toBe(true)
    expect(isGarminAuthError(400, 'invalid token format', 'unknown')).toBe(true)
  })

  it('returns true for 400 with "invalid grant" regardless of context', () => {
    expect(isGarminAuthError(400, 'invalid grant', 'wellness')).toBe(true)
    expect(isGarminAuthError(400, 'invalid grant', 'unknown')).toBe(true)
  })

  // THE KEY FIX: "did not match the expected pattern" is NOT auth for wellness endpoints
  it('returns false for 400 "did not match the expected pattern" with wellness context', () => {
    expect(isGarminAuthError(400, 'string did not match the expected pattern', 'wellness')).toBe(false)
  })

  it('returns false for 400 "did not match the expected pattern" with unknown context', () => {
    expect(isGarminAuthError(400, 'string did not match the expected pattern', 'unknown')).toBe(false)
  })

  it('returns true for 400 "did not match the expected pattern" with permissions context', () => {
    expect(isGarminAuthError(400, 'string did not match the expected pattern', 'permissions')).toBe(true)
  })

  it('returns true for 400 "did not match the expected pattern" with profile context', () => {
    expect(isGarminAuthError(400, 'string did not match the expected pattern', 'profile')).toBe(true)
  })

  it('defaults context to unknown when not provided', () => {
    expect(isGarminAuthError(400, 'string did not match the expected pattern')).toBe(false)
  })

  it('returns false for 200', () => {
    expect(isGarminAuthError(200, '', 'unknown')).toBe(false)
  })

  it('returns false for 500', () => {
    expect(isGarminAuthError(500, 'Internal server error', 'unknown')).toBe(false)
  })
})

describe('isInvalidPullToken', () => {
  it('matches InvalidPullTokenException', () => {
    expect(isInvalidPullToken('InvalidPullTokenException: token is stale')).toBe(true)
  })

  it('matches "invalid pull token" case-insensitively', () => {
    expect(isInvalidPullToken('Invalid Pull Token for this app')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isInvalidPullToken('Missing time range parameters')).toBe(false)
  })
})

describe('isMissingTimeRange', () => {
  it('matches "Missing time range parameters"', () => {
    expect(isMissingTimeRange('Missing time range parameters')).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isMissingTimeRange('InvalidPullTokenException')).toBe(false)
  })
})

describe('isFallbackWorthyWellnessStatus', () => {
  it('returns true for 400', () => {
    expect(isFallbackWorthyWellnessStatus(400)).toBe(true)
  })

  it('returns true for 404', () => {
    expect(isFallbackWorthyWellnessStatus(404)).toBe(true)
  })

  it('returns false for 401', () => {
    expect(isFallbackWorthyWellnessStatus(401)).toBe(false)
  })

  it('returns false for 500', () => {
    expect(isFallbackWorthyWellnessStatus(500)).toBe(false)
  })
})

describe('backfill not provisioned helpers', () => {
  it('isActivityBackfillNotProvisioned matches', () => {
    expect(isActivityBackfillNotProvisioned('Endpoint not enabled for summary type: CONNECT_ACTIVITY')).toBe(true)
    expect(isActivityBackfillNotProvisioned('some other error')).toBe(false)
  })

  it('isSleepBackfillNotProvisioned matches', () => {
    expect(isSleepBackfillNotProvisioned('Endpoint not enabled for summary type: CONNECT_SLEEP')).toBe(true)
    expect(isSleepBackfillNotProvisioned('some other error')).toBe(false)
  })

  it('isDailiesBackfillNotProvisioned matches', () => {
    expect(isDailiesBackfillNotProvisioned('Endpoint not enabled for summary type: CONNECT_DAILIES')).toBe(true)
    expect(isDailiesBackfillNotProvisioned('some other error')).toBe(false)
  })
})

describe('isSleepEndpointNotProvisioned', () => {
  it('matches provisioning error body', () => {
    expect(isSleepEndpointNotProvisioned(400, 'Endpoint not enabled for summary type: CONNECT_SLEEP')).toBe(true)
  })

  it('matches 404 with sleeps URL pattern', () => {
    expect(isSleepEndpointNotProvisioned(404, '/wellness-api/rest/sleeps not found')).toBe(true)
    expect(isSleepEndpointNotProvisioned(404, '/wellness-api/rest/backfill/sleeps not found')).toBe(true)
  })

  it('returns false for unrelated error', () => {
    expect(isSleepEndpointNotProvisioned(400, 'Missing time range')).toBe(false)
  })
})

describe('summarizeUpstreamBody', () => {
  it('returns empty string for empty body', () => {
    expect(summarizeUpstreamBody('')).toBe('')
    expect(summarizeUpstreamBody('  ')).toBe('')
  })

  it('extracts errorMessage from JSON', () => {
    expect(summarizeUpstreamBody(JSON.stringify({ errorMessage: 'Token expired' }))).toBe('Token expired')
  })

  it('extracts message from JSON', () => {
    expect(summarizeUpstreamBody(JSON.stringify({ message: 'Bad request' }))).toBe('Bad request')
  })

  it('detects HTML error pages', () => {
    expect(summarizeUpstreamBody('<!DOCTYPE html><html>error</html>')).toBe('Garmin returned an HTML error page')
  })

  it('truncates long text bodies to 500 chars', () => {
    const longBody = 'x'.repeat(600)
    const result = summarizeUpstreamBody(longBody)
    expect(result.length).toBeLessThanOrEqual(503) // 500 + "..."
    expect(result).toContain('...')
  })

  it('returns short text bodies as-is', () => {
    expect(summarizeUpstreamBody('Short error message')).toBe('Short error message')
  })
})
