import { describe, expect, it } from 'vitest'

import {
  deriveGarminRecoverySignals,
  getGarminRecoveryDatasets,
} from '@/lib/garminRecoverySignals'

describe('garminRecoverySignals', () => {
  it('exports expected Garmin recovery helpers', () => {
    expect(typeof deriveGarminRecoverySignals).toBe('function')
    expect(typeof getGarminRecoveryDatasets).toBe('function')
    expect(getGarminRecoveryDatasets().has('dailies')).toBe(true)
  })

  it('derives a stable signal shape from Garmin summary records', () => {
    const signals = deriveGarminRecoverySignals([
      {
        userId: 42,
        datasetKey: 'dailies',
        summaryId: 'daily:2026-02-24',
        source: 'garmin',
        recordedAt: new Date('2026-02-24T06:00:00.000Z'),
        payload: JSON.stringify({
          restingHeartRateInBeatsPerMinute: 52,
          averageStressLevel: 34,
          moderateIntensityDurationInSeconds: 1800,
        }),
        importedAt: new Date('2026-02-24T06:05:00.000Z'),
      },
    ])

    expect(signals).toMatchObject({
      restingHeartRate: 52,
      stressLevel: 34,
      activeMinutes: 30,
      hasSignals: true,
    })
    expect(signals.sourceCounts.dailies).toBe(1)
  })
})

