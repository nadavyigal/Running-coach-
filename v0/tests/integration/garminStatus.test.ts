const getGarminConnectionStatusMock = vi.hoisted(() =>
  vi.fn(async () => ({
    connected: true,
    status: 'connected',
    lastSyncAt: '2026-02-24T10:00:00.000Z',
    lastSyncCursor: '2026-02-24T10:00:00.000Z',
    errorState: null,
  }))
)

vi.mock('@/lib/garmin/sync/syncUser', () => ({
  getGarminConnectionStatus: getGarminConnectionStatusMock,
}))

async function loadRoute() {
  return import('@/app/api/garmin/status/route')
}

describe('/api/garmin/status', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    getGarminConnectionStatusMock.mockClear()
  })

  it('returns connected/lastSyncAt/errorState shape', async () => {
    const { GET } = await loadRoute()
    const req = new Request('http://localhost/api/garmin/status?userId=42', {
      method: 'GET',
      headers: { 'x-user-id': '42' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      connected: true,
      lastSyncAt: '2026-02-24T10:00:00.000Z',
      errorState: null,
    })
  })
})

