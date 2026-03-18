/**
 * User and Onboarding Models
 *
 * Core user profile, preferences, and onboarding data structures.
 */

export interface BetaSignup {
  id?: number;
  email: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string;
  hearAboutUs: string;
  createdAt: Date;
  invitedAt?: Date;
  convertedAt?: Date;
}

export interface User {
  id?: number;
  name?: string;
  goal: 'habit' | 'distance' | 'speed';
  experience: 'beginner' | 'intermediate' | 'advanced';
  preferredTimes: string[];
  daysPerWeek: number;
  consents: {
    data: boolean;
    gdpr: boolean;
    push: boolean;
  };
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  rpe?: number;
  age?: number;

  // Streak tracking
  currentStreak?: number;
  longestStreak?: number;
  lastActivityDate?: Date | null;
  streakLastUpdated?: Date | null;

  // Habit reminders
  reminderTime?: string | null;
  reminderEnabled?: boolean;
  reminderSnoozedUntil?: Date | null;
  cohortId?: number | null;

  // AI Guided Onboarding
  motivations?: string[];
  barriers?: string[];
  coachingStyle?: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
  goalInferred?: boolean;
  onboardingSession?: OnboardingSession;

  // Privacy settings
  privacySettings?: {
    dataCollection: {
      location: boolean;
      performance: boolean;
      analytics: boolean;
      coaching: boolean;
    };
    consentHistory: Array<{
      timestamp: Date;
      consentType: string;
      granted: boolean;
    }>;
    exportData: boolean;
    deleteData: boolean;
  };

  // Engagement optimization
  notificationPreferences?: {
    frequency: 'low' | 'medium' | 'high';
    timing: 'morning' | 'afternoon' | 'evening';
    types: Array<{
      id: string;
      name: string;
      description: string;
      enabled: boolean;
      category: 'motivational' | 'reminder' | 'achievement' | 'milestone';
    }>;
    quietHours: { start: string; end: string };
  };
  engagementScore?: number;
  optimalTiming?: {
    bestTime: string;
    timezone: string;
    lastEngagement: Date;
    engagementScore: number;
  };

  timezone?: string;
  planPreferences?: PlanSetupPreferences;

  // Subscription fields
  subscriptionTier?: 'free' | 'pro' | 'premium';
  subscriptionStatus?: 'active' | 'trial' | 'cancelled' | 'expired';
  trialStartDate?: Date;
  trialEndDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;

  // Reference race for pace zones
  referenceRaceDistance?: number;
  referenceRaceTime?: number;
  referenceRaceDate?: Date;
  calculatedVDOT?: number;
  averageWeeklyKm?: number;

  // Advanced physiological metrics
  lactateThreshold?: number;
  lactateThresholdHR?: number;
  vo2Max?: number;
  hrvBaseline?: number;
  maxHeartRate?: number;
  maxHeartRateSource?: 'measured' | 'calculated' | 'user_provided';
  restingHeartRate?: number;

  // Historical running data
  historicalRuns?: Array<{
    distance: number;
    time: number;
    date: Date;
    type?: 'easy' | 'tempo' | 'long' | 'intervals' | 'race';
    notes?: string;
    surface?: 'road' | 'trail' | 'track' | 'treadmill';
  }>;
  bestRecentPacePerKm?: number;
  weeklyDistanceHistory?: number[];
  previousTrainingBlock?: {
    endDate: Date;
    peakWeeklyDistance: number;
    longestRun: number;
    injuries?: string[];
  };

  // Fitness assessments
  functionalThresholdPace?: number;
  criticalSpeed?: number;
  dPrime?: number;
  lactateThresholdPercent?: number;
  runningEconomy?: number;
  metabolicFitnessScore?: number;
  lastFitnessAssessment?: Date;
}

export interface PlanSetupPreferences {
  availableDays?: string[];
  trainingDays?: string[];
  longRunDay?: string;
  startDate?: Date;
  basePlanLengthWeeks?: number;
  raceDate?: Date;
  trainingVolume?: 'conservative' | 'progressive' | 'high';
  difficulty?: 'easy' | 'balanced' | 'challenging';
  currentRaceTimeSeconds?: number;
}

export interface OnboardingSession {
  id?: number;
  userId: number;
  conversationId: string;
  goalDiscoveryPhase: 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete';
  discoveredGoals: SmartGoal[];
  coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
  sessionProgress: number;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id?: number;
  sessionId?: number;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  phase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SmartGoal {
  id: string;
  title: string;
  description: string;
  type: 'primary' | 'supporting' | 'health';
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  targetDate: Date;
}

export interface Cohort {
  id?: number;
  name: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CohortMember {
  id?: number;
  userId: number;
  cohortId: number;
  joinDate: Date;
}
