import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataFusionEngine, type RawDataPoint, type UserPreferences } from './dataFusionEngine';

// Mock the database
vi.mock('./db', () => ({
  db: {
    dataFusionRules: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          first: vi.fn().mockResolvedValue(null)
        }),
        first: vi.fn().mockResolvedValue(null)
      }),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(undefined)
    },
    dataSources: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        }),
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        }),
        toArray: vi.fn().mockResolvedValue([]),
        modify: vi.fn().mockResolvedValue(undefined)
      })
    },
    fusedDataPoints: {
      add: vi.fn().mockResolvedValue(1)
    },
    dataConflicts: {
      add: vi.fn().mockResolvedValue(1),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
          toArray: vi.fn().mockResolvedValue([])
        })
      })
    }
  },
  resetDatabaseInstance: vi.fn()
}));

describe('DataFusionEngine', () => {
  let fusionEngine: DataFusionEngine;
  let mockUserPreferences: UserPreferences;

  beforeEach(() => {
    fusionEngine = new DataFusionEngine();
    mockUserPreferences = {
      conflictResolutionStrategy: 'automatic',
      qualityThreshold: 50,
      gapFillingEnabled: true,
      interpolationMethod: 'linear'
    };
    vi.clearAllMocks();
  });

  describe('Data Point Grouping', () => {
    it('should group data points by timestamp correctly', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'watch1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          accuracy: 90,
          quality: 85
        },
        {
          id: '2',
          deviceId: 'watch2',
          dataType: 'heart_rate',
          value: 125,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          accuracy: 85,
          quality: 80
        }
      ];

      // Access private method for testing
      const groupedData = (fusionEngine as any).groupDataByTimestamp(dataPoints);
      
      expect(groupedData.size).toBe(1);
      expect(Array.from(groupedData.values())[0]).toHaveLength(2);
    });
  });

  describe('Data Source Priority Sorting', () => {
    it('should sort data points by priority and accuracy', async () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'phone',
          dataType: 'steps',
          value: 5000,
          timestamp: new Date(),
          accuracy: 70,
          quality: 65
        },
        {
          id: '2',
          deviceId: 'watch',
          dataType: 'steps',
          value: 5100,
          timestamp: new Date(),
          accuracy: 90,
          quality: 88
        }
      ];

      const mockRule = {
        userId: 1,
        dataType: 'steps',
        primarySource: 'watch',
        fallbackSources: ['phone'],
        conflictResolution: 'prefer_primary' as const,
        gapFillingEnabled: true,
        qualityThreshold: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const sortedPoints = await (fusionEngine as any).sortByPriority(dataPoints, mockRule);
      
      expect(sortedPoints[0].deviceId).toBe('watch'); // Primary source should be first
      expect(sortedPoints[1].deviceId).toBe('phone');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts when values differ significantly', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'device1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 90,
          quality: 85
        },
        {
          id: '2',
          deviceId: 'device2',
          dataType: 'heart_rate',
          value: 140, // 16.7% difference
          timestamp: new Date(),
          accuracy: 85,
          quality: 80
        }
      ];

      const conflicts = (fusionEngine as any).detectConflicts(dataPoints);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].sourceDevice1).toBe('device1');
      expect(conflicts[0].sourceDevice2).toBe('device2');
      expect(conflicts[0].difference).toBe(20);
    });

    it('should not detect conflicts when values are within tolerance', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'device1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 90,
          quality: 85
        },
        {
          id: '2',
          deviceId: 'device2',
          dataType: 'heart_rate',
          value: 122, // 1.7% difference
          timestamp: new Date(),
          accuracy: 85,
          quality: 80
        }
      ];

      const conflicts = (fusionEngine as any).detectConflicts(dataPoints);
      
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate higher confidence for agreeing sources', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'device1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 90,
          quality: 85
        },
        {
          id: '2',
          deviceId: 'device2',
          dataType: 'heart_rate',
          value: 121,
          timestamp: new Date(),
          accuracy: 85,
          quality: 80
        }
      ];

      const confidence = (fusionEngine as any).calculateConfidence(dataPoints, []);
      
      expect(confidence).toBeGreaterThan(80); // Should be high for agreeing sources
    });

    it('should calculate lower confidence when conflicts exist', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'device1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 90,
          quality: 85
        },
        {
          id: '2',
          deviceId: 'device2',
          dataType: 'heart_rate',
          value: 140,
          timestamp: new Date(),
          accuracy: 85,
          quality: 80
        }
      ];

      const mockConflicts = [
        {
          fusedDataPointId: 0,
          sourceDevice1: 'device1',
          sourceDevice2: 'device2',
          value1: 120,
          value2: 140,
          difference: 20,
          resolutionMethod: 'pending',
          resolvedValue: 0,
          manuallyResolved: false,
          createdAt: new Date()
        }
      ];

      const confidence = (fusionEngine as any).calculateConfidence(dataPoints, mockConflicts);
      
      expect(confidence).toBeLessThan(80); // Should be lower due to conflicts
    });
  });

  describe('Weighted Average Calculation', () => {
    it('should calculate weighted average based on accuracy and quality', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'high_quality',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 95,
          quality: 90
        },
        {
          id: '2',
          deviceId: 'low_quality',
          dataType: 'heart_rate',
          value: 140,
          timestamp: new Date(),
          accuracy: 60,
          quality: 65
        }
      ];

      const weightedAverage = (fusionEngine as any).calculateWeightedAverage(dataPoints);
      
      // Should be closer to the high-quality source (120) than simple average (130)
      expect(weightedAverage).toBeLessThan(130);
      expect(weightedAverage).toBeGreaterThan(120);
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate quality score based on source metrics', () => {
      const dataPoints: RawDataPoint[] = [
        {
          id: '1',
          deviceId: 'device1',
          dataType: 'heart_rate',
          value: 120,
          timestamp: new Date(),
          accuracy: 90,
          quality: 85
        }
      ];

      const qualityScore = (fusionEngine as any).calculateQualityScore(dataPoints, []);
      
      expect(qualityScore).toBe(85); // Quality (85) with no conflicts
    });
  });

  describe('Data Source Management', () => {
    it('should get data sources for user', async () => {
      const mockSources = [
        {
          id: 1,
          userId: 1,
          deviceId: 'watch1',
          deviceType: 'apple_watch',
          priority: 8,
          accuracy: 90,
          reliability: 95,
          isActive: true
        }
      ];

      // Mock the database call
      const mockWhere = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSources)
      });
      (fusionEngine as any).db.dataSources.where = mockWhere;

      const sources = await fusionEngine.getDataSources(1);
      
      expect(sources).toEqual(mockSources);
    });

    it('should update data source priority', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        modify: vi.fn().mockResolvedValue(undefined)
      });
      (fusionEngine as any).db.dataSources.where = mockWhere;
      
      await fusionEngine.updateDataSourcePriority(1, 'watch1', 9);
      
      expect(mockWhere).toHaveBeenCalledWith({ userId: 1, deviceId: 'watch1' });
    });
  });

  describe('Fusion Rule Management', () => {
    it('should create new fusion rule when none exists', async () => {
      const ruleData = {
        userId: 1,
        dataType: 'heart_rate',
        primarySource: 'watch1',
        fallbackSources: ['phone'],
        conflictResolution: 'prefer_primary' as const,
        gapFillingEnabled: true,
        qualityThreshold: 70,
        updatedAt: new Date()
      };

      // Mock the database calls
      const mockWhere = vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null)
      });
      const mockAdd = vi.fn().mockResolvedValue(1);
      (fusionEngine as any).db.dataFusionRules.where = mockWhere;
      (fusionEngine as any).db.dataFusionRules.add = mockAdd;

      const ruleId = await fusionEngine.updateFusionRule(ruleData);
      
      expect(ruleId).toBe(1);
      expect(mockAdd).toHaveBeenCalled();
    });
  });
});
