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

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: unknown) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../oauth-state', () => ({
  verifyAndParseState: verifyAndParseStateMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'auth-user-1' })),
  getCurrentProfile: vi.fn(async () => ({ id: 'profile-1' })),
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
})
