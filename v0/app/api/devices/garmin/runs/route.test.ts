import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getGarminOAuthStateMock = vi.hoisted(() => vi.fn())
const queryResultMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: queryResultMock,
    }
    return { from: () => query }
  },
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

async function loadRoute() {
  return import('./route')
}

function runsRequest() {
  return new Request('http://localhost/api/devices/garmin/runs?userId=42')
}

describe('/api/devices/garmin/runs', () => {
  beforeEach(() => {
    vi.resetModules()
    getGarminOAuthStateMock.mockReset()
    queryResultMock.mockReset()
    loggerMock.warn.mockClear()
    getGarminOAuthStateMock.mockResolvedValue({ status: 'connected', profileId: 'profile-1' })
    queryResultMock.mockResolvedValue({ data: [], error: null })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
    vi.stubEnv('GARMIN_CLIENT_ID', 'test-client-id')
    vi.stubEnv('GARMIN_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('GARMIN_TEST_CLIENT_ID', '')
    vi.stubEnv('GARMIN_TEST_CLIENT_SECRET', '')
    vi.stubEnv('GARMIN_USE_TEST_CREDENTIALS', '')
    vi.stubEnv('GARMIN_CREDENTIAL_SET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the runs when Garmin works', async () => {
    const { GET } = await loadRoute()

    const res = await GET(runsRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 503 when Garmin is not configured', async () => {
    vi.stubEnv('GARMIN_CLIENT_ID', '')
    const { GET } = await loadRoute()

    const res = await GET(runsRequest())

    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('GARMIN_UNAVAILABLE')
    expect(getGarminOAuthStateMock).not.toHaveBeenCalled()
  })

  it('returns 503 without the raw error when reading the connection hits a rejected key', async () => {
    getGarminOAuthStateMock.mockRejectedValue(
      new Error('Failed to read garmin_connections: Unregistered API key')
    )
    const { GET } = await loadRoute()

    const res = await GET(runsRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.code).toBe('GARMIN_UNAVAILABLE')
    expect(body.error).not.toMatch(/api key/i)
    expect(loggerMock.warn).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when the runs query hits a rejected key', async () => {
    queryResultMock.mockResolvedValue({ data: null, error: { message: 'Unregistered API key' } })
    const { GET } = await loadRoute()

    const res = await GET(runsRequest())

    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('GARMIN_UNAVAILABLE')
  })

  it('keeps returning 500 for other query errors', async () => {
    queryResultMock.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } })
    const { GET } = await loadRoute()

    const res = await GET(runsRequest())

    expect(res.status).toBe(500)
  })

  it('does not swallow other connection read errors', async () => {
    getGarminOAuthStateMock.mockRejectedValue(new Error('connection timed out'))
    const { GET } = await loadRoute()

    await expect(GET(runsRequest())).rejects.toThrow('connection timed out')
  })
})
