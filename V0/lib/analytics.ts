import posthog from 'posthog-js'

export const trackReminderEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties)
}

export const trackPlanAdjustmentEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties)
}

export const trackFeedbackEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties)
}

export const trackEngagementEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties)
}
