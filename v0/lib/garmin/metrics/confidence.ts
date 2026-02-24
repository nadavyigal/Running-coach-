export type ReadinessConfidence = 'high' | 'medium' | 'low'

export interface ConfidenceInput {
  baselineSampleCount: number
  availableSignalsToday: number
  lastSyncAt: string | null
}

export interface ConfidenceResult {
  confidence: ReadinessConfidence
  confidenceReason: string
}

function hoursSince(isoDate: string | null): number | null {
  if (!isoDate) return null
  const parsed = Date.parse(isoDate)
  if (!Number.isFinite(parsed)) return null
  return (Date.now() - parsed) / (1000 * 60 * 60)
}

export function calculateReadinessConfidence(input: ConfidenceInput): ConfidenceResult {
  const syncAgeHours = hoursSince(input.lastSyncAt)

  if (input.availableSignalsToday >= 4 && input.baselineSampleCount >= 21 && syncAgeHours != null && syncAgeHours <= 24) {
    return {
      confidence: 'high',
      confidenceReason: 'Strong signal coverage with a fresh sync in the last 24 hours.',
    }
  }

  if (input.availableSignalsToday >= 2 && input.baselineSampleCount >= 10 && syncAgeHours != null && syncAgeHours <= 72) {
    return {
      confidence: 'medium',
      confidenceReason: 'Partial signal coverage with sync freshness within 72 hours.',
    }
  }

  if (input.availableSignalsToday === 0) {
    return {
      confidence: 'low',
      confidenceReason: 'No recovery signals are available for today.',
    }
  }

  return {
    confidence: 'low',
    confidenceReason: 'Limited baseline coverage or stale sync reduces confidence.',
  }
}
