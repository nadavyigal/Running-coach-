'use client'

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { trackSyncEvent } from '@/lib/analytics'
import { compressGPSPath } from '@/lib/compression'
import type { Run, Goal, Shoe } from '@/lib/db'

type SyncStatus = 'idle' | 'syncing' | 'error'

type SyncStats = {
  runs: number
  goals: number
  shoes: number
}

export class SyncService {
  private static instance: SyncService | null = null
  private status: SyncStatus = 'idle'
  private lastSyncTime: Date | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private errorMessage: string | null = null
  private isSyncing = false

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  public startAutoSync(intervalMs = 300000): void {
    if (this.syncInterval) {
      logger.info('[SyncService] Auto-sync already running')
      return
    }

    logger.info('[SyncService] Starting auto-sync with interval:', intervalMs)

    // Perform initial sync immediately
    this.syncIncrementalChanges()

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncIncrementalChanges()
    }, intervalMs)
  }

  public stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      logger.info('[SyncService] Auto-sync stopped')
    }
  }

  public async syncIncrementalChanges(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      logger.info('[SyncService] Sync already in progress, skipping')
      return
    }

    this.isSyncing = true
    this.status = 'syncing'
    this.errorMessage = null

    try {
      const supabase = createClient()

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        logger.info('[SyncService] No authenticated user, skipping sync')
        this.status = 'idle'
        this.isSyncing = false
        return
      }

      // Get profile_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single()

      if (profileError || !profile) {
        logger.error('[SyncService] Error fetching profile:', profileError)
        this.status = 'error'
        this.errorMessage = 'Failed to fetch profile'
        this.isSyncing = false
        return
      }

      const profileId = profile.id

      // Get last sync timestamp from localStorage
      const lastSyncTimestamp = this.getLastSyncTimestamp()
      logger.info('[SyncService] Last sync timestamp:', lastSyncTimestamp?.toISOString() || 'never')

      // Sync each table
      const stats: SyncStats = {
        runs: 0,
        goals: 0,
        shoes: 0,
      }

      // Sync runs
      stats.runs = await this.syncRuns(supabase, profileId, lastSyncTimestamp)

      // Sync goals
      stats.goals = await this.syncGoals(supabase, profileId, lastSyncTimestamp)

      // Sync shoes
      stats.shoes = await this.syncShoes(supabase, profileId, lastSyncTimestamp)

      // Update last sync time
      this.lastSyncTime = new Date()
      this.setLastSyncTimestamp(this.lastSyncTime)
      this.status = 'idle'

      const totalRecords = stats.runs + stats.goals + stats.shoes
      logger.info('[SyncService] Sync completed successfully', stats)
      await trackSyncEvent('sync_completed', totalRecords)
    } catch (error) {
      logger.error('[SyncService] Sync failed:', error)
      this.status = 'error'
      this.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await trackSyncEvent('sync_failed')
    } finally {
      this.isSyncing = false
    }
  }

  private async syncRuns(
    supabase: ReturnType<typeof createClient>,
    profileId: string,
    since: Date | null
  ): Promise<number> {
    try {
      const query = since
        ? db.runs.filter((run) => !!(run.updatedAt && run.updatedAt > since))
        : db.runs.toCollection()

      const localRuns = await query.toArray()

      if (localRuns.length === 0) {
        return 0
      }

      // Batch upload in chunks of 100
      const chunkSize = 100
      let synced = 0

      for (let i = 0; i < localRuns.length; i += chunkSize) {
        const chunk = localRuns.slice(i, i + chunkSize)
        const runsToSync = chunk.map((run) => this.mapRunToSupabase(run, profileId))

        const { error } = await supabase
          .from('runs')
          .upsert(runsToSync, {
            onConflict: 'profile_id,local_id',
            ignoreDuplicates: false,
          })

        if (error) {
          logger.error('[SyncService] Error syncing runs chunk:', error)
          throw error
        }

        synced += chunk.length
      }

      logger.info(`[SyncService] Synced ${synced} runs`)
      return synced
    } catch (error) {
      logger.error('[SyncService] Error syncing runs:', error)
      throw error
    }
  }

  private async syncGoals(
    supabase: ReturnType<typeof createClient>,
    profileId: string,
    since: Date | null
  ): Promise<number> {
    try {
      const query = since
        ? db.goals.filter((goal) => goal.updatedAt && goal.updatedAt > since)
        : db.goals.toCollection()

      const localGoals = await query.toArray()

      if (localGoals.length === 0) {
        return 0
      }

      const chunkSize = 100
      let synced = 0

      for (let i = 0; i < localGoals.length; i += chunkSize) {
        const chunk = localGoals.slice(i, i + chunkSize)
        const goalsToSync = chunk.map((goal) => this.mapGoalToSupabase(goal, profileId))

        const { error } = await supabase
          .from('goals')
          .upsert(goalsToSync, {
            onConflict: 'profile_id,local_id',
            ignoreDuplicates: false,
          })

        if (error) {
          logger.error('[SyncService] Error syncing goals chunk:', error)
          throw error
        }

        synced += chunk.length
      }

      logger.info(`[SyncService] Synced ${synced} goals`)
      return synced
    } catch (error) {
      logger.error('[SyncService] Error syncing goals:', error)
      throw error
    }
  }

  private async syncShoes(
    supabase: ReturnType<typeof createClient>,
    profileId: string,
    since: Date | null
  ): Promise<number> {
    try {
      const query = since
        ? db.shoes.filter((shoe) => shoe.updatedAt && shoe.updatedAt > since)
        : db.shoes.toCollection()

      const localShoes = await query.toArray()

      if (localShoes.length === 0) {
        return 0
      }

      const chunkSize = 100
      let synced = 0

      for (let i = 0; i < localShoes.length; i += chunkSize) {
        const chunk = localShoes.slice(i, i + chunkSize)
        const shoesToSync = chunk.map((shoe) => this.mapShoeToSupabase(shoe, profileId))

        const { error } = await supabase
          .from('shoes')
          .upsert(shoesToSync, {
            onConflict: 'profile_id,local_id',
            ignoreDuplicates: false,
          })

        if (error) {
          logger.error('[SyncService] Error syncing shoes chunk:', error)
          throw error
        }

        synced += chunk.length
      }

      logger.info(`[SyncService] Synced ${synced} shoes`)
      return synced
    } catch (error) {
      logger.error('[SyncService] Error syncing shoes:', error)
      throw error
    }
  }

  private mapRunToSupabase(run: Run, profileId: string) {
    // Compress GPS path before upload (60-70% storage reduction)
    let route = null
    if (run.gpsPath) {
      try {
        const originalPath = JSON.parse(run.gpsPath)
        if (Array.isArray(originalPath) && originalPath.length > 0) {
          const compressed = compressGPSPath(originalPath, {
            precision: 5,        // ~1m accuracy
            minDistance: 5,      // Remove points closer than 5m
            simplify: true,      // Use Douglas-Peucker algorithm
            epsilon: 0.0001,     // Simplification tolerance
          })
          route = compressed
          logger.info(`[SyncService] Compressed GPS path: ${originalPath.length} -> ${compressed.length} points`)
        } else {
          route = originalPath
        }
      } catch (error) {
        logger.warn('[SyncService] Failed to compress GPS path:', error)
        route = run.gpsPath
      }
    }

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
      route,
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

  private mapGoalToSupabase(goal: Goal, profileId: string) {
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

  private mapShoeToSupabase(shoe: Shoe, profileId: string) {
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

  private getLastSyncTimestamp(): Date | null {
    if (typeof window === 'undefined') return null

    try {
      const timestamp = localStorage.getItem('last_sync_timestamp')
      return timestamp ? new Date(timestamp) : null
    } catch (error) {
      logger.warn('[SyncService] Failed to read last sync timestamp:', error)
      return null
    }
  }

  private setLastSyncTimestamp(date: Date): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem('last_sync_timestamp', date.toISOString())
    } catch (error) {
      logger.warn('[SyncService] Failed to save last sync timestamp:', error)
    }
  }

  public getStatus(): SyncStatus {
    return this.status
  }

  public getLastSyncTime(): Date | null {
    return this.lastSyncTime
  }

  public getErrorMessage(): string | null {
    return this.errorMessage
  }
}
