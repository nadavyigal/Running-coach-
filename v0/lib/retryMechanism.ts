/**
 * Retry Mechanism Utility
 * Implements exponential backoff and comprehensive retry strategies
 * For AC5: Retry Mechanisms
 */

import { trackOnboardingError } from './onboardingAnalytics'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: Error) => boolean
  onRetry?: (error: Error, attempt: number) => void
  onSuccess?: (result: unknown, attempts: number) => void
  onFailure?: (error: Error, attempts: number) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTime: number
}

export class RetryableError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'RetryableError'
    this.retryable = retryable
  }
}

export class NonRetryableError extends RetryableError {
  constructor(message: string) {
    super(message, false)
    this.name = 'NonRetryableError'
  }
}

/**
 * Execute a function with retry logic using exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = (error: Error) => shouldRetry(error),
    onRetry,
    onSuccess,
    onFailure
  } = options

  const startTime = Date.now()
  let lastError: Error = new Error('Retry failed')
  let attempt = 0

  while (attempt < maxRetries) {
    attempt++
    
    try {
      const result = await fn()
      const totalTime = Date.now() - startTime
      
      if (onSuccess) {
        onSuccess(result, attempt)
      }
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime
      }
    } catch (error) {
      lastError = error as Error
      
      // Don't retry if error is not retryable
      if (!retryCondition(lastError)) {
        break
      }
      
      // Don't retry if this was the last attempt
      if (attempt >= maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      )
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
      
      if (onRetry) {
        onRetry(lastError, attempt)
      }
      
      // Wait before next attempt
      await sleep(jitteredDelay)
    }
  }

  const totalTime = Date.now() - startTime
  
  if (onFailure) {
    onFailure(lastError, attempt)
  }

  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalTime
  }
}

/**
 * Determine if an error should be retried
 */
export function shouldRetry(error: Error): boolean {
  // Explicitly non-retryable errors
  if (error instanceof NonRetryableError) {
    return false
  }
  
  // Explicitly retryable errors
  if (error instanceof RetryableError) {
    return error.retryable
  }
  
  // Network errors - usually retryable
  if (isNetworkError(error)) {
    return true
  }
  
  // Rate limit errors - retryable with backoff
  if (isRateLimitError(error)) {
    return true
  }
  
  // Server errors (5xx) - retryable
  if (isServerError(error)) {
    return true
  }
  
  // Client errors (4xx) - usually not retryable
  if (isClientError(error)) {
    return false
  }
  
  // Database connection errors - retryable
  if (isDatabaseConnectionError(error)) {
    return true
  }
  
  // AI service temporary failures - retryable
  if (isAIServiceTempError(error)) {
    return true
  }
  
  // Default to not retryable for unknown errors
  return false
}

/**
 * Network error detection
 */
export function isNetworkError(error: Error): boolean {
  const networkErrorMessages = [
    'fetch',
    'network',
    'connection',
    'timeout',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET'
  ]
  
  return networkErrorMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  )
}

/**
 * Rate limit error detection
 */
export function isRateLimitError(error: Error): boolean {
  return error.message.includes('429') || 
         error.message.toLowerCase().includes('rate limit') ||
         error.message.toLowerCase().includes('too many requests')
}

/**
 * Server error detection (5xx)
 */
export function isServerError(error: Error): boolean {
  const serverErrorCodes = ['500', '502', '503', '504', '507', '508', '509']
  return serverErrorCodes.some(code => error.message.includes(code))
}

/**
 * Client error detection (4xx)
 */
export function isClientError(error: Error): boolean {
  const clientErrorCodes = ['400', '401', '403', '404', '405', '406', '409', '410', '422']
  return clientErrorCodes.some(code => error.message.includes(code))
}

/**
 * Database connection error detection
 */
export function isDatabaseConnectionError(error: Error): boolean {
  const dbErrorMessages = [
    'database connection',
    'connection pool',
    'database unavailable',
    'db connection failed',
    'indexeddb',
    'storage quota'
  ]
  
  return dbErrorMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  )
}

/**
 * AI service temporary error detection
 */
export function isAIServiceTempError(error: Error): boolean {
  const aiTempErrorMessages = [
    'service temporarily unavailable',
    'ai service error',
    'openai',
    'model overloaded',
    'token limit'
  ]
  
  return aiTempErrorMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  )
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry with progress callback
 */
export async function withRetryProgress<T>(
  fn: () => Promise<T>,
  options: RetryOptions & {
    onProgress?: (attempt: number, maxRetries: number, delay: number) => void
  } = {}
): Promise<RetryResult<T>> {
  const { onProgress, ...retryOptions } = options
  
  return withRetry(fn, {
    ...retryOptions,
    onRetry: (error, attempt) => {
      const maxRetries = retryOptions.maxRetries || 3
      const delay = Math.min(
        (retryOptions.initialDelay || 1000) * Math.pow(retryOptions.backoffFactor || 2, attempt - 1),
        retryOptions.maxDelay || 30000
      )
      
      if (onProgress) {
        onProgress(attempt, maxRetries, delay)
      }
      
      if (retryOptions.onRetry) {
        retryOptions.onRetry(error, attempt)
      }
    }
  })
}

/**
 * Retry API calls with specific handling for different error types
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  context: {
    operation: string
    service: string
    userId?: string
    onboardingStep?: string
  }
): Promise<T> {
  const result = await withRetryProgress(apiCall, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error) => {
      // Log the error for analytics
	      trackOnboardingError({
	        errorType: isNetworkError(error) ? 'network_failure' : 
	                   isRateLimitError(error) ? 'api_timeout' :
	                   isAIServiceTempError(error) ? 'network_failure' : 'validation_error',
	        errorMessage: error.message,
	        errorContext: {
	          operation: context.operation,
	          service: context.service,
	          retryable: shouldRetry(error)
	        },
	        recoveryAttempted: true,
	        recoverySuccessful: false,
	        userImpact: 'medium',
	        onboardingStep: context.onboardingStep || 'unknown'
	      })
      
      return shouldRetry(error)
    },
    onRetry: (error, attempt) => {
      console.warn(`Retry attempt ${attempt} for ${context.operation}:`, error.message)
    },
	    onSuccess: (_result, attempts) => {
	      if (attempts > 1) {
	        console.log(`${context.operation} succeeded after ${attempts} attempts`)
	      }
	    },
    onFailure: (error, attempts) => {
      console.error(`${context.operation} failed after ${attempts} attempts:`, error.message)
    }
  })
  
  if (!result.success) {
    throw result.error
  }
  
  return result.data!
}

/**
 * Retry database operations
 */
export async function retryDbOperation<T>(
  dbCall: () => Promise<T>,
  operationName: string
): Promise<T> {
  const result = await withRetry(dbCall, {
    maxRetries: 2, // Fewer retries for DB operations
    initialDelay: 500,
    maxDelay: 2000,
    retryCondition: (error) => isDatabaseConnectionError(error),
    onRetry: (error, attempt) => {
      console.warn(`Database retry attempt ${attempt} for ${operationName}:`, error.message)
    }
  })
  
  if (!result.success) {
    throw result.error
  }
  
  return result.data!
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime: number | undefined
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private maxFailures = 5,
    private resetTimeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new NonRetryableError('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      
      // Reset on success
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failureCount = 0
      }
      
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()
      
      if (this.failureCount >= this.maxFailures) {
        this.state = 'open'
      }
      
      throw error
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    }
  }
  
  reset() {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = undefined
  }
}

// Global circuit breakers for different services
export const aiServiceCircuitBreaker = new CircuitBreaker(3, 30000) // 30 seconds
export const databaseCircuitBreaker = new CircuitBreaker(5, 10000) // 10 seconds
