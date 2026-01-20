import { describe, it, expect } from 'vitest'
import {
  calculateSegmentPaces,
  smoothPaceData,
  downsamplePaceData,
  classifyPaceZone,
  type GPSPoint,
  type PaceData,
} from './pace-calculations'

const buildSteadyPath = (
  count: number,
  options: { lat?: number; lng?: number; deltaLat?: number; deltaMs?: number } = {}
): GPSPoint[] => {
  const {
    lat = 32.0,
    lng = 34.0,
    deltaLat = 0.0001,
    deltaMs = 4000,
  } = options

  return Array.from({ length: count }, (_, index) => ({
    lat: lat + deltaLat * index,
    lng,
    timestamp: index * deltaMs,
  }))
}

const variance = (values: number[]): number => {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return (
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  )
}

describe('pace-calculations', () => {
  it('calculates segment paces for steady GPS data', () => {
    const gpsPath = buildSteadyPath(100)
    const paceData = calculateSegmentPaces(gpsPath)

    expect(paceData.length).toBe(99)

    const avgPace =
      paceData.reduce((sum, entry) => sum + entry.paceMinPerKm, 0) / paceData.length

    expect(avgPace).toBeGreaterThan(5.5)
    expect(avgPace).toBeLessThan(6.5)

    for (let i = 1; i < paceData.length; i += 1) {
      expect(paceData[i].distanceKm).toBeGreaterThan(paceData[i - 1].distanceKm)
      expect(paceData[i].timestamp.getTime()).toBeGreaterThan(
        paceData[i - 1].timestamp.getTime()
      )
    }
  })

  it('skips invalid GPS segments gracefully', () => {
    const gpsPath: GPSPoint[] = [
      { lat: 32.0, lng: 34.0, timestamp: 0 },
      { lat: 32.0001, lng: 34.0, timestamp: 0 },
      { lat: 32.0002, lng: 34.0, timestamp: 4000 },
    ]

    const paceData = calculateSegmentPaces(gpsPath)
    expect(paceData.length).toBe(1)
  })

  it('smooths pace data without shifting timestamps or distances', () => {
    const paceData: PaceData[] = Array.from({ length: 50 }, (_, index) => ({
      distanceKm: (index + 1) * 0.1,
      paceMinPerKm: index % 10 === 0 ? 10 : 6,
      timestamp: new Date(index * 60000),
    }))

    const rawVariance = variance(paceData.map((entry) => entry.paceMinPerKm))
    const smoothed = smoothPaceData(paceData, 3)
    const smoothedVariance = variance(smoothed.map((entry) => entry.paceMinPerKm))

    expect(smoothedVariance).toBeLessThan(rawVariance)
    smoothed.forEach((entry, index) => {
      expect(entry.distanceKm).toBe(paceData[index].distanceKm)
      expect(entry.timestamp.getTime()).toBe(paceData[index].timestamp.getTime())
    })
  })

  it('downsamples pace data while preserving endpoints', () => {
    const paceData: PaceData[] = Array.from({ length: 500 }, (_, index) => ({
      distanceKm: (index + 1) * 0.05,
      paceMinPerKm: 6,
      timestamp: new Date(index * 30000),
    }))

    const sampled = downsamplePaceData(paceData, 200)
    expect(sampled.length).toBeLessThanOrEqual(200)
    expect(sampled[0]).toEqual(paceData[0])
    expect(sampled[sampled.length - 1]).toEqual(paceData[paceData.length - 1])
  })

  it('classifies pace zones based on thresholds', () => {
    const userPaces = { easyPace: 6, tempoPace: 5 }

    expect(classifyPaceZone(6.5, userPaces)).toBe('easy')
    expect(classifyPaceZone(5.5, userPaces)).toBe('moderate')
    expect(classifyPaceZone(4.8, userPaces)).toBe('hard')
  })
})
