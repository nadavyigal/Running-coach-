const revokeGarminConnectionMock = vi.hoisted(() =>
  vi.fn(async () => ({ revokedUpstream: true, hadStoredTokens: true }))
)

vi.mock('@/lib/security.middleware', () => ({
  withApiSecurity: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  revokeGarminConnection: revokeGarminConnectionMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/disconnect', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    revokeGarminConnectionMock.mockClear()
  })

  it('revokes Garmin connection for valid user', async () => {
    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/disconnect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': '42' },
      body: JSON.stringify({ userId: 42 }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.revokedUpstream).toBe(true)
    expect(revokeGarminConnectionMock).toHaveBeenCalledWith(42)
  })

  it('rejects user mismatch', async () => {
    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/disconnect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': '99' },
      body: JSON.stringify({ userId: 42 }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(revokeGarminConnectionMock).not.toHaveBeenCalled()
  })
})
