import { dbUtils, hasAhaMomentFired, isNoticedMomentOnCooldown } from '@/lib/dbUtils'

export type NoticeContext =
  | { type: 'streak'; days: 3 | 7 | 14 | 30 | 60 | 100 }
  | { type: 'comeback'; daysSince: number }
  | { type: 'high_effort'; percentAbove: number }
  | { type: 'early_morning'; startedAt: Date }
  | { type: 'late_night'; startedAt: Date }
  | { type: 'third_run_week' }

interface RunInput {
  id: number
  userId: number
  distanceKm: number
  durationSeconds: number
  startedAt: Date
  paceMinPerKm?: number
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const

export async function detectNoticeContext(run: RunInput): Promise<NoticeContext | null> {
  if (await isNoticedMomentOnCooldown(run.userId)) {
    return null
  }

  const allRuns = await dbUtils.getRunsByUser(run.userId)
  const priorRuns = allRuns.filter((stored) => stored.id !== run.id)

  const runDates = allRuns.map((stored) => new Date(stored.completedAt))
  const streak = computeStreak(runDates)

  for (const milestone of [...STREAK_MILESTONES].reverse()) {
    if (streak === milestone) {
      const alreadyFired = await hasAhaMomentFired(run.userId, 'noticed', `streak_${milestone}`)
      if (!alreadyFired) {
        return { type: 'streak', days: milestone }
      }
    }
  }

  if (priorRuns.length > 0) {
    const lastRun = priorRuns[0]
    const daysSinceLast =
      (run.startedAt.getTime() - new Date(lastRun.completedAt).getTime()) / 86400000
    if (daysSinceLast >= 7) {
      return { type: 'comeback', daysSince: Math.round(daysSinceLast) }
    }
  }

  if (run.paceMinPerKm) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    const recentPacedRuns = priorRuns.filter((stored) => {
      const completedAt = new Date(stored.completedAt)
      return completedAt >= thirtyDaysAgo && stored.distance >= 0.05 && stored.duration > 0
    })

    if (recentPacedRuns.length >= 3) {
      const avgPaceSecPerKm =
        recentPacedRuns.reduce((sum, stored) => sum + stored.duration / stored.distance, 0) /
        recentPacedRuns.length
      const runPaceSecPerKm = run.paceMinPerKm * 60
      const improvement = (avgPaceSecPerKm - runPaceSecPerKm) / avgPaceSecPerKm
      if (improvement >= 0.08) {
        return { type: 'high_effort', percentAbove: Math.round(improvement * 100) }
      }
    }
  }

  const hour = run.startedAt.getHours()
  const minute = run.startedAt.getMinutes()
  if (hour < 6 || (hour === 6 && minute === 0)) {
    return { type: 'early_morning', startedAt: run.startedAt }
  }
  if (hour >= 21) {
    return { type: 'late_night', startedAt: run.startedAt }
  }

  const weekStart = getWeekStart(run.startedAt)
  const runsThisWeek = allRuns.filter((stored) => {
    if (stored.id === run.id) return false
    return new Date(stored.completedAt) >= weekStart
  })

  if (runsThisWeek.length >= 2) {
    return { type: 'third_run_week' }
  }

  return null
}

function computeStreak(runDates: Date[]): number {
  const days = [...new Set(runDates.map((date) => date.toISOString().slice(0, 10)))].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  let cursor = today
  for (const day of days) {
    if (day === cursor) {
      streak++
      const prev = new Date(cursor)
      prev.setDate(prev.getDate() - 1)
      cursor = prev.toISOString().slice(0, 10)
    } else if (day < cursor) {
      break
    }
  }
  return streak
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}
