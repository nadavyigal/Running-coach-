"use client"

/**
 * garminSync.ts — Client-side Garmin data sync library
 *
 * Reads the access token from Dexie.js (wearableDevices), calls the server
 * proxy routes (/api/devices/garmin/activities and /api/devices/garmin/sleep),
 * deduplicates, and saves imported records into db.runs and db.sleepData.
 *
 * Called from GarminSyncPanel (user-triggered) or background sync.
 */

import { db, type Run, type SleepData, type WearableDevice } from '@/lib/db'

export interface GarminSyncResult {
  activitiesImported: number
  activitiesSkipped: number   // already existed
  sleepImported: number
  sleepSkipped: number
  needsReauth: boolean
  errors: string[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function garminActivityTypeToRunType(typeKey: string): Run['type'] {
  switch (typeKey) {
    case 'running':
    case 'track_running':
    case 'treadmill_running':
      return 'easy'
    case 'tempo_running':
      return 'tempo'
    case 'trail_running':
      return 'long'
    default:
      return 'other'
  }
}

async function getConnectedGarminDevice(userId: number): Promise<WearableDevice | null> {
  const device = await db.wearableDevices
    .where('[userId+type]')
    .equals([userId, 'garmin'])
    .first()
  if (!device || device.connectionStatus === 'disconnected') return null
  return device as WearableDevice
}

// ─── activities sync ──────────────────────────────────────────────────────────

export async function syncGarminActivities(
  userId: number,
  days = 14
): Promise<Pick<GarminSyncResult, 'activitiesImported' | 'activitiesSkipped' | 'needsReauth' | 'errors'>> {
  const result = { activitiesImported: 0, activitiesSkipped: 0, needsReauth: false, errors: [] as string[] }

  const device = await getConnectedGarminDevice(userId)
  if (!device) {
    result.errors.push('No connected Garmin device found')
    return result
  }

  const accessToken = (device as any).authTokens?.accessToken
  if (!accessToken) {
    result.needsReauth = true
    result.errors.push('Missing access token — please reconnect Garmin')
    return result
  }

  try {
    const res = await fetch(`/api/devices/garmin/activities?userId=${userId}&days=${days}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()

    if (data.needsReauth) {
      result.needsReauth = true
      // Mark device as needing reauth in Dexie
      if (device.id) {
        await db.wearableDevices.update(device.id, { connectionStatus: 'error', updatedAt: new Date() })
      }
      result.errors.push('Garmin token expired — please reconnect')
      return result
    }

    if (!data.success || !Array.isArray(data.activities)) {
      // Surface the actual Garmin error detail if available
      const detail = data.detail ? ` (${data.detail})` : ''
      result.errors.push((data.error || 'Failed to fetch activities from Garmin') + detail)
      return result
    }

    // Filter to requested date range
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    for (const act of data.activities) {
      const activityId = String(act.activityId)
      // startTimeGMT is already an ISO string from our route mapping
      const completedAt = act.startTimeGMT ? new Date(act.startTimeGMT) : new Date()

      if (completedAt < cutoff) continue

      // Deduplicate: check if we already have this Garmin activity
      const existing = await db.runs
        .where('importRequestId')
        .equals(activityId)
        .count()

      if (existing > 0) {
        result.activitiesSkipped++
        continue
      }

      const run: Omit<Run, 'id'> = {
        userId,
        type: garminActivityTypeToRunType(act.activityType || ''),
        distance: act.distance ?? 0,                        // km
        duration: Math.round(act.duration ?? 0),            // seconds
        pace: act.averagePace ?? undefined,                 // s/km
        heartRate: act.averageHR ?? undefined,
        calories: act.calories ?? undefined,
        notes: act.activityName || 'Garmin activity',
        importSource: 'garmin',
        importRequestId: activityId,
        completedAt,
        createdAt: new Date(),
      }

      await db.runs.add(run as Run)
      result.activitiesImported++
    }

    // Update lastSync on device
    if (device.id) {
      await db.wearableDevices.update(device.id, {
        lastSync: new Date(),
        connectionStatus: 'connected',
        updatedAt: new Date(),
      })
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error syncing activities')
  }

  return result
}

// ─── sleep sync ───────────────────────────────────────────────────────────────

export async function syncGarminSleep(
  userId: number,
  days = 7
): Promise<Pick<GarminSyncResult, 'sleepImported' | 'sleepSkipped' | 'needsReauth' | 'errors'>> {
  const result = { sleepImported: 0, sleepSkipped: 0, needsReauth: false, errors: [] as string[] }

  const device = await getConnectedGarminDevice(userId)
  if (!device) {
    result.errors.push('No connected Garmin device found')
    return result
  }

  const accessToken = (device as any).authTokens?.accessToken
  if (!accessToken) {
    result.needsReauth = true
    result.errors.push('Missing access token — please reconnect Garmin')
    return result
  }

  try {
    const res = await fetch(`/api/devices/garmin/sleep?userId=${userId}&days=${days}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()

    if (data.needsReauth) {
      result.needsReauth = true
      if (device.id) {
        await db.wearableDevices.update(device.id, { connectionStatus: 'error', updatedAt: new Date() })
      }
      result.errors.push('Garmin token expired — please reconnect')
      return result
    }

    if (!data.success || !Array.isArray(data.sleep)) {
      const detail = data.detail ? ` (${data.detail})` : ''
      result.errors.push((data.error || 'Failed to fetch sleep data from Garmin') + detail)
      return result
    }

    for (const s of data.sleep) {
      if (!s?.date) continue

      const sleepDate = new Date(s.date)

      // Deduplicate: one record per date per device
      const existing = await db.sleepData
        .where('[userId+sleepDate]')
        .equals([userId, sleepDate])
        .count()

      if (existing > 0) {
        result.sleepSkipped++
        continue
      }

      const totalMinutes = s.totalSleepSeconds ? Math.round(s.totalSleepSeconds / 60) : 0
      const deepMinutes = s.deepSleepSeconds ? Math.round(s.deepSleepSeconds / 60) : undefined
      const lightMinutes = s.lightSleepSeconds ? Math.round(s.lightSleepSeconds / 60) : undefined
      const remMinutes = s.remSleepSeconds ? Math.round(s.remSleepSeconds / 60) : undefined
      const awakeMinutes = s.awakeSleepSeconds ? Math.round(s.awakeSleepSeconds / 60) : undefined

      const sleepEfficiency =
        totalMinutes && awakeMinutes != null
          ? Math.round(((totalMinutes) / (totalMinutes + awakeMinutes)) * 100)
          : 85 // fallback

      const record: Omit<SleepData, 'id'> = {
        userId,
        deviceId: device.deviceId,
        sleepDate,
        totalSleepTime: totalMinutes,
        sleepEfficiency,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Spread optional fields only when they have a value (exactOptionalPropertyTypes)
        ...(s.sleepStartTimestampGMT && { bedTime: new Date(s.sleepStartTimestampGMT) }),
        ...(s.sleepEndTimestampGMT && { wakeTime: new Date(s.sleepEndTimestampGMT) }),
        ...(deepMinutes != null && { deepSleepTime: deepMinutes }),
        ...(lightMinutes != null && { lightSleepTime: lightMinutes }),
        ...(remMinutes != null && { remSleepTime: remMinutes }),
        ...(s.sleepScores?.overall?.value != null && { sleepScore: s.sleepScores.overall.value }),
      }

      await db.sleepData.add(record as SleepData)
      result.sleepImported++
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error syncing sleep')
  }

  return result
}

// ─── combined sync ────────────────────────────────────────────────────────────

export async function syncAllGarminData(userId: number): Promise<GarminSyncResult> {
  const [actResult, sleepResult] = await Promise.all([
    syncGarminActivities(userId, 14),
    syncGarminSleep(userId, 7),
  ])

  return {
    activitiesImported: actResult.activitiesImported,
    activitiesSkipped: actResult.activitiesSkipped,
    sleepImported: sleepResult.sleepImported,
    sleepSkipped: sleepResult.sleepSkipped,
    needsReauth: actResult.needsReauth || sleepResult.needsReauth,
    errors: [...actResult.errors, ...sleepResult.errors],
  }
}
