import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const GARMIN_API_BASE = 'https://apis.garmin.com';
const GARMIN_MAX_WINDOW_SECONDS = 86400;
const SYNC_NAME = 'RunSmart Garmin Export Sync';

type GarminDatasetKey =
  | 'activities'
  | 'manuallyUpdatedActivities'
  | 'activityDetails'
  | 'dailies'
  | 'epochs'
  | 'sleeps'
  | 'bodyComps'
  | 'stressDetails'
  | 'userMetrics'
  | 'pulseox'
  | 'allDayRespiration'
  | 'healthSnapshot'
  | 'hrv'
  | 'bloodPressures'
  | 'skinTemp'
  | 'workoutImport';

type ProbedDatasetKey = Exclude<GarminDatasetKey, 'workoutImport'>;

interface GarminDatasetConfig {
  key: ProbedDatasetKey;
  label: string;
  permission: 'ACTIVITY_EXPORT' | 'HEALTH_EXPORT';
  path: string;
  description: string;
}

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

type DatasetProbeMap = Record<ProbedDatasetKey, DatasetProbeResult>;

interface GarminCatalogResult {
  permissions: string[];
  capabilities: GarminDatasetCapability[];
  probes: DatasetProbeMap;
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

const DATASET_CONFIGS: GarminDatasetConfig[] = [
  {
    key: 'activities',
    label: 'Activities',
    permission: 'ACTIVITY_EXPORT',
    path: 'activities',
    description: 'Activity summaries from Garmin Activity API.',
  },
  {
    key: 'manuallyUpdatedActivities',
    label: 'Manually Updated Activities',
    permission: 'ACTIVITY_EXPORT',
    path: 'manuallyUpdatedActivities',
    description: 'Manually edited activities from Garmin Activity API.',
  },
  {
    key: 'activityDetails',
    label: 'Activity Details',
    permission: 'ACTIVITY_EXPORT',
    path: 'activityDetails',
    description: 'Detailed activity summaries from Garmin Activity API.',
  },
  {
    key: 'dailies',
    label: 'Dailies',
    permission: 'HEALTH_EXPORT',
    path: 'dailies',
    description: 'Daily wellness summaries from Garmin Health API.',
  },
  {
    key: 'epochs',
    label: 'Epochs',
    permission: 'HEALTH_EXPORT',
    path: 'epochs',
    description: 'Epoch-level wellness samples from Garmin Health API.',
  },
  {
    key: 'sleeps',
    label: 'Sleeps',
    permission: 'HEALTH_EXPORT',
    path: 'sleeps',
    description: 'Sleep summaries from Garmin Health API.',
  },
  {
    key: 'bodyComps',
    label: 'Body Comps',
    permission: 'HEALTH_EXPORT',
    path: 'bodyComps',
    description: 'Body composition summaries from Garmin Health API.',
  },
  {
    key: 'stressDetails',
    label: 'Stress Details',
    permission: 'HEALTH_EXPORT',
    path: 'stressDetails',
    description: 'Stress detail summaries from Garmin Health API.',
  },
  {
    key: 'userMetrics',
    label: 'User Metrics',
    permission: 'HEALTH_EXPORT',
    path: 'userMetrics',
    description: 'User metric summaries from Garmin Health API.',
  },
  {
    key: 'pulseox',
    label: 'Pulse Ox',
    permission: 'HEALTH_EXPORT',
    path: 'pulseox',
    description: 'Pulse ox summaries from Garmin Health API.',
  },
  {
    key: 'allDayRespiration',
    label: 'All Day Respiration',
    permission: 'HEALTH_EXPORT',
    path: 'allDayRespiration',
    description: 'All-day respiration summaries from Garmin Health API.',
  },
  {
    key: 'healthSnapshot',
    label: 'Health Snapshot',
    permission: 'HEALTH_EXPORT',
    path: 'healthSnapshot',
    description: 'Health snapshot summaries from Garmin Health API.',
  },
  {
    key: 'hrv',
    label: 'HRV',
    permission: 'HEALTH_EXPORT',
    path: 'hrv',
    description: 'HRV summaries from Garmin Health API.',
  },
  {
    key: 'bloodPressures',
    label: 'Blood Pressures',
    permission: 'HEALTH_EXPORT',
    path: 'bloodPressures',
    description: 'Blood pressure summaries from Garmin Health API.',
  },
  {
    key: 'skinTemp',
    label: 'Skin Temp',
    permission: 'HEALTH_EXPORT',
    path: 'skinTemp',
    description: 'Skin temperature summaries from Garmin Health API.',
  },
];

const AVAILABLE_TO_ENABLE: GarminEnablementItem[] = [
  ...DATASET_CONFIGS.map((dataset) => ({
    key: dataset.key,
    permission: dataset.permission,
    description: dataset.description,
    supportedByRunSmart: true,
  })),
  {
    key: 'historical_data_export',
    permission: 'HISTORICAL_DATA_EXPORT',
    description: 'Backfill endpoints for historical export (requires Garmin provisioning).',
    supportedByRunSmart: false,
  },
  {
    key: 'workout_import',
    permission: 'WORKOUT_IMPORT',
    description: 'Workout import into Garmin (outbound write path, not yet supported).',
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
    // Keep body text when JSON parsing fails.
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

function isInvalidPullToken(status: number, body: string): boolean {
  if (status !== 400) return false;
  return /InvalidPullTokenException|invalid pull token/i.test(body);
}

function isNotProvisioned(status: number, body: string): boolean {
  if (status === 404) return true;
  return /Endpoint not enabled for summary type/i.test(body);
}

function parseJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asRecord(entry))
      .filter((entry) => Object.keys(entry).length > 0);
  }

  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(nested)) {
        return nested
          .map((entry) => asRecord(entry))
          .filter((entry) => Object.keys(entry).length > 0);
      }
    }
  }

  return [];
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

function buildUploadUrl(path: string, startTime: number, endTime: number): string {
  return `${GARMIN_API_BASE}/wellness-api/rest/${path}?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;
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
  probes: DatasetProbeMap;
}): GarminDatasetCapability[] {
  const { permissions, probes } = params;

  const capabilities = DATASET_CONFIGS.map((config) => {
    const permissionGranted = permissions.includes(config.permission);
    const probe = probes[config.key];

    const reason = !permissionGranted
      ? `Missing ${config.permission} permission.`
      : isInvalidPullToken(probe.status, probe.bodyText)
        ? 'Garmin upload feed requires ping/pull callback token; direct polling returned InvalidPullTokenException.'
        : probe.ok
          ? undefined
          : isNotProvisioned(probe.status, probe.bodyText)
            ? `Endpoint unavailable (${probe.status}): not provisioned for this app/user.`
            : `Endpoint unavailable (${probe.status}): ${summarizeUpstreamBody(probe.bodyText) || 'request failed.'}`;

    return {
      key: config.key,
      label: config.label,
      permissionGranted,
      endpointReachable: probe.ok,
      enabledForSync: permissionGranted && probe.ok,
      supportedByRunSmart: true,
      ...(reason ? { reason } : {}),
    } satisfies GarminDatasetCapability;
  });

  const hasWorkoutImport = permissions.includes('WORKOUT_IMPORT');
  capabilities.push({
    key: 'workoutImport',
    label: 'Workout Import',
    permissionGranted: hasWorkoutImport,
    endpointReachable: false,
    enabledForSync: false,
    supportedByRunSmart: false,
    reason: hasWorkoutImport
      ? 'Permission granted, but RunSmart currently supports Garmin export import only.'
      : 'Missing WORKOUT_IMPORT permission.',
  });

  return capabilities;
}

async function computeCatalog(accessToken: string): Promise<GarminCatalogResult> {
  const permissions = await fetchGarminPermissions(accessToken);
  const { startTime, endTime } = buildWindowRange();

  const probeEntries = await Promise.all(
    DATASET_CONFIGS.map(async (dataset) => {
      const url = buildUploadUrl(dataset.path, startTime, endTime);
      const probe = await probeDatasetEndpoint(accessToken, url, `${dataset.key}-upload`);
      return [dataset.key, probe] as const;
    })
  );

  const probes = Object.fromEntries(probeEntries) as DatasetProbeMap;

  return {
    permissions,
    capabilities: buildCapabilities({ permissions, probes }),
    probes,
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

    const capabilityByKey = new Map(capabilities.map((capability) => [capability.key, capability]));
    const datasets: Record<string, Record<string, unknown>[]> = {};
    const datasetCounts: Record<string, number> = {};

    for (const dataset of DATASET_CONFIGS) {
      const capability = capabilityByKey.get(dataset.key);
      if (!capability || !capability.enabledForSync) {
        datasets[dataset.key] = [];
        datasetCounts[dataset.key] = 0;
        notices.push(`${dataset.label} sync skipped: ${capability?.reason ?? 'not enabled for this Garmin app/user.'}`);
        continue;
      }

      const rows = parseJsonArray(probes[dataset.key].bodyJson);
      datasets[dataset.key] = rows;
      datasetCounts[dataset.key] = rows.length;
    }

    const activityRows = [
      ...datasets.activities,
      ...datasets.manuallyUpdatedActivities,
      ...datasets.activityDetails,
    ];

    const mappedActivities = activityRows
      .map((entry) => toRunSmartActivity(entry))
      .filter((activity) => activity.activityType.includes('run'));

    const uniqueActivities: typeof mappedActivities = [];
    const seenActivityIds = new Set<string>();

    for (const activity of mappedActivities) {
      const dedupeKey = activity.activityId ?? `${activity.startTimeGMT ?? 'unknown'}-${activity.activityName}`;
      if (seenActivityIds.has(dedupeKey)) continue;
      seenActivityIds.add(dedupeKey);
      uniqueActivities.push(activity);
    }

    const sleep = datasets.sleeps
      .map((entry) => toRunSmartSleepRecord(entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    return NextResponse.json({
      success: true,
      syncName: SYNC_NAME,
      permissions,
      availableToEnable: AVAILABLE_TO_ENABLE,
      capabilities,
      datasets,
      datasetCounts,
      activities: uniqueActivities,
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