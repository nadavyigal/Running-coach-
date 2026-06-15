import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAndParseStateMock = vi.hoisted(() =>
  vi.fn(() => ({
    userId: 42,
    redirectUri: 'https://runsmart-ai.com/garmin/callback',
    codeVerifier: 'pkce-verifier',
  }))
)

const upsertGarminConnectionMock = vi.hoisted(() => vi.fn(async () => undefined))
const upsertGarminTokensMock = vi.hoisted(() => vi.fn(async () => undefined))
const enqueueGarminBackfillJobMock = vi.hoisted(() => vi.fn(async () => ({ id: 'job-1' })))
const getCurrentUserMock = vi.hoisted(() => vi.fn(async () => ({ id: 'auth-user-1' })))
const getCurrentProfileMock = vi.hoisted(() => vi.fn(async () => ({ id: 'profile-1' })))

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: unknown) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../oauth-state', () => ({
  verifyAndParseState: verifyAndParseStateMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: getCurrentUserMock,
  getCurrentProfile: getCurrentProfileMock,
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  upsertGarminConnection: upsertGarminConnectionMock,
  upsertGarminTokens: upsertGarminTokensMock,
}))

vi.mock('@/lib/integrations/garmin/service', () => ({
  enqueueGarminBackfillJob: enqueueGarminBackfillJobMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/callback', () => {
  beforeEach(() => {
    process.env.GARMIN_CLIENT_ID = 'garmin-client-id'
    process.env.GARMIN_CLIENT_SECRET = 'garmin-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    upsertGarminConnectionMock.mockReset()
    upsertGarminTokensMock.mockReset()
    enqueueGarminBackfillJobMock.mockReset()
    getCurrentUserMock.mockReset()
    getCurrentProfileMock.mockReset()
    getCurrentUserMock.mockResolvedValue({ id: 'auth-user-1' })
    getCurrentProfileMock.mockResolvedValue({ id: 'profile-1' })
    verifyAndParseStateMock.mockReset()
    verifyAndParseStateMock.mockReturnValue({
      userId: 42,
      redirectUri: 'https://runsmart-ai.com/garmin/callback',
      codeVerifier: 'pkce-verifier',
    })
    delete process.env.GARMIN_CLIENT_ID
    delete process.env.GARMIN_CLIENT_SECRET
  })

  it('exchanges token, stores the connection, and queues the initial backfill', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'garmin-access-token',
            refresh_token: 'garmin-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code-123', state: 'state-123' }),
    })

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.device.connectionStatus).toBe('syncing')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(upsertGarminConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        authUserId: 'auth-user-1',
        profileId: 'profile-1',
        providerUserId: 'garmin-user-1',
        status: 'connected',
      })
    )
    expect(upsertGarminTokensMock).toHaveBeenCalledTimes(1)
    expect(enqueueGarminBackfillJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        profileId: 'profile-1',
        providerUserId: 'garmin-user-1',
      })
    )
  })

  it('keeps the Garmin connection successful when the optional backfill queue is unavailable', async () => {
    enqueueGarminBackfillJobMock.mockRejectedValueOnce(new Error('Redis not configured'))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'garmin-access-token',
            refresh_token: 'garmin-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code-123', state: 'state-123' }),
    })

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.warnings).toContain('Garmin connected. Initial sync queue was unavailable; use Sync Garmin to import data now.')
    expect(upsertGarminConnectionMock).toHaveBeenCalledTimes(1)
    expect(upsertGarminTokensMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to auth and profile IDs embedded in signed state when no session is available', async () => {
    getCurrentUserMock.mockResolvedValueOnce(null)
    getCurrentProfileMock.mockResolvedValueOnce(null)
    verifyAndParseStateMock.mockReturnValueOnce({
      userId: 42,
      authUserId: 'auth-from-state',
      profileId: 'profile-from-state',
      redirectUri: 'runsmart://garmin/connected',
      codeVerifier: 'pkce-verifier',
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'garmin-access-token',
            refresh_token: 'garmin-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'auth-code-123', state: 'state-123' }),
    })

    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(upsertGarminConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        authUserId: 'auth-from-state',
        profileId: 'profile-from-state',
      })
    )
    expect(upsertGarminTokensMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        authUserId: 'auth-from-state',
      })
    )
    expect(enqueueGarminBackfillJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        profileId: 'profile-from-state',
      })
    )
  })
})
