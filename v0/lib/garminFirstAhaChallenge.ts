import type { GuardrailLevel, RunnerTypeId } from '@/lib/garminFirstAhaTypes'
import { CHALLENGE_TEMPLATES } from '@/lib/challengeTemplates'

export interface RecommendedChallenge {
  id: string
  title: string
  reason: string
  fitScoreLabel: string
}

function templateBySlug(slug: string) {
  return CHALLENGE_TEMPLATES.find((entry) => entry.slug === slug)
}

export function selectRecommendedChallenge(params: {
  runnerType: RunnerTypeId
  guardrailLevel: GuardrailLevel
  runs28: number
  gapDays: number | null
}): RecommendedChallenge {
  let slug = 'start-running'
  let reason = 'A gentle consistency challenge fits your current run frequency.'
  let fitScoreLabel = 'Good fit'

  if (params.gapDays != null && params.gapDays >= 14) {
    slug = 'start-running'
    reason = 'You have a recent gap in running, so a return-to-running challenge is the safest next step.'
    fitScoreLabel = 'Strong fit'
  } else if (params.runnerType === 'overreaching_risk' || params.guardrailLevel === 'yellow') {
    slug = 'plateau-breaker'
    reason = 'Your recent pattern suggests dialing back intensity before chasing more volume.'
    fitScoreLabel = 'Strong fit'
  } else if (params.runnerType === 'consistent_base_builder') {
    slug = 'morning-ritual'
    reason = 'Your base looks steady, so a consistency ritual can reinforce easy, repeatable runs.'
    fitScoreLabel = 'Strong fit'
  } else if (params.runnerType === 'race_focused') {
    slug = 'plateau-breaker'
    reason = 'You already train often; this challenge keeps structure without adding reckless load.'
    fitScoreLabel = 'Good fit'
  } else if (params.runs28 >= 3 && params.runs28 < 8) {
    slug = 'start-running'
    reason = 'You are building frequency, so a short consistency challenge matches your pattern.'
    fitScoreLabel = 'Strong fit'
  }

  const template = templateBySlug(slug) ?? templateBySlug('start-running')
  return {
    id: slug,
    title: template?.name ?? 'Start Running Challenge',
    reason,
    fitScoreLabel,
  }
}
