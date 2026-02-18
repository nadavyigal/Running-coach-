import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 7;

type GarminSleepSource = 'sleep-upload' | 'sleep-backfill';
type GarminSleepQueryMode = 'upload' | 'backfill';

class GarminSleepUpstreamError extends Error {
  status: number;
  body: string;
  source: GarminSleepSource;

  constructor(source: GarminSleepSource, status: number, body: string) {
    super(`Garmin ${source} API returned ${status}`);
    this.name = 'GarminSleepUpstreamError';
    this.status = status;
    this.body = body;
    this.source = source;
  }
}

function parseDaysParam(rawDays: string | null): number {
  const parsed = Number.parseInt(rawDays ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS;
  return Math.min(parsed, MAX_DAYS);
}

function summarizeUpstreamBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as {
      errorMessage?: unknown;
      message?: unknown;
      error?: unknown;
    };
    const message = [parsed.errorMessage, parsed.message, parsed.error].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (message) return message.slice(0, 500);
  } catch {
    // Ignore JSON parse errors and fall through to text heuristics.
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page';
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

function parseJsonArray(text: string): any[] {
  if (!text) return [];
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function isInvalidPullToken(body: string): boolean {
  return /InvalidPullTokenException|invalid pull token/i.test(body);
}

function isMissingTimeRange(body: string): boolean {
  return /Missing time range parameters/i.test(body);
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /Unable to read oAuth header|invalid[_ ]token|expired|unauthorized/i.test(body);
}

function isFallbackWorthyWellnessStatus(status: number): boolean {
  return status === 400 || status === 404;
}

function isSleepPermissionNotEnabled(status: number, body: string): boolean {
  if (/Endpoint not enabled for summary type:\s*CONNECT_SLEEP/i.test(body)) return true;
  // Garmin may return 404 for sleep endpoints when sleep export is not provisioned/enabled.
  if (status === 404 && /\/wellness-api\/rest\/(backfill\/)?sleep/i.test(body)) return true;
  return false;
}

async function fetchSleepData(
  accessToken: string,
  startTime: number,
  endTime: number,
  mode: GarminSleepQueryMode
): Promise<any[]> {
  const source: GarminSleepSource = mode === 'upload' ? 'sleep-upload' : 'sleep-backfill';
  const rawChunks: any[] = [];
  let windowStart = startTime;

  while (windowStart <= endTime) {
    const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime);
    const path = mode === 'upload' ? '/wellness-api/rest/sleep' : '/wellness-api/rest/backfill/sleep';
    const url = new URL(`${GARMIN_API_BASE}${path}`);

    if (mode === 'upload') {
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart));
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd));
    } else {
      url.searchParams.set('summaryStartTimeInSeconds', String(windowStart));
      url.searchParams.set('summaryEndTimeInSeconds', String(windowEnd));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new GarminSleepUpstreamError(source, response.status, responseText);
    }

    rawChunks.push(...parseJsonArray(responseText));
    windowStart = windowEnd + 1;
  }

  return rawChunks;
}

// GET - Fetch Garmin sleep data via the Connect Developer Health API.
// If upload-window params fail (InvalidPullTokenException or related 400/404),
// retry via backfill/summary-window params before requesting reconnect.
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

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = Math.max(0, endTime - days * 86400 + 1);

    let source: GarminSleepSource = 'sleep-upload';
    let rawChunks: any[];

    try {
      rawChunks = await fetchSleepData(accessToken, startTime, endTime, 'upload');
    } catch (error) {
      if (
        error instanceof GarminSleepUpstreamError &&
        error.source === 'sleep-upload' &&
        (
          isInvalidPullToken(error.body) ||
          isMissingTimeRange(error.body) ||
          isFallbackWorthyWellnessStatus(error.status)
        )
      ) {
        logger.warn(
          `Garmin upload-window sleep request failed (${error.status}); retrying with backfill summary-window params`
        );
        source = 'sleep-backfill';
        rawChunks = await fetchSleepData(accessToken, startTime, endTime, 'backfill');
      } else {
        throw error;
      }
    }

    const seenSleepIds = new Set<string>();
    const raw = rawChunks.filter((s: any) => {
      const fallbackId = `${s.calendarDate ?? 'none'}-${s.startTimeInSeconds ?? 'none'}`;
      const key = String(s.sleepSummaryId ?? fallbackId);
      if (seenSleepIds.has(key)) return false;
      seenSleepIds.add(key);
      return true;
    });

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

    return NextResponse.json({ success: true, source, sleep: sleepRecords });
  } catch (error) {
    if (error instanceof GarminSleepUpstreamError) {
      const detail = summarizeUpstreamBody(error.body);
      const needsReauth = isAuthError(error.status, error.body);

      if (needsReauth) {
        return NextResponse.json(
          {
            success: false,
            error: 'Garmin authentication expired or invalid, please reconnect Garmin',
            needsReauth: true,
            source: error.source,
            detail,
          },
          { status: 401 }
        );
      }

      if (isSleepPermissionNotEnabled(error.status, error.body)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Garmin sleep sharing permission is not enabled for this app',
            source: error.source,
            requiredPermissions: ['HEALTH_EXPORT'],
            detail,
            action:
              'Enable sleep/health sharing for RunSmart in Garmin Connect and reconnect Garmin.',
          },
          { status: 403 }
        );
      }

      logger.error(`Garmin ${error.source} sleep API error ${error.status}:`, detail);
      return NextResponse.json(
        {
          success: false,
          error: `Garmin API returned ${error.status}`,
          source: error.source,
          detail,
        },
        { status: 502 }
      );
    }

    logger.error('Garmin sleep fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sleep data from Garmin' },
      { status: 500 }
    );
  }
}
