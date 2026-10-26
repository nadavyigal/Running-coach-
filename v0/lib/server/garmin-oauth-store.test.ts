import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createAdminClientMock = vi.hoisted(() => vi.fn())
const credentialsMock = vi.hoisted(() => vi.fn(() => ({ clientId: 'test-client', clientSecret: 'test-secret', mode: 'commercial' })))

vi.mock('@/lib/server/garmin-credentials', () => ({ resolveGarminOAuthClientCredentials: credentialsMock }))

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


describe('revokeGarminConnection', () => {
  const deletedUserIds: number[] = []
  const connectionUpdates: Record<string, unknown>[] = []
  let storedTokens: Record<string, unknown>

  beforeEach(() => {
    storedTokens = { access_token_encrypted: 'access-token', refresh_token_encrypted: 'refresh-token', expires_at: '2099-01-01T00:00:00Z' }
    decryptTokenMock.mockImplementation((token: string) => token.startsWith('encrypted-') ? token.slice('encrypted-'.length) : `decrypted-${token}`)
    deletedUserIds.length = 0
    connectionUpdates.length = 0
    credentialsMock.mockReset()
    credentialsMock.mockReturnValue({ clientId: 'test-client', clientSecret: 'test-secret', mode: 'commercial' })
    createAdminClientMock.mockImplementation(() => ({
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: table === 'garmin_connections' ? {
            user_id: 42, auth_user_id: 'auth-42', status: 'connected', scopes: ['ACTIVITY_EXPORT'],
            garmin_user_id: 'garmin-42', connected_at: '2026-01-01T00:00:00Z', error_state: null,
          } : storedTokens, error: null,
        }) }) }),
        delete: () => ({ eq: async (_field: string, userId: number) => {
          deletedUserIds.push(userId); return { error: null }
        } }),
        upsert: async (row: Record<string, unknown>) => {
          if (table === 'garmin_tokens') storedTokens = row
          else connectionUpdates.push(row)
          return { error: null }
        },
      }),
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('deletes Garmin registration with Bearer access before revoking either token', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const { revokeGarminConnection } = await import('./garmin-oauth-store')
    expect(await revokeGarminConnection(42)).toEqual({ revokedUpstream: true, hadStoredTokens: true })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://apis.garmin.com/partner-gateway/rest/user/registration',
      'https://diauth.garmin.com/di-oauth2-service/oauth/revoke',
      'https://diauth.garmin.com/di-oauth2-service/oauth/revoke',
    ])
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      'https://apis.garmin.com/partner-gateway/rest/user/registration',
      expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer decrypted-access-token' } }),
    )
    expect(deletedUserIds).toEqual([42])
    expect(connectionUpdates).toEqual([expect.objectContaining({ user_id: 42, status: 'revoked' })])
  })

  it('uses the rotated refresh token after refreshing expired access before registration removal', async () => {
    storedTokens.expires_at = '2020-01-01T00:00:00Z'
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'new-valid-access-token', refresh_token: 'new-rotated-refresh-token', expires_in: 3600,
    }), { status: 200 })).mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const { revokeGarminConnection } = await import('./garmin-oauth-store')
    expect((await revokeGarminConnection(42)).revokedUpstream).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://apis.garmin.com/partner-gateway/rest/user/registration',
      expect.objectContaining({ headers: { Authorization: 'Bearer new-valid-access-token' } }),
    )
    const revoked = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/oauth/revoke'))
      .map(([, init]) => (init.body as URLSearchParams).get('token'))
    expect(revoked).toEqual(['new-valid-access-token', 'new-rotated-refresh-token'])
    expect(deletedUserIds).toEqual([42])
  })

  it.each(['http', 'network'])('cleans locally and does not claim upstream success after registration %s failure', async (failure) => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      if (failure === 'network') throw new Error('Network unavailable')
      return new Response('Not authorized', { status: 401 })
    }).mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const { revokeGarminConnection } = await import('./garmin-oauth-store')
    expect(await revokeGarminConnection(42)).toEqual({ revokedUpstream: false, hadStoredTokens: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(deletedUserIds).toEqual([42])
    expect(connectionUpdates).toEqual([expect.objectContaining({ user_id: 42, status: 'revoked' })])
  })

  it('does not claim upstream success when registration succeeds but token revocation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValue(new Response('Unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const { revokeGarminConnection } = await import('./garmin-oauth-store')
    expect((await revokeGarminConnection(42)).revokedUpstream).toBe(false)
    expect(deletedUserIds).toEqual([42])
  })

  it('does not claim upstream success when token revocation lacks allowed credentials', async () => {
    credentialsMock.mockImplementation(() => { throw new Error('Credentials unavailable') })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const { revokeGarminConnection } = await import('./garmin-oauth-store')
    expect((await revokeGarminConnection(42)).revokedUpstream).toBe(false)
    expect(deletedUserIds).toEqual([42])
  })
})
