import { describe, expect, it } from 'vitest'

import {
  clampBodyBattery,
  extractBodyBatteryDailySummary,
  extractBodyBatterySummaryFromStressEntries,
} from '@/lib/garmin/bodyBatteryTimeSeries'

describe('extractBodyBatteryDailySummary', () => {
  it('derives start, peak, and end from time-offset map', () => {
    const summary = extractBodyBatteryDailySummary({
      '0': 34,
      '1800': 40,
      '22500': 99,
      '86220': 12,
    })

    expect(summary).toEqual({
      start: 34,
      peak: 99,
      end: 12,
    })
  })

  it('sorts offsets numerically and clamps values to 0-100', () => {
    const summary = extractBodyBatteryDailySummary({
      '1800': 40.6,
      '0': -5,
      '3600': 150,
    })

    expect(summary).toEqual({
      start: 0,
      peak: 100,
      end: 100,
    })
  })

  it('returns nulls for empty or invalid input', () => {
    expect(extractBodyBatteryDailySummary(null)).toEqual({
      start: null,
      peak: null,
      end: null,
    })
    expect(extractBodyBatteryDailySummary({})).toEqual({
      start: null,
      peak: null,
      end: null,
    })
  })
})

describe('extractBodyBatterySummaryFromStressEntries', () => {
  it('reads timeOffsetBodyBatteryValues from stress detail records', () => {
    const summary = extractBodyBatterySummaryFromStressEntries([
      { averageStressLevel: 32 },
      {
        calendarDate: '2026-06-22',
        timeOffsetBodyBatteryValues: { '0': 34, '86220': 12 },
      },
    ])

    expect(summary).toEqual({
      start: 34,
      peak: 34,
      end: 12,
    })
  })
})

describe('clampBodyBattery', () => {
  it('rounds and clamps to integer 0-100', () => {
    expect(clampBodyBattery(40.6)).toBe(41)
    expect(clampBodyBattery(-5)).toBe(0)
    expect(clampBodyBattery(150)).toBe(100)
  })
})
