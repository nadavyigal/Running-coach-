/**
 * Performance Metrics and Analytics Models
 *
 * Performance tracking, personal records, insights, and habit analytics.
 */

export interface PerformanceMetrics {
  id?: number;
  userId: number;
  date: Date;
  averagePace: number;
  totalDistance: number;
  totalDuration: number;
  consistencyScore: number;
  performanceScore: number;
  trainingLoad: number;
  recoveryScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalRecord {
  id?: number;
  userId: number;
  recordType: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_run' | 'best_pace' | 'most_consistent_week';
  value: number;
  achievedAt: Date;
  runId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceInsight {
  id?: number;
  userId: number;
  type: 'improvement' | 'trend' | 'warning' | 'achievement' | 'recommendation';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  data?: any;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitAnalyticsSnapshot {
  id?: number;
  userId: number;
  snapshotDate: Date;
  currentStreak: number;
  longestStreak: number;
  weeklyConsistency: number;
  monthlyConsistency: number;
  consistencyTrend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
  goalAlignment: number;
  planAdherence: number;
  weekOverWeek: number;
  monthOverMonth: number;
  optimalTimes: string[];
  avgDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitInsight {
  id?: number;
  userId: number;
  insightType: 'motivation' | 'barrier' | 'suggestion' | 'pattern' | 'risk';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  evidence: string[];
  validUntil?: Date;
  isRead: boolean;
  createdAt: Date;
}

export interface HabitPattern {
  id?: number;
  userId: number;
  patternType: 'day_preference' | 'time_preference' | 'duration_pattern' | 'frequency_pattern';
  pattern: string;
  confidence: number;
  frequency: number;
  impact: number;
  lastObserved: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shoe {
  id?: number;
  userId: number;
  name: string;
  brand: string;
  model: string;
  initialKm: number;
  currentKm: number;
  maxKm: number;
  startDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Badge {
  id?: number;
  userId: number;
  type: 'bronze' | 'silver' | 'gold';
  milestone: number;
  unlockedAt: Date;
  streakValueAchieved: number;
}
