"use client"

import { db, type WearableDevice } from "@/lib/db"

export type GarminUiSyncState =
  | "connected"
  | "syncing"
  | "waiting_for_first_activity"
  | "delayed"
  | "reauth_required"
  | "disconnected"
  | "error"
  | string

export interface GarminConnectionStatus {
  success?: boolean
  connected: boolean
  connectionStatus?: string | null
  syncState?: GarminUiSyncState | null
  needsReauth?: boolean
  lastSyncAt?: string | null
  lastSuccessfulSyncAt?: string | null
  lastDataReceivedAt?: string | null
  pendingJobs?: number | null
  datasetCounts?: Record<string, number>
  datasetCompleteness?: {
    missingDatasets?: string[]
  }
  notices?: string[]
  error?: string | null
  lastSyncError?: string | null
  freshnessLabel?: string
  confidenceLabel?: string
}

export interface GarminRehydrateResult {
  status: GarminConnectionStatus
  device: WearableDevice | null
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toLocalConnectionStatus(status: GarminConnectionStatus): WearableDevice["connectionStatus"] {
  if (!status.connected) return "disconnected"
  if (status.needsReauth || status.syncState === "reauth_required") return "error"
  if (status.syncState === "syncing") return "syncing"
  return "connected"
}

function getDeviceId(userId: number, status: GarminConnectionStatus): string {
  return status.connected ? `garmin-${userId}` : `garmin-disconnected-${userId}`
}

export async function fetchGarminConnectionStatus(userId: number): Promise<GarminConnectionStatus> {
  const response = await fetch(`/api/garmin/status?userId=${encodeURIComponent(String(userId))}`, {
    headers: { "x-user-id": String(userId) },
    cache: "no-store",
  })
  const data = (await response.json().catch(() => ({}))) as Partial<GarminConnectionStatus>
  if (!response.ok) {
    throw new Error(data.error || "Unable to load Garmin status")
  }

  return {
    connected: Boolean(data.connected),
    ...data,
  }
}

export async function rehydrateGarminDeviceFromServer(
  userId: number,
  knownStatus?: GarminConnectionStatus
): Promise<GarminRehydrateResult> {
  const status = knownStatus ?? (await fetchGarminConnectionStatus(userId))
  const now = new Date()
  const existing = await db.wearableDevices
    .where("userId")
    .equals(userId)
    .filter((device) => device.type === "garmin")
    .first()

  if (!status.connected && !existing?.id) {
    return { status, device: null }
  }

  const localStatus = toLocalConnectionStatus(status)
  const lastSync = parseIsoDate(status.lastSuccessfulSyncAt) ?? parseIsoDate(status.lastSyncAt)
  const deviceRecord: Omit<WearableDevice, "id"> = {
    userId,
    type: "garmin",
    name: "Garmin Device",
    deviceId: existing?.deviceId ?? getDeviceId(userId, status),
    connectionStatus: localStatus,
    lastSync,
    capabilities: existing?.capabilities?.length
      ? existing.capabilities
      : ["heart_rate", "activities", "advanced_metrics", "running_dynamics"],
    settings: {
      ...(existing?.settings && typeof existing.settings === "object" ? existing.settings : {}),
      serverAuthoritative: true,
      syncState: status.syncState ?? localStatus,
      needsReauth: Boolean(status.needsReauth),
      freshnessLabel: status.freshnessLabel ?? null,
      confidenceLabel: status.confidenceLabel ?? null,
      lastDataReceivedAt: status.lastDataReceivedAt ?? null,
      pendingJobs: status.pendingJobs ?? null,
      datasetCounts: status.datasetCounts ?? null,
      datasetCompleteness: status.datasetCompleteness ?? null,
      notices: status.notices ?? [],
    },
    authTokens: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing?.id) {
    await db.wearableDevices.update(existing.id, deviceRecord)
    return { status, device: { ...existing, ...deviceRecord, id: existing.id } }
  }

  if (!status.connected) {
    return { status, device: null }
  }

  const id = await db.wearableDevices.add(deviceRecord as WearableDevice)
  return { status, device: { ...deviceRecord, id: Number(id) } as WearableDevice }
}
