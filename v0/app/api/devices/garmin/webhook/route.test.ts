import { afterEach, describe, expect, it, vi } from 'vitest'

const storeRowsMock = vi.hoisted(() => vi.fn())
const findRunSmartUserIdsByGarminUserIdMock = vi.hoisted(() => vi.fn(async () => [42]))
const enqueueGarminDeriveJobMock = vi.hoisted(() =>
  vi.fn(async () => ({ queued: true, jobId: 'derive-job-1' }))
)

vi.mock('@/lib/server/garmin-export-store', () => ({
  storeGarminExportRows: storeRowsMock,
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  findRunSmartUserIdsByGarminUserId: findRunSmartUserIdsByGarminUserIdMock,
}))

vi.mock('@/lib/server/garmin-sync-queue', () => ({
  enqueueGarminDeriveJob: enqueueGarminDeriveJobMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/webhook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    storeRowsMock.mockReset()
    findRunSmartUserIdsByGarminUserIdMock.mockReset()
    enqueueGarminDeriveJobMock.mockReset()
    delete process.env.GARMIN_WEBHOOK_SECRET
  })

  it('requires webhook secret configuration', async () => {
    const req = new Request('http://localhost/api/devices/garmin/webhook')
    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
  })

  it('processes ping/pull callback payload and stores pulled rows', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    storeRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      storedRows: 1,
      droppedRows: 0,
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            userId: 'garmin-user-1',
            activityId: 'run-1',
            activityType: 'running',
            startTimeInSeconds: 1771400000,
            durationInSeconds: 1800,
            distanceInMeters: 5000,
          },
        ]),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activities: [
          {
            userId: 'garmin-user-1',
            callbackURL: 'https://example.test/callback/activities',
          },
        ],
      }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.acceptedRows).toBe(1)
    expect(storeRowsMock).toHaveBeenCalledWith({
      datasetKey: 'activities',
      rows: [
        {
          userId: 'garmin-user-1',
          activityId: 'run-1',
          activityType: 'running',
          startTimeInSeconds: 1771400000,
          durationInSeconds: 1800,
          distanceInMeters: 5000,
        },
      ],
      source: 'ping_pull',
      fallbackGarminUserId: 'garmin-user-1',
    })
    expect(enqueueGarminDeriveJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        garminUserId: 'garmin-user-1',
        datasetKey: 'activities',
        source: 'webhook',
      })
    )
    expect(body.deriveQueue.queued).toBeGreaterThan(0)
  })

  it('processes push payload without callbackURL', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    storeRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      storedRows: 1,
      droppedRows: 0,
    })

    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sleeps: [
          {
            userId: 'garmin-user-1',
            calendarDate: '2026-02-18',
            durationInSeconds: 25200,
          },
        ],
      }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.acceptedRows).toBe(1)
    expect(storeRowsMock).toHaveBeenCalledWith({
      datasetKey: 'sleeps',
      rows: [
        {
          userId: 'garmin-user-1',
          calendarDate: '2026-02-18',
          durationInSeconds: 25200,
        },
      ],
      source: 'push',
      fallbackGarminUserId: 'garmin-user-1',
    })
  })

  it('rejects unauthorized requests when webhook secret is configured', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'

    const req = new Request('http://localhost/api/devices/garmin/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activities: [] }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(storeRowsMock).not.toHaveBeenCalled()
  })

  it('accepts requests when webhook secret is provided via query parameter', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    storeRowsMock.mockResolvedValue({
      ok: true,
      storeAvailable: true,
      storedRows: 1,
      droppedRows: 0,
    })

    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activities: [
          {
            userId: 'garmin-user-1',
            activityId: 'run-1',
            activityType: 'running',
          },
        ],
      }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(storeRowsMock).toHaveBeenCalledTimes(1)
  })
})

