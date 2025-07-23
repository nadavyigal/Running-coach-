"use client"

import { useCallback } from 'react'
import { db } from '@/lib/db'
import { retryDbOperation, databaseCircuitBreaker } from '@/lib/retryMechanism'
import { DatabaseError, offlineStorage } from '@/lib/errorHandling'
import { useErrorToast } from '@/components/error-toast'

export interface DatabaseOperation<T> {
  operation: () => Promise<T>
  operationName: string
  fallbackData?: T
  saveToOfflineStorage?: boolean
  critical?: boolean
}

export function useDatabaseErrorHandling() {
  const { showError, showWarning, showSuccess } = useErrorToast()

  // Safe database operation wrapper
  const safeDbOperation = useCallback(async <T>({
    operation,
    operationName,
    fallbackData,
    saveToOfflineStorage = true,
    critical = false
  }: DatabaseOperation<T>): Promise<T> => {
    try {
      // Use circuit breaker for database operations
      return await databaseCircuitBreaker.execute(async () => {
        return await retryDbOperation(operation, operationName)
      })
    } catch (error) {
      const dbError = error as Error
      
      // Handle different types of database errors
      if (isDatabaseQuotaError(dbError)) {
        showWarning(
          'Storage Full',
          'Your device storage is full. Please free up some space.'
        )
        
        // Try to clean up old data
        try {
          await cleanupOldData()
          showSuccess('Cleaned up storage', 'Please try again')
        } catch (cleanupError) {
          console.error('Failed to cleanup storage:', cleanupError)
        }
      } else if (isDatabaseConnectionError(dbError)) {
        showWarning(
          'Database Connection Error',
          'Having trouble accessing local storage. Your data will be saved when possible.'
        )
      } else if (critical) {
        showError(dbError, {
          onRetry: () => safeDbOperation({
            operation,
            operationName,
            fallbackData,
            saveToOfflineStorage,
            critical
          })
        })
      } else {
        console.warn(`Non-critical database operation failed: ${operationName}`, dbError)
      }

      // Save to offline storage as fallback
      if (saveToOfflineStorage && fallbackData) {
        try {
          offlineStorage.saveData(operationName, fallbackData)
          console.log(`Saved ${operationName} to offline storage`)
        } catch (offlineError) {
          console.error('Failed to save to offline storage:', offlineError)
        }
      }

      // Return fallback data or throw error
      if (fallbackData !== undefined) {
        return fallbackData
      }
      
      throw dbError
    }
  }, [showError, showWarning, showSuccess])

  // User operations with error handling
  const saveUser = useCallback(async (userData: Parameters<typeof db.users.add>[0]) => {
    return safeDbOperation({
      operation: () => db.users.add(userData),
      operationName: 'save_user',
      fallbackData: userData,
      critical: true
    })
  }, [safeDbOperation])

  const updateUser = useCallback(async (id: number, updates: Partial<Parameters<typeof db.users.add>[0]>) => {
    return safeDbOperation({
      operation: () => db.users.update(id, updates),
      operationName: 'update_user',
      fallbackData: 1, // Return success indicator
      critical: true
    })
  }, [safeDbOperation])

  const getUser = useCallback(async (id?: number) => {
    return safeDbOperation({
      operation: async () => {
        if (id) {
          return await db.users.get(id)
        } else {
          const users = await db.users.toArray()
          return users[0] || null
        }
      },
      operationName: 'get_user',
      critical: false
    })
  }, [safeDbOperation])

  // Plan operations with error handling
  const savePlan = useCallback(async (planData: Parameters<typeof db.plans.add>[0]) => {
    return safeDbOperation({
      operation: () => db.plans.add(planData),
      operationName: 'save_plan',
      fallbackData: planData,
      critical: true
    })
  }, [safeDbOperation])

  const updatePlan = useCallback(async (id: number, updates: Partial<Parameters<typeof db.plans.add>[0]>) => {
    return safeDbOperation({
      operation: () => db.plans.update(id, updates),
      operationName: 'update_plan',
      fallbackData: 1,
      critical: true
    })
  }, [safeDbOperation])

  const getPlan = useCallback(async (id: number) => {
    return safeDbOperation({
      operation: () => db.plans.get(id),
      operationName: 'get_plan',
      critical: false
    })
  }, [safeDbOperation])

  // Workout operations with error handling
  const saveWorkout = useCallback(async (workoutData: Parameters<typeof db.workouts.add>[0]) => {
    return safeDbOperation({
      operation: () => db.workouts.add(workoutData),
      operationName: 'save_workout',
      fallbackData: workoutData,
      critical: true
    })
  }, [safeDbOperation])

  const updateWorkout = useCallback(async (id: number, updates: Partial<Parameters<typeof db.workouts.add>[0]>) => {
    return safeDbOperation({
      operation: () => db.workouts.update(id, updates),
      operationName: 'update_workout',
      fallbackData: 1,
      critical: true
    })
  }, [safeDbOperation])

  // Run operations with error handling
  const saveRun = useCallback(async (runData: Parameters<typeof db.runs.add>[0]) => {
    return safeDbOperation({
      operation: () => db.runs.add(runData),
      operationName: 'save_run',
      fallbackData: runData,
      critical: true
    })
  }, [safeDbOperation])

  const updateRun = useCallback(async (id: number, updates: Partial<Parameters<typeof db.runs.add>[0]>) => {
    return safeDbOperation({
      operation: () => db.runs.update(id, updates),
      operationName: 'update_run',
      fallbackData: 1,
      critical: true
    })
  }, [safeDbOperation])

  // Chat message operations
  const saveChatMessage = useCallback(async (messageData: Parameters<typeof db.chatMessages.add>[0]) => {
    return safeDbOperation({
      operation: () => db.chatMessages.add(messageData),
      operationName: 'save_chat_message',
      fallbackData: messageData,
      critical: false
    })
  }, [safeDbOperation])

  // Badge operations
  const saveBadge = useCallback(async (badgeData: Parameters<typeof db.badges.add>[0]) => {
    return safeDbOperation({
      operation: () => db.badges.add(badgeData),
      operationName: 'save_badge',
      fallbackData: badgeData,
      critical: false
    })
  }, [safeDbOperation])

  // Database health check
  const checkDatabaseHealth = useCallback(async (): Promise<{
    isHealthy: boolean
    canRead: boolean
    canWrite: boolean
    error?: string
  }> => {
    try {
      // Test read operation
      await db.users.limit(1).toArray()
      const canRead = true

      // Test write operation
      const testData = {
        id: 999999, // Use high ID to avoid conflicts
        name: 'test',
        email: 'test@test.com',
        age: 25,
        experience: 'beginner' as const,
        goal: 'habit' as const,
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        onboardingComplete: false,
        currentStreak: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await db.users.add(testData)
      await db.users.delete(999999) // Clean up test data
      const canWrite = true

      return { isHealthy: true, canRead, canWrite }
    } catch (error) {
      return {
        isHealthy: false,
        canRead: false,
        canWrite: false,
        error: (error as Error).message
      }
    }
  }, [])

  // Recovery operations
  const recoverFromDatabaseError = useCallback(async () => {
    try {
      // Try to clear corrupted data
      await db.delete()
      await db.open()
      
      // Restore from offline storage if available
      const offlineData = offlineStorage.getUnsyncedData()
      let restoredCount = 0
      
      for (const [key, data] of Object.entries(offlineData)) {
        try {
          if (key.includes('user') && data) {
            await db.users.add(data as Parameters<typeof db.users.add>[0])
            restoredCount++
          } else if (key.includes('plan') && data) {
            await db.plans.add(data as Parameters<typeof db.plans.add>[0])
            restoredCount++
          }
          // Add more recovery logic as needed
        } catch (restoreError) {
          console.warn(`Failed to restore ${key}:`, restoreError)
        }
      }
      
      if (restoredCount > 0) {
        showSuccess(
          'Database Recovered',
          `Restored ${restoredCount} items from backup`
        )
      } else {
        showSuccess('Database Reset', 'Storage has been cleared and reset')
      }
      
      return true
    } catch (error) {
      showError(error as Error)
      return false
    }
  }, [showError, showSuccess])

  return {
    // Safe operations
    safeDbOperation,
    
    // Entity operations
    saveUser,
    updateUser,
    getUser,
    savePlan,
    updatePlan,
    getPlan,
    saveWorkout,
    updateWorkout,
    saveRun,
    updateRun,
    saveChatMessage,
    saveBadge,
    
    // Health and recovery
    checkDatabaseHealth,
    recoverFromDatabaseError,
    
    // Direct database access (use with caution)
    db
  }
}

// Utility functions for error detection
function isDatabaseQuotaError(error: Error): boolean {
  const quotaMessages = [
    'quota',
    'storage',
    'space',
    'disk full',
    'insufficient storage'
  ]
  
  return quotaMessages.some(msg => 
    error.message.toLowerCase().includes(msg)
  )
}

function isDatabaseConnectionError(error: Error): boolean {
  const connectionMessages = [
    'connection',
    'database',
    'indexeddb',
    'transaction',
    'blocked',
    'version'
  ]
  
  return connectionMessages.some(msg => 
    error.message.toLowerCase().includes(msg)
  )
}

// Cleanup old data to free space
async function cleanupOldData(): Promise<void> {
  try {
    // Delete old runs (keep last 100)
    const oldRuns = await db.runs
      .orderBy('createdAt')
      .reverse()
      .offset(100)
      .toArray()
    
    if (oldRuns.length > 0) {
      const idsToDelete = oldRuns.map(run => run.id!).filter(id => id !== undefined)
      await db.runs.bulkDelete(idsToDelete)
    }

    // Delete old chat messages (keep last 500)
    const oldMessages = await db.chatMessages
      .orderBy('createdAt')
      .reverse()
      .offset(500)
      .toArray()
    
    if (oldMessages.length > 0) {
      const idsToDelete = oldMessages.map(msg => msg.id!).filter(id => id !== undefined)
      await db.chatMessages.bulkDelete(idsToDelete)
    }

    console.log('Database cleanup completed')
  } catch (error) {
    console.error('Database cleanup failed:', error)
    throw error
  }
}