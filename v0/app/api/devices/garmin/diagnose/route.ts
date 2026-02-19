import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;

interface EndpointResult {
  url: string;
  status: number;
  ok: boolean;
  body: unknown;
}

async function testEndpoint(token: string, url: string): Promise<EndpointResult> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    let body: unknown;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = /<!doctype html|<html/i.test(text.trim()) ? 'Garmin returned an HTML error page' : text;
    }
    return { url, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { url, status: -1, ok: false, body: String(e) };
  }
}

function parsePermissions(result: EndpointResult): string[] {
  if (!result.ok || typeof result.body !== 'object' || result.body == null) return [];
  const permissions = (result.body as { permissions?: unknown }).permissions;
  return Array.isArray(permissions)
    ? permissions.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function includesPermission(permissions: string[], name: string): boolean {
  return permissions.includes(name);
}

function buildBlockers(params: {
  activitiesUpload: EndpointResult;
  activitiesBackfill: EndpointResult;
  sleepUpload: EndpointResult;
  sleepBackfill: EndpointResult;
}): string[] {
  const blockers: string[] = [];
  const { activitiesUpload, activitiesBackfill, sleepUpload, sleepBackfill } = params;

  if (
    typeof activitiesUpload.body === 'object' &&
    activitiesUpload.body != null &&
    'errorMessage' in activitiesUpload.body &&
    String((activitiesUpload.body as { errorMessage?: unknown }).errorMessage ?? '').includes(
      'InvalidPullTokenException'
    )
  ) {
    blockers.push('Activity upload token is invalid (InvalidPullTokenException).');
  }

  if (
    typeof activitiesBackfill.body === 'object' &&
    activitiesBackfill.body != null &&
    String((activitiesBackfill.body as { errorMessage?: unknown }).errorMessage ?? '').includes(
      'CONNECT_ACTIVITY'
    )
  ) {
    blockers.push('Activity backfill endpoint is not provisioned (CONNECT_ACTIVITY).');
  }

  if (sleepUpload.status === 404 || sleepBackfill.status === 404) {
    blockers.push('Sleep endpoints are not provisioned for this app.');
  }

  return blockers;
}

// GET - Diagnose Garmin Wellness API access for the current Bearer token.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No Bearer token provided' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  // Garmin limits query windows to 86400 seconds.
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = Math.max(0, endTime - GARMIN_MAX_WINDOW_SECONDS + 1);

  const [profile, permissionsResult, activitiesUpload, activitiesBackfill, sleepUpload, sleepBackfill] =
    await Promise.all([
      testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/id`),
      testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/permissions`),
      testEndpoint(
        accessToken,
        `${GARMIN_API_BASE}/wellness-api/rest/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`
      ),
      testEndpoint(
        accessToken,
        `${GARMIN_API_BASE}/wellness-api/rest/backfill/activities?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`
      ),
      testEndpoint(
        accessToken,
        `${GARMIN_API_BASE}/wellness-api/rest/sleeps?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`
      ),
      testEndpoint(
        accessToken,
        `${GARMIN_API_BASE}/wellness-api/rest/backfill/sleeps?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`
      ),
    ]);

  const permissions = parsePermissions(permissionsResult);
  const blockers = buildBlockers({ activitiesUpload, activitiesBackfill, sleepUpload, sleepBackfill });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timeRange: {
      startTime,
      endTime,
      seconds: endTime - startTime + 1,
      startIso: new Date(startTime * 1000).toISOString(),
      endIso: new Date(endTime * 1000).toISOString(),
    },
    capabilities: {
      permissions,
      activityUploadEnabled: includesPermission(permissions, 'ACTIVITY_EXPORT'),
      activityBackfillEnabled: includesPermission(permissions, 'HISTORICAL_DATA_EXPORT'),
      sleepEnabled: includesPermission(permissions, 'HEALTH_EXPORT'),
      workoutImportEnabled: includesPermission(permissions, 'WORKOUT_IMPORT'),
    },
    blockers,
    results: {
      profile,
      permissions: permissionsResult,
      activitiesUpload,
      activitiesBackfill,
      sleepUpload,
      sleepBackfill,
    },
  });
}
