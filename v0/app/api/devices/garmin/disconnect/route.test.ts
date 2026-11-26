const revokeGarminConnectionMock = vi.hoisted(() =>
  vi.fn(async () => ({ revokedUpstream: true, hadStoredTokens: true }))
)
const getGarminConnectionOwnerMock = vi.hoisted(() => vi.fn())
const requireApiUserMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  requireApiUser: requireApiUserMock,
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminConnectionOwner: getGarminConnectionOwnerMock,
  revokeGarminConnection: revokeGarminConnectionMock,
}))

async function loadRoute() {
  return import('./route')
}

function disconnectRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/devices/garmin/disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function disconnect(body: unknown, headers?: Record<string, string>) {
  const { POST } = await loadRoute()
  const res = await POST(disconnectRequest(body, headers) as any)
  return { status: res.status, body: await res.json() }
}

describe('/api/devices/garmin/disconnect', () => {
  beforeEach(() => {
    revokeGarminConnectionMock.mockClear()
    getGarminConnectionOwnerMock.mockReset()
    getGarminConnectionOwnerMock.mockResolvedValue({ authUserId: 'auth-owner' })
    requireApiUserMock.mockReset()
    requireApiUserMock.mockResolvedValue({ user: { id: 'auth-owner' } })
  })

  it('revokes the Garmin connection for its signed-in owner', async () => {
    const res = await disconnect({ userId: 42 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.revokedUpstream).toBe(true)
    expect(getGarminConnectionOwnerMock).toHaveBeenCalledWith(42)
    expect(revokeGarminConnectionMock).toHaveBeenCalledWith(42)
  })

  it('rejects a signed-out caller, even with a matching x-user-id header', async () => {
    requireApiUserMock.mockResolvedValue({ response: new Response(null, { status: 401 }) })

    const res = await disconnect({ userId: 42 }, { 'x-user-id': '42' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Sign in to disconnect Garmin.',
      code: 'AUTH_REQUIRED',
    })
    expect(getGarminConnectionOwnerMock).not.toHaveBeenCalled()
    expect(revokeGarminConnectionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['belongs to another account', { authUserId: 'auth-someone-else' }],
    ['has no linked account', { authUserId: null }],
    ['does not exist', null],
  ])('refuses when the connection %s', async (_label, owner) => {
    getGarminConnectionOwnerMock.mockResolvedValue(owner)

    const res = await disconnect({ userId: 42 }, { 'x-user-id': '42' })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(revokeGarminConnectionMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid userId', async () => {
    const res = await disconnect({ userId: '42' })

    expect(res.status).toBe(400)
    expect(revokeGarminConnectionMock).not.toHaveBeenCalled()
  })

  it('does not revoke when the owner lookup fails', async () => {
    getGarminConnectionOwnerMock.mockRejectedValue(new Error('database unavailable'))

    const res = await disconnect({ userId: 42 })

    expect(res.status).toBe(500)
    expect(revokeGarminConnectionMock).not.toHaveBeenCalled()
  })
})
