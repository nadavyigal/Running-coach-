export type GarminCredentialMode = 'commercial' | 'internal-test'

interface GarminClientIdResult {
  clientId: string
  mode: GarminCredentialMode
}

interface GarminClientCredentialsResult extends GarminClientIdResult {
  clientSecret: string
}

function normalizedEnv(name: string): string {
  switch (name) {
    case 'GARMIN_CLIENT_ID':
      return process.env.GARMIN_CLIENT_ID?.trim() ?? ''
    case 'GARMIN_CLIENT_SECRET':
      return process.env.GARMIN_CLIENT_SECRET?.trim() ?? ''
    case 'GARMIN_TEST_CLIENT_ID':
      return process.env.GARMIN_TEST_CLIENT_ID?.trim() ?? ''
    case 'GARMIN_TEST_CLIENT_SECRET':
      return process.env.GARMIN_TEST_CLIENT_SECRET?.trim() ?? ''
    case 'GARMIN_USE_TEST_CREDENTIALS':
      return process.env.GARMIN_USE_TEST_CREDENTIALS?.trim() ?? ''
    case 'GARMIN_CREDENTIAL_SET':
      return process.env.GARMIN_CREDENTIAL_SET?.trim() ?? ''
    default:
      return ''
  }
}

function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

function explicitlyRequestsTestCredentials(): boolean {
  const credentialSet = normalizedEnv('GARMIN_CREDENTIAL_SET').toLowerCase()
  return (
    normalizedEnv('GARMIN_USE_TEST_CREDENTIALS').toLowerCase() === 'true' ||
    credentialSet === 'test' ||
    credentialSet === 'internal-test' ||
    credentialSet === 'evaluation'
  )
}

function assertProductionIsNotUsingTestCredentials(clientId: string): void {
  if (!isProductionRuntime()) return

  const testClientId = normalizedEnv('GARMIN_TEST_CLIENT_ID')
  if (explicitlyRequestsTestCredentials()) {
    throw new Error('Production Garmin OAuth cannot use internal-test credentials')
  }

  if (testClientId && clientId === testClientId) {
    throw new Error('Production Garmin OAuth client ID matches GARMIN_TEST_CLIENT_ID')
  }
}

export function resolveGarminOAuthClientId(): GarminClientIdResult {
  const commercialClientId = normalizedEnv('GARMIN_CLIENT_ID')
  const testClientId = normalizedEnv('GARMIN_TEST_CLIENT_ID')
  const useTestCredentials = explicitlyRequestsTestCredentials()

  if (isProductionRuntime()) {
    if (!commercialClientId) {
      throw new Error('Garmin OAuth client ID is not configured')
    }
    assertProductionIsNotUsingTestCredentials(commercialClientId)
    return { clientId: commercialClientId, mode: 'commercial' }
  }

  if (useTestCredentials || testClientId) {
    if (!testClientId) {
      throw new Error('GARMIN_TEST_CLIENT_ID is not configured')
    }
    return { clientId: testClientId, mode: 'internal-test' }
  }

  if (!commercialClientId) {
    throw new Error('Garmin OAuth client ID is not configured')
  }

  return { clientId: commercialClientId, mode: 'commercial' }
}

export function resolveGarminOAuthClientCredentials(): GarminClientCredentialsResult {
  const { clientId, mode } = resolveGarminOAuthClientId()
  const commercialClientSecret = normalizedEnv('GARMIN_CLIENT_SECRET')
  const testClientSecret = normalizedEnv('GARMIN_TEST_CLIENT_SECRET')

  if (mode === 'internal-test') {
    if (!testClientSecret) {
      throw new Error('GARMIN_TEST_CLIENT_SECRET is not configured')
    }
    return { clientId, clientSecret: testClientSecret, mode }
  }

  if (!commercialClientSecret) {
    throw new Error('Garmin OAuth client secret is not configured')
  }

  return { clientId, clientSecret: commercialClientSecret, mode }
}
