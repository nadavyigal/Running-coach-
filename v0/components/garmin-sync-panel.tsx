"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db"
import { syncGarminActivities, syncGarminSleep } from "@/lib/garminSync"
import {
  RefreshCw,
  Activity,
  Moon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Watch,
  ChevronDown,
  ChevronUp,
  Stethoscope,
} from "lucide-react"

interface GarminSyncPanelProps {
  userId: number
  onReconnect?: () => void
}

interface DeviceInfo {
  id: number
  name: string
  connectionStatus: string
  lastSync: Date | null
  authTokens?: { accessToken?: string }
}

export function GarminSyncPanel({ userId, onReconnect }: GarminSyncPanelProps) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [isSyncingActivities, setIsSyncingActivities] = useState(false)
  const [isSyncingSleep, setIsSyncingSleep] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [lastResult, setLastResult] = useState<{
    activities?: { imported: number; skipped: number }
    sleep?: { imported: number; skipped: number }
  } | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [sleepError, setSleepError] = useState<string | null>(null)
  const [diagnoseResult, setDiagnoseResult] = useState<unknown>(null)
  const [showDiagnose, setShowDiagnose] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadDevice()
  }, [userId])

  const loadDevice = async () => {
    const d = await db.wearableDevices
      .where('[userId+type]' as any)
      .equals([userId, 'garmin'])
      .first()
    if (d) {
      setDevice({
        id: d.id!,
        name: d.name,
        connectionStatus: d.connectionStatus,
        lastSync: d.lastSync ?? null,
        authTokens: (d as any).authTokens,
      })
    } else {
      setDevice(null)
    }
  }

  const handleSyncActivities = async () => {
    setIsSyncingActivities(true)
    setActivityError(null)
    try {
      const result = await syncGarminActivities(userId, 14)

      if (result.needsReauth) {
        toast({
          title: "Reconnect required",
          description: "Your Garmin session expired. Please reconnect.",
          variant: "destructive",
        })
        onReconnect?.()
        return
      }

      setLastResult((prev) => ({
        ...prev,
        activities: { imported: result.activitiesImported, skipped: result.activitiesSkipped },
      }))

      if (result.errors.length > 0) {
        setActivityError(result.errors[0])
        toast({
          title: "Sync failed",
          description: result.errors[0],
          variant: "destructive",
          duration: 8000,
        })
      } else {
        toast({
          title: result.activitiesImported > 0 ? "Activities imported!" : "Already up to date",
          description:
            result.activitiesImported > 0
              ? `${result.activitiesImported} new run${result.activitiesImported !== 1 ? "s" : ""} added${result.activitiesSkipped > 0 ? `, ${result.activitiesSkipped} already existed` : ""}.`
              : "No new activities found in the last 14 days.",
        })
      }

      await loadDevice()
    } finally {
      setIsSyncingActivities(false)
    }
  }

  const handleSyncSleep = async () => {
    setIsSyncingSleep(true)
    setSleepError(null)
    try {
      const result = await syncGarminSleep(userId, 7)

      if (result.needsReauth) {
        toast({
          title: "Reconnect required",
          description: "Your Garmin session expired. Please reconnect.",
          variant: "destructive",
        })
        onReconnect?.()
        return
      }

      setLastResult((prev) => ({
        ...prev,
        sleep: { imported: result.sleepImported, skipped: result.sleepSkipped },
      }))

      if (result.errors.length > 0) {
        setSleepError(result.errors[0])
        toast({
          title: "Sync failed",
          description: result.errors[0],
          variant: "destructive",
          duration: 8000,
        })
      } else {
        toast({
          title: result.sleepImported > 0 ? "Sleep data imported!" : "Already up to date",
          description:
            result.sleepImported > 0
              ? `${result.sleepImported} night${result.sleepImported !== 1 ? "s" : ""} of sleep data added.`
              : "No new sleep data found in the last 7 days.",
        })
      }
    } finally {
      setIsSyncingSleep(false)
    }
  }

  const handleDiagnose = async () => {
    const accessToken = device?.authTokens?.accessToken
    if (!accessToken) {
      toast({ title: "No token", description: "No access token found — please reconnect Garmin.", variant: "destructive" })
      return
    }
    setIsDiagnosing(true)
    setDiagnoseResult(null)
    try {
      const res = await fetch('/api/devices/garmin/diagnose', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setDiagnoseResult(data)
      setShowDiagnose(true)
    } catch (e) {
      setDiagnoseResult({ error: String(e) })
      setShowDiagnose(true)
    } finally {
      setIsDiagnosing(false)
    }
  }

  if (!device) return null

  const isError = device.connectionStatus === "error"
  const lastSyncText = device.lastSync
    ? `Last synced ${formatRelativeTime(device.lastSync)}`
    : "Never synced"

  return (
    <Card className="border-green-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-green-600" />
            <span>{device.name}</span>
          </div>
          <Badge
            variant="secondary"
            className={
              isError
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }
          >
            {isError ? (
              <><AlertCircle className="h-3 w-3 mr-1" />Reconnect needed</>
            ) : (
              <><CheckCircle className="h-3 w-3 mr-1" />Connected</>
            )}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{lastSyncText}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {isError ? (
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            onClick={onReconnect}
          >
            Reconnect Garmin
          </Button>
        ) : (
          <>
            {/* Sync Activities */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Activities</div>
                    <div className="text-xs text-muted-foreground">Last 14 days of runs</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lastResult?.activities && (
                    <span className="text-xs text-green-600 font-medium">
                      +{lastResult.activities.imported}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncActivities}
                    disabled={isSyncingActivities || isSyncingSleep}
                  >
                    {isSyncingActivities ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="ml-1">{isSyncingActivities ? "Syncing…" : "Sync"}</span>
                  </Button>
                </div>
              </div>
              {activityError && (
                <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700 break-all">
                  <span className="font-medium">Error: </span>{activityError}
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* Sync Sleep */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Sleep</div>
                    <div className="text-xs text-muted-foreground">Last 7 nights</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lastResult?.sleep && (
                    <span className="text-xs text-green-600 font-medium">
                      +{lastResult.sleep.imported}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncSleep}
                    disabled={isSyncingActivities || isSyncingSleep}
                  >
                    {isSyncingSleep ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="ml-1">{isSyncingSleep ? "Syncing…" : "Sync"}</span>
                  </Button>
                </div>
              </div>
              {sleepError && (
                <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700 break-all">
                  <span className="font-medium">Error: </span>{sleepError}
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* Diagnose connection */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground justify-between"
                onClick={isDiagnosing ? undefined : (diagnoseResult ? () => setShowDiagnose((v) => !v) : handleDiagnose)}
                disabled={isDiagnosing}
              >
                <span className="flex items-center gap-1">
                  {isDiagnosing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Stethoscope className="h-3 w-3" />
                  )}
                  {isDiagnosing ? "Running diagnostics…" : diagnoseResult ? "Diagnostics" : "Diagnose connection"}
                </span>
                {diagnoseResult && !isDiagnosing && (
                  showDiagnose ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                )}
              </Button>

              {diagnoseResult && showDiagnose && (
                <div className="rounded bg-gray-50 border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Raw API Response</span>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnoseResult, null, 2))}
                      >
                        Copy
                      </button>
                      <button
                        className="text-xs text-muted-foreground underline"
                        onClick={handleDiagnose}
                      >
                        Re-run
                      </button>
                    </div>
                  </div>
                  <pre className="text-[10px] text-gray-700 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                    {JSON.stringify(diagnoseResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
