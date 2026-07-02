import { describe, expect, it } from 'vitest'
import { GARMIN_CONNECT_DISABLED_MESSAGE, isGarminConnectEnabled } from './garmin-connect-gate'

describe('Garmin connect gate', () => {
  it('defaults off in production', () => {
    expect(isGarminConnectEnabled({ NODE_ENV: 'production' })).toBe(false)
  })

  it('allows an explicit production enablement', () => {
    expect(isGarminConnectEnabled({ NODE_ENV: 'production', GARMIN_CONNECT_ENABLED: 'true' })).toBe(true)
  })

  it('allows local and test environments by default', () => {
    expect(isGarminConnectEnabled({ NODE_ENV: 'test' })).toBe(true)
  })

  it('keeps the required disabled message stable', () => {
    expect(GARMIN_CONNECT_DISABLED_MESSAGE).toBe(
      "Garmin sync is temporarily unavailable while we complete Garmin production approval. Existing activity data remains in RunSmart. We'll notify you when reconnection is available."
    )
  })
})
