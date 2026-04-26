import type { GarminDatasetKey } from '@/lib/integrations/garmin/types'

export const GARMIN_ACTIVITY_DATASET_KEYS = [
  'activities',
  'manuallyUpdatedActivities',
  'activityDetails',
] as const satisfies readonly GarminDatasetKey[]

export const GARMIN_WELLNESS_DATASET_KEYS = [
  'dailies',
  'epochs',
  'sleeps',
  'bodyComps',
  'stressDetails',
  'userMetrics',
  'pulseox',
  'allDayRespiration',
  'healthSnapshot',
  'hrv',
  'bloodPressures',
  'skinTemp',
] as const satisfies readonly GarminDatasetKey[]

export const GARMIN_EXPORT_DATASET_KEYS = [
  ...GARMIN_ACTIVITY_DATASET_KEYS,
  ...GARMIN_WELLNESS_DATASET_KEYS,
] as const satisfies readonly GarminDatasetKey[]

export const GARMIN_WEBHOOK_DATASET_KEYS = [
  ...GARMIN_EXPORT_DATASET_KEYS,
  'activityFiles',
] as const satisfies readonly GarminDatasetKey[]
