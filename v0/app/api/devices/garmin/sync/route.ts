import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const SYNC_NAME = 'RunSmart Garmin Enablement Sync';

type GarminDatasetKey = 'activities' | 'sleep' | 'heartRate' | 'workoutImport';

interface GarminEnablementItem {
  key: string;
  permission: string;
  description: string;
  supportedByRunSmart: boolean;
}

interface GarminDatasetCapability {
  key: GarminDatasetKey;
  label: string;
  permissionGranted: boolean;
  endpointReachable: boolean;
  enabledForSync: boolean;
  supportedByRunSmart: boolean;
  reason?: string;
}

interface DatasetProbeResult {
  status: number;
  ok: boolean;
  bodyText: string;
  bodyJson: unknown;
}

interface GarminCatalogResult {
  permissions: string[];
  capabilities: GarminDatasetCapability[];
  probes: {
    activitiesProbe: DatasetProbeResult;
    sleepProbe: DatasetProbeResult;
  };
}

class GarminUpstreamError extends Error {
  status: number;
  body: string;
  source: string;

  constructor(source: string, status: number, body: string) {
    super(`Garmin ${source} returned ${status}`);
    this.name = 'GarminUpstreamError';
    this.status = status;
    this.body = body;
    this.source = source;
  }
}

const AVAILABLE_TO_ENABLE: GarminEnablementItem[] = [
  {
    key: 'activity_export',
    permission: 'ACTIVITY_EXPORT',
    description: 'Read completed activities from Garmin Wellness API upload feed.',
    supportedByRunSmart: true,
  },
  {
    key: 'health_export',
    permission: 'HEALTH_EXPORT',
    description: 'Read wellness summaries (including sleep) from Garmin Wellness API.',
    supportedByRunSmart: true,
  },
  {
    key: 'historical_data_export',
    permission: 'HISTORICAL_DATA_EXPORT',
    description: 'Read Garmin historical backfill feeds when provisioned by Garmin.',
    supportedByRunSmart: false,
  },
  {
    key: 'heart_rate_export',
    permission: 'HEART_RATE_EXPORT',
    description: 'Read detailed heart-rate export feed from Garmin.',
    supportedByRunSmart: false,
  },
  {
    key: 'workout_import',
    permission: 'WORKOUT_IMPORT',
    description: 'Write workouts from RunSmart to Garmin devices.',
    supportedByRunSmart: false,
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseJsonArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

function summarizeUpstreamBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as {
      errorMessage?: unknown;
      message?: unknown;
      error?: unknown;
      path?: unknown;
    };
    const message = [parsed.errorMessage, parsed.message, parsed.error, parsed.path].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (message) return message.slice(0, 500);
  } catch {
    // Keep original text when body is not JSON.
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page';
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /Unable to read oAuth header|invalid[_ ]token|expired|unauthorized/i.test(body);
}

function getActivityStartSeconds(activity: Record<string, unknown>): number | null {
  const fromSeconds = getNumber(activity.startTimeInSeconds);
  if (fromSeconds != null) return fromSeconds;

  const fromStartTimeGmt = getString(activity.startTimeGMT);
  const fromStartTimeLocal = getString(activity.startTimeLocal);
  const dateValue = fromStartTimeGmt ?? fromStartTimeLocal;
  if (!dateValue) return null;

  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function toRunSmartActivity(activity: Record<string, unknown>) {
  const activityTypeValue = asRecord(activity.activityType).typeKey ?? activity.activityType ?? '';
  const activityTypeRaw = String(activityTypeValue).toLowerCase().trim();
  const normalizedActivityType = activityTypeRaw.replace(/ /g, '_');
  const startInSeconds = getActivityStartSeconds(activity);
  const startIso = startInSeconds != null ? new Date(startInSeconds * 1000).toISOString() : null;

  const distanceInMeters = getNumber(activity.distanceInMeters) ?? getNumber(activity.distance) ?? 0;
  const durationRaw = getNumber(activity.durationInSeconds) ?? getNumber(activity.duration) ?? 0;
  const durationInSeconds = durationRaw > 100_000 ? Math.round(durationRaw / 1000) : Math.round(durationRaw);
  const averageSpeed =
    getNumber(activity.averageSpeedInMetersPerSecond) ?? getNumber(activity.averageSpeed);
  const averageHeartRate =
    getNumber(activity.averageHeartRateInBeatsPerMinute) ?? getNumber(activity.averageHR);
  const maxHeartRate = getNumber(activity.maxHeartRateInBeatsPerMinute) ?? getNumber(activity.maxHR);
  const calories = getNumber(activity.activeKilocalories) ?? getNumber(activity.calories);
  const elevationGain =
    getNumber(activity.totalElevationGainInMeters) ?? getNumber(activity.elevationGain);

  const activityName = getString(activity.activityName) ?? (activityTypeRaw || 'Garmin Activity');
  const activityIdRaw = activity.activityId ?? activity.summaryId;
  const activityId = activityIdRaw != null ? String(activityIdRaw) : null;

  return {
    activityId,
    activityName,
    activityType: normalizedActivityType,
    startTimeGMT: startIso,
    distance: distanceInMeters / 1000,
    duration: durationInSeconds,
    averageHR: averageHeartRate,
    maxHR: maxHeartRate,
    calories,
    averagePace: averageSpeed && averageSpeed > 0 ? Math.round(1000 / averageSpeed) : null,
    elevationGain,
  };
}

function toRunSmartSleepRecord(entry: Record<string, unknown>) {
  const calendarDate = getString(entry.calendarDate);
  if (!calendarDate) return null;

  const startTimeInSeconds = getNumber(entry.startTimeInSeconds);
  const durationInSeconds = getNumber(entry.durationInSeconds);
  const overallSleepScoreRaw = asRecord(entry.overallSleepScore).value ?? entry.overallSleepScore;
  const overallSleepScore = getNumber(overallSleepScoreRaw);

  return {
    date: calendarDate,
    sleepStartTimestampGMT: startTimeInSeconds != null ? startTimeInSeconds * 1000 : null,
    sleepEndTimestampGMT:
      startTimeInSeconds != null && durationInSeconds != null
        ? (startTimeInSeconds + durationInSeconds) * 1000
        : null,
    totalSleepSeconds: durationInSeconds,
    deepSleepSeconds: getNumber(entry.deepSleepDurationInSeconds),
    lightSleepSeconds: getNumber(entry.lightSleepDurationInSeconds),
    remSleepSeconds: getNumber(entry.remSleepInSeconds),
    awakeSleepSeconds: getNumber(entry.awakeDurationInSeconds),
    sleepScores:
      overallSleepScore != null
        ? {
            overall: {
              value: overallSleepScore,
            },
          }
        : null,
  };
}

function buildWindowRange() {
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = Math.max(0, endTime - GARMIN_MAX_WINDOW_SECONDS + 1);
  return { startTime, endTime };
}

async function fetchGarminPermissions(accessToken: string): Promise<string[]> {
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/user/permissions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new GarminUpstreamError('permissions', response.status, responseText);
  }

  try {
    const parsed = JSON.parse(responseText) as { permissions?: unknown };
    return Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

async function probeDatasetEndpoint(
  accessToken: string,
  url: string,
  source: string
): Promise<DatasetProbeResult> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const bodyText = await response.text();
  let bodyJson: unknown = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = bodyText;
  }

  if (!response.ok && isAuthError(response.status, bodyText)) {
    throw new GarminUpstreamError(source, response.status, bodyText);
  }

  return {
    status: response.status,
    ok: response.ok,
    bodyText,
    bodyJson,
  };
}

function buildCapabilities(params: {
  permissions: string[];
  activitiesProbe: DatasetProbeResult;
  sleepProbe: DatasetProbeResult;
}): GarminDatasetCapability[] {
  const { permissions, activitiesProbe, sleepProbe } = params;

  const hasActivityExport = permissions.includes('ACTIVITY_EXPORT');
  const hasHealthExport = permissions.includes('HEALTH_EXPORT');
  const hasHeartRateExport = permissions.includes('HEART_RATE_EXPORT');
  const hasWorkoutImport = permissions.includes('WORKOUT_IMPORT');

  const activityReason = !hasActivityExport
    ? 'Missing ACTIVITY_EXPORT permission.'
    : activitiesProbe.ok
      ? undefined
      : `Endpoint unavailable (${activitiesProbe.status}): ${summarizeUpstreamBody(activitiesProbe.bodyText) || 'not enabled for this app/user.'}`;

  const sleepReason = !hasHealthExport
    ? 'Missing HEALTH_EXPORT permission.'
    : sleepProbe.ok
      ? undefined
      : `Endpoint unavailable (${sleepProbe.status}): ${summarizeUpstreamBody(sleepProbe.bodyText) || 'not enabled for this app/user.'}`;

  return [
    {
      key: 'activities',
      label: 'Activities',
      permissionGranted: hasActivityExport,
      endpointReachable: activitiesProbe.ok,
      enabledForSync: hasActivityExport && activitiesProbe.ok,
      supportedByRunSmart: true,
      ...(activityReason ? { reason: activityReason } : {}),
    },
    {
      key: 'sleep',
      label: 'Sleep',
      permissionGranted: hasHealthExport,
      endpointReachable: sleepProbe.ok,
      enabledForSync: hasHealthExport && sleepProbe.ok,
      supportedByRunSmart: true,
      ...(sleepReason ? { reason: sleepReason } : {}),
    },
    {
      key: 'heartRate',
      label: 'Heart Rate',
      permissionGranted: hasHeartRateExport,
      endpointReachable: false,
      enabledForSync: false,
      supportedByRunSmart: false,
      reason: hasHeartRateExport
        ? 'Permission granted, but heart-rate feed import is not enabled in RunSmart yet.'
        : 'Missing HEART_RATE_EXPORT permission.',
    },
    {
      key: 'workoutImport',
      label: 'Workout Import',
      permissionGranted: hasWorkoutImport,
      endpointReachable: false,
      enabledForSync: false,
      supportedByRunSmart: false,
      reason: hasWorkoutImport
        ? 'Permission granted, but RunSmart currently supports read-only Garmin sync.'
        : 'Missing WORKOUT_IMPORT permission.',
    },
  ];
}

async function computeCatalog(accessToken: string): Promise<GarminCatalogResult> {
  const permissions = await fetchGarminPermissions(accessToken);
  const { startTime, endTime } = buildWindowRange();

  const activitiesUrl = `${GARMIN_API_BASE}/wellness-api/rest/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;
  const sleepUrl = `${GARMIN_API_BASE}/wellness-api/rest/sleep?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;

  const [activitiesProbe, sleepProbe] = await Promise.all([
    probeDatasetEndpoint(accessToken, activitiesUrl, 'activities-upload'),
    probeDatasetEndpoint(accessToken, sleepUrl, 'sleep-upload'),
  ]);

  return {
    permissions,
    capabilities: buildCapabilities({ permissions, activitiesProbe, sleepProbe }),
    probes: {
      activitiesProbe,
      sleepProbe,
    },
  };
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function GET(req: Request) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Authorization token required', needsReauth: true },
      { status: 401 }
    );
  }

  try {
    const { permissions, capabilities } = await computeCatalog(accessToken);

    return NextResponse.json({
      success: true,
      syncName: SYNC_NAME,
      permissions,
      availableToEnable: AVAILABLE_TO_ENABLE,
      capabilities,
    });
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: summarizeUpstreamBody(error.body),
        },
        { status: 401 }
      );
    }

    logger.error('Garmin sync catalog error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load Garmin sync capabilities' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Authorization token required', needsReauth: true },
      { status: 401 }
    );
  }

  try {
    const { permissions, capabilities, probes } = await computeCatalog(accessToken);
    const notices: string[] = [];

    const activitiesCapability = capabilities.find((cap) => cap.key === 'activities');
    const sleepCapability = capabilities.find((cap) => cap.key === 'sleep');

    const rawActivities =
      activitiesCapability?.enabledForSync === true
        ? parseJsonArray(probes.activitiesProbe.bodyJson)
        : [];
    const rawSleep =
      sleepCapability?.enabledForSync === true ? parseJsonArray(probes.sleepProbe.bodyJson) : [];

    if (!activitiesCapability?.enabledForSync) {
      notices.push(
        `Activities sync skipped: ${activitiesCapability?.reason ?? 'not enabled for this Garmin app/user.'}`
      );
    }

    if (!sleepCapability?.enabledForSync) {
      notices.push(
        `Sleep sync skipped: ${sleepCapability?.reason ?? 'not enabled for this Garmin app/user.'}`
      );
    }

    const activities = rawActivities
      .map((activity) => toRunSmartActivity(activity))
      .filter((activity) => activity.activityType.includes('run'));

    const sleep = rawSleep
      .map((entry) => toRunSmartSleepRecord(entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    return NextResponse.json({
      success: true,
      syncName: SYNC_NAME,
      permissions,
      availableToEnable: AVAILABLE_TO_ENABLE,
      capabilities,
      activities,
      sleep,
      notices,
    });
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: summarizeUpstreamBody(error.body),
        },
        { status: 401 }
      );
    }

    logger.error('Garmin enabled sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run Garmin enabled sync' },
      { status: 500 }
    );
  }
}
