"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { trackAnalyticsEvent } from "@/lib/analytics"
import {
  fetchGarminConnectionStatus,
  rehydrateGarminDeviceFromServer,
  type GarminConnectionStatus,
} from "@/lib/garmin/connection-status"

interface RefreshOptions {
  source?: string
}

export function useGarminConnectionStatus(userId: number | null | undefined) {
  const [status, setStatus] = useState<GarminConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)

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

  useEffect(() => {
    void refresh({ source: "mount" })
  }, [refresh])

  useEffect(() => {
    if (!userId || typeof window === "undefined") return

    const refreshFromResume = () => {
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
      void refresh({ source: "callback_completed" })
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
  }, [refresh, userId])

  return useMemo(
    () => ({
      status,
      connected: Boolean(status?.connected),
      syncState: status?.syncState ?? status?.connectionStatus ?? null,
      needsReauth: Boolean(status?.needsReauth),
      isLoading,
      error,
      refresh,
    }),
    [error, isLoading, refresh, status]
  )
}
