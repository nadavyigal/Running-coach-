import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_CONNECT_API_BASE = 'https://connectapi.garmin.com';
const GARMIN_CONNECT_PROXY_BASE = 'https://connect.garmin.com/modern/proxy';
const GARMIN_MAX_WINDOW_SECONDS = 86400;

interface EndpointResult {
  url: string;
  status: number;
  ok: boolean;
  body: unknown;
}

async function testEndpoint(token: string, url: string, headers: HeadersInit = {}): Promise<EndpointResult> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...headers,
      },
    });
    let body: unknown;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = /<!doctype html|<html/i.test(text.trim())
        ? 'Garmin returned an HTML error page'
        : text;
    }
    return { url, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { url, status: -1, ok: false, body: String(e) };
  }
}

function connectHeaders(viaProxy: boolean): HeadersInit {
  const headers: Record<string, string> = {
    'User-Agent': 'GCM-iOS-5.19.1.2',
  };
  if (viaProxy) headers['DI-Backend'] = 'connectapi.garmin.com';
  return headers;
}

// GET - Diagnose Garmin API access for the current Bearer token.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No Bearer token provided' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  // Garmin limits query windows to 86400 seconds.
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = Math.max(0, endTime - GARMIN_MAX_WINDOW_SECONDS + 1);

  const [profile, permissions, activitiesUpload, activitiesBackfill, sleepUpload, sleepBackfill, socialProfileDirect, socialProfileProxy, activitiesConnectDirect, activitiesConnectProxy] = await Promise.all([
    testEndpoint(
      accessToken,
      `${GARMIN_API_BASE}/wellness-api/rest/user/id`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_API_BASE}/wellness-api/rest/user/permissions`
    ),
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
      `${GARMIN_API_BASE}/wellness-api/rest/sleep?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_API_BASE}/wellness-api/rest/backfill/sleep?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_API_BASE}/userprofile-service/socialProfile`,
      connectHeaders(false)
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_PROXY_BASE}/userprofile-service/socialProfile`,
      connectHeaders(true)
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_API_BASE}/activitylist-service/activities/search/activities?start=0&limit=5`,
      connectHeaders(false)
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_PROXY_BASE}/activitylist-service/activities/search/activities?start=0&limit=5`,
      connectHeaders(true)
    ),
  ]);

  const socialProfileBody =
    socialProfileDirect.ok && typeof socialProfileDirect.body === 'object'
      ? socialProfileDirect.body as Record<string, unknown>
      : socialProfileProxy.ok && typeof socialProfileProxy.body === 'object'
        ? socialProfileProxy.body as Record<string, unknown>
        : null;

  const userName =
    socialProfileBody && typeof socialProfileBody.userName === 'string'
      ? socialProfileBody.userName
      : null;

  const sleepConnectDirect = userName
    ? await testEndpoint(
        accessToken,
        `${GARMIN_CONNECT_API_BASE}/wellness-service/wellness/dailySleepData/${encodeURIComponent(userName)}?date=${new Date(endTime * 1000).toISOString().slice(0, 10)}&nonSleepBufferMinutes=60`,
        connectHeaders(false)
      )
    : null;

  const sleepConnectProxy = userName
    ? await testEndpoint(
        accessToken,
        `${GARMIN_CONNECT_PROXY_BASE}/wellness-service/wellness/dailySleepData/${encodeURIComponent(userName)}?date=${new Date(endTime * 1000).toISOString().slice(0, 10)}&nonSleepBufferMinutes=60`,
        connectHeaders(true)
      )
    : null;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timeRange: {
      startTime,
      endTime,
      seconds: endTime - startTime + 1,
      startIso: new Date(startTime * 1000).toISOString(),
      endIso: new Date(endTime * 1000).toISOString(),
    },
    results: {
      profile,
      permissions,
      activitiesUpload,
      activitiesBackfill,
      sleepUpload,
      sleepBackfill,
      socialProfileDirect,
      socialProfileProxy,
      activitiesConnectDirect,
      activitiesConnectProxy,
      sleepConnectDirect,
      sleepConnectProxy,
    },
  });
}
