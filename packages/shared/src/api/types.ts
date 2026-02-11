/**
 * API Request/Response Types
 *
 * Type definitions for API payloads and responses.
 */

import type { User, Plan, Goal, Run } from '../index';

// ==========================================
// Authentication
// ==========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignupResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

// ==========================================
// Chat / AI Coach
// ==========================================

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: number;
  context?: {
    recentRuns?: Run[];
    currentPlan?: Plan;
    goals?: Goal[];
  };
}

export interface ChatResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ==========================================
// Plan Generation
// ==========================================

export interface GeneratePlanRequest {
  userId: number;
  goal: 'habit' | 'distance' | 'speed';
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  preferredTimes?: string[];
  targetDistance?: number;
  targetTime?: number;
  raceDate?: string;
}

export interface GeneratePlanResponse {
  success: boolean;
  plan?: Plan;
  error?: string;
}

// ==========================================
// Run Report
// ==========================================

export interface RunReportRequest {
  runId: number;
  distance: number;
  duration: number;
  pace: number;
  gpsPath?: string;
  heartRate?: number;
  rpe?: number;
}

export interface RunReportResponse {
  success: boolean;
  report?: {
    summary: string;
    effort: 'easy' | 'moderate' | 'hard';
    pacing: 'consistent' | 'fading' | 'negative_split' | 'erratic';
    safetyFlags?: string[];
    recommendations: string[];
    splits?: Array<{ km: number; pace: number }>;
  };
  error?: string;
}

// ==========================================
// Goals
// ==========================================

export interface CreateGoalRequest {
  userId: number;
  title: string;
  description: string;
  goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health';
  targetValue: number;
  targetDate: string;
  baselineValue: number;
}

export interface CreateGoalResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

export interface UpdateGoalRequest {
  currentValue?: number;
  progressPercentage?: number;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
}

export interface UpdateGoalResponse {
  success: boolean;
  goal?: Goal;
  error?: string;
}

// ==========================================
// Recovery
// ==========================================

export interface RecoveryScoreRequest {
  userId: number;
  date?: string;
}

export interface RecoveryScoreResponse {
  success: boolean;
  score?: {
    overallScore: number;
    sleepScore: number;
    hrvScore: number;
    restingHRScore: number;
    subjectiveWellnessScore: number;
    recommendations: string[];
  };
  error?: string;
}

// ==========================================
// Device Sync
// ==========================================

export interface DeviceSyncRequest {
  deviceId: number;
  dataType: 'activities' | 'heart_rate' | 'metrics' | 'full_sync';
}

export interface DeviceSyncResponse {
  success: boolean;
  syncJobId?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

// ==========================================
// Challenge
// ==========================================

export interface StartChallengeRequest {
  userId: number;
  challengeTemplateId: number;
  startDate?: string;
}

export interface StartChallengeResponse {
  success: boolean;
  plan?: Plan;
  challengeProgress?: {
    id: number;
    currentDay: number;
    status: string;
  };
  error?: string;
}

// ==========================================
// Generic API Response
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}
