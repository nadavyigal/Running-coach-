import { trackAnalyticsEvent } from '@/lib/analytics'

export type NudgeConfidence = 'high' | 'medium' | 'low'

export interface NudgeEligibilityInput {
  userId: number
  optedIn: boolean
  confidence: NudgeConfidence
  readinessState?: 'ready' | 'steady' | 'caution' | null
  lastNudgeAt?: string | null
  cooldownHours?: number
}

export interface NudgeEligibilityResult {
  eligible: boolean
  reason: string
}

export interface ConfidenceNudge {
  title: string
  body: string
  cta: string
}

function hoursSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const parsed = Date.parse(isoDate)
  if (!Number.isFinite(parsed)) return null
  return (Date.now() - parsed) / (1000 * 60 * 60)
}

export function shouldSendConfidenceNudge(input: NudgeEligibilityInput): NudgeEligibilityResult {
  if (!input.optedIn) {
    return { eligible: false, reason: 'user_opted_out' }
  }

  if (input.confidence === 'low') {
    return { eligible: false, reason: 'confidence_below_medium' }
  }

  const cooldownHours = Math.max(1, input.cooldownHours ?? 20)
  const age = hoursSince(input.lastNudgeAt)
  if (age != null && age < cooldownHours) {
    return { eligible: false, reason: 'cooldown_active' }
  }

  return { eligible: true, reason: 'eligible' }
}

export function buildConfidenceNudge(input: {
  confidence: NudgeConfidence
  readinessState?: 'ready' | 'steady' | 'caution' | null
}): ConfidenceNudge {
  if (input.readinessState === 'ready') {
    return {
      title: 'You are trending ready',
      body: 'Confidence is strong enough to complete a short focused run today.',
      cta: 'Start today\'s run',
    }
  }

  if (input.readinessState === 'caution') {
    return {
      title: 'Protect consistency with an easy day',
      body: 'Confidence is reliable, and a light session keeps your streak without forcing intensity.',
      cta: 'Log an easy effort',
    }
  }

  return {
    title: 'Keep the habit loop alive',
    body: 'Confidence is sufficient for a steady session. Prioritize completion over pace.',
    cta: 'Mark today complete',
  }
}

export async function emitNudgeSent(params: {
  userId: number
  channel: 'in_app' | 'push' | 'email'
  confidence: NudgeConfidence
  readinessState?: 'ready' | 'steady' | 'caution' | null
}): Promise<void> {
  await trackAnalyticsEvent('nudge_sent', {
    user_id: params.userId,
    channel: params.channel,
    confidence: params.confidence,
    readiness_state: params.readinessState ?? 'unknown',
  })
}

export async function emitNudgeClicked(params: {
  userId: number
  nudgeId: string
  destination?: string
}): Promise<void> {
  await trackAnalyticsEvent('nudge_clicked', {
    user_id: params.userId,
    nudge_id: params.nudgeId,
    destination: params.destination ?? null,
  })
}

export async function emitNudgeOptOut(params: {
  userId: number
  source: 'settings' | 'notification'
}): Promise<void> {
  await trackAnalyticsEvent('nudge_opt_out', {
    user_id: params.userId,
    source: params.source,
  })
}
