'use client'

import {
  loadGarminDashboardData as loadLegacyGarminDashboardData,
  type GarminDashboardData,
} from '@/lib/garminDashboardData'

interface GarminDashboardApiResponse extends Omit<GarminDashboardData, 'lastSyncAt'> {
  lastSyncAt: string | null
}

function parseLastSyncAt(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function loadGarminDashboardData(userId: number): Promise<GarminDashboardData> {
  try {
    const response = await fetch(`/api/garmin/dashboard?userId=${encodeURIComponent(String(userId))}`, {
      headers: { 'x-user-id': String(userId) },
    })

    if (!response.ok) {
      throw new Error(`Garmin dashboard request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as GarminDashboardApiResponse
    return {
      ...payload,
      lastSyncAt: parseLastSyncAt(payload.lastSyncAt),
    }
  } catch {
    return loadLegacyGarminDashboardData(userId)
  }
}

export type { GarminDashboardData }
