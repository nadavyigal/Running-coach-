"use client"

import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/garminDashboardData"
import { cn } from "@/lib/utils"

interface GarminSyncStatusBarProps {
  lastSyncAt: Date | null
  onRefresh?: (() => Promise<void> | void) | undefined
  isRefreshing?: boolean
  showRefreshButton?: boolean
  className?: string
  testId?: string
}

export function GarminSyncStatusBar({
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
  showRefreshButton = true,
  className,
  testId = "garmin-sync-status-bar",
}: GarminSyncStatusBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2",
        className
      )}
      data-testid={testId}
    >
      <p className="text-xs text-slate-600">From your last sync · {formatRelativeTime(lastSyncAt)}</p>

      {showRefreshButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isRefreshing || !onRefresh}
          onClick={() => {
            if (!onRefresh) return
            void onRefresh()
          }}
          data-testid="garmin-sync-refresh-button"
        >
          <RefreshCw className={cn("mr-1 h-3 w-3", isRefreshing ? "animate-spin" : "")} />
          {isRefreshing ? "Syncing" : "Refresh"}
        </Button>
      ) : null}
    </div>
  )
}
