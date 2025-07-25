import Dexie, { type EntityTable } from 'dexie';

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
    
    // Version 1: Initial schema
    this.version(1).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
    });

    // Version 2: Add streak tracking fields and indexes
    this.version(2).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
    }).upgrade(async tx => {
      // Migrate existing users to have streak fields with default values
      await tx.table('users').toCollection().modify(user => {
        user.currentStreak = 0;
        user.longestStreak = 0;
        user.lastActivityDate = null;
        user.streakLastUpdated = new Date();
      });
    });

    // Version 3: Add badges table
    this.version(3).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
    }).upgrade(async tx => {
      // No migration needed for badges (new table)
    });

    // Version 4: Habit reminder fields
    this.version(4).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
    }).upgrade(async tx => {
      await tx.table('users').toCollection().modify(user => {
        if (user.reminderEnabled === undefined) user.reminderEnabled = false;
        if (user.reminderTime === undefined) user.reminderTime = null;
        user.reminderSnoozedUntil = null;
      });
    });

    // Version 5: Add Cohort and CohortMember tables
    this.version(5).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
    }).upgrade(async tx => {
      await tx.table('users').toCollection().modify(user => {
        user.cohortId = null;
      });
    });

    // Version 6: Add Performance Analytics tables
    this.version(6).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
      performanceMetrics: '++id, userId, date, createdAt',
      personalRecords: '++id, userId, recordType, achievedAt, createdAt',
      performanceInsights: '++id, userId, type, priority, createdAt, validUntil',
    }).upgrade(async tx => {
      // No migration needed for new tables
    });

    // Version 7: Add RaceGoal and WorkoutTemplate tables for advanced plan customization
    this.version(7).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
    }).upgrade(async tx => {
      // Migrate existing plans to add planType
      await tx.table('plans').toCollection().modify(plan => {
        plan.planType = 'basic';
      });
    });

    // Version 8: Add Coaching Intelligence tables
    this.version(8).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
    }).upgrade(async tx => {
      // Initialize coaching profiles for existing users
      const users = await tx.table('users').toArray();
      for (const user of users) {
        if (user.id) {
          await tx.table('coachingProfiles').add({
            userId: user.id,
            communicationStyle: {
              motivationLevel: 'medium',
              detailPreference: 'medium',
              personalityType: 'encouraging',
              preferredTone: 'friendly'
            },
            feedbackPatterns: {
              averageRating: 3.5,
              commonConcerns: [],
              responsiveness: 'immediate',
              preferredFeedbackFrequency: 'weekly'
            },
            behavioralPatterns: {
              workoutPreferences: {
                preferredDays: [],
                preferredTimes: [],
                workoutTypeAffinities: {},
                difficultyPreference: 5
              },
              contextualPatterns: {
                weatherSensitivity: 5,
                scheduleFlexibility: 5,
                stressResponse: 'maintain',
                energyPatterns: {}
              }
            },
            coachingEffectivenessScore: 50,
            lastAdaptationDate: new Date(),
            adaptationHistory: [],
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    });
    
    // Version 9: Add Goals tables
    this.version(9).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
    }).upgrade(async tx => {
      console.log('Running migration for version 9 - Adding goals tables')
      // Goals tables will be automatically created due to schema definition
      // No additional data migration needed for new tables
    });

    // Version 10: Add AI Guided Onboarding fields to users
    this.version(10).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId, coachingStyle, goalInferred',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
    }).upgrade(async tx => {
      console.log('Running migration for version 10 - Adding AI guided onboarding fields')
      // Add AI guided onboarding fields to existing users
      await tx.table('users').toCollection().modify(user => {
        if (user.motivations === undefined) user.motivations = [];
        if (user.barriers === undefined) user.barriers = [];
        if (user.coachingStyle === undefined) user.coachingStyle = 'supportive';
        if (user.goalInferred === undefined) user.goalInferred = false;
        if (user.onboardingSession === undefined) user.onboardingSession = null;
      });
    });

    // Version 11: Add compound index for better plan query performance  
    this.version(11).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId, coachingStyle, goalInferred',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId, [userId+isActive]',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
    }).upgrade(async tx => {
      console.log('Running migration for version 11 - Adding compound index [userId+isActive] for plans table performance optimization')
      // No data migration needed, just index optimization
    });

    // Version 12: Fix multiple active plans per user - ensure only one active plan per user
    this.version(12).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId, coachingStyle, goalInferred',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId, [userId+isActive]',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
    }).upgrade(async tx => {
      console.log('Running migration for version 12 - Deactivating duplicate active plans per user')
      
      // Find all users with multiple active plans
      const allUsers = await tx.table('users').toArray();
      let totalFixed = 0;
      
      for (const user of allUsers) {
        if (user.id) {
          // Get all active plans for this user
          const activePlans = await tx.table('plans')
            .where('userId').equals(user.id)
            .and(plan => plan.isActive === true)
            .toArray();
            
          if (activePlans.length > 1) {
            console.log(`User ${user.id} has ${activePlans.length} active plans, fixing...`);
            
            // Sort by creation date (most recent first) and keep only the most recent
            const sortedPlans = activePlans.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
            // Keep the most recent active, deactivate the rest
            const planToKeep = sortedPlans[0];
            const plansToDeactivate = sortedPlans.slice(1);
            
            console.log(`Keeping plan ${planToKeep.id} (${planToKeep.title}), deactivating ${plansToDeactivate.length} others`);
            
            for (const planToDeactivate of plansToDeactivate) {
              await tx.table('plans').update(planToDeactivate.id!, { 
                isActive: false,
                updatedAt: new Date()
              });
              totalFixed++;
            }
          }
        }
      }
      
      console.log(`Migration complete: deactivated ${totalFixed} duplicate active plans`);
    });

    // Version 13: Add wearable device integration tables
    this.version(13).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId, coachingStyle, goalInferred',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId, [userId+isActive]',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      // New wearable device tables
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zone, minBpm, maxBpm, name, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt'
    }).upgrade(async tx => {
      console.log('Running migration for version 13 - Adding wearable device tables');
      
      // Create default heart rate zones for existing users
      const users = await tx.table('users').toArray();
      for (const user of users) {
        if (user.id) {
          // Default heart rate zones based on age (if available) or general population
          const maxHR = user.age ? (220 - user.age) : 190; // Fallback to 190 for general population
          
          const zones = [
            { zone: 1, minBpm: Math.round(maxHR * 0.5), maxBpm: Math.round(maxHR * 0.6), name: 'Recovery', color: '#22c55e' },
            { zone: 2, minBpm: Math.round(maxHR * 0.6), maxBpm: Math.round(maxHR * 0.7), name: 'Aerobic', color: '#3b82f6' },
            { zone: 3, minBpm: Math.round(maxHR * 0.7), maxBpm: Math.round(maxHR * 0.8), name: 'Tempo', color: '#f59e0b' },
            { zone: 4, minBpm: Math.round(maxHR * 0.8), maxBpm: Math.round(maxHR * 0.9), name: 'Threshold', color: '#f97316' },
            { zone: 5, minBpm: Math.round(maxHR * 0.9), maxBpm: Math.round(maxHR * 1.0), name: 'VO2 Max', color: '#ef4444' }
          ];
          
          for (const zone of zones) {
            await tx.table('heartRateZones').add({
              userId: user.id,
              zone: zone.zone as (1 | 2 | 3 | 4 | 5),
              minBpm: zone.minBpm,
              maxBpm: zone.maxBpm,
              name: zone.name,
              color: zone.color,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }
    });

    // Version 14: Add sync jobs table for background sync functionality
    this.version(14).stores({
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
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      // Wearable device tables
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zoneNumber, minHeartRate, maxHeartRate, zoneName, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt',
      // New sync jobs table
      syncJobs: '++id, userId, deviceId, type, status, priority, scheduledAt, createdAt, [userId+deviceId+type]'
    }).upgrade(async tx => {
      console.log('Running migration for version 14 - Adding sync jobs table');
      // Sync jobs table will be automatically created
    });

    // Version 15: Enhanced heart rate zones with settings and distributions
    this.version(15).stores({
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
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt',
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt',
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt',
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt',
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt',
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      // Enhanced wearable device tables
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zoneNumber, name, minBpm, maxBpm, color, createdAt',
      heartRateZoneSettings: '++id, userId, calculationMethod, zoneSystem, autoUpdate, createdAt',
      zoneDistributions: '++id, runId, zone1Time, zone2Time, zone3Time, zone4Time, zone5Time, totalTime, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt',
      syncJobs: '++id, userId, deviceId, type, status, priority, scheduledAt, createdAt, [userId+deviceId+type]'
    }).upgrade(async tx => {
      console.log('Running migration for version 15 - Enhanced heart rate zones');
      
      // Create default heart rate zone settings for existing users
      const users = await tx.table('users').toArray();
      for (const user of users) {
        if (user.id && user.age) {
          const estimatedMaxHR = 220 - user.age;
          
          // Create zone settings
          await tx.table('heartRateZoneSettings').add({
            userId: user.id,
            calculationMethod: 'max_hr',
            maxHeartRate: estimatedMaxHR,
            zoneSystem: 'five_zone',
            autoUpdate: true,
            lastCalculated: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          // Create default zones based on max HR
          const zones = [
            { zone: 1, name: 'Recovery', min: 0, max: Math.round(estimatedMaxHR * 0.60), color: '#3B82F6' },
            { zone: 2, name: 'Aerobic Base', min: Math.round(estimatedMaxHR * 0.60), max: Math.round(estimatedMaxHR * 0.70), color: '#10B981' },
            { zone: 3, name: 'Aerobic', min: Math.round(estimatedMaxHR * 0.70), max: Math.round(estimatedMaxHR * 0.80), color: '#F59E0B' },
            { zone: 4, name: 'Threshold', min: Math.round(estimatedMaxHR * 0.80), max: Math.round(estimatedMaxHR * 0.90), color: '#F97316' },
            { zone: 5, name: 'VO2 Max', min: Math.round(estimatedMaxHR * 0.90), max: estimatedMaxHR, color: '#EF4444' }
          ];
          
          for (const zone of zones) {
            await tx.table('heartRateZones').add({
              userId: user.id,
              zoneNumber: zone.zone,
              name: zone.name,
              description: `Zone ${zone.zone} training`,
              minBpm: zone.min,
              maxBpm: zone.max,
              color: zone.color,
              trainingBenefit: `Benefits of Zone ${zone.zone} training`,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }
    });

    // Version 16: Add OnboardingSession and ConversationMessage tables for chat persistence
    this.version(16).stores({
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
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt',
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt',
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt',
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt',
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt',
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      // Enhanced wearable device tables
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zoneNumber, name, minBpm, maxBpm, color, createdAt',
      heartRateZoneSettings: '++id, userId, calculationMethod, zoneSystem, autoUpdate, createdAt',
      zoneDistributions: '++id, runId, zone1Time, zone2Time, zone3Time, zone4Time, zone5Time, totalTime, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt',
      syncJobs: '++id, userId, deviceId, type, status, priority, scheduledAt, createdAt, [userId+deviceId+type]',
      // New tables for onboarding and conversation persistence
      onboardingSessions: '++id, userId, conversationId, goalDiscoveryPhase, isCompleted, createdAt, [userId+conversationId]',
      conversationMessages: '++id, sessionId, conversationId, role, timestamp, phase, createdAt, [conversationId+timestamp]'
    }).upgrade(async tx => {
      console.log('Running migration for version 16 - Add OnboardingSession and ConversationMessage tables');
      
      // No data migration needed for new tables - they will start empty
      // Users can start new onboarding sessions which will use these tables
    });

    // Version 17: Add Recovery Metrics tables
    this.version(17).stores({
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
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt',
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt',
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt',
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt',
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt',
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      // Enhanced wearable device tables
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zoneNumber, name, minBpm, maxBpm, color, createdAt',
      heartRateZoneSettings: '++id, userId, calculationMethod, zoneSystem, autoUpdate, createdAt',
      zoneDistributions: '++id, runId, zone1Time, zone2Time, zone3Time, zone4Time, zone5Time, totalTime, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt',
      syncJobs: '++id, userId, deviceId, type, status, priority, scheduledAt, createdAt, [userId+deviceId+type]',
      // Onboarding and conversation tables
      onboardingSessions: '++id, userId, conversationId, goalDiscoveryPhase, isCompleted, createdAt, [userId+conversationId]',
      conversationMessages: '++id, sessionId, conversationId, role, timestamp, phase, createdAt, [conversationId+timestamp]',
      // Recovery metrics tables
      sleepData: '++id, userId, deviceId, date, createdAt',
      hrvMeasurements: '++id, userId, deviceId, measurementDate, measurementTime, createdAt',
      recoveryScores: '++id, userId, date, overallScore, createdAt',
      subjectiveWellness: '++id, userId, date, energyLevel, moodScore, sorenessLevel, stressLevel, motivationLevel, createdAt'
    }).upgrade(async tx => {
      console.log('Running migration for version 17 - Add Recovery Metrics tables');
      
      // No data migration needed for new recovery tables - they will start empty
      // Recovery data will be populated as users connect devices and provide wellness data
    });

    // Version 18: Add Data Fusion tables for multi-device data fusion
    this.version(18).stores({
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
      coachingFeedback: '++id, userId, interactionType, feedbackType, rating, createdAt',
      coachingInteractions: '++id, userId, interactionId, interactionType, createdAt',
      userBehaviorPatterns: '++id, userId, patternType, confidenceScore, lastObserved, createdAt',
      goals: '++id, userId, goalType, status, priority, createdAt, updatedAt',
      goalMilestones: '++id, goalId, milestoneOrder, status, targetDate, createdAt',
      goalProgressHistory: '++id, goalId, measurementDate, autoRecorded',
      goalRecommendations: '++id, userId, recommendationType, status, createdAt, expiresAt',
      wearableDevices: '++id, userId, type, deviceId, connectionStatus, lastSync, createdAt',
      heartRateData: '++id, runId, deviceId, timestamp, heartRate, accuracy, createdAt',
      heartRateZones: '++id, userId, zoneNumber, name, minBpm, maxBpm, color, createdAt',
      heartRateZoneSettings: '++id, userId, calculationMethod, zoneSystem, autoUpdate, createdAt',
      zoneDistributions: '++id, runId, zone1Time, zone2Time, zone3Time, zone4Time, zone5Time, totalTime, createdAt',
      advancedMetrics: '++id, runId, deviceId, vo2Max, lactateThresholdHR, trainingStressScore, createdAt',
      runningDynamicsData: '++id, runId, deviceId, averageCadence, averageGroundContactTime, averageVerticalOscillation, createdAt',
      syncJobs: '++id, userId, deviceId, type, status, priority, scheduledAt, createdAt, [userId+deviceId+type]',
      onboardingSessions: '++id, userId, conversationId, goalDiscoveryPhase, isCompleted, createdAt, [userId+conversationId]',
      conversationMessages: '++id, sessionId, conversationId, role, timestamp, phase, createdAt, [conversationId+timestamp]',
      sleepData: '++id, userId, deviceId, date, createdAt',
      hrvMeasurements: '++id, userId, deviceId, measurementDate, createdAt',
      recoveryScores: '++id, userId, date, createdAt',
      subjectiveWellness: '++id, userId, date, createdAt',
      // Data Fusion tables
      dataFusionRules: '++id, userId, dataType, primarySource, createdAt',
      fusedDataPoints: '++id, userId, dataType, timestamp, primarySource, createdAt',
      dataConflicts: '++id, fusedDataPointId, sourceDevice1, sourceDevice2, createdAt',
      dataSources: '++id, userId, deviceId, deviceType, isActive, createdAt'
    }).upgrade(async tx => {
      console.log('Running migration for version 18 - Adding Data Fusion tables for multi-device data fusion');
      // No data migration needed, new tables will start empty
    });
  }
}

// Create database instance
export const db = new RunSmartDB();

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
    
    console.error(`Plan ${operation} failed:`, errorMessage)
    
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

  // Database management utilities
  async ensureCoachingTablesExist(): Promise<boolean> {
    try {
      const requiredTables = ['coachingProfiles', 'coachingFeedback', 'coachingInteractions', 'userBehaviorPatterns'];
      const existingTables = db.tables.map(table => table.name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.error('Missing coaching tables:', missingTables);
        console.log('Current database version:', db.verno);
        console.log('Expected version: 10 or higher');
        
        if (db.verno < 10) {
          console.log('Database version is too old, forcing refresh...');
          // Delete the database to force recreation with latest schema
          await db.delete();
          // Reload the page to reinitialize the database
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking coaching tables:', error);
      return false;
    }
  },

  // User operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    console.log("=== CREATE USER START ===");
    console.log("Creating user with data:", userData);
    const now = new Date();
    
    try {
      const userId = await db.users.add({
        ...userData,
        createdAt: now,
        updatedAt: now,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakLastUpdated: null,
        reminderTime: null,
        reminderEnabled: false,
        reminderSnoozedUntil: null,
        cohortId: null,
      });
      
      console.log("✅ User created successfully with ID:", userId);

      // Create coaching profile for the new user
      try {
        console.log("📋 Creating coaching profile for user:", userId);
        await this.createCoachingProfile({
          userId: userId!,
          communicationStyle: {
            motivationLevel: 'medium',
            detailPreference: 'medium',
            personalityType: 'encouraging',
            preferredTone: 'friendly'
          },
          feedbackPatterns: {
            averageRating: 3.5,
            commonConcerns: [],
            responsiveness: 'immediate',
            preferredFeedbackFrequency: 'weekly'
          },
          behavioralPatterns: {
            workoutPreferences: {
              preferredDays: [],
              preferredTimes: [],
              workoutTypeAffinities: {},
              difficultyPreference: 5
            },
            contextualPatterns: {
              weatherSensitivity: 5,
              scheduleFlexibility: 5,
              stressResponse: 'maintain',
              energyPatterns: {}
            }
          },
          coachingEffectivenessScore: 50,
          lastAdaptationDate: now,
          adaptationHistory: []
        });
        console.log("✅ Coaching profile created successfully");
      } catch (error) {
        console.error('❌ Failed to create coaching profile for user:', error);
      }

      console.log("=== CREATE USER COMPLETE ===");
      return userId;
    } catch (error) {
      console.error("❌ Failed to create user:", error);
      throw error;
    }
  },

  async getCurrentUser(): Promise<User | undefined> {
    console.log("=== GET CURRENT USER START ===");
    // Return the most recently created user
    const users = await db.users.toArray();
    const user = users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    console.log("Retrieved user from database:", user ? { id: user.id, onboardingComplete: user.onboardingComplete } : "No user found");
    
    // Ensure coaching profile exists for this user
    if (user && user.id) {
      const profile = await this.getCoachingProfile(user.id);
      if (!profile) {
        console.log('📋 Creating missing coaching profile for user:', user.id);
        try {
          await this.createCoachingProfile({
            userId: user.id,
            communicationStyle: {
              motivationLevel: 'medium',
              detailPreference: 'medium',
              personalityType: 'encouraging',
              preferredTone: 'friendly'
            },
            feedbackPatterns: {
              averageRating: 3.5,
              commonConcerns: [],
              responsiveness: 'immediate',
              preferredFeedbackFrequency: 'weekly'
            },
            behavioralPatterns: {
              workoutPreferences: {
                preferredDays: [],
                preferredTimes: [],
                workoutTypeAffinities: {},
                difficultyPreference: 5
              },
              contextualPatterns: {
                weatherSensitivity: 5,
                scheduleFlexibility: 5,
                stressResponse: 'maintain',
                energyPatterns: {}
              }
            },
            coachingEffectivenessScore: 50,
            lastAdaptationDate: new Date(),
            adaptationHistory: []
          });
        } catch (error) {
          console.error('Failed to create coaching profile for existing user:', error);
        }
      }
    }
    
    return user;
  },

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db.users.update(id, { ...updates, updatedAt: new Date() });
  },

  async getReminderSettings(userId: number): Promise<{ time?: string; enabled: boolean; snoozedUntil?: Date | null }> {
    const user = await db.users.get(userId);
    return {
      time: user?.reminderTime || undefined,
      enabled: user?.reminderEnabled ?? false,
      snoozedUntil: user?.reminderSnoozedUntil ?? null,
    };
  },

  async updateReminderSettings(userId: number, settings: Partial<User>): Promise<void> {
    await this.updateUser(userId, settings);
  },

  // Helper function to ensure only one active plan per user
  async deactivateAllUserPlans(userId: number): Promise<void> {
    console.log(`🔄 Deactivating all active plans for user ${userId}`);
    const activePlans = await db.plans
      .where('userId')
      .equals(userId)
      .and(plan => plan.isActive === true)
      .toArray();
      
    console.log(`Found ${activePlans.length} active plans to deactivate`);
    
    for (const plan of activePlans) {
      await db.plans.update(plan.id!, { 
        isActive: false, 
        updatedAt: new Date() 
      });
      console.log(`Deactivated plan ${plan.id} (${plan.title})`);
    }
  },

  // Plan operations
  async createPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    console.log("=== CREATE PLAN START ===");
    console.log("Creating plan with data:", planData);
    const now = new Date();
    
    try {
      // If creating an active plan, deactivate any existing active plans for this user
      if (planData.isActive) {
        console.log("📋 Deactivating existing active plans for user:", planData.userId);
        await this.deactivateAllUserPlans(planData.userId);
      }
      
      const planId = await db.plans.add({
        ...planData,
        createdAt: now,
        updatedAt: now
      });
      
      console.log("✅ Plan created successfully with ID:", planId);
      console.log("=== CREATE PLAN COMPLETE ===");
      return planId;
    } catch (error) {
      console.error("❌ Failed to create plan:", error);
      throw error;
    }
  },

  async getActivePlan(userId: number): Promise<Plan | undefined> {
    try {
      // Use simple query that's guaranteed to work
      const plan = await db.plans
        .where('userId')
        .equals(userId)
        .and(plan => plan.isActive === true)
        .first();
        
      if (plan) {
        console.log(`🔍 getActivePlan found plan: "${plan.title}" (ID: ${plan.id}) for user ${userId}`);
      } else {
        console.log(`🔍 getActivePlan found no active plan for user ${userId}`);
      }
      return plan;
    } catch (error) {
      console.error(`❌ getActivePlan failed for user ${userId}:`, error);
      return undefined;
    }
  },

  async getPlan(planId: number): Promise<Plan | undefined> {
    try {
      const plan = await db.plans.get(planId);
      
      if (plan) {
        console.log(`🔍 getPlan found plan: "${plan.title}" (ID: ${plan.id})`);
        // Load associated workouts
        const workouts = await this.getWorkoutsByPlan(plan.id!);
        return { ...plan, workouts };
      } else {
        console.log(`🔍 getPlan found no plan with ID ${planId}`);
      }
      return undefined;
    } catch (error) {
      console.error(`❌ getPlan failed for plan ID ${planId}:`, error);
      return undefined;
    }
  },

  async updatePlan(id: number, updates: Partial<Plan>): Promise<void> {
    // If activating a plan, first deactivate all other active plans for the same user
    if (updates.isActive === true) {
      const plan = await db.plans.get(id);
      if (plan) {
        await this.deactivateAllUserPlans(plan.userId);
      }
    }
    
    await db.plans.update(id, { ...updates, updatedAt: new Date() });
  },

  // Workout operations
  async createWorkout(workoutData: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.workouts.add({
      ...workoutData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getWorkoutsByPlan(planId: number): Promise<Workout[]> {
    return await db.workouts.where('planId').equals(planId).toArray();
  },

  async getTodaysWorkout(userId: number): Promise<Workout | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activePlan = await this.getActivePlan(userId);
    if (!activePlan) return undefined;

    return await db.workouts
      .where('planId')
      .equals(activePlan.id!)
      .and(workout => 
        workout.scheduledDate >= today && 
        workout.scheduledDate < tomorrow
      )
      .first();
  },

  // Get workouts for a date range
  async getWorkoutsForDateRange(userId: number, startDate: Date, endDate: Date): Promise<Workout[]> {
    const activePlan = await this.getActivePlan(userId);
    if (!activePlan) return [];
    
    return await db.workouts
      .where('planId')
      .equals(activePlan.id!)
      .filter(workout => workout.scheduledDate >= startDate && workout.scheduledDate <= endDate)
      .toArray();
  },

  async updateWorkout(id: number, updates: Partial<Workout>): Promise<void> {
    await db.workouts.update(id, { ...updates, updatedAt: new Date() });
  },

  async markWorkoutCompleted(workoutId: number): Promise<void> {
    await this.updateWorkout(workoutId, { completed: true });
    
    // Update streak for the user after completing workout
    const workout = await db.workouts.get(workoutId);
    if (workout) {
      const plan = await db.plans.get(workout.planId);
      if (plan) {
        await this.updateUserStreak(plan.userId);
      }
    }
  },

  // Run operations
  async createRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
    const runId = await db.runs.add({
      ...runData,
      createdAt: new Date()
    });

    // Update user streak after recording activity
    await this.updateUserStreak(runData.userId);

    return runId;
  },

  async getRunsByUser(userId: number): Promise<Run[]> {
    return await db.runs.where('userId').equals(userId).reverse().toArray();
  },

  async getRunStats(userId: number): Promise<{
    totalRuns: number;
    totalDistance: number;
    totalTime: number;
    avgPace: number;
    currentStreak: number;
  }> {
    const runs = await this.getRunsByUser(userId);
    
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const totalTime = runs.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = totalDistance > 0 ? totalTime / totalDistance : 0;
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < runs.length; i++) {
      const runDate = new Date(runs[i].completedAt);
      runDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === i) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalRuns,
      totalDistance,
      totalTime,
      avgPace,
      currentStreak
    };
  },

  // Shoe operations
  async createShoe(shoeData: Omit<Shoe, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.shoes.add({
      ...shoeData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getActiveShoes(userId: number): Promise<Shoe[]> {
    return await db.shoes.where({ userId, isActive: true }).toArray();
  },

  async updateShoe(id: number, updates: Partial<Shoe>): Promise<void> {
    await db.shoes.update(id, { ...updates, updatedAt: new Date() });
  },

  async addMileageToShoe(shoeId: number, distance: number): Promise<void> {
    await db.shoes.update(shoeId, {
      currentKm: (await db.shoes.get(shoeId))!.currentKm + distance,
      updatedAt: new Date(),
    });
  },

  // Chat message operations
  async createChatMessage(messageData: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<number> {
    return await db.chatMessages.add({
      ...messageData,
      timestamp: new Date(),
    });
  },

  async getChatMessages(userId: number, conversationId?: string): Promise<ChatMessage[]> {
    let messages = await db.chatMessages.where('userId').equals(userId).toArray();
    if (conversationId) {
      messages = messages.filter(msg => msg.conversationId === conversationId);
    }
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async getRecentChatMessages(userId: number, limit: number = 50): Promise<ChatMessage[]> {
    const messages = await db.chatMessages.where('userId').equals(userId).toArray();
    return messages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  async deleteChatHistory(userId: number, conversationId?: string): Promise<void> {
    let collection = db.chatMessages.where('userId').equals(userId);
    if (conversationId) {
      collection = collection.and(msg => msg.conversationId === conversationId);
    }
    await collection.delete();
  },

  // Streak calculation utilities
  async calculateCurrentStreak(userId: number): Promise<number> {
    const runs = await db.runs
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('completedAt');

    if (!runs.length) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from today and work backwards
    let checkDate = new Date(today);
    
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) { // Limit to 1 year lookback
      const dayStart = new Date(checkDate);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Check if there's a run on this day
      const runOnDay = runs.find(run => {
        const runDate = new Date(run.completedAt);
        return runDate >= dayStart && runDate <= dayEnd;
      });

      if (runOnDay) {
        streak++;
      } else {
        // No run on this day
        if (dayOffset === 0) {
          // Today - check if within grace period (24 hours from yesterday)
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          
          const lastRun = runs[0];
          const lastRunDate = new Date(lastRun.completedAt);
          
          if (lastRunDate >= yesterday) {
            // Within grace period, continue checking
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        // Streak broken
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  },

  async updateUserStreak(userId: number): Promise<void> {
    try {
      const user = await db.users.get(userId);
      if (!user) return;

      const currentStreak = await this.calculateCurrentStreak(userId);
      const longestStreak = Math.max(currentStreak, user.longestStreak || 0);
      
      // Get last activity date
      const lastRun = await db.runs
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('completedAt')
        .then(runs => runs[0]);

      const lastActivityDate = lastRun ? new Date(lastRun.completedAt) : undefined;

      await this.updateUser(userId, {
        currentStreak,
        longestStreak,
        lastActivityDate,
        streakLastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error updating user streak:', error);
    }
    // After updating streak, check for badge unlocks
    const unlocked = await dbUtils.checkAndUnlockBadges(userId);
    // Optionally: trigger notification callback here (handled in UI)
  },

  async getStreakStats(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakLastUpdated: Date | null;
  }> {
    const user = await db.users.get(userId);
    if (!user) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakLastUpdated: null
      };
    }

    return {
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      lastActivityDate: user.lastActivityDate || null,
      streakLastUpdated: user.streakLastUpdated || null
    };
  },

  // Timezone-aware date utilities
  normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  },

  isSameDay(date1: Date, date2: Date): boolean {
    return this.normalizeDate(date1).getTime() === this.normalizeDate(date2).getTime();
  },

  getDaysDifference(date1: Date, date2: Date): number {
    const normalizedDate1 = this.normalizeDate(date1);
    const normalizedDate2 = this.normalizeDate(date2);
    return Math.floor((normalizedDate1.getTime() - normalizedDate2.getTime()) / (1000 * 60 * 60 * 24));
  },

  // Migration utilities
  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Check if we already have data
      const existingUser = await this.getCurrentUser();
      if (existingUser) return;

      // Migrate onboarding data
      const onboardingComplete = localStorage.getItem('onboarding-complete');
      if (onboardingComplete) {
        // Create a default user since we don't have the original onboarding data
        await this.createUser({
          goal: 'habit',
          experience: 'beginner',
          preferredTimes: ['morning'],
          daysPerWeek: 3,
          consents: {
            data: true,
            gdpr: true,
            push: false
          },
          onboardingComplete: true
        });
      }

      // Migrate shoes data
      const shoesData = localStorage.getItem('running-shoes');
      if (shoesData) {
        const shoes = JSON.parse(shoesData);
        const user = await this.getCurrentUser();
        if (user) {
          for (const shoe of shoes) {
            await this.createShoe({
              userId: user.id!,
              name: shoe.name,
              brand: shoe.brand,
              model: shoe.model,
              initialKm: shoe.initialKm,
              currentKm: shoe.currentKm,
              maxKm: shoe.maxKm,
              startDate: new Date(shoe.startDate),
              isActive: true
            });
          }
        }
      }

      console.log('Migration from localStorage completed');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  },

  // Badge utility functions
  async checkAndUnlockBadges(userId: number): Promise<Badge[]> {
    const user = await db.users.get(userId);
    if (!user || !user.currentStreak) return [];
    const unlocked: Badge[] = [];
    for (const milestone of badgeMilestones) {
      if (user.currentStreak >= milestone) {
        const type = badgeTypes[milestone];
        const existing = await db.badges.where({ userId, milestone }).first();
        if (!existing) {
          const badge: Badge = {
            userId,
            type,
            milestone,
            unlockedAt: new Date(),
            streakValueAchieved: user.currentStreak,
          };
          const id = await db.badges.add(badge);
          unlocked.push({ ...badge, id });
        }
      }
    }
    return unlocked;
  },
  async getUserBadges(userId: number): Promise<Badge[]> {
    return await db.badges.where({ userId }).sortBy('milestone');
  },
  async unlockBadge(userId: number, milestone: number): Promise<Badge | undefined> {
    const user = await db.users.get(userId);
    if (!user) return undefined;
    const type = badgeTypes[milestone];
    const existing = await db.badges.where({ userId, milestone }).first();
    if (existing) return existing;
    const badge: Badge = {
      userId,
      type,
      milestone,
      unlockedAt: new Date(),
      streakValueAchieved: user.currentStreak || milestone,
    };
    const id = await db.badges.add(badge);
    return { ...badge, id };
  },

  // Cohort operations
  async getUserById(userId: number): Promise<User | undefined> {
    return await db.users.get(userId);
  },

  async getCohortStats(cohortId: number): Promise<{
    totalMembers: number;
    activeMembers: number;
    totalRuns: number;
    totalDistance: number;
    avgDistance: number;
    weeklyRuns: number;
    weeklyDistance: number;
    cohortName: string;
  }> {
    // Get cohort information
    const cohort = await db.cohorts.get(cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Get all cohort members
    const members = await db.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map(m => m.userId);

    // Get all runs from cohort members
    const allRuns = await db.runs.where('userId').anyOf(memberIds).toArray();
    
    // Calculate active members (members who have run in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRuns = allRuns.filter(run => new Date(run.completedAt) >= sevenDaysAgo);
    const activeMemberIds = new Set(recentRuns.map(run => run.userId));

    // Calculate weekly stats
    const weeklyRuns = recentRuns.length;
    const weeklyDistance = recentRuns.reduce((total, run) => total + run.distance, 0);

    // Calculate total stats
    const totalRuns = allRuns.length;
    const totalDistance = allRuns.reduce((total, run) => total + run.distance, 0);
    const avgDistance = totalRuns > 0 ? totalDistance / totalRuns : 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMemberIds.size,
      totalRuns,
      totalDistance,
      avgDistance,
      weeklyRuns,
      weeklyDistance,
      cohortName: cohort.name,
    };
  },

  // Performance Analytics operations
  async calculatePerformanceMetrics(userId: number, date: Date): Promise<PerformanceMetrics> {
    const runs = await db.runs.where('userId').equals(userId).toArray();
    const dateString = date.toISOString().split('T')[0];
    const dayRuns = runs.filter(run => 
      new Date(run.completedAt).toISOString().split('T')[0] === dateString
    );

    if (dayRuns.length === 0) {
      return {
        userId,
        date,
        averagePace: 0,
        totalDistance: 0,
        totalDuration: 0,
        consistencyScore: 0,
        performanceScore: 0,
        trainingLoad: 0,
        recoveryScore: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const totalDistance = dayRuns.reduce((sum, run) => sum + run.distance, 0);
    const totalDuration = dayRuns.reduce((sum, run) => sum + run.duration, 0);
    const averagePace = totalDistance > 0 ? totalDuration / totalDistance : 0;

    // Calculate consistency score (0-100) based on pace variation
    const paces = dayRuns.map(run => run.pace).filter(pace => pace > 0);
    const avgPace = paces.length > 0 ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : 0;
    const paceVariance = paces.length > 1 ? 
      paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length : 0;
    const consistencyScore = Math.max(0, 100 - (paceVariance / avgPace * 100));

    // Calculate performance score based on improvement trends
    const last7Days = new Date(date);
    last7Days.setDate(last7Days.getDate() - 7);
    const recentRuns = runs.filter(run => new Date(run.completedAt) >= last7Days);
    const recentAvgPace = recentRuns.length > 0 ? 
      recentRuns.reduce((sum, run) => sum + run.pace, 0) / recentRuns.length : averagePace;
    const performanceScore = Math.min(100, Math.max(0, 100 - (averagePace - recentAvgPace) * 10));

    // Calculate training load (simple formula based on distance and duration)
    const trainingLoad = totalDistance * 10 + totalDuration / 60;

    // Calculate recovery score (decreases with higher training load)
    const recoveryScore = Math.max(0, 100 - trainingLoad * 0.5);

    return {
      userId,
      date,
      averagePace,
      totalDistance,
      totalDuration,
      consistencyScore,
      performanceScore,
      trainingLoad,
      recoveryScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async savePerformanceMetrics(metrics: Omit<PerformanceMetrics, 'id'>): Promise<number> {
    return await db.performanceMetrics.add(metrics);
  },

  async getPerformanceMetrics(userId: number, startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    return await db.performanceMetrics
      .where('userId').equals(userId)
      .and(metrics => metrics.date >= startDate && metrics.date <= endDate)
      .toArray();
  },

  async checkAndUpdatePersonalRecordsFromRun(userId: number, runId: number): Promise<PersonalRecord[]> {
    const run = await db.runs.get(runId);
    if (!run) return [];

    const newRecords: PersonalRecord[] = [];
    const now = new Date();

    // Check fastest times for different distances
    const distanceRecords = [
      { distance: 1, type: 'fastest_1k' as const },
      { distance: 5, type: 'fastest_5k' as const },
      { distance: 10, type: 'fastest_10k' as const },
    ];

    for (const record of distanceRecords) {
      if (run.distance >= record.distance) {
        const timeForDistance = (run.duration / run.distance) * record.distance;
        const existingRecord = await db.personalRecords
          .where({ userId, recordType: record.type })
          .first();

        if (!existingRecord || timeForDistance < existingRecord.value) {
          const personalRecord: PersonalRecord = {
            userId,
            recordType: record.type,
            value: timeForDistance,
            achievedAt: new Date(run.completedAt),
            runId: run.id,
            createdAt: now,
            updatedAt: now,
          };

          if (existingRecord) {
            await db.personalRecords.update(existingRecord.id!, personalRecord);
          } else {
            await db.personalRecords.add(personalRecord);
          }
          newRecords.push(personalRecord);
        }
      }
    }

    // Check longest run
    const longestRecord = await db.personalRecords
      .where({ userId, recordType: 'longest_run' })
      .first();

    if (!longestRecord || run.distance > longestRecord.value) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'longest_run',
        value: run.distance,
        achievedAt: new Date(run.completedAt),
        runId: run.id,
        createdAt: now,
        updatedAt: now,
      };

      if (longestRecord) {
        await db.personalRecords.update(longestRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    // Check best pace
    const bestPaceRecord = await db.personalRecords
      .where({ userId, recordType: 'best_pace' })
      .first();

    if (run.pace > 0 && (!bestPaceRecord || run.pace < bestPaceRecord.value)) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'best_pace',
        value: run.pace,
        achievedAt: new Date(run.completedAt),
        runId: run.id,
        createdAt: now,
        updatedAt: now,
      };

      if (bestPaceRecord) {
        await db.personalRecords.update(bestPaceRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    return newRecords;
  },

  async getPersonalRecords(userId: number): Promise<PersonalRecord[]> {
    return await db.personalRecords.where('userId').equals(userId).toArray();
  },

  async generatePerformanceInsights(userId: number): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = [];
    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= last30Days)
      .toArray();

    if (recentRuns.length === 0) {
      return insights;
    }

    // Trend analysis
    const firstHalf = recentRuns.slice(0, Math.floor(recentRuns.length / 2));
    const secondHalf = recentRuns.slice(Math.floor(recentRuns.length / 2));
    
    const firstHalfAvgPace = firstHalf.reduce((sum, run) => sum + run.pace, 0) / firstHalf.length;
    const secondHalfAvgPace = secondHalf.reduce((sum, run) => sum + run.pace, 0) / secondHalf.length;

    if (secondHalfAvgPace < firstHalfAvgPace) {
      insights.push({
        userId,
        type: 'improvement',
        title: 'Pace Improvement Detected',
        description: `Your average pace has improved by ${Math.abs(firstHalfAvgPace - secondHalfAvgPace).toFixed(0)} seconds per km over the last 30 days!`,
        priority: 'high',
        actionable: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Volume analysis
    const avgDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length;
    const lastWeekRuns = recentRuns.filter(run => {
      const runDate = new Date(run.completedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return runDate >= weekAgo;
    });

    const lastWeekAvgDistance = lastWeekRuns.length > 0 ? 
      lastWeekRuns.reduce((sum, run) => sum + run.distance, 0) / lastWeekRuns.length : 0;

    if (lastWeekAvgDistance < avgDistance * 0.7) {
      insights.push({
        userId,
        type: 'warning',
        title: 'Reduced Training Volume',
        description: 'Your training volume has decreased significantly this week. Consider gradually increasing your mileage.',
        priority: 'medium',
        actionable: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Consistency analysis
    const runDates = recentRuns.map(run => new Date(run.completedAt).toDateString());
    const uniqueDates = new Set(runDates);
    const consistencyScore = (uniqueDates.size / 30) * 100;

    if (consistencyScore > 80) {
      insights.push({
        userId,
        type: 'achievement',
        title: 'Excellent Consistency',
        description: `You've maintained ${consistencyScore.toFixed(0)}% consistency this month. Keep it up!`,
        priority: 'high',
        actionable: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return insights;
  },

  async savePerformanceInsights(insights: Omit<PerformanceInsight, 'id'>[]): Promise<void> {
    for (const insight of insights) {
      await db.performanceInsights.add(insight);
    }
  },

  async getAllPerformanceInsights(userId: number): Promise<PerformanceInsight[]> {
    const now = new Date();
    return await db.performanceInsights
      .where('userId').equals(userId)
      .and(insight => !insight.validUntil || insight.validUntil > now)
      .reverse()
      .sortBy('createdAt');
  },

  async getCohortPerformanceComparison(cohortId: number, userId: number, timeRange: string = '30d'): Promise<{
    userRank: number;
    totalMembers: number;
    userAvgPace: number;
    cohortAvgPace: number;
    userTotalDistance: number;
    cohortAvgDistance: number;
    percentile: number;
  }> {
    const members = await db.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map(m => m.userId);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const allRuns = await db.runs
      .where('userId').anyOf(memberIds)
      .and(run => new Date(run.completedAt) >= startDate)
      .toArray();

    // Group runs by user
    const userRuns = new Map<number, typeof allRuns>();
    allRuns.forEach(run => {
      if (!userRuns.has(run.userId)) {
        userRuns.set(run.userId, []);
      }
      userRuns.get(run.userId)!.push(run);
    });

    // Calculate stats for each user
    const userStats = Array.from(userRuns.entries()).map(([uid, runs]) => {
      const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
      const avgPace = runs.length > 0 ? runs.reduce((sum, run) => sum + run.pace, 0) / runs.length : 0;
      return { userId: uid, totalDistance, avgPace };
    });

    // Sort by total distance for ranking
    userStats.sort((a, b) => b.totalDistance - a.totalDistance);
    const userRank = userStats.findIndex(stat => stat.userId === userId) + 1;

    // Calculate cohort averages
    const cohortAvgDistance = userStats.length > 0 ? 
      userStats.reduce((sum, stat) => sum + stat.totalDistance, 0) / userStats.length : 0;
    const cohortAvgPace = userStats.length > 0 ? 
      userStats.reduce((sum, stat) => sum + stat.avgPace, 0) / userStats.length : 0;

    // Get user's stats
    const userStat = userStats.find(stat => stat.userId === userId);
    const userTotalDistance = userStat?.totalDistance || 0;
    const userAvgPace = userStat?.avgPace || 0;

    // Calculate percentile
    const percentile = userStats.length > 0 ? 
      ((userStats.length - userRank + 1) / userStats.length) * 100 : 0;

    return {
      userRank,
      totalMembers: userStats.length,
      userAvgPace,
      cohortAvgPace,
      userTotalDistance,
      cohortAvgDistance,
      percentile,
    };
  },

  // Additional helper functions for the API endpoints
  async getRunsInTimeRange(userId: number, startDate: Date, endDate: Date): Promise<Run[]> {
    return await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= startDate && new Date(run.completedAt) <= endDate)
      .toArray();
  },

  async calculatePerformanceTrends(runs: Run[]): Promise<{
    averagePace: number;
    consistencyScore: number;
    performanceScore: number;
    paceProgression: Array<{ date: Date; pace: number }>;
    distanceProgression: Array<{ date: Date; distance: number }>;
    consistencyProgression: Array<{ date: Date; consistency: number }>;
    performanceProgression: Array<{ date: Date; performance: number }>;
  }> {
    if (runs.length === 0) {
      return {
        averagePace: 0,
        consistencyScore: 0,
        performanceScore: 0,
        paceProgression: [],
        distanceProgression: [],
        consistencyProgression: [],
        performanceProgression: [],
      };
    }

    const averagePace = runs.reduce((sum, run) => sum + run.pace, 0) / runs.length;
    
    // Calculate consistency score
    const paceVariance = runs.reduce((sum, run) => sum + Math.pow(run.pace - averagePace, 2), 0) / runs.length;
    const consistencyScore = Math.max(0, 100 - (paceVariance / averagePace * 100));
    
    // Calculate performance score (improvement over time)
    const firstHalf = runs.slice(0, Math.floor(runs.length / 2));
    const secondHalf = runs.slice(Math.floor(runs.length / 2));
    
    const firstHalfAvgPace = firstHalf.reduce((sum, run) => sum + run.pace, 0) / firstHalf.length;
    const secondHalfAvgPace = secondHalf.reduce((sum, run) => sum + run.pace, 0) / secondHalf.length;
    
    const paceImprovement = firstHalfAvgPace - secondHalfAvgPace;
    const performanceScore = Math.min(100, Math.max(0, 50 + paceImprovement * 10));

    // Create progression arrays
    const paceProgression = runs.map(run => ({
      date: new Date(run.completedAt),
      pace: run.pace,
    }));

    const distanceProgression = runs.map(run => ({
      date: new Date(run.completedAt),
      distance: run.distance,
    }));

    const consistencyProgression = runs.map((run, index) => {
      const windowSize = Math.min(5, index + 1);
      const window = runs.slice(Math.max(0, index - windowSize + 1), index + 1);
      const windowAvgPace = window.reduce((sum, r) => sum + r.pace, 0) / window.length;
      const windowVariance = window.reduce((sum, r) => sum + Math.pow(r.pace - windowAvgPace, 2), 0) / window.length;
      const consistency = Math.max(0, 100 - (windowVariance / windowAvgPace * 100));
      
      return {
        date: new Date(run.completedAt),
        consistency,
      };
    });

    const performanceProgression = runs.map((run, index) => {
      const windowSize = Math.min(10, index + 1);
      const window = runs.slice(Math.max(0, index - windowSize + 1), index + 1);
      const windowFirstHalf = window.slice(0, Math.floor(window.length / 2));
      const windowSecondHalf = window.slice(Math.floor(window.length / 2));
      
      if (windowFirstHalf.length === 0 || windowSecondHalf.length === 0) {
        return {
          date: new Date(run.completedAt),
          performance: 50,
        };
      }
      
      const firstHalfPace = windowFirstHalf.reduce((sum, r) => sum + r.pace, 0) / windowFirstHalf.length;
      const secondHalfPace = windowSecondHalf.reduce((sum, r) => sum + r.pace, 0) / windowSecondHalf.length;
      const improvement = firstHalfPace - secondHalfPace;
      const performance = Math.min(100, Math.max(0, 50 + improvement * 10));
      
      return {
        date: new Date(run.completedAt),
        performance,
      };
    });

    return {
      averagePace,
      consistencyScore,
      performanceScore,
      paceProgression,
      distanceProgression,
      consistencyProgression,
      performanceProgression,
    };
  },

  async getPerformanceInsights(userId: number, startDate: Date, endDate: Date): Promise<PerformanceInsight[]> {
    return await db.performanceInsights
      .where('userId').equals(userId)
      .and(insight => new Date(insight.createdAt) >= startDate && new Date(insight.createdAt) <= endDate)
      .and(insight => !insight.validUntil || insight.validUntil > new Date())
      .toArray();
  },

  async getPersonalRecordProgression(userId: number, distance: number): Promise<Array<{
    date: Date;
    time: number;
    pace: number;
  }>> {
    const runs = await db.runs
      .where('userId').equals(userId)
      .and(run => run.distance >= distance * 0.95 && run.distance <= distance * 1.05)
      .toArray();

    return runs
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .map(run => ({
        date: new Date(run.completedAt),
        time: run.duration,
        pace: run.pace,
      }));
  },

  async deletePersonalRecord(userId: number, recordId: number): Promise<void> {
    await db.personalRecords.where({ id: recordId, userId }).delete();
  },

  // Race Goal operations
  async createRaceGoal(raceGoalData: Omit<RaceGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.raceGoals.add({
      ...raceGoalData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getRaceGoalsByUser(userId: number): Promise<RaceGoal[]> {
    return await db.raceGoals.where('userId').equals(userId).toArray();
  },

  async getRaceGoalById(id: number): Promise<RaceGoal | undefined> {
    return await db.raceGoals.get(id);
  },

  async updateRaceGoal(id: number, updates: Partial<RaceGoal>): Promise<void> {
    await db.raceGoals.update(id, { ...updates, updatedAt: new Date() });
  },

  async deleteRaceGoal(id: number): Promise<void> {
    await db.raceGoals.delete(id);
  },

  async getPrimaryRaceGoal(userId: number): Promise<RaceGoal | undefined> {
    return await db.raceGoals
      .where('userId').equals(userId)
      .and(goal => goal.priority === 'A')
      .first();
  },

  // Workout Template operations
  async createWorkoutTemplate(templateData: Omit<WorkoutTemplate, 'id' | 'createdAt'>): Promise<number> {
    return await db.workoutTemplates.add({
      ...templateData,
      createdAt: new Date()
    });
  },

  async getWorkoutTemplatesByPhase(trainingPhase: 'base' | 'build' | 'peak' | 'taper'): Promise<WorkoutTemplate[]> {
    return await db.workoutTemplates.where('trainingPhase').equals(trainingPhase).toArray();
  },

  async getWorkoutTemplatesByType(workoutType: string): Promise<WorkoutTemplate[]> {
    return await db.workoutTemplates.where('workoutType').equals(workoutType).toArray();
  },

  // Advanced plan operations
  async createAdvancedPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.plans.add({
      ...planData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getPlansByRaceGoal(raceGoalId: number): Promise<Plan[]> {
    return await db.plans.where('raceGoalId').equals(raceGoalId).toArray();
  },

  // Fitness assessment based on recent runs
  async assessFitnessLevel(userId: number): Promise<'beginner' | 'intermediate' | 'advanced'> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= thirtyDaysAgo)
      .toArray();

    if (recentRuns.length === 0) return 'beginner';

    const avgDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length;
    const avgPace = recentRuns.reduce((sum, run) => sum + (run.pace || 0), 0) / recentRuns.length;
    const weeklyVolume = recentRuns.reduce((sum, run) => sum + run.distance, 0) / 4; // 4 weeks

    // Advanced: >40km/week, sub-5:00/km average, >10km average distance
    if (weeklyVolume > 40 && avgPace < 300 && avgDistance > 10) {
      return 'advanced';
    }
    
    // Intermediate: 20-40km/week, 5:00-6:00/km average, 5-10km average distance
    if (weeklyVolume >= 20 && avgPace < 360 && avgDistance >= 5) {
      return 'intermediate';
    }
    
    return 'beginner';
  },

  // Calculate target pace based on race goal and current fitness
  async calculateTargetPaces(userId: number, raceGoalId: number): Promise<{
    easyPace: number;
    tempoPace: number;
    thresholdPace: number;
    intervalPace: number;
    racePace: number;
  }> {
    const raceGoal = await this.getRaceGoalById(raceGoalId);
    if (!raceGoal || !raceGoal.targetTime) {
      throw new Error('Race goal not found or target time not set');
    }

    const racePace = raceGoal.targetTime / raceGoal.distance; // seconds per km
    
    // Calculate training paces based on race pace
    return {
      easyPace: racePace * 1.2, // 20% slower than race pace
      tempoPace: racePace * 1.05, // 5% slower than race pace
      thresholdPace: racePace * 1.03, // 3% slower than race pace
      intervalPace: racePace * 0.95, // 5% faster than race pace
      racePace: racePace
    };
  },

  async checkAndUpdatePersonalRecords(userId: number, runId: number, distance: number, duration: number, pace: number, date: Date): Promise<PersonalRecord[]> {
    const newRecords: PersonalRecord[] = [];
    const now = new Date();

    // Check fastest times for different distances
    const distanceRecords = [
      { distance: 1, type: 'fastest_1k' as const },
      { distance: 5, type: 'fastest_5k' as const },
      { distance: 10, type: 'fastest_10k' as const },
      { distance: 21.1, type: 'fastest_half_marathon' as const },
      { distance: 42.2, type: 'fastest_marathon' as const },
    ];

    for (const record of distanceRecords) {
      if (distance >= record.distance) {
        const timeForDistance = (duration / distance) * record.distance;
        const existingRecord = await db.personalRecords
          .where({ userId, recordType: record.type })
          .first();

        if (!existingRecord || timeForDistance < existingRecord.value) {
          const personalRecord: PersonalRecord = {
            userId,
            recordType: record.type,
            distance: record.distance,
            timeForDistance,
            bestPace: pace,
            dateAchieved: date,
            runId,
            value: timeForDistance,
            achievedAt: date,
            createdAt: now,
            updatedAt: now,
          };

          if (existingRecord) {
            await db.personalRecords.update(existingRecord.id!, personalRecord);
          } else {
            await db.personalRecords.add(personalRecord);
          }
          newRecords.push(personalRecord);
        }
      }
    }

    // Check longest run
    const longestRecord = await db.personalRecords
      .where({ userId, recordType: 'longest_run' })
      .first();

    if (!longestRecord || distance > longestRecord.value) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'longest_run',
        distance,
        timeForDistance: duration,
        bestPace: pace,
        dateAchieved: date,
        runId,
        value: distance,
        achievedAt: date,
        createdAt: now,
        updatedAt: now,
      };

      if (longestRecord) {
        await db.personalRecords.update(longestRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    // Check best pace
    const bestPaceRecord = await db.personalRecords
      .where({ userId, recordType: 'best_pace' })
      .first();

    if (pace > 0 && (!bestPaceRecord || pace < bestPaceRecord.value)) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'best_pace',
        distance,
        timeForDistance: duration,
        bestPace: pace,
        dateAchieved: date,
        runId,
        value: pace,
        achievedAt: date,
        createdAt: now,
        updatedAt: now,
      };

      if (bestPaceRecord) {
        await db.personalRecords.update(bestPaceRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    return newRecords;
  },

  // Coaching Profile operations
  async getCoachingProfile(userId: number): Promise<CoachingProfile | undefined> {
    return await db.coachingProfiles.where('userId').equals(userId).first();
  },

  async createCoachingProfile(profileData: Omit<CoachingProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.coachingProfiles.add({
      ...profileData,
      createdAt: now,
      updatedAt: now
    });
  },

  async updateCoachingProfile(userId: number, updates: Partial<CoachingProfile>): Promise<void> {
    const profile = await this.getCoachingProfile(userId);
    if (profile) {
      await db.coachingProfiles.update(profile.id!, { ...updates, updatedAt: new Date() });
    }
  },

  // Coaching Feedback operations
  async recordCoachingFeedback(feedbackData: Omit<CoachingFeedback, 'id' | 'createdAt'>): Promise<number> {
    const feedbackId = await db.coachingFeedback.add({
      ...feedbackData,
      createdAt: new Date()
    });

    // Update coaching profile based on feedback
    await this.updateCoachingProfileFromFeedback(feedbackData.userId, feedbackData);
    
    return feedbackId;
  },

  async getCoachingFeedback(userId: number, limit: number = 50): Promise<CoachingFeedback[]> {
    return await db.coachingFeedback
      .where('userId').equals(userId)
      .reverse()
      .limit(limit)
      .toArray();
  },

  // Coaching Interactions operations
  async recordCoachingInteraction(interactionData: Omit<CoachingInteraction, 'id' | 'createdAt'>): Promise<number> {
    return await db.coachingInteractions.add({
      ...interactionData,
      createdAt: new Date()
    });
  },

  async getCoachingInteractions(userId: number, limit: number = 50): Promise<CoachingInteraction[]> {
    return await db.coachingInteractions
      .where('userId').equals(userId)
      .reverse()
      .limit(limit)
      .toArray();
  },

  // Behavior Pattern operations
  async recordBehaviorPattern(patternData: Omit<UserBehaviorPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const existing = await db.userBehaviorPatterns
      .where({ userId: patternData.userId, patternType: patternData.patternType })
      .first();

    const now = new Date();
    
    if (existing) {
      // Update existing pattern
      await db.userBehaviorPatterns.update(existing.id!, {
        patternData: patternData.patternData,
        confidenceScore: patternData.confidenceScore,
        lastObserved: patternData.lastObserved,
        observationCount: (existing.observationCount || 0) + 1,
        updatedAt: now
      });
      return existing.id!;
    } else {
      // Create new pattern
      return await db.userBehaviorPatterns.add({
        ...patternData,
        observationCount: 1,
        createdAt: now,
        updatedAt: now
      });
    }
  },

  async getBehaviorPatterns(userId: number, patternType?: string): Promise<UserBehaviorPattern[]> {
    let query = db.userBehaviorPatterns.where('userId').equals(userId);
    
    if (patternType) {
      query = query.and(pattern => pattern.patternType === patternType);
    }
    
    return await query.toArray();
  },

  // Adaptive coaching logic
  async updateCoachingProfileFromFeedback(userId: number, feedback: CoachingFeedback): Promise<void> {
    const profile = await this.getCoachingProfile(userId);
    if (!profile) return;

    // Update feedback patterns
    const currentAverage = profile.feedbackPatterns.averageRating;
    const feedbackCount = await db.coachingFeedback.where('userId').equals(userId).count();
    const newAverage = feedback.rating 
      ? (currentAverage * (feedbackCount - 1) + feedback.rating) / feedbackCount
      : currentAverage;

    // Adapt communication style based on feedback
    let adaptations = [];
    
    if (feedback.rating && feedback.rating < 3) {
      // Poor rating - adjust approach
      if (feedback.aspects?.motivation && feedback.aspects.motivation < 3) {
        if (profile.communicationStyle.motivationLevel === 'low') {
          profile.communicationStyle.motivationLevel = 'medium';
          adaptations.push('Increased motivation level due to feedback');
        } else if (profile.communicationStyle.motivationLevel === 'medium') {
          profile.communicationStyle.motivationLevel = 'high';
          adaptations.push('Increased motivation level to high due to feedback');
        }
      }
      
      if (feedback.aspects?.clarity && feedback.aspects.clarity < 3) {
        if (profile.communicationStyle.detailPreference === 'detailed') {
          profile.communicationStyle.detailPreference = 'medium';
          adaptations.push('Reduced detail level for clarity');
        } else if (profile.communicationStyle.detailPreference === 'minimal') {
          profile.communicationStyle.detailPreference = 'medium';
          adaptations.push('Increased detail level for clarity');
        }
      }
    }

    // Update effectiveness score
    const effectivenessImpact = feedback.rating ? (feedback.rating - 3) * 5 : 0; // -10 to +10
    const newEffectiveness = Math.max(0, Math.min(100, 
      profile.coachingEffectivenessScore + effectivenessImpact * 0.1
    ));

    // Record adaptations
    if (adaptations.length > 0) {
      profile.adaptationHistory.push({
        date: new Date(),
        adaptation: adaptations.join('; '),
        effectiveness: feedback.rating || 3,
        reason: feedback.feedbackText || 'User feedback indicated improvements needed'
      });
    }

    await this.updateCoachingProfile(userId, {
      feedbackPatterns: {
        ...profile.feedbackPatterns,
        averageRating: newAverage
      },
      communicationStyle: profile.communicationStyle,
      coachingEffectivenessScore: newEffectiveness,
      adaptationHistory: profile.adaptationHistory,
      lastAdaptationDate: adaptations.length > 0 ? new Date() : profile.lastAdaptationDate
    });
  },

  async generateAdaptivePrompt(userId: number, basePrompt: string, context?: any): Promise<string> {
    const profile = await this.getCoachingProfile(userId);
    if (!profile) return basePrompt;

    let adaptedPrompt = basePrompt;

    // Adapt for communication style
    const style = profile.communicationStyle;
    
    if (style.motivationLevel === 'high') {
      adaptedPrompt += " Use enthusiastic, highly motivational language with encouragement and positive reinforcement.";
    } else if (style.motivationLevel === 'low') {
      adaptedPrompt += " Use calm, measured language without excessive enthusiasm.";
    }

    if (style.detailPreference === 'detailed') {
      adaptedPrompt += " Provide comprehensive explanations with technical details, data, and scientific reasoning.";
    } else if (style.detailPreference === 'minimal') {
      adaptedPrompt += " Keep responses concise and to the point, avoiding unnecessary details.";
    }

    if (style.personalityType === 'analytical') {
      adaptedPrompt += " Focus on data-driven insights, metrics, and logical reasoning.";
    } else if (style.personalityType === 'encouraging') {
      adaptedPrompt += " Emphasize positive reinforcement, progress celebration, and supportive guidance.";
    }

    // Adapt for behavioral patterns
    const patterns = profile.behavioralPatterns;
    
    if (patterns.workoutPreferences.preferredDays.length > 0) {
      adaptedPrompt += ` Consider that the user typically prefers workouts on: ${patterns.workoutPreferences.preferredDays.join(', ')}.`;
    }

    // Add contextual adaptations
    if (context?.weather === 'rain' && patterns.contextualPatterns.weatherSensitivity > 7) {
      adaptedPrompt += " The user is weather-sensitive, so provide indoor alternatives and adjust expectations for outdoor conditions.";
    }

    if (context?.timeOfDay === 'morning' && patterns.workoutPreferences.preferredTimes.includes('morning')) {
      adaptedPrompt += " The user prefers morning workouts, so tailor recommendations accordingly.";
    }

    return adaptedPrompt;
  },

  async analyzeWorkoutPreferences(userId: number): Promise<void> {
    // Analyze completed workouts to identify patterns
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .reverse()
      .limit(50)
      .toArray();

    if (recentRuns.length < 5) return; // Need sufficient data

    // Analyze day preferences
    const dayFrequency: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    recentRuns.forEach(run => {
      const dayOfWeek = dayNames[new Date(run.completedAt).getDay()];
      dayFrequency[dayOfWeek] = (dayFrequency[dayOfWeek] || 0) + 1;
    });

    const preferredDays = Object.entries(dayFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    // Analyze workout type preferences
    const typeFrequency: Record<string, number> = {};
    recentRuns.forEach(run => {
      typeFrequency[run.type] = (typeFrequency[run.type] || 0) + 1;
    });

    const workoutTypeAffinities: Record<string, number> = {};
    Object.entries(typeFrequency).forEach(([type, count]) => {
      workoutTypeAffinities[type] = count / recentRuns.length * 100; // percentage
    });

    // Record the pattern
    await this.recordBehaviorPattern({
      userId,
      patternType: 'workout_preference',
      patternData: {
        pattern: 'day_and_type_preferences',
        frequency: recentRuns.length,
        conditions: ['sufficient_data'],
        outcomes: {
          preferredDays,
          workoutTypeAffinities,
          totalWorkouts: recentRuns.length
        }
      },
      confidenceScore: Math.min(90, recentRuns.length * 2), // Higher confidence with more data
      lastObserved: new Date()
    });

    // Update coaching profile
    const profile = await this.getCoachingProfile(userId);
    if (profile) {
      await this.updateCoachingProfile(userId, {
        behavioralPatterns: {
          ...profile.behavioralPatterns,
          workoutPreferences: {
            ...profile.behavioralPatterns.workoutPreferences,
            preferredDays,
            workoutTypeAffinities
          }
        }
      });
    }
  },

  // Goal management operations
  async createGoal(goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.goals.add({
      ...goalData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getGoalsByUser(userId: number, status?: Goal['status']): Promise<Goal[]> {
    let query = db.goals.where({ userId });
    if (status) {
      query = query.and(goal => goal.status === status);
    }
    return await query.reverse().sortBy('priority');
  },

  async getGoal(goalId: number): Promise<Goal | undefined> {
    return await db.goals.get(goalId);
  },

  async updateGoal(goalId: number, updates: Partial<Goal>): Promise<void> {
    await db.goals.update(goalId, { ...updates, updatedAt: new Date() });
  },

  async deleteGoal(goalId: number): Promise<void> {
    // Delete related data first
    await db.goalMilestones.where({ goalId }).delete();
    await db.goalProgressHistory.where({ goalId }).delete();
    await db.goalRecommendations.where({ goalId }).delete();
    await db.goals.delete(goalId);
  },

  // Goal milestone operations
  async createGoalMilestone(milestoneData: Omit<GoalMilestone, 'id' | 'createdAt'>): Promise<number> {
    return await db.goalMilestones.add({
      ...milestoneData,
      createdAt: new Date()
    });
  },

  async getGoalMilestones(goalId: number): Promise<GoalMilestone[]> {
    return await db.goalMilestones.where({ goalId }).sortBy('milestoneOrder');
  },

  async updateGoalMilestone(milestoneId: number, updates: Partial<GoalMilestone>): Promise<void> {
    await db.goalMilestones.update(milestoneId, updates);
  },

  async markMilestoneAchieved(milestoneId: number, achievedValue: number): Promise<void> {
    await db.goalMilestones.update(milestoneId, {
      status: 'achieved',
      achievedValue,
      achievedDate: new Date()
    });
  },

  // Goal progress tracking
  async recordGoalProgress(progressData: Omit<GoalProgressHistory, 'id'>): Promise<number> {
    const progressId = await db.goalProgressHistory.add(progressData);
    
    // Update the goal's current progress
    await this.updateGoalCurrentProgress(progressData.goalId);
    
    return progressId;
  },

  async getGoalProgressHistory(goalId: number, limit?: number): Promise<GoalProgressHistory[]> {
    let query = db.goalProgressHistory.where({ goalId }).reverse().sortBy('measurementDate');
    if (limit) {
      const results = await query;
      return results.slice(0, limit);
    }
    return await query;
  },

  async updateGoalCurrentProgress(goalId: number): Promise<void> {
    const goal = await this.getGoal(goalId);
    if (!goal) return;

    // Get the latest progress measurement
    const latestProgress = await db.goalProgressHistory
      .where({ goalId })
      .reverse()
      .sortBy('measurementDate');
    
    if (latestProgress.length > 0) {
      const currentValue = latestProgress[0].measuredValue;
      const progressPercentage = this.calculateGoalProgressPercentage(
        goal.baselineValue,
        currentValue,
        goal.targetValue,
        goal.goalType
      );
      
      await this.updateGoal(goalId, {
        currentValue,
        progressPercentage
      });
    }
  },

  calculateGoalProgressPercentage(
    baseline: number,
    current: number,
    target: number,
    goalType: Goal['goalType']
  ): number {
    if (baseline === target) return 100;
    
    // For time improvement goals, lower is better
    if (goalType === 'time_improvement') {
      if (baseline <= target) return 100; // Already at or better than target
      const totalImprovement = baseline - target;
      const currentImprovement = baseline - current;
      return Math.max(0, Math.min(100, (currentImprovement / totalImprovement) * 100));
    }
    
    // For distance, frequency, and other goals, higher is better
    const totalImprovement = Math.abs(target - baseline);
    const currentImprovement = Math.abs(current - baseline);
    return Math.min(100, (currentImprovement / totalImprovement) * 100);
  },

  // Goal recommendations
  async createGoalRecommendation(recommendationData: Omit<GoalRecommendation, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.goalRecommendations.add({
      ...recommendationData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getGoalRecommendations(userId: number, status?: GoalRecommendation['status']): Promise<GoalRecommendation[]> {
    let query = db.goalRecommendations.where({ userId });
    if (status) {
      query = query.and(rec => rec.status === status);
    }
    return await query.reverse().sortBy('confidenceScore');
  },

  async updateGoalRecommendation(recommendationId: number, updates: Partial<GoalRecommendation>): Promise<void> {
    await db.goalRecommendations.update(recommendationId, { ...updates, updatedAt: new Date() });
  },

  // SMART goal validation
  validateSMARTGoal(goalData: Partial<Goal>): { isValid: boolean; errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // Specific validation
    if (!goalData.title || goalData.title.length < 5) {
      errors.push('Goal title must be specific and descriptive (at least 5 characters)');
    }
    
    if (!goalData.specificTarget || !goalData.specificTarget.value) {
      errors.push('Goal must have a specific, quantifiable target');
    }
    
    // Measurable validation
    if (!goalData.measurableMetrics || goalData.measurableMetrics.length === 0) {
      errors.push('Goal must have measurable metrics for tracking progress');
    }
    
    // Achievable validation
    if (goalData.achievableAssessment && goalData.achievableAssessment.feasibilityScore < 30) {
      errors.push('Goal appears to be unrealistic based on current fitness level');
      suggestions.push('Consider extending the timeline or reducing the target value');
    }
    
    // Time-bound validation
    if (!goalData.timeBound || !goalData.timeBound.deadline) {
      errors.push('Goal must have a specific deadline');
    } else {
      const deadline = new Date(goalData.timeBound.deadline);
      const now = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDeadline < 7) {
        errors.push('Goal deadline should be at least one week in the future');
      } else if (daysUntilDeadline > 365) {
        suggestions.push('Consider breaking this long-term goal into smaller intermediate goals');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  },

  // Auto-update goal progress from runs
  async updateGoalProgressFromRun(run: Run): Promise<void> {
    if (!run.userId) return;
    
    const activeGoals = await this.getGoalsByUser(run.userId, 'active');
    
    for (const goal of activeGoals) {
      let relevantValue: number | null = null;
      
      // Determine if this run contributes to the goal
      switch (goal.goalType) {
        case 'time_improvement':
          if (goal.specificTarget.metric.includes('5k') && run.distance >= 4.8 && run.distance <= 5.2) {
            relevantValue = run.duration; // seconds
          } else if (goal.specificTarget.metric.includes('10k') && run.distance >= 9.8 && run.distance <= 10.2) {
            relevantValue = run.duration;
          } else if (goal.specificTarget.metric.includes('half_marathon') && run.distance >= 21) {
            relevantValue = run.duration;
          } else if (goal.specificTarget.metric.includes('marathon') && run.distance >= 42) {
            relevantValue = run.duration;
          }
          break;
          
        case 'distance_achievement':
          if (goal.specificTarget.metric === 'longest_run') {
            relevantValue = run.distance;
          }
          break;
          
        case 'frequency':
          if (goal.specificTarget.metric === 'weekly_runs') {
            // Count runs this week
            const weekStart = new Date(run.completedAt);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            
            const weekRuns = await db.runs
              .where('userId')
              .equals(run.userId)
              .and(r => r.completedAt >= weekStart && r.completedAt <= weekEnd)
              .count();
              
            relevantValue = weekRuns;
          }
          break;
      }
      
      if (relevantValue !== null) {
        await this.recordGoalProgress({
          goalId: goal.id!,
          measurementDate: run.completedAt,
          measuredValue: relevantValue,
          progressPercentage: this.calculateGoalProgressPercentage(
            goal.baselineValue,
            relevantValue,
            goal.targetValue,
            goal.goalType
          ),
          contributingActivityId: run.id,
          contributingActivityType: 'run',
          autoRecorded: true,
          context: {
            weather: 'unknown',
            mood: 'neutral'
          }
        });
      }
    }
  },

  // Generate goal milestones
  async generateGoalMilestones(goalId: number): Promise<GoalMilestone[]> {
    const goal = await this.getGoal(goalId);
    if (!goal) return [];
    
    const milestones: Omit<GoalMilestone, 'id' | 'createdAt'>[] = [];
    const totalDuration = goal.timeBound.deadline.getTime() - goal.timeBound.startDate.getTime();
    const totalImprovement = goal.targetValue - goal.baselineValue;
    
    // Generate milestones at specified percentages
    goal.timeBound.milestoneSchedule.forEach((percentage, index) => {
      const targetDate = new Date(goal.timeBound.startDate.getTime() + (totalDuration * (percentage / 100)));
      const targetValue = goal.baselineValue + (totalImprovement * (percentage / 100));
      
      milestones.push({
        goalId: goal.id!,
        milestoneOrder: index + 1,
        title: `${percentage}% Progress Milestone`,
        description: `Reach ${this.formatGoalValue(targetValue, goal.specificTarget.unit)} by this date`,
        targetValue,
        targetDate,
        status: 'pending',
        celebrationShown: false
      });
    });
    
    // Create the milestones in the database
    for (const milestone of milestones) {
      await this.createGoalMilestone(milestone);
    }
    
    return await this.getGoalMilestones(goalId);
  },

  formatGoalValue(value: number, unit: string): string {
    switch (unit) {
      case 'seconds':
        return formatDuration(value);
      case 'minutes':
        return `${Math.round(value * 10) / 10} min`;
      case 'kilometers':
        return `${Math.round(value * 10) / 10} km`;
      case 'runs':
        return `${Math.round(value)} runs`;
      default:
        return `${Math.round(value * 10) / 10} ${unit}`;
    }
  },

  // Testing utility - clear all data
  async clearDatabase(): Promise<void> {
    try {
      console.log('🗑️ Clearing database...')
      await db.delete()
      console.log('✅ Database cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear database:', error)
    }
  },

  async resetDatabase(): Promise<void> {
    try {
      console.log('🔄 Resetting database...')
      await db.delete()
      await db.open()
      console.log('✅ Database reset successfully')
    } catch (error) {
      console.error('❌ Failed to reset database:', error)
    }
  },

  async isDatabaseHealthy(): Promise<boolean> {
    try {
      await db.open()
      return true
    } catch (error) {
      console.error('❌ Database health check failed:', error)
      return false
    }
  },

  // Testing utility - delete a milestone
  async deleteGoalMilestone(milestoneId: number): Promise<void> {
    await db.goalMilestones.delete(milestoneId);
  },

  // Plan recovery and validation utilities
  async ensureUserHasActivePlan(userId: number): Promise<Plan> {
    console.log(`🔍 ensureUserHasActivePlan: Starting for user ${userId}`);
    
    try {
      // Check if user has an active plan
      console.log(`🔍 Step 1: Checking for existing active plan...`);
      let activePlan = await this.getActivePlan(userId);
      
      if (activePlan) {
        console.log(`✅ Found existing active plan: ${activePlan.title} (ID: ${activePlan.id})`);
        return activePlan;
      }

      console.log(`❌ No active plan found for user ${userId}, attempting recovery...`);
      
      // Check if user exists and has completed onboarding
      console.log(`🔍 Step 2: Checking user existence and onboarding status...`);
      const user = await this.getUserById(userId);
      
      if (!user) {
        console.error(`❌ User ${userId} not found in database`);
        throw new Error(`User ${userId} not found in database. Please complete onboarding first.`);
      }
      
      console.log(`✅ User found: ${user.name || 'No name'} (onboardingComplete: ${user.onboardingComplete})`);
      
      if (!user.onboardingComplete) {
        console.error(`❌ User ${userId} has not completed onboarding`);
        throw new Error("User has not completed onboarding. Please complete onboarding first.");
      }

      // Try to find the most recent plan that could be reactivated
      console.log(`🔍 Step 3: Looking for existing plans to reactivate...`);
      const recentPlans = await db.plans
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(5)
        .toArray();

      console.log(`📊 Found ${recentPlans.length} existing plans for user ${userId}`);
      
      if (recentPlans.length > 0) {
        const planToReactivate = recentPlans[0];
        console.log(`🔄 Attempting to reactivate recent plan: "${planToReactivate.title}" (ID: ${planToReactivate.id})`);
        
        try {
          // Reactivate the most recent plan
          await this.updatePlan(planToReactivate.id!, { isActive: true });
          
          // Verify the update succeeded
          const updatedPlan = await db.plans.get(planToReactivate.id!);
          if (!updatedPlan || !updatedPlan.isActive) {
            console.error(`❌ Plan reactivation failed - plan is not active after update`);
            throw new Error(`Failed to reactivate plan ${planToReactivate.id}`);
          }
          
          activePlan = await this.getActivePlan(userId);
          
          if (activePlan) {
            console.log(`✅ Successfully reactivated plan for user ${userId}: "${activePlan.title}"`);
            return activePlan;
          } else {
            console.warn(`⚠️ Plan reactivation appeared to succeed but getActivePlan still returns null`);
            // Try to return the directly retrieved plan as fallback
            if (updatedPlan.userId === userId && updatedPlan.isActive) {
              console.log(`🆘 Returning directly reactivated plan as fallback`);
              return updatedPlan as Plan;
            }
          }
        } catch (reactivationError) {
          console.error(`❌ Failed to reactivate plan: ${reactivationError.message}`);
        }
      }

      // If no plan can be reactivated, create a basic fallback plan
      console.log(`🔍 Step 4: Creating fallback plan for user ${userId}...`);
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 84); // 12 week plan
      
      const fallbackPlanData = {
        userId: userId,
        title: "Recovery Training Plan",
        description: "A basic training plan created automatically. You can customize this in your plan settings.",
        startDate,
        endDate,
        totalWeeks: 12,
        isActive: true,
        planType: 'basic' as const,
        trainingDaysPerWeek: user.daysPerWeek || 3,
        fitnessLevel: user.experience || 'beginner'
      };
      
      console.log(`📝 Creating plan with data:`, JSON.stringify(fallbackPlanData, null, 2));
      
      try {
        const planId = await this.createPlan(fallbackPlanData);
        console.log(`✅ Fallback plan created with ID: ${planId}`);
        
        // Use direct plan retrieval first to ensure the plan exists
        const createdPlan = await db.plans.get(planId);
        if (!createdPlan) {
          console.error(`❌ Plan creation failed - plan with ID ${planId} not found in database`);
          throw new Error(`Failed to create recovery plan for user ${userId}. Plan was not properly saved to database.`);
        }
        
        console.log(`✅ Direct plan verification successful: "${createdPlan.title}"`);
        
        // Ensure the plan is active (defensive check)
        if (!createdPlan.isActive) {
          console.warn(`⚠️ Created plan is not active, fixing...`);
          await this.updatePlan(planId, { isActive: true });
        }
        
        // Now try to get active plan (with retry for potential timing issues)
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          activePlan = await this.getActivePlan(userId);
          
          if (activePlan) {
            console.log(`✅ Successfully created and retrieved fallback plan for user ${userId}: "${activePlan.title}"`);
            return activePlan;
          }
          
          retryCount++;
          console.warn(`⚠️ getActivePlan returned null, retry ${retryCount}/${maxRetries}`);
          
          if (retryCount < maxRetries) {
            // Small delay to handle potential race conditions
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // If we get here, something is seriously wrong with the database state
        console.error(`❌ Plan creation succeeded but getActivePlan consistently returns null after ${maxRetries} retries`);
        console.error(`🔍 Debug info - Created Plan:`, createdPlan);
        
        // As a last resort, return the directly retrieved plan if it matches our criteria
        if (createdPlan.userId === userId && createdPlan.isActive) {
          console.log(`🆘 Returning directly retrieved plan as fallback`);
          return createdPlan as Plan;
        }
        
        throw new Error(`Failed to retrieve recovery plan for user ${userId}. Plan exists but getActivePlan query is failing.`);
        
      } catch (creationError) {
        console.error(`❌ Failed to create fallback plan: ${creationError.message}`);
        throw new Error(`Failed to create recovery plan for user ${userId}: ${creationError.message}`);
      }
      
    } catch (error) {
      console.error(`❌ ensureUserHasActivePlan failed for user ${userId}:`, error);
      throw error;
    }
  },

  async validateUserPlanIntegrity(userId: number): Promise<{
    hasActivePlan: boolean;
    hasCompletedOnboarding: boolean;
    planCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check user exists and onboarding status
    const user = await this.getUserById(userId);
    const hasCompletedOnboarding = user?.onboardingComplete || false;
    
    if (!user) {
      issues.push("User not found");
      return { hasActivePlan: false, hasCompletedOnboarding: false, planCount: 0, issues };
    }
    
    if (!hasCompletedOnboarding) {
      issues.push("User has not completed onboarding");
    }
    
    // Check plan status
    const activePlans = await db.plans.where({ userId, isActive: true }).toArray();
    const totalPlans = await db.plans.where('userId').equals(userId).count();
    
    const hasActivePlan = activePlans.length > 0;
    
    if (!hasActivePlan && hasCompletedOnboarding) {
      issues.push("User completed onboarding but has no active plan");
    }
    
    if (activePlans.length > 1) {
      issues.push(`User has multiple active plans (${activePlans.length})`);
    }
    
    return {
      hasActivePlan,
      hasCompletedOnboarding,
      planCount: totalPlans,
      issues
    };
  },

  // Onboarding conflict resolution utilities
  async cleanupUserData(userId: number): Promise<void> {
    console.log(`🧹 Cleaning up data for user ${userId}`);
    
    try {
      // Delete all related data for the user
      await db.transaction('rw', [
        db.plans,
        db.workouts, 
        db.runs,
        db.chatMessages,
        db.badges,
        db.performanceMetrics,
        db.coachingProfiles,
        db.coachingFeedback,
        db.coachingInteractions,
        db.userBehaviorPatterns,
        db.goals,
        db.goalMilestones,
        db.goalProgressHistory,
        db.goalRecommendations
      ], async () => {
        // Delete plans first (cascading deletes)
        const userPlans = await db.plans.where('userId').equals(userId).toArray();
        for (const plan of userPlans) {
          if (plan.id) {
            // Delete workouts for this plan
            await db.workouts.where('planId').equals(plan.id).delete();
          }
        }
        await db.plans.where('userId').equals(userId).delete();
        
        // Delete runs
        await db.runs.where('userId').equals(userId).delete();
        
        // Delete chat messages
        await db.chatMessages.where('userId').equals(userId).delete();
        
        // Delete badges
        await db.badges.where('userId').equals(userId).delete();
        
        // Delete performance metrics
        await db.performanceMetrics.where('userId').equals(userId).delete();
        
        // Delete coaching data
        await db.coachingProfiles.where('userId').equals(userId).delete();
        await db.coachingFeedback.where('userId').equals(userId).delete();
        await db.coachingInteractions.where('userId').equals(userId).delete();
        await db.userBehaviorPatterns.where('userId').equals(userId).delete();
        
        // Delete goals and related data
        const userGoals = await db.goals.where('userId').equals(userId).toArray();
        for (const goal of userGoals) {
          if (goal.id) {
            await db.goalMilestones.where('goalId').equals(goal.id).delete();
            await db.goalProgressHistory.where('goalId').equals(goal.id).delete();
          }
        }
        await db.goals.where('userId').equals(userId).delete();
        await db.goalRecommendations.where('userId').equals(userId).delete();
      });
      
      console.log(`✅ Successfully cleaned up data for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to cleanup data for user ${userId}:`, error);
      throw error;
    }
  },

  // Check if user creation is safe (prevent duplicates during onboarding)
  async isUserCreationSafe(): Promise<boolean> {
    try {
      // Check if there's already a user in the database
      const existingUser = await this.getCurrentUser();
      if (existingUser) {
        console.warn('⚠️ User already exists, creation not safe');
        return false;
      }

      // Check database integrity
      const integrityCheck = await this.validateUserPlanIntegrity(0); // Use 0 as placeholder
      if (integrityCheck.issues.length > 0) {
        console.warn('⚠️ Database integrity issues found:', integrityCheck.issues);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ User creation safety check failed:', error);
      return false;
    }
  },

  /**
   * Validate user onboarding state and plan integrity
   */
  async validateUserOnboardingState(userId: number): Promise<{
    isValid: boolean;
    hasActivePlan: boolean;
    hasCompletedOnboarding: boolean;
    planCount: number;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return {
          isValid: false,
          hasActivePlan: false,
          hasCompletedOnboarding: false,
          planCount: 0,
          issues: ['User not found'],
          recommendations: ['Create new user account']
        };
      }

      const plans = await this.plans.where('userId').equals(userId).toArray();
      const activePlans = plans.filter(p => p.isActive);
      const planCount = plans.length;
      const hasActivePlan = activePlans.length > 0;
      const hasCompletedOnboarding = user.onboardingComplete;

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check for multiple active plans
      if (activePlans.length > 1) {
        issues.push(`Multiple active plans found (${activePlans.length})`);
        recommendations.push('Deactivate duplicate plans');
      }

      // Check for incomplete onboarding with active plan
      if (!hasCompletedOnboarding && hasActivePlan) {
        issues.push('Active plan exists but onboarding incomplete');
        recommendations.push('Complete onboarding or deactivate plan');
      }

      // Check for completed onboarding without active plan
      if (hasCompletedOnboarding && !hasActivePlan) {
        issues.push('Onboarding complete but no active plan');
        recommendations.push('Generate new training plan');
      }

      const isValid = issues.length === 0;

      return {
        isValid,
        hasActivePlan,
        hasCompletedOnboarding,
        planCount,
        issues,
        recommendations
      };
    } catch (error) {
      console.error('❌ User onboarding state validation failed:', error);
      return {
        isValid: false,
        hasActivePlan: false,
        hasCompletedOnboarding: false,
        planCount: 0,
        issues: ['Validation error occurred'],
        recommendations: ['Check database integrity']
      };
    }
  },

  async cleanupFailedOnboarding(userId: number): Promise<void> {
    try {
      console.log(`🧹 Cleaning up failed onboarding for user ${userId}`);
      
      // Deactivate all plans for this user
      await this.deactivateAllUserPlans(userId);
      
      // Reset user onboarding status
      await this.updateUser(userId, { onboardingComplete: false });
      
      // Clear any partial data
      await this.plans.where('userId').equals(userId).delete();
      await this.workouts.where('planId').anyOf(
        await this.plans.where('userId').equals(userId).primaryKeys()
      ).delete();
      
      console.log(`✅ Cleanup completed for user ${userId}`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  },

  async repairUserState(userId: number): Promise<{
    success: boolean;
    actions: string[];
    errors: string[];
  }> {
    const actions: string[] = [];
    const errors: string[] = [];

    try {
      console.log(`🔧 Repairing user state for user ${userId}`);
      
      const validation = await this.validateUserOnboardingState(userId);
      
      if (!validation.isValid) {
        // Deactivate multiple active plans
        if (validation.hasActivePlan) {
          const activePlans = await this.plans.where('userId').equals(userId).filter(p => p.isActive).toArray();
          if (activePlans.length > 1) {
            // Keep the most recent plan, deactivate others
            const sortedPlans = activePlans.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
            for (let i = 1; i < sortedPlans.length; i++) {
              await this.updatePlan(sortedPlans[i].id!, { isActive: false });
              actions.push(`Deactivated duplicate plan ${sortedPlans[i].id}`);
            }
          }
        }

        // Reset onboarding if needed
        const user = await this.getUserById(userId);
        if (user && user.onboardingComplete && !validation.hasActivePlan) {
          await this.updateUser(userId, { onboardingComplete: false });
          actions.push('Reset onboarding completion status');
        }
      }

      return {
        success: errors.length === 0,
        actions,
        errors
      };
    } catch (error) {
      console.error('❌ User state repair failed:', error);
      errors.push(`Repair failed: ${error}`);
      return {
        success: false,
        actions,
        errors
      };
    }
  },

  async executeWithRollback<T>(
    operation: () => Promise<T>,
    rollbackOperation?: () => Promise<void>
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const result = await operation();
      return { success: true, result };
    } catch (error) {
      console.error('❌ Operation failed, attempting rollback:', error);
      
      if (rollbackOperation) {
        try {
          await rollbackOperation();
          console.log('✅ Rollback completed successfully');
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // OnboardingSession utilities
  async createOnboardingSession(userId: number, conversationId: string): Promise<OnboardingSession> {
    const session: OnboardingSession = {
      userId,
      conversationId,
      goalDiscoveryPhase: 'motivation',
      discoveredGoals: [],
      coachingStyle: 'supportive',
      sessionProgress: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const id = await db.onboardingSessions.add(session);
    return { ...session, id };
  },

  async updateOnboardingSession(id: number, updates: Partial<OnboardingSession>): Promise<void> {
    await db.onboardingSessions.update(id, { ...updates, updatedAt: new Date() });
  },

  async getOnboardingSession(userId: number, conversationId: string): Promise<OnboardingSession | undefined> {
    return await db.onboardingSessions
      .where(['userId', 'conversationId'])
      .equals([userId, conversationId])
      .first();
  },

  async getLatestOnboardingSession(userId: number): Promise<OnboardingSession | undefined> {
    const sessions = await db.onboardingSessions
      .where('userId')
      .equals(userId)
      .toArray();
    
    return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  },

  // ConversationMessage utilities
  async saveConversationMessage(message: Omit<ConversationMessage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConversationMessage> {
    const messageWithTimestamps: ConversationMessage = {
      ...message,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const id = await db.conversationMessages.add(messageWithTimestamps);
    return { ...messageWithTimestamps, id };
  },

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    const messages = await db.conversationMessages
      .where('conversationId')
      .equals(conversationId)
      .toArray();
    
    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },

  async getConversationMessagesByPhase(conversationId: string, phase: string): Promise<ConversationMessage[]> {
    const allMessages = await db.conversationMessages
      .where('conversationId')
      .equals(conversationId)
      .toArray();
    
    const filteredMessages = allMessages.filter(message => message.phase === phase);
    return filteredMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },

  async deleteConversationMessages(conversationId: string): Promise<void> {
    await db.conversationMessages.where('conversationId').equals(conversationId).delete();
  },

  // Data validation utilities
  validateOnboardingSession(session: Partial<OnboardingSession>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!session.userId) {
      errors.push('User ID is required');
    }
    
    if (!session.conversationId) {
      errors.push('Conversation ID is required');
    }
    
    if (session.goalDiscoveryPhase && 
        !['motivation', 'assessment', 'creation', 'refinement', 'complete'].includes(session.goalDiscoveryPhase)) {
      errors.push('Invalid goal discovery phase');
    }
    
    if (session.coachingStyle && 
        !['supportive', 'challenging', 'analytical', 'encouraging'].includes(session.coachingStyle)) {
      errors.push('Invalid coaching style');
    }
    
    if (session.sessionProgress !== undefined && 
        (session.sessionProgress < 0 || session.sessionProgress > 100)) {
      errors.push('Session progress must be between 0 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  validateConversationMessage(message: Partial<ConversationMessage>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!message.conversationId) {
      errors.push('Conversation ID is required');
    }
    
    if (!message.role || !['user', 'assistant'].includes(message.role)) {
      errors.push('Valid role (user or assistant) is required');
    }
    
    if (!message.content || message.content.trim().length === 0) {
      errors.push('Message content is required');
    }
    
    if (!message.timestamp) {
      errors.push('Message timestamp is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Helper functions
export const calculatePace = (durationSeconds: number, distanceKm: number): number => {
  if (distanceKm === 0) return 0;
  return durationSeconds / distanceKm;
};

export const formatPace = (paceSecondsPerKm: number): string => {
  if (paceSecondsPerKm === 0) return '--:--';
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.floor(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDuration = (durationSeconds: number): string => {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Adaptive Coaching Interfaces
export interface CoachingProfile {
  id?: number;
  userId: number;
  communicationStyle: {
    motivationLevel: 'low' | 'medium' | 'high';
    detailPreference: 'minimal' | 'balanced' | 'detailed';
    personalityType: 'analytical' | 'encouraging' | 'practical' | 'supportive';
    preferredTone: 'professional' | 'friendly' | 'casual' | 'motivational';
  };
  behavioralPatterns: {
    workoutPreferences: {
      preferredDays: string[];
      preferredTimes: string[];
      workoutTypeAffinities: Record<string, number>; // workout type -> preference score (0-100)
      difficultyPreference: number; // 1-10 scale
    };
    contextualPatterns: {
      weatherSensitivity: number; // 1-10 scale
      timeConstraintTolerance: number; // 1-10 scale
      stressResponse: 'maintain_intensity' | 'reduce_intensity' | 'increase_intensity';
      motivationTriggers: string[];
    };
  };
  feedbackPatterns: {
    preferredFeedbackFrequency: 'after_every_workout' | 'weekly' | 'monthly';
    feedbackStyle: 'detailed' | 'summary' | 'minimal';
    responsiveness: number; // 1-10 scale of how often they provide feedback
  };
  coachingEffectivenessScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachingInteraction {
  id?: number;
  userId: number;
  interactionId: string;
  interactionType: 'chat' | 'workout_feedback' | 'goal_setting' | 'plan_adjustment';
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
  userEngagement: {
    followUpQuestions: number;
    actionTaken: boolean;
    timeSpentReading?: number; // seconds
  };
  createdAt: Date;
}

export interface CoachingFeedback {
  id?: number;
  userId: number;
  interactionId: string;
  interactionType: 'chat' | 'workout_feedback' | 'goal_setting' | 'plan_adjustment';
  rating?: number; // 1-5 stars
  feedbackText?: string;
  feedbackType: 'helpful' | 'not_helpful' | 'too_detailed' | 'not_detailed_enough' | 'wrong_tone' | 'perfect';
  improvementSuggestions?: string;
  createdAt: Date;
}

export interface BehaviorPattern {
  id?: number;
  userId: number;
  patternType: 'workout_consistency' | 'goal_achievement' | 'feedback_style' | 'engagement_level';
  patternData: {
    pattern: string;
    frequency: number;
    conditions: string[];
    outcomes: Record<string, any>;
  };
  confidenceScore: number; // 0-100
  lastObserved: Date;
  createdAt: Date;
}

// Recovery Metrics interfaces
export interface SleepData {
  id?: number;
  userId: number;
  deviceId: string;
  date: Date;
  bedTime: Date;
  sleepTime: Date;
  wakeTime: Date;
  totalSleepTime: number; // minutes
  sleepEfficiency: number; // percentage
  deepSleepTime?: number; // minutes
  lightSleepTime?: number; // minutes
  remSleepTime?: number; // minutes
  awakeDuration?: number; // minutes
  sleepQualityScore?: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface HRVMeasurement {
  id?: number;
  userId: number;
  deviceId: string;
  measurementDate: Date;
  measurementTime: Date;
  rmssd: number; // milliseconds
  pnn50?: number; // percentage
  hrvScore?: number; // normalized 0-100
  measurementQuality: 'excellent' | 'good' | 'fair' | 'poor';
  measurementDuration: number; // seconds
  artifacts?: number; // count of artifacts detected
  createdAt: Date;
}

export interface RecoveryScore {
  id?: number;
  userId: number;
  date: Date;
  overallScore: number; // 0-100
  sleepScore: number; // 0-100
  hrvScore: number; // 0-100
  restingHRScore: number; // 0-100
  subjectiveWellnessScore?: number; // 0-100
  trainingLoadImpact: number; // negative impact on recovery
  stressLevel?: number; // 0-100
  recommendations: string[];
  confidence: number; // 0-100, how confident we are in the score
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectiveWellness {
  id?: number;
  userId: number;
  date: Date;
  energyLevel: number; // 1-10
  moodScore: number; // 1-10
  sorenessLevel: number; // 1-10
  stressLevel: number; // 1-10
  motivationLevel: number; // 1-10
  notes?: string;
  createdAt: Date;
}

// Data Fusion Interfaces
export interface DataFusionRule {
  id?: number;
  userId: number;
  dataType: string;
  primarySource: string; // device ID
  fallbackSources: string[]; // ordered list of fallback devices
  conflictResolution: 'prefer_primary' | 'most_recent' | 'highest_accuracy' | 'average' | 'manual';
  gapFillingEnabled: boolean;
  qualityThreshold: number; // minimum quality score to use data
  createdAt: Date;
  updatedAt: Date;
}

export interface FusedDataPoint {
  id?: number;
  userId: number;
  dataType: string;
  value: number;
  timestamp: Date;
  primarySource: string;
  contributingSources: string[];
  confidence: number; // 0-100, how confident we are in this value
  fusionMethod: 'single_source' | 'weighted_average' | 'interpolated' | 'extrapolated';
  qualityScore: number; // overall quality of the fused data point
  conflicts?: DataConflict[];
  createdAt: Date;
}

export interface DataConflict {
  id?: number;
  fusedDataPointId: number;
  sourceDevice1: string;
  sourceDevice2: string;
  value1: number;
  value2: number;
  difference: number;
  resolutionMethod: string;
  resolvedValue: number;
  manuallyResolved: boolean;
  createdAt: Date;
}

export interface DataSource {
  id?: number;
  userId: number;
  deviceId: string;
  deviceType: 'apple_watch' | 'garmin' | 'fitbit' | 'phone' | 'ring' | 'scale';
  dataTypes: string[]; // JSON array of supported data types
  priority: number; // 1-10, higher = more trusted
  accuracy: number; // 0-100, based on device specs and user feedback
  reliability: number; // 0-100, based on successful sync history
  lastSync: Date;
  isActive: boolean;
  capabilities: string[]; // JSON array of device capabilities
  createdAt: Date;
  updatedAt: Date;
}