import { describe, expect, it } from 'vitest'

import { computeDeterministicReadiness } from '@/lib/garmin/metrics/readiness'

describe('computeDeterministicReadiness', () => {
  it('returns deterministic score/state/drivers for the same input', () => {
    const input = {
      samples: [
        {
          date: '2026-01-28',
          hrv: 58,
          resting_hr: 50,
          sleep_score: 76,
          stress: 35,
          body_battery: 68,
        },
        {
          date: '2026-02-24',
          hrv: 64,
          resting_hr: 48,
          sleep_score: 82,
          stress: 29,
          body_battery: 74,
        },
      ],
      lastSyncAt: '2026-02-24T08:00:00.000Z',
      load: {
        acuteLoad7d: 380,
        chronicLoad28d: 340,
        acwr: 1.12,
      },
    }

    const first = computeDeterministicReadiness(input)
    const second = computeDeterministicReadiness(input)

    expect(second).toEqual(first)
    expect(first.score).toBeGreaterThanOrEqual(0)
    expect(first.score).toBeLessThanOrEqual(100)
    expect(first.state).toBeTypeOf('string')
    expect(first.drivers.length).toBeGreaterThanOrEqual(5)
    expect(first.missingSignals).toEqual([])
  })
})
