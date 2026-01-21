import { db } from './db';

export interface GPSAccuracyData {
  signalStrength: number; // 0-100 calculated from accuracy
  accuracyRadius: number; // meters
  satellitesVisible: number; // estimated from accuracy
  locationQuality: 'excellent' | 'good' | 'fair' | 'poor';
  timestamp: Date;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  altitude?: number;
  heading?: number;
  speed?: number; // m/s
}

export interface GPSMonitoringConfig {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
  minAccuracyThreshold: number; // meters
  updateInterval: number; // milliseconds
}

export interface GPSTroubleshootingGuide {
  issue: string;
  description: string;
  solutions: string[];
  priority: 'high' | 'medium' | 'low';
}

const GPS_QUALITY_AVG_MIN_METERS = 5;
const GPS_QUALITY_AVG_MAX_METERS = 100;
const GPS_QUALITY_STD_MIN_METERS = 3;
const GPS_QUALITY_STD_MAX_METERS = 50;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const scoreLowerIsBetter = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return 0;
  const clamped = clamp(value, min, max);
  const normalized = 1 - (clamped - min) / (max - min);
  return Math.round(normalized * 100);
};

export const calculateGPSQualityScore = (accuracyData: GPSAccuracyData[]): number => {
  if (!Array.isArray(accuracyData) || accuracyData.length === 0) return 0;

  const accuracies = accuracyData
    .map((item) => item?.accuracyRadius)
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  if (accuracies.length === 0) return 0;

  const average =
    accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length;
  const variance =
    accuracies.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) /
    accuracies.length;
  const stdDev = Math.sqrt(variance);

  const averageScore = scoreLowerIsBetter(
    average,
    GPS_QUALITY_AVG_MIN_METERS,
    GPS_QUALITY_AVG_MAX_METERS
  );
  const varianceScore = scoreLowerIsBetter(
    stdDev,
    GPS_QUALITY_STD_MIN_METERS,
    GPS_QUALITY_STD_MAX_METERS
  );
  const underThresholdRatio =
    accuracies.filter((value) => value < 20).length / accuracies.length;
  const underThresholdScore = Math.round(underThresholdRatio * 100);

  const weightedScore =
    averageScore * 0.4 + varianceScore * 0.3 + underThresholdScore * 0.3;
  return clamp(Math.round(weightedScore), 0, 100);
};

export const getGPSQualityLevel = (
  score: number
): 'Excellent' | 'Good' | 'Fair' | 'Poor' => {
  if (!Number.isFinite(score)) return 'Poor';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Poor';
};

export class GPSMonitoringService {
  private config: GPSMonitoringConfig;
  private accuracyHistory: GPSAccuracyData[] = [];
  private listeners: ((accuracy: GPSAccuracyData) => void)[] = [];
  private troubleshootingGuides: GPSTroubleshootingGuide[] = [];

  constructor(config?: Partial<GPSMonitoringConfig>) {
    this.config = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 1000,
      minAccuracyThreshold: 20, // 20 meters
      updateInterval: 1000, // 1 second
      ...config
    };

    this.initializeTroubleshootingGuides();
  }

  private initializeTroubleshootingGuides(): void {
    this.troubleshootingGuides = [
      {
        issue: 'poor_accuracy',
        description: 'GPS accuracy is worse than 20 meters',
        solutions: [
          'Move to an open area away from buildings',
          'Ensure location services are enabled',
          'Wait a few minutes for better satellite connection',
          'Try reloading the app'
        ],
        priority: 'high'
      },
      {
        issue: 'no_signal',
        description: 'Unable to get GPS signal',
        solutions: [
          'Check if location permission is granted',
          'Move outdoors or near a window',
          'Restart your device location services',
          'Verify GPS is enabled in device settings'
        ],
        priority: 'high'
      },
      {
        issue: 'intermittent_signal',
        description: 'GPS signal keeps disconnecting',
        solutions: [
          'Move away from tall buildings or dense trees',
          'Keep device steady during initial GPS lock',
          'Check for device case interference',
          'Ensure battery optimization is disabled for the app'
        ],
        priority: 'medium'
      },
      {
        issue: 'slow_fix',
        description: 'GPS takes too long to get initial position',
        solutions: [
          'Wait patiently - first fix can take 30-60 seconds',
          'Move to a more open location',
          'Enable high accuracy mode in device settings',
          'Clear app cache and restart'
        ],
        priority: 'medium'
      },
      {
        issue: 'accuracy_degrading',
        description: 'GPS accuracy gets worse during run',
        solutions: [
          'Avoid running in urban canyons or dense forests',
          'Keep device in consistent position',
          'Check for low battery affecting GPS performance',
          'Consider switching to manual tracking temporarily'
        ],
        priority: 'low'
      }
    ];
  }

  /**
   * Calculate GPS accuracy metrics from browser geolocation data
   */
  public calculateAccuracyMetrics(position: GeolocationPosition): GPSAccuracyData {
    const accuracy = position.coords.accuracy || 999;

    // Calculate signal strength based on accuracy using non-linear scale optimized for running
    // This provides a more realistic representation of GPS quality for athletic tracking
    const signalStrength = accuracy <= 10 ? 100 :
                          accuracy <= 20 ? 90 :
                          accuracy <= 30 ? 75 :
                          accuracy <= 50 ? 60 :
                          accuracy <= 80 ? 40 :
                          accuracy <= 120 ? 20 : 0;

    // Estimate satellite count based on accuracy and timing
    const satellitesVisible = this.estimateSatelliteCount(accuracy);

    // Determine location quality
    const locationQuality = this.determineLocationQuality(accuracy);
    
    const accuracyData: GPSAccuracyData = {
      signalStrength,
      accuracyRadius: accuracy,
      satellitesVisible,
      locationQuality,
      timestamp: new Date(),
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      },
      ...(typeof position.coords.altitude === 'number' ? { altitude: position.coords.altitude } : {}),
      ...(typeof position.coords.heading === 'number' ? { heading: position.coords.heading } : {}),
      ...(typeof position.coords.speed === 'number' ? { speed: position.coords.speed } : {}),
    };

    // Add to history
    this.addToHistory(accuracyData);
    
    // Notify listeners
    this.notifyListeners(accuracyData);
    
    return accuracyData;
  }

  private estimateSatelliteCount(accuracy: number): number {
    // Estimate satellite count based on accuracy and signal strength
    // This is an approximation since browser API doesn't provide actual satellite count
    
    if (accuracy <= 5) return Math.floor(8 + Math.random() * 4); // 8-12 satellites
    if (accuracy <= 10) return Math.floor(6 + Math.random() * 3); // 6-9 satellites
    if (accuracy <= 20) return Math.floor(4 + Math.random() * 3); // 4-7 satellites
    if (accuracy <= 50) return Math.floor(3 + Math.random() * 2); // 3-5 satellites
    return Math.floor(1 + Math.random() * 3); // 1-4 satellites
  }

  private determineLocationQuality(accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' {
    // Updated to align with the new signal strength calculation
    // This provides better quality assessment for running applications
    if (accuracy <= 10) return 'excellent';  // <10m = 100% signal
    if (accuracy <= 30) return 'good';       // 10-30m = 75-90% signal
    if (accuracy <= 80) return 'fair';       // 30-80m = 40-60% signal
    return 'poor';                           // >80m = <40% signal
  }

  /**
   * Assess GPS quality and provide recommendation for starting a run
   */
  public assessGPSQuality(accuracy: number): {
    quality: 'excellent' | 'good' | 'acceptable' | 'fair' | 'poor' | 'unusable';
    recommendation: string;
    canStart: boolean;
  } {
    if (accuracy <= 10) {
      return {
        quality: 'excellent',
        recommendation: 'Perfect GPS signal! Ready to start.',
        canStart: true
      };
    }
    if (accuracy <= 20) {
      return {
        quality: 'good',
        recommendation: 'Great GPS signal. Ready to start.',
        canStart: true
      };
    }
    if (accuracy <= 30) {
      return {
        quality: 'acceptable',
        recommendation: 'Good enough for tracking. You can start.',
        canStart: true
      };
    }
    if (accuracy <= 50) {
      return {
        quality: 'fair',
        recommendation: 'GPS is fair. Consider waiting a few seconds.',
        canStart: true
      };
    }
    if (accuracy <= 80) {
      return {
        quality: 'poor',
        recommendation: 'Poor GPS. Wait for better signal or move to open area.',
        canStart: false
      };
    }
    return {
      quality: 'unusable',
      recommendation: 'GPS signal too weak. Move to open area away from buildings.',
      canStart: false
    };
  }

  private addToHistory(accuracyData: GPSAccuracyData): void {
    this.accuracyHistory.push(accuracyData);
    
    // Keep only last 100 readings to prevent memory issues
    if (this.accuracyHistory.length > 100) {
      this.accuracyHistory = this.accuracyHistory.slice(-100);
    }
  }

  private notifyListeners(accuracyData: GPSAccuracyData): void {
    this.listeners.forEach(listener => {
      try {
        listener(accuracyData);
      } catch (error) {
        console.error('Error in GPS accuracy listener:', error);
      }
    });
  }

  /**
   * Subscribe to GPS accuracy updates
   */
  public onAccuracyUpdate(callback: (accuracy: GPSAccuracyData) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current accuracy statistics
   */
  public getAccuracyStats(): {
    current: GPSAccuracyData | null;
    average: number;
    best: number;
    worst: number;
    trend: 'improving' | 'stable' | 'degrading';
  } {
    if (this.accuracyHistory.length === 0) {
      return {
        current: null,
        average: 0,
        best: 0,
        worst: 0,
        trend: 'stable'
      };
    }

    const current = this.accuracyHistory.at(-1) ?? null;
    const accuracies = this.accuracyHistory.map(a => a.accuracyRadius);
    
    const average = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const best = Math.min(...accuracies);
    const worst = Math.max(...accuracies);
    
    // Calculate trend from last 10 readings vs previous 10
    const trend = this.calculateAccuracyTrend();

    return {
      current,
      average: Math.round(average * 10) / 10,
      best: Math.round(best * 10) / 10,
      worst: Math.round(worst * 10) / 10,
      trend
    };
  }

  private calculateAccuracyTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.accuracyHistory.length < 20) return 'stable';
    
    const recent = this.accuracyHistory.slice(-10).map(a => a.accuracyRadius);
    const previous = this.accuracyHistory.slice(-20, -10).map(a => a.accuracyRadius);
    
    const recentAvg = recent.reduce((sum, acc) => sum + acc, 0) / recent.length;
    const previousAvg = previous.reduce((sum, acc) => sum + acc, 0) / previous.length;
    
    const improvement = previousAvg - recentAvg; // Positive means accuracy is improving (lower is better)
    
    if (improvement > 5) return 'improving';
    if (improvement < -5) return 'degrading';
    return 'stable';
  }

  /**
   * Get appropriate troubleshooting guide based on current GPS state
   */
  public getTroubleshootingGuide(accuracyData?: GPSAccuracyData): GPSTroubleshootingGuide | null {
    if (!accuracyData && this.accuracyHistory.length === 0) {
      return this.troubleshootingGuides.find(g => g.issue === 'no_signal') || null;
    }

    const current = accuracyData || this.accuracyHistory[this.accuracyHistory.length - 1];
    if (!current) return null;

    // Check for poor accuracy
    if (current.accuracyRadius > this.config.minAccuracyThreshold) {
      return this.troubleshootingGuides.find(g => g.issue === 'poor_accuracy') || null;
    }

    // Check for degrading accuracy trend
    const stats = this.getAccuracyStats();
    if (stats.trend === 'degrading') {
      return this.troubleshootingGuides.find(g => g.issue === 'accuracy_degrading') || null;
    }

    // Check for intermittent signal (if we have enough history)
    if (this.accuracyHistory.length > 10) {
      const recentVariance = this.calculateAccuracyVariance();
      if (recentVariance > 50) { // High variance indicates intermittent signal
        return this.troubleshootingGuides.find(g => g.issue === 'intermittent_signal') || null;
      }
    }

    return null;
  }

  private calculateAccuracyVariance(): number {
    const recent = this.accuracyHistory.slice(-10);
    const mean = recent.reduce((sum, a) => sum + a.accuracyRadius, 0) / recent.length;
    const variance = recent.reduce((sum, a) => sum + Math.pow(a.accuracyRadius - mean, 2), 0) / recent.length;
    return Math.sqrt(variance);
  }

  /**
   * Get user-friendly accuracy message
   */
  public getAccuracyMessage(accuracyData: GPSAccuracyData): {
    title: string;
    description: string;
    color: 'green' | 'yellow' | 'orange' | 'red';
    icon: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const { locationQuality, accuracyRadius } = accuracyData;

    switch (locationQuality) {
      case 'excellent':
        return {
          title: 'Excellent GPS',
          description: `Highly accurate (±${Math.round(accuracyRadius)}m)`,
          color: 'green',
          icon: 'excellent'
        };
      case 'good':
        return {
          title: 'Good GPS',
          description: `Good accuracy (±${Math.round(accuracyRadius)}m)`,
          color: 'green',
          icon: 'good'
        };
      case 'fair':
        return {
          title: 'Fair GPS',
          description: `Reasonable accuracy (±${Math.round(accuracyRadius)}m)`,
          color: 'yellow',
          icon: 'fair'
        };
      case 'poor':
        return {
          title: 'Poor GPS',
          description: `Low accuracy (±${Math.round(accuracyRadius)}m)`,
          color: 'red',
          icon: 'poor'
        };
      default:
        return {
          title: 'GPS Status',
          description: `Accuracy: ±${Math.round(accuracyRadius)}m`,
          color: 'yellow',
          icon: 'fair'
        };
    }
  }

  /**
   * Check if GPS is ready for tracking
   */
  public isReadyForTracking(accuracyData?: GPSAccuracyData): {
    ready: boolean;
    reason?: string;
    recommendation?: string;
  } {
    if (!accuracyData && this.accuracyHistory.length === 0) {
      return {
        ready: false,
        reason: 'No GPS signal detected',
        recommendation: 'Move to an open area and wait for GPS lock'
      };
    }

    const current = accuracyData ?? this.accuracyHistory.at(-1);
    if (!current) {
      return {
        ready: false,
        reason: 'No GPS signal detected',
        recommendation: 'Move to an open area and wait for GPS lock'
      };
    }
    
    if (current.accuracyRadius > this.config.minAccuracyThreshold) {
      return {
        ready: false,
        reason: `GPS accuracy too low (±${Math.round(current.accuracyRadius)}m)`,
        recommendation: 'Wait for better signal or move to open area'
      };
    }

    if (current.signalStrength < 30) {
      return {
        ready: false,
        reason: 'GPS signal strength too weak',
        recommendation: 'Move away from buildings and wait for stronger signal'
      };
    }

    return { ready: true };
  }

  /**
   * Save GPS accuracy data to database for historical analysis
   */
  public async saveAccuracyData(runId: number, accuracyData: GPSAccuracyData[]): Promise<void> {
    if (!db || accuracyData.length === 0) return;

    try {
      // Store accuracy data as JSON in the run record
      await db.transaction('rw', db.runs, async () => {
        const run = await db.runs.get(runId);
        if (run) {
          await db.runs.update(runId, {
            gpsAccuracyData: JSON.stringify(accuracyData),
            updatedAt: new Date()
          });
        }
      });
    } catch (error) {
      console.error('Failed to save GPS accuracy data:', error);
    }
  }

  /**
   * Get historical GPS accuracy data for analysis
   */
  public async getHistoricalAccuracyData(userId: number, days: number = 30): Promise<{
    averageAccuracy: number;
    bestAccuracy: number;
    worstAccuracy: number;
    accuracyTrend: 'improving' | 'stable' | 'degrading';
    totalRuns: number;
  }> {
    if (!db) {
      return {
        averageAccuracy: 0,
        bestAccuracy: 0,
        worstAccuracy: 0,
        accuracyTrend: 'stable',
        totalRuns: 0
      };
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const runs = await db.runs
        .where('userId')
        .equals(userId)
        .and(run => run.completedAt >= cutoffDate && Boolean(run.gpsAccuracyData))
        .toArray();

      if (runs.length === 0) {
        return {
          averageAccuracy: 0,
          bestAccuracy: 0,
          worstAccuracy: 0,
          accuracyTrend: 'stable',
          totalRuns: 0
        };
      }

      const allAccuracies: number[] = [];
      runs.forEach(run => {
        if (run.gpsAccuracyData) {
          try {
            const accuracyData: GPSAccuracyData[] = JSON.parse(run.gpsAccuracyData);
            accuracyData.forEach(data => {
              allAccuracies.push(data.accuracyRadius);
            });
          } catch {
            console.warn('Failed to parse GPS accuracy data for run:', run.id);
          }
        }
      });

      if (allAccuracies.length === 0) {
        return {
          averageAccuracy: 0,
          bestAccuracy: 0,
          worstAccuracy: 0,
          accuracyTrend: 'stable',
          totalRuns: runs.length
        };
      }

      const averageAccuracy = allAccuracies.reduce((sum, acc) => sum + acc, 0) / allAccuracies.length;
      const bestAccuracy = Math.min(...allAccuracies);
      const worstAccuracy = Math.max(...allAccuracies);

      // Calculate trend by comparing first half vs second half of runs
      const midpoint = Math.floor(runs.length / 2);
      const earlierRuns = runs.slice(0, midpoint);
      const laterRuns = runs.slice(midpoint);

      const earlierAccuracies: number[] = [];
      const laterAccuracies: number[] = [];

      earlierRuns.forEach(run => {
        if (run.gpsAccuracyData) {
          try {
            const data: GPSAccuracyData[] = JSON.parse(run.gpsAccuracyData);
            data.forEach(d => earlierAccuracies.push(d.accuracyRadius));
          } catch {
            // Ignore parsing errors
          }
        }
      });

      laterRuns.forEach(run => {
        if (run.gpsAccuracyData) {
          try {
            const data: GPSAccuracyData[] = JSON.parse(run.gpsAccuracyData);
            data.forEach(d => laterAccuracies.push(d.accuracyRadius));
          } catch {
            // Ignore parsing errors
          }
        }
      });

      let accuracyTrend: 'improving' | 'stable' | 'degrading' = 'stable';
      if (earlierAccuracies.length > 0 && laterAccuracies.length > 0) {
        const earlierAvg = earlierAccuracies.reduce((sum, acc) => sum + acc, 0) / earlierAccuracies.length;
        const laterAvg = laterAccuracies.reduce((sum, acc) => sum + acc, 0) / laterAccuracies.length;
        const improvement = earlierAvg - laterAvg; // Positive means improving (lower accuracy is better)

        if (improvement > 2) accuracyTrend = 'improving';
        else if (improvement < -2) accuracyTrend = 'degrading';
      }

      return {
        averageAccuracy: Math.round(averageAccuracy * 10) / 10,
        bestAccuracy: Math.round(bestAccuracy * 10) / 10,
        worstAccuracy: Math.round(worstAccuracy * 10) / 10,
        accuracyTrend,
        totalRuns: runs.length
      };

    } catch (error) {
      console.error('Failed to get historical GPS accuracy data:', error);
      return {
        averageAccuracy: 0,
        bestAccuracy: 0,
        worstAccuracy: 0,
        accuracyTrend: 'stable',
        totalRuns: 0
      };
    }
  }

  /**
   * Clear accuracy history (useful for testing or resetting)
   */
  public clearHistory(): void {
    this.accuracyHistory = [];
  }

  /**
   * Get current accuracy history
   */
  public getAccuracyHistory(): GPSAccuracyData[] {
    return [...this.accuracyHistory];
  }
}
