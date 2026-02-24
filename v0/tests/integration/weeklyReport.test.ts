const fetchLatestInsightMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 11,
    type: 'weekly',
    period_start: '2026-02-18',
    period_end: '2026-02-24',
    insight_markdown: '## Load\n- Weekly volume looked stable.',
    confidence: 0.8,
    created_at: '2026-02-24T09:30:00.000Z',
    evidence_json: {},
  }))
)

const generateInsightForUserMock = vi.hoisted(() =>
  vi.fn(async () => ({
    userId: 42,
    type: 'weekly',
    periodStart: '2026-02-18',
    periodEnd: '2026-02-24',
    insightMarkdown: '## Load\n- Weekly volume looked stable.',
    confidenceScore: 0.8,
    confidenceLabel: 'medium',
    evidence: {},
  }))
)

const persistGeneratedInsightMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/server/garmin-insights-service', () => ({
  fetchLatestInsight: fetchLatestInsightMock,
  generateInsightForUser: generateInsightForUserMock,
  persistGeneratedInsight: persistGeneratedInsightMock,
  buildInsightSummaryForUser: vi.fn(async () => null),
}))

async function loadRoute() {
  return import('@/app/api/garmin/reports/weekly/route')
}

describe('/api/garmin/reports/weekly', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    fetchLatestInsightMock.mockClear()
    generateInsightForUserMock.mockClear()
    persistGeneratedInsightMock.mockClear()
  })

  it('POST generates and GET returns latest weekly report', async () => {
    const { GET, POST } = await loadRoute()

    const postReq = new Request('http://localhost/api/garmin/reports/weekly', {
      method: 'POST',
      headers: {
        'x-user-id': '42',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: 42 }),
    })

    const postRes = await POST(postReq)
    const postBody = await postRes.json()

    expect(postRes.status).toBe(200)
    expect(postBody.report).toBeTruthy()

    const getReq = new Request('http://localhost/api/garmin/reports/weekly?userId=42', {
      method: 'GET',
      headers: { 'x-user-id': '42' },
    })

    const getRes = await GET(getReq)
    const getBody = await getRes.json()

    expect(getRes.status).toBe(200)
    expect(getBody).toMatchObject({
      found: true,
      report: {
        type: 'weekly',
        confidence: expect.any(String),
      },
    })
  })
})
