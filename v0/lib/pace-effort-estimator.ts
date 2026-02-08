import type { Run } from '@/lib/db'

export type PaceEffortLevel = 'easy' | 'moderate' | 'hard'

export const normalizeRunPaceSecondsPerKm = (run: Run): number | null => {
  if (typeof run.pace === 'number' && Number.isFinite(run.pace) && run.pace > 0) {
    return run.pace
  }
  if (
    typeof run.duration === 'number' &&
    Number.isFinite(run.duration) &&
    run.duration > 0 &&
    typeof run.distance === 'number' &&
    Number.isFinite(run.distance) &&
    run.distance > 0
  ) {
    return run.duration / run.distance
  }
  return null
}

export const calculateBaselinePace = (runs: Run[], sampleSize: number = 5): number | null => {
  const paces = runs
    .map(normalizeRunPaceSecondsPerKm)
    .filter((pace): pace is number => Number.isFinite(pace) && pace > 0)

  if (paces.length === 0) return null

  const sorted = paces.slice().sort((a, b) => a - b)
  const trimmed = sorted.slice(0, Math.min(sampleSize, sorted.length))
  const mid = Math.floor(trimmed.length / 2)
  if (trimmed.length % 2 === 0) {
    return (trimmed[mid - 1] + trimmed[mid]) / 2
  }
  return trimmed[mid]
}

export const estimatePaceEffort = (
  paceSecondsPerKm: number,
  baselineSecondsPerKm: number
): PaceEffortLevel => {
  if (!Number.isFinite(paceSecondsPerKm) || !Number.isFinite(baselineSecondsPerKm) || baselineSecondsPerKm <= 0) {
    return 'moderate'
  }

  const ratio = paceSecondsPerKm / baselineSecondsPerKm
  if (ratio <= 0.9) return 'hard'
  if (ratio <= 1.05) return 'moderate'
  return 'easy'
}

export const getEffortMultiplier = (effort: PaceEffortLevel): number => {
  switch (effort) {
    case 'hard':
      return 1.15
    case 'moderate':
      return 1.0
    default:
      return 0.9
  }
}
