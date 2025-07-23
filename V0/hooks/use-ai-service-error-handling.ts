"use client"

import { useState, useCallback } from 'react'
import { aiServiceCircuitBreaker, retryApiCall } from '@/lib/retryMechanism'
import { AIServiceError } from '@/lib/errorHandling'
import { useErrorToast } from '@/components/error-toast'
import { generateFallbackPlan } from '@/lib/planGenerator'

export interface AIServiceConfig {
  maxRetries?: number
  enableFallbacks?: boolean
  showUserFeedback?: boolean
  circuitBreakerThreshold?: number
}

export function useAIServiceErrorHandling(config: AIServiceConfig = {}) {
  const {
    maxRetries = 3,
    enableFallbacks = true,
    showUserFeedback = true,
    circuitBreakerThreshold = 3
  } = config

  const [isAIServiceAvailable, setIsAIServiceAvailable] = useState(true)
  const [lastAIServiceError, setLastAIServiceError] = useState<Date | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const { showError, showWarning, showInfo } = useErrorToast()

  // Check if AI service should be bypassed
  const shouldBypassAI = useCallback((): boolean => {
    const circuitState = aiServiceCircuitBreaker.getState()
    return circuitState.state === 'open' || fallbackMode
  }, [fallbackMode])

  // Safe AI service call with comprehensive error handling
  const safeAICall = useCallback(async <T>(
    aiCall: () => Promise<T>,
    fallbackFunction?: () => Promise<T> | T,
    context: {
      operation: string
      service: string
      onboardingStep?: string
      userFriendlyName?: string
    } = { operation: 'ai_operation', service: 'ai_service' }
  ): Promise<T> => {
    const { operation, service, onboardingStep, userFriendlyName } = context

    // Check if we should bypass AI service
    if (shouldBypassAI()) {
      if (enableFallbacks && fallbackFunction) {
        if (showUserFeedback) {
          showInfo(
            'Using Alternative Method',
            `${userFriendlyName || operation} will use a guided approach instead of AI`
          )
        }
        const result = await fallbackFunction()
        return result
      } else {
        throw new AIServiceError(`AI service unavailable for ${operation}`)
      }
    }

    try {
      // Use circuit breaker and retry mechanism
      const result = await aiServiceCircuitBreaker.execute(async () => {
        return await retryApiCall(aiCall, {
          operation,
          service,
          onboardingStep
        })
      })

      // Reset error state on success
      if (lastAIServiceError) {
        setLastAIServiceError(null)
        setIsAIServiceAvailable(true)
        if (fallbackMode && showUserFeedback) {
          showInfo('AI Service Restored', 'AI features are now available again')
        }
        setFallbackMode(false)
      }

      return result
    } catch (error) {
      const aiError = error as Error
      setLastAIServiceError(new Date())
      setIsAIServiceAvailable(false)

      // Analyze the error type
      const errorInfo = analyzeAIServiceError(aiError)

      // Handle different types of AI service errors
      switch (errorInfo.type) {
        case 'rate_limit':
          if (showUserFeedback) {
            showWarning(
              'AI Service Busy',
              `Too many requests. ${enableFallbacks ? 'Switching to guided mode.' : 'Please try again in a few minutes.'}`
            )
          }
          break

        case 'service_unavailable':
          if (showUserFeedback) {
            showWarning(
              'AI Service Unavailable',
              `AI service is temporarily down. ${enableFallbacks ? 'Using alternative method.' : 'Please try again later.'}`
            )
          }
          break

        case 'token_limit':
          if (showUserFeedback) {
            showWarning(
              'Request Too Large',
              `Your request is too complex. ${enableFallbacks ? 'Using simplified approach.' : 'Please try with less information.'}`
            )
          }
          break

        case 'invalid_request':
          // Don't retry invalid requests
          if (showUserFeedback) {
            showError(aiError, {
              onFallback: enableFallbacks && fallbackFunction ? async () => {
                const result = await fallbackFunction()
                return result
              } : undefined
            })
          }
          break

        default:
          if (showUserFeedback) {
            showError(aiError, {
              onRetry: () => safeAICall(aiCall, fallbackFunction, context),
              onFallback: enableFallbacks && fallbackFunction ? async () => {
                const result = await fallbackFunction()
                return result
              } : undefined
            })
          }
      }

      // Try fallback if available and error is retryable
      if (enableFallbacks && fallbackFunction && errorInfo.shouldUseFallback) {
        setFallbackMode(true)
        try {
          const result = await fallbackFunction()
          return result
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError)
          throw aiError // Throw original AI error
        }
      }

      throw aiError
    }
  }, [
    shouldBypassAI,
    enableFallbacks,
    showUserFeedback,
    lastAIServiceError,
    fallbackMode,
    showError,
    showWarning,
    showInfo
  ])

  // AI Chat with fallback to form
  const aiChatWithFallback = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    context: { userId?: string; userContext?: string; currentPhase?: string } = {}
  ) => {
    return safeAICall(
      async () => {
        const response = await fetch('/api/onboarding/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, ...context })
        })

        if (!response.ok) {
          throw new AIServiceError(`Chat API failed: ${response.status} ${response.statusText}`)
        }

        return response
      },
      () => {
        // Fallback: redirect to form-based onboarding
        return {
          fallback: true,
          message: 'AI chat unavailable. Please use the guided form instead.',
          redirectToForm: true
        }
      },
      {
        operation: 'ai_chat',
        service: 'openai',
        userFriendlyName: 'AI Coach Chat'
      }
    )
  }, [safeAICall])

  // Plan generation with fallback
  const aiPlanGenerationWithFallback = useCallback(async (
    userData: {
      goal: string
      experience: string
      daysPerWeek: number
      age?: number
      preferredTimes?: string[]
    }
  ) => {
    return safeAICall(
      async () => {
        const response = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        })

        if (!response.ok) {
          throw new AIServiceError(`Plan generation failed: ${response.status} ${response.statusText}`)
        }

        return await response.json()
      },
      () => {
        // Fallback: generate plan locally
        return generateFallbackPlan(userData)
      },
      {
        operation: 'plan_generation',
        service: 'openai',
        userFriendlyName: 'Training Plan Generation'
      }
    )
  }, [safeAICall])

  // Goal discovery with fallback
  const aiGoalDiscoveryWithFallback = useCallback(async (
    userInput: string
  ) => {
    return safeAICall(
      async () => {
        const response = await fetch('/api/onboarding/goalWizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput })
        })

        if (!response.ok) {
          throw new AIServiceError(`Goal discovery failed: ${response.status} ${response.statusText}`)
        }

        return await response.json()
      },
      () => {
        // Fallback: basic goal categorization
        return categorizeGoalLocally(userInput)
      },
      {
        operation: 'goal_discovery',
        service: 'openai',
        userFriendlyName: 'Goal Discovery'
      }
    )
  }, [safeAICall])

  // Get AI service status
  const getAIServiceStatus = useCallback(() => {
    const circuitState = aiServiceCircuitBreaker.getState()
    
    return {
      isAvailable: isAIServiceAvailable,
      lastErrorTime: lastAIServiceError,
      circuitBreakerState: circuitState.state,
      failureCount: circuitState.failureCount,
      inFallbackMode: fallbackMode,
      canRetry: circuitState.state !== 'open'
    }
  }, [isAIServiceAvailable, lastAIServiceError, fallbackMode])

  // Force fallback mode
  const enableFallbackMode = useCallback(() => {
    setFallbackMode(true)
    if (showUserFeedback) {
      showInfo(
        'Fallback Mode Enabled',
        'Using guided forms instead of AI features'
      )
    }
  }, [showUserFeedback, showInfo])

  // Disable fallback mode
  const disableFallbackMode = useCallback(() => {
    setFallbackMode(false)
    aiServiceCircuitBreaker.reset()
    setIsAIServiceAvailable(true)
    setLastAIServiceError(null)
    if (showUserFeedback) {
      showInfo(
        'AI Features Enabled',
        'AI-powered features are now active'
      )
    }
  }, [showUserFeedback, showInfo])

  return {
    // Main AI service wrapper
    safeAICall,
    
    // Specific AI operations with fallbacks
    aiChatWithFallback,
    aiPlanGenerationWithFallback,
    aiGoalDiscoveryWithFallback,
    
    // Status and control
    getAIServiceStatus,
    shouldBypassAI,
    enableFallbackMode,
    disableFallbackMode,
    
    // State
    isAIServiceAvailable,
    fallbackMode
  }
}

// AI service error analysis
interface AIServiceErrorInfo {
  type: 'rate_limit' | 'service_unavailable' | 'token_limit' | 'invalid_request' | 'network' | 'unknown'
  shouldUseFallback: boolean
  retryAfter?: number
  userMessage: string
}

function analyzeAIServiceError(error: Error): AIServiceErrorInfo {
  const errorMessage = error.message.toLowerCase()

  // Rate limiting
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return {
      type: 'rate_limit',
      shouldUseFallback: true,
      retryAfter: 60000, // 1 minute
      userMessage: 'AI service is busy. Please try again in a moment.'
    }
  }

  // Service unavailable
  if (errorMessage.includes('503') || errorMessage.includes('service unavailable') || errorMessage.includes('temporarily unavailable')) {
    return {
      type: 'service_unavailable',
      shouldUseFallback: true,
      userMessage: 'AI service is temporarily down. We\'ll use an alternative approach.'
    }
  }

  // Token/context limit
  if (errorMessage.includes('token') || errorMessage.includes('context length') || errorMessage.includes('too long')) {
    return {
      type: 'token_limit',
      shouldUseFallback: true,
      userMessage: 'Your request is too complex. We\'ll use a simplified approach.'
    }
  }

  // Invalid request
  if (errorMessage.includes('400') || errorMessage.includes('invalid') || errorMessage.includes('bad request')) {
    return {
      type: 'invalid_request',
      shouldUseFallback: true,
      userMessage: 'There was an issue with the request. We\'ll try a different approach.'
    }
  }

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('fetch')) {
    return {
      type: 'network',
      shouldUseFallback: true,
      userMessage: 'Connection issue. We\'ll use offline capabilities.'
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    shouldUseFallback: true,
    userMessage: 'AI service is having issues. We\'ll use an alternative approach.'
  }
}

// Local goal categorization fallback
function categorizeGoalLocally(userInput: string): {
  goals: Array<{
    id: string
    title: string
    description: string
    type: string
    category: string
  }>
  userProfile: {
    goal: 'habit' | 'distance' | 'speed'
    experience: 'beginner' | 'intermediate' | 'advanced'
    coachingStyle: 'supportive'
  }
} {
  const input = userInput.toLowerCase()
  
  // Simple keyword-based categorization
  let goal: 'habit' | 'distance' | 'speed' = 'habit'
  let experience: 'beginner' | 'intermediate' | 'advanced' = 'beginner'

  if (input.includes('distance') || input.includes('5k') || input.includes('10k') || input.includes('marathon')) {
    goal = 'distance'
  } else if (input.includes('faster') || input.includes('speed') || input.includes('pace') || input.includes('time')) {
    goal = 'speed'
  }

  if (input.includes('experienced') || input.includes('advanced') || input.includes('competitive')) {
    experience = 'advanced'
  } else if (input.includes('intermediate') || input.includes('regular') || input.includes('sometimes')) {
    experience = 'intermediate'
  }

  return {
    goals: [{
      id: 'local-goal-1',
      title: goal === 'habit' ? 'Build Running Habit' : 
             goal === 'distance' ? 'Increase Distance' : 'Improve Speed',
      description: goal === 'habit' ? 'Establish a consistent running routine' :
                   goal === 'distance' ? 'Build endurance for longer runs' : 'Work on pace and speed',
      type: 'primary',
      category: goal === 'habit' ? 'consistency' : 
                goal === 'distance' ? 'endurance' : 'speed'
    }],
    userProfile: {
      goal,
      experience,
      coachingStyle: 'supportive'
    }
  }
}