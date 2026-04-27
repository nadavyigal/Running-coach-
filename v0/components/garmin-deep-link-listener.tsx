"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { App } from "@capacitor/app"
import { isNativePlatform } from "@/lib/capacitor-platform"
import { trackAnalyticsEvent } from "@/lib/analytics"

function getGarminCallbackPath(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    if (!parsed.pathname.endsWith("/garmin/callback")) return null
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export function GarminDeepLinkListener() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativePlatform()) return

    let cancelled = false
    const cleanupHandlers: Array<() => void> = []

    App.addListener("appUrlOpen", ({ url }) => {
      const callbackPath = getGarminCallbackPath(url)
      if (!callbackPath) return

      void trackAnalyticsEvent("garmin_app_return_detected", {
        urlHost: (() => {
          try {
            return new URL(url).host
          } catch {
            return "unknown"
          }
        })(),
      })
      window.dispatchEvent(new CustomEvent("garmin-app-return", { detail: { source: "deep_link", url } }))
      router.push(callbackPath)
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      cleanupHandlers.push(() => void handle.remove())
    })

    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return
      window.dispatchEvent(new CustomEvent("garmin-app-return", { detail: { source: "resume" } }))
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      cleanupHandlers.push(() => void handle.remove())
    })

    return () => {
      cancelled = true
      cleanupHandlers.forEach((cleanup) => cleanup())
    }
  }, [router])

  return null
}
