import type { ReadinessBaseline } from '@/lib/garmin/metrics/baseline'

export interface UnderRecoverySignalSnapshot {
  hrv: number | null
  resting_hr: number | null
  sleep_score: number | null
  stress: number | null
  body_battery: number | null
}

export interface UnderRecoveryResult {
  flagged: boolean
  triggerCount: number
  triggers: string[]
  confidence: 'high' | 'medium' | 'low'
  recommendation: string
}

function percentDelta(current: number, baseline: number): number {
  if (!Number.isFinite(baseline) || baseline === 0) return 0
  return ((current - baseline) / baseline) * 100
}

export function evaluateUnderRecoverySignature(params: {
  today: UnderRecoverySignalSnapshot
  baseline: ReadinessBaseline
}): UnderRecoveryResult {
  const { today, baseline } = params
  const triggers: string[] = []

  if (today.hrv != null && baseline.hrv != null) {
    const hrvDeltaPct = percentDelta(today.hrv, baseline.hrv)
    if (hrvDeltaPct <= -8) {
      triggers.push(`HRV is ${Math.abs(Math.round(hrvDeltaPct))}% below baseline.`)
    }
  }

  if (today.resting_hr != null && baseline.resting_hr != null) {
    const rhrDelta = today.resting_hr - baseline.resting_hr
    if (rhrDelta >= 4) {
      triggers.push(`Resting HR is ${Math.round(rhrDelta)} bpm above baseline.`)
    }
  }

  if (today.sleep_score != null && today.sleep_score <= 65) {
    triggers.push('Sleep score is below 65.')
  }

  if (today.stress != null && today.stress >= 65) {
    triggers.push('Stress is elevated above 65.')
  }

  if (today.body_battery != null && today.body_battery <= 35) {
    triggers.push('Body battery is low (35 or below).')
  }

  const triggerCount = triggers.length
  const flagged = triggerCount >= 2

  const confidence: 'high' | 'medium' | 'low' =
    triggerCount >= 3 ? 'high' : triggerCount === 2 ? 'medium' : 'low'

  const recommendation = flagged
    ? 'Consider reducing intensity and prioritizing recovery today.'
    : 'No clear under-recovery signature detected right now.'

  return {
    flagged,
    triggerCount,
    triggers,
    confidence,
    recommendation,
  }
}
