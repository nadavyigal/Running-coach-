import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET - Fetch Garmin sleep data for a date range
// Client reads access token from Dexie.js and passes via Authorization: Bearer <token>
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    // Date range: default last 7 days
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

    // Build date list: today going back <days> days
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }

    // Fetch each day in parallel (Garmin sleep endpoint is per-day)
    const results = await Promise.allSettled(
      dates.map(async (date) => {
        const res = await fetch(
          `https://connect.garmin.com/wellness-service/wellness/dailySleepData?date=${date}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (res.status === 401) {
          throw Object.assign(new Error('Token expired'), { needsReauth: true });
        }

        if (!res.ok) {
          // No data for this date — skip silently
          return null;
        }

        const data = await res.json();
        return { date, data };
      })
    );

    // Check if any result was a 401
    const reauth = results.some(
      (r) => r.status === 'rejected' && (r.reason as any)?.needsReauth
    );
    if (reauth) {
      return NextResponse.json(
        { success: false, error: 'Authentication expired, please reconnect Garmin', needsReauth: true },
        { status: 401 }
      );
    }

    const sleepRecords = results
      .filter((r): r is PromiseFulfilledResult<{ date: string; data: any } | null> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map((r) => {
        const { date, data } = r.value!;
        const daily = data?.dailySleepDTO;
        if (!daily) return null;

        return {
          date,
          sleepStartTimestampGMT: daily.sleepStartTimestampGMT,
          sleepEndTimestampGMT: daily.sleepEndTimestampGMT,
          totalSleepSeconds: daily.sleepTimeSeconds,          // seconds
          deepSleepSeconds: daily.deepSleepSeconds,
          lightSleepSeconds: daily.lightSleepSeconds,
          remSleepSeconds: daily.remSleepSeconds,
          awakeSleepSeconds: daily.awakeSleepSeconds,
          sleepScores: daily.sleepScores,                    // { overall, rem, deep, light, awakenings }
          restlessCount: daily.restlessCount,
          restlessMomentCount: daily.restlessMomentCount,
          sleepWindowConfirmationType: daily.sleepWindowConfirmationType,
          averageSpO2Value: daily.averageSpO2Value,
          averageRespirationValue: daily.averageRespirationValue,
          averageStressLevel: daily.averageStressLevel,
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
