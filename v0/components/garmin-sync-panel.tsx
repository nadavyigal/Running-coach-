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
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
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
}

function capabilityBadgeClass(capability: GarminDatasetCapability): string {
  const reason = capability.reason?.toLowerCase() ?? ""

  if (reason.includes("no garmin export notifications")) {
    return "bg-amber-100 text-amber-700"
  }

  if (reason.includes("webhook storage")) {
    return "bg-red-100 text-red-700"
  }

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
  const reason = capability.reason?.toLowerCase() ?? ""

  if (reason.includes("no garmin export notifications")) {
    return "Waiting for data"
  }

  if (reason.includes("webhook storage")) {
    return "Setup needed"
  }

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
        setCatalogError(result.errors[0] ?? null)
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
      const result = await syncGarminEnabledData(userId, { trigger: "backfill" })

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
        setSyncError(result.errors[0] ?? null)
        toast({
          title: "Sync failed",
          description: result.errors[0],
          variant: "destructive",
          duration: 8000,
        })
        return
      }

      const importedTotal =
        result.activitiesImported + result.sleepImported + result.additionalSummaryImported
      const skippedTotal =
        result.activitiesSkipped + result.sleepSkipped + result.additionalSummarySkipped

      toast({
        title: importedTotal > 0 ? "Garmin sync complete" : "No new Garmin data",
        description:
          importedTotal > 0
            ? `Imported ${result.activitiesImported} activities, ${result.sleepImported} sleep summaries, and ${result.additionalSummaryImported} additional Garmin summaries.`
            : `No new records were imported${skippedTotal > 0 ? ` (${skippedTotal} already existed).` : "."}`,
      })

      if (result.notices.length > 0) {
        toast({
          title: "Some datasets were skipped",
          description: result.notices[0],
          duration: 9000,
        })
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("garmin-run-synced"))
      }

      await loadDevice()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDiagnose = async () => {
    setIsDiagnosing(true)
    setDiagnoseResult(null)

    try {
      const res = await fetch(`/api/devices/garmin/diagnose?userId=${encodeURIComponent(String(userId))}`, {
        headers: { "x-user-id": String(userId) },
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

    return `Imported ${lastResult.activitiesImported} activities, ${lastResult.sleepImported} sleep summaries, and ${lastResult.additionalSummaryImported} additional Garmin summaries. Skipped ${lastResult.activitiesSkipped + lastResult.sleepSkipped + lastResult.additionalSummarySkipped} existing records.`
  }, [lastResult])

  const datasetImportSummary = useMemo(() => {
    if (!lastResult) return []
    return Object.entries(lastResult.datasetImports)
      .filter(([, stats]) => stats.imported > 0 || stats.skipped > 0)
      .sort((a, b) => b[1].imported - a[1].imported)
      .slice(0, 6)
  }, [lastResult])

  const noticeGroups = useMemo(() => {
    const setupIndicators = [
      'garmin_webhook_secret',
      'webhook',
      'derive queue',
      'redis',
      'analytics storage unavailable',
      'storage unavailable',
      'no garmin export records',
      'no new garmin export records',
      'direct garmin pull failed',
    ]

    const setup: string[] = []
    const dataset: string[] = []

    for (const notice of lastResult?.notices ?? []) {
      const normalized = notice.toLowerCase()
      if (setupIndicators.some((token) => normalized.includes(token))) {
        setup.push(notice)
      } else {
        dataset.push(notice)
      }
    }

    return { setup, dataset }
  }, [lastResult])

  const capabilityStats = useMemo(() => {
    if (!catalog?.capabilities?.length) {
      return { enabled: 0, waiting: 0, blocked: 0, supported: 0 }
    }

    const enabled = catalog.capabilities.filter((capability) => capability.enabledForSync).length
    const waiting = catalog.capabilities.filter((capability) =>
      (capability.reason?.toLowerCase() ?? "").includes("no garmin export notifications")
    ).length
    const blocked = catalog.capabilities.filter(
      (capability) => capability.supportedByRunSmart && !capability.enabledForSync && !capability.permissionGranted
    ).length
    const supported = catalog.capabilities.filter((capability) => capability.supportedByRunSmart).length
    return { enabled, waiting, blocked, supported }
  }, [catalog])

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
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{catalog?.syncName ?? "RunSmart Garmin Export Sync"}</p>
                  <p className="text-xs text-muted-foreground">
                    Sync Garmin-exported datasets from the last{" "}
                    {catalog?.ingestion?.lookbackDays ?? "several"} days using Garmin notification feeds.
                  </p>
                </div>
                <GarminSyncStatusBar
                  lastSyncAt={device.lastSync}
                  onRefresh={handleSyncEnabledData}
                  isRefreshing={isSyncing}
                  className="border-slate-200 bg-slate-50"
                  testId="garmin-sync-panel-status-bar"
                />
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

              {catalog?.ingestion ? (
                <div className="mt-3 rounded border bg-slate-50 p-2 text-xs text-slate-700">
                  <p className="font-medium">Garmin export feed status</p>
                  <p className="mt-1">
                    Window: last {catalog.ingestion.lookbackDays} days. Records in window:{" "}
                    {catalog.ingestion.recordsInWindow}.
                  </p>
                  <p className="mt-1">
                    Webhook endpoint:{" "}
                    <code>/api/devices/garmin/webhook/&lt;GARMIN_WEBHOOK_SECRET&gt;</code>
                  </p>
                  {catalog.ingestion.latestReceivedAt ? (
                    <p className="mt-1">
                      Last Garmin feed received:{" "}
                      {new Date(catalog.ingestion.latestReceivedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {!catalog.ingestion.storeAvailable ? (
                    <p className="mt-1 text-red-700">
                      Store unavailable: {catalog.ingestion.storeError ?? "Unknown storage error."}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {datasetImportSummary.length > 0 ? (
                <div className="mt-3 rounded border bg-slate-50 p-2 text-xs text-slate-700">
                  <p className="font-medium">Imported dataset records</p>
                  {datasetImportSummary.map(([datasetKey, stats]) => (
                    <p key={datasetKey} className="mt-1">
                      {datasetKey}: +{stats.imported}
                      {stats.skipped > 0 ? ` (${stats.skipped} existing)` : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {noticeGroups.setup.length ? (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-medium">Sync setup warnings</p>
                  {noticeGroups.setup.map((notice) => (
                    <p key={notice} className="mt-1">
                      {notice}
                    </p>
                  ))}
                </div>
              ) : null}

              {noticeGroups.dataset.length ? (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-medium">Skipped datasets</p>
                  {noticeGroups.dataset.map((notice) => (
                    <p key={notice} className="mt-1">
                      {notice}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Capability badges</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-700">Enabled {capabilityStats.enabled}</Badge>
                <Badge className="bg-amber-100 text-amber-700">Waiting {capabilityStats.waiting}</Badge>
                <Badge className="bg-red-100 text-red-700">Blocked {capabilityStats.blocked}</Badge>
                <Badge className="bg-slate-100 text-slate-700">Supported {capabilityStats.supported}</Badge>
              </div>
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
