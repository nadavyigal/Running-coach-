import {
  analyzeGarminFirstAhaInputs,
  buildProfileSummary,
  buildStarterPlan,
  shiftIsoDate,
} from '@/lib/garminFirstAhaPlan'
import { selectRecommendedChallenge } from '@/lib/garminFirstAhaChallenge'
import {
  MEDICAL_DISCLAIMER,
  RUNNER_TYPE_LABELS,
  type GarminFirstAhaResult,
  type GarminFirstAhaRunInput,
  type GarminFirstAhaStatus,
  type GarminFirstAhaWellnessDay,
} from '@/lib/garminFirstAhaTypes'

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
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
  return Math.round((endMs - latestMs) / (24 * 60 * 60 * 1000))
}

export function buildGarminFirstAhaResult(params: {
  runs: GarminFirstAhaRunInput[]
  wellnessDays: GarminFirstAhaWellnessDay[]
  endDate?: string
  generatedAt?: string
}): GarminFirstAhaResult {
  const generatedAt = params.generatedAt ?? new Date().toISOString()
  const analysis = analyzeGarminFirstAhaInputs(params)

  let status: GarminFirstAhaStatus = 'ready'
  if (analysis.runs28 === 0) {
    status = 'insufficient_data'
  } else if (analysis.runs28 < 3 || !analysis.hasWellness) {
    status = 'partial'
  }

  const profileSummary = buildProfileSummary({
    runnerType: analysis.runnerType,
    runs14: analysis.runs14,
    runs28: analysis.runs28,
    weeklyPatternLabel: analysis.weeklyPatternLabel,
    guardrailMessage: analysis.guardrails.message,
    confidence: analysis.confidence,
  })

  const startDate = shiftIsoDate(analysis.endDate, 1)
  const starterPlan = buildStarterPlan({
    runnerType: analysis.runnerType,
    guardrailLevel: analysis.guardrails.level,
    runs28: analysis.runs28,
    startDate,
  })

  const recommendedChallenge = selectRecommendedChallenge({
    runnerType: analysis.runnerType,
    guardrailLevel: analysis.guardrails.level,
    runs28: analysis.runs28,
    gapDays: daysSinceLastRun(params.runs, analysis.endDate),
  })

  const disclaimers = [MEDICAL_DISCLAIMER]
  if (!analysis.hasWellness) {
    disclaimers.push('Recovery insights are limited because wellness data is not available yet.')
  }
  if (analysis.runs28 < 3) {
    disclaimers.push('Run history is still limited, so recommendations stay conservative.')
  }

  return {
    status,
    generatedAt,
    dataWindow: {
      activitiesDays: 28,
      ...(analysis.wellnessDaysCount > 0 ? { wellnessDays: analysis.wellnessDaysCount } : {}),
    },
    profile: {
      runnerType: RUNNER_TYPE_LABELS[analysis.runnerType],
      headline: profileSummary.headline,
      summaryBullets: profileSummary.summaryBullets,
      confidence: analysis.confidence,
    },
    signals: {
      consistency: {
        runsLast14Days: analysis.runs14,
        runsLast28Days: analysis.runs28,
        weeklyPatternLabel: analysis.weeklyPatternLabel,
      },
      load: {
        ...(analysis.longestRunLabel ? { longestRunLabel: analysis.longestRunLabel } : {}),
        acwrLabel: analysis.acwrLabel,
        weeklyDistanceTrend:
          analysis.acwr.zone === 'elevated' || analysis.acwr.zone === 'high'
            ? 'Recent volume trending up'
            : 'Recent volume looks steady',
      },
      intensity: {
        label: analysis.intensity.label,
        ...(analysis.intensity.easyShare != null ? { easyShare: analysis.intensity.easyShare } : {}),
        ...(analysis.intensity.hardShare != null ? { hardShare: analysis.intensity.hardShare } : {}),
        source: analysis.intensity.source,
      },
      ...(analysis.hasWellness
        ? {
            recovery: {
              readinessLabel: analysis.readiness.label,
              availableSignals: [...analysis.availableSignals],
              missingSignals: [...analysis.missingSignals],
            },
          }
        : {}),
    },
    guardrails: analysis.guardrails,
    starterPlan,
    recommendedChallenge,
    disclaimers,
  }
}
