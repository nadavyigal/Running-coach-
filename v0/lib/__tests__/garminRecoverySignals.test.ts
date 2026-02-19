import { describe, expect, it } from 'vitest'
import type { GarminSummaryRecord } from '@/lib/db'
import { deriveGarminRecoverySignals } from '@/lib/garminRecoverySignals'

function makeRecord(
  datasetKey: GarminSummaryRecord['datasetKey'],
  payload: Record<string, unknown>
): GarminSummaryRecord {
  return {
    userId: 1,
    datasetKey,
    summaryId: `${datasetKey}-1`,
    source: 'garmin',
    recordedAt: new Date('2026-02-19T08:00:00.000Z'),
    payload: JSON.stringify(payload),
    importedAt: new Date('2026-02-19T08:01:00.000Z'),
  }
}

describe('deriveGarminRecoverySignals', () => {
  it('extracts resting HR, stress, respiration and active minutes from Garmin summary rows', () => {
    const records: GarminSummaryRecord[] = [
      makeRecord('dailies', {
        restingHeartRateInBeatsPerMinute: 54,
        averageStressLevel: 34,
        moderateIntensityDurationInSeconds: 1800,
        vigorousIntensityDurationInSeconds: 600,
      }),
      makeRecord('stressDetails', {
        stressLevels: [30, 40, 50],
      }),
      makeRecord('epochs', {
        stressLevelValue: 6, // should normalize to 60
        activeTimeInSeconds: 1200,
      }),
      makeRecord('allDayRespiration', {
        avgWakingRespirationValue: 16.8,
      }),
    ]

    const signals = deriveGarminRecoverySignals(records)

    expect(signals.hasSignals).toBe(true)
    expect(signals.restingHeartRate).toBe(54)
    expect(signals.stressLevel).toBeGreaterThanOrEqual(40)
    expect(signals.respirationRate).toBeCloseTo(16.8, 1)
    expect(signals.activeMinutes).toBe(60)
    expect(signals.sourceCounts.dailies).toBe(1)
    expect(signals.sourceCounts.stressDetails).toBe(1)
    expect(signals.sourceCounts.epochs).toBe(1)
    expect(signals.sourceCounts.allDayRespiration).toBe(1)
  })

  it('returns empty signals when payloads are invalid', () => {
    const records: GarminSummaryRecord[] = [
      {
        userId: 1,
        datasetKey: 'dailies',
        summaryId: 'dailies-1',
        source: 'garmin',
        recordedAt: new Date('2026-02-19T08:00:00.000Z'),
        payload: '{bad-json',
        importedAt: new Date('2026-02-19T08:01:00.000Z'),
      },
    ]

    const signals = deriveGarminRecoverySignals(records)
    expect(signals.hasSignals).toBe(false)
    expect(signals.restingHeartRate).toBeNull()
    expect(signals.stressLevel).toBeNull()
    expect(signals.respirationRate).toBeNull()
    expect(signals.activeMinutes).toBeNull()
  })
})
