import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  trackGoalDiscovered,
  trackOnboardingCompleted,
  trackConversationPhase,
  trackOnboardingError,
  trackPerformanceMetrics,
  trackUserContext,
  trackOnboardingStarted,
  trackStepProgression,
  trackOnboardingChatMessage,
  trackAIGuidanceUsage,
  trackFormValidationError,
  OnboardingSessionTracker
} from './onboardingAnalytics'

// Mock the analytics module
vi.mock('./analytics', () => ({
  trackAnalyticsEvent: vi.fn()
}))

import { trackAnalyticsEvent } from './analytics'

describe('onboardingAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('trackGoalDiscovered', () => {
    it('should track goal discovery with all parameters', async () => {
      const goalData = {
        goalType: 'habit' as const,
        goalCategory: 'consistency' as const,
        goalConfidenceScore: 0.9,
        discoveryMethod: 'ai_guided' as const,
        goalReasoning: 'Test reasoning',
        userContext: { test: 'data' }
      }

      await trackGoalDiscovered(goalData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('goal_discovered', {
        goal_type: 'habit',
        goal_category: 'consistency',
        goal_confidence_score: 0.9,
        discovery_method: 'ai_guided',
        goal_reasoning: 'Test reasoning',
        user_context: { test: 'data' },
        timestamp: expect.any(String)
      })
    })

    it('should track goal discovery with minimal parameters', async () => {
      const goalData = {
        goalType: 'distance' as const,
        goalCategory: 'endurance' as const,
        discoveryMethod: 'form_selection' as const
      }

      await trackGoalDiscovered(goalData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('goal_discovered', {
        goal_type: 'distance',
        goal_category: 'endurance',
        goal_confidence_score: undefined,
        discovery_method: 'form_selection',
        goal_reasoning: undefined,
        user_context: undefined,
        timestamp: expect.any(String)
      })
    })
  })

  describe('trackOnboardingCompleted', () => {
    it('should track onboarding completion with all data', async () => {
      const completionData = {
        completionMethod: 'ai_chat' as const,
        completionTimeMs: 120000,
        stepProgression: ['step_1', 'step_2', 'step_3'],
        userDemographics: {
          age: 25,
          experience: 'beginner' as const,
          daysPerWeek: 3,
          preferredTimes: ['morning']
        },
        completionSuccessRate: 1.0,
        errorCount: 0,
        planGeneratedSuccessfully: true
      }

      await trackOnboardingCompleted(completionData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_completed', {
        completion_method: 'ai_chat',
        completion_time_ms: 120000,
        step_progression: ['step_1', 'step_2', 'step_3'],
        user_age: 25,
        user_experience: 'beginner',
        days_per_week: 3,
        preferred_times: ['morning'],
        completion_success_rate: 1.0,
        error_count: 0,
        plan_generated_successfully: true,
        timestamp: expect.any(String)
      })
    })
  })

  describe('trackConversationPhase', () => {
    it('should track phase transitions', async () => {
      const phaseData = {
        fromPhase: 'motivation' as const,
        toPhase: 'assessment' as const,
        timeSpentInPhaseMs: 30000,
        messagesInPhase: 3,
        phaseCompletionRate: 1.0,
        userEngagementScore: 0.8
      }

      await trackConversationPhase(phaseData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('conversation_phase_transition', {
        from_phase: 'motivation',
        to_phase: 'assessment',
        time_spent_in_phase_ms: 30000,
        messages_in_phase: 3,
        phase_completion_rate: 1.0,
        user_engagement_score: 0.8,
        timestamp: expect.any(String)
      })
    })
  })

  describe('trackOnboardingError', () => {
    it('should track errors with complete context', async () => {
      const errorData = {
        errorType: 'network_failure' as const,
        errorMessage: 'Connection failed',
        errorContext: { step: 'completion', attempts: 2 },
        recoveryAttempted: true,
        recoverySuccessful: false,
        userImpact: 'high' as const,
        onboardingStep: 'step_8',
        phase: 'complete' as const
      }

      await trackOnboardingError(errorData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_error', {
        error_type: 'network_failure',
        error_message: 'Connection failed',
        error_context: { step: 'completion', attempts: 2 },
        recovery_attempted: true,
        recovery_successful: false,
        user_impact: 'high',
        onboarding_step: 'step_8',
        phase: 'complete',
        timestamp: expect.any(String)
      })
    })
  })

  describe('trackPerformanceMetrics', () => {
    it('should track performance metrics', async () => {
      const performanceData = {
        totalOnboardingTimeMs: 300000,
        stepCompletionTimes: { step_1: 10000, step_2: 15000 },
        userEngagementMetrics: {
          messageCount: 10,
          averageResponseTimeMs: 2000,
          abandonmentRate: 0.1,
          retryCount: 1
        },
        conversionRates: { completion_rate: 0.95 }
      }

      await trackPerformanceMetrics(performanceData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_performance', {
        total_onboarding_time_ms: 300000,
        step_completion_times: { step_1: 10000, step_2: 15000 },
        message_count: 10,
        average_response_time_ms: 2000,
        abandonment_rate: 0.1,
        retry_count: 1,
        conversion_rates: { completion_rate: 0.95 },
        timestamp: expect.any(String)
      })
    })
  })

  describe('trackUserContext', () => {
    it('should track user context data', async () => {
      const contextData = {
        demographics: { age: 30, experience: 'intermediate', goal: 'distance' },
        preferences: { daysPerWeek: 4, preferredTimes: ['evening'], coachingStyle: 'supportive' },
        deviceInfo: { platform: 'web', userAgent: 'test-agent', screenSize: '1920x1080' },
        behaviorPatterns: { sessionDuration: 180000, interactionCount: 15, completionAttempts: 1 }
      }

      await trackUserContext(contextData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_user_context', {
        user_age: 30,
        user_experience: 'intermediate',
        user_goal: 'distance',
        days_per_week: 4,
        preferred_times: ['evening'],
        coaching_style: 'supportive',
        platform: 'web',
        user_agent: 'test-agent',
        screen_size: '1920x1080',
        session_duration: 180000,
        interaction_count: 15,
        completion_attempts: 1,
        timestamp: expect.any(String)
      })
    })
  })

  describe('helper functions', () => {
    it('should track onboarding start', async () => {
      await trackOnboardingStarted('guided_form')

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_started', {
        method: 'guided_form',
        timestamp: expect.any(String)
      })
    })

    it('should track step progression', async () => {
      await trackStepProgression(2, 'goal_selection', 'forward')

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_step_progression', {
        step: 2,
        step_name: 'goal_selection',
        direction: 'forward',
        timestamp: expect.any(String)
      })
    })

    it('should track chat messages', async () => {
      const messageData = {
        phase: 'motivation' as const,
        messageLength: 150,
        responseTimeMs: 2000,
        messageType: 'user' as const,
        tokensUsed: 37
      }

      await trackOnboardingChatMessage(messageData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_chat_message', {
        phase: 'motivation',
        message_length: 150,
        response_time_ms: 2000,
        message_type: 'user',
        tokens_used: 37,
        timestamp: expect.any(String)
      })
    })

    it('should track AI guidance usage', async () => {
      const guidanceData = {
        feature: 'goal_discovery' as const,
        success: true,
        confidenceScore: 0.85,
        adaptations: ['personalized', 'contextual']
      }

      await trackAIGuidanceUsage(guidanceData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('ai_guidance_usage', {
        feature: 'goal_discovery',
        success: true,
        confidence_score: 0.85,
        adaptations: ['personalized', 'contextual'],
        timestamp: expect.any(String)
      })
    })

    it('should track form validation errors', async () => {
      await trackFormValidationError({
        step: 5,
        field: 'age',
        errorType: 'out_of_range',
        errorMessage: 'Age must be between 10 and 100'
      })

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_error', {
        error_type: 'user_input_error',
        error_message: 'Age must be between 10 and 100',
        error_context: {
          step: 5,
          field: 'age',
          error_type: 'out_of_range'
        },
        recovery_attempted: false,
        recovery_successful: false,
        user_impact: 'low',
        onboarding_step: 'step_5',
        timestamp: expect.any(String)
      })
    })
  })

  describe('OnboardingSessionTracker', () => {
    let tracker: OnboardingSessionTracker

    beforeEach(() => {
      tracker = new OnboardingSessionTracker()
    })

    it('should track step completion', () => {
      tracker.startStep('goal_selection')
      
      // Mock Date.now to control timing
      const originalNow = Date.now
      Date.now = vi.fn(() => originalNow() + 5000) // 5 seconds later
      
      tracker.completeStep('goal_selection')

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_step_completed', {
        step_name: 'goal_selection',
        duration_ms: expect.any(Number),
        timestamp: expect.any(String)
      })

      Date.now = originalNow
    })

    it('should track phase transitions', () => {
      tracker.incrementMessageCount()
      tracker.incrementMessageCount()
      
      tracker.transitionPhase('assessment')

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('conversation_phase_transition', {
        from_phase: 'motivation',
        to_phase: 'assessment',
        time_spent_in_phase_ms: expect.any(Number),
        messages_in_phase: 2,
        phase_completion_rate: 1.0,
        user_engagement_score: expect.any(Number),
        timestamp: expect.any(String)
      })
    })

    it('should track completion with all metrics', () => {
      tracker.incrementErrorCount()
      tracker.incrementMessageCount()
      
      const completionData = {
        completionMethod: 'guided_form' as const,
        userDemographics: {
          age: 25,
          experience: 'beginner' as const,
          daysPerWeek: 3,
          preferredTimes: ['morning']
        },
        planGeneratedSuccessfully: true
      }

      tracker.complete(completionData)

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_completed', expect.objectContaining({
        completion_method: 'guided_form',
        error_count: 1,
        user_age: 25,
        user_experience: 'beginner',
        days_per_week: 3,
        preferred_times: ['morning'],
        plan_generated_successfully: true
      }))

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('onboarding_performance', expect.objectContaining({
        total_onboarding_time_ms: expect.any(Number),
        message_count: 1,
        retry_count: 1
      }))
    })
  })
})