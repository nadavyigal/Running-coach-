import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import {
  withRetry,
  withRetryProgress,
  shouldRetry,
  isNetworkError,
  isRateLimitError,
  isServerError,
  isClientError,
  isDatabaseConnectionError,
  isAIServiceTempError,
  sleep,
  RetryableError,
  NonRetryableError,
  CircuitBreaker,
  aiServiceCircuitBreaker,
  databaseCircuitBreaker
} from './retryMechanism'

describe('retryMechanism', () => {
  beforeAll(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    // Return to default fake timers configured in global setup
    vi.useFakeTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Reset circuit breakers
    aiServiceCircuitBreaker.reset()
    databaseCircuitBreaker.reset()
  })

  describe('withRetry', () => {
    it('should return success immediately if function succeeds', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')
      
      const result = await withRetry(mockFn, { maxRetries: 3 })
      
      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(1)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('500 server error'))
        .mockResolvedValue('success')
      
      const result = await withRetry(mockFn, { 
        maxRetries: 3,
        initialDelay: 10,
        backoffFactor: 1
      })
      
      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(3)
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new NonRetryableError('invalid input'))
      
      const result = await withRetry(mockFn, { maxRetries: 3 })
      
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should respect maxRetries limit', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('network error'))
      
      const result = await withRetry(mockFn, { 
        maxRetries: 2,
        initialDelay: 10
      })
      
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should call onRetry callback', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success')
      const onRetry = vi.fn()
      
      await withRetry(mockFn, { 
        maxRetries: 2,
        initialDelay: 10,
        onRetry
      })
      
      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1)
    })

    it('should call onSuccess callback', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')
      const onSuccess = vi.fn()
      
      await withRetry(mockFn, { onSuccess })
      
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalledWith('success', 1)
    })

    it('should call onFailure callback', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('failed'))
      const onFailure = vi.fn()
      
      await withRetry(mockFn, { 
        maxRetries: 1,
        initialDelay: 10,
        onFailure
      })
      
      expect(onFailure).toHaveBeenCalledTimes(1)
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error), 1)
    })

    it('should use exponential backoff with jitter', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success')
      
      const startTime = Date.now()
      
      await withRetry(mockFn, { 
        maxRetries: 3,
        initialDelay: 100,
        backoffFactor: 2,
        maxDelay: 1000
      })
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Should have some delay due to backoff (allowing for jitter)
      expect(totalTime).toBeGreaterThan(100)
    })
  })

  describe('withRetryProgress', () => {
    it('should call onProgress callback', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success')
      const onProgress = vi.fn()
      
      await withRetryProgress(mockFn, { 
        maxRetries: 2,
        initialDelay: 10,
        onProgress
      })
      
      expect(onProgress).toHaveBeenCalledTimes(1)
      expect(onProgress).toHaveBeenCalledWith(1, 2, 10)
    })
  })

  describe('shouldRetry', () => {
    it('should return false for NonRetryableError', () => {
      const error = new NonRetryableError('invalid input')
      expect(shouldRetry(error)).toBe(false)
    })

    it('should return true for RetryableError', () => {
      const error = new RetryableError('network timeout')
      expect(shouldRetry(error)).toBe(true)
    })

    it('should return true for network errors', () => {
      const error = new Error('Failed to fetch')
      expect(shouldRetry(error)).toBe(true)
    })

    it('should return true for rate limit errors', () => {
      const error = new Error('429 Too Many Requests')
      expect(shouldRetry(error)).toBe(true)
    })

    it('should return true for server errors', () => {
      const error = new Error('500 Internal Server Error')
      expect(shouldRetry(error)).toBe(true)
    })

    it('should return false for client errors', () => {
      const error = new Error('400 Bad Request')
      expect(shouldRetry(error)).toBe(false)
    })

    it('should return false for unknown errors by default', () => {
      const error = new Error('unknown error')
      expect(shouldRetry(error)).toBe(false)
    })
  })

  describe('error detection functions', () => {
    describe('isNetworkError', () => {
      it('should detect network errors', () => {
        expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
        expect(isNetworkError(new Error('Network connection failed'))).toBe(true)
        expect(isNetworkError(new Error('ENOTFOUND'))).toBe(true)
        expect(isNetworkError(new Error('Connection timeout'))).toBe(true)
        expect(isNetworkError(new Error('Database error'))).toBe(false)
      })
    })

    describe('isRateLimitError', () => {
      it('should detect rate limit errors', () => {
        expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true)
        expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true)
        expect(isRateLimitError(new Error('too many requests'))).toBe(true)
        expect(isRateLimitError(new Error('Network error'))).toBe(false)
      })
    })

    describe('isServerError', () => {
      it('should detect server errors', () => {
        expect(isServerError(new Error('500 Internal Server Error'))).toBe(true)
        expect(isServerError(new Error('502 Bad Gateway'))).toBe(true)
        expect(isServerError(new Error('503 Service Unavailable'))).toBe(true)
        expect(isServerError(new Error('400 Bad Request'))).toBe(false)
      })
    })

    describe('isClientError', () => {
      it('should detect client errors', () => {
        expect(isClientError(new Error('400 Bad Request'))).toBe(true)
        expect(isClientError(new Error('401 Unauthorized'))).toBe(true)
        expect(isClientError(new Error('404 Not Found'))).toBe(true)
        expect(isClientError(new Error('500 Internal Server Error'))).toBe(false)
      })
    })

    describe('isDatabaseConnectionError', () => {
      it('should detect database connection errors', () => {
        expect(isDatabaseConnectionError(new Error('Database connection failed'))).toBe(true)
        expect(isDatabaseConnectionError(new Error('IndexedDB unavailable'))).toBe(true)
        expect(isDatabaseConnectionError(new Error('Storage quota exceeded'))).toBe(true)
        expect(isDatabaseConnectionError(new Error('Network error'))).toBe(false)
      })
    })

    describe('isAIServiceTempError', () => {
      it('should detect AI service temporary errors', () => {
        expect(isAIServiceTempError(new Error('OpenAI service unavailable'))).toBe(true)
        expect(isAIServiceTempError(new Error('Model overloaded'))).toBe(true)
        expect(isAIServiceTempError(new Error('Token limit exceeded'))).toBe(true)
        expect(isAIServiceTempError(new Error('Database error'))).toBe(false)
      })
    })
  })

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const startTime = Date.now()
      await sleep(100)
      const endTime = Date.now()
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(95) // Allow for some variance
    })
  })

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(2, 1000) // 2 failures, 1 second reset
    })

    it('should allow operations when closed', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')
      
      const result = await circuitBreaker.execute(mockFn)
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(circuitBreaker.getState().state).toBe('closed')
    })

    it('should open circuit after max failures', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('failure'))
      
      // First failure
      try {
        await circuitBreaker.execute(mockFn)
      } catch {
        // Expected
      }
      
      // Second failure - should open circuit
      try {
        await circuitBreaker.execute(mockFn)
      } catch {
        // Expected
      }
      
      expect(circuitBreaker.getState().state).toBe('open')
      expect(circuitBreaker.getState().failureCount).toBe(2)
    })

    it('should reject requests when circuit is open', async () => {
      const mockFn = vi.fn()
      
      // Force circuit to open
      circuitBreaker['failureCount'] = 2
      circuitBreaker['state'] = 'open'
      circuitBreaker['lastFailureTime'] = Date.now()
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is open')
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should reset circuit after timeout', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')
      
      // Force circuit to open with old failure time
      circuitBreaker['failureCount'] = 2
      circuitBreaker['state'] = 'open'
      circuitBreaker['lastFailureTime'] = Date.now() - 2000 // 2 seconds ago
      
      const result = await circuitBreaker.execute(mockFn)
      
      expect(result).toBe('success')
      expect(circuitBreaker.getState().state).toBe('closed')
      expect(circuitBreaker.getState().failureCount).toBe(0)
    })

    it('should reset on manual reset', () => {
      // Force circuit to open
      circuitBreaker['failureCount'] = 2
      circuitBreaker['state'] = 'open'
      circuitBreaker['lastFailureTime'] = Date.now()
      
      circuitBreaker.reset()
      
      const state = circuitBreaker.getState()
      expect(state.state).toBe('closed')
      expect(state.failureCount).toBe(0)
      expect(state.lastFailureTime).toBeUndefined()
    })
  })

  describe('global circuit breakers', () => {
    it('should have AI service circuit breaker configured', () => {
      expect(aiServiceCircuitBreaker).toBeInstanceOf(CircuitBreaker)
      expect(aiServiceCircuitBreaker.getState().state).toBe('closed')
    })

    it('should have database circuit breaker configured', () => {
      expect(databaseCircuitBreaker).toBeInstanceOf(CircuitBreaker)
      expect(databaseCircuitBreaker.getState().state).toBe('closed')
    })
  })
})
