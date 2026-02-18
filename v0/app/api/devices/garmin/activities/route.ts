import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Garmin Connect Developer API base
// Ref: developerportal.garmin.com — Activity API + Health API
const GARMIN_API_BASE = 'https://apis.garmin.com';

// GET - Fetch Garmin activities via the Connect Developer API
// Client reads access token from Dexie.js and passes via Authorization: Bearer <token>
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = Math.min(parseInt(searchParams.get('days') || '14'), 30);
    const limit = Math.min(parseInt(searchParams.get('limit') || '40'), 100);

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization token required', needsReauth: true },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    // Build Unix timestamp range
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 86400;

    const url = new URL(`${GARMIN_API_BASE}/wellness-api/rest/activities`);
    url.searchParams.set('uploadStartTimeInSeconds', String(startTime));
    url.searchParams.set('uploadEndTimeInSeconds', String(endTime));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      return NextResponse.json(
        { success: false, error: 'Authentication expired, please reconnect Garmin', needsReauth: true },
        { status: 401 }
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Garmin activities API error ${response.status}:`, errorBody);
      return NextResponse.json(
        {
          success: false,
          error: `Garmin API returned ${response.status}`,
          detail: errorBody,
        },
        { status: 502 }
      );
    }

    const raw: any[] = await response.json();

    // Map Garmin Wellness API activity fields → RunSmart format
    const activities = raw.map((a: any) => ({
      activityId: a.activityId ?? a.summaryId,
      activityName: a.activityName ?? a.activityType ?? 'Garmin Activity',
      activityType: (a.activityType ?? '').toLowerCase().replace(/ /g, '_'), // e.g. "RUNNING" → "running"
      startTimeGMT: a.startTimeInSeconds
        ? new Date(a.startTimeInSeconds * 1000).toISOString()
        : null,
      distance: a.distanceInMeters ? a.distanceInMeters / 1000 : 0,          // → km
      duration: a.durationInSeconds ?? 0,                                     // seconds
      averageHR: a.averageHeartRateInBeatsPerMinute ?? null,
      maxHR: a.maxHeartRateInBeatsPerMinute ?? null,
      calories: a.activeKilocalories ?? null,
      // averageSpeed in m/s → pace in s/km
      averagePace: a.averageSpeedInMetersPerSecond
        ? Math.round(1000 / a.averageSpeedInMetersPerSecond)
        : null,
      elevationGain: a.totalElevationGainInMeters ?? null,
    }));

    const runningActivities = activities.filter(
      (a) => a.activityType.includes('running') || a.activityType.includes('run')
    );

    return NextResponse.json({
      success: true,
      activities: runningActivities,
      allActivities: activities.length,
      runningCount: runningActivities.length,
    });
  } catch (error) {
    logger.error('Garmin activities fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activities from Garmin' },
      { status: 500 }
    );
  }
}
