import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const createAdminClientMock = vi.hoisted(() => vi.fn())
const importGarminActivityMock = vi.hoisted(() => vi.fn())
const getGarminOAuthStateMock = vi.hoisted(() => vi.fn())
const getGarminConnectionByProviderUserIdMock = vi.hoisted(() => vi.fn())
const markGarminAuthErrorMock = vi.hoisted(() => vi.fn(async () => undefined))
const upsertGarminConnectionMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/integrations/garmin/importGarminActivity', () => ({
  importGarminActivity: importGarminActivityMock,
}))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getGarminOAuthState: getGarminOAuthStateMock,
  getGarminConnectionByProviderUserId: getGarminConnectionByProviderUserIdMock,
  markGarminAuthError: markGarminAuthErrorMock,
  upsertGarminConnection: upsertGarminConnectionMock,
}))

describe('processPendingGarminJobs', () => {
  beforeEach(() => {
    let claimCallCount = 0

    const fromMock = vi.fn((table: string) => {
      if (table === 'garmin_import_jobs' || table === 'garmin_webhook_events') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      }
    })

    createAdminClientMock.mockImplementation(() => ({
      rpc: vi.fn(async (fn: string) => {
        if (fn === 'claim_garmin_import_jobs') {
          claimCallCount += 1
          if (claimCallCount === 1) {
            return {
              data: [
                {
                  id: 'job-1',
                  webhook_event_id: 'evt-1',
                  user_id: 42,
                  profile_id: 'profile-1',
                  provider_user_id: 'garmin-user-1',
                  source_activity_id: 'run-1',
                  job_type: 'activity_import',
                  status: 'running',
                  priority: 10,
                  run_after: '2026-03-01T06:00:00.000Z',
                  locked_at: null,
                  locked_by: null,
                  attempt_count: 1,
                  last_error: null,
                  payload: {
                    datasetKey: 'activities',
                    row: {
                      activityId: 'run-1',
                      activityType: 'running',
                      startTimeInSeconds: 1770000000,
                      distanceInMeters: 5000,
                      durationInSeconds: 1800,
                    },
                  },
                  created_at: '2026-03-01T06:00:00.000Z',
                  updated_at: '2026-03-01T06:00:00.000Z',
                },
              ],
              error: null,
            }
          }

          return {
            data: [
              {
                id: 'job-1',
                webhook_event_id: 'evt-1',
                user_id: 42,
                profile_id: 'profile-1',
                provider_user_id: 'garmin-user-1',
                source_activity_id: 'run-1',
                job_type: 'activity_import',
                status: 'running',
                priority: 10,
                run_after: '2026-03-01T06:00:00.000Z',
                locked_at: null,
                locked_by: null,
                attempt_count: 2,
                last_error: 'upstream timeout',
                payload: {
                  datasetKey: 'activities',
                  row: {
                    activityId: 'run-1',
                    activityType: 'running',
                    startTimeInSeconds: 1770000000,
                    distanceInMeters: 5000,
                    durationInSeconds: 1800,
                  },
                },
                created_at: '2026-03-01T06:00:00.000Z',
                updated_at: '2026-03-01T06:00:00.000Z',
              },
            ],
            error: null,
          }
        }

        return { data: null, error: null }
      }),
      from: fromMock,
    }))

    getGarminOAuthStateMock.mockResolvedValue({
      userId: 42,
      authUserId: 'auth-user-1',
      profileId: 'profile-1',
      garminUserId: 'garmin-user-1',
      providerUserId: 'garmin-user-1',
      scopes: ['ACTIVITY_EXPORT'],
      status: 'connected',
      connectedAt: '2026-03-01T00:00:00.000Z',
      lastSyncAt: null,
      lastSyncCursor: null,
      lastSuccessfulSyncAt: null,
      lastSyncError: null,
      lastWebhookReceivedAt: null,
      errorState: null,
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: '2026-03-02T00:00:00.000Z',
    })

    importGarminActivityMock
      .mockRejectedValueOnce({
        name: 'GarminServiceError',
        type: 'temporary_upstream',
        message: 'upstream timeout',
        retryable: true,
      })
      .mockResolvedValueOnce({
        imported: true,
        duplicate: false,
        skipped: false,
        runId: 'run-1',
        sourceActivityId: 'run-1',
        reason: null,
      })
  })

  it('moves a temporary failure to retry and later succeeds exactly once', async () => {
    const { processPendingGarminJobs } = await import('@/lib/integrations/garmin/service')

    const firstResult = await processPendingGarminJobs({ limit: 1, workerId: 'test-worker' })
    const secondResult = await processPendingGarminJobs({ limit: 1, workerId: 'test-worker' })

    expect(firstResult).toMatchObject({
      claimed: 1,
      retried: 1,
      succeeded: 0,
      imported: 0,
    })

    expect(secondResult).toMatchObject({
      claimed: 1,
      retried: 0,
      succeeded: 1,
      imported: 1,
      duplicates: 0,
    })
    expect(importGarminActivityMock).toHaveBeenCalledTimes(2)
  })

  it('does not import queued Activity work after permission removal', async () => {
    getGarminOAuthStateMock.mockResolvedValue({ userId: 42, scopes: [], status: 'connected' })
    importGarminActivityMock.mockClear()
    const { processPendingGarminJobs } = await import('./service')
    const result = await processPendingGarminJobs({ limit: 1, workerId: 'permission-test' })
    expect(result.imported).toBe(0)
    expect(importGarminActivityMock).not.toHaveBeenCalled()
  })

  it('marks the connection reauth_required when Garmin auth fails', async () => {
    importGarminActivityMock.mockReset()
    importGarminActivityMock.mockRejectedValueOnce({
      name: 'GarminServiceError',
      type: 'auth_error',
      message: 'token revoked',
      retryable: false,
    })

    const { processPendingGarminJobs } = await import('@/lib/integrations/garmin/service')
    const result = await processPendingGarminJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toMatchObject({
      claimed: 1,
      failed: 1,
      succeeded: 0,
    })
    expect(markGarminAuthErrorMock).toHaveBeenCalledWith(42, 'token revoked')
  })
})

describe('enqueueGarminImportJobsForEvent', () => {
  beforeEach(() => {
    createAdminClientMock.mockReset()
    getGarminConnectionByProviderUserIdMock.mockReset()
    upsertGarminConnectionMock.mockClear()
  })

  it('skips wellness datasets without reading connection state for activity imports', async () => {
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    })

    const { enqueueGarminImportJobsForEvent } = await import('@/lib/integrations/garmin/service')

    const result = await enqueueGarminImportJobsForEvent({
      id: 'evt-wellness-1',
      delivery_key: 'delivery-1',
      event_type: 'garmin_delivery',
      provider_user_id: 'garmin-user-1',
      raw_payload: {
        epochs: [
          {
            userId: 'garmin-user-1',
            summaryId: 'epoch-1',
            activityType: 'RUNNING',
          },
        ],
      },
      received_at: '2026-06-15T00:00:00.000Z',
      processed_at: null,
      status: 'received',
      error_message: null,
      attempt_count: 0,
    })

    expect(result).toEqual({ queuedJobs: 0, jobs: [], activityFilesQueued: 0 })
    expect(getGarminConnectionByProviderUserIdMock).not.toHaveBeenCalled()
    expect(upsertGarminConnectionMock).not.toHaveBeenCalled()
  })
})

// Test the persistence boundary, not just an allow-list helper.
describe('Activity-only raw webhook persistence', () => {
  it('never stores Health or unknown payloads in raw events', async () => {
    const inserted: Record<string, unknown>[] = []
    const upsert = vi.fn(async () => ({ error: null }))
    createAdminClientMock.mockImplementation(() => ({
      from: (table: string) => table === 'user_memory_snapshots' ? { upsert } : {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: (row: Record<string, unknown>) => {
          inserted.push(row)
          return { select: () => ({ single: async () => ({ data: { id: 'evt-new', ...row }, error: null }) }) }
        },
      },
    }))
    const { recordGarminWebhookDelivery } = await import('./service')
    const payload = { activities: [{ userId: 'g1', activityId: 'run1' }], sleeps: [{ userId: 'g1', private: 'health' }], unknown: 'private', deregistrations: [{ userId: 'g1' }] }
    await recordGarminWebhookDelivery({ payload, rawBody: JSON.stringify(payload) })
    expect(inserted[0]?.raw_payload).toEqual({ activities: payload.activities, deregistrations: payload.deregistrations })
    expect(JSON.stringify(inserted)).not.toContain('private')
    expect(upsert).toHaveBeenCalledTimes(1)
  })
  it('drains a legacy queued backfill without making a range request on Starter', async () => {
    vi.stubEnv('GARMIN_ACCESS_TIER', 'starter')
    getGarminOAuthStateMock.mockResolvedValue({ userId: 42, scopes: ['ACTIVITY_EXPORT', 'HISTORICAL_DATA_EXPORT'], status: 'connected' })
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream)
    importGarminActivityMock.mockClear()
    const { processGarminImportJob } = await import('./service')
    const result = await processGarminImportJob({ user_id: 42, job_type: 'backfill', payload: { lookbackDays: 30 } } as never)
    expect(result).toEqual({ imported: 0, duplicates: 0 })
    expect(upstream).not.toHaveBeenCalled()
    expect(importGarminActivityMock).not.toHaveBeenCalled()
  })

  it('does not enqueue historical work on Starter before touching the store', async () => {
    createAdminClientMock.mockClear()
    const { enqueueGarminBackfillJob } = await import('./service')
    expect(await enqueueGarminBackfillJob({ userId: 42 })).toBeNull()
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })
})
