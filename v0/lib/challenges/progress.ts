import { computeStreakMetrics } from '@/lib/challenges/streaks'

export type CompletionSource = 'garmin' | 'self_report'

export interface ChallengeProgressState {
  completedDays: string[]
  completionSource: Record<string, CompletionSource>
}

export interface ChallengeProgressSnapshot {
  startedAt: string
  durationDays: number
  currentDay: number
  completedDays: number
  progressPercent: number
  daysRemaining: number
  completionBadgeEarned: boolean
  completedToday: boolean
  streak: {
    current: number
    best: number
    lastActiveDay: string | null
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? new Date(value) : parseDateInput(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return formatDateKey(date)
}

function parseDateInput(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearStr, monthStr, dayStr] = value.split('-')
    const year = Number.parseInt(yearStr ?? '', 10)
    const month = Number.parseInt(monthStr ?? '', 10)
    const day = Number.parseInt(dayStr ?? '', 10)
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const parsed = new Date(year, month - 1, day)
      parsed.setHours(0, 0, 0, 0)
      return parsed
    }
  }

  return new Date(value)
}

function uniqueSortedDays(days: string[]): string[] {
  const normalized = new Set<string>()
  for (const day of days) {
    const key = toDateKey(day)
    if (key) normalized.add(key)
  }
  return [...normalized].sort((a, b) => a.localeCompare(b))
}

export function parseChallengeProgress(value: unknown): ChallengeProgressState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { completedDays: [], completionSource: {} }
  }

  const candidate = value as {
    completedDays?: unknown
    completionSource?: unknown
  }

  const completedDays = Array.isArray(candidate.completedDays)
    ? uniqueSortedDays(candidate.completedDays.filter((entry): entry is string => typeof entry === 'string'))
    : []

  const completionSource: Record<string, CompletionSource> = {}
  if (candidate.completionSource && typeof candidate.completionSource === 'object' && !Array.isArray(candidate.completionSource)) {
    for (const [key, source] of Object.entries(candidate.completionSource as Record<string, unknown>)) {
      const dateKey = toDateKey(key)
      if (!dateKey) continue
      if (source === 'garmin' || source === 'self_report') {
        completionSource[dateKey] = source
      }
    }
  }

  return {
    completedDays,
    completionSource,
  }
}

export function mergeChallengeCompletions(input: {
  existing: ChallengeProgressState
  garminDays?: string[]
  selfReportedDay?: string | null
}): ChallengeProgressState {
  const nextDays = [...input.existing.completedDays]
  const completionSource: Record<string, CompletionSource> = { ...input.existing.completionSource }

  for (const garminDay of input.garminDays ?? []) {
    const key = toDateKey(garminDay)
    if (!key) continue
    nextDays.push(key)
    completionSource[key] = 'garmin'
  }

  if (input.selfReportedDay) {
    const key = toDateKey(input.selfReportedDay)
    if (key && completionSource[key] == null) {
      nextDays.push(key)
      completionSource[key] = 'self_report'
    }
  }

  const completedDays = uniqueSortedDays(nextDays)

  return {
    completedDays,
    completionSource,
  }
}

function listEligibleDays(startedAt: Date, durationDays: number, today: Date): string[] {
  const safeDuration = Math.max(1, durationDays)
  const start = new Date(startedAt)
  start.setHours(0, 0, 0, 0)

  const current = new Date(today)
  current.setHours(0, 0, 0, 0)

  const finalDay = new Date(start)
  finalDay.setTime(finalDay.getTime() + (safeDuration - 1) * DAY_MS)

  const cutoff = current.getTime() < finalDay.getTime() ? current : finalDay
  if (cutoff.getTime() < start.getTime()) {
    return []
  }

  const days: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= cutoff.getTime()) {
    days.push(formatDateKey(cursor))
    cursor.setTime(cursor.getTime() + DAY_MS)
  }

  return days
}

export function computeChallengeProgressSnapshot(input: {
  startedAt: string | Date
  durationDays: number
  state: ChallengeProgressState
  today?: Date
}): ChallengeProgressSnapshot {
  const today = input.today ? new Date(input.today) : new Date()
  today.setHours(0, 0, 0, 0)

  const startedAt =
    input.startedAt instanceof Date ? new Date(input.startedAt) : parseDateInput(input.startedAt)
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error('Invalid challenge start date')
  }

  startedAt.setHours(0, 0, 0, 0)
  const durationDays = Math.max(1, input.durationDays)

  const elapsedDays = Math.floor((today.getTime() - startedAt.getTime()) / DAY_MS) + 1
  const currentDay = Math.max(1, Math.min(durationDays, elapsedDays))

  const eligibleDays = listEligibleDays(startedAt, durationDays, today)
  const completionSet = new Set(input.state.completedDays)
  const completedEligible = eligibleDays.filter((day) => completionSet.has(day))

  const completedDaysCount = completedEligible.length
  const progressPercent = Math.min(100, Math.round((completedDaysCount / durationDays) * 100))
  const completionBadgeEarned = completedDaysCount >= durationDays
  const todayKey = formatDateKey(today)

  const streak = computeStreakMetrics(input.state.completedDays, today)

  return {
    startedAt: formatDateKey(startedAt),
    durationDays,
    currentDay,
    completedDays: completedDaysCount,
    progressPercent,
    daysRemaining: Math.max(0, durationDays - completedDaysCount),
    completionBadgeEarned,
    completedToday: completionSet.has(todayKey),
    streak: {
      current: streak.currentStreak,
      best: streak.bestStreak,
      lastActiveDay: streak.lastActiveDay,
    },
  }
}
