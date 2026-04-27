"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { trackAnalyticsEvent } from "@/lib/analytics"
import {
  fetchGarminConnectionStatus,
  rehydrateGarminDeviceFromServer,
  type GarminConnectionStatus,
} from "@/lib/garmin/connection-status"
import { syncGarminEnabledData } from "@/lib/garminSync"

interface RefreshOptions {
  source?: string
}

export function useGarminConnectionStatus(userId: number | null | undefined) {
  const [status, setStatus] = useState<GarminConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)
  const postConnectSyncInFlightRef = useRef(false)

  const refresh = useCallback(
    async (options?: RefreshOptions): Promise<GarminConnectionStatus | null> => {
      if (!userId) return null
      const requestId = latestRequestRef.current + 1
      latestRequestRef.current = requestId
      setIsLoading(true)
      setError(null)

      try {
        const nextStatus = await fetchGarminConnectionStatus(userId)
        const result = await rehydrateGarminDeviceFromServer(userId, nextStatus)
        if (latestRequestRef.current === requestId) {
          setStatus(result.status)
        }
        void trackAnalyticsEvent("garmin_reconcile_completed", {
          userId,
          source: options?.source ?? "status_refresh",
          connected: result.status.connected,
          syncState: result.status.syncState ?? null,
          needsReauth: Boolean(result.status.needsReauth),
        })
        return result.status
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to refresh Garmin status"
        if (latestRequestRef.current === requestId) {
          setError(message)
        }
        return null
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsLoading(false)
        }
      }
    },
    [userId]
  )

  const reconcileAndSync = useCallback(
    async (source: string): Promise<void> => {
      if (!userId || postConnectSyncInFlightRef.current) return

      const nextStatus = await refresh({ source })
      if (!nextStatus?.connected || nextStatus.needsReauth) return

      postConnectSyncInFlightRef.current = true
      setIsSyncing(true)
      try {
        const syncResult = await syncGarminEnabledData(userId, { trigger: "backfill" })
        if (syncResult.errors.length > 0) {
          void trackAnalyticsEvent("garmin_sync_partial", {
            userId,
            source,
            error: syncResult.errors[0] ?? null,
          })
        }
        await refresh({ source: `${source}_post_sync` })
      } finally {
        postConnectSyncInFlightRef.current = false
        setIsSyncing(false)
      }
    },
    [refresh, userId]
  )

  useEffect(() => {
    void refresh({ source: "mount" })
  }, [refresh])

  useEffect(() => {
    if (!userId || typeof window === "undefined") return

    const refreshFromResume = (event: Event) => {
      const source = event instanceof CustomEvent ? event.detail?.source : null
      if (source === "deep_link") {
        void reconcileAndSync("app_return_deep_link")
        return
      }
      void refresh({ source: "app_resume" })
    }
    const refreshFromFocus = () => {
      void refresh({ source: "window_focus" })
    }
    const refreshFromVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh({ source: "visibility" })
      }
    }
    const refreshFromCallback = () => {
      void reconcileAndSync("callback_completed")
    }

    window.addEventListener("garmin-app-return", refreshFromResume)
    window.addEventListener("garmin-callback-completed", refreshFromCallback)
    window.addEventListener("focus", refreshFromFocus)
    document.addEventListener("visibilitychange", refreshFromVisibility)

    return () => {
      window.removeEventListener("garmin-app-return", refreshFromResume)
      window.removeEventListener("garmin-callback-completed", refreshFromCallback)
      window.removeEventListener("focus", refreshFromFocus)
      document.removeEventListener("visibilitychange", refreshFromVisibility)
    }
  }, [reconcileAndSync, refresh, userId])

  return useMemo(
    () => ({
      status,
      connected: Boolean(status?.connected),
      syncState: isSyncing ? "syncing" : status?.syncState ?? status?.connectionStatus ?? null,
      needsReauth: Boolean(status?.needsReauth),
      isLoading,
      isSyncing,
      error,
      refresh,
    }),
    [error, isLoading, isSyncing, refresh, status]
  )
}
