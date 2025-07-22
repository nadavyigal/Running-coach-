/**
 * Onboarding State Diagnostics Utility
 * 
 * This utility helps diagnose and resolve conflicts between IndexedDB and localStorage
 * onboarding states that can prevent users from accessing the application.
 */

import { dbUtils, type User, db } from './db'

export interface OnboardingDiagnosticReport {
  indexedDBState: {
    hasUser: boolean
    userId?: number
    username?: string
    onboardingComplete: boolean
    hasPlan: boolean
    userCreatedAt?: Date
  }
  localStorageState: {
    hasOnboardingFlag: boolean
    onboardingValue: string | null
  }
  conflictStatus: {
    hasConflict: boolean
    description: string
    recommendation: 'reset_all' | 'complete_onboarding' | 'migrate_data' | 'no_action'
  }
  timestamp: Date
}

/**
 * Generates comprehensive diagnostic report of onboarding state
 */
export async function diagnoseOnboardingState(): Promise<OnboardingDiagnosticReport> {
  const report: OnboardingDiagnosticReport = {
    indexedDBState: {
      hasUser: false,
      onboardingComplete: false,
      hasPlan: false
    },
    localStorageState: {
      hasOnboardingFlag: false,
      onboardingValue: null
    },
    conflictStatus: {
      hasConflict: false,
      description: '',
      recommendation: 'no_action'
    },
    timestamp: new Date()
  }

  try {
    // Check IndexedDB state
    const user = await dbUtils.getCurrentUser()
    if (user) {
      report.indexedDBState = {
        hasUser: true,
        userId: user.id,
        username: user.name,
        onboardingComplete: user.onboardingComplete || false,
        hasPlan: false, // Will be set below
        userCreatedAt: user.createdAt
      }

      // Check if user has an active plan
      try {
        const activePlan = await dbUtils.getActivePlan()
        report.indexedDBState.hasPlan = !!activePlan
      } catch (e) {
        report.indexedDBState.hasPlan = false
      }
    }

    // Check localStorage state
    const localStorageFlag = localStorage.getItem('onboarding-complete')
    report.localStorageState = {
      hasOnboardingFlag: localStorageFlag !== null,
      onboardingValue: localStorageFlag
    }

    // Analyze conflicts and provide recommendations
    const { hasUser, onboardingComplete, hasPlan } = report.indexedDBState
    const { hasOnboardingFlag, onboardingValue } = report.localStorageState

    // Determine conflict status
    if (hasUser && onboardingComplete && hasPlan) {
      // Ideal state - user exists, onboarding complete, has plan
      report.conflictStatus = {
        hasConflict: false,
        description: 'Onboarding completed successfully. User has profile and active plan.',
        recommendation: 'no_action'
      }
    } else if (hasUser && !onboardingComplete && hasOnboardingFlag && onboardingValue === 'true') {
      // Conflict: localStorage says complete but IndexedDB says incomplete
      report.conflictStatus = {
        hasConflict: true,
        description: 'Conflict detected: localStorage indicates onboarding complete but IndexedDB user has onboardingComplete: false',
        recommendation: hasPlan ? 'complete_onboarding' : 'migrate_data'
      }
    } else if (!hasUser && hasOnboardingFlag && onboardingValue === 'true') {
      // Conflict: localStorage says complete but no user in IndexedDB
      report.conflictStatus = {
        hasConflict: true,
        description: 'Conflict detected: localStorage indicates onboarding complete but no user found in IndexedDB',
        recommendation: 'reset_all'
      }
    } else if (hasUser && onboardingComplete && !hasPlan) {
      // Incomplete state: user marked complete but no plan
      report.conflictStatus = {
        hasConflict: true,
        description: 'Incomplete onboarding: User marked as complete but has no active plan',
        recommendation: 'complete_onboarding'
      }
    } else if (hasUser && !onboardingComplete && !hasOnboardingFlag) {
      // Normal incomplete state
      report.conflictStatus = {
        hasConflict: false,
        description: 'Onboarding in progress or not started. This is normal for new users.',
        recommendation: 'no_action'
      }
    } else {
      // Other edge cases
      report.conflictStatus = {
        hasConflict: true,
        description: 'Unknown onboarding state configuration detected',
        recommendation: 'reset_all'
      }
    }

  } catch (error) {
    report.conflictStatus = {
      hasConflict: true,
      description: `Error during diagnosis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendation: 'reset_all'
    }
  }

  return report
}

/**
 * Resets all onboarding-related data to provide clean slate
 */
export async function resetOnboardingState(): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear localStorage onboarding flag
    localStorage.removeItem('onboarding-complete')
    
    // Clear any other legacy localStorage keys
    localStorage.removeItem('user-profile')
    localStorage.removeItem('user-preferences')
    
    // Clear all IndexedDB tables to start fresh
    await db.transaction('rw', db.users, db.plans, db.workouts, db.runs, db.chatMessages, db.badges, db.cohorts, async () => {
      await db.users.clear()
      await db.plans.clear()
      await db.workouts.clear()
      await db.runs.clear()
      await db.chatMessages.clear()
      await db.badges.clear()
      await db.cohorts.clear()
    })
    
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during reset'
    }
  }
}

/**
 * Attempts to complete onboarding for existing user with incomplete state
 */
export async function completeOnboardingState(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await dbUtils.getCurrentUser()
    if (!user) {
      return { success: false, error: 'No user found to complete onboarding for' }
    }

    // Update user onboarding status
    await dbUtils.updateUser(user.id!, { onboardingComplete: true })
    
    // Clear localStorage flag to prevent future conflicts
    localStorage.removeItem('onboarding-complete')
    
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during completion'
    }
  }
}

/**
 * Migrates data from localStorage to IndexedDB and completes onboarding
 */
export async function migrateAndCompleteOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    // First try to complete existing user
    const completeResult = await completeOnboardingState()
    if (completeResult.success) {
      return completeResult
    }

    // If no user exists, reset everything for clean start
    return await resetOnboardingState()
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during migration'
    }
  }
}

/**
 * Auto-fixes onboarding state based on diagnostic recommendations
 */
export async function autoFixOnboardingState(): Promise<{ success: boolean; error?: string; action: string }> {
  const report = await diagnoseOnboardingState()
  
  switch (report.conflictStatus.recommendation) {
    case 'reset_all':
      const resetResult = await resetOnboardingState()
      return { ...resetResult, action: 'reset_all' }
      
    case 'complete_onboarding':
      const completeResult = await completeOnboardingState()
      return { ...completeResult, action: 'complete_onboarding' }
      
    case 'migrate_data':
      const migrateResult = await migrateAndCompleteOnboarding()
      return { ...migrateResult, action: 'migrate_data' }
      
    case 'no_action':
    default:
      return { success: true, action: 'no_action' }
  }
}

/**
 * Logs diagnostic report to console in readable format
 */
export function logDiagnosticReport(report: OnboardingDiagnosticReport): void {
  console.group('🔍 Onboarding State Diagnostic Report')
  console.log('Timestamp:', report.timestamp.toISOString())
  
  console.group('📊 IndexedDB State')
  console.log('Has User:', report.indexedDBState.hasUser)
  if (report.indexedDBState.hasUser) {
    console.log('User ID:', report.indexedDBState.userId)
    console.log('Username:', report.indexedDBState.username)
    console.log('Onboarding Complete:', report.indexedDBState.onboardingComplete)
    console.log('Has Plan:', report.indexedDBState.hasPlan)
    console.log('Created At:', report.indexedDBState.userCreatedAt)
  }
  console.groupEnd()
  
  console.group('💾 localStorage State')
  console.log('Has Onboarding Flag:', report.localStorageState.hasOnboardingFlag)
  console.log('Onboarding Value:', report.localStorageState.onboardingValue)
  console.groupEnd()
  
  console.group('⚠️ Conflict Analysis')
  console.log('Has Conflict:', report.conflictStatus.hasConflict)
  console.log('Description:', report.conflictStatus.description)
  console.log('Recommendation:', report.conflictStatus.recommendation)
  console.groupEnd()
  
  console.groupEnd()
}