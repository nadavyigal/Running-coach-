const generateSignedStateMock = vi.hoisted(() => vi.fn(() => 'signed-state'))
const generateCodeVerifierMock = vi.hoisted(() => vi.fn(() => 'pkce-verifier'))
const generateCodeChallengeMock = vi.hoisted(() => vi.fn(async () => 'pkce-challenge'))

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('../oauth-state', () => ({
  generateSignedState: generateSignedStateMock,
  generateCodeVerifier: generateCodeVerifierMock,
  generateCodeChallenge: generateCodeChallengeMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/connect', () => {
  beforeEach(() => {
    process.env.GARMIN_CLIENT_ID = 'garmin-client-id'
    process.env.GARMIN_OAUTH_REDIRECT_URI = 'https://runsmart-ai.com/garmin/callback'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.GARMIN_CLIENT_ID
    delete process.env.GARMIN_OAUTH_REDIRECT_URI
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
})
