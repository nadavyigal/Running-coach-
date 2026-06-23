import { beforeEach, describe, expect, it, vi } from 'vitest'

const activitiesByKey = new Map<string, Record<string, unknown>>()
const dailyByKey = new Map<string, Record<string, unknown>>()
const upsertCalls: Array<{ table: string; onConflict: string }> = []

const createAdminClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    from: (table: string) => ({
      upsert: async (rows: Array<Record<string, unknown>>, options: { onConflict: string }) => {
        upsertCalls.push({ table, onConflict: options.onConflict })

        if (table === 'garmin_activities') {
          for (const row of rows) {
            const key = `${row.user_id}:${row.activity_id}`
            activitiesByKey.set(key, row)
          }
        }

        if (table === 'garmin_daily_metrics') {
          for (const row of rows) {
            const key = `${row.user_id}:${row.date}`
            dailyByKey.set(key, row)
          }
        }

        return { error: null }
      },
    }),
  }))
)

const getGarminOAuthStateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    authUserId: 'auth-user-1',
  }))
)

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
}))

describe('persistGarminSyncSnapshot', () => {
  beforeEach(() => {
    activitiesByKey.clear()
    dailyByKey.clear()
    upsertCalls.length = 0
  })

  it('is idempotent for identical upserts', async () => {
    const { persistGarminSyncSnapshot } = await import('@/lib/server/garmin-analytics-store')

    const input = {
      userId: 42,
      activities: [
        {
          activityId: 'activity-1',
          activityName: 'Easy Run',
          activityType: 'running',
          startTimeGMT: '2026-02-20T06:00:00.000Z',
          distance: 5.2,
          duration: 1800,
          averageHR: 142,
          maxHR: 166,
          calories: 420,
          averagePace: 346,
          elevationGain: 28,
        },
      ],
      sleep: [
        {
          date: '2026-02-20',
          totalSleepSeconds: 25200,
          sleepScores: { overall: { value: 78 } },
        },
      ],
      datasets: {
        activities: [],
        manuallyUpdatedActivities: [],
        activityDetails: [],
        dailies: [
          {
            calendarDate: '2026-02-20',
            steps: 9820,
            restingHeartRateInBeatsPerMinute: 49,
            bodyBatteryChargedValue: 63,
            bodyBatteryDrainedValue: 41,
          },
        ],
        epochs: [],
        sleeps: [],
        bodyComps: [],
        stressDetails: [],
        userMetrics: [],
        pulseox: [],
        allDayRespiration: [],
        healthSnapshot: [],
        hrv: [],
        bloodPressures: [],
        skinTemp: [],
      },
    }

    await persistGarminSyncSnapshot(input)
    await persistGarminSyncSnapshot(input)

    expect(activitiesByKey.size).toBe(1)
    expect(dailyByKey.size).toBe(1)
    const dailyRow = dailyByKey.get('42:2026-02-20')
    expect(dailyRow?.body_battery).toBeNull()
    expect(dailyRow?.body_battery_start).toBeNull()
    expect(dailyRow?.body_battery_peak).toBeNull()
    expect(dailyRow?.body_battery_end).toBeNull()
    expect(dailyRow?.body_battery_charged).toBe(63)
    expect(dailyRow?.body_battery_drained).toBe(41)
    expect(dailyRow?.body_battery_balance).toBe(22)
    expect(
      upsertCalls.some((call) => call.table === 'garmin_activities' && call.onConflict === 'user_id,activity_id')
    ).toBe(true)
    expect(
      upsertCalls.some((call) => call.table === 'garmin_daily_metrics' && call.onConflict === 'user_id,date')
    ).toBe(true)
  })

  it('extracts body battery start, peak, and end from stressDetails time series', async () => {
    const { persistGarminSyncSnapshot } = await import('@/lib/server/garmin-analytics-store')

    await persistGarminSyncSnapshot({
      userId: 42,
      activities: [],
      sleep: [],
      datasets: {
        activities: [],
        manuallyUpdatedActivities: [],
        activityDetails: [],
        dailies: [
          {
            calendarDate: '2026-06-22',
            bodyBatteryChargedValue: 63,
            bodyBatteryDrainedValue: 41,
          },
        ],
        epochs: [],
        sleeps: [],
        bodyComps: [],
        stressDetails: [
          {
            calendarDate: '2026-06-22',
            averageStressLevel: 28,
            timeOffsetBodyBatteryValues: {
              '0': 34,
              '1800': 40,
              '22500': 99,
              '86220': 12,
            },
          },
        ],
        userMetrics: [],
        pulseox: [],
        allDayRespiration: [],
        healthSnapshot: [],
        hrv: [],
        bloodPressures: [],
        skinTemp: [],
      },
    })

    const dailyRow = dailyByKey.get('42:2026-06-22')
    expect(dailyRow?.body_battery_start).toBe(34)
    expect(dailyRow?.body_battery_peak).toBe(99)
    expect(dailyRow?.body_battery_end).toBe(12)
    expect(dailyRow?.body_battery).toBe(12)
    expect(dailyRow?.body_battery_charged).toBe(63)
    expect(dailyRow?.body_battery_drained).toBe(41)
    expect(dailyRow?.body_battery_balance).toBe(22)
  })
})
