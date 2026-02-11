//
// SharedModels.swift
// RunSmart
//
// AUTO-GENERATED from TypeScript interfaces in packages/shared/src/models/
// DO NOT EDIT MANUALLY - changes will be overwritten
//
// Generated: 2026-02-11T12:33:30.249Z
//

import Foundation


// MARK: - ChallengeTemplate
public struct ChallengeTemplate: Codable, Sendable {
    public var id: Double?
    public var slug: String
    public var name: String
    public var tagline: String
    public var description: String
    public var targetAudience: String
    public var promise: String
    public var durationDays: Double
    public var difficulty: 'beginner' | 'intermediate' | 'advanced'
    public var category: 'habit' | 'mindful' | 'performance' | 'recovery'
    public var thumbnailUrl: String?
    public var previewVideoUrl: String?
    public var workoutPattern: String
    public var coachTone: 'gentle' | 'tough_love' | 'analytical' | 'calm'
    public var dailyThemes: [String]
    public var isActive: Bool
    public var isFeatured: Bool
    public var sortOrder: Double
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - ChallengeProgress
public struct ChallengeProgress: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var challengeTemplateId: Double
    public var planId: Double
    public var startDate: Date
    public var currentDay: Double
    public var status: 'active' | 'completed' | 'abandoned'
    public var completedAt: Date?
    public var streakDays: Double
    public var totalDaysCompleted: Double
    public var lastPromptShownAt: Date?
    public var nextChallengeRecommended: Double?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - CoachingProfile
public struct CoachingProfile: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var communicationStyle: {
    public var motivationLevel: 'low' | 'medium' | 'high'
    public var detailPreference: 'minimal' | 'medium' | 'detailed'
    public var personalityType: 'analytical' | 'encouraging' | 'direct' | 'supportive'
    public var preferredTone: 'professional' | 'friendly' | 'enthusiastic' | 'calm'
}

// MARK: - CoachingFeedback
public struct CoachingFeedback: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var interactionType: 'workout_recommendation' | 'chat_response' | 'plan_adjustment' | 'motivation' | 'guidance'
    public var feedbackType: 'rating' | 'text' | 'behavioral' | 'quick_reaction'
    public var rating: Double?
    public var aspects: {?
    public var helpfulness: Double
    public var relevance: Double
    public var clarity: Double
    public var motivation: Double
    public var accuracy: Double
}

// MARK: - CoachingInteraction
public struct CoachingInteraction: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var interactionId: String
    public var interactionType: 'chat' | 'recommendation' | 'plan_generation' | 'feedback_response'
    public var promptUsed: String
    public var responseGenerated: String
    public var userContext: {
    public var currentGoals: [String]
    public var recentActivity: String
    public var mood: String?
    public var environment: String?
    public var timeConstraints: String?
}

// MARK: - UserBehaviorPattern
public struct UserBehaviorPattern: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var patternType: 'workout_preference' | 'schedule_pattern' | 'feedback_style' | 'motivation_response' | 'difficulty_adaptation'
    public var patternData: {
    public var pattern: String
    public var frequency: Double
    public var conditions: [String]
    public var outcomes: Record<string, any>
}

// MARK: - ChatMessage
public struct ChatMessage: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var role: 'user' | 'assistant'
    public var content: String
    public var timestamp: Date
    public var tokenCount: Double?
    public var aiContext: String?
    public var conversationId: String?
}

// MARK: - WearableDevice
public struct WearableDevice: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var type: 'apple_watch' | 'garmin' | 'fitbit'
    public var name: String
    public var model: String?
    public var deviceId: String
    public var connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error'
    public var lastSync: Date | null
    public var capabilities: [String]
    public var settings: Any
    public var authTokens: {?
    public var accessToken: String?
    public var refreshToken: String?
    public var expiresAt: Date?
}

// MARK: - HeartRateData
public struct HeartRateData: Codable, Sendable {
    public var id: Double?
    public var runId: Double
    public var deviceId: String
    public var timestamp: Date
    public var heartRate: Double
    public var accuracy: 'high' | 'medium' | 'low'
    public var createdAt: Date
}

// MARK: - HeartRateZone
public struct HeartRateZone: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var zoneNumber: Double
    public var name: String
    public var description: String
    public var minBpm: Double
    public var maxBpm: Double
    public var color: String
    public var targetPercentage: Double?
    public var trainingBenefit: String
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - HeartRateZoneSettings
public struct HeartRateZoneSettings: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var calculationMethod: 'max_hr' | 'lactate_threshold' | 'hrr' | 'manual'
    public var maxHeartRate: Double?
    public var restingHeartRate: Double?
    public var lactateThresholdHR: Double?
    public var zoneSystem: 'five_zone' | 'three_zone' | 'custom'
    public var customZones: String?
    public var autoUpdate: Bool
    public var lastCalculated: Date
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - ZoneDistribution
public struct ZoneDistribution: Codable, Sendable {
    public var id: Double?
    public var runId: Double
    public var zone1Time: Double
    public var zone2Time: Double
    public var zone3Time: Double
    public var zone4Time: Double
    public var zone5Time: Double
    public var zone1Percentage: Double
    public var zone2Percentage: Double
    public var zone3Percentage: Double
    public var zone4Percentage: Double
    public var zone5Percentage: Double
    public var totalTime: Double
    public var createdAt: Date
}

// MARK: - AdvancedMetrics
public struct AdvancedMetrics: Codable, Sendable {
    public var id: Double?
    public var runId: Double
    public var deviceId: String
    public var vo2Max: Double?
    public var lactateThresholdHR: Double?
    public var lactateThresholdPace: Double?
    public var trainingStressScore: Double?
    public var trainingLoadFocus: 'base' | 'tempo' | 'threshold' | 'vo2max' | 'anaerobic'?
    public var performanceCondition: Double?
    public var racePredictor: {?
    public var distance: Double
    public var predictedTime: Double
}

// MARK: - RunningDynamicsData
public struct RunningDynamicsData: Codable, Sendable {
    public var id: Double?
    public var runId: Double
    public var deviceId: String
    public var averageCadence: Double
    public var maxCadence: Double
    public var averageGroundContactTime: Double
    public var averageVerticalOscillation: Double
    public var averageStrideLength: Double
    public var groundContactBalance: Double?
    public var verticalRatio: Double?
    public var cadenceDataPoints: { timestamp: Date; cadence: number?
}

// MARK: - SyncJob
public struct SyncJob: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var deviceId: Double
    public var type: 'activities' | 'heart_rate' | 'metrics' | 'full_sync'
    public var status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    public var priority: 'low' | 'normal' | 'high'
    public var scheduledAt: Date
    public var startedAt: Date?
    public var completedAt: Date?
    public var errorMessage: String?
    public var retryCount: Double
    public var maxRetries: Double
    public var progress: Double?
    public var metadata: Any?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - Goal
public struct Goal: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var title: String
    public var description: String
    public var goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health'
    public var category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength'
    public var priority: 1 | 2 | 3
    public var status: 'active' | 'completed' | 'paused' | 'cancelled'
    public var specificTarget: {
    public var metric: String
    public var value: Double
    public var unit: String
    public var description: String?
}

// MARK: - GoalMilestone
public struct GoalMilestone: Codable, Sendable {
    public var id: Double?
    public var goalId: Double
    public var milestoneOrder: Double
    public var title: String
    public var description: String
    public var targetValue: Double
    public var targetDate: Date
    public var status: 'pending' | 'achieved' | 'missed' | 'adjusted'
    public var achievedDate: Date?
    public var achievedValue: Double?
    public var celebrationShown: Bool
    public var createdAt: Date
}

// MARK: - GoalProgressHistory
public struct GoalProgressHistory: Codable, Sendable {
    public var id: Double?
    public var goalId: Double
    public var measurementDate: Date
    public var measuredValue: Double
    public var recordedAt: Date?
    public var progressValue: Double?
    public var progressPercentage: Double
    public var autoRecorded: Bool
    public var contributingActivityId: number | null?
    public var contributingActivityType: String?
    public var context: Record<string, unknown>?
    public var notes: String?
    public var createdAt: Date
}

// MARK: - GoalRecommendation
public struct GoalRecommendation: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var recommendationType: 'new_goal' | 'adjustment' | 'milestone' | 'motivation' | 'priority_change'
    public var title: String
    public var description: String
    public var reasoning: String
    public var confidenceScore: Double
    public var priority: 'low' | 'medium' | 'high'?
    public var status: 'pending' | 'accepted' | 'dismissed' | 'expired'
    public var recommendationData: {
    public var goalId: Double?
    public var suggestedChanges: Record<string, unknown>?
    public var newGoalTemplate: Record<string, unknown>?
    public var actionRequired: String?
    public var benefits: [String]?
    public var risks: [String]?
}

// MARK: - PerformanceMetrics
public struct PerformanceMetrics: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var date: Date
    public var averagePace: Double
    public var totalDistance: Double
    public var totalDuration: Double
    public var consistencyScore: Double
    public var performanceScore: Double
    public var trainingLoad: Double
    public var recoveryScore: Double
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - PersonalRecord
public struct PersonalRecord: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var recordType: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_run' | 'best_pace' | 'most_consistent_week'
    public var value: Double
    public var achievedAt: Date
    public var runId: Double?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - PerformanceInsight
public struct PerformanceInsight: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var type: 'improvement' | 'trend' | 'warning' | 'achievement' | 'recommendation'
    public var title: String
    public var description: String
    public var priority: 'low' | 'medium' | 'high'
    public var actionable: Bool
    public var data: Any?
    public var validUntil: Date?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - HabitAnalyticsSnapshot
public struct HabitAnalyticsSnapshot: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var snapshotDate: Date
    public var currentStreak: Double
    public var longestStreak: Double
    public var weeklyConsistency: Double
    public var monthlyConsistency: Double
    public var consistencyTrend: 'improving' | 'stable' | 'declining'
    public var riskLevel: 'low' | 'medium' | 'high'
    public var goalAlignment: Double
    public var planAdherence: Double
    public var weekOverWeek: Double
    public var monthOverMonth: Double
    public var optimalTimes: [String]
    public var avgDuration: Double
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - HabitInsight
public struct HabitInsight: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var insightType: 'motivation' | 'barrier' | 'suggestion' | 'pattern' | 'risk'
    public var title: String
    public var description: String
    public var priority: 'low' | 'medium' | 'high'
    public var actionable: Bool
    public var evidence: [String]
    public var validUntil: Date?
    public var isRead: Bool
    public var createdAt: Date
}

// MARK: - HabitPattern
public struct HabitPattern: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var patternType: 'day_preference' | 'time_preference' | 'duration_pattern' | 'frequency_pattern'
    public var pattern: String
    public var confidence: Double
    public var frequency: Double
    public var impact: Double
    public var lastObserved: Date
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - Shoe
public struct Shoe: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var name: String
    public var brand: String
    public var model: String
    public var initialKm: Double
    public var currentKm: Double
    public var maxKm: Double
    public var startDate: Date
    public var isActive: Bool
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - Badge
public struct Badge: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var type: 'bronze' | 'silver' | 'gold'
    public var milestone: Double
    public var unlockedAt: Date
    public var streakValueAchieved: Double
}

// MARK: - RaceGoal
public struct RaceGoal: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var raceName: String
    public var raceDate: Date
    public var distance: Double
    public var targetTime: Double?
    public var priority: 'A' | 'B' | 'C'
    public var location: String?
    public var raceType: 'road' | 'trail' | 'track' | 'virtual'
    public var elevationGain: Double?
    public var courseDifficulty: 'easy' | 'moderate' | 'hard'?
    public var registrationStatus: 'registered' | 'planned' | 'completed'?
    public var notes: String?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - WorkoutTemplate
public struct WorkoutTemplate: Codable, Sendable {
    public var id: Double?
    public var name: String
    public var workoutType: 'easy' | 'tempo' | 'intervals' | 'long' | 'race-pace' | 'recovery' | 'time-trial' | 'hill' | 'fartlek'
    public var trainingPhase: 'base' | 'build' | 'peak' | 'taper'
    public var intensityZone: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic'
    public var structure: Any
    public var description: String
    public var coachingNotes: String?
    public var createdAt: Date
}

// MARK: - PeriodizationPhase
public struct PeriodizationPhase: Codable, Sendable {
    public var phase: 'base' | 'build' | 'peak' | 'taper'
    public var duration: Double
    public var weeklyVolumePercentage: Double
    public var intensityDistribution: {
    public var easy: Double
    public var moderate: Double
    public var hard: Double
}

// MARK: - AdaptationFactor
public struct AdaptationFactor: Codable, Sendable {
    public var factor: 'performance' | 'feedback' | 'consistency' | 'goals'
    public var weight: Double
    public var currentValue: Double
    public var targetValue: Double
}

// MARK: - PlanFeedback
public struct PlanFeedback: Codable, Sendable {
    public var id: Double?
    public var planId: Double
    public var userId: Double
    public var feedbackType: 'difficulty' | 'enjoyment' | 'completion' | 'suggestion'?
    public var rating: Double
    public var comment: String?
    public var createdAt: Date
}

// MARK: - Plan
public struct Plan: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var title: String
    public var description: String?
    public var startDate: Date
    public var endDate: Date
    public var totalWeeks: Double
    public var isActive: Bool
    public var planType: 'basic' | 'advanced' | 'periodized'
    public var raceGoalId: Double?
    public var periodization: [PeriodizationPhase]?
    public var targetDistance: Double?
    public var targetTime: Double?
    public var fitnessLevel: 'beginner' | 'intermediate' | 'advanced'?
    public var trainingDaysPerWeek: Double?
    public var peakWeeklyVolume: Double?
    public var complexityLevel: 'basic' | 'standard' | 'advanced'?
    public var complexityScore: Double?
    public var lastComplexityUpdate: Date?
    public var adaptationFactors: [AdaptationFactor]?
    public var userFeedback: [PlanFeedback]?
    public var goalId: Double?
    public var isChallenge: Bool?
    public var challengeTemplateId: Double?
    public var challengeConfig: {?
    public var dailyPromptsBefore: [String]
    public var dailyPromptsDuring: [String]
    public var dailyPromptsAfter: [String]
    public var microLessons: [String]
    public var progressionArc: String
    public var coachTone: 'gentle' | 'tough_love' | 'analytical' | 'calm'
}

// MARK: - Workout
public struct Workout: Codable, Sendable {
    public var id: Double?
    public var planId: Double
    public var week: Double
    public var day: String
    public var type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest' | 'race-pace' | 'recovery' | 'fartlek'
    public var distance: Double
    public var actualDistanceKm: Double?
    public var duration: Double?
    public var pace: Double?
    public var actualDurationMinutes: Double?
    public var actualPace: Double?
    public var intensity: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic'?
    public var trainingPhase: 'base' | 'build' | 'peak' | 'taper'?
    public var workoutStructure: Any?
    public var notes: String?
    public var completedAt: Date?
    public var completed: Bool
    public var scheduledDate: Date
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - SleepData
public struct SleepData: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var deviceId: String?
    public var sleepDate: Date
    public var date: Date?
    public var bedTime: Date?
    public var sleepTime: Date?
    public var wakeTime: Date?
    public var totalSleepTime: Double
    public var deepSleepTime: Double?
    public var lightSleepTime: Double?
    public var remSleepTime: Double?
    public var sleepEfficiency: Double
    public var sleepLatency: Double?
    public var wakeCount: Double?
    public var awakeDuration: Double?
    public var sleepScore: Double?
    public var sleepQualityScore: Double?
    public var sleepStages: {?
    public var deep: Double
    public var light: Double
    public var rem: Double
    public var awake: Double
}

// MARK: - HRVMeasurement
public struct HRVMeasurement: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var deviceId: String?
    public var measurementDate: Date
    public var hrvValue: Double
    public var hrvType: 'rmssd' | 'sdnn' | 'pnn50' | 'hf' | 'lf' | 'lf_hf_ratio'
    public var measurementDuration: Double
    public var confidence: Double
    public var restingHeartRate: Double?
    public var stressLevel: Double?
    public var recoveryStatus: 'poor' | 'fair' | 'good' | 'excellent'?
    public var notes: String?
    public var createdAt: Date
}

// MARK: - RecoveryScore
public struct RecoveryScore: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var scoreDate: Date?
    public var date: Date?
    public var overallScore: Double
    public var sleepScore: Double
    public var hrvScore: Double
    public var restingHRScore: Double
    public var subjectiveWellnessScore: Double
    public var stressLevel: Double
    public var readinessScore: Double
    public var confidence: Double
    public var recommendations: [String]
    public var notes: String?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - SubjectiveWellness
public struct SubjectiveWellness: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var assessmentDate: Date?
    public var date: Date?
    public var energyLevel: Double?
    public var moodScore: Double?
    public var sorenessLevel: Double?
    public var stressLevel: Double?
    public var motivationLevel: Double?
    public var mood: Double?
    public var motivation: Double?
    public var fatigue: Double?
    public var soreness: Double?
    public var sleepQuality: Double?
    public var overallWellness: Double?
    public var notes: String?
    public var factors: {?
    public var stress: [String]
    public var sleep: [String]
    public var nutrition: [String]
    public var hydration: [String]
    public var other: [String]
}

// MARK: - DataFusionRule
public struct DataFusionRule: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var dataType: String
    public var primarySource: String
    public var fallbackSources: [String]?
    public var conflictResolution: 'prefer_primary' | 'most_recent' | 'highest_accuracy' | 'average' | 'manual'
    public var gapFillingEnabled: Bool
    public var qualityThreshold: Double
    public var createdAt: Date
    public var updatedAt: Date
    public var name: String?
    public var priority: Double?
    public var isActive: Bool?
    public var fusionMethod: 'average' | 'weighted_average' | 'median' | 'mode' | 'latest' | 'earliest' | 'custom'?
    public var weightFactors: Record<string, number>?
    public var customLogic: String?
}

// MARK: - FusedDataPoint
public struct FusedDataPoint: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var dataType: String
    public var timestamp: Date
    public var value: Double
    public var unit: String?
    public var confidence: Double
    public var qualityScore: Double
    public var primarySource: String
    public var contributingSources: [String]
    public var conflicts: [DataConflict]?
    public var metadata: Record<string, unknown>?
    public var createdAt: Date
}

// MARK: - DataConflict
public struct DataConflict: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var dataType: String
    public var fusedDataPointId: Double?
    public var sourceDevice1: String
    public var sourceDevice2: String
    public var value1: Double
    public var value2: Double
    public var difference: Double
    public var resolvedValue: Double?
    public var resolutionMethod: String?
    public var manuallyResolved: Bool
    public var detectedAt: Date?
    public var conflictType: 'duplicate' | 'inconsistent' | 'outlier' | 'missing' | 'quality'?
    public var severity: 'low' | 'medium' | 'high' | 'critical'?
    public var description: String?
    public var resolvedAt: Date?
    public var createdAt: Date
}

// MARK: - DataSource
public struct DataSource: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var deviceId: String
    public var deviceType: String
    public var dataTypes: [String]
    public var priority: Double
    public var accuracy: Double
    public var reliability: Double
    public var isActive: Bool
    public var lastSync: Date
    public var capabilities: [String]?
    public var name: String?
    public var type: 'apple_watch' | 'garmin' | 'fitbit' | 'manual' | 'other'?
    public var syncFrequency: Double?
    public var qualityScore: Double?
    public var reliabilityScore: Double?
    public var settings: Record<string, unknown>?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - Route
public struct Route: Codable, Sendable {
    public var id: Double?
    public var name: String
    public var distance: Double
    public var difficulty: 'beginner' | 'intermediate' | 'advanced'
    public var safetyScore: Double
    public var popularity: Double
    public var elevationGain: Double
    public var surfaceType: [String]
    public var wellLit: Bool
    public var lowTraffic: Bool
    public var scenicScore: Double
    public var estimatedTime: Double
    public var description: String
    public var tags: [String]
    public var gpsPath: String?
    public var location: String?
    public var startLat: Double?
    public var startLng: Double?
    public var endLat: Double?
    public var endLng: Double?
    public var routeType: 'predefined' | 'custom'?
    public var createdBy: 'system' | 'user'?
    public var isActive: Bool
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - RouteRecommendation
public struct RouteRecommendation: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var routeId: Double
    public var matchScore: Double
    public var reasoning: String
    public var userPreferences: String
    public var userExperience: String
    public var selected: Bool
    public var createdAt: Date
}

// MARK: - UserRoutePreferences
public struct UserRoutePreferences: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var maxDistance: Double
    public var preferredDifficulty: 'beginner' | 'intermediate' | 'advanced'
    public var safetyImportance: Double
    public var scenicImportance: Double
    public var trafficPreference: 'low' | 'medium' | 'high'
    public var lightingPreference: 'day' | 'night' | 'any'
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - GPSPoint
public struct GPSPoint: Codable, Sendable {
    public var lat: Double
    public var lng: Double
    public var timestamp: Double
    public var accuracy: Double?
}

// MARK: - Run
public struct Run: Codable, Sendable {
    public var id: Double?
    public var workoutId: Double?
    public var userId: Double
    public var type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'other'
    public var distance: Double
    public var duration: Double
    public var pace: Double?
    public var rpe: Double?
    public var heartRate: Double?
    public var calories: Double?
    public var notes: String?
    public var route: String?
    public var gpsPath: String?
    public var gpsAccuracyData: String?
    public var startAccuracy: Double?
    public var endAccuracy: Double?
    public var averageAccuracy: Double?
    public var runReport: String?
    public var runReportSource: 'ai' | 'fallback'?
    public var runReportCreatedAt: Date?
    public var shoeId: Double?
    public var importSource: String?
    public var importConfidencePct: Double?
    public var importRequestId: String?
    public var importMethod: String?
    public var importModel: String?
    public var importParserVersion: String?
    public var gpsMetadata: String?
    public var completedAt: Date
    public var createdAt: Date
    public var updatedAt: Date?
}

// MARK: - LocationQuality
public struct LocationQuality: Codable, Sendable {
    public var id: Double?
    public var location: String
    public var lat: Double
    public var lng: Double
    public var avgAccuracy: Double
    public var avgRejectionRate: Double
    public var runsRecorded: Double
    public var lastRun: Date
}

// MARK: - ActiveRecordingSession
public struct ActiveRecordingSession: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var status: 'recording' | 'paused' | 'interrupted'
    public var startedAt: Date
    public var lastCheckpointAt: Date
    public var distanceKm: Double
    public var durationSeconds: Double
    public var elapsedRunMs: Double
    public var gpsPath: String
    public var lastRecordedPoint: String?
    public var workoutId: Double?
    public var routeId: Double?
    public var routeName: String?
    public var autoPauseCount: Double
    public var acceptedPointCount: Double
    public var rejectedPointCount: Double
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - BetaSignup
public struct BetaSignup: Codable, Sendable {
    public var id: Double?
    public var email: String
    public var experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    public var goals: String
    public var hearAboutUs: String
    public var createdAt: Date
    public var invitedAt: Date?
    public var convertedAt: Date?
}

// MARK: - User
public struct User: Codable, Sendable {
    public var id: Double?
    public var name: String?
    public var goal: 'habit' | 'distance' | 'speed'
    public var experience: 'beginner' | 'intermediate' | 'advanced'
    public var preferredTimes: [String]
    public var daysPerWeek: Double
    public var consents: {
    public var data: Bool
    public var gdpr: Bool
    public var push: Bool
}

// MARK: - PlanSetupPreferences
public struct PlanSetupPreferences: Codable, Sendable {
    public var availableDays: [String]?
    public var trainingDays: [String]?
    public var longRunDay: String?
    public var startDate: Date?
    public var basePlanLengthWeeks: Double?
    public var raceDate: Date?
    public var trainingVolume: 'conservative' | 'progressive' | 'high'?
    public var difficulty: 'easy' | 'balanced' | 'challenging'?
    public var currentRaceTimeSeconds: Double?
}

// MARK: - OnboardingSession
public struct OnboardingSession: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var conversationId: String
    public var goalDiscoveryPhase: 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete'
    public var discoveredGoals: [SmartGoal]
    public var coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging'
    public var sessionProgress: Double
    public var isCompleted: Bool
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - ConversationMessage
public struct ConversationMessage: Codable, Sendable {
    public var id: Double?
    public var sessionId: Double?
    public var conversationId: String
    public var role: 'user' | 'assistant'
    public var content: String
    public var timestamp: Date
    public var metadata: Record<string, unknown>?
    public var phase: String?
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - SmartGoal
public struct SmartGoal: Codable, Sendable {
    public var id: String
    public var title: String
    public var description: String
    public var type: 'primary' | 'supporting' | 'health'
    public var specific: String
    public var measurable: String
    public var achievable: String
    public var relevant: String
    public var timeBound: String
    public var targetDate: Date
}

// MARK: - Cohort
public struct Cohort: Codable, Sendable {
    public var id: Double?
    public var name: String
    public var inviteCode: String
    public var createdAt: Date
    public var updatedAt: Date
}

// MARK: - CohortMember
public struct CohortMember: Codable, Sendable {
    public var id: Double?
    public var userId: Double
    public var cohortId: Double
    public var joinDate: Date
}

// MARK: - Helper Extensions

extension Date {
    /// ISO8601 date formatter for API communication
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

// MARK: - Custom Coding Keys

// Add custom CodingKeys here if needed for snake_case to camelCase conversion
