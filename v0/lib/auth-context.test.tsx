import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
  getSession: vi.fn(),
  authListener: { current: null as null | ((event: string, session: unknown) => Promise<void> | void) },
}))

vi.mock('@/lib/analytics-identity', () => ({
  identifyUser: (...args: unknown[]) => mocks.identifyUser(...args),
  resetIdentity: (...args: unknown[]) => mocks.resetIdentity(...args),
}))

vi.mock('@/lib/supabase/client', () => {
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    single: async () => ({ data: { id: 'profile-1' }, error: null }),
  }
  const client = {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mocks.authListener.current = callback
        return { data: { subscription: { unsubscribe: () => undefined } } }
      },
    },
    from: () => profileQuery,
  }
  return { createClient: () => client }
})

import { AuthProvider } from './auth-context'

const session = (id: string) => ({ user: { id, email: `${id}@example.com` } })

async function emit(event: string, value: unknown) {
  await act(async () => {
    await mocks.authListener.current?.(event, value)
  })
}

describe('AuthProvider PostHog identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authListener.current = null
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null }), { status: 200 })))
  })

  it('identifies the user on SIGNED_IN', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    render(<AuthProvider><div /></AuthProvider>)
    await waitFor(() => expect(mocks.authListener.current).not.toBeNull())

    await emit('SIGNED_IN', session('user-uuid-1'))

    await waitFor(() => expect(mocks.identifyUser).toHaveBeenCalledWith('user-uuid-1'))
    expect(mocks.resetIdentity).not.toHaveBeenCalled()
  })

  it('identifies a returning user on initial session restore, before any auth event', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session('returning-uuid') }, error: null })

    render(<AuthProvider><div /></AuthProvider>)

    await waitFor(() => expect(mocks.identifyUser).toHaveBeenCalledWith('returning-uuid'))
  })

  it('identifies a user restored from the server cookie fallback', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ user: { id: 'cookie-uuid' }, profileId: 'p' }), { status: 200 }))
    )

    render(<AuthProvider><div /></AuthProvider>)

    await waitFor(() => expect(mocks.identifyUser).toHaveBeenCalledWith('cookie-uuid'))
  })

  it('does not re-identify on token refresh for the same user', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session('user-uuid-2') }, error: null })
    render(<AuthProvider><div /></AuthProvider>)
    await waitFor(() => expect(mocks.identifyUser).toHaveBeenCalledTimes(1))

    await emit('TOKEN_REFRESHED', session('user-uuid-2'))
    await emit('SIGNED_IN', session('user-uuid-2'))

    expect(mocks.identifyUser).toHaveBeenCalledTimes(1)
  })

  it('resets identity on SIGNED_OUT', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session('user-uuid-3') }, error: null })
    render(<AuthProvider><div /></AuthProvider>)
    await waitFor(() => expect(mocks.identifyUser).toHaveBeenCalledWith('user-uuid-3'))

    await emit('SIGNED_OUT', null)

    await waitFor(() => expect(mocks.resetIdentity).toHaveBeenCalledTimes(1))
  })

  it('never resets an anonymous visitor who was not signed in', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    render(<AuthProvider><div /></AuthProvider>)
    await waitFor(() => expect(mocks.authListener.current).not.toBeNull())

    await emit('INITIAL_SESSION', null)

    expect(mocks.resetIdentity).not.toHaveBeenCalled()
    expect(mocks.identifyUser).not.toHaveBeenCalled()
  })
})
