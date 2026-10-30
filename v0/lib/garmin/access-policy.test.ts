import { describe, expect, it } from 'vitest'
import { filterGarminWebhookPayload, isGarminDatasetAllowed, isGarminHealthEnabled, isGarminHistoryAllowed, isGarminPullEnabled } from './access-policy'

describe('Garmin product access policy', () => {
  it.each([undefined, '', 'starter', 'evaluation', 'internal-test', 'unknown'])('denies range pulls and history for tier %s even with a stale grant', (tier) => {
    const env = { GARMIN_ACCESS_TIER: tier }
    expect(isGarminPullEnabled(env)).toBe(false)
    expect(isGarminHistoryAllowed(['ACTIVITY_EXPORT', 'HISTORICAL_DATA_EXPORT'], env)).toBe(false)
  })
  it('requires current history permission as well as explicit Enterprise tier', () => {
    const env = { GARMIN_ACCESS_TIER: 'enterprise' }
    expect(isGarminPullEnabled(env)).toBe(true)
    expect(isGarminHistoryAllowed([], env)).toBe(false)
    expect(isGarminHistoryAllowed(['ACTIVITY_EXPORT'], env)).toBe(false)
    expect(isGarminHistoryAllowed(['HISTORICAL_DATA_EXPORT'], env)).toBe(true)
  })
  it('defaults Health off independently of portal grants or Enterprise tier', () => {
    expect(isGarminHealthEnabled({})).toBe(false)
    expect(isGarminDatasetAllowed('sleeps', { GARMIN_ACCESS_TIER: 'enterprise' })).toBe(false)
    expect(isGarminDatasetAllowed('sleeps', { GARMIN_HEALTH_ENABLED: 'true' })).toBe(true)
    expect(isGarminDatasetAllowed('unknown', { GARMIN_HEALTH_ENABLED: 'true' })).toBe(false)
  })
  it('retains Activity push and file callbacks plus deregistration, dropping wellness and unknown fields', () => {
    const activity = [{ userId: 'g1', activityId: 'a1' }]
    const files = [{ userId: 'g1', callbackURL: 'https://apis.garmin.com/activityFile?id=1' }]
    const dereg = [{ userId: 'g1' }]
    expect(filterGarminWebhookPayload({ activities: activity, activityFiles: files, deregistrations: dereg, sleeps: [{ private: 'health' }], unexpected: 'private' }, {})).toEqual({ activities: activity, activityFiles: files, deregistrations: dereg })
  })
})
