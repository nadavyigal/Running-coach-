/**
 * Run and GPS Tracking Models
 *
 * Data structures for completed runs, active recording sessions, and GPS tracking.
 */

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface Run {
  id?: number;
  workoutId?: number;
  userId: number;
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'other';
  distance: number;
  duration: number;
  pace?: number;
  rpe?: number;
  heartRate?: number;
  calories?: number;
  notes?: string;
  route?: string;
  gpsPath?: string;
  gpsAccuracyData?: string;
  startAccuracy?: number;
  endAccuracy?: number;
  averageAccuracy?: number;
  runReport?: string;
  runReportSource?: 'ai' | 'fallback';
  runReportCreatedAt?: Date;
  shoeId?: number;
  importSource?: string;
  importConfidencePct?: number;
  importRequestId?: string;
  importMethod?: string;
  importModel?: string;
  importParserVersion?: string;
  gpsMetadata?: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LocationQuality {
  id?: number;
  location: string;
  lat: number;
  lng: number;
  avgAccuracy: number;
  avgRejectionRate: number;
  runsRecorded: number;
  lastRun: Date;
}

export interface ActiveRecordingSession {
  id?: number;
  userId: number;
  status: 'recording' | 'paused' | 'interrupted';
  startedAt: Date;
  lastCheckpointAt: Date;
  distanceKm: number;
  durationSeconds: number;
  elapsedRunMs: number;
  gpsPath: string;
  lastRecordedPoint?: string;
  workoutId?: number;
  routeId?: number;
  routeName?: string;
  autoPauseCount: number;
  acceptedPointCount: number;
  rejectedPointCount: number;
  createdAt: Date;
  updatedAt: Date;
}
