export interface GarminNormalizedActivity {
  user_id: number
  auth_user_id: string | null
  activity_id: string
  start_time: string | null
  sport: string | null
  duration_s: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_pace: number | null
  elevation_gain_m: number | null
  calories: number | null
  raw_json: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function parseStartTime(record: Record<string, unknown>): string | null {
  const candidate = getString(record.startTimeGMT) ?? getString(record.start_time) ?? getString(record.startTimeLocal)
  if (!candidate) return null
  const parsed = Date.parse(candidate)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

export function normalizeGarminActivity(input: {
  userId: number
  authUserId?: string | null
  raw: unknown
}): GarminNormalizedActivity | null {
  const record = asRecord(input.raw)
  const activityId =
    getString(record.activityId) ??
    getString(record.activity_id) ??
    getString(record.summaryId)

  if (!activityId) return null

  const distanceKm = getNumber(record.distance)
  const distanceM =
    distanceKm != null
      ? Number((distanceKm * 1000).toFixed(2))
      : getNumber(record.distanceInMeters) ?? getNumber(record.distance_m)

  return {
    user_id: input.userId,
    auth_user_id: input.authUserId ?? null,
    activity_id: activityId,
    start_time: parseStartTime(record),
    sport: getString(record.activityType) ?? getString(record.sport),
    duration_s: Math.round(getNumber(record.duration) ?? getNumber(record.duration_s) ?? 0) || null,
    distance_m: distanceM,
    avg_hr: Math.round(getNumber(record.averageHR) ?? getNumber(record.avg_hr) ?? 0) || null,
    max_hr: Math.round(getNumber(record.maxHR) ?? getNumber(record.max_hr) ?? 0) || null,
    avg_pace: getNumber(record.averagePace) ?? getNumber(record.avg_pace),
    elevation_gain_m: getNumber(record.elevationGain) ?? getNumber(record.elevation_gain_m),
    calories: getNumber(record.calories),
    raw_json: record,
  }
}

