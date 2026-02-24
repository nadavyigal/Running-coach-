const getReadinessPayloadForUserMock = vi.hoisted(() =>
  vi.fn(async () => ({
    score: 78,
    state: 'ready',
    drivers: [{
      signal: 'sleep_score',
      impact: 'positive',
      value: 82,
      baseline: 76,
      contribution: 22.96,
      explanation: 'Sleep score is 82.',
    }],
    confidence: 'high',
    confidenceReason: 'Strong signal coverage with a fresh sync in the last 24 hours.',
    lastSyncAt: '2026-02-24T09:00:00.000Z',
    missingSignals: [],
    underRecovery: {
      flagged: false,
      triggerCount: 0,
      triggers: [],
      confidence: 'low',
      recommendation: 'No clear under-recovery signature detected right now.',
    },
    load: {
      acuteLoad7d: 320,
      chronicLoad28d: 305,
      acwr: 1.05,
    },
    baseline: {
      hrv: 58,
      resting_hr: 50,
      sleep_score: 76,
      stress: 39,
      body_battery: 62,
      sampleCount: 24,
    },
  }))
)

vi.mock('@/lib/garmin/metrics/readiness', () => ({
  getReadinessPayloadForUser: getReadinessPayloadForUserMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  })),
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: vi.fn(async () => null),
}))

async function loadRoute() {
  return import('@/app/api/garmin/metrics/readiness/route')
}

describe('/api/garmin/metrics/readiness', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    getReadinessPayloadForUserMock.mockClear()
  })

  it('returns deterministic readiness shape', async () => {
    const { GET } = await loadRoute()
    const req = new Request('http://localhost/api/garmin/metrics/readiness?userId=42', {
      method: 'GET',
      headers: { 'x-user-id': '42' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      score: 78,
      state: 'ready',
      confidence: 'high',
      confidenceReason: expect.any(String),
      lastSyncAt: '2026-02-24T09:00:00.000Z',
      missingSignals: [],
    })
    expect(Array.isArray(body.drivers)).toBe(true)
  })
})
