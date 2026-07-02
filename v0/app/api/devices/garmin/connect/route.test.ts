const generateSignedStateMock = vi.hoisted(() => vi.fn(() => 'signed-state'))
const generateCodeVerifierMock = vi.hoisted(() => vi.fn(() => 'pkce-verifier'))
const generateCodeChallengeMock = vi.hoisted(() => vi.fn(async () => 'pkce-challenge'))
const resolveGarminOAuthClientIdMock = vi.hoisted(() =>
  vi.fn(() => ({ clientId: 'garmin-client-id', mode: 'commercial' }))
)

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../oauth-state', () => ({
  generateSignedState: generateSignedStateMock,
  generateCodeVerifier: generateCodeVerifierMock,
  generateCodeChallenge: generateCodeChallengeMock,
}))

vi.mock('@/lib/server/garmin-credentials', () => ({
  resolveGarminOAuthClientId: resolveGarminOAuthClientIdMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/connect', () => {
  beforeEach(() => {
    process.env.GARMIN_OAUTH_REDIRECT_URI = 'https://runsmart-ai.com/garmin/callback'
    resolveGarminOAuthClientIdMock.mockReturnValue({ clientId: 'garmin-client-id', mode: 'commercial' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    generateSignedStateMock.mockClear()
    generateCodeVerifierMock.mockClear()
    generateCodeChallengeMock.mockClear()
    resolveGarminOAuthClientIdMock.mockReset()
    delete process.env.GARMIN_OAUTH_REDIRECT_URI
    delete process.env.GARMIN_CONNECT_ENABLED
  })

  it('builds Garmin OAuth URL without scope parameter', async () => {
    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/devices/garmin/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 42 }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(typeof body.authUrl).toBe('string')

    const authUrl = new URL(body.authUrl)
    expect(authUrl.origin).toBe('https://connect.garmin.com')
    expect(authUrl.searchParams.get('client_id')).toBe('garmin-client-id')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://runsmart-ai.com/garmin/callback')
    expect(authUrl.searchParams.get('state')).toBe('signed-state')
    expect(authUrl.searchParams.get('code_challenge')).toBe('pkce-challenge')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('scope')).toBeNull()
  })

  it('prefers a request redirect URI and carries auth/profile IDs in signed state', async () => {
    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/devices/garmin/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 42,
        authUserId: ' auth-user-1 ',
        profileId: ' profile-1 ',
        redirectUri: 'https://preview.runsmart-ai.com/garmin/callback',
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()
    const authUrl = new URL(body.authUrl)

    expect(res.status).toBe(200)
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://preview.runsmart-ai.com/garmin/callback')
    expect(generateSignedStateMock).toHaveBeenCalledWith(
      42,
      'https://preview.runsmart-ai.com/garmin/callback',
      'pkce-verifier',
      'auth-user-1',
      'profile-1'
    )
  })

  it('allows the native app custom scheme as the OAuth redirect URI', async () => {
    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/devices/garmin/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 42,
        authUserId: 'auth-user-1',
        profileId: 'profile-1',
        redirectUri: 'runsmart://garmin/connected',
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()
    const authUrl = new URL(body.authUrl)

    expect(res.status).toBe(200)
    expect(authUrl.searchParams.get('redirect_uri')).toBe('runsmart://garmin/connected')
  })

  it('fails closed when Garmin credentials are not allowed', async () => {
    resolveGarminOAuthClientIdMock.mockImplementationOnce(() => {
      throw new Error('Production Garmin OAuth cannot use internal-test credentials')
    })

    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/devices/garmin/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 42 }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Service configuration error')
  })

  it('blocks new OAuth connections when Garmin connect is disabled', async () => {
    process.env.GARMIN_CONNECT_ENABLED = 'false'

    const { POST } = await loadRoute()

    const req = new Request('http://localhost/api/devices/garmin/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 42 }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error).toBe(
      "Garmin sync is temporarily unavailable while we complete Garmin production approval. Existing activity data remains in RunSmart. We'll notify you when reconnection is available."
    )
    expect(resolveGarminOAuthClientIdMock).not.toHaveBeenCalled()
    expect(generateSignedStateMock).not.toHaveBeenCalled()
  })
})
