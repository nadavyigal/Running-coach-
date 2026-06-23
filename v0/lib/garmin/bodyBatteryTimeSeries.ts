export interface BodyBatteryDailySummary {
  start: number | null
  peak: number | null
  end: number | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function clampBodyBattery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function extractBodyBatteryDailySummary(timeOffsetMap: unknown): BodyBatteryDailySummary {
  if (!timeOffsetMap || typeof timeOffsetMap !== 'object' || Array.isArray(timeOffsetMap)) {
    return { start: null, peak: null, end: null }
  }

  const entries: Array<{ offset: number; value: number }> = []
  for (const [key, rawValue] of Object.entries(timeOffsetMap as Record<string, unknown>)) {
    const offset = Number(key)
    const value = toNumber(rawValue)
    if (!Number.isFinite(offset) || value == null) continue
    entries.push({ offset, value })
  }

  if (entries.length === 0) {
    return { start: null, peak: null, end: null }
  }

  entries.sort((left, right) => left.offset - right.offset)
  const values = entries.map((entry) => clampBodyBattery(entry.value))

  return {
    start: values[0] ?? null,
    peak: values.length > 0 ? Math.max(...values) : null,
    end: values[values.length - 1] ?? null,
  }
}

export function extractBodyBatterySummaryFromStressEntries(entries: unknown[]): BodyBatteryDailySummary | null {
  for (const entry of entries) {
    const summary = extractBodyBatteryDailySummary(asRecord(entry).timeOffsetBodyBatteryValues)
    if (summary.start != null || summary.peak != null || summary.end != null) {
      return summary
    }
  }
  return null
}
