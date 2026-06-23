import type { GarminDailyMetricsRow } from '@/lib/garminWellnessExtractor'
import { clampBodyBattery } from '@/lib/garmin/bodyBatteryTimeSeries'

export interface GarminBodyBatterySample {
  timestamp: string
  value: number
  source: 'daily' | 'timeseries'
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

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }

  const numeric = toNumber(value)
  if (numeric == null) return null
  if (numeric > 1000000000000) return new Date(numeric).toISOString()
  if (numeric > 1000000000) return new Date(numeric * 1000).toISOString()
  return null
}

function resolveSampleTimestamp(sample: Record<string, unknown>, fallbackDate: string, index: number): string {
  const direct = [
    sample.timestamp,
    sample.sampleTime,
    sample.sampleTimestamp,
    sample.time,
    sample.timeInSeconds,
    sample.startTimeInSeconds,
    sample.startTime,
  ]
    .map((candidate) => toIsoTimestamp(candidate))
    .find((candidate): candidate is string => candidate != null)

  if (direct) return direct
  return `${fallbackDate}T12:${String(index % 60).padStart(2, '0')}:00.000Z`
}

function clampBodyBatteryValue(value: number): number {
  return clampBodyBattery(value)
}

export function extractGarminBodyBatteryTimeseries(
  rows: GarminDailyMetricsRow[]
): GarminBodyBatterySample[] {
  const samples = new Map<string, GarminBodyBatterySample>()

  for (const row of rows) {
    const raw = asRecord(row.raw_json)
    const dailiesEntries = asArray(raw.dailies)
    const stressDetailsEntries = asArray(raw.stressDetails)
    const fallbackDate = row.date

    const storedEnd = toNumber(row.body_battery_end) ?? toNumber(row.body_battery)
    if (storedEnd != null) {
      const timestamp = `${fallbackDate}T23:59:00.000Z`
      samples.set(timestamp, {
        timestamp,
        value: clampBodyBatteryValue(storedEnd),
        source: 'daily',
      })
    }

    for (const entry of stressDetailsEntries) {
      const record = asRecord(entry)
      const startTimeSeconds = toNumber(record.startTimeInSeconds)
      const timeOffsetMap = record.timeOffsetBodyBatteryValues
      if (!timeOffsetMap || typeof timeOffsetMap !== 'object' || Array.isArray(timeOffsetMap)) continue

      const dayStartSeconds =
        startTimeSeconds ??
        Math.floor(Date.parse(`${fallbackDate}T00:00:00.000Z`) / 1000)
      if (!Number.isFinite(dayStartSeconds)) continue

      for (const [offsetKey, rawValue] of Object.entries(timeOffsetMap as Record<string, unknown>)) {
        const offset = Number(offsetKey)
        const value = toNumber(rawValue)
        if (!Number.isFinite(offset) || value == null) continue

        const timestamp = new Date((dayStartSeconds + offset) * 1000).toISOString()
        samples.set(timestamp, {
          timestamp,
          value: clampBodyBatteryValue(value),
          source: 'timeseries',
        })
      }
    }

    for (const entry of dailiesEntries) {
      const record = asRecord(entry)
      const directFromDaily =
        toNumber(record.bodyBattery) ??
        toNumber(record.bodyBatteryMostRecentValue) ??
        toNumber(record.bodyBatteryValue)
      if (directFromDaily != null) {
        const timestamp = resolveSampleTimestamp(record, fallbackDate, 0)
        samples.set(timestamp, {
          timestamp,
          value: clampBodyBatteryValue(directFromDaily),
          source: 'daily',
        })
      }

      const arrays = [
        asArray(record.bodyBatteryValues),
        asArray(record.bodyBatteryValuesArray),
        asArray(record.bodyBatterySamples),
      ]

      for (const series of arrays) {
        series.forEach((sampleValue, index) => {
          const sample = asRecord(sampleValue)
          const value =
            toNumber(sample.value) ??
            toNumber(sample.bodyBattery) ??
            toNumber(sample.bodyBatteryValue) ??
            (typeof sampleValue === 'number' ? sampleValue : null)
          if (value == null) return

          const timestamp = resolveSampleTimestamp(sample, fallbackDate, index)
          samples.set(timestamp, {
            timestamp,
            value: clampBodyBatteryValue(value),
            source: 'timeseries',
          })
        })
      }
    }
  }

  return Array.from(samples.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

