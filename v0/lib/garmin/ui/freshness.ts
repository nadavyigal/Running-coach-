export type GarminFreshnessLabel = 'fresh' | 'stale' | 'outdated' | 'unknown'
export type GarminConfidenceLabel = 'high' | 'medium' | 'low'

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getGarminFreshnessLabel(lastSyncAt: string | null | undefined): GarminFreshnessLabel {
  const parsed = parseIso(lastSyncAt)
  if (parsed == null) return 'unknown'

  const ageMs = Date.now() - parsed
  const dayMs = 24 * 60 * 60 * 1000

  if (ageMs <= dayMs) return 'fresh'
  if (ageMs <= 3 * dayMs) return 'stale'
  return 'outdated'
}

export function getGarminConfidenceLabel(lastSyncAt: string | null | undefined): GarminConfidenceLabel {
  const freshness = getGarminFreshnessLabel(lastSyncAt)
  if (freshness === 'fresh') return 'high'
  if (freshness === 'stale') return 'medium'
  return 'low'
}

