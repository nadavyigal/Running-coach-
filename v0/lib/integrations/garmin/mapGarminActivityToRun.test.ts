import { describe, expect, it } from 'vitest'

import { mapGarminActivityToRun } from '@/lib/integrations/garmin/mapGarminActivityToRun'
import type { GarminNormalizedActivity } from '@/lib/integrations/garmin/types'

describe('mapGarminActivityToRun', () => {
  it('maps a Garmin activity into the canonical run shape', () => {
    const activity: GarminNormalizedActivity = {
      activityId: 'garmin-run-1',
      sourceProvider: 'garmin',
      sourceExternalId: 'summary-1',
      sourcePayloadRef: 'garmin_webhook_events:evt-1',
      name: 'Morning Run',
      typeKey: 'running',
      startTime: '2026-03-01T06:30:00.000Z',
      timezone: 'UTC',
      distanceMeters: 10250,
      durationSeconds: 3120,
      movingDurationSeconds: 3000,
      averagePaceSecondsPerKm: 293,
      elevationGainMeters: 82,
      averageHeartRate: 151,
      maxHeartRate: 172,
      calories: 712,
      routePoints: [{ lat: 32.1, lng: 34.8 }],
      polyline: null,
      lapSummaries: [{ lap: 1 }],
      splitSummaries: [{ split: 1 }],
      raw: { activityId: 'garmin-run-1' },
    }

    const mapped = mapGarminActivityToRun(activity, {
      profileId: 'profile-1',
    })

    expect(mapped).toMatchObject({
      profile_id: 'profile-1',
      type: 'easy',
      distance: 10.25,
      duration: 3000,
      pace: 293,
      heart_rate: 151,
      calories: 712,
      completed_at: '2026-03-01T06:30:00.000Z',
      source_provider: 'garmin',
      source_activity_id: 'garmin-run-1',
      source_external_id: 'summary-1',
      source_payload_ref: 'garmin_webhook_events:evt-1',
    })
    expect(mapped.route).toEqual([{ lat: 32.1, lng: 34.8 }])
  })
})
