/**
 * GPS Data Compression Utilities
 *
 * Compresses GPS paths to reduce storage and sync bandwidth.
 * Uses simple coordinate rounding and thinning algorithms.
 */

export type GPSPoint = {
  lat: number
  lng: number
  timestamp?: number
  altitude?: number
  accuracy?: number
}

/**
 * Compress GPS path by reducing precision and removing redundant points
 *
 * @param path - Array of GPS points
 * @param options - Compression options
 * @returns Compressed GPS path
 */
export function compressGPSPath(
  path: GPSPoint[],
  options: {
    precision?: number // Decimal places (default: 5 = ~1m accuracy)
    minDistance?: number // Minimum distance between points in meters (default: 5m)
    simplify?: boolean // Use Douglas-Peucker simplification (default: true)
    epsilon?: number // Simplification tolerance (default: 0.0001)
  } = {}
): GPSPoint[] {
  const {
    precision = 5,
    minDistance = 5,
    simplify = true,
    epsilon = 0.0001,
  } = options

  if (path.length === 0) return []
  if (path.length === 1) return path

  // Step 1: Round coordinates to reduce precision
  let compressed = path.map(point => ({
    lat: Number(point.lat.toFixed(precision)),
    lng: Number(point.lng.toFixed(precision)),
    timestamp: point.timestamp,
    altitude: point.altitude ? Number(point.altitude.toFixed(1)) : undefined,
    accuracy: point.accuracy ? Number(point.accuracy.toFixed(1)) : undefined,
  }))

  // Step 2: Remove points too close together
  compressed = filterByDistance(compressed, minDistance)

  // Step 3: Simplify path using Douglas-Peucker algorithm
  if (simplify && compressed.length > 2) {
    compressed = douglasPeucker(compressed, epsilon)
  }

  return compressed
}

/**
 * Decompress GPS path (currently just returns the path as-is)
 * Future: Could implement actual decompression if using compression libraries
 */
export function decompressGPSPath(path: GPSPoint[]): GPSPoint[] {
  return path
}

/**
 * Filter points by minimum distance
 */
function filterByDistance(points: GPSPoint[], minDistance: number): GPSPoint[] {
  if (points.length <= 2) return points

  const result = [points[0]] // Always keep first point

  for (let i = 1; i < points.length - 1; i++) {
    const lastKept = result[result.length - 1]
    const current = points[i]

    const distance = calculateDistance(
      lastKept.lat,
      lastKept.lng,
      current.lat,
      current.lng
    )

    if (distance >= minDistance) {
      result.push(current)
    }
  }

  result.push(points[points.length - 1]) // Always keep last point

  return result
}

/**
 * Douglas-Peucker algorithm for line simplification
 */
function douglasPeucker(points: GPSPoint[], epsilon: number): GPSPoint[] {
  if (points.length <= 2) return points

  // Find the point with maximum distance from line between first and last
  let maxDistance = 0
  let maxIndex = 0

  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon)
    const right = douglasPeucker(points.slice(maxIndex), epsilon)

    // Concatenate results (remove duplicate middle point)
    return [...left.slice(0, -1), ...right]
  } else {
    // Return just start and end points
    return [start, end]
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  point: GPSPoint,
  lineStart: GPSPoint,
  lineEnd: GPSPoint
): number {
  const x = point.lat
  const y = point.lng
  const x1 = lineStart.lat
  const y1 = lineStart.lng
  const x2 = lineEnd.lat
  const y2 = lineEnd.lng

  const A = x - x1
  const B = y - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx, yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = x - xx
  const dy = y - yy

  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate distance between two GPS coordinates in meters
 * Uses Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(
  original: GPSPoint[],
  compressed: GPSPoint[]
): number {
  if (original.length === 0) return 1

  return compressed.length / original.length
}

/**
 * Estimate storage size reduction in bytes
 */
export function estimateStorageSavings(
  original: GPSPoint[],
  compressed: GPSPoint[]
): {
  originalSize: number
  compressedSize: number
  savings: number
  savingsPercent: number
} {
  // Rough estimate: ~100 bytes per point (JSON)
  const bytesPerPoint = 100

  const originalSize = original.length * bytesPerPoint
  const compressedSize = compressed.length * bytesPerPoint
  const savings = originalSize - compressedSize
  const savingsPercent = (savings / originalSize) * 100

  return {
    originalSize,
    compressedSize,
    savings,
    savingsPercent: Math.round(savingsPercent * 10) / 10,
  }
}
