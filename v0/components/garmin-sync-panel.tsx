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
}

export function GarminSyncPanel({ userId, onReconnect }: GarminSyncPanelProps) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [isSyncingActivities, setIsSyncingActivities] = useState(false)
  const [isSyncingSleep, setIsSyncingSleep] = useState(false)
  const [lastResult, setLastResult] = useState<{
    activities?: { imported: number; skipped: number }
    sleep?: { imported: number; skipped: number }
  } | null>(null)
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
      })
    } else {
      setDevice(null)
    }
  }

  const handleSyncActivities = async () => {
    setIsSyncingActivities(true)
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
        toast({
          title: "Sync issue",
          description: result.errors[0],
          variant: "destructive",
        })
      } else {
        toast({
          title: result.activitiesImported > 0 ? "Activities imported!" : "Already up to date",
          description:
            result.activitiesImported > 0
              ? `${result.activitiesImported} new run${result.activitiesImported !== 1 ? "s" : ""} added${result.activitiesSkipped > 0 ? `, ${result.activitiesSkipped} already existed` : ""}.`
              : "No new activities to import from the last 14 days.",
        })
      }

      await loadDevice()
    } finally {
      setIsSyncingActivities(false)
    }
  }

  const handleSyncSleep = async () => {
    setIsSyncingSleep(true)
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
        toast({
          title: "Sync issue",
          description: result.errors[0],
          variant: "destructive",
        })
      } else {
        toast({
          title: result.sleepImported > 0 ? "Sleep data imported!" : "Already up to date",
          description:
            result.sleepImported > 0
              ? `${result.sleepImported} night${result.sleepImported !== 1 ? "s" : ""} of sleep data added.`
              : "No new sleep data from the last 7 days.",
        })
      }
    } finally {
      setIsSyncingSleep(false)
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

            <div className="border-t" />

            {/* Sync Sleep */}
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
