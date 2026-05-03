'use client'

import type { Plan, Workout } from '@/lib/db'

const CHUNK_SIZE = 100

type SyncError = {
  message: string
}

type SyncResponse<T> = {
  data: T[] | null
  error: SyncError | null
}

type SupabaseMutationBuilder<T> = PromiseLike<SyncResponse<T>> & {
  select: (columns: string) => PromiseLike<SyncResponse<T>>
}

type SupabaseSelectBuilder<T> = {
  eq: (column: string, value: unknown) => SupabaseSelectBuilder<T>
  in: (column: string, values: unknown[]) => PromiseLike<SyncResponse<T>>
}

type SupabaseTable = {
  upsert: (
    payload: unknown[],
    options: { onConflict: string; ignoreDuplicates: boolean }
  ) => SupabaseMutationBuilder<PlanSyncRow>
  select: (columns: string) => SupabaseSelectBuilder<PlanSyncRow>
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

type PlanSyncRow = {
  id: string
  local_id: number | null
}

export type PlanWorkoutSyncStats = {
  plans: number
  workouts: number
}

function toValidDate(value: Date): Date {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function toDateString(date: Date): string {
  return toValidDate(date).toISOString().split('T')[0]
}

function toTimestamp(date: Date): string {
  return toValidDate(date).toISOString()
}

function normalizeJson(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function mapPlanToSupabase(plan: Plan, profileId: string, authUserId?: string) {
  return {
    profile_id: profileId,
    auth_user_id: authUserId ?? null,
    local_id: plan.id,
    title: plan.title || plan.name || 'Training Plan',
    description: plan.description || null,
    start_date: toDateString(plan.startDate),
    end_date: toDateString(plan.endDate),
    total_weeks: plan.totalWeeks,
    is_active: plan.isActive,
    plan_type: plan.planType || 'basic',
    complexity_level: plan.complexityLevel || 'basic',
    complexity_score: plan.complexityScore ?? 0,
    target_distance: plan.targetDistance ?? null,
    target_time: plan.targetTime ?? null,
    fitness_level: plan.fitnessLevel || plan.difficulty || null,
    training_days_per_week: plan.trainingDaysPerWeek ?? null,
    peak_weekly_volume: plan.peakWeeklyVolume ?? null,
    created_in_timezone: plan.createdInTimezone || 'UTC',
    created_at: toTimestamp(plan.createdAt),
    updated_at: toTimestamp(plan.updatedAt),
  }
}

function mapWorkoutToSupabase(workout: Workout, remotePlanId: string, authUserId?: string) {
  return {
    plan_id: remotePlanId,
    auth_user_id: authUserId ?? null,
    local_id: workout.id,
    week: workout.week,
    day: workout.day,
    type: workout.type,
    distance: workout.distance,
    duration: workout.duration ?? null,
    pace: workout.pace ?? null,
    intensity: workout.intensity ?? null,
    training_phase: workout.trainingPhase ?? null,
    workout_structure: normalizeJson(workout.workoutStructure),
    notes: workout.notes ?? null,
    completed: workout.completed,
    completed_at: workout.completedAt ? toTimestamp(workout.completedAt) : null,
    actual_distance_km: workout.actualDistanceKm ?? null,
    actual_duration_minutes: workout.actualDurationMinutes ?? null,
    actual_pace: workout.actualPace ?? null,
    scheduled_date: toDateString(workout.scheduledDate),
    created_at: toTimestamp(workout.createdAt),
    updated_at: toTimestamp(workout.updatedAt),
  }
}

async function upsertPlans(
  supabase: SupabaseLike,
  profileId: string,
  plans: Plan[],
  logPrefix: string,
  authUserId?: string
): Promise<Map<number, string>> {
  const remotePlanIdsByLocalId = new Map<number, string>()
  const validPlans = plans
    .filter((plan): plan is Plan & { id: number } => typeof plan.id === 'number')
    .sort((a, b) => Number(a.isActive) - Number(b.isActive))

  for (let i = 0; i < validPlans.length; i += CHUNK_SIZE) {
    const chunk = validPlans.slice(i, i + CHUNK_SIZE)
    const payload = chunk.map((plan) => mapPlanToSupabase(plan, profileId, authUserId))

    const { data, error } = await supabase
      .from('plans')
      .upsert(payload, {
        onConflict: 'profile_id,local_id',
        ignoreDuplicates: false,
      })
      .select('id,local_id')

    if (error) {
      throw new Error(`${logPrefix} plan sync failed: ${error.message}`)
    }

    for (const row of (data ?? []) as PlanSyncRow[]) {
      if (typeof row.local_id === 'number') {
        remotePlanIdsByLocalId.set(row.local_id, row.id)
      }
    }
  }

  return remotePlanIdsByLocalId
}

async function loadMissingPlanIds(
  supabase: SupabaseLike,
  profileId: string,
  localPlanIds: number[],
  existingMap: Map<number, string>,
  logPrefix: string
) {
  const missing = localPlanIds.filter((id) => !existingMap.has(id))
  if (missing.length === 0) return

  const { data, error } = await supabase
    .from('plans')
    .select('id,local_id')
    .eq('profile_id', profileId)
    .in('local_id', missing)

  if (error) {
    throw new Error(`${logPrefix} plan ID lookup failed: ${error.message}`)
  }

  for (const row of (data ?? []) as PlanSyncRow[]) {
    if (typeof row.local_id === 'number') {
      existingMap.set(row.local_id, row.id)
    }
  }
}

async function upsertWorkouts(
  supabase: SupabaseLike,
  workouts: Workout[],
  remotePlanIdsByLocalId: Map<number, string>,
  logPrefix: string,
  authUserId?: string
): Promise<number> {
  const validWorkouts = workouts.filter((workout): workout is Workout & { id: number } => {
    return typeof workout.id === 'number' && typeof workout.planId === 'number'
  })
  let synced = 0

  for (let i = 0; i < validWorkouts.length; i += CHUNK_SIZE) {
    const chunk = validWorkouts.slice(i, i + CHUNK_SIZE)
    const payload = chunk.flatMap((workout) => {
      const remotePlanId = remotePlanIdsByLocalId.get(workout.planId)
      return remotePlanId ? [mapWorkoutToSupabase(workout, remotePlanId, authUserId)] : []
    })

    if (payload.length === 0) continue

    const { error } = await supabase
      .from('workouts')
      .upsert(payload, {
        onConflict: 'plan_id,local_id',
        ignoreDuplicates: false,
      })

    if (error) {
      throw new Error(`${logPrefix} workout sync failed: ${error.message}`)
    }

    synced += payload.length
  }

  return synced
}

export async function syncPlansAndWorkouts(
  supabase: SupabaseLike,
  profileId: string,
  plans: Plan[],
  workouts: Workout[],
  logPrefix = '[PlanWorkoutSync]',
  authUserId?: string
): Promise<PlanWorkoutSyncStats> {
  const remotePlanIdsByLocalId = await upsertPlans(supabase, profileId, plans, logPrefix, authUserId)
  const localPlanIdsForWorkouts = [
    ...new Set(
      workouts
        .map((workout) => workout.planId)
        .filter((id): id is number => typeof id === 'number')
    ),
  ]

  await loadMissingPlanIds(supabase, profileId, localPlanIdsForWorkouts, remotePlanIdsByLocalId, logPrefix)

  return {
    plans: plans.filter((plan) => typeof plan.id === 'number').length,
    workouts: await upsertWorkouts(supabase, workouts, remotePlanIdsByLocalId, logPrefix, authUserId),
  }
}
