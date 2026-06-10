import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectNoticeContext } from './contextDetector'
import { dbUtils, hasAhaMomentFired, isNoticedMomentOnCooldown } from '@/lib/dbUtils'

vi.mock('@/lib/dbUtils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dbUtils')>('@/lib/dbUtils')
  return {
    ...actual,
    dbUtils: {
      getRunsByUser: vi.fn(),
    },
    hasAhaMomentFired: vi.fn(),
    isNoticedMomentOnCooldown: vi.fn(),
  }
})

const mockGetRunsByUser = vi.mocked(dbUtils.getRunsByUser)
const mockHasAhaMomentFired = vi.mocked(hasAhaMomentFired)
const mockIsNoticedMomentOnCooldown = vi.mocked(isNoticedMomentOnCooldown)

const baseRun = {
  id: 100,
  userId: 1,
  distanceKm: 5,
  durationSeconds: 1800,
  startedAt: new Date('2026-06-10T12:00:00'),
  paceMinPerKm: 6,
}

describe('detectNoticeContext', () => {
  beforeEach(() => {
    mockGetRunsByUser.mockReset()
    mockHasAhaMomentFired.mockReset()
    mockIsNoticedMomentOnCooldown.mockReset()
    mockIsNoticedMomentOnCooldown.mockResolvedValue(false)
    mockHasAhaMomentFired.mockResolvedValue(false)
  })

  it('returns null when cooldown is active', async () => {
    mockIsNoticedMomentOnCooldown.mockResolvedValue(true)

    const result = await detectNoticeContext(baseRun)
    expect(result).toBeNull()
  })

  it('returns streak when streak milestone is reached and not already fired', async () => {
    const today = new Date()
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - index)
      return { id: index + 1, completedAt: date }
    })

    mockGetRunsByUser.mockResolvedValue(dates as any)
    mockHasAhaMomentFired.mockResolvedValue(false)

    const result = await detectNoticeContext(baseRun)
    expect(result).toEqual({ type: 'streak', days: 7 })
  })

  it('returns comeback when last run was 10 days ago', async () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    mockGetRunsByUser.mockResolvedValue([
      { id: 100, completedAt: baseRun.startedAt, distance: 5, duration: 1800 },
      { id: 99, completedAt: tenDaysAgo, distance: 4, duration: 1500 },
    ] as any)

    const result = await detectNoticeContext(baseRun)
    expect(result).toEqual({ type: 'comeback', daysSince: 10 })
  })

  it('returns high_effort when pace is 12% faster than average', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 2)

    mockGetRunsByUser.mockResolvedValue([
      { id: 100, completedAt: baseRun.startedAt, distance: 5, duration: 1500 },
      { id: 1, completedAt: recentDate, distance: 5, duration: 1800 },
      { id: 2, completedAt: recentDate, distance: 5, duration: 1800 },
      { id: 3, completedAt: recentDate, distance: 5, duration: 1800 },
    ] as any)

    const result = await detectNoticeContext({
      ...baseRun,
      paceMinPerKm: 5.28,
    })

    expect(result).toEqual({ type: 'high_effort', percentAbove: 12 })
  })

  it('returns early_morning for a 5:47am run', async () => {
    mockGetRunsByUser.mockResolvedValue([
      { id: 100, completedAt: new Date('2026-06-10T05:47:00'), distance: 3, duration: 1200 },
    ] as any)

    const result = await detectNoticeContext({
      ...baseRun,
      startedAt: new Date('2026-06-10T05:47:00'),
    })

    expect(result?.type).toBe('early_morning')
  })

  it('returns null when no context matches', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    mockGetRunsByUser.mockResolvedValue([
      { id: 100, completedAt: baseRun.startedAt, distance: 5, duration: 1800 },
      { id: 99, completedAt: yesterday, distance: 4, duration: 1500 },
    ] as any)

    const result = await detectNoticeContext(baseRun)
    expect(result).toBeNull()
  })
})
