"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Stethoscope,
  Watch,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db"
import {
  getGarminSyncCatalog,
  syncGarminEnabledData,
  type GarminDatasetCapability,
  type GarminEnabledSyncResult,
  type GarminSyncCatalogResult,
} from "@/lib/garminSync"

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

function capabilityBadgeClass(capability: GarminDatasetCapability): string {
  if (capability.enabledForSync) {
    return "bg-green-100 text-green-700"
  }

  if (!capability.supportedByRunSmart) {
    return "bg-slate-100 text-slate-700"
  }

  if (capability.permissionGranted && !capability.endpointReachable) {
    return "bg-amber-100 text-amber-700"
  }

  return "bg-gray-100 text-gray-700"
}

function capabilityStatus(capability: GarminDatasetCapability): string {
  if (capability.enabledForSync) {
    return "Enabled"
  }

  if (!capability.supportedByRunSmart) {
    return "Not supported"
  }

  if (capability.permissionGranted && !capability.endpointReachable) {
    return "Provisioning needed"
  }

  return "Permission missing"
}

export function GarminSyncPanel({ userId, onReconnect }: GarminSyncPanelProps) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [catalog, setCatalog] = useState<GarminSyncCatalogResult | null>(null)
  const [lastResult, setLastResult] = useState<GarminEnabledSyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [diagnoseResult, setDiagnoseResult] = useState<unknown>(null)
  const [showDiagnose, setShowDiagnose] = useState(false)
  const { toast } = useToast()

  const loadDevice = useCallback(async () => {
    const d = await db.wearableDevices
      .where("[userId+type]" as any)
      .equals([userId, "garmin"])
      .first()

    if (!d) {
      setDevice(null)
      return
    }

    setDevice({
      id: d.id!,
      name: d.name,
      connectionStatus: d.connectionStatus,
      lastSync: d.lastSync ?? null,
      authTokens: (d as any).authTokens,
    })
  }, [userId])

  const refreshCatalog = useCallback(async () => {
    setIsLoadingCatalog(true)
    setCatalogError(null)

    try {
      const result = await getGarminSyncCatalog(userId)

      if (result.needsReauth) {
        toast({
          title: "Reconnect required",
          description: "Your Garmin session expired. Please reconnect.",
          variant: "destructive",
        })
        onReconnect?.()
        return
      }

      if (result.errors.length > 0) {
        setCatalogError(result.errors[0])
        return
      }

      setCatalog(result)
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [onReconnect, toast, userId])

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

  useEffect(() => {
    if (!device || device.connectionStatus === "error") return
    void refreshCatalog()
  }, [device, refreshCatalog])

  const handleSyncEnabledData = async () => {
    setIsSyncing(true)
    setSyncError(null)

    try {
      const result = await syncGarminEnabledData(userId)

      if (result.needsReauth) {
        toast({
          title: "Reconnect required",
          description: "Your Garmin session expired. Please reconnect.",
          variant: "destructive",
        })
        onReconnect?.()
        return
      }

      setLastResult(result)
      setCatalog(result)

      if (result.errors.length > 0) {
        setSyncError(result.errors[0])
        toast({
          title: "Sync failed",
          description: result.errors[0],
          variant: "destructive",
          duration: 8000,
        })
        return
      }

      const importedTotal = result.activitiesImported + result.sleepImported
      const skippedTotal = result.activitiesSkipped + result.sleepSkipped

      toast({
        title: importedTotal > 0 ? "Garmin sync complete" : "No new Garmin data",
        description:
          importedTotal > 0
            ? `Imported ${result.activitiesImported} activities and ${result.sleepImported} sleep summaries.`
            : `No new records were imported${skippedTotal > 0 ? ` (${skippedTotal} already existed).` : "."}`,
      })

      if (result.notices.length > 0) {
        toast({
          title: "Some datasets were skipped",
          description: result.notices[0],
          duration: 9000,
        })
      }

      await loadDevice()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDiagnose = async () => {
    const accessToken = device?.authTokens?.accessToken
    if (!accessToken) {
      toast({
        title: "No token",
        description: "No access token found - please reconnect Garmin.",
        variant: "destructive",
      })
      return
    }

    setIsDiagnosing(true)
    setDiagnoseResult(null)

    try {
      const res = await fetch("/api/devices/garmin/diagnose", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setDiagnoseResult(data)
      setShowDiagnose(true)
    } catch (error) {
      setDiagnoseResult({ error: String(error) })
      setShowDiagnose(true)
    } finally {
      setIsDiagnosing(false)
    }
  }

  const lastSyncText = device?.lastSync
    ? `Last synced ${formatRelativeTime(device.lastSync)}`
    : "Never synced"

  const syncSummary = useMemo(() => {
    if (!lastResult) return null

    return `Imported ${lastResult.activitiesImported} activities and ${lastResult.sleepImported} sleep summaries. Skipped ${lastResult.activitiesSkipped + lastResult.sleepSkipped} existing records.`
  }, [lastResult])

  if (!device) return null

  const isError = device.connectionStatus === "error"

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
            className={isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}
          >
            {isError ? (
              <>
                <AlertCircle className="mr-1 h-3 w-3" />
                Reconnect needed
              </>
            ) : (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Connected
              </>
            )}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{lastSyncText}</p>
      </CardHeader>

      <CardContent className="space-y-4">
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
            <div className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{catalog?.syncName ?? "RunSmart Garmin Enablement Sync"}</p>
                  <p className="text-xs text-muted-foreground">
                    Sync only datasets Garmin currently enables for this app and user.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncEnabledData}
                  disabled={isSyncing || isLoadingCatalog}
                >
                  {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="ml-1">{isSyncing ? "Syncing..." : "Sync"}</span>
                </Button>
              </div>

              {syncError && (
                <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 break-all">
                  <span className="font-medium">Error: </span>
                  {syncError}
                </div>
              )}

              {syncSummary && (
                <div className="mt-3 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                  {syncSummary}
                </div>
              )}

              {lastResult?.notices.length ? (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-medium">Skipped datasets</p>
                  {lastResult.notices.map((notice) => (
                    <p key={notice} className="mt-1">
                      {notice}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Current Garmin enablement</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={refreshCatalog}
                  disabled={isLoadingCatalog || isSyncing}
                >
                  {isLoadingCatalog ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="ml-1">Refresh</span>
                </Button>
              </div>

              {isLoadingCatalog ? (
                <div className="text-xs text-muted-foreground">Loading Garmin capabilities...</div>
              ) : catalogError ? (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 break-all">
                  <span className="font-medium">Error: </span>
                  {catalogError}
                </div>
              ) : catalog?.capabilities.length ? (
                <div className="space-y-2">
                  {catalog.capabilities.map((capability) => (
                    <div key={capability.key} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{capability.label}</p>
                        <Badge className={capabilityBadgeClass(capability)}>{capabilityStatus(capability)}</Badge>
                      </div>
                      {capability.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground break-words">{capability.reason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No capability data yet.</div>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">What Garmin can enable for RunSmart</p>
              {catalog?.availableToEnable?.length ? (
                <div className="space-y-2">
                  {catalog.availableToEnable.map((item) => (
                    <div key={item.key} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{item.permission}</p>
                        <Badge className={item.supportedByRunSmart ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>
                          {item.supportedByRunSmart ? "Supported now" : "Not in current sync"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground break-words">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Refresh capability catalog to review available Garmin permissions.
                </div>
              )}
            </div>

            <div className="space-y-2 border-t pt-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-between text-xs text-muted-foreground"
                onClick={
                  isDiagnosing
                    ? undefined
                    : diagnoseResult
                      ? () => setShowDiagnose((value) => !value)
                      : handleDiagnose
                }
                disabled={isDiagnosing}
              >
                <span className="flex items-center gap-1">
                  {isDiagnosing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Stethoscope className="h-3 w-3" />
                  )}
                  {isDiagnosing ? "Running diagnostics..." : diagnoseResult ? "Diagnostics" : "Diagnose connection"}
                </span>
                {diagnoseResult && !isDiagnosing ? (
                  showDiagnose ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                ) : null}
              </Button>

              {diagnoseResult && showDiagnose ? (
                <div className="rounded border bg-gray-50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Raw API response</span>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnoseResult, null, 2))}
                      >
                        Copy
                      </button>
                      <button className="text-xs text-muted-foreground underline" onClick={handleDiagnose}>
                        Re-run
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-[10px] text-gray-700">
                    {JSON.stringify(diagnoseResult, null, 2)}
                  </pre>
                </div>
              ) : null}
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
