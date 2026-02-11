/**
 * Wearable Device and Health Data Models
 *
 * Device integration, heart rate data, zones, metrics, and sync jobs.
 */

export interface WearableDevice {
  id?: number;
  userId: number;
  type: 'apple_watch' | 'garmin' | 'fitbit';
  name: string;
  model?: string;
  deviceId: string;
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  capabilities: string[];
  settings: any;
  authTokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface HeartRateData {
  id?: number;
  runId: number;
  deviceId: string;
  timestamp: Date;
  heartRate: number;
  accuracy: 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface HeartRateZone {
  id?: number;
  userId: number;
  zoneNumber: number;
  name: string;
  description: string;
  minBpm: number;
  maxBpm: number;
  color: string;
  targetPercentage?: number;
  trainingBenefit: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HeartRateZoneSettings {
  id?: number;
  userId: number;
  calculationMethod: 'max_hr' | 'lactate_threshold' | 'hrr' | 'manual';
  maxHeartRate?: number;
  restingHeartRate?: number;
  lactateThresholdHR?: number;
  zoneSystem: 'five_zone' | 'three_zone' | 'custom';
  customZones?: string;
  autoUpdate: boolean;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZoneDistribution {
  id?: number;
  runId: number;
  zone1Time: number;
  zone2Time: number;
  zone3Time: number;
  zone4Time: number;
  zone5Time: number;
  zone1Percentage: number;
  zone2Percentage: number;
  zone3Percentage: number;
  zone4Percentage: number;
  zone5Percentage: number;
  totalTime: number;
  createdAt: Date;
}

export interface AdvancedMetrics {
  id?: number;
  runId: number;
  deviceId: string;
  vo2Max?: number;
  lactateThresholdHR?: number;
  lactateThresholdPace?: number;
  trainingStressScore?: number;
  trainingLoadFocus?: 'base' | 'tempo' | 'threshold' | 'vo2max' | 'anaerobic';
  performanceCondition?: number;
  racePredictor?: {
    distance: number;
    predictedTime: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RunningDynamicsData {
  id?: number;
  runId: number;
  deviceId: string;
  averageCadence: number;
  maxCadence: number;
  averageGroundContactTime: number;
  averageVerticalOscillation: number;
  averageStrideLength: number;
  groundContactBalance?: number;
  verticalRatio?: number;
  cadenceDataPoints?: { timestamp: Date; cadence: number }[];
  createdAt: Date;
}

export interface SyncJob {
  id?: number;
  userId: number;
  deviceId: number;
  type: 'activities' | 'heart_rate' | 'metrics' | 'full_sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  progress?: number;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
