import type { GarminDailyMetricsRow } from '@/lib/garminWellnessExtractor'

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

function clampBodyBattery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function extractGarminBodyBatteryTimeseries(
  rows: GarminDailyMetricsRow[]
): GarminBodyBatterySample[] {
  const samples = new Map<string, GarminBodyBatterySample>()

  for (const row of rows) {
    const raw = asRecord(row.raw_json)
    const dailiesEntries = asArray(raw.dailies)
    const fallbackDate = row.date

    const directDailyValue = toNumber(row.body_battery)
    if (directDailyValue != null) {
      const timestamp = `${fallbackDate}T12:00:00.000Z`
      samples.set(timestamp, {
        timestamp,
        value: clampBodyBattery(directDailyValue),
        source: 'daily',
      })
    }

    for (const entry of dailiesEntries) {
      const record = asRecord(entry)
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
            value: clampBodyBattery(value),
            source: 'timeseries',
          })
        })
      }
    }
  }

  return Array.from(samples.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

