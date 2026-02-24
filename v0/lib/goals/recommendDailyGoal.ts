import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

export type DailyGoalEffort = 'easy' | 'steady' | 'quality'

export interface DailyGoalRecommendation {
  title: string
  summary: string
  targetRunsThisWeek: number
  remainingRunsThisWeek: number
  todayFocus: string
  effort: DailyGoalEffort
  confidenceGateMet: boolean
  rationale: string
}

interface RecommendDailyGoalInput {
  readiness: Pick<ReadinessApiResponse, 'score' | 'state' | 'confidence' | 'confidenceReason'> | null
  runsCompleted: number
  plannedRuns: number
}

const MIN_RELIABLE_CONFIDENCE = new Set<ReadinessApiResponse['confidence']>(['high', 'medium'])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function recommendDailyGoal(input: RecommendDailyGoalInput): DailyGoalRecommendation {
  const plannedRuns = Math.max(1, input.plannedRuns)
  const completedRuns = Math.max(0, input.runsCompleted)

  const confidenceGateMet = input.readiness ? MIN_RELIABLE_CONFIDENCE.has(input.readiness.confidence) : false

  if (!input.readiness) {
    const remaining = Math.max(0, plannedRuns - completedRuns)
    return {
      title: 'Weekly Goal: Stay Consistent',
      summary: 'Readiness is unavailable, so keep today easy and maintain the current weekly target.',
      targetRunsThisWeek: plannedRuns,
      remainingRunsThisWeek: remaining,
      todayFocus: remaining > 0 ? 'Complete an easy run today.' : 'Use today for light recovery or mobility.',
      effort: 'steady',
      confidenceGateMet: false,
      rationale: 'No readiness payload available.',
    }
  }

  const { score, state, confidence, confidenceReason } = input.readiness

  let targetRuns = plannedRuns
  let effort: DailyGoalEffort = 'steady'
  let summary = 'Hold your plan and prioritize consistency.'

  if (state === 'caution' || score < 55) {
    targetRuns = Math.max(completedRuns, plannedRuns - 1)
    effort = 'easy'
    summary = 'Dial the effort down today and protect recovery while preserving the streak loop.'
  } else if (state === 'ready' && confidenceGateMet) {
    targetRuns = clamp(plannedRuns + 1, plannedRuns, plannedRuns + 2)
    effort = 'quality'
    summary = 'Readiness supports a modest stretch this week. Add one optional quality session only if effort feels controlled.'
  }

  if (!confidenceGateMet) {
    targetRuns = Math.max(completedRuns, plannedRuns)
    effort = 'steady'
    summary = 'Confidence is limited, so keep the original weekly target and avoid aggressive increases.'
  }

  const remainingRuns = Math.max(0, targetRuns - completedRuns)

  return {
    title: 'Weekly Goal Recommendation',
    summary,
    targetRunsThisWeek: targetRuns,
    remainingRunsThisWeek: remainingRuns,
    todayFocus:
      effort === 'quality'
        ? 'If energy stays stable, complete one quality session. Stop early if form fades.'
        : effort === 'easy'
          ? 'Choose an easy run or brisk walk to keep momentum without strain.'
          : 'Complete a steady run at conversational effort.',
    effort,
    confidenceGateMet,
    rationale: `Readiness ${state} (${score}/100), confidence ${confidence}. ${confidenceReason}`,
  }
}
