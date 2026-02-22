const verifyAndParseStateMock = vi.hoisted(() =>
  vi.fn(() => ({
    userId: 42,
    redirectUri: 'https://runsmart-ai.com/garmin/callback',
    codeVerifier: 'pkce-verifier',
  }))
)

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: any) => handler,
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
  getCurrentUser: vi.fn(async () => null),
}))

const upsertGarminConnectionMock = vi.hoisted(() => vi.fn(async () => undefined))
const upsertGarminTokensMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  upsertGarminConnection: upsertGarminConnectionMock,
  upsertGarminTokens: upsertGarminTokensMock,
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
    delete process.env.GARMIN_CLIENT_ID
    delete process.env.GARMIN_CLIENT_SECRET
  })

  it('exchanges token with client_secret in request body and no Basic auth header', async () => {
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

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(upsertGarminConnectionMock).toHaveBeenCalledTimes(1)
    expect(upsertGarminTokensMock).toHaveBeenCalledTimes(1)

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(tokenUrl).toBe('https://diauth.garmin.com/di-oauth2-service/oauth/token')
    expect(tokenInit.method).toBe('POST')

    const tokenHeaders = tokenInit.headers as Record<string, string>
    expect(tokenHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(tokenHeaders['Authorization']).toBeUndefined()

    const encodedBody = String(tokenInit.body ?? '')
    expect(encodedBody).toContain('grant_type=authorization_code')
    expect(encodedBody).toContain('client_id=garmin-client-id')
    expect(encodedBody).toContain('client_secret=garmin-client-secret')
    expect(encodedBody).toContain('code_verifier=pkce-verifier')
  })
})
