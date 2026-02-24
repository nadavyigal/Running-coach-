import { describe, expect, it } from 'vitest'

import { evaluateUnderRecoverySignature } from '@/lib/garmin/metrics/underRecovery'

describe('evaluateUnderRecoverySignature', () => {
  it('flags only when multiple signals align', () => {
    const flagged = evaluateUnderRecoverySignature({
      today: {
        hrv: 42,
        resting_hr: 57,
        sleep_score: 58,
        stress: 72,
        body_battery: 30,
      },
      baseline: {
        hrv: 55,
        resting_hr: 50,
        sleep_score: 75,
        stress: 40,
        body_battery: 62,
        sampleCount: 24,
      },
    })

    const notFlagged = evaluateUnderRecoverySignature({
      today: {
        hrv: 53,
        resting_hr: 50,
        sleep_score: 72,
        stress: 44,
        body_battery: 58,
      },
      baseline: {
        hrv: 55,
        resting_hr: 49,
        sleep_score: 74,
        stress: 42,
        body_battery: 60,
        sampleCount: 24,
      },
    })

    expect(flagged.flagged).toBe(true)
    expect(flagged.triggerCount).toBeGreaterThanOrEqual(2)
    expect(notFlagged.flagged).toBe(false)
  })
})
