import { beforeEach, describe, expect, it, vi } from 'vitest'

import { importGarminActivity } from '@/lib/integrations/garmin/importGarminActivity'
import type { GarminNormalizedActivity, GarminOAuthConnection } from '@/lib/integrations/garmin/types'

const runsRows: Array<Record<string, unknown>> = []
const upsertedRuns: Array<Record<string, unknown>> = []

const createAdminClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

function createQueryBuilder(table: string) {
  const state: Record<string, unknown> = {}

  return {
    from() {
      return this
    },
    select() {
      return this
    },
    eq(column: string, value: unknown) {
      state[column] = value
      return this
    },
    gte() {
      return this
    },
    lte() {
      return this
    },
    limit() {
      if (table === 'runs') {
        return Promise.resolve({
          data: runsRows,
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    },
    upsert(payload: Record<string, unknown>) {
      if (table === 'runs') {
        upsertedRuns.push(payload)
        return {
          select() {
            return {
              single: async () => ({
                data: { id: 'run-1' },
                error: null,
              }),
            }
          },
        }
      }

      return Promise.resolve({ error: null })
    },
  }
}

describe('importGarminActivity', () => {
  beforeEach(() => {
    runsRows.length = 0
    upsertedRuns.length = 0
    createAdminClientMock.mockImplementation(() => ({
      from(table: string) {
        return createQueryBuilder(table)
      },
    }))
  })

  it('skips a backfill import when a live Garmin row already matches by heuristic dedupe', async () => {
    runsRows.push({
      id: 'existing-run',
      distance: 10.05,
      duration: 3005,
      completed_at: '2026-03-01T06:33:00.000Z',
      source_provider: 'garmin',
      source_activity_id: 'live-run-1',
    })

    const connection: GarminOAuthConnection = {
      userId: 42,
      profileId: 'profile-1',
      authUserId: 'auth-user-1',
      providerUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT'],
      status: 'connected',
      connectedAt: '2026-03-01T00:00:00.000Z',
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      lastWebhookReceivedAt: null,
      lastSyncError: null,
    }

    const activity: GarminNormalizedActivity = {
      activityId: 'backfill-run-1',
      sourceProvider: 'garmin',
      sourceExternalId: null,
      sourcePayloadRef: null,
      name: 'Morning Run',
      typeKey: 'running',
      startTime: '2026-03-01T06:30:00.000Z',
      timezone: 'UTC',
      distanceMeters: 10000,
      durationSeconds: 3000,
      movingDurationSeconds: null,
      averagePaceSecondsPerKm: 300,
      elevationGainMeters: 50,
      averageHeartRate: 150,
      maxHeartRate: 171,
      calories: 600,
      routePoints: [],
      polyline: null,
      lapSummaries: [],
      splitSummaries: [],
      raw: { activityId: 'backfill-run-1' },
    }

    const result = await importGarminActivity({ connection, activity })

    expect(result).toMatchObject({
      imported: false,
      duplicate: true,
      skipped: true,
      reason: 'heuristic_duplicate',
    })
    expect(upsertedRuns).toHaveLength(0)
  })
})
