import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readRowsMock = vi.hoisted(() => vi.fn())
const lookbackStartIsoMock = vi.hoisted(() => vi.fn(() => '2026-01-20T00:00:00.000Z'))

vi.mock('@/lib/server/garmin-export-store', () => ({
  GARMIN_HISTORY_DAYS: 30,
  lookbackStartIso: lookbackStartIsoMock,
  readGarminExportRows: readRowsMock,
  groupRowsByDataset: (rows: Array<{ datasetKey: string; payload: Record<string, unknown> }>) => {
    const grouped = {
      activities: [],
      manuallyUpdatedActivities: [],
      activityDetails: [],
      dailies: [],
      epochs: [],
      sleeps: [],
      bodyComps: [],
      stressDetails: [],
      userMetrics: [],
      pulseox: [],
      allDayRespiration: [],
      healthSnapshot: [],
      hrv: [],
      bloodPressures: [],
      skinTemp: [],
    } as Record<string, Record<string, unknown>[]>

    for (const row of rows ?? []) {
      if (row && row.datasetKey in grouped) {
        grouped[row.datasetKey].push(row.payload)
      }
    }

    return grouped
  },
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/sync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z'))
    readRowsMock.mockReset()
    lookbackStartIsoMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns catalog using Garmin permissions and stored export rows', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [
        {
          garminUserId: 'garmin-user-1',
          datasetKey: 'activities',
          summaryId: 'a1',
          source: 'ping_pull',
          recordedAt: '2026-02-18T10:00:00.000Z',
          receivedAt: '2026-02-18T10:01:00.000Z',
          payload: {
            activityId: 'a1',
            activityType: 'running',
            startTimeInSeconds: 1771400000,
            distanceInMeters: 5000,
            durationInSeconds: 1800,
          },
        },
        {
          garminUserId: 'garmin-user-1',
          datasetKey: 'sleeps',
          summaryId: 's1',
          source: 'ping_pull',
          recordedAt: '2026-02-18T00:00:00.000Z',
          receivedAt: '2026-02-18T09:00:00.000Z',
          payload: {
            calendarDate: '2026-02-18',
            startTimeInSeconds: 1771372800,
            durationInSeconds: 25200,
          },
        },
      ],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(
          new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT']), {
            status: 200,
          })
        )
      }

      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }

      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      headers: { authorization: 'Bearer test-token' },
    })

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.ingestion.lookbackDays).toBe(30)
    expect(body.ingestion.recordsInWindow).toBe(2)

    const capabilities = Object.fromEntries(
      (body.capabilities as Array<{ key: string; enabledForSync: boolean; reason?: string }>).map((entry) => [
        entry.key,
        entry,
      ])
    )

    expect(capabilities.activities.enabledForSync).toBe(true)
    expect(capabilities.sleeps.enabledForSync).toBe(true)
    expect(String(capabilities.pulseox.reason)).toContain('No Garmin export notifications')
    expect(capabilities.workoutImport.enabledForSync).toBe(false)

    expect(readRowsMock).toHaveBeenCalledWith({
      garminUserId: 'garmin-user-1',
      sinceIso: '2026-01-20T00:00:00.000Z',
    })
  })

  it('syncs mapped activities and sleep from stored Garmin export rows', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [
        {
          garminUserId: 'garmin-user-1',
          datasetKey: 'activities',
          summaryId: 'a1',
          source: 'ping_pull',
          recordedAt: '2026-02-18T10:00:00.000Z',
          receivedAt: '2026-02-18T10:01:00.000Z',
          payload: {
            activityId: 'run-1',
            activityType: 'running',
            startTimeInSeconds: 1771400000,
            durationInSeconds: 1800,
            distanceInMeters: 5000,
          },
        },
        {
          garminUserId: 'garmin-user-1',
          datasetKey: 'manuallyUpdatedActivities',
          summaryId: 'a2',
          source: 'ping_pull',
          recordedAt: '2026-02-18T10:00:00.000Z',
          receivedAt: '2026-02-18T10:02:00.000Z',
          payload: {
            activityId: 'run-1',
            activityType: 'running',
            startTimeInSeconds: 1771400000,
            durationInSeconds: 1800,
            distanceInMeters: 5000,
          },
        },
        {
          garminUserId: 'garmin-user-1',
          datasetKey: 'sleeps',
          summaryId: 's1',
          source: 'ping_pull',
          recordedAt: '2026-02-18T00:00:00.000Z',
          receivedAt: '2026-02-18T09:00:00.000Z',
          payload: {
            calendarDate: '2026-02-18',
            startTimeInSeconds: 1771372800,
            durationInSeconds: 25200,
          },
        },
      ],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(
          new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 })
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(1)
    expect(body.activities[0].activityId).toBe('run-1')
    expect(body.sleep).toHaveLength(1)
    expect(body.datasetCounts.activities).toBe(1)
    expect(body.datasetCounts.manuallyUpdatedActivities).toBe(1)
    expect(body.datasetCounts.sleeps).toBe(1)
    expect(body.notices.some((notice: string) => notice.includes('No Garmin export records'))).toBe(false)
  })

  it('returns notices when no Garmin export rows are available', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify(['ACTIVITY_EXPORT']), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(0)
    expect(body.sleep).toHaveLength(0)
    expect(body.notices.some((notice: string) => notice.includes('No Garmin export records'))).toBe(true)
    expect(body.notices.some((notice: string) => notice.includes('Health datasets skipped'))).toBe(true)
  })

  it('returns needsReauth when Garmin token is invalid', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
        })
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer bad-token' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.needsReauth).toBe(true)
  })
})
