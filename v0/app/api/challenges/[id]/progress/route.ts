import { NextResponse } from 'next/server'

import {
  computeChallengeProgressSnapshot,
  mergeChallengeCompletions,
  parseChallengeProgress,
  type ChallengeProgressState,
} from '@/lib/challenges/progress'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ChallengeEnrollmentRow {
  user_id: number
  auth_user_id: string | null
  challenge_id: string
  started_at: string
  completed_at: string | null
  progress: unknown
  challenges: {
    duration_days: number
    slug: string
    title: string
  } | null
}

interface GarminActivityRow {
  start_time: string | null
}

function parseUserId(req: Request): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader.length > 0) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromQuery = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (!fromQuery) return null

  const parsed = Number.parseInt(fromQuery, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return formatDateKey(date)
}

function hasProgressChanged(previous: ChallengeProgressState, next: ChallengeProgressState): boolean {
  if (previous.completedDays.length !== next.completedDays.length) return true

  for (let index = 0; index < previous.completedDays.length; index += 1) {
    if (previous.completedDays[index] !== next.completedDays[index]) return true
  }

  const previousKeys = Object.keys(previous.completionSource).sort()
  const nextKeys = Object.keys(next.completionSource).sort()
  if (previousKeys.length !== nextKeys.length) return true

  for (let index = 0; index < previousKeys.length; index += 1) {
    const key = previousKeys[index]
    const nextKey = nextKeys[index]
    if (!key || !nextKey) return true
    if (key !== nextKey) return true
    if (previous.completionSource[key] !== next.completionSource[key]) return true
  }

  return false
}

async function resolveAuthUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function parseSelfReportFlag(req: Request): boolean {
  const value = new URL(req.url).searchParams.get('selfReport')?.trim().toLowerCase() ?? ''
  return value === 'true' || value === '1' || value === 'yes'
}

async function loadEnrollment(params: {
  userId: number
  challengeId: string
}): Promise<ChallengeEnrollmentRow | null> {
  const response = await createAdminClient()
    .from('challenge_enrollments')
    .select('user_id,auth_user_id,challenge_id,started_at,completed_at,progress,challenges!inner(duration_days,slug,title)')
    .eq('user_id', params.userId)
    .eq('challenge_id', params.challengeId)
    .maybeSingle()

  if (response.error) {
    throw new Error(`Failed to load challenge enrollment: ${response.error.message}`)
  }

  return (response.data as ChallengeEnrollmentRow | null) ?? null
}

async function loadGarminCompletionDays(params: {
  userId: number
  startedAt: string
  durationDays: number
}): Promise<string[]> {
  const startDate = new Date(`${params.startedAt}T00:00:00.000Z`)
  if (Number.isNaN(startDate.getTime())) return []

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + Math.max(1, params.durationDays))

  const activities = await createAdminClient()
    .from('garmin_activities')
    .select('start_time')
    .eq('user_id', params.userId)
    .gte('start_time', startDate.toISOString())
    .lt('start_time', endDate.toISOString())

  if (activities.error) {
    throw new Error(`Failed to load Garmin activities for challenge progress: ${activities.error.message}`)
  }

  const completionDays = new Set<string>()
  for (const row of (activities.data ?? []) as GarminActivityRow[]) {
    const key = row.start_time ? toDateKey(row.start_time) : null
    if (key) completionDays.add(key)
  }

  return [...completionDays].sort((a, b) => a.localeCompare(b))
}

export async function GET(req: Request, context: { params: { id: string } }) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const challengeId = context.params.id?.trim()
  if (!challengeId) {
    return NextResponse.json({ error: 'Valid challenge id is required' }, { status: 400 })
  }

  try {
    const [authUserId, enrollment] = await Promise.all([
      resolveAuthUserId(),
      loadEnrollment({ userId, challengeId }),
    ])

    if (!enrollment) {
      return NextResponse.json({ error: 'Challenge enrollment not found' }, { status: 404 })
    }

    if (authUserId && enrollment.auth_user_id && enrollment.auth_user_id !== authUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const durationDays = Math.max(1, enrollment.challenges?.duration_days ?? 21)
    const previousState = parseChallengeProgress(enrollment.progress)
    const garminCompletionDays = await loadGarminCompletionDays({
      userId,
      startedAt: enrollment.started_at,
      durationDays,
    })

    const todayKey = toDateKey(new Date())
    const requestSelfReport = parseSelfReportFlag(req)

    const mergedState = mergeChallengeCompletions({
      existing: previousState,
      garminDays: garminCompletionDays,
      selfReportedDay: requestSelfReport ? todayKey : null,
    })

    const snapshot = computeChallengeProgressSnapshot({
      startedAt: enrollment.started_at,
      durationDays,
      state: mergedState,
      today: new Date(),
    })

    const shouldMarkComplete = snapshot.completionBadgeEarned && !enrollment.completed_at
    const progressChanged = hasProgressChanged(previousState, mergedState)

    if (progressChanged || shouldMarkComplete) {
      const updatePayload: {
        progress?: ChallengeProgressState
        completed_at?: string | null
        updated_at: string
      } = {
        updated_at: new Date().toISOString(),
      }

      if (progressChanged) {
        updatePayload.progress = mergedState
      }

      if (shouldMarkComplete) {
        updatePayload.completed_at = new Date().toISOString().slice(0, 10)
      }

      const updateResult = await createAdminClient()
        .from('challenge_enrollments')
        .update(updatePayload)
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)

      if (updateResult.error) {
        throw new Error(`Failed to update challenge progress: ${updateResult.error.message}`)
      }
    }

    const streaksResult = await createAdminClient()
      .from('user_streaks')
      .select('best_streak')
      .eq('user_id', userId)
      .maybeSingle()

    if (streaksResult.error) {
      throw new Error(`Failed to load user streaks: ${streaksResult.error.message}`)
    }

    const persistedBestStreak = (streaksResult.data as { best_streak?: number } | null)?.best_streak ?? 0
    const nextBestStreak = Math.max(persistedBestStreak, snapshot.streak.best)

    const upsertStreaks = await createAdminClient()
      .from('user_streaks')
      .upsert(
        {
          user_id: userId,
          auth_user_id: authUserId,
          current_streak: snapshot.streak.current,
          best_streak: nextBestStreak,
          last_active_day: snapshot.streak.lastActiveDay,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertStreaks.error) {
      throw new Error(`Failed to upsert user streaks: ${upsertStreaks.error.message}`)
    }

    return NextResponse.json({
      challengeId,
      challengeSlug: enrollment.challenges?.slug ?? null,
      challengeTitle: enrollment.challenges?.title ?? null,
      startedAt: snapshot.startedAt,
      durationDays: snapshot.durationDays,
      currentDay: snapshot.currentDay,
      completedDays: snapshot.completedDays,
      progressPercent: snapshot.progressPercent,
      daysRemaining: snapshot.daysRemaining,
      completedToday: snapshot.completedToday,
      completionBadgeEarned: snapshot.completionBadgeEarned,
      streak: {
        current: snapshot.streak.current,
        best: nextBestStreak,
        lastActiveDay: snapshot.streak.lastActiveDay,
      },
      canSelfReport: !snapshot.completedToday && !snapshot.completionBadgeEarned,
      sourceBreakdown: {
        garmin: mergedState.completedDays.filter((day) => mergedState.completionSource[day] === 'garmin').length,
        selfReport: mergedState.completedDays.filter((day) => mergedState.completionSource[day] === 'self_report').length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load challenge progress',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
