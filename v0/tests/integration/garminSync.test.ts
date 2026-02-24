const syncGarminUserMock = vi.hoisted(() => {
  let callCount = 0
  return vi.fn(async () => {
    callCount += 1
    if (callCount === 1) {
      return {
        status: 200,
        connected: true,
        lastSyncAt: '2026-02-24T10:00:00.000Z',
        errorState: null,
        noOp: false,
        activitiesUpserted: 2,
        dailyMetricsUpserted: 1,
        body: { success: true },
      }
    }

    return {
      status: 200,
      connected: true,
      lastSyncAt: '2026-02-24T10:05:00.000Z',
      errorState: null,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      body: { success: true },
    }
  })
})

vi.mock('@/lib/garmin/sync/syncUser', () => ({
  syncGarminUser: syncGarminUserMock,
}))

async function loadRoute() {
  return import('@/app/api/garmin/sync/route')
}

describe('/api/garmin/sync', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns no-op on second sync run', async () => {
    const { POST } = await loadRoute()

    const firstReq = new Request('http://localhost/api/garmin/sync?userId=42', {
      method: 'POST',
      headers: {
        'x-user-id': '42',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'manual' }),
    })
    const firstRes = await POST(firstReq)
    const firstBody = await firstRes.json()

    const secondReq = new Request('http://localhost/api/garmin/sync?userId=42', {
      method: 'POST',
      headers: {
        'x-user-id': '42',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'manual' }),
    })
    const secondRes = await POST(secondReq)
    const secondBody = await secondRes.json()

    expect(firstRes.status).toBe(200)
    expect(firstBody.noOp).toBe(false)
    expect(firstBody.activitiesUpserted).toBe(2)

    expect(secondRes.status).toBe(200)
    expect(secondBody.noOp).toBe(true)
    expect(secondBody.activitiesUpserted).toBe(0)
    expect(secondBody.dailyMetricsUpserted).toBe(0)
  })
})

