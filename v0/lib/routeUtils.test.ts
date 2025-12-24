/**
 * Route Utilities Tests
 * Tests for GPS calculations, path processing, and validation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateWaypointDistance,
  estimateRouteDistance,
  simplifyPath,
  getRouteBounds,
  validateRouteGeometry,
  parseGpsPath,
  stringifyGpsPath,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  estimateRouteTime,
  formatDistance,
  generateIntermediateWaypoints,
  isPointInBounds,
  expandBoundsToIncludePoint,
} from './routeUtils';
import type { LatLng, MapBounds } from './mapConfig';

describe('routeUtils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // Tel Aviv to Jerusalem (approximately 54 km)
      const distance = calculateDistance(
        32.0853, 34.7818,  // Tel Aviv
        31.7683, 35.2137   // Jerusalem
      );
      expect(distance).toBeGreaterThan(50);
      expect(distance).toBeLessThan(60);
    });

    it('should return 0 for identical points', () => {
      const distance = calculateDistance(
        32.0853, 34.7818,
        32.0853, 34.7818
      );
      expect(distance).toBe(0);
    });

    it('should handle equator crossing', () => {
      const distance = calculateDistance(
        -1.0, 0.0,
        1.0, 0.0
      );
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('calculateWaypointDistance', () => {
    it('should calculate total distance for multiple waypoints', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0850, lng: 34.7750 },
        { lat: 32.0950, lng: 34.7820 },
      ];
      const distance = calculateWaypointDistance(points);
      expect(distance).toBeGreaterThan(2);
      expect(distance).toBeLessThan(3);
    });

    it('should return 0 for single point', () => {
      const points: LatLng[] = [{ lat: 32.0748, lng: 34.7678 }];
      const distance = calculateWaypointDistance(points);
      expect(distance).toBe(0);
    });

    it('should return 0 for empty array', () => {
      const distance = calculateWaypointDistance([]);
      expect(distance).toBe(0);
    });
  });

  describe('estimateRouteDistance', () => {
    it('should estimate straight-line distance', () => {
      const start: LatLng = { lat: 32.0748, lng: 34.7678 };
      const end: LatLng = { lat: 32.0950, lng: 34.7820 };
      const distance = estimateRouteDistance(start, end);
      expect(distance).toBeGreaterThan(2);
      expect(distance).toBeLessThan(3);
    });
  });

  describe('simplifyPath', () => {
    it('should simplify a complex path', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0750, lng: 34.7680 },
        { lat: 32.0752, lng: 34.7682 },
        { lat: 32.0850, lng: 34.7750 },
        { lat: 32.0852, lng: 34.7752 },
        { lat: 32.0950, lng: 34.7820 },
      ];
      const simplified = simplifyPath(points, 0.01);
      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should return same array for 2 points', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0950, lng: 34.7820 },
      ];
      const simplified = simplifyPath(points);
      expect(simplified).toEqual(points);
    });

    it('should preserve start and end points', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0800, lng: 34.7700 },
        { lat: 32.0850, lng: 34.7750 },
        { lat: 32.0900, lng: 34.7800 },
        { lat: 32.0950, lng: 34.7820 },
      ];
      const simplified = simplifyPath(points);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });
  });

  describe('getRouteBounds', () => {
    it('should calculate correct bounds for route', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0950, lng: 34.7820 },
        { lat: 32.0650, lng: 34.7600 },
      ];
      const bounds = getRouteBounds(points);

      expect(bounds).not.toBeNull();
      expect(bounds!.ne.lat).toBe(32.0950);
      expect(bounds!.ne.lng).toBe(34.7820);
      expect(bounds!.sw.lat).toBe(32.0650);
      expect(bounds!.sw.lng).toBe(34.7600);
    });

    it('should return null for empty array', () => {
      const bounds = getRouteBounds([]);
      expect(bounds).toBeNull();
    });

    it('should handle single point', () => {
      const points: LatLng[] = [{ lat: 32.0748, lng: 34.7678 }];
      const bounds = getRouteBounds(points);

      expect(bounds).not.toBeNull();
      expect(bounds!.ne.lat).toBe(32.0748);
      expect(bounds!.ne.lng).toBe(34.7678);
      expect(bounds!.sw.lat).toBe(32.0748);
      expect(bounds!.sw.lng).toBe(34.7678);
    });
  });

  describe('validateRouteGeometry', () => {
    it('should validate correct GPS path JSON', () => {
      const gpsPath = JSON.stringify([
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0950, lng: 34.7820 },
      ]);
      expect(validateRouteGeometry(gpsPath)).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(validateRouteGeometry('not json')).toBe(false);
    });

    it('should reject non-array JSON', () => {
      const gpsPath = JSON.stringify({ lat: 32.0748, lng: 34.7678 });
      expect(validateRouteGeometry(gpsPath)).toBe(false);
    });

    it('should reject array with less than 2 points', () => {
      const gpsPath = JSON.stringify([{ lat: 32.0748, lng: 34.7678 }]);
      expect(validateRouteGeometry(gpsPath)).toBe(false);
    });

    it('should reject points with invalid coordinates', () => {
      const gpsPath = JSON.stringify([
        { lat: 200, lng: 34.7678 },  // Invalid latitude
        { lat: 32.0950, lng: 34.7820 },
      ]);
      expect(validateRouteGeometry(gpsPath)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateRouteGeometry(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateRouteGeometry('')).toBe(false);
    });
  });

  describe('parseGpsPath', () => {
    it('should parse valid GPS path', () => {
      const gpsPath = JSON.stringify([
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0950, lng: 34.7820 },
      ]);
      const parsed = parseGpsPath(gpsPath);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ lat: 32.0748, lng: 34.7678 });
      expect(parsed[1]).toEqual({ lat: 32.0950, lng: 34.7820 });
    });

    it('should normalize latitude/longitude shape', () => {
      const gpsPath = JSON.stringify([
        { latitude: 32.0748, longitude: 34.7678, timestamp: 1000, accuracy: 12 },
        { latitude: 32.0950, longitude: 34.7820, timestamp: 2000, accuracy: 10 },
      ]);
      const parsed = parseGpsPath(gpsPath);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ lat: 32.0748, lng: 34.7678 });
      expect(parsed[1]).toEqual({ lat: 32.0950, lng: 34.7820 });
    });

    it('should return empty array for invalid JSON', () => {
      const parsed = parseGpsPath('invalid');
      expect(parsed).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const parsed = parseGpsPath(undefined);
      expect(parsed).toEqual([]);
    });

    it('should filter out invalid coordinates', () => {
      const gpsPath = JSON.stringify([
        { lat: 32.0748, lng: 34.7678 },
        { lat: 200, lng: 34.7820 },  // Invalid
        { lat: 32.0950, lng: 34.7820 },
      ]);
      const parsed = parseGpsPath(gpsPath);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ lat: 32.0748, lng: 34.7678 });
      expect(parsed[1]).toEqual({ lat: 32.0950, lng: 34.7820 });
    });
  });

  describe('stringifyGpsPath', () => {
    it('should stringify GPS path correctly', () => {
      const points: LatLng[] = [
        { lat: 32.0748, lng: 34.7678 },
        { lat: 32.0950, lng: 34.7820 },
      ];
      const stringified = stringifyGpsPath(points);
      const parsed = JSON.parse(stringified);

      expect(parsed).toEqual(points);
    });

    it('should handle empty array', () => {
      const stringified = stringifyGpsPath([]);
      expect(stringified).toBe('[]');
    });
  });

  describe('coordinate validation', () => {
    describe('isValidLatitude', () => {
      it('should validate correct latitudes', () => {
        expect(isValidLatitude(0)).toBe(true);
        expect(isValidLatitude(90)).toBe(true);
        expect(isValidLatitude(-90)).toBe(true);
        expect(isValidLatitude(32.0853)).toBe(true);
      });

      it('should reject invalid latitudes', () => {
        expect(isValidLatitude(91)).toBe(false);
        expect(isValidLatitude(-91)).toBe(false);
        expect(isValidLatitude(200)).toBe(false);
      });
    });

    describe('isValidLongitude', () => {
      it('should validate correct longitudes', () => {
        expect(isValidLongitude(0)).toBe(true);
        expect(isValidLongitude(180)).toBe(true);
        expect(isValidLongitude(-180)).toBe(true);
        expect(isValidLongitude(34.7818)).toBe(true);
      });

      it('should reject invalid longitudes', () => {
        expect(isValidLongitude(181)).toBe(false);
        expect(isValidLongitude(-181)).toBe(false);
        expect(isValidLongitude(200)).toBe(false);
      });
    });

    describe('isValidCoordinate', () => {
      it('should validate correct coordinates', () => {
        expect(isValidCoordinate({ lat: 32.0853, lng: 34.7818 })).toBe(true);
        expect(isValidCoordinate({ lat: 0, lng: 0 })).toBe(true);
      });

      it('should reject invalid coordinates', () => {
        expect(isValidCoordinate({ lat: 200, lng: 34.7818 })).toBe(false);
        expect(isValidCoordinate({ lat: 32.0853, lng: 200 })).toBe(false);
      });
    });
  });

  describe('estimateRouteTime', () => {
    it('should estimate time with default pace', () => {
      const time = estimateRouteTime(5); // 5km
      expect(time).toBe(30); // 6 min/km * 5km = 30min
    });

    it('should estimate time with custom pace', () => {
      const time = estimateRouteTime(10, 5); // 10km at 5 min/km
      expect(time).toBe(50);
    });

    it('should round to nearest minute', () => {
      const time = estimateRouteTime(3.5, 6); // 3.5km at 6 min/km = 21 min
      expect(time).toBe(21);
    });
  });

  describe('formatDistance', () => {
    it('should format distance with default decimals', () => {
      expect(formatDistance(5.12345)).toBe('5.12 km');
    });

    it('should format distance with custom decimals', () => {
      expect(formatDistance(5.12345, 1)).toBe('5.1 km');
      expect(formatDistance(5.12345, 3)).toBe('5.123 km');
    });

    it('should handle zero', () => {
      expect(formatDistance(0)).toBe('0.00 km');
    });
  });

  describe('generateIntermediateWaypoints', () => {
    it('should generate correct number of waypoints', () => {
      const start: LatLng = { lat: 32.0748, lng: 34.7678 };
      const end: LatLng = { lat: 32.0950, lng: 34.7820 };
      const waypoints = generateIntermediateWaypoints(start, end, 10);

      expect(waypoints).toHaveLength(11); // numPoints includes start and end
      expect(waypoints[0]).toEqual(start);
      expect(waypoints[waypoints.length - 1]).toEqual(end);
    });

    it('should generate evenly spaced waypoints', () => {
      const start: LatLng = { lat: 32.0, lng: 34.0 };
      const end: LatLng = { lat: 33.0, lng: 35.0 };
      const waypoints = generateIntermediateWaypoints(start, end, 4);

      expect(waypoints).toHaveLength(5);
      expect(waypoints[2].lat).toBeCloseTo(32.5, 1);
      expect(waypoints[2].lng).toBeCloseTo(34.5, 1);
    });
  });

  describe('isPointInBounds', () => {
    const bounds: MapBounds = {
      ne: { lat: 32.1, lng: 34.8 },
      sw: { lat: 32.0, lng: 34.7 },
    };

    it('should return true for point inside bounds', () => {
      expect(isPointInBounds({ lat: 32.05, lng: 34.75 }, bounds)).toBe(true);
    });

    it('should return true for point on boundary', () => {
      expect(isPointInBounds({ lat: 32.1, lng: 34.8 }, bounds)).toBe(true);
      expect(isPointInBounds({ lat: 32.0, lng: 34.7 }, bounds)).toBe(true);
    });

    it('should return false for point outside bounds', () => {
      expect(isPointInBounds({ lat: 32.2, lng: 34.75 }, bounds)).toBe(false);
      expect(isPointInBounds({ lat: 32.05, lng: 34.9 }, bounds)).toBe(false);
    });
  });

  describe('expandBoundsToIncludePoint', () => {
    it('should expand bounds to include point outside', () => {
      const bounds: MapBounds = {
        ne: { lat: 32.1, lng: 34.8 },
        sw: { lat: 32.0, lng: 34.7 },
      };
      const point: LatLng = { lat: 32.2, lng: 34.9 };
      const expanded = expandBoundsToIncludePoint(bounds, point);

      expect(expanded.ne.lat).toBe(32.2);
      expect(expanded.ne.lng).toBe(34.9);
      expect(expanded.sw.lat).toBe(32.0);
      expect(expanded.sw.lng).toBe(34.7);
    });

    it('should not shrink bounds for point inside', () => {
      const bounds: MapBounds = {
        ne: { lat: 32.1, lng: 34.8 },
        sw: { lat: 32.0, lng: 34.7 },
      };
      const point: LatLng = { lat: 32.05, lng: 34.75 };
      const expanded = expandBoundsToIncludePoint(bounds, point);

      expect(expanded.ne.lat).toBe(32.1);
      expect(expanded.ne.lng).toBe(34.8);
      expect(expanded.sw.lat).toBe(32.0);
      expect(expanded.sw.lng).toBe(34.7);
    });

    it('should handle point that expands southwest corner', () => {
      const bounds: MapBounds = {
        ne: { lat: 32.1, lng: 34.8 },
        sw: { lat: 32.0, lng: 34.7 },
      };
      const point: LatLng = { lat: 31.9, lng: 34.6 };
      const expanded = expandBoundsToIncludePoint(bounds, point);

      expect(expanded.ne.lat).toBe(32.1);
      expect(expanded.ne.lng).toBe(34.8);
      expect(expanded.sw.lat).toBe(31.9);
      expect(expanded.sw.lng).toBe(34.6);
    });
  });
});
