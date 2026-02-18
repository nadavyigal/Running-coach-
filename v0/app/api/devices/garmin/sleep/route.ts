import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';

// GET - Fetch Garmin sleep data via the Connect Developer Health API
// Client reads access token from Dexie.js and passes via Authorization: Bearer <token>
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

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

    const url = new URL(`${GARMIN_API_BASE}/wellness-api/rest/sleep`);
    url.searchParams.set('startTimeInSeconds', String(startTime));
    url.searchParams.set('endTimeInSeconds', String(endTime));

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
      logger.error(`Garmin sleep API error ${response.status}:`, errorBody);
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

    // Map Garmin Wellness API sleep fields → RunSmart format
    const sleepRecords = raw
      .map((s: any) => {
        const calendarDate: string | null = s.calendarDate ?? null;
        if (!calendarDate) return null;

        return {
          date: calendarDate,                                                  // YYYY-MM-DD
          sleepStartTimestampGMT: s.startTimeInSeconds
            ? s.startTimeInSeconds * 1000
            : null,
          sleepEndTimestampGMT: s.startTimeInSeconds && s.durationInSeconds
            ? (s.startTimeInSeconds + s.durationInSeconds) * 1000
            : null,
          totalSleepSeconds: s.durationInSeconds ?? null,
          deepSleepSeconds: s.deepSleepDurationInSeconds ?? null,
          lightSleepSeconds: s.lightSleepDurationInSeconds ?? null,
          remSleepSeconds: s.remSleepInSeconds ?? null,
          awakeSleepSeconds: s.awakeDurationInSeconds ?? null,
          sleepScores: s.overallSleepScore
            ? { overall: { value: s.overallSleepScore?.value ?? s.overallSleepScore } }
            : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, sleep: sleepRecords });
  } catch (error) {
    logger.error('Garmin sleep fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sleep data from Garmin' },
      { status: 500 }
    );
  }
}
