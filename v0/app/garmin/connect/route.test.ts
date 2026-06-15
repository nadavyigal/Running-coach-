import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateSignedStateMock = vi.hoisted(() => vi.fn(() => 'signed-state'))
const generateCodeVerifierMock = vi.hoisted(() => vi.fn(() => 'pkce-verifier'))
const generateCodeChallengeMock = vi.hoisted(() => vi.fn(async () => 'pkce-challenge'))
const getUserMock = vi.hoisted(() => vi.fn())
const fromMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  }),
}))

vi.mock('@/app/api/devices/garmin/oauth-state', () => ({
  generateSignedState: generateSignedStateMock,
  generateCodeVerifier: generateCodeVerifierMock,
  generateCodeChallenge: generateCodeChallengeMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/garmin/connect native gateway', () => {
  beforeEach(() => {
    process.env.GARMIN_CLIENT_ID = 'garmin-client-id'
    getUserMock.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { id: 42 },
            error: null,
          })),
        })),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    getUserMock.mockReset()
    fromMock.mockReset()
    generateSignedStateMock.mockClear()
    generateCodeVerifierMock.mockClear()
    generateCodeChallengeMock.mockClear()
    delete process.env.GARMIN_CLIENT_ID
  })

  it('redirects a valid native session token into Garmin OAuth with app callback state', async () => {
    const { GET } = await loadRoute()

    const res = await GET(new Request('https://runsmart-ai.com/garmin/connect?token=session-token') as never)
    const location = res.headers.get('location')
    expect(location).toBeTruthy()

    const authUrl = new URL(location as string)
    expect(res.status).toBe(307)
    expect(authUrl.origin).toBe('https://connect.garmin.com')
    expect(authUrl.searchParams.get('client_id')).toBe('garmin-client-id')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('runsmart://garmin/connected')
    expect(authUrl.searchParams.get('state')).toBe('signed-state')
    expect(authUrl.searchParams.get('code_challenge')).toBe('pkce-challenge')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(getUserMock).toHaveBeenCalledWith('session-token')
    expect(generateSignedStateMock).toHaveBeenCalledWith(
      42,
      'runsmart://garmin/connected',
      'pkce-verifier',
      'auth-user-1',
      '42'
    )
  })

  it('rejects a missing native session token', async () => {
    const { GET } = await loadRoute()

    const res = await GET(new Request('https://runsmart-ai.com/garmin/connect') as never)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })
})
