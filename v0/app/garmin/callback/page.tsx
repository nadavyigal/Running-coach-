"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { db, type WearableDevice } from "@/lib/db"

type CallbackStatus = "processing" | "success" | "error"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function asDate(value: unknown): Date | null {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asConnectionStatus(value: unknown): WearableDevice["connectionStatus"] {
  return value === "connected" || value === "disconnected" || value === "syncing" || value === "error"
    ? value
    : "connected"
}

function GarminCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasProcessedRef = useRef(false)
  const [status, setStatus] = useState<CallbackStatus>("processing")
  const [message, setMessage] = useState("Finalizing Garmin connection...")

  useEffect(() => {
    if (hasProcessedRef.current) return
    hasProcessedRef.current = true

    const code = searchParams.get("code")
    const state = searchParams.get("state") ?? searchParams.get("oauth_state")
    const oauthError = searchParams.get("error")

    const completeOAuth = async () => {
      if (oauthError) {
        setStatus("error")
        setMessage(`Garmin authorization failed: ${oauthError}`)
        return
      }

      if (!code || !state) {
        setStatus("error")
        setMessage("Missing OAuth parameters. Please reconnect Garmin from Settings.")
        return
      }

      try {
        const response = await fetch("/api/devices/garmin/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ code, state }),
        })

        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Garmin callback failed")
        }

        if (data.device && typeof data.userId === "number") {
          const { userId, device } = data as { userId: number; device: Record<string, unknown> }
          const now = new Date()
          const model = asString(device.model)
          const normalizedDevice: Omit<WearableDevice, "id"> = {
            userId,
            type: "garmin",
            name: asString(device.name) ?? "Garmin Device",
            ...(model ? { model } : {}),
            deviceId: asString(device.deviceId) ?? `garmin-${userId}`,
            connectionStatus: asConnectionStatus(device.connectionStatus),
            lastSync: asDate(device.lastSync),
            capabilities: asStringArray(device.capabilities),
            settings: asRecord(device.settings),
            createdAt: asDate(device.createdAt) ?? now,
            updatedAt: asDate(device.updatedAt) ?? now,
          }

          const existing = await db.wearableDevices.where({ userId, type: "garmin" }).first()
          if (existing?.id) {
            await db.wearableDevices.update(existing.id, {
              ...normalizedDevice,
              updatedAt: new Date(),
            })
          } else {
            await db.wearableDevices.add(normalizedDevice as WearableDevice)
          }
        }

        setStatus("success")
        setMessage("Garmin connected. Redirecting...")

        setTimeout(() => {
          router.replace("/?screen=profile")
        }, 1200)
      } catch (error) {
        setStatus("error")
        setMessage(error instanceof Error ? error.message : "Garmin connection failed")
      }
    }

    void completeOAuth()
  }, [router, searchParams])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Garmin Connection</h1>
        <p className="mt-3 text-sm text-gray-700">{message}</p>

        {status === "processing" && <p className="mt-4 text-sm text-gray-500">Please wait...</p>}

        {status === "success" && (
          <p className="mt-4 text-sm text-green-700">Connection completed successfully.</p>
        )}

        {status === "error" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-700">Connection could not be completed.</p>
            <Link href="/?screen=profile" className="inline-block text-sm font-medium text-blue-700 underline">
              Return to profile
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

function GarminCallbackFallback() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Garmin Connection</h1>
        <p className="mt-3 text-sm text-gray-700">Finalizing Garmin connection...</p>
        <p className="mt-4 text-sm text-gray-500">Please wait...</p>
      </div>
    </main>
  )
}

export default function GarminCallbackPage() {
  return (
    <Suspense fallback={<GarminCallbackFallback />}>
      <GarminCallbackContent />
    </Suspense>
  )
}
