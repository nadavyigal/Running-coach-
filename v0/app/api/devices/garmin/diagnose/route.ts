import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_CONNECT_BASE = 'https://connect.garmin.com';
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
      body = text;
    }
    return { url, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { url, status: -1, ok: false, body: String(e) };
  }
}

// GET - Diagnose Garmin API access for the authenticated user's token
// Client passes the access token via Authorization: Bearer <token>
// Returns raw API responses from Garmin for debugging purposes
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No Bearer token provided' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  // Garmin limits query windows to 86400 seconds.
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = Math.max(0, endTime - GARMIN_MAX_WINDOW_SECONDS + 1);

  const [activities, activitiesConnect, sleep, profile] = await Promise.all([
    testEndpoint(
      accessToken,
      `${GARMIN_API_BASE}/wellness-api/rest/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_BASE}/activitylist-service/activities/search/activities?start=0&limit=5`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_API_BASE}/wellness-api/rest/sleep?startTimeInSeconds=${startTime}&endTimeInSeconds=${endTime}`
    ),
    testEndpoint(
      accessToken,
      `${GARMIN_CONNECT_BASE}/userprofile-service/userprofile`
    ),
  ]);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timeRange: {
      startTime,
      endTime,
      seconds: endTime - startTime + 1,
      startIso: new Date(startTime * 1000).toISOString(),
      endIso: new Date(endTime * 1000).toISOString(),
    },
    results: { profile, activities, activitiesConnect, sleep },
  });
}
