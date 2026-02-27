import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readRowsMock = vi.hoisted(() => vi.fn())
const lookbackStartIsoMock = vi.hoisted(() => vi.fn(() => '2026-01-20T00:00:00.000Z'))
const getGarminOAuthStateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    userId: 42,
    authUserId: 'auth-user-1',
    garminUserId: 'garmin-user-1',
    scopes: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
    status: 'connected',
    connectedAt: '2026-01-01T00:00:00.000Z',
    lastSyncAt: null,
    lastSyncCursor: null,
    errorState: null,
    accessToken: 'server-access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-12-01T00:00:00.000Z',
  }))
)
const getValidGarminAccessTokenMock = vi.hoisted(() => vi.fn(async () => 'server-access-token'))
const refreshGarminAccessTokenMock = vi.hoisted(() => vi.fn(async () => ({ accessToken: 'refreshed-token' })))
const markGarminAuthErrorMock = vi.hoisted(() => vi.fn(async () => undefined))
const markGarminSyncStateMock = vi.hoisted(() => vi.fn(async () => undefined))
const persistGarminSyncSnapshotMock = vi.hoisted(() =>
  vi.fn(async () => ({ activitiesUpserted: 0, dailyMetricsUpserted: 0 }))
)
const runGarminDeriveForPayloadMock = vi.hoisted(() =>
  vi.fn(async () => ({ processedUsers: 1, skippedUsers: 0, summaries: [] }))
)
const enqueueGarminDeriveJobMock = vi.hoisted(() =>
  vi.fn(async () => ({ queued: true, jobId: 'derive-job-1' }))
)
const captureServerEventMock = vi.hoisted(() => vi.fn(async () => undefined))
const createAdminClientMock = vi.hoisted(() => vi.fn())

// garmin-rate-limiter has no server-only import — use the real synchronous implementation.
// Fake timers (vi.useFakeTimers) make new Date() deterministic so rate-limit logic is testable.

vi.mock('@/lib/server/posthog', () => ({
  captureServerEvent: captureServerEventMock,
}))

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

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
  getValidGarminAccessToken: getValidGarminAccessTokenMock,
  refreshGarminAccessToken: refreshGarminAccessTokenMock,
  markGarminAuthError: markGarminAuthErrorMock,
  markGarminSyncState: markGarminSyncStateMock,
}))

vi.mock('@/lib/server/garmin-analytics-store', () => ({
  persistGarminSyncSnapshot: persistGarminSyncSnapshotMock,
}))

vi.mock('@/lib/server/garmin-derive-worker', () => ({
  runGarminDeriveForPayload: runGarminDeriveForPayloadMock,
}))

vi.mock('@/lib/server/garmin-sync-queue', () => ({
  enqueueGarminDeriveJob: enqueueGarminDeriveJobMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
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
    getGarminOAuthStateMock.mockClear()
    getValidGarminAccessTokenMock.mockClear()
    refreshGarminAccessTokenMock.mockClear()
    markGarminAuthErrorMock.mockClear()
    markGarminSyncStateMock.mockClear()
    persistGarminSyncSnapshotMock.mockClear()
    runGarminDeriveForPayloadMock.mockClear()
    enqueueGarminDeriveJobMock.mockClear()
    captureServerEventMock.mockClear()
    createAdminClientMock.mockClear()

    const adminQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: [], error: null })),
    }
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => adminQueryBuilder),
    })

    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      authUserId: 'auth-user-1',
      garminUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
      status: 'connected',
      connectedAt: '2026-01-01T00:00:00.000Z',
      lastSyncAt: null,
      lastSyncCursor: null,
      errorState: null,
      accessToken: 'server-access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-01T00:00:00.000Z',
    })
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
      headers: { 'x-user-id': '42' },
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
          datasetKey: 'activityDetails',
          summaryId: 'a3',
          source: 'ping_pull',
          recordedAt: '2026-02-18T11:00:00.000Z',
          receivedAt: '2026-02-18T11:01:00.000Z',
          payload: {
            activityId: 'run-2',
            activityTypeDTO: { typeKey: 'running' },
            startTimeInSeconds: 1771403600,
            durationInSeconds: 1500,
            distanceInMeters: 4200,
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
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(2)
    expect(body.activities.map((activity: { activityId: string }) => activity.activityId)).toEqual(
      expect.arrayContaining(['run-1', 'run-2'])
    )
    expect(body.sleep).toHaveLength(1)
    expect(body.datasetCounts.activities).toBe(1)
    expect(body.datasetCounts.manuallyUpdatedActivities).toBe(1)
    expect(body.datasetCounts.activityDetails).toBe(1)
    expect(body.datasetCounts.sleeps).toBe(1)
    expect(body.notices.some((notice: string) => notice.includes('No Garmin export records'))).toBe(false)
    expect(body.deriveQueue.queued).toBe(true)
    expect(enqueueGarminDeriveJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        source: 'sync',
        datasetKey: 'post-sync',
      })
    )
    expect(markGarminSyncStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        lastSyncCursor: '2026-02-19T12:00:00.000Z',
        lastSyncAt: '2026-02-19T12:00:00.000Z',
      })
    )
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
      headers: { 'x-user-id': '42' },
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

  it('runs inline derive fallback when Redis queue is unavailable', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })
    enqueueGarminDeriveJobMock.mockResolvedValue({
      queued: false,
      jobId: null,
      reason: 'Garmin derive queue unavailable (Redis not configured)',
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      return Promise.resolve(new Response('not-found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deriveQueue.queued).toBe(false)
    expect(body.deriveQueue.reason).toContain('Redis not configured')
    expect(body.deriveQueue.inlineFallback).toMatchObject({
      executed: true,
      failed: false,
      processedUsers: 1,
      skippedUsers: 0,
    })
    expect(
      body.notices.some((notice: string) => notice.includes('Garmin derive queue unavailable'))
    ).toBe(false)
    expect(runGarminDeriveForPayloadMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to direct Garmin activity pull when webhook activity rows are empty', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(
          new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HISTORICAL_DATA_EXPORT']), { status: 200 })
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/activities')) {
        return Promise.resolve(
          new Response(JSON.stringify({ errorMessage: 'InvalidPullTokenException failure' }), { status: 400 })
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/backfill/activities')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                activityId: 'fallback-run-1',
                activityType: 'running',
                startTimeInSeconds: 1771400000,
                durationInSeconds: 1900,
                distanceInMeters: 5100,
              },
            ]),
            { status: 200 }
          )
        )
      }

      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(1)
    expect(body.activities[0].activityId).toBe('fallback-run-1')
    expect(
      body.notices.some((notice: string) =>
        notice.includes('RunSmart pulled 1 activities directly from Garmin wellness-backfill')
      )
    ).toBe(true)
  })

  it('falls back to direct Garmin sleep pull when webhook sleep rows are empty', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify(['HEALTH_EXPORT']), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/sleeps')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                sleepSummaryId: 'sleep-fallback-1',
                calendarDate: '2026-02-18',
                startTimeInSeconds: 1771372800,
                durationInSeconds: 25200,
              },
            ]),
            { status: 200 }
          )
        )
      }

      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.sleep).toHaveLength(1)
    expect(body.datasetCompleteness.usedFallbackDatasets).toContain('sleeps')
    expect(body.datasetCompleteness.missingDatasets).not.toContain('sleeps')
    expect(
      body.notices.some((notice: string) =>
        notice.includes('RunSmart pulled 1 sleep summaries directly from Garmin sleep-upload')
      )
    ).toBe(true)
  })

  it('falls back to direct Garmin dailies pull when webhook dailies rows are empty', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify(['HEALTH_EXPORT']), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/dailies')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                summaryId: 'daily-fallback-1',
                calendarDate: '2026-02-18',
                bodyBatteryChargedValue: 62,
                bodyBatteryDrainedValue: 47,
              },
            ]),
            { status: 200 }
          )
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/sleeps')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }

      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.datasets.dailies).toHaveLength(1)
    expect(body.datasetCompleteness.usedFallbackDatasets).toContain('dailies')
    expect(body.datasetCompleteness.missingDatasets).not.toContain('dailies')
    expect(
      body.notices.some((notice: string) =>
        notice.includes('RunSmart pulled 1 daily summaries directly from Garmin dailies-upload')
      )
    ).toBe(true)
  })

  it('imports cached garmin_activities rows when webhook and direct pull are unavailable', async () => {
    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const adminQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({
        data: [
          {
            activity_id: 'cached-run-1',
            start_time: '2026-02-18T10:00:00.000Z',
            sport: 'running',
            duration_s: 2100,
            distance_m: 6200,
            avg_hr: 152,
            max_hr: 171,
            avg_pace: 339,
            elevation_gain_m: 45,
            calories: 490,
            raw_json: {
              activityName: 'Morning Run',
            },
          },
        ],
        error: null,
      })),
    }
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => adminQueryBuilder),
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(
          new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HISTORICAL_DATA_EXPORT']), { status: 200 })
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/activities')) {
        return Promise.resolve(
          new Response(JSON.stringify({ errorMessage: 'InvalidPullTokenException failure' }), { status: 400 })
        )
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/backfill/activities')) {
        return Promise.resolve(
          new Response(JSON.stringify({ errorMessage: 'Endpoint not enabled for summary type: CONNECT_ACTIVITY' }), { status: 409 })
        )
      }

      return Promise.resolve(new Response('not-found', { status: 404 }))
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(1)
    expect(body.activities[0].activityId).toBe('cached-run-1')
    expect(body.activities[0].distance).toBe(6.2)
    expect(
      body.notices.some((notice: string) =>
        notice.includes('Webhook feeds were empty, so RunSmart imported 1 cached Garmin activities')
      )
    ).toBe(true)
    expect(
      body.notices.some((notice: string) => notice.includes('direct Garmin pull failed'))
    ).toBe(false)
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
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.needsReauth).toBe(true)
  })

  it('advances cursor using stored last_sync_cursor for incremental pulls', async () => {
    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      authUserId: 'auth-user-1',
      garminUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
      status: 'connected',
      connectedAt: '2026-01-01T00:00:00.000Z',
      lastSyncAt: '2026-02-19T00:00:00.000Z',
      lastSyncCursor: '2026-02-18T08:00:00.000Z',
      errorState: null,
      accessToken: 'server-access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-01T00:00:00.000Z',
    })

    readRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [],
    })

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify(['ACTIVITY_EXPORT', 'HEALTH_EXPORT']), { status: 200 }))
      }
      if (parsed.pathname.endsWith('/wellness-api/rest/user/id')) {
        return Promise.resolve(new Response(JSON.stringify({ userId: 'garmin-user-1' }), { status: 200 }))
      }
      return Promise.resolve(new Response('not-found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(readRowsMock).toHaveBeenCalledWith({
      garminUserId: 'garmin-user-1',
      sinceIso: '2026-02-17T08:00:00.000Z',
    })
    expect(markGarminSyncStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        lastSyncCursor: '2026-02-19T12:00:00.000Z',
      })
    )
  })

  it('returns 429 when last sync was within 10 minutes', async () => {
    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      authUserId: 'auth-user-1',
      garminUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
      status: 'connected',
      connectedAt: '2026-01-01T00:00:00.000Z',
      lastSyncAt: '2026-02-19T11:55:00.000Z',
      lastSyncCursor: '2026-02-19T11:55:00.000Z',
      errorState: null,
      accessToken: 'server-access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-01T00:00:00.000Z',
    })

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.success).toBe(false)
    expect(body.reason).toBe('cooldown')
    expect(res.headers.get('Retry-After')).toBe('300')
  })
})
