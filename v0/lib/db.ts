import Dexie, { type EntityTable } from 'dexie';

// Recovery and wellness interfaces
export interface SleepData {
  id?: number;
  userId: number;
  deviceId?: string;
  sleepDate: Date;
  totalSleepTime: number; // minutes
  deepSleepTime?: number; // minutes
  lightSleepTime?: number; // minutes
  remSleepTime?: number; // minutes
  sleepEfficiency: number; // percentage
  sleepLatency?: number; // minutes to fall asleep
  wakeCount?: number;
  sleepScore?: number; // 0-100
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
  hrvValue: number; // milliseconds
  hrvType: 'rmssd' | 'sdnn' | 'pnn50' | 'hf' | 'lf' | 'lf_hf_ratio';
  measurementDuration: number; // seconds
  confidence: number; // 0-100
  restingHeartRate?: number; // bpm
  stressLevel?: number; // 0-100
  recoveryStatus?: 'poor' | 'fair' | 'good' | 'excellent';
  notes?: string;
  createdAt: Date;
}

export interface RecoveryScore {
  id?: number;
  userId: number;
  scoreDate: Date;
  overallScore: number; // 0-100
  sleepScore: number; // 0-100
  hrvScore: number; // 0-100
  restingHRScore: number; // 0-100
  subjectiveWellnessScore: number; // 0-100
  stressLevel: number; // 0-100
  readinessScore: number; // 0-100
  confidence: number; // 0-100
  recommendations: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectiveWellness {
  id?: number;
  userId: number;
  assessmentDate: Date;
  energyLevel: number; // 1-10
  mood: number; // 1-10
  stressLevel: number; // 1-10
  motivation: number; // 1-10
  fatigue: number; // 1-10
  soreness: number; // 1-10
  sleepQuality: number; // 1-10
  overallWellness: number; // 1-10
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

// Data Fusion interfaces
export interface DataFusionRule {
  id?: number;
  userId: number;
  dataType: string; // 'heart_rate', 'sleep', 'activity', etc.
  primarySource: string;
  fallbackSources?: string[];
  conflictResolution: 'prefer_primary' | 'most_recent' | 'highest_accuracy' | 'average' | 'manual';
  gapFillingEnabled: boolean;
  qualityThreshold: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  // Backward-compatible/optional fields
  name?: string;
  priority?: number;
  isActive?: boolean;
  fusionMethod?: 'average' | 'weighted_average' | 'median' | 'mode' | 'latest' | 'earliest' | 'custom';
  weightFactors?: Record<string, number>; // deviceId -> weight
  customLogic?: string; // JSON string for custom fusion logic
}

export interface FusedDataPoint {
  id?: number;
  userId: number;
  dataType: string;
  timestamp: Date;
  value: number;
  unit?: string;
  confidence: number; // 0-100
  qualityScore: number; // 0-100
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
  primarySource: string; // deviceId used for primary value
  contributingSources: string[]; // Array of device IDs that contributed
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
  priority: number; // 1-10, higher = more important
  accuracy: number; // 0-100
  reliability: number; // 0-100
  isActive: boolean;
  lastSync: Date;
  capabilities?: string[];
  // Backward-compatible/optional fields
  name?: string;
  type?: 'apple_watch' | 'garmin' | 'fitbit' | 'manual' | 'other';
  syncFrequency?: number; // minutes
  qualityScore?: number; // 0-100
  reliabilityScore?: number; // 0-100
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// User preferences and profile
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
  rpe?: number; // Optional Rate of Perceived Exertion
  age?: number; // User's age
  // Streak tracking fields
  currentStreak?: number; // Current consecutive days of activity
  longestStreak?: number; // All-time best streak
  lastActivityDate?: Date | null; // Last day with recorded activity
  streakLastUpdated?: Date | null; // Timestamp of last streak calculation
  // Habit reminder fields
  reminderTime?: string | null; // HH:mm format
  reminderEnabled?: boolean;
  reminderSnoozedUntil?: Date | null;
  cohortId?: number | null; // New field for cohort association
  // AI Guided Onboarding fields
  motivations?: string[]; // User's motivations for running
  barriers?: string[]; // Potential barriers to running
  coachingStyle?: 'supportive' | 'challenging' | 'analytical' | 'encouraging'; // Preferred coaching style
  goalInferred?: boolean; // Whether goals were inferred by AI
  onboardingSession?: OnboardingSession;
  // Privacy settings fields
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
  // Engagement optimization fields
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
  engagementScore?: number; // 0-100 engagement score
  optimalTiming?: {
    bestTime: string;
    timezone: string;
    lastEngagement: Date;
    engagementScore: number;
  };
  // Timezone handling for UTC plan activation
  timezone?: string; // User's timezone (e.g., "America/New_York", "Europe/London")

  // Plan template flow (optional)
  planPreferences?: PlanSetupPreferences;
}

export interface PlanSetupPreferences {
  // Availability and schedule preferences
  availableDays?: string[]; // Mon/Tue/... (short)
  trainingDays?: string[]; // Mon/Tue/... (short), subset used for scheduling
  longRunDay?: string; // Mon/Tue/... (short)

  // Plan structure
  startDate?: Date;
  basePlanLengthWeeks?: number;
  raceDate?: Date;

  // Intensity preferences
  trainingVolume?: 'conservative' | 'progressive' | 'high';
  difficulty?: 'easy' | 'balanced' | 'challenging';

  // Baseline performance (seconds) for the selected distance
  currentRaceTimeSeconds?: number;
}

export interface OnboardingSession {
  id?: number;
  userId: number;
  conversationId: string;
  goalDiscoveryPhase: 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete';
  discoveredGoals: SmartGoal[];
  coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
  sessionProgress: number; // 0-100 percentage
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id?: number;
  sessionId?: number; // Foreign key to OnboardingSession if part of onboarding
  conversationId: string; // Grouping conversations
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  phase?: string; // Which onboarding phase this message belongs to
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

// Cohort interface
export interface Cohort {
  id?: number;
  name: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cohort Member interface (for many-to-many if needed, or direct user-cohort link)
export interface CohortMember {
  id?: number;
  userId: number;
  cohortId: number;
  joinDate: Date;
}

// Wearable Device interfaces
export interface WearableDevice {
  id?: number;
  userId: number;
  type: 'apple_watch' | 'garmin' | 'fitbit';
  name: string;
  model?: string;
  deviceId: string; // External device identifier
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  capabilities: string[];
  settings: any; // Device-specific settings
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
  heartRate: number; // bpm
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
  customZones?: string; // JSON string of CustomZone[]
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
  lactateThresholdPace?: number; // seconds per km
  trainingStressScore?: number;
  trainingLoadFocus?: 'base' | 'tempo' | 'threshold' | 'vo2max' | 'anaerobic';
  performanceCondition?: number; // -20 to +20
  racePredictor?: {
    distance: number; // km
    predictedTime: number; // seconds
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
  averageGroundContactTime: number; // milliseconds
  averageVerticalOscillation: number; // centimeters
  averageStrideLength: number; // meters
  groundContactBalance?: number; // percentage L/R
  verticalRatio?: number; // vertical oscillation to stride length ratio
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

// Performance Analytics interfaces
export interface PerformanceMetrics {
  id?: number;
  userId: number;
  date: Date;
  averagePace: number; // seconds per km
  totalDistance: number; // km
  totalDuration: number; // seconds
  consistencyScore: number; // 0-100
  performanceScore: number; // 0-100
  trainingLoad: number; // calculated load
  recoveryScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalRecord {
  id?: number;
  userId: number;
  recordType: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_run' | 'best_pace' | 'most_consistent_week';
  value: number; // time in seconds or distance in km
  achievedAt: Date;
  runId?: number; // reference to the run that achieved this record
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
  data?: any; // JSON data for charts/visualizations
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Coaching Profile for adaptive coaching intelligence
export interface CoachingProfile {
  id?: number;
  userId: number;
  communicationStyle: {
    motivationLevel: 'low' | 'medium' | 'high';
    detailPreference: 'minimal' | 'medium' | 'detailed';
    personalityType: 'analytical' | 'encouraging' | 'direct' | 'supportive';
    preferredTone: 'professional' | 'friendly' | 'enthusiastic' | 'calm';
  };
  feedbackPatterns: {
    averageRating: number;
    commonConcerns: string[];
    responsiveness: 'immediate' | 'delayed' | 'sporadic';
    preferredFeedbackFrequency: 'after_every_workout' | 'weekly' | 'monthly';
  };
  behavioralPatterns: {
    workoutPreferences: {
      preferredDays: string[];
      preferredTimes: string[];
      workoutTypeAffinities: Record<string, number>; // workout type -> preference score
      difficultyPreference: number; // 0-10 scale
    };
    contextualPatterns: {
      weatherSensitivity: number;
      scheduleFlexibility: number;
      stressResponse: 'reduce_intensity' | 'maintain' | 'increase_focus';
      energyPatterns: Record<string, number>; // day/time -> energy level
    };
  };
  coachingEffectivenessScore: number; // 0-100
  lastAdaptationDate: Date;
  adaptationHistory: {
    date: Date;
    adaptation: string;
    effectiveness: number;
    reason: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Coaching Feedback for learning and improvement
export interface CoachingFeedback {
  id?: number;
  userId: number;
  interactionType: 'workout_recommendation' | 'chat_response' | 'plan_adjustment' | 'motivation' | 'guidance';
  feedbackType: 'rating' | 'text' | 'behavioral' | 'quick_reaction';
  rating?: number; // 1-5 scale
  aspects?: {
    helpfulness: number;
    relevance: number;
    clarity: number;
    motivation: number;
    accuracy: number;
  };
  feedbackText?: string;
  context: {
    weather?: string;
    timeOfDay?: string;
    userMood?: string;
    recentPerformance?: string;
    situationalFactors?: string[];
  };
  coachingResponseId?: string; // Reference to specific coaching interaction
  improvementSuggestions?: string[];
  createdAt: Date;
}

// Coaching Interactions for pattern analysis
export interface CoachingInteraction {
  id?: number;
  userId: number;
  interactionId: string;
  interactionType: 'chat' | 'recommendation' | 'plan_generation' | 'feedback_response';
  promptUsed: string;
  responseGenerated: string;
  userContext: {
    currentGoals: string[];
    recentActivity: string;
    mood?: string;
    environment?: string;
    timeConstraints?: string;
  };
  adaptationsApplied: string[];
  effectivenessScore?: number; // Post-interaction effectiveness rating
  userEngagement: {
    responseTime?: number; // seconds to respond
    followUpQuestions: number;
    actionTaken: boolean;
  };
  createdAt: Date;
}

// User Behavior Patterns for machine learning
export interface UserBehaviorPattern {
  id?: number;
  userId: number;
  patternType: 'workout_preference' | 'schedule_pattern' | 'feedback_style' | 'motivation_response' | 'difficulty_adaptation';
  patternData: {
    pattern: string;
    frequency: number;
    conditions: string[];
    outcomes: Record<string, any>;
  };
  confidenceScore: number; // 0-100, how confident we are in this pattern
  lastObserved: Date;
  observationCount: number;
  correlatedPatterns?: string[]; // IDs of related patterns
  createdAt: Date;
  updatedAt: Date;
}

// Race goal interface for advanced plan customization
export interface RaceGoal {
  id?: number;
  userId: number;
  raceName: string;
  raceDate: Date;
  distance: number; // in kilometers
  targetTime?: number; // in seconds
  priority: 'A' | 'B' | 'C'; // A = primary, B = secondary, C = tune-up
  location?: string;
  raceType: 'road' | 'trail' | 'track' | 'virtual';
  elevationGain?: number; // meters
  courseDifficulty?: 'easy' | 'moderate' | 'hard';
  registrationStatus?: 'registered' | 'planned' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workout template for specialized training
export interface WorkoutTemplate {
  id?: number;
  name: string;
  workoutType: 'easy' | 'tempo' | 'intervals' | 'long' | 'race-pace' | 'recovery' | 'time-trial' | 'hill' | 'fartlek';
  trainingPhase: 'base' | 'build' | 'peak' | 'taper';
  intensityZone: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  structure: any; // JSON structure for workout details
  description: string;
  coachingNotes?: string;
  createdAt: Date;
}

// Periodization phase structure
export interface PeriodizationPhase {
  phase: 'base' | 'build' | 'peak' | 'taper';
  duration: number; // weeks
  weeklyVolumePercentage: number; // percentage of peak volume
  intensityDistribution: {
    easy: number; // percentage
    moderate: number; // percentage
    hard: number; // percentage
  };
  keyWorkouts: string[]; // workout types for this phase
  focus: string; // phase description
}

// Enhanced training plan structure with periodization
export interface Plan {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  isActive: boolean;
  planType: 'basic' | 'advanced' | 'periodized';
  raceGoalId?: number; // Link to race goal
  periodization?: PeriodizationPhase[]; // Periodization phases
  targetDistance?: number; // kilometers
  targetTime?: number; // seconds
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek?: number;
  peakWeeklyVolume?: number; // kilometers
  // Progressive Plan Complexity fields
  complexityLevel?: 'basic' | 'standard' | 'advanced';
  complexityScore?: number; // 0-100 complexity score
  lastComplexityUpdate?: Date;
  adaptationFactors?: AdaptationFactor[];
  userFeedback?: PlanFeedback[];
  // Goal linkage
  goalId?: number;
  // Timezone handling for UTC plan activation
  createdInTimezone?: string; // Timezone where plan was originally created
  createdAt: Date;
  updatedAt: Date;
}

export interface AdaptationFactor {
  factor: 'performance' | 'feedback' | 'consistency' | 'goals';
  weight: number;
  currentValue: number;
  targetValue: number;
}

// Plan feedback for complexity engine
export interface PlanFeedback {
  id?: number;
  planId: number;
  userId: number;
  feedbackType?: 'difficulty' | 'enjoyment' | 'completion' | 'suggestion';
  rating: number; // 1-5 scale
  comment?: string;
  createdAt: Date;
}

// Individual workout in a plan
export interface Workout {
  id?: number;
  planId: number;
  week: number;
  day: string; // 'Mon', 'Tue', etc.
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest' | 'race-pace' | 'recovery' | 'fartlek';
  distance: number; // in km
  duration?: number; // in minutes
  pace?: number; // target pace in seconds per km
  intensity?: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  trainingPhase?: 'base' | 'build' | 'peak' | 'taper';
  workoutStructure?: any; // JSON structure for complex workouts
  notes?: string;
  completed: boolean;
  scheduledDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Completed runs/activities
export interface Run {
  id?: number;
  workoutId?: number; // Optional link to planned workout
  userId: number;
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'other';
  distance: number; // in km
  duration: number; // in seconds
  pace?: number; // in seconds per km
  heartRate?: number;
  calories?: number;
  notes?: string;
  route?: string;
  gpsPath?: string; // JSON string of GPS coordinates
  gpsAccuracyData?: string; // JSON string of GPS accuracy data
  startAccuracy?: number; // GPS accuracy at start (meters)
  endAccuracy?: number; // GPS accuracy at end (meters)
  averageAccuracy?: number; // Average GPS accuracy during run (meters)
  shoeId?: number;
  importSource?: string; // e.g. "image", "manual", "strava"
  importConfidencePct?: number;
  importRequestId?: string;
  importMethod?: string;
  importModel?: string;
  importParserVersion?: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// Goal tracking system
export interface Goal {
  id?: number;
  userId: number;
  title: string;
  description: string;
  goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health';
  category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength';
  priority: 1 | 2 | 3;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  specificTarget: {
    metric: string;
    value: number;
    unit: string;
    description?: string;
  };
  measurableMetrics?: string[];
  achievableAssessment?: {
    currentLevel: number;
    targetLevel: number;
    feasibilityScore: number; // 0-100 scale
    recommendedAdjustments?: string[];
  };
  relevantContext?: string;
  measurableOutcome?: {
    successCriteria: string[];
    trackingMethod: string;
    measurementFrequency: 'daily' | 'weekly' | 'monthly';
  };
  achievabilityAssessment?: {
    difficultyRating: number; // 1-10 scale
    requiredResources: string[];
    potentialObstacles: string[];
    mitigationStrategies: string[];
  };
  relevanceJustification?: {
    personalImportance: number; // 1-10 scale
    alignmentWithValues: string;
    motivationalFactors: string[];
  };
  timeBound: {
    startDate: Date;
    deadline: Date;
    milestoneSchedule: number[]; // Percentage checkpoints [25, 50, 75]
    totalDuration: number; // in days
    estimatedDuration?: number; // in days (legacy)
  };
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  progressPercentage: number;
  isPrimary?: boolean; // Marks the primary/active goal
  planId?: number; // Linked training plan
  lastUpdated?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalMilestone {
  id?: number;
  goalId: number;
  milestoneOrder: number;
  title: string;
  description: string;
  targetValue: number;
  targetDate: Date;
  status: 'pending' | 'achieved' | 'missed' | 'adjusted';
  achievedDate?: Date;
  achievedValue?: number;
  celebrationShown: boolean;
  createdAt: Date;
}

export interface GoalProgressHistory {
  id?: number;
  goalId: number;
  measurementDate: Date;
  measuredValue: number;
  // Backward-compatible aliases for older schema/indexes
  recordedAt?: Date;
  progressValue?: number;
  progressPercentage: number;
  autoRecorded: boolean;
  contributingActivityId?: number | null;
  contributingActivityType?: string;
  context?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
}

export interface GoalRecommendation {
  id?: number;
  userId: number;
  recommendationType: 'new_goal' | 'adjustment' | 'milestone' | 'motivation' | 'priority_change';
  title: string;
  description: string;
  reasoning: string;
  confidenceScore: number; // 0-1 scale
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'dismissed' | 'expired';
  recommendationData: {
    goalId?: number;
    suggestedChanges?: Record<string, unknown>;
    newGoalTemplate?: Record<string, unknown>;
    actionRequired?: string;
    benefits?: string[];
    risks?: string[];
  };
  expiresAt?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// Running shoes tracking
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

// Chat messages for AI coach conversations
export interface ChatMessage {
  id?: number;
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  /** Serialized context used to generate the assistant response */
  aiContext?: string;
  conversationId?: string;
}

// Badge interface
export interface Badge {
  id?: number;
  userId: number;
  type: 'bronze' | 'silver' | 'gold';
  milestone: number; // 3, 7, 30
  unlockedAt: Date;
  streakValueAchieved: number;
}

// Database class
export class RunSmartDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  runs!: EntityTable<Run, 'id'>;
  shoes!: EntityTable<Shoe, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;
  badges!: EntityTable<Badge, 'id'>;
  planFeedback!: EntityTable<PlanFeedback, 'id'>;
  cohorts!: EntityTable<Cohort, 'id'>;
  cohortMembers!: EntityTable<CohortMember, 'id'>;
  performanceMetrics!: EntityTable<PerformanceMetrics, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  performanceInsights!: EntityTable<PerformanceInsight, 'id'>;
  raceGoals!: EntityTable<RaceGoal, 'id'>;
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>;
  coachingProfiles!: EntityTable<CoachingProfile, 'id'>;
  coachingFeedback!: EntityTable<CoachingFeedback, 'id'>;
  coachingInteractions!: EntityTable<CoachingInteraction, 'id'>;
  userBehaviorPatterns!: EntityTable<UserBehaviorPattern, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  goalMilestones!: EntityTable<GoalMilestone, 'id'>;
  goalProgressHistory!: EntityTable<GoalProgressHistory, 'id'>;
  goalRecommendations!: EntityTable<GoalRecommendation, 'id'>;
  // Wearable device tables
  wearableDevices!: EntityTable<WearableDevice, 'id'>;
  heartRateData!: EntityTable<HeartRateData, 'id'>;
  heartRateZones!: EntityTable<HeartRateZone, 'id'>;
  heartRateZoneSettings!: EntityTable<HeartRateZoneSettings, 'id'>;
  zoneDistributions!: EntityTable<ZoneDistribution, 'id'>;
  advancedMetrics!: EntityTable<AdvancedMetrics, 'id'>;
  runningDynamicsData!: EntityTable<RunningDynamicsData, 'id'>;
  syncJobs!: EntityTable<SyncJob, 'id'>;
  // Onboarding and conversation tables
  onboardingSessions!: EntityTable<OnboardingSession, 'id'>;
  conversationMessages!: EntityTable<ConversationMessage, 'id'>;
  // Recovery metrics tables
  sleepData!: EntityTable<SleepData, 'id'>;
  hrvMeasurements!: EntityTable<HRVMeasurement, 'id'>;
  recoveryScores!: EntityTable<RecoveryScore, 'id'>;
  subjectiveWellness!: EntityTable<SubjectiveWellness, 'id'>;
  
  // Data Fusion tables
  dataFusionRules!: EntityTable<DataFusionRule, 'id'>;
  fusedDataPoints!: EntityTable<FusedDataPoint, 'id'>;
  dataConflicts!: EntityTable<DataConflict, 'id'>;
  dataSources!: EntityTable<DataSource, 'id'>;
  
  // Habit Analytics tables
  habitAnalyticsSnapshots!: EntityTable<HabitAnalyticsSnapshot, 'id'>;
  habitInsights!: EntityTable<HabitInsight, 'id'>;
  habitPatterns!: EntityTable<HabitPattern, 'id'>;

  // Route tables
  routes!: EntityTable<Route, 'id'>;
  routeRecommendations!: EntityTable<RouteRecommendation, 'id'>;
  userRoutePreferences!: EntityTable<UserRoutePreferences, 'id'>;

  constructor() {
    super('RunSmartDB');

    // Consolidated schema - Single stable version with optimized compound indexes
    // Compound indexes format: [field1+field2] for multi-column queries
    this.version(1).stores({
      // Users: Optimized for onboarding status queries
      users: '++id, name, goal, experience, onboardingComplete, [goal+experience], [onboardingComplete+updatedAt]',

      // Plans: Optimized for user-specific active plan lookups
      plans: '++id, userId, isActive, startDate, endDate, [userId+isActive], [userId+startDate]',

      // Workouts: Optimized for date range and status queries
      workouts: '++id, planId, week, day, type, completed, scheduledDate, [planId+scheduledDate], [planId+completed], [userId+scheduledDate]',

      // Runs: Optimized for user timeline and type filtering
      runs: '++id, userId, type, distance, duration, completedAt, [userId+completedAt], [userId+type]',

      // Shoes: Optimized for active shoe lookups
      shoes: '++id, userId, name, brand, model, isActive, [userId+isActive]',

      // Chat Messages: Optimized for conversation retrieval
      chatMessages: '++id, userId, role, timestamp, conversationId, [userId+timestamp], [conversationId+timestamp]',

      // Badges: Optimized for user badge lookups
      badges: '++id, userId, type, milestone, unlockedAt, [userId+type]',

      // Plan Feedback: Optimized for plan-specific feedback
      planFeedback: '++id, planId, userId, feedbackType, rating, createdAt, [planId+createdAt], [userId+feedbackType]',

      // Cohorts: Simple index structure
      cohorts: '++id, name, inviteCode',

      // Cohort Members: Optimized for membership lookups
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',

      // Performance Metrics: Optimized for time-series queries
      performanceMetrics: '++id, userId, date, createdAt, [userId+date]',

      // Personal Records: Optimized for record type lookups
      personalRecords: '++id, userId, recordType, achievedAt, createdAt, [userId+recordType], [userId+achievedAt]',

      // Performance Insights: Optimized for priority and validity
      performanceInsights: '++id, userId, type, priority, createdAt, validUntil, [userId+priority], [userId+validUntil]',

      // Race Goals: Optimized for date and priority queries
      raceGoals: '++id, userId, raceDate, priority, createdAt, [userId+raceDate], [userId+priority]',

      // Workout Templates: Optimized for template searches
      workoutTemplates: '++id, workoutType, trainingPhase, intensityZone, createdAt, [workoutType+trainingPhase]',

      // Coaching Profiles: User-specific lookups
      coachingProfiles: '++id, userId, coachingEffectivenessScore, lastAdaptationDate, createdAt',

      // Coaching Feedback: Optimized for interaction analysis
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt, [userId+interactionType], [userId+createdAt]',

      // Coaching Interactions: Optimized for tracking
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt, [userId+interactionType], [userId+createdAt]',

      // User Behavior Patterns: Optimized for pattern analysis
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt, [userId+patternType], [userId+confidenceScore]',

      // Goals: Optimized for status and priority filtering
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt, [userId+status], [userId+priority], [userId+goalType]',

      // Goal Milestones: Optimized for goal-specific queries
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt, [goalId+status], [goalId+targetDate]',

      // Goal Progress History: Optimized for progress tracking
      goalProgressHistory: '++id, goalId, progressValue, recordedAt, createdAt, [goalId+recordedAt]',

      // Goal Recommendations: Optimized for validity and priority
      goalRecommendations: '++id, userId, recommendationType, priority, validUntil, createdAt, [userId+priority], [userId+validUntil]',

      // Wearable Devices: Optimized for active device queries
      wearableDevices: '++id, userId, type, isActive, lastSyncAt, createdAt, [userId+isActive], [userId+type]',

      // Heart Rate Data: Optimized for time-series device data
      heartRateData: '++id, userId, deviceId, timestamp, heartRate, context, createdAt, [userId+timestamp], [deviceId+timestamp]',

      // Heart Rate Zones: User-specific zone lookups
      heartRateZones: '++id, userId, zoneName, minBpm, maxBpm, targetPercentage, actualPercentage, createdAt, [userId+zoneName]',

      // Heart Rate Zone Settings: Simple user lookup
      heartRateZoneSettings: '++id, userId, maxHeartRate, restingHeartRate, calculationMethod, createdAt',

      // Zone Distributions: Optimized for run analysis
      zoneDistributions: '++id, userId, runId, createdAt, [userId+runId]',

      // Advanced Metrics: Optimized for run metrics
      advancedMetrics: '++id, userId, runId, createdAt, [userId+runId]',

      // Running Dynamics: Optimized for device time-series
      runningDynamicsData: '++id, userId, deviceId, timestamp, createdAt, [userId+timestamp], [deviceId+timestamp]',

      // Sync Jobs: Optimized for status and priority queries
      syncJobs: '++id, userId, deviceType, status, priority, createdAt, [userId+status], [status+priority]',

      // Onboarding Sessions: Optimized for conversation tracking
      onboardingSessions: '++id, userId, conversationId, goalDiscoveryPhase, isCompleted, createdAt, [userId+isCompleted], [conversationId+goalDiscoveryPhase]',

      // Conversation Messages: Optimized for session and conversation queries
      conversationMessages: '++id, sessionId, conversationId, role, content, timestamp, createdAt, [sessionId+timestamp], [conversationId+timestamp]',

      // Sleep Data: Optimized for date-based queries
      sleepData: '++id, userId, deviceId, sleepDate, createdAt, [userId+sleepDate], [deviceId+sleepDate]',

      // HRV Measurements: Optimized for date-based queries
      hrvMeasurements: '++id, userId, deviceId, measurementDate, createdAt, [userId+measurementDate], [deviceId+measurementDate]',

      // Recovery Scores: Optimized for date and score queries
      recoveryScores: '++id, userId, scoreDate, overallScore, createdAt, [userId+scoreDate], [userId+overallScore]',

      // Subjective Wellness: Optimized for date queries
      subjectiveWellness: '++id, userId, assessmentDate, createdAt, [userId+assessmentDate]',

      // Data Fusion Rules: Optimized for active rules
      dataFusionRules: '++id, name, priority, isActive, createdAt, [isActive+priority]',

      // Fused Data Points: Optimized for time-series data type queries
      fusedDataPoints: '++id, userId, dataType, timestamp, createdAt, [userId+dataType], [userId+timestamp]',

      // Data Conflicts: Optimized for conflict resolution
      dataConflicts: '++id, userId, dataType, conflictType, detectedAt, createdAt, [userId+conflictType], [dataType+detectedAt]',

      // Data Sources: Optimized for active sources
      dataSources: '++id, name, type, priority, isActive, createdAt, [isActive+priority], [type+isActive]',

      // Habit Analytics: Optimized for risk and trend analysis
      habitAnalyticsSnapshots: '++id, userId, snapshotDate, riskLevel, consistencyTrend, createdAt, [userId+snapshotDate], [userId+riskLevel]',

      // Habit Insights: Optimized for priority and read status
      habitInsights: '++id, userId, insightType, priority, isRead, validUntil, createdAt, [userId+priority], [userId+isRead], [userId+validUntil]',

      // Habit Patterns: Optimized for pattern analysis
      habitPatterns: '++id, userId, patternType, confidence, lastObserved, createdAt, [userId+patternType], [userId+confidence]',

      // Routes: Optimized for difficulty filtering
      routes: '++id, name, distance, difficulty, createdAt, [difficulty+distance]',

      // Route Recommendations: Optimized for user route lookups
      routeRecommendations: '++id, userId, routeId, createdAt, [userId+routeId]',

      // User Route Preferences: Simple user lookup
      userRoutePreferences: '++id, userId, maxDistance, preferredDifficulty, createdAt',
    });

    this.version(2).stores({}).upgrade(async (trans) => {
      console.log('🔄 Upgrading database to version 2: Adding map fields to routes');

      // Update existing routes with default map values
      const routes = await trans.table('routes').toArray();

      for (const route of routes) {
        await trans.table('routes').update(route.id!, {
          routeType: 'predefined',
          createdBy: 'system',
          updatedAt: new Date()
        });
      }

      console.log(`✓ Database upgrade complete: Updated ${routes.length} routes with map fields`);
    });

  }
}

// Check IndexedDB compatibility and availability
function checkIndexedDBSupport(): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('⚠️ Not in browser environment, IndexedDB not available');
      return false;
    }
    
    // Check if IndexedDB API exists
    if (typeof window.indexedDB === 'undefined') {
      console.error('❌ IndexedDB API not available in this browser');
      return false;
    }
    
    // Check if IndexedDB is null (can happen in private browsing mode)
    if (window.indexedDB === null) {
      console.error('❌ IndexedDB is disabled (private browsing mode?)');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking IndexedDB support:', error);
    return false;
  }
}

// Database instance - lazy initialization
let dbInstance: RunSmartDB | null = null;

// Enhanced database initialization with error handling and concurrent access safety
async function checkStorageQuota(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        const percentUsed = (estimate.usage / estimate.quota) * 100;
        console.log(`[db:init] Storage: ${percentUsed.toFixed(1)}% used (${(estimate.usage / 1024 / 1024).toFixed(2)}MB / ${(estimate.quota / 1024 / 1024).toFixed(2)}MB)`);

        if (percentUsed > 90) {
          console.warn('[db:init] ⚠️ Storage quota nearly full - may cause issues');
        }
      }
    } catch (error) {
      console.warn('[db:init] Could not check storage quota:', error);
    }
  }
}

function createDatabaseInstance(): RunSmartDB | null {
  try {
    if (!checkIndexedDBSupport()) {
      console.warn('⚠️ IndexedDB not supported, database functionality will be limited');
      return null;
    }

    // Check storage quota (async but don't block initialization)
    checkStorageQuota().catch(err => console.warn('[db:init] Storage check failed:', err));

    console.log('✅ IndexedDB support confirmed, initializing database...');
    const db = new RunSmartDB();
    
    // Skip Dexie event wiring and transaction monkey-patching to avoid
    // non-fatal event subscription errors in some dev environments.
    // Core DB operations are still wrapped via safeDbOperation.
    return db;
    
    // Enhanced error handlers for concurrent access.
    // In some environments/bundles Dexie's event emitter can be unavailable
    // or partially initialised, causing `db.on(...)` to throw during setup.
    // That must never prevent the database from being created, so we wrap
    // all event wiring in a defensive try/catch and continue on failure.
    try {
      db.on('blocked', (event: any) => {
        console.warn('⚠️ Database blocked - handling concurrent access:', event);
        
        // Attempt to close other connections after a delay
        setTimeout(() => {
          try {
            console.log('🔄 Attempting to resolve database blocking...');
            // Force close and reopen can help resolve blocking
            if (db.isOpen()) {
              db.close();
              setTimeout(() => {
                db.open().catch(reopenError => {
                  console.error('❌ Failed to reopen database after blocking:', reopenError);
                });
              }, 1000);
            }
          } catch (blockResolveError) {
            console.error('❌ Error resolving database blocking:', blockResolveError);
          }
        }, 2000);
      });
      
      // Handle version changes gracefully
      db.on('versionchange', (event: any) => {
        console.log('🔄 Database version changed, handling gracefully...', event);
        // Close the database but don't immediately reopen to prevent conflicts
        db.close();
        
        // Notify if there are other tabs that need to reload
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('db-version-change', Date.now().toString());
          window.addEventListener('storage', (e) => {
            if (e.key === 'db-version-change') {
              console.log('🔄 Database version change detected across tabs');
            }
          });
        }
      });
      
    } catch (eventWireError) {
      console.warn(
        '⚠️ Failed to attach Dexie event handlers; continuing with basic database instance:',
        eventWireError
      );
    }

    return db;
  } catch (error) {
    console.error('❌ Failed to create database instance:', error);
    return null;
  }
}

// Lazy database getter - only initialize when needed and in browser
export function getDatabase(): RunSmartDB | null {
  if (typeof window === 'undefined') {
    // Server-side: return null
    return null;
  }
  
  if (!dbInstance) {
    dbInstance = createDatabaseInstance();
  }
  
  return dbInstance;
}

// Export db for backward compatibility using a Proxy that resolves the
// actual database instance on each property access. This avoids capturing
// a null value during SSR/module eval and fixes client hydration issues.
export const db = new Proxy({} as RunSmartDB, {
  get(_target, prop, _receiver) {
    const database = getDatabase();
    if (!database) {
      throw new Error('Database not available (IndexedDB unsupported or blocked)');
    }
    const value = (database as any)[prop as any];
    // Preserve method binding to the Dexie instance
    if (typeof value === 'function') {
      return value.bind(database);
    }
    return value;
  }
});

// Lazily expose dbUtils to maintain backwards compatibility for modules
// importing from '@/lib/db' while avoiding eager Dexie initialization.
export { dbUtils } from './dbUtils';

// Reset database instance - closes connection and clears cached instance
export function resetDatabaseInstance(): void {
  if (dbInstance) {
    try {
      console.log('[db:reset] Closing database connection...');
      dbInstance.close();
      console.log('[db:reset] Database connection closed');
    } catch (error) {
      console.warn('[db:reset] Error closing database:', error);
    }
    dbInstance = null;
    console.log('[db:reset] Database instance cleared');
  }
}

// Database availability check
export function isDatabaseAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false; // Not available on server
  }
  
  const database = getDatabase();
  return database !== null && checkIndexedDBSupport();
}

// Safe database operations wrapper
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T
): Promise<T> {
  try {
    // Check if we're on the server
    if (typeof window === 'undefined') {
      if (fallbackValue !== undefined) {
        console.log(`🔄 Server-side: Using fallback value for '${operationName}'`);
        return fallbackValue;
      }
      throw new Error(`Database operation '${operationName}' not available on server`);
    }
    
    if (!isDatabaseAvailable()) {
      if (fallbackValue !== undefined) {
        console.log(`🔄 Database unavailable: Using fallback value for '${operationName}'`);
        return fallbackValue;
      }
      throw new Error('Database not available');
    }
    
    return await operation();
  } catch (error) {
    console.error(`❌ Database operation '${operationName}' failed:`, error);
    
    if (fallbackValue !== undefined) {
      console.log(`🔄 Using fallback value for '${operationName}'`);
      return fallbackValue;
    }
    
    throw error;
  }
}

// Habit Analytics interfaces
export interface HabitAnalyticsSnapshot {
  id?: number;
  userId: number;
  snapshotDate: Date;
  currentStreak: number;
  longestStreak: number;
  weeklyConsistency: number; // 0-100 percentage
  monthlyConsistency: number; // 0-100 percentage
  consistencyTrend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
  goalAlignment: number; // 0-100
  planAdherence: number; // 0-100
  weekOverWeek: number; // percentage change
  monthOverMonth: number; // percentage change
  optimalTimes: string[]; // JSON array
  avgDuration: number; // minutes
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
  pattern: string; // JSON representation of the pattern
  confidence: number; // 0-100
  frequency: number; // how often this pattern occurs
  impact: number; // impact on habit formation (0-100)
  lastObserved: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Route interface for enhanced route selection
export interface Route {
  id?: number;
  name: string;
  distance: number; // in km
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyScore: number; // 0-100
  popularity: number; // 0-100
  elevationGain: number; // in meters
  surfaceType: string[]; // JSON array of surface types
  wellLit: boolean;
  lowTraffic: boolean;
  scenicScore: number; // 0-100
  estimatedTime: number; // in minutes
  description: string;
  tags: string[]; // JSON array of tags
  gpsPath?: string; // JSON string of GPS coordinates
  location?: string; // General location/area
  // Map-related fields (v3)
  startLat?: number; // Starting point latitude
  startLng?: number; // Starting point longitude
  endLat?: number; // Ending point latitude (for custom routes)
  endLng?: number; // Ending point longitude (for custom routes)
  routeType?: 'predefined' | 'custom'; // Route origin
  createdBy?: 'system' | 'user'; // Who created the route
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Route recommendation tracking
export interface RouteRecommendation {
  id?: number;
  userId: number;
  routeId: number;
  matchScore: number; // 0-100
  reasoning: string; // Why this route was recommended
  userPreferences: string; // JSON string of user preferences
  userExperience: string;
  selected: boolean; // Whether user selected this route
  createdAt: Date;
}

// User route preferences
export interface UserRoutePreferences {
  id?: number;
  userId: number;
  maxDistance: number;
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyImportance: number; // 0-100
  scenicImportance: number; // 0-100
  trafficPreference: 'low' | 'medium' | 'high';
  lightingPreference: 'day' | 'night' | 'any';
  createdAt: Date;
  updatedAt: Date;
}

// Database utilities
export const badgeMilestones = [3, 7, 30];
export const badgeTypes: { [key: number]: 'bronze' | 'silver' | 'gold' } = {
  3: 'bronze',
  7: 'silver',
  30: 'gold',
};
