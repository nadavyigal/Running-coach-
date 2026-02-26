import { db } from '@/lib/db'

export type CoachConfidenceResult = {
  confidence: number
  label: string
  nextSteps: string[]
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export async function calculateCoachConfidence(
  userId: number,
  date: Date = new Date()
): Promise<CoachConfidenceResult> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const sevenDaysAgo = new Date(date)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [wellnessToday, sleepToday, recentRuns, recentHrv, garminSignalsToday] = await Promise.all([
    db.subjectiveWellness
      .where('userId')
      .equals(userId)
      .and((wellness) => {
        const wellnessDate = wellness.assessmentDate ?? wellness.date
        return wellnessDate ? wellnessDate >= startOfDay && wellnessDate <= endOfDay : false
      })
      .first(),
    db.sleepData
      .where('userId')
      .equals(userId)
      .and((sleep) => {
        const sleepDate = sleep.sleepDate ?? sleep.date
        return sleepDate ? sleepDate >= startOfDay && sleepDate <= endOfDay : false
      })
      .first(),
    db.runs
      .where('userId')
      .equals(userId)
      .and((run) => new Date(run.completedAt) >= sevenDaysAgo)
      .toArray(),
    db.hrvMeasurements
      .where('userId')
      .equals(userId)
      .and((hrv) => hrv.measurementDate >= sevenDaysAgo)
      .limit(1)
      .first(),
    db.garminSummaryRecords
      .where('[userId+recordedAt]')
      .between([userId, startOfDay], [userId, endOfDay], true, true)
      .toArray()
      .then((rows) =>
        rows.filter((row) =>
          ['sleeps', 'dailies', 'stressDetails', 'epochs', 'allDayRespiration', 'hrv'].includes(row.datasetKey)
        )
      ),
  ])

  const hasWearableSignals = Boolean(recentHrv)
  if (hasWearableSignals) {
    return {
      confidence: 100,
      label: 'Excellent',
      nextSteps: [],
    }
  }

  const hasGarminWellnessSignals = garminSignalsToday.some((signal) =>
    ['dailies', 'stressDetails', 'epochs', 'allDayRespiration', 'hrv'].includes(signal.datasetKey)
  )
  const hasGarminSleepSignals = garminSignalsToday.some((signal) => signal.datasetKey === 'sleeps')

  const hasRunData = recentRuns.length > 0
  const hasWellness = Boolean(wellnessToday)
  const hasSleep = Boolean(sleepToday) || hasGarminSleepSignals
  const hasRecentRpe = recentRuns.some((run) => typeof run.rpe === 'number')
  const consistentDays = new Set(
    recentRuns.map((run) => new Date(run.completedAt).toDateString())
  ).size

  let confidence = 0
  if (hasRunData) confidence += 15
  if (hasWellness) confidence += 25
  if (hasGarminWellnessSignals) confidence += 20
  if (hasSleep) confidence += 15
  if (hasRecentRpe) confidence += 10
  if (consistentDays >= 5) confidence += 10

  const nextSteps: string[] = []
  if (!hasWellness && !hasGarminWellnessSignals) {
    nextSteps.push('Complete your morning check-in')
  }
  if (!hasSleep) {
    nextSteps.push('Add sleep data to improve accuracy')
  }
  if (!hasRecentRpe) {
    nextSteps.push('Rate your run effort after training')
  }

  if (nextSteps.length === 0) {
    nextSteps.push('Great data coverage this week')
  }

  const resolvedConfidence = clamp(confidence, 0, 100)
  const label =
    resolvedConfidence >= 75 ? 'High' :
    resolvedConfidence >= 50 ? 'Medium' :
    'Low'

  return {
    confidence: resolvedConfidence,
    label,
    nextSteps,
  }
}
