import { afterEach, describe, expect, it } from 'vitest'

import { generateSignedState, verifyAndParseState } from './oauth-state'

describe('Garmin OAuth signed state', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('round trips the PKCE verifier and ownership context', () => {
    process.env.ENCRYPTION_KEY = 'test-state-secret-at-least-32-chars'

    const state = generateSignedState(
      42,
      'runsmart://garmin/connected',
      'pkce-verifier',
      'auth-user-1',
      'profile-1'
    )

    expect(verifyAndParseState(state)).toMatchObject({
      userId: 42,
      authUserId: 'auth-user-1',
      profileId: 'profile-1',
      redirectUri: 'runsmart://garmin/connected',
      codeVerifier: 'pkce-verifier',
    })
  })

  it('keeps legacy state compact when ownership context is unavailable', () => {
    process.env.ENCRYPTION_KEY = 'test-state-secret-at-least-32-chars'

    const state = generateSignedState(
      42,
      'https://runsmart-ai.com/garmin/callback',
      'pkce-verifier',
      null,
      null
    )
    const payload = verifyAndParseState(state)

    expect(payload).toMatchObject({
      userId: 42,
      redirectUri: 'https://runsmart-ai.com/garmin/callback',
      codeVerifier: 'pkce-verifier',
    })
    expect(payload).not.toHaveProperty('authUserId')
    expect(payload).not.toHaveProperty('profileId')
  })
})
