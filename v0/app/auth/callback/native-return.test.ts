import { describe, expect, it } from 'vitest'

import { nativeReturnURL } from './native-return'
import { GET } from './route'

describe('nativeReturnURL', () => {
  it('returns an iOS PKCE code to the fixed RunSmart callback', () => {
    const request = new URL(
      'https://www.runsmart-ai.com/auth/callback?source=ios&code=pkce-code&type=signup',
    )

    expect(nativeReturnURL(request)?.toString()).toBe(
      'runsmart://auth/callback?code=pkce-code&type=signup',
    )
  })

  it('returns Supabase callback errors so the app can recover visibly', () => {
    const request = new URL(
      'https://www.runsmart-ai.com/auth/callback?source=ios&error=access_denied&error_code=otp_expired&error_description=Email+link+expired',
    )

    expect(nativeReturnURL(request)?.toString()).toBe(
      'runsmart://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+expired',
    )
  })

  it('does not change ordinary web callbacks or accept another source', () => {
    expect(
      nativeReturnURL(
        new URL('https://www.runsmart-ai.com/auth/callback?code=web-code'),
      ),
    ).toBeNull()
    expect(
      nativeReturnURL(
        new URL(
          'https://www.runsmart-ai.com/auth/callback?source=https://attacker.example&code=web-code',
        ),
      ),
    ).toBeNull()
  })
})

describe('iOS callback route fallback', () => {
  it('redirects to the app before attempting a server-side PKCE exchange', async () => {
    const response = await GET(
      new Request(
        'https://www.runsmart-ai.com/auth/callback?source=ios&code=pkce-code&type=signup',
      ),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'runsmart://auth/callback?code=pkce-code&type=signup',
    )
  })
})
