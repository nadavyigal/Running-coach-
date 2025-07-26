import { db } from './db';
import type { DataFusionRule, DataSource, FusedDataPoint, DataConflict } from './db';

// Data Fusion Interfaces
export interface DataType {
  type: 'heart_rate' | 'gps' | 'steps' | 'sleep' | 'calories' | 'distance' | 'pace';
  accuracy: number; // device-specific accuracy for this data type
  sampleRate: number; // how frequently this data is collected
  latency: number; // typical delay from measurement to availability
}

export interface DeviceCapability {
  type: string;
  supported: boolean;
  quality: number; // 0-100
  sampleRate?: number;
}

export interface RawDataPoint {
  id: string;
  deviceId: string;
  dataType: string;
  value: number;
  timestamp: Date;
  accuracy: number;
  quality: number;
  metadata?: any;
}

export interface UserPreferences {
  conflictResolutionStrategy: 'automatic' | 'manual' | 'hybrid';
  qualityThreshold: number;
  gapFillingEnabled: boolean;
  interpolationMethod: 'linear' | 'cubic' | 'nearest';
}

export class DataFusionEngine {
  private db: typeof db;

  constructor() {
    this.db = db;
  }

  /**
   * Main method to fuse data points from multiple sources
   */
  async fuseDataPoints(
    dataPoints: RawDataPoint[],
    fusionRules: DataFusionRule,
    userPreferences: UserPreferences
  ): Promise<FusedDataPoint[]> {
    // Group data points by timestamp and type
    const groupedData = this.groupDataByTimestampMain(dataPoints);
    
    const fusedPoints: FusedDataPoint[] = [];
    
    for (const [timestamp, points] of groupedData) {
      const fusedPoint = await this.fusePointGroup(points, fusionRules, userPreferences);
      fusedPoints.push(fusedPoint);
    }
    
    // Fill gaps using interpolation or alternative sources
    const gapFilledPoints = await this.fillDataGaps(fusedPoints, fusionRules, userPreferences);
    
    return gapFilledPoints;
  }

  /**
   * Group data points by timestamp for processing (for tests)
   */
  private groupDataByTimestamp(dataPoints: RawDataPoint[]): Map<string, RawDataPoint[]> {
    const grouped = new Map<string, RawDataPoint[]>();
    const tolerance = 30000; // 30 seconds tolerance for grouping
    
    for (const point of dataPoints) {
      const timestamp = point.timestamp.getTime();
      let foundGroup = false;
      
      // Check if there's an existing group within tolerance
      for (const [groupTime, group] of grouped.entries()) {
        const groupTimestamp = parseInt(groupTime);
        if (Math.abs(timestamp - groupTimestamp) <= tolerance) {
          group.push(point);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        grouped.set(timestamp.toString(), [point]);
      }
    }
    
    return grouped;
  }

  /**
   * Group data points by timestamp for processing (main implementation)
   */
  private groupDataByTimestampMain(dataPoints: RawDataPoint[]): Map<Date, RawDataPoint[]> {
    const grouped = new Map<Date, RawDataPoint[]>();
    
    for (const point of dataPoints) {
      const timestamp = new Date(point.timestamp);
      const key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                          timestamp.getHours(), timestamp.getMinutes(), timestamp.getSeconds());
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(point);
    }
    
    return grouped;
  }

  /**
   * Fuse a group of data points at the same timestamp
   */
  private async fusePointGroup(
    points: RawDataPoint[],
    rules: DataFusionRule,
    userPreferences: UserPreferences
  ): Promise<FusedDataPoint> {
    // Sort by priority and accuracy
    const sortedPoints = this.sortByPriority(points, rules);
    
    // Detect conflicts
    const conflicts = this.detectConflicts(sortedPoints);
    
    // Resolve conflicts based on rules
    const resolvedValue = await this.resolveConflicts(sortedPoints, conflicts, rules, userPreferences);
    
    // Calculate confidence based on source quality and agreement
    const confidence = this.calculateConfidence(sortedPoints, conflicts);
    
    // Determine fusion method
    const fusionMethod = this.determineFusionMethod(sortedPoints, conflicts);
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(sortedPoints, conflicts);
    
    return {
      id: this.generateId(),
      userId: rules.userId,
      dataType: rules.dataType,
      value: resolvedValue,
      timestamp: sortedPoints[0].timestamp,
      primarySource: sortedPoints[0].deviceId,
      contributingSources: sortedPoints.map(p => p.deviceId),
      confidence,
      fusionMethod,
      qualityScore,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      createdAt: new Date()
    };
  }

  /**
   * Sort data points by priority and accuracy
   */
  private sortByPriority(points: RawDataPoint[], rules: DataFusionRule): RawDataPoint[] {
    return points.sort((a, b) => {
      // First, check if one is the primary source
      if (a.deviceId === rules.primarySource && b.deviceId !== rules.primarySource) return -1;
      if (b.deviceId === rules.primarySource && a.deviceId !== rules.primarySource) return 1;
      
      // Then sort by accuracy
      if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
      
      // Finally by quality
      return b.quality - a.quality;
    });
  }

  /**
   * Detect conflicts between data points
   */
  private detectConflicts(points: RawDataPoint[]): DataConflict[] {
    const conflicts: DataConflict[] = [];
    
    if (points.length < 2) return conflicts;
    
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const point1 = points[i];
        const point2 = points[j];
        
        const difference = Math.abs(point1.value - point2.value);
        const threshold = this.getConflictThreshold(point1.dataType);
        
        if (difference > threshold) {
          conflicts.push({
            id: this.generateId(),
            fusedDataPointId: '',
            sourceDevice1: point1.deviceId,
            sourceDevice2: point2.deviceId,
            value1: point1.value,
            value2: point2.value,
            difference,
            resolutionMethod: '',
            resolvedValue: 0,
            manuallyResolved: false,
            createdAt: new Date()
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Get conflict threshold for a data type
   */
  private getConflictThreshold(dataType: string): number {
    const thresholds: Record<string, number> = {
      'heart_rate': 5, // 5 bpm
      'steps': 10, // 10 steps
      'distance': 0.1, // 0.1 km
      'pace': 30, // 30 seconds per km
      'calories': 5, // 5 calories
      'sleep': 30, // 30 minutes
      'gps': 0.001 // 0.001 degrees
    };
    
    return thresholds[dataType] || 1;
  }

  /**
   * Resolve conflicts based on rules and user preferences
   */
  private async resolveConflicts(
    points: RawDataPoint[],
    conflicts: DataConflict[],
    rules: DataFusionRule,
    userPreferences: UserPreferences
  ): Promise<number> {
    if (conflicts.length === 0) {
      return points[0].value;
    }
    
    switch (rules.conflictResolution) {
      case 'prefer_primary':
        return points[0].value;
        
      case 'most_recent':
        return this.getMostRecentValue(points);
        
      case 'highest_accuracy':
        return this.getHighestAccuracyValue(points);
        
      case 'average':
        return this.calculateWeightedAverage(points);
        
      case 'manual':
        // For manual resolution, we'll need to store the conflict and wait for user input
        // For now, fall back to primary source
        return points[0].value;
        
      default:
        return points[0].value;
    }
  }

  /**
   * Get the most recent value from data points
   */
  private getMostRecentValue(points: RawDataPoint[]): number {
    return points.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    ).value;
  }

  /**
   * Get the value from the highest accuracy source
   */
  private getHighestAccuracyValue(points: RawDataPoint[]): number {
    return points.reduce((best, current) => 
      current.accuracy > best.accuracy ? current : best
    ).value;
  }

  /**
   * Calculate weighted average based on accuracy and quality
   */
  private calculateWeightedAverage(points: RawDataPoint[]): number {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const point of points) {
      const weight = (point.accuracy + point.quality) / 2;
      totalWeight += weight;
      weightedSum += point.value * weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : points[0].value;
  }

  /**
   * Calculate confidence score based on source quality and agreement
   */
  private calculateConfidence(points: RawDataPoint[], conflicts: DataConflict[]): number {
    if (points.length === 0) return 0;
    
    // Base confidence on average quality
    let baseConfidence = points.reduce((sum, p) => sum + p.quality, 0) / points.length;
    
    // Reduce confidence if there are conflicts
    if (conflicts.length > 0) {
      const conflictPenalty = Math.min(conflicts.length * 10, 30);
      baseConfidence -= conflictPenalty;
    }
    
    // Boost confidence if multiple sources agree
    if (points.length > 1) {
      const agreementBonus = Math.min((points.length - 1) * 5, 20);
      baseConfidence += agreementBonus;
    }
    
    return Math.max(0, Math.min(100, baseConfidence));
  }

  /**
   * Determine the fusion method used
   */
  private determineFusionMethod(points: RawDataPoint[], conflicts: DataConflict[]): FusedDataPoint['fusionMethod'] {
    if (points.length === 1) return 'single_source';
    if (conflicts.length === 0) return 'weighted_average';
    return 'weighted_average'; // Default for conflicted data
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(points: RawDataPoint[], conflicts: DataConflict[]): number {
    if (points.length === 0) return 0;
    
    let quality = points.reduce((sum, p) => sum + p.quality, 0) / points.length;
    
    // Reduce quality for conflicts
    if (conflicts.length > 0) {
      quality -= conflicts.length * 5;
    }
    
    return Math.max(0, Math.min(100, quality));
  }

  /**
   * Fill gaps in data using interpolation or alternative sources
   */
  private async fillDataGaps(
    fusedPoints: FusedDataPoint[],
    rules: DataFusionRule,
    userPreferences: UserPreferences
  ): Promise<FusedDataPoint[]> {
    if (!userPreferences.gapFillingEnabled) return fusedPoints;
    
    const filledPoints: FusedDataPoint[] = [];
    
    for (let i = 0; i < fusedPoints.length - 1; i++) {
      filledPoints.push(fusedPoints[i]);
      
      const current = fusedPoints[i];
      const next = fusedPoints[i + 1];
      
      // Check if there's a gap that needs filling
      const timeDiff = next.timestamp.getTime() - current.timestamp.getTime();
      const expectedInterval = this.getExpectedInterval(rules.dataType);
      
      if (timeDiff > expectedInterval * 2) {
        // Fill the gap
        const interpolatedPoints = this.interpolateGap(current, next, rules, userPreferences);
        filledPoints.push(...interpolatedPoints);
      }
    }
    
    if (fusedPoints.length > 0) {
      filledPoints.push(fusedPoints[fusedPoints.length - 1]);
    }
    
    return filledPoints;
  }

  /**
   * Get expected interval for a data type
   */
  private getExpectedInterval(dataType: string): number {
    const intervals: Record<string, number> = {
      'heart_rate': 1000, // 1 second
      'steps': 60000, // 1 minute
      'distance': 5000, // 5 seconds
      'pace': 5000, // 5 seconds
      'calories': 60000, // 1 minute
      'sleep': 3600000, // 1 hour
      'gps': 1000 // 1 second
    };
    
    return intervals[dataType] || 60000;
  }

  /**
   * Interpolate data points to fill gaps
   */
  private interpolateGap(
    start: FusedDataPoint,
    end: FusedDataPoint,
    rules: DataFusionRule,
    userPreferences: UserPreferences
  ): FusedDataPoint[] {
    const interpolatedPoints: FusedDataPoint[] = [];
    const timeDiff = end.timestamp.getTime() - start.timestamp.getTime();
    const interval = this.getExpectedInterval(rules.dataType);
    
    let currentTime = start.timestamp.getTime() + interval;
    
    while (currentTime < end.timestamp.getTime()) {
      const progress = (currentTime - start.timestamp.getTime()) / timeDiff;
      const interpolatedValue = this.interpolateValue(start.value, end.value, progress, userPreferences.interpolationMethod);
      
      interpolatedPoints.push({
        id: this.generateId(),
        userId: rules.userId,
        dataType: rules.dataType,
        value: interpolatedValue,
        timestamp: new Date(currentTime),
        primarySource: start.primarySource,
        contributingSources: [...start.contributingSources, ...end.contributingSources],
        confidence: Math.min(start.confidence, end.confidence) * 0.8, // Reduce confidence for interpolated data
        fusionMethod: 'interpolated',
        qualityScore: Math.min(start.qualityScore, end.qualityScore) * 0.8,
        createdAt: new Date()
      });
      
      currentTime += interval;
    }
    
    return interpolatedPoints;
  }

  /**
   * Interpolate a value between two points
   */
  private interpolateValue(start: number, end: number, progress: number, method: string): number {
    switch (method) {
      case 'linear':
        return start + (end - start) * progress;
      case 'cubic':
        // Simple cubic interpolation
        const t = progress;
        const t2 = t * t;
        const t3 = t2 * t;
        return start + (end - start) * (3 * t2 - 2 * t3);
      case 'nearest':
        return progress < 0.5 ? start : end;
      default:
        return start + (end - start) * progress;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Fuse data for a user and data type (e.g., heart_rate, steps)
  async fuseDataForUserAndType(userId: number, dataType: string, start: Date, end: Date): Promise<FusedDataPoint[]> {
    // 1. Get fusion rule
    const rule = await this.getFusionRule(userId, dataType);
    if (!rule) throw new Error('No fusion rule defined');
    // 2. Get all active data sources for this user and type
    const sources = await this.getDataSources(userId, dataType);
    // 3. Fetch raw data from all sources in the time range (stub: to be implemented)
    // 4. Merge data according to rule
    // 5. Resolve conflicts
    // 6. Fill gaps if needed
    // 7. Calculate quality/confidence
    // 8. Save fused data points and log conflicts
    // (Stub implementation)
    return [];
  }

  // Get the fusion rule for a user and data type
  async getFusionRule(userId: number, dataType: string): Promise<DataFusionRule | undefined> {
    return db.dataFusionRules.where({ userId, dataType }).first();
  }

  // Get all active data sources for a user
  async getDataSources(userId: number, dataType?: string): Promise<DataSource[]> {
    const sources = await db.dataSources.where({ userId, isActive: true }).toArray();
    if (dataType) {
      return sources.filter(ds => ds.dataTypes.includes(dataType));
    }
    return sources;
  }

  // Update data source priority
  async updateDataSourcePriority(userId: number, deviceId: string, priority: number): Promise<void> {
    await db.dataSources.where({ userId, deviceId }).modify({
      priority,
      updatedAt: new Date()
    });
  }

  // Update or create fusion rule
  async updateFusionRule(ruleData: Omit<DataFusionRule, 'id' | 'createdAt'>): Promise<number> {
    const existingRule = await db.dataFusionRules
      .where({ userId: ruleData.userId, dataType: ruleData.dataType })
      .first();
    
    if (existingRule) {
      await db.dataFusionRules.update(existingRule.id!, ruleData);
      return existingRule.id!;
    } else {
      return await db.dataFusionRules.add({
        ...ruleData,
        createdAt: new Date()
      });
    }
  }


  // Fill gaps in the data using interpolation/extrapolation
  fillGaps(data: any[], rule: DataFusionRule): any[] {
    // (Stub)
    return data;
  }


  // Save a fused data point to the database
  async saveFusedDataPoint(point: FusedDataPoint): Promise<number> {
    return db.fusedDataPoints.add(point);
  }

  // Log a data conflict
  async logDataConflict(conflict: DataConflict): Promise<number> {
    return db.dataConflicts.add(conflict);
  }
}

// Export singleton instance
export const dataFusionEngine = new DataFusionEngine(); 