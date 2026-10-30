import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createAdminClientMock = vi.hoisted(() => vi.fn())
const upsertMock = vi.hoisted(() => vi.fn(async () => ({ error: null })))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

async function loadModule() {
  return import('./garmin-export-store')
}

describe('storeGarminWebhookPayload', () => {
  beforeEach(() => {
    vi.stubEnv('GARMIN_HEALTH_ENABLED', 'true')
    upsertMock.mockClear()
    createAdminClientMock.mockReset()
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('persists activity and wellness webhook datasets into the export store', async () => {
    const { storeGarminWebhookPayload } = await loadModule()

    const result = await storeGarminWebhookPayload({
      payload: {
        activities: [{ userId: 'garmin-user-1', activityId: 'run-1' }],
        dailies: [{ userId: 'garmin-user-1', summaryId: 'daily-1' }],
        sleeps: [{ userId: 'garmin-user-1', sleepSummaryId: 'sleep-1' }],
      },
    })

    expect(result.ok).toBe(true)
    expect(result.storedRowsByDataset).toMatchObject({
      activities: 1,
      dailies: 1,
      sleeps: 1,
    })
    expect(upsertMock).toHaveBeenCalledTimes(3)

    const persistedSnapshots = upsertMock.mock.calls.flatMap(([rows]) =>
      (rows as Array<{ snapshot: Record<string, unknown> }>).map((row) => row.snapshot)
    )

    expect(persistedSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ datasetKey: 'activities', source: 'push' }),
        expect.objectContaining({ datasetKey: 'dailies', source: 'push' }),
        expect.objectContaining({ datasetKey: 'sleeps', source: 'push' }),
      ])
    )
  })
})

describe('Activity-only export store', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('drops direct wellness writes even if called outside webhook filtering', async () => {
    vi.stubEnv('GARMIN_HEALTH_ENABLED', 'false')
    createAdminClientMock.mockClear()
    const { storeGarminExportRows } = await loadModule()
    const result = await storeGarminExportRows({ datasetKey: 'sleeps', rows: [{ userId: 'g1', private: 'health' }], source: 'push' })
    expect(result.storedRows).toBe(0)
    expect(result.droppedRows).toBe(1)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })
})
