const getGarminSyncStateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    connected: true,
    connectionStatus: 'connected',
    syncState: 'delayed',
    lastSyncAt: '2026-02-24T10:00:00.000Z',
    lastSuccessfulSyncAt: '2026-02-24T09:55:00.000Z',
    lastWebhookReceivedAt: '2026-02-24T10:30:00.000Z',
    pendingJobs: 2,
    lastSyncError: 'Garmin temporary outage',
    errorState: null,
  }))
)

vi.mock('@/lib/integrations/garmin/service', () => ({
  getGarminSyncState: getGarminSyncStateMock,
}))

async function loadRoute() {
  return import('@/app/api/garmin/status/route')
}

describe('/api/garmin/status', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    getGarminSyncStateMock.mockClear()
  })

  it('returns server-backed sync trust state fields', async () => {
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
      connectionStatus: 'connected',
      syncState: 'delayed',
      lastSyncAt: '2026-02-24T10:00:00.000Z',
      pendingJobs: 2,
      lastSyncError: 'Garmin temporary outage',
    })
  })
})
