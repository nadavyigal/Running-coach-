export interface GarminDailyMetricsRow {
  date: string
  body_battery?: number | null
  body_battery_balance?: number | null
  body_battery_charged?: number | null
  body_battery_drained?: number | null
  hrv?: number | null
  sleep_score?: number | null
  resting_hr?: number | null
  stress?: number | null
  raw_json?: unknown
}

export interface GarminWellnessDay {
  date: string
  bodyBattery: number | null
  bodyBatterySource: 'direct' | 'balance' | 'none'
  bodyBatteryBalance: number | null
  bodyBatteryCharged: number | null
  bodyBatteryDrained: number | null
  spo2: number | null
  hrv: number | null
  sleepScore: number | null
  restingHr: number | null
  stress: number | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeStress(value: number | null): number | null {
  if (value == null || value < 0) return null
  if (value <= 10) return Math.max(0, Math.min(100, Math.round(value * 10)))
  return Math.max(0, Math.min(100, Math.round(value)))
}

function firstNumberFromCandidates(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toNumber(record[key])
    if (parsed != null) return parsed
  }
  return null
}

function firstNumberFromDatasetEntries(entries: unknown[], keys: string[]): number | null {
  for (const entry of entries) {
    const record = asRecord(entry)
    const value = firstNumberFromCandidates(record, keys)
    if (value != null) return value
    const nestedValue = firstNumberFromCandidates(asRecord(record.value), keys)
    if (nestedValue != null) return nestedValue
  }
  return null
}

export function extractGarminWellnessDays(rows: GarminDailyMetricsRow[]): GarminWellnessDay[] {
  const result = rows
    .map((row) => {
      const raw = asRecord(row.raw_json)
      const dailiesEntries = asArray(raw.dailies)
      const hrvEntries = asArray(raw.hrv)
      const pulseOxEntries = asArray(raw.pulseox)
      const stressEntries = asArray(raw.stressDetails)

      const bodyBatteryRaw =
        toNumber(row.body_battery) ??
        firstNumberFromDatasetEntries(dailiesEntries, ['bodyBattery', 'bodyBatteryMostRecentValue', 'bodyBatteryValue'])
      const bodyBatteryChargedRaw =
        toNumber(row.body_battery_charged) ??
        firstNumberFromDatasetEntries(dailiesEntries, ['bodyBatteryChargedValue'])
      const bodyBatteryDrainedRaw =
        toNumber(row.body_battery_drained) ??
        firstNumberFromDatasetEntries(dailiesEntries, ['bodyBatteryDrainedValue'])
      const bodyBatteryBalanceRaw =
        toNumber(row.body_battery_balance) ??
        firstNumberFromDatasetEntries(dailiesEntries, ['bodyBatteryBalance']) ??
        (bodyBatteryChargedRaw != null && bodyBatteryDrainedRaw != null
          ? bodyBatteryChargedRaw - bodyBatteryDrainedRaw
          : null)
      const hrvRaw =
        toNumber(row.hrv) ??
        firstNumberFromDatasetEntries(hrvEntries, ['hrvValue', 'dailyAvg', 'lastNightAvg', 'value'])
      const sleepScoreRaw =
        toNumber(row.sleep_score) ??
        firstNumberFromDatasetEntries(asArray(raw.sleeps), ['overallSleepScore', 'sleepScore', 'value'])
      const restingHrRaw =
        toNumber(row.resting_hr) ??
        firstNumberFromDatasetEntries(dailiesEntries, [
          'restingHeartRateInBeatsPerMinute',
          'restingHeartRate',
          'restingHeartRateBpm',
        ])
      const stressRaw =
        toNumber(row.stress) ??
        firstNumberFromDatasetEntries(stressEntries, ['stressLevel', 'averageStressLevel', 'stressLevelValue']) ??
        firstNumberFromDatasetEntries(dailiesEntries, ['averageStressLevel', 'stressLevel', 'overallStressLevel'])
      const spo2Raw = firstNumberFromDatasetEntries(pulseOxEntries, [
        'averageSpo2',
        'avgSpo2',
        'spo2',
        'spo2Value',
        'latestSpo2',
        'value',
      ])

      return {
        date: row.date,
        bodyBattery: bodyBatteryRaw != null ? Math.max(0, Math.min(100, Math.round(bodyBatteryRaw))) : null,
        bodyBatterySource: bodyBatteryRaw != null ? 'direct' : bodyBatteryBalanceRaw != null ? 'balance' : 'none',
        bodyBatteryBalance:
          bodyBatteryBalanceRaw != null ? Number(bodyBatteryBalanceRaw.toFixed(2)) : null,
        bodyBatteryCharged:
          bodyBatteryChargedRaw != null ? Number(bodyBatteryChargedRaw.toFixed(2)) : null,
        bodyBatteryDrained:
          bodyBatteryDrainedRaw != null ? Number(bodyBatteryDrainedRaw.toFixed(2)) : null,
        spo2: spo2Raw != null ? Math.max(50, Math.min(100, Math.round(spo2Raw))) : null,
        hrv: hrvRaw != null ? Math.max(0, Number(hrvRaw.toFixed(2))) : null,
        sleepScore: sleepScoreRaw != null ? Math.max(0, Math.min(100, Math.round(sleepScoreRaw))) : null,
        restingHr: restingHrRaw != null ? Math.max(20, Math.min(120, Math.round(restingHrRaw))) : null,
        stress: normalizeStress(stressRaw),
      } satisfies GarminWellnessDay
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return result
}

