/**
 * Application-wide constants and configuration
 * Centralized configuration for magic numbers, limits, and default values
 */

// ============================================================================
// VALIDATION CONSTRAINTS
// ============================================================================

export const VALIDATION = {
  /** Maximum length for string inputs */
  MAX_STRING_LENGTH: 1000,
  /** Maximum length for arrays */
  MAX_ARRAY_LENGTH: 100,
  /** Maximum safe integer for IDs */
  MAX_ID_VALUE: Number.MAX_SAFE_INTEGER,
  /** Minimum user age */
  MIN_AGE: 10,
  /** Maximum user age */
  MAX_AGE: 100,
  /** Minimum RPE (Rate of Perceived Exertion) */
  MIN_RPE: 1,
  /** Maximum RPE (Rate of Perceived Exertion) */
  MAX_RPE: 10,
  /** Minimum training days per week */
  MIN_DAYS_PER_WEEK: 2,
  /** Maximum training days per week */
  MAX_DAYS_PER_WEEK: 6,
} as const;

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const DATABASE = {
  /** Database name */
  NAME: 'RunSmartDB',
  /** Transaction timeout in milliseconds */
  TRANSACTION_TIMEOUT: 30000,
  /** Default retry attempts for database operations */
  MAX_RETRIES: 3,
  /** Retry delay in milliseconds */
  RETRY_DELAY_BASE: 1000,
  /** Maximum items to fetch in a single query */
  MAX_QUERY_LIMIT: 1000,
} as const;

// ============================================================================
// ONBOARDING CONFIGURATION
// ============================================================================

export const ONBOARDING = {
  /** Total number of onboarding steps */
  TOTAL_STEPS: 9,
  /** Default days per week for new users */
  DEFAULT_DAYS_PER_WEEK: 3,
  /** Default training goal */
  DEFAULT_GOAL: 'habit' as const,
  /** Default experience level */
  DEFAULT_EXPERIENCE: 'beginner' as const,
  /** Default preferred time */
  DEFAULT_TIME: 'morning' as const,
  /** Default age if not provided */
  DEFAULT_AGE: 25,
  /** Artificial delay for onboarding atomic operations (ms) */
  ATOMIC_DELAY: 250,
} as const;

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export const PLAN = {
  /** Default plan duration in days */
  DEFAULT_DURATION_DAYS: 30,
  /** Default plan duration in weeks */
  DEFAULT_DURATION_WEEKS: 4,
  /** Default peak weekly volume in km */
  DEFAULT_PEAK_VOLUME: 20,
  /** Default complexity score */
  DEFAULT_COMPLEXITY: 25,
  /** Default title for generated plans */
  DEFAULT_TITLE: 'Default Running Plan',
  /** Default description */
  DEFAULT_DESCRIPTION: 'A basic running plan to get you started',
} as const;

// ============================================================================
// WORKOUT CONFIGURATION
// ============================================================================

export const WORKOUT = {
  /** Default workout distance in km */
  DEFAULT_DISTANCE: 3,
  /** Default workout duration in minutes */
  DEFAULT_DURATION: 30,
  /** Default workout type */
  DEFAULT_TYPE: 'easy' as const,
  /** Default intensity level */
  DEFAULT_INTENSITY: 'easy' as const,
  /** Default pace buffer for time estimates (minutes) */
  PACE_BUFFER_MIN: 5,
  /** Multiplier for distance to time conversion (min/km) */
  DISTANCE_TO_TIME_MIN: 5,
  DISTANCE_TO_TIME_MAX: 7,
  /** Days of the week for workout scheduling */
  WORKOUT_DAYS: ['Mon', 'Wed', 'Fri'] as const,
} as const;

// ============================================================================
// CHAT CONFIGURATION
// ============================================================================

export const CHAT = {
  /** Streaming response timeout in milliseconds */
  STREAM_TIMEOUT: 30000,
  /** Maximum messages to load from history */
  MAX_HISTORY_MESSAGES: 100,
  /** Confidence threshold for feedback requests */
  FEEDBACK_CONFIDENCE_THRESHOLD: 0.8,
  /** Default conversation ID */
  DEFAULT_CONVERSATION_ID: 'default',
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const UI = {
  /** Maximum width for mobile container */
  MAX_MOBILE_WIDTH: 'max-w-md',
  /** Animation delay multiplier (ms per item) */
  ANIMATION_DELAY_STEP: 50,
  /** Default toast duration (ms) */
  TOAST_DURATION: 3000,
  /** Loading spinner delay before showing (ms) */
  LOADING_DELAY: 200,
} as const;

// ============================================================================
// STREAK CONFIGURATION
// ============================================================================

export const STREAK = {
  /** Badge milestones (days) */
  MILESTONES: [3, 7, 30] as const,
  /** Badge type mapping */
  TYPES: {
    3: 'bronze',
    7: 'silver',
    30: 'gold',
  } as const,
  /** Maximum consecutive days to track */
  MAX_STREAK_DAYS: 365,
} as const;

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export const PERFORMANCE = {
  /** Minimum consistency score */
  MIN_CONSISTENCY: 0,
  /** Maximum consistency score */
  MAX_CONSISTENCY: 100,
  /** Minimum recovery score */
  MIN_RECOVERY: 0,
  /** Maximum recovery score */
  MAX_RECOVERY: 100,
  /** Recent runs to include in context */
  RECENT_RUNS_CONTEXT: 3,
} as const;

// ============================================================================
// RECOVERY CONFIGURATION
// ============================================================================

export const RECOVERY = {
  /** Minimum HRV value (ms) */
  MIN_HRV: 0,
  /** Maximum reasonable HRV value (ms) */
  MAX_HRV: 200,
  /** Minimum resting heart rate (bpm) */
  MIN_RESTING_HR: 40,
  /** Maximum resting heart rate (bpm) */
  MAX_RESTING_HR: 100,
  /** Minimum sleep duration (hours) */
  MIN_SLEEP_HOURS: 4,
  /** Recommended sleep duration (hours) */
  RECOMMENDED_SLEEP_HOURS: 8,
  /** Maximum sleep duration (hours) */
  MAX_SLEEP_HOURS: 12,
} as const;

// ============================================================================
// PRIVACY & SECURITY
// ============================================================================

export const PRIVACY = {
  /** Default privacy settings */
  DEFAULT_SETTINGS: {
    dataCollection: {
      location: true,
      performance: true,
      analytics: true,
      coaching: true,
    },
    consentHistory: [],
    exportData: false,
    deleteData: false,
  },
} as const;

// ============================================================================
// TIME CONFIGURATION
// ============================================================================

export const TIME = {
  /** Time slots for workout preferences */
  SLOTS: [
    { id: 'morning', label: 'Morning (6-9 AM)', hours: [6, 7, 8, 9] },
    { id: 'afternoon', label: 'Afternoon (12-3 PM)', hours: [12, 13, 14, 15] },
    { id: 'evening', label: 'Evening (6-9 PM)', hours: [18, 19, 20, 21] },
  ] as const,
  /** Milliseconds in a day */
  MS_PER_DAY: 86400000,
  /** Milliseconds in an hour */
  MS_PER_HOUR: 3600000,
  /** Milliseconds in a minute */
  MS_PER_MINUTE: 60000,
} as const;

// ============================================================================
// COACHING CONFIGURATION
// ============================================================================

export const COACHING = {
  /** Coaching styles */
  STYLES: ['supportive', 'challenging', 'analytical', 'encouraging'] as const,
  /** Default coaching style */
  DEFAULT_STYLE: 'supportive' as const,
  /** Coaching effectiveness score range */
  MIN_EFFECTIVENESS: 0,
  MAX_EFFECTIVENESS: 100,
  /** Feedback rating scale */
  MIN_RATING: 1,
  MAX_RATING: 5,
} as const;

// ============================================================================
// GOALS CONFIGURATION
// ============================================================================

export const GOALS = {
  /** Goal types */
  TYPES: ['habit', 'distance', 'speed'] as const,
  /** Goal categories */
  CATEGORIES: ['speed', 'endurance', 'consistency', 'health', 'strength'] as const,
  /** Goal priorities */
  PRIORITIES: [1, 2, 3] as const,
  /** Goal statuses */
  STATUSES: ['active', 'completed', 'paused', 'cancelled'] as const,
  /** Milestone percentages */
  MILESTONE_PERCENTAGES: [25, 50, 75, 100] as const,
} as const;

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

export const ROUTES = {
  /** Difficulty levels */
  DIFFICULTIES: ['beginner', 'intermediate', 'advanced'] as const,
  /** Safety score range */
  MIN_SAFETY_SCORE: 0,
  MAX_SAFETY_SCORE: 100,
  /** Popularity score range */
  MIN_POPULARITY: 0,
  MAX_POPULARITY: 100,
} as const;

// ============================================================================
// EXPORT ALL CONSTANTS
// ============================================================================

export const CONSTANTS = {
  VALIDATION,
  DATABASE,
  ONBOARDING,
  PLAN,
  WORKOUT,
  CHAT,
  UI,
  STREAK,
  PERFORMANCE,
  RECOVERY,
  PRIVACY,
  TIME,
  COACHING,
  GOALS,
  ROUTES,
} as const;

// Type exports for use in components
export type GoalType = typeof GOALS.TYPES[number];
export type ExperienceLevel = 'beginner' | 'occasional' | 'regular' | 'intermediate' | 'advanced';
export type WorkoutType = 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest' | 'race-pace' | 'recovery' | 'fartlek';
export type IntensityLevel = 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
export type CoachingStyle = typeof COACHING.STYLES[number];
export type TimeSlot = 'morning' | 'afternoon' | 'evening';
