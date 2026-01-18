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

  const posthog = typeof window !== 'undefined' ? window.posthog : undefined
  if (posthog && posthog.capture) {
    posthog.capture(eventName, eventProperties)
  } else {
    logger.debug('PostHog not ready, skipped event capture:', eventName)
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
