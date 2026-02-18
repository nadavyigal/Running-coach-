import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Garmin Health API (Developer Program)
// Docs: https://developer.garmin.com/health-api/overview/
const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 14;

function parseDaysParam(rawDays: string | null): number {
  const parsed = Number.parseInt(rawDays ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS;
  return Math.min(parsed, MAX_DAYS);
}

// GET - Fetch Garmin activities via the Wellness API
// Client reads access token from Dexie.js and passes via Authorization: Bearer <token>
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = parseDaysParam(searchParams.get('days'));

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

    // Garmin rejects windows over 86400 seconds, so fetch in day-sized chunks.
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = Math.max(0, endTime - days * 86400 + 1);

    const rawChunks: any[] = [];
    let windowStart = startTime;

    while (windowStart <= endTime) {
      const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime);
      const url = new URL(`${GARMIN_API_BASE}/wellness-api/rest/activities`);
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart));
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Authentication expired, please reconnect Garmin', needsReauth: true },
          { status: 401 }
        );
      }

      const responseText = await response.text();
      if (!response.ok) {
        logger.error(`Garmin activities API error ${response.status}:`, responseText);
        return NextResponse.json(
          {
            success: false,
            error: `Garmin API returned ${response.status}`,
            detail: responseText,
          },
          { status: 502 }
        );
      }

      let rawChunk: unknown;
      try {
        rawChunk = responseText ? JSON.parse(responseText) : [];
      } catch {
        rawChunk = [];
      }

      if (!Array.isArray(rawChunk)) {
        logger.error('Garmin activities: unexpected response shape:', rawChunk);
        return NextResponse.json(
          { success: false, error: 'Unexpected response from Garmin API', detail: JSON.stringify(rawChunk) },
          { status: 502 }
        );
      }

      rawChunks.push(...rawChunk);
      windowStart = windowEnd + 1;
    }

    // Deduplicate in case an activity appears across adjacent windows.
    const seenActivityIds = new Set<string>();
    const raw = rawChunks.filter((a: any) => {
      const fallbackId = `${a.startTimeInSeconds ?? 'none'}-${a.durationInSeconds ?? 'none'}-${a.activityType ?? 'unknown'}`;
      const activityId = String(a.activityId ?? a.summaryId ?? fallbackId);
      if (seenActivityIds.has(activityId)) return false;
      seenActivityIds.add(activityId);
      return true;
    });

    // Map Garmin Wellness API activity fields -> RunSmart format
    const activities = raw.map((a: any) => ({
      activityId: a.activityId ?? a.summaryId,
      activityName: a.activityName ?? a.activityType ?? 'Garmin Activity',
      // Garmin returns activityType in various cases - normalize to lowercase_underscored
      activityType: (a.activityType ?? '').toLowerCase().replace(/ /g, '_'),
      startTimeGMT: a.startTimeInSeconds
        ? new Date(a.startTimeInSeconds * 1000).toISOString()
        : null,
      distance: a.distanceInMeters ? a.distanceInMeters / 1000 : 0,
      duration: a.durationInSeconds ?? 0,
      averageHR: a.averageHeartRateInBeatsPerMinute ?? null,
      maxHR: a.maxHeartRateInBeatsPerMinute ?? null,
      calories: a.activeKilocalories ?? null,
      // averageSpeed in m/s -> pace in s/km
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
