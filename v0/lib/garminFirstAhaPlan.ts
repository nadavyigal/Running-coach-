import type {
  GarminFirstAhaRunInput,
  GarminFirstAhaWellnessDay,
  GuardrailLevel,
  RunnerTypeId,
  StarterDayType,
  StarterIntensity,
} from '@/lib/garminFirstAhaTypes'
import { RUNNER_TYPE_LABELS } from '@/lib/garminFirstAhaTypes'
import { computeGarminAcwrMetrics, type GarminAcwrMetrics } from '@/lib/garminAcwr'
import { computeGarminReadiness } from '@/lib/garminReadinessComputer'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const parsed = Date.parse(`${dateIso}T00:00:00.000Z`)
  return new Date(parsed + deltaDays * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
}

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function countRunsInWindow(runs: GarminFirstAhaRunInput[], endDate: string, days: number): number {
  const start = shiftIsoDate(endDate, -(days - 1))
  return runs.filter((run) => {
    const key = toDateKey(run.completedAt)
    return key >= start && key <= endDate
  }).length
}

function classifyIntensity(runs: GarminFirstAhaRunInput[]): {
  label: string
  easyShare?: number
  hardShare?: number
  source: 'heart_rate' | 'pace' | 'mixed' | 'insufficient'
  hardRunShare: number
} {
  const withHr = runs.filter((run) => run.averageHeartRate != null && run.averageHeartRate > 0)
  if (withHr.length >= 3) {
    const easy = withHr.filter((run) => (run.averageHeartRate ?? 0) < 140).length
    const hard = withHr.filter((run) => (run.averageHeartRate ?? 0) >= 165).length
    const total = withHr.length
    const easyShare = Math.round((easy / total) * 100)
    const hardShare = Math.round((hard / total) * 100)
    let label = 'Balanced intensity mix'
    if (hardShare >= 40) label = 'Higher intensity share recently'
    else if (easyShare >= 70) label = 'Mostly easy efforts recently'
    return { label, easyShare, hardShare, source: 'heart_rate', hardRunShare: hardShare / 100 }
  }

  if (runs.length >= 2) {
    return {
      label: 'Intensity estimated from run patterns',
      source: 'pace',
      hardRunShare: 0.2,
    }
  }

  return {
    label: 'Not enough data to assess intensity yet',
    source: 'insufficient',
    hardRunShare: 0,
  }
}

function daysSinceLastRun(runs: GarminFirstAhaRunInput[], endDate: string): number | null {
  if (runs.length === 0) return null
  const latest = runs
    .map((run) => toDateKey(run.completedAt))
    .sort()
    .at(-1)
  if (!latest) return null
  const endMs = Date.parse(`${endDate}T00:00:00.000Z`)
  const latestMs = Date.parse(`${latest}T00:00:00.000Z`)
  return Math.round((endMs - latestMs) / MILLISECONDS_PER_DAY)
}

function weeklyFrequencyLabel(runs28: number): string {
  const perWeek = runs28 / 4
  if (perWeek < 1) return 'Less than once per week recently'
  if (perWeek < 2) return 'About once per week recently'
  if (perWeek < 3) return 'About 2 runs per week recently'
  if (perWeek < 4.5) return 'About 3 runs per week recently'
  return '4 or more runs per week recently'
}

function resolveLongestRunLabel(runs: GarminFirstAhaRunInput[], endDate: string): string | undefined {
  const start = shiftIsoDate(endDate, -27)
  const recent = runs.filter((run) => {
    const key = toDateKey(run.completedAt)
    return key >= start && key <= endDate
  })
  if (recent.length === 0) return undefined
  const longest = recent.reduce((max, run) => {
    const meters = run.distanceMeters ?? 0
    return meters > max ? meters : max
  }, 0)
  if (longest <= 0) return 'Longest recent run duration-based'
  const km = (longest / 1000).toFixed(1)
  return `Longest recent run about ${km} km`
}

function mapAcwrLabel(zone: GarminAcwrMetrics['zone']): 'low' | 'stable' | 'elevated' | 'unknown' {
  if (zone === 'underload') return 'low'
  if (zone === 'sweet_zone') return 'stable'
  if (zone === 'elevated' || zone === 'high') return 'elevated'
  return 'unknown'
}

export function classifyRunnerType(params: {
  runs: GarminFirstAhaRunInput[]
  endDate: string
  acwr: GarminAcwrMetrics
  hardRunShare: number
  readinessScore: number | null
}): RunnerTypeId {
  const runs28 = countRunsInWindow(params.runs, params.endDate, 28)
  const gapDays = daysSinceLastRun(params.runs, params.endDate)

  if (runs28 < 3) return 'new_or_low_data_runner'
  if (gapDays != null && gapDays >= 14 && runs28 >= 3) return 'building_consistency'

  const elevatedLoad = params.acwr.zone === 'elevated' || params.acwr.zone === 'high'
  const weakRecovery = params.readinessScore != null && params.readinessScore < 45
  if (elevatedLoad || (params.hardRunShare >= 0.35 && weakRecovery)) {
    return 'overreaching_risk'
  }

  const runsPerWeek = runs28 / 4
  if (runsPerWeek >= 4 && params.hardRunShare >= 0.25) return 'race_focused'
  if (runs28 >= 8 && params.hardRunShare < 0.3) return 'consistent_base_builder'
  return 'building_consistency'
}

export function computeGuardrails(params: {
  runs: GarminFirstAhaRunInput[]
  endDate: string
  acwr: GarminAcwrMetrics
  hardRunShare: number
  readinessScore: number | null
  hasWellness: boolean
  runs28: number
}): { level: GuardrailLevel; message: string; reasons: string[] } {
  const reasons: string[] = []
  let level: GuardrailLevel = 'green'
  const sparseHistory = params.runs28 < 4

  const week1Distance = params.runs
    .filter((run) => toDateKey(run.completedAt) >= shiftIsoDate(params.endDate, -6))
    .reduce((sum, run) => sum + (run.distanceMeters ?? 0), 0)
  const week2Distance = params.runs
    .filter((run) => {
      const key = toDateKey(run.completedAt)
      return key >= shiftIsoDate(params.endDate, -13) && key < shiftIsoDate(params.endDate, -6)
    })
    .reduce((sum, run) => sum + (run.distanceMeters ?? 0), 0)

  if (!sparseHistory && week2Distance > 0 && week1Distance > week2Distance * 1.3) {
    level = 'yellow'
    reasons.push('Recent weekly volume increased more than about 30%')
  }

  if (!sparseHistory && (params.acwr.zone === 'elevated' || params.acwr.zone === 'high')) {
    level = params.acwr.zone === 'high' ? 'red' : 'yellow'
    reasons.push('Training load looks elevated compared with your recent baseline')
  }

  if (params.hardRunShare >= 0.35) {
    if (level === 'green') level = 'yellow'
    reasons.push('A high share of recent runs looked hard')
  }

  if (params.readinessScore != null && params.readinessScore < 40) {
    level = 'red'
    reasons.push('Recovery signals look weaker than usual')
  } else if (!params.hasWellness && level === 'green') {
    reasons.push('Recovery signals are limited, so the plan stays conservative')
  }

  let message: string
  if (level === 'red') {
    message = 'Your recent load and recovery pattern suggest easing up before building again.'
  } else if (level === 'yellow') {
    message = 'Your last week jumped quickly, so the plan starts with a lighter reset.'
  } else if (!params.hasWellness) {
    message =
      'You have enough run history for a plan, but not enough wellness data for recovery-based adjustments yet.'
  } else {
    message = 'Your recent volume looks stable, so the next two weeks can build gently.'
  }

  return { level, message, reasons }
}

function sessionsPerWeek(runnerType: RunnerTypeId, guardrailLevel: GuardrailLevel, runs28: number): number {
  const basePerWeek = runs28 / 4
  if (runnerType === 'new_or_low_data_runner') return 2
  if (guardrailLevel === 'red') return Math.max(2, Math.min(3, Math.round(basePerWeek)))
  if (guardrailLevel === 'yellow') return Math.max(2, Math.min(3, Math.round(basePerWeek)))
  if (basePerWeek >= 4) return 4
  if (basePerWeek >= 2.5) return 3
  return 2
}

const DAY_OFFSETS_BY_FREQUENCY: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 5, 6],
}

function buildSession(
  date: string,
  type: StarterDayType,
  label: string,
  target: string | undefined,
  intensity: StarterIntensity,
  purpose: string
) {
  return { date, type, label, target, intensity, purpose }
}

export function buildStarterPlan(params: {
  runnerType: RunnerTypeId
  guardrailLevel: GuardrailLevel
  runs28: number
  startDate: string
}): { title: string; rationale: string; days: ReturnType<typeof buildSession>[] } {
  const sessions = sessionsPerWeek(params.runnerType, params.guardrailLevel, params.runs28)
  const week1Offsets = DAY_OFFSETS_BY_FREQUENCY[sessions] ?? DAY_OFFSETS_BY_FREQUENCY[3]
  const buildWeek = (weekStart: string, weekIndex: number, buildGently: boolean) => {
    const days: ReturnType<typeof buildSession>[] = []
    const usedOffsets = new Set<number>()

    for (const offset of week1Offsets) {
      usedOffsets.add(offset)
      const date = shiftIsoDate(weekStart, offset)
      const isWalkRun = params.runnerType === 'new_or_low_data_runner'
      const easyTarget = buildGently ? '20-25 min easy' : '25-30 min easy'
      days.push(
        buildSession(
          date,
          isWalkRun ? 'walk_run' : 'easy_run',
          isWalkRun ? 'Walk-run' : 'Easy run',
          easyTarget,
          'easy',
          weekIndex === 0 ? 'Stabilize your rhythm' : 'Build gently on last week'
        )
      )
    }

    if (sessions >= 3 && params.runnerType !== 'new_or_low_data_runner') {
      const longOffset = Math.max(...week1Offsets) - 1
      if (!usedOffsets.has(longOffset) && longOffset >= 0) {
        const date = shiftIsoDate(weekStart, longOffset)
        days.push(
          buildSession(
            date,
            'long_run',
            'Longer easy run',
            buildGently ? '30-35 min easy' : '35-45 min easy',
            'easy',
            'Extend endurance without pushing pace'
          )
        )
      }
    }

    const restOffset = 6
    if (!usedOffsets.has(restOffset)) {
      days.push(
        buildSession(
          shiftIsoDate(weekStart, restOffset),
          'rest',
          'Rest day',
          undefined,
          'rest',
          'Let your body absorb the work'
        )
      )
    }

    return days.sort((a, b) => a.date.localeCompare(b.date))
  }

  const week1 = buildWeek(params.startDate, 0, true)
  const week2Start = shiftIsoDate(params.startDate, 7)
  const buildWeek2 = params.guardrailLevel === 'green'
  const week2 = buildWeek(week2Start, 1, !buildWeek2)

  const title =
    params.guardrailLevel === 'red'
      ? '14-day lighter reset block'
      : '14-day adaptive starter block'

  const rationale =
    params.runnerType === 'new_or_low_data_runner'
      ? 'Short walk-run sessions to build a safe return rhythm.'
      : params.guardrailLevel === 'yellow' || params.guardrailLevel === 'red'
        ? 'Volume stays steady while intensity stays easy while load settles.'
        : 'Keeps your recent frequency and adds gentle progression in week two.'

  return { title, rationale, days: [...week1, ...week2] }
}

export function buildProfileSummary(params: {
  runnerType: RunnerTypeId
  runs14: number
  runs28: number
  weeklyPatternLabel: string
  guardrailMessage: string
  confidence: 'high' | 'medium' | 'low'
}): { headline: string; summaryBullets: string[] } {
  const label = RUNNER_TYPE_LABELS[params.runnerType]
  const headline = `${label} based on your recent Garmin runs`
  const summaryBullets = [
    `${params.runs14} runs in the last 14 days, ${params.runs28} in the last 28 days.`,
    params.weeklyPatternLabel,
    params.guardrailMessage,
  ]
  return { headline, summaryBullets }
}

export function analyzeGarminFirstAhaInputs(params: {
  runs: GarminFirstAhaRunInput[]
  wellnessDays: GarminFirstAhaWellnessDay[]
  endDate?: string
}) {
  const endDate =
    params.endDate ??
    params.runs
      .map((run) => toDateKey(run.completedAt))
      .sort()
      .at(-1) ??
    new Date().toISOString().slice(0, 10)

  const runs14 = countRunsInWindow(params.runs, endDate, 14)
  const runs28 = countRunsInWindow(params.runs, endDate, 28)
  const weeklyPatternLabel = weeklyFrequencyLabel(runs28)

  const acwr = computeGarminAcwrMetrics({
    activities: params.runs.map((run) => ({
      startTime: run.completedAt,
      durationSeconds: run.durationSeconds,
      averageHeartRate: run.averageHeartRate,
      distanceMeters: run.distanceMeters,
    })),
    endDate,
  })

  const dates28 = Array.from({ length: 28 }, (_, index) => shiftIsoDate(endDate, -(27 - index)))
  const wellnessByDate = new Map(params.wellnessDays.map((day) => [day.date, day]))
  const readinessDays = dates28.map((date) => {
    const day = wellnessByDate.get(date)
    return {
      date,
      hrv: day?.hrv ?? null,
      sleepScore: day?.sleepScore ?? null,
      restingHr: day?.restingHr ?? null,
      stress: day?.stress ?? null,
    }
  })
  const readiness = computeGarminReadiness({ days: readinessDays, endDate })
  const hasWellness = params.wellnessDays.some(
    (day) => day.hrv != null || day.sleepScore != null || day.restingHr != null || day.stress != null
  )

  const intensity = classifyIntensity(
    params.runs.filter((run) => {
      const key = toDateKey(run.completedAt)
      return key >= shiftIsoDate(endDate, -27) && key <= endDate
    })
  )

  const runnerType = classifyRunnerType({
    runs: params.runs,
    endDate,
    acwr,
    hardRunShare: intensity.hardRunShare,
    readinessScore: hasWellness ? readiness.score : null,
  })

  const guardrails = computeGuardrails({
    runs: params.runs,
    endDate,
    acwr,
    hardRunShare: intensity.hardRunShare,
    readinessScore: hasWellness ? readiness.score : null,
    hasWellness,
    runs28,
  })

  const wellnessDaysCount = params.wellnessDays.filter(
    (day) => day.hrv != null || day.sleepScore != null || day.restingHr != null || day.stress != null
  ).length

  const recoverySignals = ['hrv', 'sleep', 'resting_hr', 'stress'] as const
  const availableSignals = recoverySignals.filter((signal) => {
    if (signal === 'hrv') return params.wellnessDays.some((day) => day.hrv != null)
    if (signal === 'sleep') return params.wellnessDays.some((day) => day.sleepScore != null)
    if (signal === 'resting_hr') return params.wellnessDays.some((day) => day.restingHr != null)
    return params.wellnessDays.some((day) => day.stress != null)
  })
  const missingSignals = recoverySignals.filter((signal) => !availableSignals.includes(signal))

  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (runs28 >= 8 && hasWellness) confidence = 'high'
  else if (runs28 >= 3) confidence = 'medium'

  return {
    endDate,
    runs14,
    runs28,
    weeklyPatternLabel,
    acwr,
    readiness,
    hasWellness,
    wellnessDaysCount,
    intensity,
    runnerType,
    guardrails,
    availableSignals,
    missingSignals,
    confidence,
    longestRunLabel: resolveLongestRunLabel(params.runs, endDate),
    acwrLabel: mapAcwrLabel(acwr.zone),
  }
}
