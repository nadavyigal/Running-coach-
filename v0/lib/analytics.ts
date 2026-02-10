import { safeDbOperation } from './db'
import { getCurrentUser } from './dbUtils'
import { logger } from './logger'

type PosthogInstance = {
  init?: (apiKey: string, config?: Record<string, unknown>) => void
  capture?: (eventName: string, properties?: Record<string, any>) => void
}

declare global {
  interface Window {
    posthog?: PosthogInstance
    gtag?: (...args: any[]) => void
  }
}

// Get current user context for analytics
const getUserContext = async () => {
  // Prefer the high-level resolver which already handles Dexie fallbacks.
  const user = await safeDbOperation(getCurrentUser, 'analytics_getCurrentUser', null)

  return {
    user_id: user?.id,
    user_experience: user?.experience,
    user_goal: user?.goal,
    days_per_week: user?.daysPerWeek,
    onboarding_complete: user?.onboardingComplete,
    current_streak: user?.currentStreak || 0,
    cohort_id: user?.cohortId
  }
}

// Base analytics function with user context
const trackEvent = async (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') {
    return
  }

  const propertyContext = await getUserContext().catch((error) => {
    logger.warn('Failed to load user context for analytics:', error)
    return {
      user_id: undefined,
      user_experience: undefined,
      user_goal: undefined,
      days_per_week: undefined,
      onboarding_complete: undefined,
      current_streak: 0,
      cohort_id: undefined,
    }
  })

  const eventProperties = {
    ...propertyContext,
    timestamp: new Date().toISOString(),
    ...properties,
  }

  // Send to PostHog
  const posthog = typeof window !== 'undefined' ? window.posthog : undefined
  if (posthog && posthog.capture) {
    posthog.capture(eventName, eventProperties)
  } else {
    logger.debug('PostHog not ready, skipped event capture:', eventName)
  }

  // Also send to our analytics API for local storage and dashboard
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        userId: propertyContext.user_id,
        properties: eventProperties,
      }),
    }).catch((error) => {
      logger.debug('Failed to send event to analytics API:', error)
    })
  } catch (error) {
    logger.debug('Analytics API error:', error)
  }
}

// Reminder analytics
export const trackReminderEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// Plan adjustment analytics
export const trackPlanAdjustmentEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// Feedback analytics
export const trackFeedbackEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// Engagement analytics
export const trackEngagementEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// New analytics functions for missing events
export const trackPlanSessionCompleted = async (properties?: Record<string, any>) => {
  await trackEvent('plan_session_completed', properties)
}

export const trackChatMessageSent = async (properties?: Record<string, any>) => {
  await trackEvent('chat_message_sent', properties)
}

export const trackRouteSelected = async (properties?: Record<string, any>) => {
  await trackEvent('route_selected', properties)
}

export const trackReminderClicked = async (properties?: Record<string, any>) => {
  await trackEvent('reminder_clicked', properties)
}

// Onboarding analytics
export const trackOnboardingEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// General analytics function
export const trackAnalyticsEvent = async (eventName: string, properties?: Record<string, any>) => {
  await trackEvent(eventName, properties)
}

// Additional analytics functions for comprehensive coverage
export const trackOnboardingChatMessage = async (properties?: Record<string, any>) => {
  await trackEvent('onboarding_chat_message', properties)
}

export const trackConversationPhase = async (properties?: Record<string, any>) => {
  await trackEvent('conversation_phase', properties)
}

export const trackAIGuidanceUsage = async (properties?: Record<string, any>) => {
  await trackEvent('ai_guidance_usage', properties)
}

export const trackOnboardingCompletion = async (properties?: Record<string, any>) => {
  await trackEvent('onboarding_completion', properties)
}

export const trackError = async (properties?: Record<string, any>) => {
  await trackEvent('error_occurred', properties)
}

// Map-related events
export const trackMapLoaded = async (properties?: Record<string, any>) => {
  await trackEvent('map_loaded', properties)
}

export const trackMapLoadFailed = async (properties?: Record<string, any>) => {
  await trackEvent('map_load_failed', properties)
}

export const trackFindMyRouteClicked = async (properties?: Record<string, any>) => {
  await trackEvent('find_my_route_clicked', properties)
}

export const trackFindMyRouteSuccess = async (properties?: Record<string, any>) => {
  await trackEvent('find_my_route_success', properties)
}

export const trackFindMyRouteFailed = async (properties?: Record<string, any>) => {
  await trackEvent('find_my_route_failed', properties)
}

export const trackCustomRouteSaved = async (properties?: Record<string, any>) => {
  await trackEvent('custom_route_saved', properties)
}

export const trackCustomRouteSelected = async (properties?: Record<string, any>) => {
  await trackEvent('custom_route_selected', properties)
}

export const trackNearbyFilterChanged = async (properties?: Record<string, any>) => {
  await trackEvent('nearby_filter_changed', properties)
}

export const trackRouteWizardMapToggled = async (properties?: Record<string, any>) => {
  await trackEvent('route_wizard_map_toggled', properties)
}

export const trackRouteSelectedFromMap = async (properties?: Record<string, any>) => {
  await trackEvent('route_selected_from_map', properties)
}

// Authentication events
export const trackAuthEvent = async (
  eventType: 'signup' | 'login' | 'logout' | 'migration'
) => {
  await trackEvent('auth_event', { event_type: eventType })
}

// Sync events
export const trackSyncEvent = async (
  eventType: 'sync_started' | 'sync_completed' | 'sync_failed',
  recordCount?: number
) => {
  await trackEvent('sync_event', { event_type: eventType, record_count: recordCount })
}

// ============================================================================
// PHASE 1: ACTIVATION FUNNEL TRACKING (Core conversion metrics)
// ============================================================================

/**
 * Track signup initiation
 * Called when user starts the signup/registration process
 */
export const trackSignupStarted = async (properties?: Record<string, any>) => {
  await trackEvent('signup_started', {
    source: properties?.source || 'organic',
    ...properties,
  })
}

/**
 * Track successful signup completion
 * CRITICAL: Call analytics.setUserId() after this!
 */
export const trackSignupCompleted = async (properties?: Record<string, any>) => {
  await trackEvent('signup_completed', {
    email: properties?.email,
    signupMethod: properties?.signupMethod || 'email',
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

/**
 * Track onboarding start
 * Called when user enters the onboarding flow
 */
export const trackOnboardingStarted = async (properties?: Record<string, any>) => {
  await trackEvent('onboarding_started', {
    source: properties?.source || 'app',
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

/**
 * Track individual onboarding step completion
 * Called after each onboarding screen/step is completed
 */
export const trackOnboardingStepCompleted = async (
  step: number,
  stepName: string,
  properties?: Record<string, any>
) => {
  await trackEvent('onboarding_step_completed', {
    step_number: step,
    step_name: stepName,
    duration_seconds: properties?.durationSeconds,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

/**
 * Track onboarding funnel completion
 * Called when user completes ALL onboarding steps
 */
export const trackOnboardingCompletedFunnel = async (properties?: Record<string, any>) => {
  await trackEvent('onboarding_completed', {
    goal: properties?.goal,
    experience: properties?.experience,
    daysPerWeek: properties?.daysPerWeek,
    timestamp: new Date().toISOString(),
    funnel_stage: 'onboarding_complete',
    ...properties,
  })
}

/**
 * Track plan generation/creation
 * Called when user completes plan generation after onboarding
 */
export const trackPlanGeneratedFunnel = async (properties?: Record<string, any>) => {
  await trackEvent('plan_generated', {
    plan_type: properties?.planType,
    duration_weeks: properties?.durationWeeks,
    weekly_volume_km: properties?.weeklyVolume,
    timestamp: new Date().toISOString(),
    funnel_stage: 'plan_generated',
    ...properties,
  })
}

/**
 * Track first run recorded
 * Called when user completes and saves their first run
 */
export const trackFirstRunRecorded = async (properties?: Record<string, any>) => {
  await trackEvent('first_run_recorded', {
    distance_km: properties?.distanceKm,
    duration_seconds: properties?.durationSeconds,
    pace_min_km: properties?.paceMinKm,
    timestamp: new Date().toISOString(),
    funnel_stage: 'first_run',
    ...properties,
  })
}

// ============================================================================
// CHALLENGE FUNNEL TRACKING
// ============================================================================

export const trackChallengeDiscovered = async (
  challengeId: number,
  challengeName: string,
  source: string,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_discovered', {
    challenge_id: challengeId,
    challenge_name: challengeName,
    source,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackChallengeRegistered = async (
  challengeId: number,
  challengeName: string,
  totalDays: number,
  difficulty: string,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_registered', {
    challenge_id: challengeId,
    challenge_name: challengeName,
    total_days: totalDays,
    difficulty,
    timestamp: new Date().toISOString(),
    funnel_stage: 'challenge_registered',
    ...properties,
  })
}

export const trackChallengeDayStarted = async (
  challengeId: number,
  day: number,
  totalDays: number,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_day_started', {
    challenge_id: challengeId,
    day_number: day,
    total_days: totalDays,
    progress_percent: Math.round((day / totalDays) * 100),
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackChallengeDayCompleted = async (
  challengeId: number,
  day: number,
  totalDays: number,
  streak: number,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_day_completed', {
    challenge_id: challengeId,
    day_number: day,
    total_days: totalDays,
    streak_days: streak,
    progress_percent: Math.round((day / totalDays) * 100),
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackChallengeCompleted = async (
  challengeId: number,
  totalDays: number,
  completionPercent: number,
  streak: number,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_completed', {
    challenge_id: challengeId,
    total_days: totalDays,
    completion_percent: completionPercent,
    final_streak: streak,
    timestamp: new Date().toISOString(),
    funnel_stage: 'challenge_completed',
    ...properties,
  })
}

export const trackChallengeAbandoned = async (
  challengeId: number,
  dayReached: number,
  totalDays: number,
  reason: string,
  properties?: Record<string, any>
) => {
  await trackEvent('challenge_abandoned', {
    challenge_id: challengeId,
    day_reached: dayReached,
    total_days: totalDays,
    completion_percent: Math.round((dayReached / totalDays) * 100),
    abandonment_reason: reason,
    timestamp: new Date().toISOString(),
    funnel_stage: 'challenge_abandoned',
    ...properties,
  })
}

// ============================================================================
// RUN TRACKING
// ============================================================================

export const trackRunStarted = async (
  source: string,
  workoutId?: string | number,
  properties?: Record<string, any>
) => {
  await trackEvent('run_started', {
    source,
    workout_id: workoutId,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackRunCompleted = async (
  distanceKm: number,
  durationSeconds: number,
  paceMinKm: number,
  workoutId?: string | number,
  runType?: string,
  properties?: Record<string, any>
) => {
  await trackEvent('run_completed', {
    distance_km: distanceKm,
    duration_seconds: durationSeconds,
    pace_min_km: paceMinKm,
    run_type: runType || 'easy',
    workout_id: workoutId,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackRunAbandoned = async (
  durationSeconds: number,
  distanceKm: number,
  reason: string,
  properties?: Record<string, any>
) => {
  await trackEvent('run_abandoned', {
    duration_seconds: durationSeconds,
    distance_km: distanceKm,
    abandonment_reason: reason,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackPlanViewed = async (
  planId?: string | number,
  week?: number,
  properties?: Record<string, any>
) => {
  await trackEvent('plan_viewed', {
    plan_id: planId,
    week_number: week,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackPlanAbandoned = async (
  planId: string | number,
  weekReached: number,
  totalWeeks: number,
  reason: string,
  properties?: Record<string, any>
) => {
  await trackEvent('plan_abandoned', {
    plan_id: planId,
    week_reached: weekReached,
    total_weeks: totalWeeks,
    completion_percent: Math.round((weekReached / totalWeeks) * 100),
    abandonment_reason: reason,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

// ============================================================================
// GOAL TRACKING
// ============================================================================

export const trackGoalCreated = async (
  type: string,
  category: string,
  priority: string,
  value: number,
  unit: string,
  properties?: Record<string, any>
) => {
  await trackEvent('goal_created', {
    goal_type: type,
    goal_category: category,
    goal_priority: priority,
    goal_value: value,
    goal_unit: unit,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackGoalCompleted = async (
  goalId: string | number,
  type: string,
  value: number,
  target: number,
  daysTaken: number,
  properties?: Record<string, any>
) => {
  await trackEvent('goal_completed', {
    goal_id: goalId,
    goal_type: type,
    achieved_value: value,
    target_value: target,
    days_to_complete: daysTaken,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

export const trackScreenViewed = async (
  screenName: string,
  previousScreen?: string,
  properties?: Record<string, any>
) => {
  await trackEvent('screen_viewed', {
    screen_name: screenName,
    previous_screen: previousScreen,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackFeatureUsed = async (
  featureName: string,
  context?: string,
  properties?: Record<string, any>
) => {
  await trackEvent('feature_used', {
    feature_name: featureName,
    context,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackNotificationClicked = async (
  notificationType: string,
  message: string,
  properties?: Record<string, any>
) => {
  await trackEvent('notification_clicked', {
    notification_type: notificationType,
    notification_message: message,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

export const trackAppOpened = async (
  source: string,
  daysInstalled?: number,
  properties?: Record<string, any>
) => {
  await trackEvent('app_opened', {
    source,
    days_installed: daysInstalled,
    timestamp: new Date().toISOString(),
    ...properties,
  })
}

// ============================================================================
// USER IDENTIFICATION (CRITICAL FOR FUNNEL ANALYSIS)
// ============================================================================

/**
 * Set the user ID for tracking
 * IMPORTANT: Call this immediately after user logs in or signs up!
 * This associates all future events with the user ID for funnel analysis.
 */
export const setUserId = (userId: string | number) => {
  if (typeof window === 'undefined') {
    return
  }

  const posthog = typeof window !== 'undefined' ? window.posthog : undefined
  if (posthog && posthog.identify) {
    posthog.identify(String(userId))
  } else {
    logger.debug('PostHog not ready for user identification')
  }
}

/**
 * Set user attributes for segmentation and cohort analysis
 */
export const setUserAttribute = (attribute: string, value: any) => {
  if (typeof window === 'undefined') {
    return
  }

  const posthog = typeof window !== 'undefined' ? window.posthog : undefined
  if (posthog && posthog.setPersonProperties) {
    posthog.setPersonProperties({ [attribute]: value })
  } else {
    logger.debug('PostHog not ready for setting user attributes')
  }
}

/**
 * Force flush pending analytics events
 * Use this before page navigation or app closure to ensure events are sent
 */
export const forceFlush = async () => {
  if (typeof window === 'undefined') {
    return
  }

  const posthog = typeof window !== 'undefined' ? window.posthog : undefined
  if (posthog && typeof posthog.flush === 'function') {
    await new Promise<void>((resolve) => {
      posthog.flush?.(() => resolve())
      // Fallback: resolve after 1 second if flush doesn't complete
      setTimeout(() => resolve(), 1000)
    })
  }
}

// Export analytics object for direct access if needed
export const analytics = {
  setUserId,
  setUserAttribute,
  forceFlush,
  trackEvent,
}
