import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 7;

function parseDaysParam(rawDays: string | null): number {
  const parsed = Number.parseInt(rawDays ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS;
  return Math.min(parsed, MAX_DAYS);
}

// GET - Fetch Garmin sleep data via the Connect Developer Health API
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
      const url = new URL(`${GARMIN_API_BASE}/wellness-api/rest/sleep`);
      url.searchParams.set('startTimeInSeconds', String(windowStart));
      url.searchParams.set('endTimeInSeconds', String(windowEnd));

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
        logger.error(`Garmin sleep API error ${response.status}:`, responseText);
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
        logger.error('Garmin sleep: unexpected response shape:', rawChunk);
        return NextResponse.json(
          { success: false, error: 'Unexpected response from Garmin API', detail: JSON.stringify(rawChunk) },
          { status: 502 }
        );
      }

      rawChunks.push(...rawChunk);
      windowStart = windowEnd + 1;
    }

    // Deduplicate in case records overlap across windows.
    const seenSleepIds = new Set<string>();
    const raw = rawChunks.filter((s: any) => {
      const fallbackId = `${s.calendarDate ?? 'none'}-${s.startTimeInSeconds ?? 'none'}`;
      const key = String(s.sleepSummaryId ?? fallbackId);
      if (seenSleepIds.has(key)) return false;
      seenSleepIds.add(key);
      return true;
    });

    // Map Garmin Wellness API sleep fields -> RunSmart format
    const sleepRecords = raw
      .map((s: any) => {
        const calendarDate: string | null = s.calendarDate ?? null;
        if (!calendarDate) return null;

        return {
          date: calendarDate,
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
