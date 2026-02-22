import type { GarminSummaryRecord } from './db'

export type GarminRecoveryDatasetKey =
  | 'dailies'
  | 'stressDetails'
  | 'epochs'
  | 'allDayRespiration'

export interface GarminRecoverySignals {
  restingHeartRate: number | null
  stressLevel: number | null
  respirationRate: number | null
  activeMinutes: number | null
  sourceCounts: Record<GarminRecoveryDatasetKey, number>
  hasSignals: boolean
}

const RECOVERY_DATASETS: GarminRecoveryDatasetKey[] = [
  'dailies',
  'stressDetails',
  'epochs',
  'allDayRespiration',
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getValueAtPath(record: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = record
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pickFirstNumber(record: Record<string, unknown>, candidates: string[]): number | null {
  for (const path of candidates) {
    const parsed = toNumber(getValueAtPath(record, path))
    if (parsed != null) return parsed
  }
  return null
}

function pickNumbersFromArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (typeof entry === 'number') return entry
      if (typeof entry === 'string') {
        const parsed = Number(entry)
        return Number.isFinite(parsed) ? parsed : null
      }
      const parsedFromObject = pickFirstNumber(asRecord(entry), ['value', 'stressLevel', 'respiration'])
      return parsedFromObject
    })
    .filter((entry): entry is number => entry != null && Number.isFinite(entry))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeStress(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  if (value <= 10) return clamp(Math.round(value * 10), 0, 100)
  if (value <= 100) return clamp(Math.round(value), 0, 100)
  return null
}

function normalizeRespiration(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value < 4 || value > 40) return null
  return Number(value.toFixed(1))
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function parsePayload(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload)
    return asRecord(parsed)
  } catch {
    return null
  }
}

export function getGarminRecoveryDatasets(): ReadonlySet<string> {
  return new Set(RECOVERY_DATASETS)
}

export function deriveGarminRecoverySignals(records: GarminSummaryRecord[]): GarminRecoverySignals {
  const sourceCounts: Record<GarminRecoveryDatasetKey, number> = {
    dailies: 0,
    stressDetails: 0,
    epochs: 0,
    allDayRespiration: 0,
  }

  const restingHrValues: number[] = []
  const stressValues: number[] = []
  const respirationValues: number[] = []
  let activeMinutes = 0

  for (const record of records) {
    if (!RECOVERY_DATASETS.includes(record.datasetKey as GarminRecoveryDatasetKey)) continue
    const payload = parsePayload(record.payload)
    if (!payload) continue

    const datasetKey = record.datasetKey as GarminRecoveryDatasetKey
    sourceCounts[datasetKey] += 1

    if (datasetKey === 'dailies') {
      const restingHeartRate = pickFirstNumber(payload, [
        'restingHeartRateInBeatsPerMinute',
        'restingHeartRate',
        'restingHeartRateBpm',
        'restingHeartRateInBpm',
      ])
      if (restingHeartRate != null) restingHrValues.push(restingHeartRate)

      const stress = normalizeStress(
        pickFirstNumber(payload, [
          'averageStressLevel',
          'avgStressLevel',
          'stressLevel',
          'overallStressLevel',
        ])
      )
      if (stress != null) stressValues.push(stress)

      const moderateSeconds = pickFirstNumber(payload, ['moderateIntensityDurationInSeconds'])
      const vigorousSeconds = pickFirstNumber(payload, ['vigorousIntensityDurationInSeconds'])
      if (moderateSeconds != null || vigorousSeconds != null) {
        activeMinutes += ((moderateSeconds ?? 0) + (vigorousSeconds ?? 0)) / 60
      }
    }

    if (datasetKey === 'stressDetails' || datasetKey === 'epochs') {
      const stressCandidate = normalizeStress(
        pickFirstNumber(payload, [
          'stressLevel',
          'stressLevelValue',
          'averageStressLevel',
          'avgStressLevel',
          'maxStressLevel',
        ])
      )
      if (stressCandidate != null) stressValues.push(stressCandidate)

      const stressSeries = [
        ...pickNumbersFromArray(payload.stressLevels),
        ...pickNumbersFromArray(payload.stressValues),
      ]
      for (const sample of stressSeries) {
        const normalized = normalizeStress(sample)
        if (normalized != null) stressValues.push(normalized)
      }
    }

    if (datasetKey === 'epochs') {
      const explicitEpochSeconds = pickFirstNumber(payload, [
        'activeTimeInSeconds',
        'activityTimeInSeconds',
      ])
      const moderateSeconds = pickFirstNumber(payload, ['moderateIntensityDurationInSeconds'])
      const vigorousSeconds = pickFirstNumber(payload, ['vigorousIntensityDurationInSeconds'])
      const derivedEpochSeconds = explicitEpochSeconds ?? ((moderateSeconds ?? 0) + (vigorousSeconds ?? 0))
      if (derivedEpochSeconds > 0) {
        activeMinutes += derivedEpochSeconds / 60
      }
    }

    if (datasetKey === 'allDayRespiration' || datasetKey === 'epochs') {
      const respiration = normalizeRespiration(
        pickFirstNumber(payload, [
          'respiration',
          'respirationValue',
          'respirationRate',
          'avgWakingRespirationValue',
          'avgSleepRespirationValue',
          'averageRespiration',
        ])
      )
      if (respiration != null) respirationValues.push(respiration)

      const respirationSeries = [
        ...pickNumbersFromArray(payload.respirationValues),
        ...pickNumbersFromArray(payload.samples),
      ]
      for (const sample of respirationSeries) {
        const normalized = normalizeRespiration(sample)
        if (normalized != null) respirationValues.push(normalized)
      }
    }
  }

  const restingHeartRate = average(restingHrValues)
  const stressLevel = average(stressValues)
  const respirationRate = average(respirationValues)
  const normalizedActiveMinutes = Number.isFinite(activeMinutes) && activeMinutes > 0
    ? Math.round(activeMinutes)
    : null

  return {
    restingHeartRate: restingHeartRate != null ? Math.round(restingHeartRate) : null,
    stressLevel: stressLevel != null ? Math.round(stressLevel) : null,
    respirationRate: respirationRate != null ? Number(respirationRate.toFixed(1)) : null,
    activeMinutes: normalizedActiveMinutes,
    sourceCounts,
    hasSignals:
      restingHeartRate != null ||
      stressLevel != null ||
      respirationRate != null ||
      normalizedActiveMinutes != null,
  }
}
