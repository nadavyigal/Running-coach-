'use client'

import { getDeviceId } from '@/lib/userMemory'
import { createClient } from '@/lib/supabase/client'
import { performInitialSync, hasCompletedInitialSync } from '@/lib/sync/initial-sync'
import { logger } from '@/lib/logger'
import { trackAuthEvent } from '@/lib/analytics'

/**
 * Links device_id users to authenticated accounts and performs initial data sync
 * This is called after successful signup/login to migrate existing local data
 */
export async function linkDeviceToUser(profileId: string): Promise<void> {
  logger.info('[Migration] Starting device migration for profile:', profileId)

  // Check if migration already completed
  if (hasCompletedMigration()) {
    logger.info('[Migration] Migration already completed, skipping')
    return
  }

  try {
    const deviceId = getDeviceId()
    if (!deviceId) {
      logger.warn('[Migration] No device ID found, skipping device linking')
      // Still perform initial sync even without device_id
      await performInitialSync(profileId)
      markMigrationComplete(profileId)
      return
    }

    const supabase = createClient()

    // Link device_id to authenticated user in user_memory_snapshots
    logger.info('[Migration] Linking device_id to profile:', deviceId)

    const { error: updateError } = await supabase
      .from('user_memory_snapshots')
      .update({ user_id: profileId })
      .eq('device_id', deviceId)

    if (updateError) {
      logger.warn('[Migration] Failed to link device_id to profile:', updateError)
      // Continue with sync even if device linking fails
    } else {
      logger.info('[Migration] Successfully linked device_id to profile')
    }

    // Perform initial sync of all local data if not already done
    if (!hasCompletedInitialSync()) {
      logger.info('[Migration] Performing initial sync of local data')
      await performInitialSync(profileId)
    } else {
      logger.info('[Migration] Initial sync already completed')
    }

    // Mark migration complete
    markMigrationComplete(profileId)

    // Track migration event
    await trackAuthEvent('migration')

    logger.info('[Migration] Device migration completed successfully')
  } catch (error) {
    logger.error('[Migration] Device migration failed:', error)
    throw error
  }
}

/**
 * Checks if device migration has been completed
 */
export function hasCompletedMigration(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return localStorage.getItem('device_migration_complete') === 'true'
  } catch (error) {
    logger.warn('[Migration] Failed to check migration status:', error)
    return false
  }
}

/**
 * Marks device migration as complete in localStorage
 */
function markMigrationComplete(profileId: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('device_migration_complete', 'true')
    localStorage.setItem('linked_profile_id', profileId)
    localStorage.setItem('migration_timestamp', new Date().toISOString())
    logger.info('[Migration] Marked migration as complete')
  } catch (error) {
    logger.warn('[Migration] Failed to mark migration complete:', error)
  }
}

/**
 * Gets the linked profile ID from localStorage
 */
export function getLinkedProfileId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return localStorage.getItem('linked_profile_id')
  } catch (error) {
    logger.warn('[Migration] Failed to get linked profile ID:', error)
    return null
  }
}

/**
 * Resets migration status (useful for testing)
 */
export function resetMigrationStatus(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem('device_migration_complete')
    localStorage.removeItem('linked_profile_id')
    localStorage.removeItem('migration_timestamp')
    localStorage.removeItem('initial_sync_complete')
    localStorage.removeItem('initial_sync_timestamp')
    logger.info('[Migration] Reset migration status')
  } catch (error) {
    logger.warn('[Migration] Failed to reset migration status:', error)
  }
}
