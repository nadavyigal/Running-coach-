/**
 * Recovery and Wellness Models
 *
 * Health metrics, recovery scores, sleep data, HRV, and data fusion.
 */

export interface SleepData {
  id?: number;
  userId: number;
  deviceId?: string;
  sleepDate: Date;
  date?: Date;
  bedTime?: Date;
  sleepTime?: Date;
  wakeTime?: Date;
  totalSleepTime: number;
  deepSleepTime?: number;
  lightSleepTime?: number;
  remSleepTime?: number;
  sleepEfficiency: number;
  sleepLatency?: number;
  wakeCount?: number;
  awakeDuration?: number;
  sleepScore?: number;
  sleepQualityScore?: number;
  sleepStages?: {
    deep: number;
    light: number;
    rem: number;
    awake: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface HRVMeasurement {
  id?: number;
  userId: number;
  deviceId?: string;
  measurementDate: Date;
  hrvValue: number;
  hrvType: 'rmssd' | 'sdnn' | 'pnn50' | 'hf' | 'lf' | 'lf_hf_ratio';
  measurementDuration: number;
  confidence: number;
  restingHeartRate?: number;
  stressLevel?: number;
  recoveryStatus?: 'poor' | 'fair' | 'good' | 'excellent';
  notes?: string;
  createdAt: Date;
}

export interface RecoveryScore {
  id?: number;
  userId: number;
  scoreDate?: Date;
  date?: Date;
  overallScore: number;
  sleepScore: number;
  hrvScore: number;
  restingHRScore: number;
  subjectiveWellnessScore: number;
  stressLevel: number;
  readinessScore: number;
  confidence: number;
  recommendations: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectiveWellness {
  id?: number;
  userId: number;
  assessmentDate?: Date;
  date?: Date;
  energyLevel?: number;
  moodScore?: number;
  sorenessLevel?: number;
  stressLevel?: number;
  motivationLevel?: number;
  mood?: number;
  motivation?: number;
  fatigue?: number;
  soreness?: number;
  sleepQuality?: number;
  overallWellness?: number;
  notes?: string;
  factors?: {
    stress: string[];
    sleep: string[];
    nutrition: string[];
    hydration: string[];
    other: string[];
  };
  createdAt: Date;
}

export interface DataFusionRule {
  id?: number;
  userId: number;
  dataType: string;
  primarySource: string;
  fallbackSources?: string[];
  conflictResolution: 'prefer_primary' | 'most_recent' | 'highest_accuracy' | 'average' | 'manual';
  gapFillingEnabled: boolean;
  qualityThreshold: number;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  priority?: number;
  isActive?: boolean;
  fusionMethod?: 'average' | 'weighted_average' | 'median' | 'mode' | 'latest' | 'earliest' | 'custom';
  weightFactors?: Record<string, number>;
  customLogic?: string;
}

export interface FusedDataPoint {
  id?: number;
  userId: number;
  dataType: string;
  timestamp: Date;
  value: number;
  unit?: string;
  confidence: number;
  qualityScore: number;
  fusionMethod:
    | 'average'
    | 'weighted_average'
    | 'median'
    | 'mode'
    | 'latest'
    | 'earliest'
    | 'custom'
    | 'single_source'
    | 'interpolated'
    | 'manual_resolution';
  primarySource: string;
  contributingSources: string[];
  conflicts?: DataConflict[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface DataConflict {
  id?: number;
  userId: number;
  dataType: string;
  fusedDataPointId?: number;
  sourceDevice1: string;
  sourceDevice2: string;
  value1: number;
  value2: number;
  difference: number;
  resolvedValue?: number;
  resolutionMethod?: string;
  manuallyResolved: boolean;
  detectedAt?: Date;
  conflictType?: 'duplicate' | 'inconsistent' | 'outlier' | 'missing' | 'quality';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface DataSource {
  id?: number;
  userId: number;
  deviceId: string;
  deviceType: string;
  dataTypes: string[];
  priority: number;
  accuracy: number;
  reliability: number;
  isActive: boolean;
  lastSync: Date;
  capabilities?: string[];
  name?: string;
  type?: 'apple_watch' | 'garmin' | 'fitbit' | 'manual' | 'other';
  syncFrequency?: number;
  qualityScore?: number;
  reliabilityScore?: number;
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
