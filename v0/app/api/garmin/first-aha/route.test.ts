import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserMock = vi.hoisted(() => vi.fn())
const getGarminOAuthStateMock = vi.hoisted(() => vi.fn())
const generateGarminFirstAhaMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
}))

vi.mock('@/lib/server/garmin-first-aha-service', () => ({
  generateGarminFirstAha: generateGarminFirstAhaMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('GET /api/garmin/first-aha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated users', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { GET } = await loadRoute()
    const res = await GET(new Request('http://localhost/api/garmin/first-aha?userId=1'))

    expect(res.status).toBe(401)
  })

  it('returns stable response shape for authenticated users', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-1' } }, error: null })
    getGarminOAuthStateMock.mockResolvedValueOnce({ authUserId: 'auth-1', profileId: 10 })
    generateGarminFirstAhaMock.mockResolvedValueOnce({
      status: 'partial',
      generatedAt: '2026-06-30T12:00:00.000Z',
      dataWindow: { activitiesDays: 28 },
      profile: {
        runnerType: 'Building consistency',
        headline: 'Building consistency based on your recent Garmin runs',
        summaryBullets: ['2 runs in the last 14 days'],
        confidence: 'medium',
      },
      signals: {
        consistency: { runsLast14Days: 1, runsLast28Days: 2, weeklyPatternLabel: 'Low' },
        load: { acwrLabel: 'stable' },
        intensity: { label: 'Mixed', source: 'insufficient' },
      },
      guardrails: { level: 'green', message: 'Stable', reasons: [] },
      starterPlan: { title: '14-day block', rationale: 'Easy', days: [] },
      recommendedChallenge: {
        id: 'start-running',
        title: 'Start Running',
        reason: 'Fit',
        fitScoreLabel: 'Good fit',
      },
      disclaimers: [],
    })

    const { GET } = await loadRoute()
    const res = await GET(
      new Request('http://localhost/api/garmin/first-aha?userId=1', {
        headers: { 'x-user-id': '1' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('partial')
    expect(body.profile.runnerType).toBeTruthy()
    expect(body.recommendedChallenge.id).toBe('start-running')
  })

  it('returns insufficient_data without 500 for empty history', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-1' } }, error: null })
    getGarminOAuthStateMock.mockResolvedValueOnce({ authUserId: 'auth-1', profileId: 10 })
    generateGarminFirstAhaMock.mockResolvedValueOnce({
      status: 'insufficient_data',
      generatedAt: '2026-06-30T12:00:00.000Z',
      dataWindow: { activitiesDays: 28 },
      profile: {
        runnerType: 'Getting started',
        headline: 'Getting started',
        summaryBullets: [],
        confidence: 'low',
      },
      signals: {
        consistency: { runsLast14Days: 0, runsLast28Days: 0, weeklyPatternLabel: 'None' },
        load: { acwrLabel: 'unknown' },
        intensity: { label: 'No data', source: 'insufficient' },
      },
      guardrails: { level: 'yellow', message: 'Limited data', reasons: [] },
      starterPlan: { title: 'Starter', rationale: 'Conservative', days: [] },
      recommendedChallenge: {
        id: 'start-running',
        title: 'Start Running',
        reason: 'Safe start',
        fitScoreLabel: 'Good fit',
      },
      disclaimers: [],
    })

    const { GET } = await loadRoute()
    const res = await GET(new Request('http://localhost/api/garmin/first-aha?userId=1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('insufficient_data')
  })
})
