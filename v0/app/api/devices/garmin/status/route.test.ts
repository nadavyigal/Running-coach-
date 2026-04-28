import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getGarminOAuthStateMock = vi.hoisted(() => vi.fn())
const getGarminSyncStateMock = vi.hoisted(() => vi.fn())
const readGarminExportRowsMock = vi.hoisted(() => vi.fn())
const fetchPermissionsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
}))

vi.mock('@/lib/integrations/garmin/service', () => ({
  getGarminSyncState: getGarminSyncStateMock,
}))

vi.mock('@/lib/integrations/garmin/client', () => ({
  GarminClient: {
    forUser: vi.fn(async () => ({
      fetchPermissions: fetchPermissionsMock,
    })),
  },
}))

vi.mock('@/lib/server/garmin-export-store', () => ({
  lookbackStartIso: vi.fn(() => '2026-02-01T00:00:00.000Z'),
  readGarminExportRows: readGarminExportRowsMock,
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

describe('/api/devices/garmin/status', () => {
  beforeEach(() => {
    getGarminOAuthStateMock.mockReset()
    getGarminSyncStateMock.mockReset()
    readGarminExportRowsMock.mockReset()
    fetchPermissionsMock.mockReset()

    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      garminUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'],
    })
    getGarminSyncStateMock.mockResolvedValue({
      connected: true,
      connectionStatus: 'connected',
      syncState: 'connected',
      lastSyncAt: '2026-02-19T11:30:00.000Z',
      lastSuccessfulSyncAt: '2026-02-19T11:30:00.000Z',
      lastWebhookReceivedAt: '2026-02-19T11:45:00.000Z',
      pendingJobs: 2,
      lastSyncError: null,
      errorState: null,
    })
    readGarminExportRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      rows: [
        {
          datasetKey: 'activities',
          receivedAt: '2026-02-19T11:55:00.000Z',
          payload: { activityId: 'run-1' },
        },
        {
          datasetKey: 'dailies',
          receivedAt: '2026-02-19T11:40:00.000Z',
          payload: { summaryId: 'daily-1' },
        },
      ],
    })
    fetchPermissionsMock.mockResolvedValue(['ACTIVITY_EXPORT', 'HEALTH_EXPORT'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns canonical Garmin status fields and dataset summaries', async () => {
    const req = new Request('http://localhost/api/devices/garmin/status?userId=42', {
      headers: { 'x-user-id': '42' },
    })

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      connected: true,
      connectionStatus: 'connected',
      syncState: 'connected',
      needsReauth: false,
      lastSyncAt: '2026-02-19T11:30:00.000Z',
      lastSuccessfulSyncAt: '2026-02-19T11:30:00.000Z',
      lastDataReceivedAt: '2026-02-19T11:55:00.000Z',
      pendingJobs: 2,
      persistence: null,
      notices: [],
      error: null,
    })
    expect(body.datasetCounts.activities).toBe(1)
    expect(body.datasetCounts.dailies).toBe(1)
    expect(body.datasetCompleteness.missingDatasets).toContain('sleeps')
    expect(readGarminExportRowsMock).toHaveBeenCalledWith({
      garminUserId: 'garmin-user-1',
      sinceIso: '2026-02-01T00:00:00.000Z',
    })
  })

  it('surfaces reauth state consistently when Garmin connection is broken', async () => {
    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      garminUserId: null,
      scopes: [],
    })
    getGarminSyncStateMock.mockResolvedValue({
      connected: false,
      connectionStatus: 'reauth_required',
      syncState: 'reauth_required',
      lastSyncAt: '2026-02-19T11:00:00.000Z',
      lastSuccessfulSyncAt: null,
      lastWebhookReceivedAt: null,
      pendingJobs: 0,
      lastSyncError: 'Reconnect Garmin',
      errorState: { message: 'Reconnect Garmin' },
    })

    const req = new Request('http://localhost/api/devices/garmin/status?userId=42')

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.connected).toBe(false)
    expect(body.needsReauth).toBe(true)
    expect(body.error).toBe('Reconnect Garmin')
    expect(body.detail).toEqual({ message: 'Reconnect Garmin' })
    expect(readGarminExportRowsMock).not.toHaveBeenCalled()
  })

  it('uses live Garmin permissions when stored connection scopes are empty', async () => {
    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      garminUserId: 'garmin-user-1',
      scopes: [],
    })

    const req = new Request('http://localhost/api/devices/garmin/status?userId=42', {
      headers: { 'x-user-id': '42' },
    })

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(fetchPermissionsMock).toHaveBeenCalledTimes(1)
    expect(body.notices).not.toContain('Missing ACTIVITY_EXPORT permission.')
    expect(body.notices).not.toContain('Missing HEALTH_EXPORT permission.')
    expect(body.datasetCompleteness.missingDatasets).toContain('sleeps')
  })

  it('returns a reauth status instead of throwing when stored Garmin tokens cannot be read', async () => {
    getGarminOAuthStateMock.mockRejectedValueOnce(new Error('Garmin token is corrupted. Please reconnect Garmin.'))

    const req = new Request('http://localhost/api/devices/garmin/status?userId=42')

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.connected).toBe(false)
    expect(body.needsReauth).toBe(true)
    expect(body.connectionStatus).toBe('reauth_required')
    expect(body.error).toContain('Garmin token is corrupted')
    expect(readGarminExportRowsMock).not.toHaveBeenCalled()
  })
})
