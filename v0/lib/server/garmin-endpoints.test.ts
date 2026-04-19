import { describe, expect, it } from 'vitest'

import {
  GARMIN_CONNECT_API_BASE_URL,
  GARMIN_HEALTH_API_BASE_URL,
  GARMIN_OAUTH_AUTHORIZE_URL,
  GARMIN_OAUTH_REVOKE_URL,
  GARMIN_OAUTH_TOKEN_URL,
  GARMIN_PERMISSIONS_URL,
  GARMIN_PROFILE_URL,
  GARMIN_WEB_BASE_URL,
} from './garmin-endpoints'

describe('garmin endpoint configuration', () => {
  it('uses Garmin Connect API host for token and revoke endpoints', () => {
    expect(new URL(GARMIN_CONNECT_API_BASE_URL).origin).toBe('https://connectapi.garmin.com')
    expect(new URL(GARMIN_OAUTH_TOKEN_URL).origin).toBe('https://connectapi.garmin.com')
    expect(new URL(GARMIN_OAUTH_REVOKE_URL).origin).toBe('https://connectapi.garmin.com')
  })

  it('keeps auth UI and health export endpoints on the documented Garmin hosts', () => {
    expect(new URL(GARMIN_WEB_BASE_URL).origin).toBe('https://connect.garmin.com')
    expect(new URL(GARMIN_OAUTH_AUTHORIZE_URL).origin).toBe('https://connect.garmin.com')
    expect(new URL(GARMIN_HEALTH_API_BASE_URL).origin).toBe('https://apis.garmin.com')
    expect(new URL(GARMIN_PROFILE_URL).origin).toBe('https://apis.garmin.com')
    expect(new URL(GARMIN_PERMISSIONS_URL).origin).toBe('https://apis.garmin.com')
  })
})
