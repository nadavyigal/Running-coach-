import { trackAnalyticsEvent } from './analytics'

// Define conversation phases
export type OnboardingPhase = 'motivation' | 'assessment' | 'creation' | 'refinement' | 'complete'

// Define event interfaces
export interface GoalDiscoveryEvent {
  goalType: 'habit' | 'distance' | 'speed'
  goalCategory: 'consistency' | 'endurance' | 'speed' | 'health'
  goalConfidenceScore?: number
  discoveryMethod: 'ai_guided' | 'form_selection' | 'chat_extraction'
  goalReasoning?: string
  userContext?: Record<string, unknown>
}

export interface OnboardingCompletionEvent {
  completionMethod: 'ai_chat' | 'guided_form' | 'mixed'
  completionTimeMs: number
  stepProgression: string[]
  userDemographics: {
    age?: number
    experience: 'beginner' | 'intermediate' | 'advanced'
    daysPerWeek: number
    preferredTimes: string[]
  }
  completionSuccessRate: number
  errorCount: number
  planGeneratedSuccessfully: boolean
}

export interface ConversationPhaseEvent {
  fromPhase: OnboardingPhase
  toPhase: OnboardingPhase
  timeSpentInPhaseMs: number
  messagesInPhase: number
  phaseCompletionRate: number
  userEngagementScore: number
}

export interface OnboardingErrorEvent {
  errorType: 'network_failure' | 'api_timeout' | 'validation_error' | 'plan_generation_failure' | 'database_error' | 'user_input_error'
  errorMessage: string
  errorContext: Record<string, unknown>
  recoveryAttempted: boolean
  recoverySuccessful: boolean
  userImpact: 'low' | 'medium' | 'high'
  onboardingStep: string
  phase?: OnboardingPhase
}

export interface PerformanceMetrics {
  totalOnboardingTimeMs: number
  stepCompletionTimes: Record<string, number>
  userEngagementMetrics: {
    messageCount: number
    averageResponseTimeMs: number
    abandonmentRate: number
    retryCount: number
  }
  conversionRates: Record<string, number>
}

export interface UserContextEvent {
  demographics: {
    age?: number
    experience: string
    goal: string
  }
  preferences: {
    daysPerWeek: number
    preferredTimes: string[]
    coachingStyle?: string
  }
  deviceInfo: {
    platform: string
    userAgent?: string
    screenSize?: string
  }
  behaviorPatterns: {
    sessionDuration: number
    interactionCount: number
    completionAttempts: number
  }
}

// Analytics tracking functions

/**
 * Track goal discovery events (AC1)
 */
export const trackGoalDiscovered = async (eventData: GoalDiscoveryEvent): Promise<void> => {
  await trackAnalyticsEvent('goal_discovered', {
    goal_type: eventData.goalType,
    goal_category: eventData.goalCategory,
    goal_confidence_score: eventData.goalConfidenceScore,
    discovery_method: eventData.discoveryMethod,
    goal_reasoning: eventData.goalReasoning,
    user_context: eventData.userContext,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track onboarding completion events (AC2)
 */
export const trackOnboardingCompleted = async (eventData: OnboardingCompletionEvent): Promise<void> => {
  await trackAnalyticsEvent('onboarding_completed', {
    completion_method: eventData.completionMethod,
    completion_time_ms: eventData.completionTimeMs,
    step_progression: eventData.stepProgression,
    user_age: eventData.userDemographics.age,
    user_experience: eventData.userDemographics.experience,
    days_per_week: eventData.userDemographics.daysPerWeek,
    preferred_times: eventData.userDemographics.preferredTimes,
    completion_success_rate: eventData.completionSuccessRate,
    error_count: eventData.errorCount,
    plan_generated_successfully: eventData.planGeneratedSuccessfully,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track conversation phase transitions (AC3)
 */
export const trackConversationPhase = async (eventData: ConversationPhaseEvent): Promise<void> => {
  await trackAnalyticsEvent('conversation_phase_transition', {
    from_phase: eventData.fromPhase,
    to_phase: eventData.toPhase,
    time_spent_in_phase_ms: eventData.timeSpentInPhaseMs,
    messages_in_phase: eventData.messagesInPhase,
    phase_completion_rate: eventData.phaseCompletionRate,
    user_engagement_score: eventData.userEngagementScore,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track onboarding errors (AC4)
 */
export const trackOnboardingError = async (eventData: OnboardingErrorEvent): Promise<void> => {
  await trackAnalyticsEvent('onboarding_error', {
    error_type: eventData.errorType,
    error_message: eventData.errorMessage,
    error_context: eventData.errorContext,
    recovery_attempted: eventData.recoveryAttempted,
    recovery_successful: eventData.recoverySuccessful,
    user_impact: eventData.userImpact,
    onboarding_step: eventData.onboardingStep,
    phase: eventData.phase,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track performance metrics (AC5)
 */
export const trackPerformanceMetrics = async (eventData: PerformanceMetrics): Promise<void> => {
  await trackAnalyticsEvent('onboarding_performance', {
    total_onboarding_time_ms: eventData.totalOnboardingTimeMs,
    step_completion_times: eventData.stepCompletionTimes,
    message_count: eventData.userEngagementMetrics.messageCount,
    average_response_time_ms: eventData.userEngagementMetrics.averageResponseTimeMs,
    abandonment_rate: eventData.userEngagementMetrics.abandonmentRate,
    retry_count: eventData.userEngagementMetrics.retryCount,
    conversion_rates: eventData.conversionRates,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track user context events (AC6)
 */
export const trackUserContext = async (eventData: UserContextEvent): Promise<void> => {
  await trackAnalyticsEvent('onboarding_user_context', {
    user_age: eventData.demographics.age,
    user_experience: eventData.demographics.experience,
    user_goal: eventData.demographics.goal,
    days_per_week: eventData.preferences.daysPerWeek,
    preferred_times: eventData.preferences.preferredTimes,
    coaching_style: eventData.preferences.coachingStyle,
    platform: eventData.deviceInfo.platform,
    user_agent: eventData.deviceInfo.userAgent,
    screen_size: eventData.deviceInfo.screenSize,
    session_duration: eventData.behaviorPatterns.sessionDuration,
    interaction_count: eventData.behaviorPatterns.interactionCount,
    completion_attempts: eventData.behaviorPatterns.completionAttempts,
    timestamp: new Date().toISOString()
  })
}

// Helper functions for tracking common onboarding events

/**
 * Track onboarding start
 */
export const trackOnboardingStarted = async (method: 'ai_chat' | 'guided_form'): Promise<void> => {
  await trackAnalyticsEvent('onboarding_started', {
    method,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track step progression
 */
export const trackStepProgression = async (step: number, stepName: string, direction: 'forward' | 'backward'): Promise<void> => {
  await trackAnalyticsEvent('onboarding_step_progression', {
    step,
    step_name: stepName,
    direction,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track chat message sent during onboarding
 */
export const trackOnboardingChatMessage = async (messageData: {
  phase: OnboardingPhase
  messageLength: number
  responseTimeMs?: number
  messageType: 'user' | 'assistant'
  tokensUsed?: number
}): Promise<void> => {
  await trackAnalyticsEvent('onboarding_chat_message', {
    phase: messageData.phase,
    message_length: messageData.messageLength,
    response_time_ms: messageData.responseTimeMs,
    message_type: messageData.messageType,
    tokens_used: messageData.tokensUsed,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track AI guidance usage
 */
export const trackAIGuidanceUsage = async (guidanceData: {
  feature: 'goal_discovery' | 'preference_extraction' | 'plan_generation'
  success: boolean
  confidenceScore?: number
  adaptations?: string[]
}): Promise<void> => {
  await trackAnalyticsEvent('ai_guidance_usage', {
    feature: guidanceData.feature,
    success: guidanceData.success,
    confidence_score: guidanceData.confidenceScore,
    adaptations: guidanceData.adaptations,
    timestamp: new Date().toISOString()
  })
}

/**
 * Track form validation errors
 */
export const trackFormValidationError = async (errorData: {
  step: number
  field: string
  errorType: string
  errorMessage: string
}): Promise<void> => {
  await trackOnboardingError({
    errorType: 'user_input_error',
    errorMessage: errorData.errorMessage,
    errorContext: {
      step: errorData.step,
      field: errorData.field,
      error_type: errorData.errorType
    },
    recoveryAttempted: false,
    recoverySuccessful: false,
    userImpact: 'low',
    onboardingStep: `step_${errorData.step}`
  })
}

// Utility functions for session tracking

/**
 * Start tracking onboarding session
 */
export class OnboardingSessionTracker {
  private startTime: Date
  private stepTimes: Map<string, Date> = new Map()
  private errorCount: number = 0
  private messageCount: number = 0
  private currentPhase: OnboardingPhase = 'motivation'
  private phaseStartTime: Date = new Date()

  constructor() {
    this.startTime = new Date()
  }

  startStep(stepName: string): void {
    this.stepTimes.set(stepName, new Date())
  }

  completeStep(stepName: string): void {
    const startTime = this.stepTimes.get(stepName)
    if (startTime) {
      const duration = Date.now() - startTime.getTime()
      trackAnalyticsEvent('onboarding_step_completed', {
        step_name: stepName,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      })
    }
  }

  transitionPhase(toPhase: OnboardingPhase): void {
    const phaseEndTime = new Date()
    const timeInPhase = phaseEndTime.getTime() - this.phaseStartTime.getTime()
    
    trackConversationPhase({
      fromPhase: this.currentPhase,
      toPhase,
      timeSpentInPhaseMs: timeInPhase,
      messagesInPhase: this.messageCount,
      phaseCompletionRate: 1.0,
      userEngagementScore: Math.min(this.messageCount / 5, 1.0)
    })

    this.currentPhase = toPhase
    this.phaseStartTime = phaseEndTime
    this.messageCount = 0
  }

  incrementMessageCount(): void {
    this.messageCount++
  }

  incrementErrorCount(): void {
    this.errorCount++
  }

  complete(completionData: Partial<OnboardingCompletionEvent>): void {
    const endTime = new Date()
    const totalTime = endTime.getTime() - this.startTime.getTime()

    const stepCompletionTimes: Record<string, number> = {}
    this.stepTimes.forEach((startTime, stepName) => {
      stepCompletionTimes[stepName] = endTime.getTime() - startTime.getTime()
    })

    trackOnboardingCompleted({
      completionTimeMs: totalTime,
      errorCount: this.errorCount,
      stepProgression: Array.from(this.stepTimes.keys()),
      completionSuccessRate: this.errorCount === 0 ? 1.0 : Math.max(0, 1 - (this.errorCount * 0.1)),
      ...completionData
    } as OnboardingCompletionEvent)

    trackPerformanceMetrics({
      totalOnboardingTimeMs: totalTime,
      stepCompletionTimes,
      userEngagementMetrics: {
        messageCount: this.messageCount,
        averageResponseTimeMs: totalTime / Math.max(this.messageCount, 1),
        abandonmentRate: 0, // Completed successfully
        retryCount: this.errorCount
      },
      conversionRates: {
        step_completion_rate: 1.0,
        error_recovery_rate: this.errorCount > 0 ? 1.0 : 0
      }
    })
  }
}