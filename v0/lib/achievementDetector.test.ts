import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectAchievement } from './achievementDetector'
import { dbUtils } from '@/lib/dbUtils'

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getRunsByUser: vi.fn(),
  },
}))

const mockGetRunsByUser = vi.mocked(dbUtils.getRunsByUser)

describe('detectAchievement', () => {
  beforeEach(() => {
    mockGetRunsByUser.mockReset()
  })

  it('returns first_run when there are no prior runs', async () => {
    mockGetRunsByUser.mockResolvedValue([{ id: 10, distance: 3.2 } as any])

    const result = await detectAchievement(1, 10, 3.2)
    expect(result).toEqual({ type: 'first_run', distanceKm: 3.2 })
  })

  it('returns milestone when crossing 5K for the first time', async () => {
    mockGetRunsByUser.mockResolvedValue([
      { id: 11, distance: 5.1 } as any,
      { id: 10, distance: 4.5 } as any,
    ])

    const result = await detectAchievement(1, 11, 5.1)
    expect(result).toEqual({
      type: 'milestone',
      distanceKm: 5.1,
      milestoneKm: 5,
    })
  })

  it('returns personal_best when distance exceeds prior max', async () => {
    mockGetRunsByUser.mockResolvedValue([
      { id: 12, distance: 4.5 } as any,
      { id: 10, distance: 4.0 } as any,
    ])

    const result = await detectAchievement(1, 12, 4.5)
    expect(result).toEqual({
      type: 'personal_best',
      distanceKm: 4.5,
      previousBestKm: 4.0,
    })
  })

  it('returns null when current distance is not an achievement', async () => {
    mockGetRunsByUser.mockResolvedValue([
      { id: 13, distance: 3.5 } as any,
      { id: 10, distance: 4.0 } as any,
    ])

    const result = await detectAchievement(1, 13, 3.5)
    expect(result).toBeNull()
  })
})
