import { describe, expect, it } from 'vitest'

import type { GarminNormalizedActivity } from '@/lib/garmin/normalize/normalizeActivity'
import type { GarminNormalizedDailyMetric } from '@/lib/garmin/normalize/normalizeDaily'
import {
  type GarminUpsertRepository,
  upsertGarminSyncRows,
} from '@/lib/garmin/sync/upsert'

class InMemoryUpsertRepository implements GarminUpsertRepository {
  readonly activities = new Map<string, GarminNormalizedActivity>()
  readonly dailyMetrics = new Map<string, GarminNormalizedDailyMetric>()

  async upsertActivities(rows: GarminNormalizedActivity[]): Promise<number> {
    for (const row of rows) {
      this.activities.set(`${row.user_id}:${row.activity_id}`, row)
    }
    return rows.length
  }

  async upsertDailyMetrics(rows: GarminNormalizedDailyMetric[]): Promise<number> {
    for (const row of rows) {
      this.dailyMetrics.set(`${row.user_id}:${row.date}`, row)
    }
    return rows.length
  }
}

describe('garmin sync upsert idempotency', () => {
  it('does not duplicate rows when upsert runs twice', async () => {
    const repository = new InMemoryUpsertRepository()

    const activity: GarminNormalizedActivity = {
      user_id: 42,
      auth_user_id: '00000000-0000-0000-0000-000000000042',
      activity_id: 'activity-1',
      start_time: '2026-02-24T06:00:00.000Z',
      sport: 'running',
      duration_s: 1800,
      distance_m: 5000,
      avg_hr: 145,
      max_hr: 165,
      avg_pace: 360,
      elevation_gain_m: 42,
      calories: 430,
      raw_json: { source: 'test' },
    }

    const daily: GarminNormalizedDailyMetric = {
      user_id: 42,
      auth_user_id: '00000000-0000-0000-0000-000000000042',
      date: '2026-02-24',
      steps: 10000,
      sleep_score: 82,
      sleep_duration_s: 25200,
      hrv: 58,
      resting_hr: 50,
      stress: 28,
      body_battery: 71,
      vo2max: 49,
      calories: 2300,
      raw_json: { source: 'test' },
    }

    await upsertGarminSyncRows({
      repository,
      activities: [activity, activity],
      dailyMetrics: [daily, daily],
    })
    await upsertGarminSyncRows({
      repository,
      activities: [activity],
      dailyMetrics: [daily],
    })

    expect(repository.activities.size).toBe(1)
    expect(repository.dailyMetrics.size).toBe(1)
  })
})

