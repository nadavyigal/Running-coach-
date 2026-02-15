/**
 * Analytics Event Catalog for RunSmart
 *
 * This file provides type-safe event tracking with comprehensive documentation.
 * All event names and properties are defined as TypeScript enums and interfaces
 * for consistency and IDE autocomplete support.
 *
 * @see V0/lib/analytics.ts for implementation
 */

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * User lifecycle and conversion funnel events
 * Critical for measuring activation and retention
 */
export enum ActivationEvents {
  // Signup & Registration
  SIGNUP_STARTED = 'signup_started',
  SIGNUP_COMPLETED = 'signup_completed',

  // Onboarding
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_COMPLETED = 'onboarding_completed',

  // First actions (aha moments)
  PLAN_GENERATED = 'plan_generated',
  FIRST_RUN_RECORDED = 'first_run_recorded',
  FIRST_CHAT_MESSAGE = 'chat_message_sent_first',

  // App installation
  PWA_INSTALL_PROMPT_SHOWN = 'pwa_install_prompt_shown',
  PWA_INSTALLED = 'pwa_installed',
  PWA_INSTALL_DISMISSED = 'pwa_install_dismissed',
}

/**
 * Challenge engagement funnel
 */
export enum ChallengeEvents {
  CHALLENGE_DISCOVERED = 'challenge_discovered',
  CHALLENGE_REGISTERED = 'challenge_registered',
  CHALLENGE_DAY_STARTED = 'challenge_day_started',
  CHALLENGE_DAY_COMPLETED = 'challenge_day_completed',
  CHALLENGE_COMPLETED = 'challenge_completed',
  CHALLENGE_ABANDONED = 'challenge_abandoned',
}

/**
 * Running activity tracking
 */
export enum RunEvents {
  RUN_STARTED = 'run_started',
  RUN_PAUSED = 'run_paused',
  RUN_RESUMED = 'run_resumed',
  RUN_COMPLETED = 'run_completed',
  RUN_ABANDONED = 'run_abandoned',
  RUN_SAVED = 'run_saved',
  RUN_DELETED = 'run_deleted',
}

/**
 * Plan and goal management
 */
export enum PlanEvents {
  PLAN_VIEWED = 'plan_viewed',
  PLAN_GENERATED = 'plan_generated',
  PLAN_ADJUSTED = 'plan_adjusted',
  PLAN_ABANDONED = 'plan_abandoned',
  WORKOUT_SCHEDULED = 'workout_scheduled',
  WORKOUT_RESCHEDULED = 'workout_rescheduled',
  WORKOUT_COMPLETED = 'workout_completed',
  WORKOUT_SKIPPED = 'workout_skipped',
}

/**
 * Goal tracking
 */
export enum GoalEvents {
  GOAL_CREATED = 'goal_created',
  GOAL_UPDATED = 'goal_updated',
  GOAL_COMPLETED = 'goal_completed',
  GOAL_ABANDONED = 'goal_abandoned',
  GOAL_MILESTONE_REACHED = 'goal_milestone_reached',
}

/**
 * AI Coach interactions
 */
export enum ChatEvents {
  CHAT_MESSAGE_SENT = 'chat_message_sent',
  CHAT_RESPONSE_RECEIVED = 'chat_response_received',
  CHAT_SESSION_STARTED = 'chat_session_started',
  CHAT_SESSION_ENDED = 'chat_session_ended',
  CHAT_FEEDBACK_POSITIVE = 'chat_feedback_positive',
  CHAT_FEEDBACK_NEGATIVE = 'chat_feedback_negative',
}

/**
 * Engagement and retention events
 */
export enum EngagementEvents {
  SCREEN_VIEWED = 'screen_viewed',
  FEATURE_USED = 'feature_used',
  APP_OPENED = 'app_opened',
  APP_CLOSED = 'app_closed',
  NOTIFICATION_CLICKED = 'notification_clicked',
  NOTIFICATION_DISMISSED = 'notification_dismissed',
  STREAK_MILESTONE = 'streak_milestone',
  BADGE_EARNED = 'badge_earned',
}

/**
 * Route and map interactions
 */
export enum RouteEvents {
  ROUTE_VIEWED = 'route_viewed',
  ROUTE_SELECTED = 'route_selected',
  ROUTE_CREATED = 'route_created',
  ROUTE_EDITED = 'route_edited',
  ROUTE_SHARED = 'route_shared',
  MAP_LOADED = 'map_loaded',
  MAP_LOAD_FAILED = 'map_load_failed',
  FIND_MY_ROUTE_CLICKED = 'find_my_route_clicked',
  FIND_MY_ROUTE_SUCCESS = 'find_my_route_success',
  FIND_MY_ROUTE_FAILED = 'find_my_route_failed',
}

/**
 * Social and sharing events
 */
export enum SocialEvents {
  BADGE_SHARED = 'badge_shared',
  RUN_SHARED = 'run_shared',
  PROFILE_VIEWED = 'profile_viewed',
  COHORT_JOINED = 'cohort_joined',
  COHORT_LEFT = 'cohort_left',
  FRIEND_INVITED = 'friend_invited',
}

/**
 * Error and technical events
 */
export enum ErrorEvents {
  ERROR_OCCURRED = 'error_occurred',
  API_ERROR = 'api_error',
  SYNC_FAILED = 'sync_failed',
  PERMISSION_DENIED = 'permission_denied',
}

/**
 * Authentication events
 */
export enum AuthEvents {
  SIGNUP = 'auth_signup',
  LOGIN = 'auth_login',
  LOGOUT = 'auth_logout',
  PASSWORD_RESET = 'auth_password_reset',
  MIGRATION = 'auth_migration',
}

/**
 * Sync events
 */
export enum SyncEvents {
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
}

// ============================================================================
// EVENT PROPERTY INTERFACES
// ============================================================================

/**
 * Common properties included with all events
 */
export interface BaseEventProperties {
  user_id?: number
  user_experience?: 'beginner' | 'intermediate' | 'advanced'
  user_goal?: 'habit' | 'distance' | 'speed' | 'race'
  days_per_week?: number
  onboarding_complete?: boolean
  current_streak?: number
  cohort_id?: number
  timestamp: string
}

/**
 * Properties for signup events
 */
export interface SignupEventProperties {
  source?: 'friend' | 'instagram' | 'twitter' | 'reddit' | 'product_hunt' | 'search' | 'blog' | 'whatsapp' | 'organic'
  email?: string
  signupMethod?: 'email' | 'google' | 'apple'
}

/**
 * Properties for onboarding events
 */
export interface OnboardingEventProperties {
  step_number?: number
  step_name?: string
  duration_seconds?: number
  goal?: 'habit' | 'distance' | 'speed' | 'race'
  experience?: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek?: number
  funnel_stage?: string
}

/**
 * Properties for run events
 */
export interface RunEventProperties {
  distance_km?: number
  duration_seconds?: number
  pace_min_km?: number
  source?: 'gps' | 'manual' | 'imported'
  workout_type?: string
}

/**
 * Properties for plan events
 */
export interface PlanEventProperties {
  plan_type?: string
  duration_weeks?: number
  weekly_volume_km?: number
  adjustment_reason?: string
}

/**
 * Properties for PWA installation events
 */
export interface PWAEventProperties {
  install_method?: 'browser_prompt' | 'custom_prompt' | 'share_menu'
  platform?: 'android' | 'ios' | 'desktop'
  browser?: string
  timing?: 'onboarding' | 'post_first_run' | 'manual'
}

/**
 * Properties for chat events
 */
export interface ChatEventProperties {
  message_length?: number
  response_time_ms?: number
  session_id?: string
  turn_number?: number
}

/**
 * Properties for error events
 */
export interface ErrorEventProperties {
  error_type: string
  error_message: string
  error_stack?: string
  component?: string
  user_action?: string
}

// ============================================================================
// EVENT VALIDATION
// ============================================================================

/**
 * All valid event names in the system
 * Use this for runtime validation
 */
export const ALL_EVENT_NAMES = [
  ...Object.values(ActivationEvents),
  ...Object.values(ChallengeEvents),
  ...Object.values(RunEvents),
  ...Object.values(PlanEvents),
  ...Object.values(GoalEvents),
  ...Object.values(ChatEvents),
  ...Object.values(EngagementEvents),
  ...Object.values(RouteEvents),
  ...Object.values(SocialEvents),
  ...Object.values(ErrorEvents),
  ...Object.values(AuthEvents),
  ...Object.values(SyncEvents),
] as const

export type ValidEventName = typeof ALL_EVENT_NAMES[number]

/**
 * Validate event name
 */
export function isValidEventName(eventName: string): eventName is ValidEventName {
  return ALL_EVENT_NAMES.includes(eventName as ValidEventName)
}

// ============================================================================
// FUNNEL DEFINITIONS
// ============================================================================

/**
 * Activation Funnel - Critical conversion path
 * Target: signup → onboarding → plan → first run (within 7 days)
 */
export const ACTIVATION_FUNNEL = [
  ActivationEvents.SIGNUP_COMPLETED,
  ActivationEvents.ONBOARDING_COMPLETED,
  ActivationEvents.PLAN_GENERATED,
  ActivationEvents.FIRST_RUN_RECORDED,
] as const

/**
 * Challenge Funnel - Engagement and retention
 * Target: discover → register → complete (21 days)
 */
export const CHALLENGE_FUNNEL = [
  ChallengeEvents.CHALLENGE_DISCOVERED,
  ChallengeEvents.CHALLENGE_REGISTERED,
  ChallengeEvents.CHALLENGE_DAY_COMPLETED,
  ChallengeEvents.CHALLENGE_COMPLETED,
] as const

/**
 * Retention Funnel - Weekly engagement
 * Target: 3+ runs per week
 */
export const RETENTION_FUNNEL = [
  EngagementEvents.APP_OPENED,
  PlanEvents.PLAN_VIEWED,
  RunEvents.RUN_STARTED,
  RunEvents.RUN_COMPLETED,
] as const

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * Event Documentation
 * Maps event names to human-readable descriptions
 */
export const EVENT_DOCUMENTATION: Record<string, string> = {
  [ActivationEvents.SIGNUP_STARTED]: 'User initiated the signup process',
  [ActivationEvents.SIGNUP_COMPLETED]: 'User successfully created an account',
  [ActivationEvents.ONBOARDING_STARTED]: 'User entered the onboarding flow',
  [ActivationEvents.ONBOARDING_STEP_COMPLETED]: 'User completed an onboarding step',
  [ActivationEvents.ONBOARDING_COMPLETED]: 'User finished the entire onboarding flow',
  [ActivationEvents.PLAN_GENERATED]: 'AI generated a personalized training plan',
  [ActivationEvents.FIRST_RUN_RECORDED]: 'User recorded and saved their first run (critical aha moment)',
  [ActivationEvents.PWA_INSTALL_PROMPT_SHOWN]: 'PWA installation prompt was displayed',
  [ActivationEvents.PWA_INSTALLED]: 'User installed the app to their home screen',
  [ActivationEvents.PWA_INSTALL_DISMISSED]: 'User dismissed the PWA installation prompt',

  [RunEvents.RUN_STARTED]: 'User began a new run with GPS tracking',
  [RunEvents.RUN_COMPLETED]: 'User finished a run session',
  [RunEvents.RUN_SAVED]: 'Run data was saved to the database',

  [ChatEvents.CHAT_MESSAGE_SENT]: 'User sent a message to the AI coach',
  [ChatEvents.CHAT_FEEDBACK_POSITIVE]: 'User gave positive feedback on AI response',
  [ChatEvents.CHAT_FEEDBACK_NEGATIVE]: 'User gave negative feedback on AI response',

  [EngagementEvents.SCREEN_VIEWED]: 'User navigated to a screen',
  [EngagementEvents.BADGE_EARNED]: 'User unlocked a new achievement badge',
  [EngagementEvents.STREAK_MILESTONE]: 'User reached a streak milestone (3, 7, 30 days)',

  // Add more as needed...
}
