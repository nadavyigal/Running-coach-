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

  it('returns catalog of Garmin enablement and current capability status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ permissions: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT'] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              activityId: 'a1',
              activityType: 'running',
              startTimeInSeconds: 1771498800,
              durationInSeconds: 1800,
              distanceInMeters: 5000,
            },
          ]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              calendarDate: '2026-02-18',
              startTimeInSeconds: 1771459200,
              durationInSeconds: 27000,
            },
          ]),
          { status: 200 }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const req = new Request('http://localhost/api/devices/garmin/sync', {
      headers: { authorization: 'Bearer test-token' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.syncName).toBe('RunSmart Garmin Enablement Sync')
    expect(Array.isArray(body.availableToEnable)).toBe(true)
    expect(body.availableToEnable.some((entry: { permission: string }) => entry.permission === 'ACTIVITY_EXPORT')).toBe(
      true
    )

    const capabilities = Object.fromEntries(
      (body.capabilities as Array<{ key: string; enabledForSync: boolean; supportedByRunSmart: boolean }>).map(
        (entry) => [entry.key, entry]
      )
    )

    expect(capabilities.activities.enabledForSync).toBe(true)
    expect(capabilities.sleep.enabledForSync).toBe(true)
    expect(capabilities.workoutImport.supportedByRunSmart).toBe(false)

    expect(fetchMock).toHaveBeenCalledTimes(3)

    const activitiesUrl = new URL(String(fetchMock.mock.calls[1]?.[0]))
    const start = Number(activitiesUrl.searchParams.get('uploadStartTimeInSeconds'))
    const end = Number(activitiesUrl.searchParams.get('uploadEndTimeInSeconds'))
    expect(end - start).toBeLessThanOrEqual(86399)
  })

  it('syncs only enabled datasets and skips unavailable datasets with notices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ permissions: ['ACTIVITY_EXPORT'] }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
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
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 404,
            error: 'Not Found',
            path: '/wellness-api/rest/sleep',
          }),
          { status: 404 }
        )
      )

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
    expect(body.notices.some((notice: string) => notice.includes('Sleep sync skipped'))).toBe(true)

    const capabilities = Object.fromEntries(
      (body.capabilities as Array<{ key: string; enabledForSync: boolean; reason?: string }>).map((entry) => [
        entry.key,
        entry,
      ])
    )

    expect(capabilities.activities.enabledForSync).toBe(true)
    expect(capabilities.sleep.enabledForSync).toBe(false)
    expect(String(capabilities.sleep.reason)).toContain('Missing HEALTH_EXPORT permission')
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
