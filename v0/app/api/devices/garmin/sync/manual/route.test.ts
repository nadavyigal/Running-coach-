import { describe, expect, it, vi } from 'vitest'

const syncGarminUserMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/garmin/sync/syncUser', () => ({
  syncGarminUser: syncGarminUserMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/sync/manual', () => {
  it('returns the canonical manual sync contract', async () => {
    syncGarminUserMock.mockResolvedValueOnce({
      status: 200,
      connected: true,
      connectionStatus: 'connected',
      syncState: 'connected',
      needsReauth: false,
      lastSyncAt: '2026-02-19T12:00:00.000Z',
      lastSuccessfulSyncAt: '2026-02-19T12:00:00.000Z',
      lastDataReceivedAt: '2026-02-19T11:58:00.000Z',
      pendingJobs: 1,
      datasetCounts: { activities: 2, dailies: 1 },
      datasetCompleteness: {
        missingDatasets: [],
        usedFallbackDatasets: ['dailies'],
      },
      persistence: {
        activitiesUpserted: 2,
        dailyMetricsUpserted: 1,
        duplicateActivitiesSkipped: 0,
        activityFilesProcessed: 0,
      },
      errorState: null,
      noOp: false,
      activitiesUpserted: 2,
      dailyMetricsUpserted: 1,
      duplicateActivitiesSkipped: 0,
      activityFilesProcessed: 0,
      warnings: ['Daily wellness came from fallback pull.'],
      error: null,
      reason: null,
      body: {
        success: true,
        syncState: 'connected',
      },
    })

    const req = new Request('http://localhost/api/devices/garmin/sync/manual?userId=42', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      connected: true,
      connectionStatus: 'connected',
      syncState: 'connected',
      needsReauth: false,
      lastSyncAt: '2026-02-19T12:00:00.000Z',
      lastSuccessfulSyncAt: '2026-02-19T12:00:00.000Z',
      lastDataReceivedAt: '2026-02-19T11:58:00.000Z',
      pendingJobs: 1,
      notices: ['Daily wellness came from fallback pull.'],
      persistence: {
        activitiesUpserted: 2,
        dailyMetricsUpserted: 1,
        duplicateActivitiesSkipped: 0,
        activityFilesProcessed: 0,
      },
      trigger: 'manual',
    })
    expect(body.datasetCompleteness.usedFallbackDatasets).toContain('dailies')
    expect(typeof body.triggeredAt).toBe('string')
    expect(syncGarminUserMock).toHaveBeenLastCalledWith({
      userId: 42,
      trigger: 'manual',
    })
  })

  it('passes backfill trigger through to the canonical sync worker', async () => {
    syncGarminUserMock.mockResolvedValueOnce({
      status: 200,
      connected: true,
      connectionStatus: 'connected',
      syncState: 'syncing',
      needsReauth: false,
      lastSyncAt: '2026-02-19T12:00:00.000Z',
      lastSuccessfulSyncAt: '2026-02-19T12:00:00.000Z',
      lastDataReceivedAt: '2026-02-19T11:58:00.000Z',
      pendingJobs: 12,
      datasetCounts: {},
      datasetCompleteness: {
        missingDatasets: [],
        usedFallbackDatasets: [],
      },
      persistence: {
        activitiesUpserted: 0,
        dailyMetricsUpserted: 0,
        duplicateActivitiesSkipped: 0,
        activityFilesProcessed: 0,
      },
      errorState: null,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      activityFilesProcessed: 0,
      warnings: [],
      error: null,
      reason: null,
      body: {
        success: true,
        syncState: 'syncing',
      },
    })

    const req = new Request('http://localhost/api/devices/garmin/sync/manual?userId=42&trigger=backfill', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
      body: JSON.stringify({ userId: 42, trigger: 'manual' }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.trigger).toBe('backfill')
    expect(syncGarminUserMock).toHaveBeenLastCalledWith({
      userId: 42,
      trigger: 'backfill',
    })
  })

  it('propagates needsReauth from sync execution', async () => {
    syncGarminUserMock.mockResolvedValueOnce({
      status: 401,
      connected: false,
      connectionStatus: 'reauth_required',
      syncState: 'reauth_required',
      needsReauth: true,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      lastDataReceivedAt: null,
      pendingJobs: 0,
      datasetCounts: {},
      datasetCompleteness: {
        missingDatasets: [],
        usedFallbackDatasets: [],
      },
      persistence: null,
      errorState: { message: 'Reconnect Garmin' },
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      activityFilesProcessed: 0,
      warnings: [],
      error: 'Reconnect Garmin',
      reason: 'reauth_required',
      body: {
        success: false,
        error: 'Reconnect Garmin',
      },
    })

    const req = new Request('http://localhost/api/devices/garmin/sync/manual?userId=42', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.connected).toBe(false)
    expect(body.needsReauth).toBe(true)
    expect(body.error).toBe('Reconnect Garmin')
  })
})
