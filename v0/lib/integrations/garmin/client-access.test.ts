import { afterEach, describe, expect, it, vi } from 'vitest'
import { GarminClient } from './client'
import type { GarminOAuthConnection } from './types'
describe('Garmin client delivery restrictions', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('blocks Starter range requests before looking up a token or fetching anything', async () => {
    vi.stubEnv('GARMIN_ACCESS_TIER', 'starter')
    const client = new GarminClient({ scopes: ['HISTORICAL_DATA_EXPORT'] } as GarminOAuthConnection)
    const token = vi.spyOn(client, 'getAccessToken')
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(client.fetchActivitiesInRange({ startTimeInSeconds: 1, endTimeInSeconds: 2, mode: 'backfill' })).rejects.toMatchObject({ statusCode: 403 })
    expect(token).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rechecks live permission before Enterprise history, blocking revoked grants', async () => {
    vi.stubEnv('GARMIN_ACCESS_TIER', 'enterprise')
    const client = new GarminClient({ scopes: ['HISTORICAL_DATA_EXPORT'] } as GarminOAuthConnection)
    vi.spyOn(client, 'fetchPermissions').mockResolvedValue([])
    const token = vi.spyOn(client, 'getAccessToken')
    await expect(client.fetchActivitiesInRange({ startTimeInSeconds: 1, endTimeInSeconds: 2, mode: 'backfill' })).rejects.toMatchObject({ statusCode: 403 })
    expect(token).not.toHaveBeenCalled()
  })
  it('preserves Starter Activity File callback retrieval', async () => {
    vi.stubEnv('GARMIN_ACCESS_TIER', 'starter')
    const client = new GarminClient({} as GarminOAuthConnection)
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1,2,3])))
    vi.stubGlobal('fetch', fetchMock)
    const buffer = await client.fetchActivityFile('https://apis.garmin.com/wellness-api/rest/activityFile?id=test&token=test')
    expect(buffer.byteLength).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
