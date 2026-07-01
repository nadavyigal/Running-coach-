import 'server-only'

import { buildGarminFirstAhaResult } from '@/lib/garminFirstAhaBuilder'
import type { GarminFirstAhaResult } from '@/lib/garminFirstAhaTypes'
import type { GarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createAdminClient } from '@/lib/supabase/admin'

interface GarminRunRow {
  completed_at: string
  duration: number | null
  distance: number | null
  heart_rate: number | null
}

interface GarminDailyRow {
  date: string
  hrv: number | null
  sleep_score: number | null
  resting_hr: number | null
  stress: number | null
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(base + deltaDays * dayMs).toISOString().slice(0, 10)
}

export function buildUnavailableGarminFirstAha(): GarminFirstAhaResult {
  return {
    status: 'error',
    generatedAt: new Date().toISOString(),
    dataWindow: { activitiesDays: 28 },
    profile: {
      runnerType: 'Unavailable',
      headline: 'Garmin connection required',
      summaryBullets: ['Connect Garmin to generate your first running profile.'],
      confidence: 'low',
    },
    signals: {
      consistency: {
        runsLast14Days: 0,
        runsLast28Days: 0,
        weeklyPatternLabel: 'No Garmin runs synced yet',
      },
      load: { acwrLabel: 'unknown' },
      intensity: {
        label: 'No intensity data',
        source: 'insufficient',
      },
    },
    guardrails: {
      level: 'yellow',
      message: 'Connect Garmin and sync activities before building a starter plan.',
      reasons: ['No Garmin connection found'],
    },
    starterPlan: {
      title: 'Starter block unavailable',
      rationale: 'Sync Garmin activities first.',
      days: [],
    },
    recommendedChallenge: {
      id: 'start-running',
      title: 'Start Running Challenge',
      reason: 'Available after your first Garmin sync.',
      fitScoreLabel: 'Pending data',
    },
    disclaimers: ['Connect Garmin and try again after your activities sync.'],
  }
}

export async function generateGarminFirstAha(
  userId: number,
  oauthState: GarminOAuthState
): Promise<GarminFirstAhaResult> {
  const admin = createAdminClient()
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = shiftIsoDate(endDate, -27)
  const profileId = oauthState.profileId ?? null

  const [runsQuery, dailyQuery] = await Promise.all([
    profileId
      ? admin
          .from('runs')
          .select('completed_at,duration,distance,heart_rate')
          .eq('profile_id', profileId)
          .gte('completed_at', `${startDate}T00:00:00.000Z`)
          .order('completed_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('garmin_daily_metrics')
      .select('date,hrv,sleep_score,resting_hr,stress')
      .eq('user_id', userId)
      .gte('date', startDate)
      .order('date', { ascending: true }),
  ])

  if ('error' in runsQuery && runsQuery.error) {
    throw new Error(runsQuery.error.message)
  }
  if (dailyQuery.error) {
    throw new Error(dailyQuery.error.message)
  }

  const runs = ((runsQuery.data ?? []) as GarminRunRow[])
    .filter((run) => typeof run.completed_at === 'string')
    .map((run) => ({
      completedAt: run.completed_at,
      durationSeconds: run.duration,
      distanceMeters: run.distance != null ? Math.round(Number(run.distance) * 1000) : null,
      averageHeartRate: run.heart_rate,
    }))

  const wellnessDays = ((dailyQuery.data ?? []) as GarminDailyRow[]).map((row) => ({
    date: row.date,
    hrv: row.hrv,
    sleepScore: row.sleep_score,
    restingHr: row.resting_hr,
    stress: row.stress,
  }))

  return buildGarminFirstAhaResult({ runs, wellnessDays, endDate })
}
