import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

describe('/api/devices/garmin/sync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns catalog of Garmin enablement and dataset capabilities', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ permissions: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT'] }),
            { status: 200 }
          )
        )
      }

      if (parsed.pathname.endsWith('/wellness-api/rest/activities')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }

      if (parsed.pathname.endsWith('/wellness-api/rest/sleeps')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 404,
            error: 'Not Found',
            path: parsed.pathname,
          }),
          { status: 404 }
        )
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      headers: { authorization: 'Bearer test-token' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.syncName).toBe('RunSmart Garmin Export Sync')
    expect(Array.isArray(body.availableToEnable)).toBe(true)

    const capabilities = Object.fromEntries(
      (body.capabilities as Array<{ key: string; enabledForSync: boolean; supportedByRunSmart: boolean }>).map(
        (entry) => [entry.key, entry]
      )
    )

    expect(capabilities.activities.enabledForSync).toBe(true)
    expect(capabilities.sleeps.enabledForSync).toBe(true)
    expect(capabilities.workoutImport.supportedByRunSmart).toBe(false)

    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(10)

    const activitiesCall = fetchMock.mock.calls.find(([callUrl]) =>
      String(callUrl).includes('/wellness-api/rest/activities?')
    )
    expect(activitiesCall).toBeDefined()

    const activitiesUrl = new URL(String(activitiesCall?.[0]))
    const start = Number(activitiesUrl.searchParams.get('uploadStartTimeInSeconds'))
    const end = Number(activitiesUrl.searchParams.get('uploadEndTimeInSeconds'))
    expect(end - start).toBeLessThanOrEqual(86399)
  })

  it('syncs enabled datasets and skips unavailable datasets with notices', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const parsed = new URL(String(url))

      if (parsed.pathname.endsWith('/wellness-api/rest/user/permissions')) {
        return Promise.resolve(new Response(JSON.stringify({ permissions: ['ACTIVITY_EXPORT'] }), { status: 200 }))
      }

      if (parsed.pathname.endsWith('/wellness-api/rest/activities')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                activityId: 'run-1',
                activityType: 'running',
                startTimeInSeconds: 1771498800,
                durationInSeconds: 1800,
                distanceInMeters: 5000,
              },
              {
                activityId: 'ride-1',
                activityType: 'cycling',
                startTimeInSeconds: 1771499800,
                durationInSeconds: 1800,
                distanceInMeters: 10000,
              },
            ]),
            { status: 200 }
          )
        )
      }

      if (parsed.pathname.endsWith('/wellness-api/rest/manuallyUpdatedActivities')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                activityId: 'run-1',
                activityType: 'running',
                startTimeInSeconds: 1771498800,
                durationInSeconds: 1800,
                distanceInMeters: 5000,
              },
            ]),
            { status: 200 }
          )
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 404,
            error: 'Not Found',
            path: parsed.pathname,
          }),
          { status: 404 }
        )
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.activities).toHaveLength(1)
    expect(body.activities[0].activityId).toBe('run-1')
    expect(body.sleep).toHaveLength(0)
    expect(body.datasetCounts.activities).toBe(2)
    expect(body.datasetCounts.manuallyUpdatedActivities).toBe(1)
    expect(body.datasetCounts.sleeps).toBe(0)
    expect(body.notices.some((notice: string) => notice.includes('Sleeps sync skipped'))).toBe(true)

    const capabilities = Object.fromEntries(
      (body.capabilities as Array<{ key: string; enabledForSync: boolean; reason?: string }>).map((entry) => [
        entry.key,
        entry,
      ])
    )

    expect(capabilities.activities.enabledForSync).toBe(true)
    expect(capabilities.sleeps.enabledForSync).toBe(false)
    expect(String(capabilities.sleeps.reason)).toContain('Missing HEALTH_EXPORT permission')
  })

  it('returns needsReauth when Garmin token is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
      })
    )

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer bad-token' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.needsReauth).toBe(true)
  })
})