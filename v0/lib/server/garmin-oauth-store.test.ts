import { beforeEach, describe, expect, it, vi } from 'vitest'

const createAdminClientMock = vi.hoisted(() => vi.fn())
const decryptTokenMock = vi.hoisted(() => vi.fn((token: string) => `decrypted-${token}`))

vi.mock('server-only', () => ({}))

vi.mock('@/app/api/devices/garmin/token-crypto', () => ({
  decryptToken: decryptTokenMock,
  encryptToken: vi.fn((token: string) => `encrypted-${token}`),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

function createThenableResult(result: unknown) {
  return {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
}

describe('getGarminConnectionByProviderUserId', () => {
  beforeEach(() => {
    createAdminClientMock.mockReset()
    decryptTokenMock.mockClear()
  })

  it('prefers a connected row with profile context over disconnected rows with higher profile IDs', async () => {
    const lookupRows = [
      {
        user_id: 2,
        profile_id: 'zzzz-profile',
        status: 'disconnected',
        last_webhook_received_at: '2026-06-15T12:00:00.000Z',
      },
      {
        user_id: 1,
        profile_id: 'aaaa-profile',
        status: 'connected',
        last_webhook_received_at: '2026-06-15T11:00:00.000Z',
      },
      {
        user_id: 3,
        profile_id: null,
        status: 'connected',
        last_webhook_received_at: '2026-06-15T13:00:00.000Z',
      },
    ]

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn((selection: string) => {
          if (table === 'garmin_connections' && selection !== '*') {
            const lookupResult = { data: lookupRows, error: null }
            const limited = {
              ...createThenableResult(lookupResult),
              maybeSingle: vi.fn(async () => ({ data: lookupRows[0], error: null })),
            }
            const query = {
              or: vi.fn(() => query),
              order: vi.fn(() => query),
              limit: vi.fn(() => limited),
            }
            return query
          }

          if (table === 'garmin_connections') {
            let userId: number | null = null
            const query = {
              eq: vi.fn((field: string, value: number) => {
                if (field === 'user_id') userId = value
                return query
              }),
              maybeSingle: vi.fn(async () => ({
                data: userId === 1
                  ? {
                      user_id: 1,
                      auth_user_id: 'auth-1',
                      profile_id: 'aaaa-profile',
                      garmin_user_id: 'garmin-1',
                      provider_user_id: 'garmin-1',
                      scopes: ['ACTIVITY_EXPORT'],
                      status: 'connected',
                      connected_at: '2026-06-01T00:00:00.000Z',
                      revoked_at: null,
                      last_sync_at: null,
                      last_sync_cursor: null,
                      last_successful_sync_at: null,
                      last_sync_error: null,
                      last_webhook_received_at: null,
                      error_state: null,
                    }
                  : null,
                error: null,
              })),
            }
            return query
          }

          let userId: number | null = null
          const query = {
            eq: vi.fn((field: string, value: number) => {
              if (field === 'user_id') userId = value
              return query
            }),
            maybeSingle: vi.fn(async () => ({
              data: userId === 1
                ? {
                    user_id: 1,
                    auth_user_id: 'auth-1',
                    access_token_encrypted: 'access-token',
                    refresh_token_encrypted: 'refresh-token',
                    expires_at: '2026-07-01T00:00:00.000Z',
                  }
                : null,
              error: null,
            })),
          }
          return query
        }),
      })),
    })

    const { getGarminConnectionByProviderUserId } = await import('@/lib/server/garmin-oauth-store')

    const state = await getGarminConnectionByProviderUserId('garmin-1')

    expect(state?.userId).toBe(1)
    expect(state?.status).toBe('connected')
    expect(state?.profileId).toBe('aaaa-profile')
  })
})
