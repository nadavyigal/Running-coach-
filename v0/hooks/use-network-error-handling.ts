"use client"

import { useState, useEffect, useCallback } from 'react'
import { 
  networkStatus, 
  offlineStorage, 
  NetworkError, 
  OfflineError 
} from '@/lib/errorHandling'
import { retryApiCall, aiServiceCircuitBreaker } from '@/lib/retryMechanism'
import { useErrorToast } from '@/components/error-toast'

export interface NetworkErrorHandlingConfig {
  enableOfflineMode?: boolean
  enableAutoRetry?: boolean
  maxRetries?: number
  showToasts?: boolean
  fallbackToOfflineStorage?: boolean
}

export function useNetworkErrorHandling(config: NetworkErrorHandlingConfig = {}) {
  const {
    enableOfflineMode = true,
    showToasts = true,
    fallbackToOfflineStorage = true
  } = config

  const [isOnline, setIsOnline] = useState(networkStatus.getStatus())
  const [isConnected, setIsConnected] = useState(true)
  const [lastOfflineTime, setLastOfflineTime] = useState<Date | null>(null)
  const { showError, showWarning, showSuccess } = useErrorToast()

  // Monitor network status
  useEffect(() => {
    const unsubscribe = networkStatus.onStatusChange((online) => {
      setIsOnline(online)
      
      if (!online) {
        setLastOfflineTime(new Date())
        if (showToasts) {
          showWarning('Connection Lost', 'Working in offline mode')
        }
      } else {
        if (lastOfflineTime && showToasts) {
          const offlineDuration = Date.now() - lastOfflineTime.getTime()
          const minutes = Math.floor(offlineDuration / 60000)
          showSuccess(
            'Connection Restored', 
            minutes > 0 ? `Was offline for ${minutes} minutes` : 'Back online'
          )
        }
        setLastOfflineTime(null)
        
        // Sync offline data when back online
        if (fallbackToOfflineStorage) {
          syncOfflineData()
        }
      }
    })

    // Check actual connectivity periodically
    const connectivityCheck = setInterval(async () => {
      const connected = await networkStatus.checkConnectivity()
      setIsConnected(connected)
    }, 30000) // Check every 30 seconds

    return () => {
      unsubscribe()
      clearInterval(connectivityCheck)
    }
  }, [lastOfflineTime, showToasts, showWarning, showSuccess, fallbackToOfflineStorage])

  // Sync offline data when connection is restored
  const syncOfflineData = useCallback(async () => {
    if (!fallbackToOfflineStorage) return

    try {
      const unsyncedData = offlineStorage.getUnsyncedData()
      const keys = Object.keys(unsyncedData)
      
      if (keys.length === 0) return

      if (showToasts) {
        showWarning(`Syncing ${keys.length} offline changes...`)
      }

      let syncCount = 0
      for (const key of keys) {
        try {
          // Here you would implement actual sync logic
          // For now, just mark as synced after a delay
          await new Promise(resolve => setTimeout(resolve, 1000))
          offlineStorage.markSynced(key)
          syncCount++
        } catch (error) {
          console.warn(`Failed to sync ${key}:`, error)
        }
      }

      if (showToasts && syncCount > 0) {
        showSuccess(`Synced ${syncCount} offline changes`)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      if (showToasts) {
        showError(error as Error)
      }
    }
  }, [fallbackToOfflineStorage, showToasts, showWarning, showSuccess, showError])

  // Wrapped API call with network error handling
  const safeApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options: {
      operation: string
      service: string
      onboardingStep?: string
      fallbackData?: T
      saveOffline?: boolean
    }
  ): Promise<T> => {
    const { operation, service, onboardingStep, fallbackData, saveOffline = true } = options

    // Check if offline and offline mode is enabled
    if (!isOnline && enableOfflineMode) {
      if (fallbackToOfflineStorage && saveOffline) {
        const offlineData = offlineStorage.getData(operation) as T
        if (offlineData) {
          return offlineData
        }
      }
      
      if (fallbackData) {
        return fallbackData
      }
      
      throw new OfflineError(`Cannot perform ${operation} while offline`)
    }

    // Check connectivity
    if (!isConnected) {
      throw new NetworkError(`No connection available for ${operation}`)
    }

    try {
      // Use circuit breaker for AI service calls
      if (service.toLowerCase().includes('ai') || service.toLowerCase().includes('openai')) {
        return await aiServiceCircuitBreaker.execute(async () => {
          return await retryApiCall(apiCall, {
            operation,
            service,
            ...(typeof onboardingStep === 'string' ? { onboardingStep } : {})
          })
        })
      }

      // Regular API call with retry
      return await retryApiCall(apiCall, {
        operation,
        service,
        ...(typeof onboardingStep === 'string' ? { onboardingStep } : {})
      })
    } catch (error) {
      // Save to offline storage if enabled and operation failed
      if (fallbackToOfflineStorage && saveOffline && fallbackData) {
        offlineStorage.saveData(operation, fallbackData)
      }
      
      throw error
    }
  }, [isOnline, isConnected, enableOfflineMode, fallbackToOfflineStorage])

  // Check if operation should be allowed offline
  const canOperateOffline = useCallback((operation: string): boolean => {
    const offlineOperations = [
      'save_progress',
      'read_data',
      'validate_form',
      'local_storage'
    ]
    
    return enableOfflineMode && offlineOperations.some(op => 
      operation.toLowerCase().includes(op)
    )
  }, [enableOfflineMode])

  // Get network status info
  const getNetworkInfo = useCallback(() => {
    return {
      isOnline,
      isConnected,
      lastOfflineTime,
      canOperateOffline: enableOfflineMode,
      hasOfflineData: fallbackToOfflineStorage && 
        Object.keys(offlineStorage.getUnsyncedData()).length > 0
    }
  }, [isOnline, isConnected, lastOfflineTime, enableOfflineMode, fallbackToOfflineStorage])

  return {
    isOnline,
    isConnected,
    lastOfflineTime,
    safeApiCall,
    canOperateOffline,
    getNetworkInfo,
    syncOfflineData,
    // Direct access to utilities
    offlineStorage,
    networkStatus
  }
}
