import { describe, expect, it } from 'vitest'
import { buildDerivedEvidence, computeGarminAcwrMetrics } from '@/lib/garminAcwr'
import { computeGarminReadiness, type GarminReadinessDay } from '@/lib/garminReadinessComputer'

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(base + deltaDays * dayMs).toISOString().slice(0, 10)
}

describe('computeGarminAcwrMetrics', () => {
  it('computes acute/chronic/acwr with full 28 day data', () => {
    const endDate = '2026-02-21'
    const activities = Array.from({ length: 28 }, (_, index) => ({
      startTime: `${shiftIsoDate(endDate, -(27 - index))}T06:00:00.000Z`,
      durationSeconds: 100,
      averageHeartRate: null,
    }))

    const result = computeGarminAcwrMetrics({
      activities,
      endDate,
    })

    expect(result.acuteLoad7d).toBe(100)
    expect(result.chronicLoad28d).toBe(100)
    expect(result.acwr).toBe(1)
    expect(result.evidence.confidence).toBe('high')
    expect(result.evidence.dataPointsUsed).toBe(28)
  })

  it('pads missing chronic days with zeros and marks low confidence for sparse data', () => {
    const endDate = '2026-02-21'
    const activities = Array.from({ length: 5 }, (_, index) => ({
      startTime: `${shiftIsoDate(endDate, -index)}T06:00:00.000Z`,
      durationSeconds: 100,
      averageHeartRate: null,
    }))

    const result = computeGarminAcwrMetrics({
      activities,
      endDate,
    })

    expect(result.acuteLoad7d).toBeCloseTo(71.43, 2)
    expect(result.chronicLoad28d).toBeCloseTo(17.86, 2)
    expect(result.acwr).toBeCloseTo(4, 2)
    expect(result.evidence.confidence).toBe('low')
    expect(result.evidence.dataPointsUsed).toBe(5)
    expect(result.evidence.flags.some((flag) => flag.includes('Missing training data for 23 days'))).toBe(true)
    expect(result.evidence.flags.some((flag) => flag.includes('Low data confidence'))).toBe(true)
  })
})

describe('computeGarminReadiness', () => {
  function buildReadinessTimeline(
    endDate: string,
    template: Omit<GarminReadinessDay, 'date'>,
    count = 28
  ): GarminReadinessDay[] {
    return Array.from({ length: count }, (_, index) => ({
      date: shiftIsoDate(endDate, -(count - 1 - index)),
      ...template,
    }))
  }

  it('returns excellent readiness (>80) for strong recovery signals', () => {
    const endDate = '2026-02-21'
    const days = buildReadinessTimeline(endDate, {
      hrv: 50,
      sleepScore: 80,
      restingHr: 50,
      stress: 40,
    })
    days[days.length - 1] = {
      date: endDate,
      hrv: 70,
      sleepScore: 90,
      restingHr: 45,
      stress: 15,
    }

    const result = computeGarminReadiness({
      days,
      endDate,
    })

    expect(result.score).toBeGreaterThan(80)
    expect(result.label).toContain('may indicate')
    expect(result.insight).toContain('This is not medical advice.')
  })

  it('returns poor readiness (<40) for weak recovery signals', () => {
    const endDate = '2026-02-21'
    const days = buildReadinessTimeline(endDate, {
      hrv: 60,
      sleepScore: 70,
      restingHr: 50,
      stress: 30,
    })
    days[days.length - 1] = {
      date: endDate,
      hrv: 40,
      sleepScore: 45,
      restingHr: 58,
      stress: 90,
    }

    const result = computeGarminReadiness({
      days,
      endDate,
    })

    expect(result.score).toBeLessThan(40)
    expect(result.label).toContain('may indicate')
  })
})

describe('buildDerivedEvidence', () => {
  it('marks medium confidence when 10 of 28 days are missing', () => {
    const evidence = buildDerivedEvidence({
      dataPointsUsed: 18,
      windowDays: 28,
    })

    expect(evidence.missingDays).toBe(10)
    expect(evidence.confidence).toBe('medium')
    expect(evidence.flags.some((flag) => flag.includes('Missing data for 10 days'))).toBe(true)
  })
})
