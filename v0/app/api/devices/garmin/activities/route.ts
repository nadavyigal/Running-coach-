import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Garmin Health API (Developer Program)
// Docs: https://developer.garmin.com/health-api/overview/
const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 14;
type GarminSource = 'wellness-upload' | 'wellness-window';
type GarminActivityQueryMode = 'upload' | 'window';

class GarminUpstreamError extends Error {
  status: number;
  body: string;
  source: GarminSource;

  constructor(source: GarminSource, status: number, body: string) {
    super(`Garmin ${source} API returned ${status}`);
    this.name = 'GarminUpstreamError';
    this.source = source;
    this.status = status;
    this.body = body;
  }
}

function parseDaysParam(rawDays: string | null): number {
  const parsed = Number.parseInt(rawDays ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS;
  return Math.min(parsed, MAX_DAYS);
}

function parseJsonArray(text: string): any[] {
  if (!text) return [];
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? parsed : [];
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

function getActivityStartSeconds(activity: any): number | null {
  if (typeof activity?.startTimeInSeconds === 'number') {
    return activity.startTimeInSeconds;
  }

  const dateValue = activity?.startTimeGMT ?? activity?.startTimeLocal ?? null;
  if (!dateValue || typeof dateValue !== 'string') return null;
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function isInvalidPullToken(body: string): boolean {
  return /InvalidPullTokenException|invalid pull token/i.test(body);
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return /Unable to read oAuth header|invalid[_ ]token|expired|unauthorized/i.test(body);
}

function dedupeActivities(rawActivities: any[]): any[] {
  const seen = new Set<string>();
  return rawActivities.filter((activity) => {
    const fallbackId = `${activity.startTimeInSeconds ?? activity.startTimeGMT ?? 'none'}-${activity.durationInSeconds ?? activity.duration ?? 'none'}-${activity.activityType ?? activity.activityType?.typeKey ?? 'unknown'}`;
    const id = String(activity.activityId ?? activity.summaryId ?? fallbackId);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function fetchWellnessActivities(
  accessToken: string,
  startTime: number,
  endTime: number,
  mode: GarminActivityQueryMode
): Promise<any[]> {
  const source: GarminSource = mode === 'upload' ? 'wellness-upload' : 'wellness-window';
  const rawChunks: any[] = [];
  let windowStart = startTime;

  while (windowStart <= endTime) {
    const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime);
    const url = new URL(`${GARMIN_API_BASE}/wellness-api/rest/activities`);
    if (mode === 'upload') {
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart));
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd));
    } else {
      url.searchParams.set('startTimeInSeconds', String(windowStart));
      url.searchParams.set('endTimeInSeconds', String(windowEnd));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new GarminUpstreamError(source, response.status, responseText);
    }

    rawChunks.push(...parseJsonArray(responseText));
    windowStart = windowEnd + 1;
  }

  return dedupeActivities(rawChunks);
}

function toRunSmartActivity(activity: any) {
  const activityTypeRaw = activity.activityType?.typeKey ?? activity.activityType ?? '';
  const normalizedActivityType = String(activityTypeRaw).toLowerCase().replace(/ /g, '_');

  const startInSeconds = getActivityStartSeconds(activity);
  const startIso = startInSeconds
    ? new Date(startInSeconds * 1000).toISOString()
    : null;

  const distanceInMeters = activity.distanceInMeters ?? activity.distance ?? 0;
  const durationInSeconds = activity.durationInSeconds ?? (activity.duration ? Math.round(activity.duration / 1000) : 0);
  const averageSpeed = activity.averageSpeedInMetersPerSecond ?? activity.averageSpeed ?? null;
  const averageHeartRate = activity.averageHeartRateInBeatsPerMinute ?? activity.averageHR ?? null;
  const maxHeartRate = activity.maxHeartRateInBeatsPerMinute ?? activity.maxHR ?? null;
  const calories = activity.activeKilocalories ?? activity.calories ?? null;
  const elevationGain = activity.totalElevationGainInMeters ?? activity.elevationGain ?? null;

  return {
    activityId: activity.activityId ?? activity.summaryId,
    activityName: activity.activityName ?? activityTypeRaw ?? 'Garmin Activity',
    activityType: normalizedActivityType,
    startTimeGMT: startIso,
    distance: distanceInMeters ? distanceInMeters / 1000 : 0,
    duration: durationInSeconds ?? 0,
    averageHR: averageHeartRate,
    maxHR: maxHeartRate,
    calories,
    averagePace: averageSpeed ? Math.round(1000 / averageSpeed) : null,
    elevationGain,
  };
}

// GET - Fetch Garmin activities via Wellness API.
// Some Garmin apps return InvalidPullTokenException when using upload* query params;
// in that case we retry once with start/end query params before requesting reauth.
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

    let source: GarminSource = 'wellness-upload';
    let rawActivities: any[];

    try {
      rawActivities = await fetchWellnessActivities(accessToken, startTime, endTime, 'upload');
    } catch (error) {
      if (
        error instanceof GarminUpstreamError &&
        error.source === 'wellness-upload' &&
        isInvalidPullToken(error.body)
      ) {
        logger.warn('Garmin wellness-api returned InvalidPullTokenException for upload-window params, retrying with start/end params');
        try {
          source = 'wellness-window';
          rawActivities = await fetchWellnessActivities(accessToken, startTime, endTime, 'window');
        } catch (retryError) {
          if (
            retryError instanceof GarminUpstreamError &&
            retryError.source === 'wellness-window' &&
            isInvalidPullToken(retryError.body)
          ) {
            return NextResponse.json(
              {
                success: false,
                error: 'Garmin token is not valid for activity pull. Please reconnect Garmin.',
                needsReauth: true,
                detail: summarizeUpstreamBody(retryError.body),
              },
              { status: 401 }
            );
          }
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    const mapped = rawActivities.map((activity: any) => toRunSmartActivity(activity));
    const runningActivities = mapped.filter(
      (activity) => activity.activityType.includes('running') || activity.activityType.includes('run')
    );

    return NextResponse.json({
      success: true,
      activities: runningActivities,
      allActivities: mapped.length,
      runningCount: runningActivities.length,
      source,
    });
  } catch (error) {
    if (error instanceof GarminUpstreamError) {
      if (isAuthError(error.status, error.body)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication expired or invalid, please reconnect Garmin',
            needsReauth: true,
            detail: summarizeUpstreamBody(error.body),
          },
          { status: 401 }
        );
      }

      const detail = summarizeUpstreamBody(error.body);
      logger.error(`Garmin ${error.source} activities API error ${error.status}:`, detail);
      return NextResponse.json(
        {
          success: false,
          error: `Garmin API returned ${error.status}`,
          detail,
        },
        { status: 502 }
      );
    }

    logger.error('Garmin activities fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activities from Garmin' },
      { status: 500 }
    );
  }
}
