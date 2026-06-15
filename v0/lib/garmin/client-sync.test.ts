import { beforeEach, describe, expect, it, vi } from 'vitest'

const localRuns = vi.hoisted(() => [] as Array<{
  id?: number
  userId: number
  importSource?: string
  importRequestId?: string
  completedAt: Date
}>)

const bulkDeleteMock = vi.hoisted(() => vi.fn(async (ids: number[]) => {
  for (const id of ids) {
    const index = localRuns.findIndex((run) => run.id === id)
    if (index >= 0) localRuns.splice(index, 1)
  }
}))
const addMock = vi.hoisted(() => vi.fn(async (run: unknown) => {
  localRuns.push({ ...(run as typeof localRuns[number]), id: localRuns.length + 100 })
}))
const updateRunMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/db', () => ({
  db: {
    runs: {
      where: vi.fn((index: string) => {
        if (index === 'userId') {
          return {
            equals: (userId: number) => ({
              filter: (predicate: (run: typeof localRuns[number]) => boolean) => ({
                toArray: async () => localRuns.filter((run) => run.userId === userId).filter(predicate),
              }),
            }),
          }
        }

        if (index === '[userId+importRequestId]') {
          return {
            equals: ([userId, importRequestId]: [number, string]) => ({
              first: async () => localRuns.find(
                (run) => run.userId === userId && run.importRequestId === importRequestId
              ),
            }),
          }
        }

        throw new Error(`Unexpected index ${index}`)
      }),
      bulkDelete: bulkDeleteMock,
      add: addMock,
    },
  },
}))

vi.mock('@/lib/dbUtils', () => ({
  updateRun: updateRunMock,
}))

describe('mirrorRecentGarminRunsToDexie', () => {
  beforeEach(() => {
    localRuns.length = 0
    bulkDeleteMock.mockClear()
    addMock.mockClear()
    updateRunMock.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not delete local Garmin runs outside a full remote reconciliation window', async () => {
    localRuns.push(
      {
        id: 1,
        userId: 42,
        importSource: 'garmin',
        importRequestId: 'deleted-recent',
        completedAt: new Date('2026-06-10T06:00:00.000Z'),
      },
      {
        id: 2,
        userId: 42,
        importSource: 'garmin',
        importRequestId: 'older-than-window',
        completedAt: new Date('2025-01-01T06:00:00.000Z'),
      }
    )

    const remoteRuns = Array.from({ length: 200 }, (_, index) => ({
      source_activity_id: `remote-${index}`,
      type: 'easy',
      distance: 5,
      duration: 1800,
      completed_at: new Date(Date.UTC(2026, 0, 1, 6, 0, index)).toISOString(),
    }))

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, runs: remoteRuns }),
    } as Response)

    const { mirrorRecentGarminRunsToDexie } = await import('@/lib/garmin/client-sync')

    await mirrorRecentGarminRunsToDexie(42)

    expect(bulkDeleteMock).toHaveBeenCalledWith([1])
    expect(localRuns.some((run) => run.id === 1)).toBe(false)
    expect(localRuns.some((run) => run.id === 2)).toBe(true)
  })
})
