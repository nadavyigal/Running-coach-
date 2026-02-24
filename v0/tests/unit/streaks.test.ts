import { describe, expect, it } from 'vitest'

import { computeStreakMetrics } from '@/lib/challenges/streaks'

function dateOffset(offset: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('streak metrics', () => {
  it('increments and tracks best streak', () => {
    const metrics = computeStreakMetrics([dateOffset(-2), dateOffset(-1), dateOffset(0)], new Date())

    expect(metrics.currentStreak).toBe(3)
    expect(metrics.bestStreak).toBe(3)
    expect(metrics.lastActiveDay).toBe(dateOffset(0))
  })

  it('resets current streak after a gap', () => {
    const metrics = computeStreakMetrics([dateOffset(-4), dateOffset(-2), dateOffset(0)], new Date())

    expect(metrics.currentStreak).toBe(1)
    expect(metrics.bestStreak).toBe(1)
    expect(metrics.lastActiveDay).toBe(dateOffset(0))
  })
})
