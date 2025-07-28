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
  name: string;
  dataType: string; // 'heart_rate', 'sleep', 'activity', etc.
  priority: number; // 1-10, higher = more important
  fusionMethod: 'average' | 'weighted_average' | 'median' | 'mode' | 'latest' | 'earliest' | 'custom';
  weightFactors?: Record<string, number>; // deviceId -> weight
  conflictResolution: 'highest_priority' | 'most_recent' | 'highest_quality' | 'manual';
  qualityThreshold: number; // 0-100
  isActive: boolean;
  customLogic?: string; // JSON string for custom fusion logic
  createdAt: Date;
  updatedAt: Date;
}

export interface FusedDataPoint {
  id?: number;
  userId: number;
  dataType: string;
  timestamp: Date;
  value: number;
  unit: string;
  confidence: number; // 0-100
  quality: number; // 0-100
  fusionMethod: 'average' | 'weighted_average' | 'median' | 'mode' | 'latest' | 'earliest' | 'custom';
  sourceDevices: string[]; // Array of device IDs that contributed
  sourceWeights?: Record<string, number>; // deviceId -> weight used
  conflicts: DataConflict[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface DataConflict {
  id?: number;
  userId: number;
  dataType: string;
  conflictType: 'duplicate' | 'inconsistent' | 'outlier' | 'missing' | 'quality';
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedDevices: string[];
  conflictingValues: Record<string, any>;
  resolution?: 'auto_resolved' | 'manual_resolution' | 'ignored' | 'pending';
  resolutionMethod?: string;
  resolvedAt?: Date;
  fusedDataPointId?: number;
  createdAt: Date;
}

export interface DataSource {
  id?: number;
  userId: number;
  name: string;
  type: 'apple_watch' | 'garmin' | 'fitbit' | 'manual' | 'other';
  deviceId?: string;
  priority: number; // 1-10, higher = more important
  isActive: boolean;
  lastSync?: Date;
  syncFrequency: number; // minutes
  dataTypes: string[]; // Array of data types this source provides
  qualityScore: number; // 0-100
  reliabilityScore: number; // 0-100
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// User preferences and profile
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
  createdAt: Date;
  updatedAt: Date;
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
  shoeId?: number;
  completedAt: Date;
  createdAt: Date;
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
    description: string;
  };
  measurableOutcome: {
    successCriteria: string[];
    trackingMethod: string;
    measurementFrequency: 'daily' | 'weekly' | 'monthly';
  };
  achievabilityAssessment: {
    difficultyRating: number; // 1-10 scale
    requiredResources: string[];
    potentialObstacles: string[];
    mitigationStrategies: string[];
  };
  relevanceJustification: {
    personalImportance: number; // 1-10 scale
    alignmentWithValues: string;
    motivationalFactors: string[];
  };
  timeBound: {
    startDate: Date;
    deadline: Date;
    milestoneSchedule: number[]; // Percentage checkpoints [25, 50, 75]
    estimatedDuration: number; // in days
  };
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  lastUpdated: Date;
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
  currentValue: number;
  baselineValue: number;
  targetValue: number;
  progressPercentage: number;
  autoRecorded: boolean;
  notes?: string;
  createdAt: Date;
}

export interface GoalRecommendation {
  id?: number;
  userId: number;
  goalId?: number; // Related to existing goal, or null for new goal suggestions
  type: 'goal_creation' | 'goal_modification' | 'goal_achievement_strategy' | 'goal_timeline_adjustment';
  title: string;
  description: string;
  reasoning: string;
  confidence: number; // 0-1 scale
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  suggestedAction: string;
  metadata: any; // JSON for additional context
  createdAt: Date;
  updatedAt: Date;
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

  constructor() {
    super('RunSmartDB');
    
    // Consolidated schema - Single stable version
    this.version(1).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId, coachingStyle, goalInferred',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId, [userId+isActive]',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt, externalId',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
      performanceMetrics: '++id, userId, date, createdAt',
      personalRecords: '++id, userId, recordType, achievedAt, createdAt',
      performanceInsights: '++id, userId, type, priority, createdAt, validUntil',
      raceGoals: '++id, userId, raceDate, priority, createdAt',
      workoutTemplates: '++id, workoutType, trainingPhase, intensityZone, createdAt',
      coachingProfiles: '++id, userId, coachingEffectivenessScore, lastAdaptationDate, createdAt',
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt',
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt',
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt',
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt',
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt',
      goalProgressHistory: '++id, goalId, progressValue, recordedAt, createdAt',
      goalRecommendations: '++id, userId, recommendationType, priority, validUntil, createdAt',
      wearableDevices: '++id, userId, type, isActive, lastSyncAt, createdAt',
      heartRateData: '++id, userId, deviceId, timestamp, heartRate, context, createdAt',
      heartRateZones: '++id, userId, zoneName, minBpm, maxBpm, targetPercentage, actualPercentage, createdAt',
      heartRateZoneSettings: '++id, userId, maxHeartRate, restingHeartRate, calculationMethod, createdAt',
      zoneDistributions: '++id, userId, runId, createdAt',
      advancedMetrics: '++id, userId, runId, createdAt',
      runningDynamicsData: '++id, userId, deviceId, timestamp, createdAt',
      syncJobs: '++id, userId, deviceType, status, priority, createdAt',
      onboardingSessions: '++id, userId, conversationId, goalDiscoveryPhase, isCompleted, createdAt',
      conversationMessages: '++id, sessionId, conversationId, role, content, timestamp, createdAt',
      sleepData: '++id, userId, deviceId, sleepDate, createdAt',
      hrvMeasurements: '++id, userId, deviceId, measurementDate, createdAt',
      recoveryScores: '++id, userId, scoreDate, overallScore, createdAt',
      subjectiveWellness: '++id, userId, assessmentDate, createdAt',
      dataFusionRules: '++id, name, priority, isActive, createdAt',
      fusedDataPoints: '++id, userId, dataType, timestamp, createdAt',
      dataConflicts: '++id, userId, dataType, conflictType, detectedAt, createdAt',
      dataSources: '++id, name, type, priority, isActive, createdAt',
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

// Enhanced database initialization with error handling
function createDatabaseInstance(): RunSmartDB | null {
  try {
    if (!checkIndexedDBSupport()) {
      console.error('❌ IndexedDB not supported, database functionality will be limited');
      return null;
    }
    
    console.log('✅ IndexedDB support confirmed, initializing database...');
    return new RunSmartDB();
  } catch (error) {
    console.error('❌ Failed to create database instance:', error);
    return null;
  }
}

// Create database instance with proper error handling
export const db = createDatabaseInstance();

// Database availability check
export function isDatabaseAvailable(): boolean {
  return db !== null && checkIndexedDBSupport();
}

// Safe database operations wrapper
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T
): Promise<T> {
  try {
    if (!isDatabaseAvailable()) {
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

// Database utilities
export const badgeMilestones = [3, 7, 30];
export const badgeTypes: { [key: number]: 'bronze' | 'silver' | 'gold' } = {
  3: 'bronze',
  7: 'silver',
  30: 'gold',
};

export const dbUtils = {
  // Unified error handling for plan operations
  handlePlanError(error: unknown, operation: string): { title: string; description: string } {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    
    if (errorMessage.includes("onboarding")) {
      return {
        title: "Complete Onboarding First",
        description: "Please complete the onboarding process to create your training plan."
      }
    } else if (errorMessage.includes("not found")) {
      return {
        title: "User Account Error", 
        description: "There was an issue with your account. Please log in again or contact support."
      }
    } else if (errorMessage.includes("Database") || errorMessage.includes("Dexie")) {
      return {
        title: "Training Plan Error",
        description: "Unable to access your training plan data. Please try refreshing the page."
      }
    } else {
      return {
        title: "Training Plan Error",
        description: "Unable to access or create your training plan. Please try again or contact support."
      }
    }
  },
  
  // Additional database utilities would be added here
  // For now, closing the object to fix syntax errors
};

