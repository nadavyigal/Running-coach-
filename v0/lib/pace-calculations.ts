import { calculateDistance } from './routeUtils'

export interface GPSPoint {
  lat: number
  lng: number
  timestamp: number
  accuracy?: number
}

export interface PaceData {
  distanceKm: number
  paceMinPerKm: number
  timestamp: Date
}

export interface UserPaces {
  easyPace: number
  tempoPace: number
}

const MS_PER_MINUTE = 60000

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function calculateSegmentPaces(gpsPath: GPSPoint[]): PaceData[] {
  if (!Array.isArray(gpsPath) || gpsPath.length < 2) return []

  const results: PaceData[] = []
  let totalDistanceKm = 0
  let lastPoint: GPSPoint | null = null

  for (const point of gpsPath) {
    if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
      continue
    }

    if (!isFiniteNumber(point.timestamp)) {
      continue
    }

    if (!lastPoint) {
      lastPoint = point
      continue
    }

    const timeDeltaMs = point.timestamp - lastPoint.timestamp
    if (!Number.isFinite(timeDeltaMs) || timeDeltaMs <= 0) {
      continue
    }

    const segmentDistanceKm = calculateDistance(
      lastPoint.lat,
      lastPoint.lng,
      point.lat,
      point.lng
    )

    if (!Number.isFinite(segmentDistanceKm) || segmentDistanceKm <= 0) {
      continue
    }

    const paceMinPerKm = (timeDeltaMs / MS_PER_MINUTE) / segmentDistanceKm
    if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) {
      continue
    }

    totalDistanceKm += segmentDistanceKm
    results.push({
      distanceKm: totalDistanceKm,
      paceMinPerKm,
      timestamp: new Date(point.timestamp),
    })

    lastPoint = point
  }

  return results
}

export function smoothPaceData(paceData: PaceData[], windowSize: number = 3): PaceData[] {
  if (!Array.isArray(paceData) || paceData.length === 0) return []

  const clampedWindow = Math.max(1, Math.floor(windowSize))
  if (clampedWindow <= 1 || paceData.length === 1) {
    return paceData.map((entry) => ({ ...entry }))
  }

  const normalizedWindow = clampedWindow % 2 === 0 ? clampedWindow - 1 : clampedWindow
  if (normalizedWindow <= 1) {
    return paceData.map((entry) => ({ ...entry }))
  }

  const halfWindow = Math.floor(normalizedWindow / 2)
  const lastIndex = paceData.length - 1

  return paceData.map((entry, index) => {
    const startIndex = Math.max(0, index - halfWindow)
    const endIndex = Math.min(lastIndex, index + halfWindow)

    let sum = 0
    let count = 0
    for (let i = startIndex; i <= endIndex; i += 1) {
      const pace = paceData[i]?.paceMinPerKm
      if (pace === undefined || !Number.isFinite(pace)) continue
      sum += pace
      count += 1
    }

    return {
      ...entry,
      paceMinPerKm: count > 0 ? sum / count : entry.paceMinPerKm,
    }
  })
}

export function downsamplePaceData(paceData: PaceData[], maxPoints: number = 200): PaceData[] {
  if (!Array.isArray(paceData) || paceData.length === 0) return []

  const limit = Math.max(1, Math.floor(maxPoints))
  if (paceData.length <= limit) return paceData.map((entry) => ({ ...entry }))

  const first = paceData[0]
  if (limit === 1) {
    if (!first) return []
    return [first]
  }
  if (limit === 2) {
    const last = paceData[paceData.length - 1]
    if (!first || !last) return paceData.slice()
    return first === last ? [first] : [first, last]
  }

  const step = Math.ceil((paceData.length - 1) / (limit - 1))
  const sampled: PaceData[] = []

  for (let i = 0; i < paceData.length; i += step) {
    const point = paceData[i]
    if (point) sampled.push(point)
  }

  const lastPoint = paceData[paceData.length - 1]
  if (lastPoint && sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint)
  }

  return sampled
}

export function classifyPaceZone(
  pace: number,
  userPaces: UserPaces
): 'easy' | 'moderate' | 'hard' {
  if (!Number.isFinite(pace)) return 'easy'
  if (pace <= userPaces.tempoPace) return 'hard'
  if (pace <= userPaces.easyPace) return 'moderate'
  return 'easy'
}
