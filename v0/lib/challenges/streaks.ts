export interface StreakMetrics {
  currentStreak: number
  bestStreak: number
  lastActiveDay: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return formatDateKey(date)
}

function fromDateKey(key: string): Date | null {
  const [yearStr, monthStr, dayStr] = key.split('-')
  const year = Number.parseInt(yearStr ?? '', 10)
  const month = Number.parseInt(monthStr ?? '', 10)
  const day = Number.parseInt(dayStr ?? '', 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function toUniqueSortedKeys(completedDays: string[]): string[] {
  const unique = new Set<string>()
  for (const day of completedDays) {
    const key = toDateKey(day)
    if (key) unique.add(key)
  }

  return [...unique].sort((a, b) => a.localeCompare(b))
}

export function computeCurrentStreak(completedDays: string[], today: Date = new Date()): number {
  const keys = new Set(toUniqueSortedKeys(completedDays))
  const cursor = new Date(today)
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (true) {
    const key = formatDateKey(cursor)
    if (!keys.has(key)) break
    streak += 1
    cursor.setTime(cursor.getTime() - DAY_MS)
  }

  return streak
}

export function computeBestStreak(completedDays: string[]): number {
  const keys = toUniqueSortedKeys(completedDays)
  if (keys.length === 0) return 0

  let best = 1
  let current = 1

  for (let index = 1; index < keys.length; index += 1) {
    const prevKey = keys[index - 1]
    const currKey = keys[index]
    if (!prevKey || !currKey) continue
    const previous = fromDateKey(prevKey)
    const currentDate = fromDateKey(currKey)

    if (!previous || !currentDate) continue

    const diffDays = Math.round((currentDate.getTime() - previous.getTime()) / DAY_MS)
    if (diffDays === 1) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 1
    }
  }

  return best
}

export function computeStreakMetrics(completedDays: string[], today: Date = new Date()): StreakMetrics {
  const keys = toUniqueSortedKeys(completedDays)

  return {
    currentStreak: computeCurrentStreak(keys, today),
    bestStreak: computeBestStreak(keys),
    lastActiveDay: keys.at(-1) ?? null,
  }
}
