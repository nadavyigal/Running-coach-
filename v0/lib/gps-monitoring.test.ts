import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { GPSMonitoringService, type GPSAccuracyData } from './gps-monitoring';
import { db } from './db';

describe('GPSMonitoringService', () => {
  let service: GPSMonitoringService;
  let mockPosition: GeolocationPosition;

  beforeEach(async () => {
    // Reset database
    if (db) {
      await db.delete();
      await db.open();
    }

    service = new GPSMonitoringService();
    
    mockPosition = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 8,
        altitude: 10,
        altitudeAccuracy: 5,
        heading: 90,
        speed: 2.5
      },
      timestamp: Date.now()
    };
  });

  describe('calculateAccuracyMetrics', () => {
    it('should calculate accuracy metrics from position data', () => {
      const metrics = service.calculateAccuracyMetrics(mockPosition);

      expect(metrics).toMatchObject({
        signalStrength: expect.any(Number),
        accuracyRadius: 8,
        satellitesVisible: expect.any(Number),
        locationQuality: expect.any(String),
        timestamp: expect.any(Date),
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        altitude: 10,
        heading: 90,
        speed: 2.5
      });

      expect(metrics.signalStrength).toBeGreaterThan(0);
      expect(metrics.signalStrength).toBeLessThanOrEqual(100);
      expect(metrics.satellitesVisible).toBeGreaterThan(0);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(metrics.locationQuality);
    });

    it('should determine correct location quality based on accuracy', () => {
      // Excellent accuracy (≤5m)
      const excellentPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 3 } };
      const excellentMetrics = service.calculateAccuracyMetrics(excellentPosition);
      expect(excellentMetrics.locationQuality).toBe('excellent');

      // Good accuracy (≤10m)
      const goodPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 20 } };
      const goodMetrics = service.calculateAccuracyMetrics(goodPosition);
      expect(goodMetrics.locationQuality).toBe('good');

      // Fair accuracy (≤20m)
      const fairPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 50 } };
      const fairMetrics = service.calculateAccuracyMetrics(fairPosition);
      expect(fairMetrics.locationQuality).toBe('fair');

      // Poor accuracy (>20m)
      const poorPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 100 } };
      const poorMetrics = service.calculateAccuracyMetrics(poorPosition);
      expect(poorMetrics.locationQuality).toBe('poor');
    });

    it('should estimate satellite count based on accuracy', () => {
      // High accuracy should estimate more satellites
      const highAccuracyPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 3 } };
      const highAccuracyMetrics = service.calculateAccuracyMetrics(highAccuracyPosition);
      expect(highAccuracyMetrics.satellitesVisible).toBeGreaterThan(6);

      // Low accuracy should estimate fewer satellites
      const lowAccuracyPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 100 } };
      const lowAccuracyMetrics = service.calculateAccuracyMetrics(lowAccuracyPosition);
      expect(lowAccuracyMetrics.satellitesVisible).toBeLessThan(6);
    });
  });

  describe('accuracy history management', () => {
    it('should add accuracy data to history', () => {
      const metrics = service.calculateAccuracyMetrics(mockPosition);
      const history = service.getAccuracyHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(metrics);
    });

    it('should limit history to 100 entries', () => {
      // Add more than 100 entries
      for (let i = 0; i < 120; i++) {
        const position = {
          ...mockPosition,
          coords: { ...mockPosition.coords, accuracy: i + 1 }
        };
        service.calculateAccuracyMetrics(position);
      }

      const history = service.getAccuracyHistory();
      expect(history).toHaveLength(100);
      // Should keep the latest entries
      expect(history[history.length - 1].accuracyRadius).toBe(120);
    });

    it('should clear history', () => {
      service.calculateAccuracyMetrics(mockPosition);
      expect(service.getAccuracyHistory()).toHaveLength(1);

      service.clearHistory();
      expect(service.getAccuracyHistory()).toHaveLength(0);
    });
  });

  describe('accuracy statistics', () => {
    beforeEach(() => {
      // Add some test data
      const accuracies = [5, 8, 12, 6, 15, 20, 3, 9, 11, 7];
      accuracies.forEach(accuracy => {
        const position = {
          ...mockPosition,
          coords: { ...mockPosition.coords, accuracy }
        };
        service.calculateAccuracyMetrics(position);
      });
    });

    it('should calculate accuracy statistics', () => {
      const stats = service.getAccuracyStats();

      expect(stats.current).toBeTruthy();
      expect(stats.average).toBeCloseTo(9.6, 1);
      expect(stats.best).toBe(3);
      expect(stats.worst).toBe(20);
      expect(['improving', 'stable', 'degrading']).toContain(stats.trend);
    });

    it('should return default stats when no data', () => {
      service.clearHistory();
      const stats = service.getAccuracyStats();

      expect(stats.current).toBeNull();
      expect(stats.average).toBe(0);
      expect(stats.best).toBe(0);
      expect(stats.worst).toBe(0);
      expect(stats.trend).toBe('stable');
    });
  });

  describe('accuracy listeners', () => {
    it('should notify listeners on accuracy updates', () => {
      const mockListener = vi.fn();
      const unsubscribe = service.onAccuracyUpdate(mockListener);

      const metrics = service.calculateAccuracyMetrics(mockPosition);

      expect(mockListener).toHaveBeenCalledWith(metrics);

      // Test unsubscribe
      unsubscribe();
      service.calculateAccuracyMetrics(mockPosition);
      expect(mockListener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      service.onAccuracyUpdate(errorListener);
      service.onAccuracyUpdate(goodListener);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.calculateAccuracyMetrics(mockPosition);

      expect(consoleSpy).toHaveBeenCalledWith('Error in GPS accuracy listener:', expect.any(Error));
      expect(goodListener).toHaveBeenCalled(); // Good listener should still work

      consoleSpy.mockRestore();
    });
  });

  describe('troubleshooting guides', () => {
    it('should return no signal guide when no data', () => {
      const guide = service.getTroubleshootingGuide();
      
      expect(guide).toBeTruthy();
      expect(guide?.issue).toBe('no_signal');
      expect(guide?.priority).toBe('high');
      expect(guide?.solutions).toContain('Check if location permission is granted');
    });

    it('should return poor accuracy guide for low accuracy', () => {
      const poorPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 100 } };
      const metrics = service.calculateAccuracyMetrics(poorPosition);
      
      const guide = service.getTroubleshootingGuide(metrics);
      
      expect(guide).toBeTruthy();
      expect(guide?.issue).toBe('poor_accuracy');
      expect(guide?.solutions).toContain('Move to an open area away from buildings');
    });

    it('should return degrading accuracy guide for declining trend', () => {
      // Create degrading trend: start good, end bad
      const goodAccuracies = [5, 6, 7, 8, 9];
      const badAccuracies = [20, 25, 30, 35, 40];
      
      [...goodAccuracies, ...badAccuracies].forEach(accuracy => {
        const position = {
          ...mockPosition,
          coords: { ...mockPosition.coords, accuracy }
        };
        service.calculateAccuracyMetrics(position);
      });

      const guide = service.getTroubleshootingGuide();
      
      if (guide?.issue === 'accuracy_degrading') {
        expect(guide.solutions).toContain('Avoid running in urban canyons or dense forests');
      }
    });

    it('should return null for good accuracy', () => {
      const goodPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 5 } };
      const metrics = service.calculateAccuracyMetrics(goodPosition);
      
      const guide = service.getTroubleshootingGuide(metrics);
      
      expect(guide).toBeNull();
    });
  });

  describe('accuracy messages', () => {
    it('should return appropriate message for different quality levels', () => {
      const excellentPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 3 } };
      const excellentMetrics = service.calculateAccuracyMetrics(excellentPosition);
      const excellentMessage = service.getAccuracyMessage(excellentMetrics);

      expect(excellentMessage.title).toBe('Excellent GPS');
      expect(excellentMessage.color).toBe('green');
      expect(excellentMessage.icon).toBe('excellent');

      const poorPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 100 } };
      const poorMetrics = service.calculateAccuracyMetrics(poorPosition);
      const poorMessage = service.getAccuracyMessage(poorMetrics);

      expect(poorMessage.title).toBe('Poor GPS');
      expect(poorMessage.color).toBe('red');
      expect(poorMessage.icon).toBe('poor');
    });
  });

  describe('tracking readiness', () => {
    it('should indicate ready for good accuracy', () => {
      const goodPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 8 } };
      const metrics = service.calculateAccuracyMetrics(goodPosition);
      
      const readiness = service.isReadyForTracking(metrics);
      
      expect(readiness.ready).toBe(true);
      expect(readiness.reason).toBeUndefined();
    });

    it('should indicate not ready for poor accuracy', () => {
      const poorPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 50 } };
      const metrics = service.calculateAccuracyMetrics(poorPosition);
      
      const readiness = service.isReadyForTracking(metrics);
      
      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toContain('GPS accuracy too low');
      expect(readiness.recommendation).toBeTruthy();
    });

    it('should indicate not ready for weak signal', () => {
      // Create very poor accuracy to simulate weak signal
      const weakPosition = { ...mockPosition, coords: { ...mockPosition.coords, accuracy: 200 } };
      const metrics = service.calculateAccuracyMetrics(weakPosition);
      
      const readiness = service.isReadyForTracking(metrics);
      
      expect(readiness.ready).toBe(false);
    });

    it('should indicate not ready when no data', () => {
      const readiness = service.isReadyForTracking();
      
      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toBe('No GPS signal detected');
    });
  });

  describe('database operations', () => {
    it('should save accuracy data to database', async () => {
      if (!db) return;

      // Create a test run
      const runId = await db.runs.add({
        userId: 1,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Create test accuracy data
      const accuracyData = [
        service.calculateAccuracyMetrics(mockPosition),
        service.calculateAccuracyMetrics({
          ...mockPosition,
          coords: { ...mockPosition.coords, accuracy: 10 }
        })
      ];

      await service.saveAccuracyData(runId as number, accuracyData);

      // Verify data was saved
      const run = await db.runs.get(runId);
      expect(run?.gpsAccuracyData).toBeTruthy();
      
      const savedData = JSON.parse(run!.gpsAccuracyData!);
      expect(savedData).toHaveLength(2);
      expect(savedData[0].accuracyRadius).toBe(8);
      expect(savedData[1].accuracyRadius).toBe(10);
    });

    it('should get historical accuracy data', async () => {
      if (!db) return;

      // Create test runs with accuracy data
      const accuracyData1 = [service.calculateAccuracyMetrics(mockPosition)];
      const accuracyData2 = [service.calculateAccuracyMetrics({
        ...mockPosition,
        coords: { ...mockPosition.coords, accuracy: 12 }
      })];

      const run1Id = await db.runs.add({
        userId: 1,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: new Date(),
        createdAt: new Date(),
        gpsAccuracyData: JSON.stringify(accuracyData1)
      });

      const run2Id = await db.runs.add({
        userId: 1,
        type: 'tempo',
        distance: 3,
        duration: 1200,
        completedAt: new Date(),
        createdAt: new Date(),
        gpsAccuracyData: JSON.stringify(accuracyData2)
      });

      const historical = await service.getHistoricalAccuracyData(1);

      expect(historical.totalRuns).toBe(2);
      expect(historical.averageAccuracy).toBeCloseTo(10, 0);
      expect(historical.bestAccuracy).toBe(8);
      expect(historical.worstAccuracy).toBe(12);
      expect(['improving', 'stable', 'degrading']).toContain(historical.accuracyTrend);
    });

    it('should handle empty historical data', async () => {
      const historical = await service.getHistoricalAccuracyData(999); // Non-existent user

      expect(historical.totalRuns).toBe(0);
      expect(historical.averageAccuracy).toBe(0);
      expect(historical.bestAccuracy).toBe(0);
      expect(historical.worstAccuracy).toBe(0);
      expect(historical.accuracyTrend).toBe('stable');
    });
  });
});
