"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface GarminStatusResponse {
  connected: boolean
  connectionStatus?: string
  lastSyncAt: string | null
  errorState: Record<string, unknown> | null
  freshnessLabel?: string
  confidenceLabel?: string
}

interface GarminSyncResponse {
  success: boolean
  connected: boolean
  lastSyncAt: string | null
  errorState: Record<string, unknown> | null
  freshnessLabel?: string
  confidenceLabel?: string
}

interface SyncStatusProps {
  userId: number | null | undefined
}

function formatLastSync(value: string | null): string {
  if (!value) return "Not synced yet"
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return "Unknown"
  return new Date(parsed).toLocaleString()
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function SyncStatus({ userId }: SyncStatusProps) {
  const [status, setStatus] = useState<GarminStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus({
        connected: false,
        lastSyncAt: null,
        errorState: null,
        freshnessLabel: "unknown",
        confidenceLabel: "low",
      })
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/garmin/status?userId=${encodeURIComponent(String(userId))}`, {
        method: "GET",
        headers: { "x-user-id": String(userId) },
      })
      const payload = (await response.json()) as GarminStatusResponse
      setStatus(payload)
    } catch {
      setError("Could not load Garmin sync status.")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const refreshSync = useCallback(async () => {
    if (!userId) return
    setIsRefreshing(true)
    setError(null)
    try {
      const response = await fetch(`/api/garmin/sync?userId=${encodeURIComponent(String(userId))}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({ trigger: "manual" }),
      })
      const payload = (await response.json()) as GarminSyncResponse
      if (!response.ok || !payload.success) {
        const errorMessage = asText(payload.errorState?.message) ?? "Garmin sync failed."
        throw new Error(errorMessage)
      }

      setStatus((current) => ({
        connected: payload.connected,
        connectionStatus: current?.connectionStatus ?? "connected",
        lastSyncAt: payload.lastSyncAt,
        errorState: payload.errorState,
        freshnessLabel: payload.freshnessLabel ?? current?.freshnessLabel,
        confidenceLabel: payload.confidenceLabel ?? current?.confidenceLabel,
      }))
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Garmin sync failed.")
    } finally {
      setIsRefreshing(false)
      await fetchStatus()
    }
  }, [fetchStatus, userId])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const badgeVariant = useMemo(() => {
    if (!status?.connected) return "secondary"
    if (status.freshnessLabel === "fresh") return "default"
    if (status.freshnessLabel === "stale") return "secondary"
    return "outline"
  }, [status])

  const errorMessage = error ?? asText(status?.errorState?.message)

  return (
    <div className="space-y-2" data-testid="garmin-sync-status">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-emerald-100">Garmin Sync</p>
          <p className="text-xs text-emerald-200/80" data-testid="garmin-sync-last-sync">
            Last sync: {formatLastSync(status?.lastSyncAt ?? null)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant} data-testid="garmin-sync-freshness">
            {status?.freshnessLabel ?? "unknown"}
          </Badge>
          <Badge variant="outline" className="text-emerald-100 border-emerald-400/40" data-testid="garmin-sync-confidence">
            confidence: {status?.confidenceLabel ?? "low"}
          </Badge>
        </div>
      </div>

      {errorMessage ? (
        <p className="text-xs text-rose-300" data-testid="garmin-sync-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-emerald-100/70">
          {status?.connected ? "Connected" : "Not connected"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-300/40 bg-white/5 text-emerald-100 hover:bg-white/10"
          onClick={() => void refreshSync()}
          disabled={Boolean(!userId || isLoading || isRefreshing || !status?.connected)}
          data-testid="garmin-sync-refresh"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  )
}

