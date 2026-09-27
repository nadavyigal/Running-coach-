import { beforeEach, describe, expect, it, vi } from 'vitest'

const { bearerGetUser, cookieGetUser, createClientMock, createServerSupabaseClientMock } = vi.hoisted(() => {
  const bearerGetUser = vi.fn()
  const cookieGetUser = vi.fn()
  return {
    bearerGetUser,
    cookieGetUser,
    createClientMock: vi.fn(() => ({ auth: { getUser: bearerGetUser } })),
    createServerSupabaseClientMock: vi.fn(async () => ({ auth: { getUser: cookieGetUser } })),
  }
})

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/server-client', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

import { requireApiUser } from './api-auth'

// Three dot-separated segments: JWT-shaped, but only Supabase Auth (mocked here) can accept it.
const JWT = ['header', 'payload', 'signature'].join('.')
const USER = { id: 'user-uuid-1', email: 'runner@example.com' }
const NO_USER = { data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } }

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://runsmart.test/api/chat', { method: 'POST', headers })
}

describe('requireApiUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    bearerGetUser.mockResolvedValue(NO_USER)
    cookieGetUser.mockResolvedValue(NO_USER)
  })

  it('returns 401 AUTH_REQUIRED when there is no bearer token and no cookie session', async () => {
    const result = await requireApiUser(request())

    expect(result.user).toBeUndefined()
    expect(result.response?.status).toBe(401)
    await expect(result.response?.json()).resolves.toMatchObject({ code: 'AUTH_REQUIRED' })
  })

  it('accepts a bearer JWT only after Supabase Auth validates it server-side', async () => {
    bearerGetUser.mockResolvedValue({ data: { user: USER }, error: null })

    const result = await requireApiUser(request({ Authorization: `Bearer ${JWT}` }))

    expect(result.response).toBeUndefined()
    expect(result.user).toEqual(USER)
    expect(bearerGetUser).toHaveBeenCalledWith(JWT)
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('rejects a bearer JWT that Supabase Auth does not recognise when there is no cookie session', async () => {
    const result = await requireApiUser(request({ Authorization: `Bearer ${JWT}` }))

    expect(result.response?.status).toBe(401)
    expect(bearerGetUser).toHaveBeenCalledWith(JWT)
  })

  it('does not treat a non-JWT bearer value (the web chat sends "Bearer user-<id>") as a session', async () => {
    const result = await requireApiUser(request({ Authorization: 'Bearer user-5', 'x-user-id': '5' }))

    expect(result.response?.status).toBe(401)
    expect(bearerGetUser).not.toHaveBeenCalled()
  })

  it('falls through a non-JWT bearer value to a valid cookie session', async () => {
    cookieGetUser.mockResolvedValue({ data: { user: USER }, error: null })

    const result = await requireApiUser(request({ Authorization: 'Bearer user-5' }))

    expect(result.response).toBeUndefined()
    expect(result.user).toEqual(USER)
  })

  it('falls through an invalid bearer JWT to a valid cookie session', async () => {
    cookieGetUser.mockResolvedValue({ data: { user: USER }, error: null })

    const result = await requireApiUser(request({ Authorization: `Bearer ${JWT}` }))

    expect(result.user).toEqual(USER)
  })

  it('accepts a cookie session validated by Supabase Auth', async () => {
    cookieGetUser.mockResolvedValue({ data: { user: USER }, error: null })

    const result = await requireApiUser(request({ cookie: 'sb-test-auth-token=base64-abc' }))

    expect(result.user).toEqual(USER)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('rejects when getUser returns an error alongside a user object', async () => {
    cookieGetUser.mockResolvedValue({ data: { user: USER }, error: { message: 'JWT expired' } })

    const result = await requireApiUser(request())

    expect(result.response?.status).toBe(401)
  })

  it('fails closed when Supabase Auth throws', async () => {
    bearerGetUser.mockRejectedValue(new Error('network down'))
    cookieGetUser.mockRejectedValue(new Error('network down'))

    const result = await requireApiUser(request({ Authorization: `Bearer ${JWT}` }))

    expect(result.response?.status).toBe(401)
  })

  it('fails closed when Supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    cookieGetUser.mockResolvedValue({ data: { user: USER }, error: null })

    const result = await requireApiUser(request({ Authorization: `Bearer ${JWT}` }))

    expect(result.response?.status).toBe(401)
    expect(createClientMock).not.toHaveBeenCalled()
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled()
  })

  it('does not accept a user id from headers or body as proof of identity', async () => {
    const result = await requireApiUser(
      new Request('https://runsmart.test/api/chat', {
        method: 'POST',
        headers: { 'x-user-id': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1 }),
      })
    )

    expect(result.response?.status).toBe(401)
  })
})
