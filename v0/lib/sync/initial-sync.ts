'use client'

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { trackSyncEvent } from '@/lib/analytics'
import type { Run, Goal, Shoe } from '@/lib/db'

const CHUNK_SIZE = 100

/**
 * Performs initial sync of all local data to Supabase for first-time authentication
 * This uploads ALL existing data from IndexedDB to the cloud
 */
export async function performInitialSync(profileId: string): Promise<void> {
  logger.info('[InitialSync] Starting initial sync for profile:', profileId)
  await trackSyncEvent('sync_started')

  try {
    const supabase = createClient()

    // Get all local data
    const runs = await db.runs.toArray()
    const goals = await db.goals.toArray()
    const shoes = await db.shoes.toArray()

    logger.info('[InitialSync] Found local data:', {
      runs: runs.length,
      goals: goals.length,
      shoes: shoes.length,
    })

    let totalSynced = 0

    // Upload runs in batches
    if (runs.length > 0) {
      const runCount = await syncRunsBatch(supabase, profileId, runs)
      totalSynced += runCount
      logger.info(`[InitialSync] Synced ${runCount} runs`)
    }

    // Upload goals in batches
    if (goals.length > 0) {
      const goalCount = await syncGoalsBatch(supabase, profileId, goals)
      totalSynced += goalCount
      logger.info(`[InitialSync] Synced ${goalCount} goals`)
    }

    // Upload shoes in batches
    if (shoes.length > 0) {
      const shoeCount = await syncShoesBatch(supabase, profileId, shoes)
      totalSynced += shoeCount
      logger.info(`[InitialSync] Synced ${shoeCount} shoes`)
    }

    // Mark initial sync complete
    markInitialSyncComplete()

    logger.info(`[InitialSync] Initial sync completed successfully. Total records: ${totalSynced}`)
    await trackSyncEvent('sync_completed', totalSynced)
  } catch (error) {
    logger.error('[InitialSync] Initial sync failed:', error)
    await trackSyncEvent('sync_failed')
    throw error
  }
}

async function syncRunsBatch(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  runs: Run[]
): Promise<number> {
  let synced = 0

  for (let i = 0; i < runs.length; i += CHUNK_SIZE) {
    const chunk = runs.slice(i, i + CHUNK_SIZE)
    const runsToSync = chunk.map((run) => mapRunToSupabase(run, profileId))

    const { error } = await supabase
      .from('runs')
      .upsert(runsToSync, {
        onConflict: 'profile_id,local_id',
        ignoreDuplicates: false,
      })

    if (error) {
      logger.error('[InitialSync] Error syncing runs chunk:', error)
      throw error
    }

    synced += chunk.length
    logger.info(`[InitialSync] Progress: ${synced}/${runs.length} runs`)
  }

  return synced
}

async function syncGoalsBatch(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  goals: Goal[]
): Promise<number> {
  let synced = 0

  for (let i = 0; i < goals.length; i += CHUNK_SIZE) {
    const chunk = goals.slice(i, i + CHUNK_SIZE)
    const goalsToSync = chunk.map((goal) => mapGoalToSupabase(goal, profileId))

    const { error } = await supabase
      .from('goals')
      .upsert(goalsToSync, {
        onConflict: 'profile_id,local_id',
        ignoreDuplicates: false,
      })

    if (error) {
      logger.error('[InitialSync] Error syncing goals chunk:', error)
      throw error
    }

    synced += chunk.length
    logger.info(`[InitialSync] Progress: ${synced}/${goals.length} goals`)
  }

  return synced
}

async function syncShoesBatch(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  shoes: Shoe[]
): Promise<number> {
  let synced = 0

  for (let i = 0; i < shoes.length; i += CHUNK_SIZE) {
    const chunk = shoes.slice(i, i + CHUNK_SIZE)
    const shoesToSync = chunk.map((shoe) => mapShoeToSupabase(shoe, profileId))

    const { error } = await supabase
      .from('shoes')
      .upsert(shoesToSync, {
        onConflict: 'profile_id,local_id',
        ignoreDuplicates: false,
      })

    if (error) {
      logger.error('[InitialSync] Error syncing shoes chunk:', error)
      throw error
    }

    synced += chunk.length
    logger.info(`[InitialSync] Progress: ${synced}/${shoes.length} shoes`)
  }

  return synced
}

function mapRunToSupabase(run: Run, profileId: string) {
  return {
    profile_id: profileId,
    local_id: run.id,
    type: run.type,
    distance: run.distance,
    duration: run.duration,
    pace: run.pace || null,
    heart_rate: run.heartRate || null,
    calories: run.calories || null,
    notes: run.notes || null,
    route: run.gpsPath ? JSON.parse(run.gpsPath) : null,
    gps_accuracy_data: run.gpsAccuracyData ? JSON.parse(run.gpsAccuracyData) : null,
    start_accuracy: run.startAccuracy || null,
    end_accuracy: run.endAccuracy || null,
    average_accuracy: run.averageAccuracy || null,
    run_report: run.runReport ? JSON.parse(run.runReport) : null,
    run_report_source: run.runReportSource || null,
    completed_at: run.completedAt.toISOString(),
    created_at: run.createdAt.toISOString(),
    updated_at: run.updatedAt ? run.updatedAt.toISOString() : run.createdAt.toISOString(),
    last_synced_at: new Date().toISOString(),
  }
}

function mapGoalToSupabase(goal: Goal, profileId: string) {
  return {
    profile_id: profileId,
    local_id: goal.id,
    title: goal.title,
    description: goal.description || null,
    goal_type: goal.goalType,
    category: goal.category,
    priority: goal.priority,
    status: goal.status,
    baseline_value: goal.baselineValue,
    target_value: goal.targetValue,
    current_value: goal.currentValue,
    progress_percentage: goal.progressPercentage,
    is_primary: goal.isPrimary || false,
    created_at: goal.createdAt.toISOString(),
    updated_at: goal.updatedAt.toISOString(),
    completed_at: goal.completedAt ? goal.completedAt.toISOString() : null,
  }
}

function mapShoeToSupabase(shoe: Shoe, profileId: string) {
  return {
    profile_id: profileId,
    local_id: shoe.id,
    name: shoe.name,
    brand: shoe.brand,
    model: shoe.model,
    initial_km: shoe.initialKm,
    current_km: shoe.currentKm,
    max_km: shoe.maxKm,
    start_date: shoe.startDate.toISOString().split('T')[0], // DATE format
    is_active: shoe.isActive,
    created_at: shoe.createdAt.toISOString(),
    updated_at: shoe.updatedAt.toISOString(),
  }
}

export function hasCompletedInitialSync(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return localStorage.getItem('initial_sync_complete') === 'true'
  } catch (error) {
    logger.warn('[InitialSync] Failed to check initial sync status:', error)
    return false
  }
}

function markInitialSyncComplete(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('initial_sync_complete', 'true')
    localStorage.setItem('initial_sync_timestamp', new Date().toISOString())
  } catch (error) {
    logger.warn('[InitialSync] Failed to mark initial sync complete:', error)
  }
}
