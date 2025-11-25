/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  analyzeError,
  getRecoveryActions,
  NetworkStatusMonitor,
  OfflineStorage,
  NetworkError,
  OfflineError,
  AIServiceError,
  DatabaseError,
  ValidationError
} from './errorHandling'

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
})

// Mock fetch
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('errorHandling (client-side)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigator.onLine = true
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('analyzeError', () => {
    it('should identify network errors', () => {
      const error = new Error('Failed to fetch')
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('network')
      expect(info.userMessage).toContain('Connection failed')
      expect(info.canRetry).toBe(true)
      expect(info.suggestedAction).toContain('network connection')
    })

    it('should identify offline errors', () => {
      navigator.onLine = false
      const error = new OfflineError('You appear to be offline')
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('offline')
      expect(info.userMessage).toContain('offline')
      expect(info.canRetry).toBe(false)
      expect(info.suggestedAction).toContain('Connect to the internet')
    })

    it('should identify AI service errors', () => {
      const error = new AIServiceError('OpenAI service unavailable')
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('ai_service')
      expect(info.userMessage).toContain('AI service')
      expect(info.canRetry).toBe(true)
      expect(info.suggestedAction).toContain('guided form')
    })

    it('should identify database errors', () => {
      const error = new DatabaseError('save', new Error('IndexedDB failed'))
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('database')
      expect(info.userMessage).toContain('save your data')
      expect(info.canRetry).toBe(true)
      expect(info.suggestedAction).toContain('connection is restored')
    })

    it('should identify validation errors', () => {
      const error = new ValidationError('Age must be between 10 and 100')
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('validation')
      expect(info.userMessage).toContain('valid age')
      expect(info.canRetry).toBe(false)
      expect(info.suggestedAction).toContain('correct the highlighted fields')
    })

    it('should provide default for unknown errors', () => {
      const error = new Error('Unknown issue')
      const info = analyzeError(error)
      
      expect(info.errorType).toBe('unknown')
      expect(info.userMessage).toContain('Something went wrong')
      expect(info.canRetry).toBe(true)
      expect(info.suggestedAction).toContain('Try again')
    })
  })

  describe('getRecoveryActions', () => {
    it('should provide network error recovery actions', () => {
      const errorInfo = {
        error: new Error('Network failed'),
        errorType: 'network' as const,
        userMessage: 'Connection failed',
        canRetry: true
      }
      
      const actions = getRecoveryActions(errorInfo)
      
      expect(actions).toHaveLength(2)
      expect(actions[0].label).toBe('Try Again')
      expect(actions[0].primary).toBe(true)
      expect(actions[1].label).toBe('Check Connection')
    })

    it('should provide offline error recovery actions', () => {
      const errorInfo = {
        error: new Error('Offline'),
        errorType: 'offline' as const,
        userMessage: 'You are offline',
        canRetry: false
      }
      
      const actions = getRecoveryActions(errorInfo)
      
      expect(actions).toHaveLength(2)
      expect(actions[0].label).toBe('Continue Offline')
      expect(actions[0].primary).toBe(true)
      expect(actions[1].label).toBe('Refresh When Online')
    })

    it('should provide AI service error recovery actions', () => {
      const errorInfo = {
        error: new Error('AI unavailable'),
        errorType: 'ai_service' as const,
        userMessage: 'AI service unavailable',
        canRetry: true
      }
      
      const actions = getRecoveryActions(errorInfo)
      
      expect(actions).toHaveLength(2)
      expect(actions[0].label).toBe('Use Guided Form')
      expect(actions[0].primary).toBe(true)
      expect(actions[1].label).toBe('Try AI Later')
    })

    it('should provide validation error recovery actions', () => {
      const errorInfo = {
        error: new Error('Invalid input'),
        errorType: 'validation' as const,
        userMessage: 'Invalid input',
        canRetry: false
      }
      
      const actions = getRecoveryActions(errorInfo)
      
      expect(actions).toHaveLength(1)
      expect(actions[0].label).toBe('Fix Errors')
      expect(actions[0].primary).toBe(true)
    })
  })

  describe('NetworkStatusMonitor', () => {
    let monitor: NetworkStatusMonitor

    beforeEach(() => {
      monitor = new NetworkStatusMonitor()
    })

    afterEach(() => {
      // Clean up event listeners
      window.removeEventListener('online', () => {})
      window.removeEventListener('offline', () => {})
    })

    it('should initialize with current online status', () => {
      navigator.onLine = true
      const onlineMonitor = new NetworkStatusMonitor()
      expect(onlineMonitor.getStatus()).toBe(true)

      navigator.onLine = false
      const offlineMonitor = new NetworkStatusMonitor()
      expect(offlineMonitor.getStatus()).toBe(false)
    })

    it('should notify listeners on status change', () => {
      const listener = vi.fn()
      monitor.onStatusChange(listener)
      
      // Simulate going offline
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
      
      expect(listener).toHaveBeenCalledWith(false)
    })

    it('should notify listeners on coming back online', () => {
      const listener = vi.fn()
      monitor.onStatusChange(listener)
      
      // Simulate coming back online
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))
      
      expect(listener).toHaveBeenCalledWith(true)
    })

    it('should return unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = monitor.onStatusChange(listener)
      
      // Unsubscribe
      unsubscribe()
      
      // Simulate offline event
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))
      
      // Listener should not be called
      expect(listener).not.toHaveBeenCalled()
    })

    it('should check connectivity via API', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true
      } as Response)
      
      navigator.onLine = true
      const isConnected = await monitor.checkConnectivity()
      
      expect(isConnected).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
    })

    it('should return false for connectivity check when offline', async () => {
      // Create a fresh monitor with offline status
      navigator.onLine = false
      const offlineMonitor = new NetworkStatusMonitor()
      const isConnected = await offlineMonitor.checkConnectivity()
      
      expect(isConnected).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should return false for connectivity check on API failure', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      navigator.onLine = true
      const isConnected = await monitor.checkConnectivity()
      
      expect(isConnected).toBe(false)
    })
  })

  describe('OfflineStorage', () => {
    let storage: OfflineStorage

    beforeEach(() => {
      storage = new OfflineStorage()
      localStorageMock.getItem.mockReturnValue('{}')
    })

    it('should save data to offline storage', () => {
      storage.saveData('test_key', { value: 'test_data' })
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_data',
        expect.stringContaining('test_key')
      )
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData.test_key).toEqual({
        data: { value: 'test_data' },
        timestamp: expect.any(Number),
        synced: false
      })
    })

    it('should retrieve data from offline storage', () => {
      const mockData = {
        test_key: {
          data: { value: 'test_data' },
          timestamp: Date.now(),
          synced: false
        }
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData))
      
      const data = storage.getData('test_key')
      
      expect(data).toEqual({ value: 'test_data' })
    })

    it('should return null for non-existent data', () => {
      localStorageMock.getItem.mockReturnValue('{}')
      
      const data = storage.getData('non_existent')
      
      expect(data).toBeNull()
    })

    it('should mark data as synced', () => {
      const mockData = {
        test_key: {
          data: { value: 'test_data' },
          timestamp: Date.now(),
          synced: false
        }
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData))
      
      storage.markSynced('test_key')
      
      expect(localStorageMock.setItem).toHaveBeenCalled()
      const updatedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(updatedData.test_key.synced).toBe(true)
    })

    it('should get unsynced data', () => {
      const mockData = {
        synced_key: {
          data: { value: 'synced' },
          timestamp: Date.now(),
          synced: true
        },
        unsynced_key: {
          data: { value: 'unsynced' },
          timestamp: Date.now(),
          synced: false
        }
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData))
      
      const unsyncedData = storage.getUnsyncedData()
      
      expect(unsyncedData).toEqual({
        unsynced_key: { value: 'unsynced' }
      })
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Should not throw
      expect(() => storage.getData('test_key')).not.toThrow()
      expect(storage.getData('test_key')).toBeNull()
    })

    it('should handle JSON parsing errors gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      // Should not throw
      expect(() => storage.getData('test_key')).not.toThrow()
      expect(storage.getData('test_key')).toBeNull()
    })
  })
})