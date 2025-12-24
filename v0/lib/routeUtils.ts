/**
 * Route Utilities
 * Helpers for route distance calculations, path processing, and GPS validation
 */

import type { LatLng, MapBounds } from './mapConfig';

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 First point latitude
 * @param lng1 First point longitude
 * @param lat2 Second point latitude
 * @param lng2 Second point longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total distance along a path of waypoints
 * @param points Array of GPS coordinates
 * @returns Total distance in kilometers
 */
export function calculateWaypointDistance(points: LatLng[]): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points.at(i)
    const next = points.at(i + 1)
    if (!current || !next) continue

    totalDistance += calculateDistance(
      current.lat,
      current.lng,
      next.lat,
      next.lng
    );
  }

  return totalDistance;
}

/**
 * Estimate route distance (straight-line between start and end)
 * @param start Starting coordinates
 * @param end Ending coordinates
 * @returns Estimated distance in kilometers
 */
export function estimateRouteDistance(start: LatLng, end: LatLng): number {
  return calculateDistance(start.lat, start.lng, end.lat, end.lng);
}

/**
 * Simplify a GPS path using Douglas-Peucker algorithm
 * Reduces number of points while maintaining shape
 * @param points Original path points
 * @param tolerance Distance tolerance in kilometers (default: 0.01km = 10m)
 * @returns Simplified path
 */
export function simplifyPath(points: LatLng[], tolerance: number = 0.01): LatLng[] {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points.at(0);
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return points;

  for (let i = 1; i < points.length - 1; i++) {
    const point = points.at(i)
    if (!point) continue

    const distance = perpendicularDistance(point, firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftSegment = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const rightSegment = simplifyPath(points.slice(maxIndex), tolerance);

    // Concatenate results, removing duplicate middle point
    return leftSegment.slice(0, -1).concat(rightSegment);
  }

  // Max distance is within tolerance, return endpoints
  return [firstPoint, lastPoint];
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
  const x0 = point.lat;
  const y0 = point.lng;
  const x1 = lineStart.lat;
  const y1 = lineStart.lng;
  const x2 = lineEnd.lat;
  const y2 = lineEnd.lng;

  const numerator = Math.abs(
    (y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1
  );
  const denominator = Math.sqrt(
    Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2)
  );

  return numerator / denominator;
}

/**
 * Get bounding box for a route (for map fitting)
 * @param points Route GPS coordinates
 * @returns Bounding box with northeast and southwest corners
 */
export function getRouteBounds(points: LatLng[]): MapBounds | null {
  if (points.length === 0) return null;

  const firstPoint = points.at(0)
  if (!firstPoint) return null

  let minLat = firstPoint.lat;
  let maxLat = firstPoint.lat;
  let minLng = firstPoint.lng;
  let maxLng = firstPoint.lng;

  points.forEach(point => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  });

  return {
    ne: { lat: maxLat, lng: maxLng },
    sw: { lat: minLat, lng: minLng },
  };
}

/**
 * Validate GPS path JSON structure
 * @param gpsPath JSON string of GPS coordinates
 * @returns True if valid
 */
export function validateRouteGeometry(gpsPath: string | undefined): boolean {
  if (!gpsPath) return false;

  try {
    const parsed = JSON.parse(gpsPath);

    if (!Array.isArray(parsed)) return false;
    if (parsed.length < 2) return false;

    return parsed.every(
      point =>
        typeof point === 'object' &&
        point !== null &&
        typeof point.lat === 'number' &&
        typeof point.lng === 'number' &&
        isValidLatitude(point.lat) &&
        isValidLongitude(point.lng)
    );
  } catch {
    return false;
  }
}

/**
 * Safely parse GPS path JSON
 * @param gpsPath JSON string or undefined
 * @returns Parsed coordinates or empty array
 */
export function parseGpsPath(gpsPath: string | undefined): LatLng[] {
  if (!gpsPath) return [];

  try {
    const parsed = JSON.parse(gpsPath);
    if (!Array.isArray(parsed)) return [];

    const normalized: LatLng[] = []

    for (const point of parsed) {
      if (typeof point !== 'object' || point === null) continue

      const anyPoint = point as any
      const lat =
        typeof anyPoint.lat === 'number'
          ? anyPoint.lat
          : typeof anyPoint.latitude === 'number'
            ? anyPoint.latitude
            : null
      const lng =
        typeof anyPoint.lng === 'number'
          ? anyPoint.lng
          : typeof anyPoint.longitude === 'number'
            ? anyPoint.longitude
            : null

      if (typeof lat !== 'number' || typeof lng !== 'number') continue
      if (!isValidLatitude(lat) || !isValidLongitude(lng)) continue
      normalized.push({ lat, lng })
    }

    return normalized
  } catch {
    return [];
  }
}

/**
 * Convert GPS path array to JSON string
 * @param points Array of coordinates
 * @returns JSON string
 */
export function stringifyGpsPath(points: LatLng[]): string {
  return JSON.stringify(points);
}

/**
 * Validate latitude is within valid range
 */
export function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

/**
 * Validate longitude is within valid range
 */
export function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

/**
 * Validate GPS coordinates
 */
export function isValidCoordinate(coord: LatLng): boolean {
  return isValidLatitude(coord.lat) && isValidLongitude(coord.lng);
}

/**
 * Calculate estimated time for route based on distance and pace
 * @param distanceKm Distance in kilometers
 * @param paceMinPerKm Pace in minutes per kilometer (default: 6 min/km)
 * @returns Estimated time in minutes
 */
export function estimateRouteTime(distanceKm: number, paceMinPerKm: number = 6): number {
  return Math.round(distanceKm * paceMinPerKm);
}

/**
 * Format distance for display
 * @param km Distance in kilometers
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string with unit
 */
export function formatDistance(km: number, decimals: number = 2): string {
  return `${km.toFixed(decimals)} km`;
}

/**
 * Generate intermediate waypoints along a straight line
 * Useful for creating visual route lines between start/end
 * @param start Starting point
 * @param end Ending point
 * @param numPoints Number of intermediate points (default: 10)
 * @returns Array of waypoints including start and end
 */
export function generateIntermediateWaypoints(
  start: LatLng,
  end: LatLng,
  numPoints: number = 10
): LatLng[] {
  const points: LatLng[] = [start];

  for (let i = 1; i < numPoints; i++) {
    const fraction = i / numPoints;
    points.push({
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction,
    });
  }

  points.push(end);
  return points;
}

/**
 * Check if a point is within a bounding box
 */
export function isPointInBounds(point: LatLng, bounds: MapBounds): boolean {
  return (
    point.lat >= bounds.sw.lat &&
    point.lat <= bounds.ne.lat &&
    point.lng >= bounds.sw.lng &&
    point.lng <= bounds.ne.lng
  );
}

/**
 * Expand bounds to include a point
 */
export function expandBoundsToIncludePoint(bounds: MapBounds, point: LatLng): MapBounds {
  return {
    ne: {
      lat: Math.max(bounds.ne.lat, point.lat),
      lng: Math.max(bounds.ne.lng, point.lng),
    },
    sw: {
      lat: Math.min(bounds.sw.lat, point.lat),
      lng: Math.min(bounds.sw.lng, point.lng),
    },
  };
}
