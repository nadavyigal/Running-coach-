export interface DailySignalSample {
  date: string
  hrv: number | null
  resting_hr: number | null
  sleep_score: number | null
  stress: number | null
  body_battery: number | null
}

export interface ReadinessBaseline {
  hrv: number | null
  resting_hr: number | null
  sleep_score: number | null
  stress: number | null
  body_battery: number | null
  sampleCount: number
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function toIsoDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value.slice(0, 10)
  return new Date(parsed).toISOString().slice(0, 10)
}

export function compute28DayBaseline(samples: DailySignalSample[]): ReadinessBaseline {
  if (samples.length === 0) {
    return {
      hrv: null,
      resting_hr: null,
      sleep_score: null,
      stress: null,
      body_battery: null,
      sampleCount: 0,
    }
  }

  const sorted = [...samples].sort((a, b) => toIsoDate(a.date).localeCompare(toIsoDate(b.date)))
  const window = sorted.slice(Math.max(0, sorted.length - 28))

  const sampleCount = window.filter(
    (row) =>
      row.hrv != null ||
      row.resting_hr != null ||
      row.sleep_score != null ||
      row.stress != null ||
      row.body_battery != null
  ).length

  return {
    hrv: average(window.map((row) => row.hrv)),
    resting_hr: average(window.map((row) => row.resting_hr)),
    sleep_score: average(window.map((row) => row.sleep_score)),
    stress: average(window.map((row) => row.stress)),
    body_battery: average(window.map((row) => row.body_battery)),
    sampleCount,
  }
}
