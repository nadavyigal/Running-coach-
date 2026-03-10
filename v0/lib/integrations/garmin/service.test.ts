import { beforeEach, describe, expect, it, vi } from 'vitest'

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
