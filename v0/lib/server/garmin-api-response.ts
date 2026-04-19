import type { GarminDatasetKey } from '@/lib/server/garmin-export-store'
import { GARMIN_EXPORT_DATASET_KEYS } from '@/lib/garmin/datasets'

export interface GarminDatasetCompletenessSummary {
  missingDatasets: GarminDatasetKey[]
  usedFallbackDatasets: GarminDatasetKey[]
}

export interface GarminPersistenceSummary {
  activitiesUpserted: number
  dailyMetricsUpserted: number
  duplicateActivitiesSkipped: number
  activityFilesProcessed: number
}

export interface GarminCanonicalStatusResponse {
  success: boolean
  connected: boolean
  connectionStatus: string
  syncState: string
  needsReauth: boolean
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastDataReceivedAt: string | null
  pendingJobs: number
  datasetCounts: Record<GarminDatasetKey, number>
  datasetCompleteness: GarminDatasetCompletenessSummary
  persistence: GarminPersistenceSummary | null
  notices: string[]
  error: string | null
  detail: unknown
}

export function createEmptyGarminDatasetCounts(): Record<GarminDatasetKey, number> {
  return Object.fromEntries(GARMIN_EXPORT_DATASET_KEYS.map((key) => [key, 0])) as Record<GarminDatasetKey, number>
}

export function createEmptyGarminDatasetCompleteness(): GarminDatasetCompletenessSummary {
  return {
    missingDatasets: [],
    usedFallbackDatasets: [],
  }
}

export function createGarminPersistenceSummary(input?: Partial<GarminPersistenceSummary> | null): GarminPersistenceSummary {
  return {
    activitiesUpserted: input?.activitiesUpserted ?? 0,
    dailyMetricsUpserted: input?.dailyMetricsUpserted ?? 0,
    duplicateActivitiesSkipped: input?.duplicateActivitiesSkipped ?? 0,
    activityFilesProcessed: input?.activityFilesProcessed ?? 0,
  }
}

export function createEmptyGarminCanonicalStatusResponse(): GarminCanonicalStatusResponse {
  return {
    success: false,
    connected: false,
    connectionStatus: 'disconnected',
    syncState: 'disconnected',
    needsReauth: false,
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    lastDataReceivedAt: null,
    pendingJobs: 0,
    datasetCounts: createEmptyGarminDatasetCounts(),
    datasetCompleteness: createEmptyGarminDatasetCompleteness(),
    persistence: null,
    notices: [],
    error: null,
    detail: null,
  }
}
