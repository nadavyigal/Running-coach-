export type GarminConnectionState =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reauth_required'
  | 'revoked'

export type GarminSyncTrustState =
  | 'connected'
  | 'syncing'
  | 'waiting_for_first_activity'
  | 'delayed'
  | 'reauth_required'
  | 'error'
  | 'disconnected'

export type GarminImportJobType = 'activity_import' | 'backfill'
export type GarminImportJobStatus = 'pending' | 'running' | 'retry' | 'success' | 'failed' | 'dead_letter'
export type GarminWebhookEventStatus = 'received' | 'queued' | 'processed' | 'failed' | 'ignored_duplicate'

export type GarminDatasetKey =
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

export interface GarminOAuthConnection {
  userId: number
  profileId: string | null
  authUserId: string | null
  providerUserId: string | null
  scopes: string[]
  status: GarminConnectionState
  connectedAt: string
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastWebhookReceivedAt: string | null
  lastSyncError: string | null
}

export interface GarminWebhookEventRecord {
  id: string
  delivery_key: string
  event_type: string
  provider_user_id: string | null
  raw_payload: Record<string, unknown>
  received_at: string
  processed_at: string | null
  status: GarminWebhookEventStatus
  error_message: string | null
  attempt_count: number
}

export interface GarminImportJobRecord {
  id: string
  webhook_event_id: string | null
  user_id: number | null
  profile_id: string | null
  provider_user_id: string | null
  source_activity_id: string | null
  job_type: GarminImportJobType
  status: GarminImportJobStatus
  priority: number
  run_after: string
  locked_at: string | null
  locked_by: string | null
  attempt_count: number
  last_error: string | null
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GarminWebhookDatasetRow {
  datasetKey: GarminDatasetKey
  providerUserId: string | null
  callbackUrl: string | null
  activityId: string | null
  payload: Record<string, unknown>
}

export interface GarminNormalizedActivity {
  activityId: string
  sourceProvider: 'garmin'
  sourceExternalId: string | null
  sourcePayloadRef: string | null
  name: string
  typeKey: string
  startTime: string
  timezone: string | null
  distanceMeters: number
  durationSeconds: number
  movingDurationSeconds: number | null
  averagePaceSecondsPerKm: number | null
  elevationGainMeters: number | null
  averageHeartRate: number | null
  maxHeartRate: number | null
  calories: number | null
  routePoints: Array<Record<string, unknown>>
  polyline: string | null
  lapSummaries: Array<Record<string, unknown>>
  splitSummaries: Array<Record<string, unknown>>
  raw: Record<string, unknown>
}

export type GarminServiceErrorType =
  | 'auth_error'
  | 'not_found'
  | 'rate_limit'
  | 'temporary_upstream'
  | 'permanent_schema_issue'

export interface GarminServiceError {
  name: 'GarminServiceError'
  type: GarminServiceErrorType
  message: string
  retryable: boolean
  statusCode?: number
}

export interface GarminImportResult {
  imported: boolean
  duplicate: boolean
  skipped: boolean
  runId: string | null
  sourceActivityId: string
  reason: string | null
}
