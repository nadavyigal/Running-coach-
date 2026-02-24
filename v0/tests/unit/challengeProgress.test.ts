import { describe, expect, it } from 'vitest'

import {
  computeChallengeProgressSnapshot,
  mergeChallengeCompletions,
  parseChallengeProgress,
} from '@/lib/challenges/progress'

function dateOffset(offset: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('challenge progress logic', () => {
  it('increments progress and marks challenge complete', () => {
    const startedAt = dateOffset(-2)

    const initialState = parseChallengeProgress(null)
    const afterGarmin = mergeChallengeCompletions({
      existing: initialState,
      garminDays: [dateOffset(-2), dateOffset(-1)],
    })

    const beforeCompletion = computeChallengeProgressSnapshot({
      startedAt,
      durationDays: 3,
      state: afterGarmin,
      today: new Date(),
    })

    expect(beforeCompletion.completedDays).toBe(2)
    expect(beforeCompletion.progressPercent).toBe(67)
    expect(beforeCompletion.completionBadgeEarned).toBe(false)

    const afterSelfReport = mergeChallengeCompletions({
      existing: afterGarmin,
      selfReportedDay: dateOffset(0),
    })

    const completed = computeChallengeProgressSnapshot({
      startedAt,
      durationDays: 3,
      state: afterSelfReport,
      today: new Date(),
    })

    expect(completed.completedDays).toBe(3)
    expect(completed.progressPercent).toBe(100)
    expect(completed.completionBadgeEarned).toBe(true)
    expect(afterSelfReport.completionSource[dateOffset(0)]).toBe('self_report')
  })
})
