import { afterEach, describe, expect, it } from 'vitest'

import {
  resolveGarminOAuthClientCredentials,
  resolveGarminOAuthClientId,
} from './garmin-credentials'

function clearGarminEnv() {
  delete process.env.GARMIN_CLIENT_ID
  delete process.env.GARMIN_CLIENT_SECRET
  delete process.env.GARMIN_TEST_CLIENT_ID
  delete process.env.GARMIN_TEST_CLIENT_SECRET
  delete process.env.GARMIN_USE_TEST_CREDENTIALS
  delete process.env.GARMIN_CREDENTIAL_SET
  delete process.env.NODE_ENV
  delete process.env.VERCEL_ENV
}

describe('Garmin credential resolution', () => {
  afterEach(() => {
    clearGarminEnv()
  })

  it('uses commercial credentials in production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.GARMIN_CLIENT_ID = 'commercial-client-id'
    process.env.GARMIN_CLIENT_SECRET = 'commercial-client-secret'
    process.env.GARMIN_TEST_CLIENT_ID = 'test-client-id'
    process.env.GARMIN_TEST_CLIENT_SECRET = 'test-client-secret'

    expect(resolveGarminOAuthClientCredentials()).toEqual({
      clientId: 'commercial-client-id',
      clientSecret: 'commercial-client-secret',
      mode: 'commercial',
    })
  })

  it('fails closed when production explicitly selects test credentials', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.GARMIN_CLIENT_ID = 'commercial-client-id'
    process.env.GARMIN_CLIENT_SECRET = 'commercial-client-secret'
    process.env.GARMIN_USE_TEST_CREDENTIALS = 'true'

    expect(() => resolveGarminOAuthClientId()).toThrow(
      'Production Garmin OAuth cannot use internal-test credentials'
    )
  })

  it('fails closed when production client ID matches the internal-test client ID', () => {
    process.env.NODE_ENV = 'production'
    process.env.GARMIN_CLIENT_ID = 'same-client-id'
    process.env.GARMIN_CLIENT_SECRET = 'commercial-client-secret'
    process.env.GARMIN_TEST_CLIENT_ID = 'same-client-id'

    expect(() => resolveGarminOAuthClientCredentials()).toThrow(
      'Production Garmin OAuth client ID matches GARMIN_TEST_CLIENT_ID'
    )
  })

  it('prefers internal-test credentials outside production when configured', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.GARMIN_CLIENT_ID = 'commercial-client-id'
    process.env.GARMIN_CLIENT_SECRET = 'commercial-client-secret'
    process.env.GARMIN_TEST_CLIENT_ID = 'test-client-id'
    process.env.GARMIN_TEST_CLIENT_SECRET = 'test-client-secret'

    expect(resolveGarminOAuthClientCredentials()).toEqual({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      mode: 'internal-test',
    })
  })
})
