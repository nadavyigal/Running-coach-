export interface GarminNormalizedDailyMetric {
  user_id: number
  auth_user_id: string | null
  date: string
  steps: number | null
  sleep_score: number | null
  sleep_duration_s: number | null
  hrv: number | null
  resting_hr: number | null
  stress: number | null
  body_battery: number | null
  vo2max: number | null
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

function normalizeDate(value: string | null): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

export function normalizeGarminDailyMetric(input: {
  userId: number
  authUserId?: string | null
  raw: unknown
  fallbackDate?: string | null
}): GarminNormalizedDailyMetric | null {
  const record = asRecord(input.raw)
  const date =
    normalizeDate(getString(record.date)) ??
    normalizeDate(getString(record.calendarDate)) ??
    normalizeDate(input.fallbackDate ?? null)

  if (!date) return null

  return {
    user_id: input.userId,
    auth_user_id: input.authUserId ?? null,
    date,
    steps: Math.round(getNumber(record.steps) ?? getNumber(record.totalSteps) ?? 0) || null,
    sleep_score:
      getNumber(record.sleep_score) ??
      getNumber(record.sleepScore) ??
      getNumber(asRecord(asRecord(record.sleepScores).overall).value),
    sleep_duration_s:
      Math.round(getNumber(record.sleep_duration_s) ?? getNumber(record.totalSleepSeconds) ?? 0) || null,
    hrv: getNumber(record.hrv) ?? getNumber(record.hrvValue),
    resting_hr:
      Math.round(
        getNumber(record.resting_hr) ??
          getNumber(record.restingHeartRate) ??
          getNumber(record.restingHeartRateInBeatsPerMinute) ??
          0
      ) || null,
    stress: getNumber(record.stress) ?? getNumber(record.stressLevel) ?? getNumber(record.averageStressLevel),
    body_battery: getNumber(record.body_battery) ?? getNumber(record.bodyBattery) ?? getNumber(record.bodyBatteryMostRecentValue),
    vo2max: getNumber(record.vo2max) ?? getNumber(record.vo2Max),
    calories: getNumber(record.calories) ?? getNumber(record.activeKilocalories),
    raw_json: record,
  }
}

