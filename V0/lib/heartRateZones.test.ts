import { describe, it, expect } from 'vitest';
import {
  calculateMaxHeartRate,
  calculateHeartRateZones,
  getHeartRateZone,
  getZoneInfo,
  analyzeHeartRateData,
  formatTimeInZone,
  getZonePercentage
} from './heartRateZones';

describe('Heart Rate Zone Calculations', () => {
  describe('calculateMaxHeartRate', () => {
    it('should calculate max heart rate using 220-age formula', () => {
      expect(calculateMaxHeartRate(25)).toBe(195);
      expect(calculateMaxHeartRate(30)).toBe(190);
      expect(calculateMaxHeartRate(40)).toBe(180);
      expect(calculateMaxHeartRate(50)).toBe(170);
    });

    it('should handle edge cases', () => {
      expect(calculateMaxHeartRate(0)).toBe(220);
      expect(calculateMaxHeartRate(100)).toBe(120);
    });
  });

  describe('calculateHeartRateZones', () => {
    it('should calculate zones without resting HR', () => {
      const zones = calculateHeartRateZones(190);
      
      expect(zones.zone1.min).toBe(95);  // 50% of 190
      expect(zones.zone1.max).toBe(114); // 60% of 190
      expect(zones.zone2.min).toBe(114); // 60% of 190
      expect(zones.zone2.max).toBe(133); // 70% of 190
      expect(zones.zone3.min).toBe(133); // 70% of 190
      expect(zones.zone3.max).toBe(152); // 80% of 190
      expect(zones.zone4.min).toBe(152); // 80% of 190
      expect(zones.zone4.max).toBe(171); // 90% of 190
      expect(zones.zone5.min).toBe(171); // 90% of 190
      expect(zones.zone5.max).toBe(190); // 100% of 190
    });

    it('should calculate zones with resting HR (Karvonen method)', () => {
      const zones = calculateHeartRateZones(190, 60);
      const hrReserve = 190 - 60; // 130
      
      expect(zones.zone1.min).toBe(125); // (130 * 0.5) + 60
      expect(zones.zone1.max).toBe(138); // (130 * 0.6) + 60
      expect(zones.zone2.min).toBe(138); // (130 * 0.6) + 60
      expect(zones.zone2.max).toBe(151); // (130 * 0.7) + 60
      expect(zones.zone3.min).toBe(151); // (130 * 0.7) + 60
      expect(zones.zone3.max).toBe(164); // (130 * 0.8) + 60
      expect(zones.zone4.min).toBe(164); // (130 * 0.8) + 60
      expect(zones.zone4.max).toBe(177); // (130 * 0.9) + 60
      expect(zones.zone5.min).toBe(177); // (130 * 0.9) + 60
      expect(zones.zone5.max).toBe(190); // Max HR
    });

    it('should handle extreme resting HR values', () => {
      const zones = calculateHeartRateZones(190, 40);
      expect(zones.zone1.min).toBeGreaterThan(40);
      expect(zones.zone5.max).toBe(190);
    });
  });

  describe('getHeartRateZone', () => {
    const zones = calculateHeartRateZones(190, 60);

    it('should correctly identify zone 1', () => {
      expect(getHeartRateZone(130, zones)).toBe(1);
      expect(getHeartRateZone(138, zones)).toBe(1);
    });

    it('should correctly identify zone 2', () => {
      expect(getHeartRateZone(140, zones)).toBe(2);
      expect(getHeartRateZone(150, zones)).toBe(2);
    });

    it('should correctly identify zone 3', () => {
      expect(getHeartRateZone(155, zones)).toBe(3);
      expect(getHeartRateZone(163, zones)).toBe(3);
    });

    it('should correctly identify zone 4', () => {
      expect(getHeartRateZone(170, zones)).toBe(4);
      expect(getHeartRateZone(176, zones)).toBe(4);
    });

    it('should correctly identify zone 5', () => {
      expect(getHeartRateZone(180, zones)).toBe(5);
      expect(getHeartRateZone(190, zones)).toBe(5);
      expect(getHeartRateZone(200, zones)).toBe(5); // Above max
    });

    it('should handle edge cases', () => {
      expect(getHeartRateZone(100, zones)).toBe(1); // Below zone 1
      expect(getHeartRateZone(0, zones)).toBe(1);   // Invalid low value
    });
  });

  describe('getZoneInfo', () => {
    it('should return correct zone information', () => {
      const zone1 = getZoneInfo(1);
      expect(zone1.name).toBe('Recovery');
      expect(zone1.description).toBe('Active recovery and warm-up');
      expect(zone1.color).toBe('#10B981');

      const zone3 = getZoneInfo(3);
      expect(zone3.name).toBe('Aerobic');
      expect(zone3.description).toBe('Steady state and endurance');
      expect(zone3.color).toBe('#F59E0B');

      const zone5 = getZoneInfo(5);
      expect(zone5.name).toBe('VO2 Max');
      expect(zone5.description).toBe('High intensity and maximum effort');
      expect(zone5.color).toBe('#7C3AED');
    });

    it('should return default for invalid zones', () => {
      const invalidZone = getZoneInfo(10);
      expect(invalidZone.name).toBe('Recovery'); // Default fallback
    });
  });

  describe('analyzeHeartRateData', () => {
    const zones = calculateHeartRateZones(190, 60);

    it('should analyze empty heart rate data', () => {
      const analysis = analyzeHeartRateData([], zones);
      
      expect(analysis.currentZone).toBe(1);
      expect(analysis.averageHR).toBe(0);
      expect(analysis.maxHR).toBe(0);
      expect(analysis.hrr).toBe(0);
      expect(Object.keys(analysis.timeInZones)).toHaveLength(0);
    });

    it('should analyze single heart rate data point', () => {
      const data = [
        { timestamp: new Date('2023-01-01T10:00:00Z'), heartRate: 150 }
      ];
      
      const analysis = analyzeHeartRateData(data, zones);
      
      expect(analysis.averageHR).toBe(150);
      expect(analysis.maxHR).toBe(150);
      expect(analysis.hrr).toBe(0); // No range with single point
      expect(analysis.currentZone).toBe(2); // 150 should be in zone 2
    });

    it('should analyze multiple heart rate data points', () => {
      const data = [
        { timestamp: new Date('2023-01-01T10:00:00Z'), heartRate: 130 }, // Zone 1
        { timestamp: new Date('2023-01-01T10:01:00Z'), heartRate: 150 }, // Zone 2
        { timestamp: new Date('2023-01-01T10:02:00Z'), heartRate: 170 }, // Zone 4
        { timestamp: new Date('2023-01-01T10:03:00Z'), heartRate: 140 }  // Zone 2
      ];
      
      const analysis = analyzeHeartRateData(data, zones);
      
      expect(analysis.averageHR).toBe(148); // (130+150+170+140)/4 rounded
      expect(analysis.maxHR).toBe(170);
      expect(analysis.hrr).toBe(40); // 170-130
      
      // Time in zones should be calculated based on intervals
      expect(analysis.timeInZones[2]).toBeGreaterThan(0); // Should have time in zone 2
      expect(analysis.timeInZones[4]).toBeGreaterThan(0); // Should have time in zone 4
    });

    it('should handle data with same timestamps', () => {
      const data = [
        { timestamp: new Date('2023-01-01T10:00:00Z'), heartRate: 150 },
        { timestamp: new Date('2023-01-01T10:00:00Z'), heartRate: 160 }
      ];
      
      const analysis = analyzeHeartRateData(data, zones);
      
      expect(analysis.averageHR).toBe(155);
      expect(analysis.maxHR).toBe(160);
    });
  });

  describe('formatTimeInZone', () => {
    it('should format seconds correctly', () => {
      expect(formatTimeInZone(30000)).toBe('30s'); // 30 seconds
      expect(formatTimeInZone(45000)).toBe('45s'); // 45 seconds
    });

    it('should format minutes and seconds correctly', () => {
      expect(formatTimeInZone(90000)).toBe('1m 30s');  // 1 minute 30 seconds
      expect(formatTimeInZone(150000)).toBe('2m 30s'); // 2 minutes 30 seconds
      expect(formatTimeInZone(3540000)).toBe('59m 0s'); // 59 minutes
    });

    it('should format hours and minutes correctly', () => {
      expect(formatTimeInZone(3600000)).toBe('1h 0m');   // 1 hour
      expect(formatTimeInZone(3660000)).toBe('1h 1m');   // 1 hour 1 minute
      expect(formatTimeInZone(7260000)).toBe('2h 1m');   // 2 hours 1 minute
    });

    it('should handle zero time', () => {
      expect(formatTimeInZone(0)).toBe('0s');
    });

    it('should handle large durations', () => {
      expect(formatTimeInZone(36000000)).toBe('10h 0m'); // 10 hours
    });
  });

  describe('getZonePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(getZonePercentage(30000, 60000)).toBe(50); // 50%
      expect(getZonePercentage(15000, 60000)).toBe(25); // 25%
      expect(getZonePercentage(60000, 60000)).toBe(100); // 100%
    });

    it('should handle zero total time', () => {
      expect(getZonePercentage(30000, 0)).toBe(0);
    });

    it('should handle zero zone time', () => {
      expect(getZonePercentage(0, 60000)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(getZonePercentage(33333, 100000)).toBe(33); // 33.333% rounded to 33
      expect(getZonePercentage(66666, 100000)).toBe(67); // 66.666% rounded to 67
    });

    it('should handle time in zone exceeding total time', () => {
      // This shouldn't happen in practice, but test edge case
      expect(getZonePercentage(120000, 60000)).toBe(200);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end for a typical workout', () => {
      const age = 30;
      const restingHR = 65;
      const maxHR = calculateMaxHeartRate(age);
      const zones = calculateHeartRateZones(maxHR, restingHR);

      // Simulate a 30-minute tempo run
      const workoutData = [];
      const startTime = new Date('2023-01-01T10:00:00Z');
      
      // Warm-up (5 minutes in zone 1-2)
      for (let i = 0; i < 5; i++) {
        workoutData.push({
          timestamp: new Date(startTime.getTime() + i * 60000),
          heartRate: 130 + i * 3 // Gradual increase
        });
      }
      
      // Main set (20 minutes in zone 3-4)
      for (let i = 5; i < 25; i++) {
        workoutData.push({
          timestamp: new Date(startTime.getTime() + i * 60000),
          heartRate: 155 + (i % 3) * 5 // Zone 3-4 variation
        });
      }
      
      // Cool-down (5 minutes back to zone 1-2)
      for (let i = 25; i < 30; i++) {
        workoutData.push({
          timestamp: new Date(startTime.getTime() + i * 60000),
          heartRate: 150 - (i - 25) * 5 // Gradual decrease
        });
      }

      const analysis = analyzeHeartRateData(workoutData, zones);

      // Verify the analysis makes sense
      expect(analysis.averageHR).toBeGreaterThan(140);
      expect(analysis.averageHR).toBeLessThan(170);
      expect(analysis.maxHR).toBeGreaterThan(analysis.averageHR);
      expect(analysis.hrr).toBeGreaterThan(20); // Should have good heart rate range
      
      // Should have spent time in multiple zones
      expect(Object.keys(analysis.timeInZones).length).toBeGreaterThan(0);
      
      // Primary zone should be reasonable for a tempo workout
      expect(analysis.currentZone).toBeGreaterThanOrEqual(2);
      expect(analysis.currentZone).toBeLessThanOrEqual(4);
    });
  });
});