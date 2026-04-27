import { CheckCircle2, ChevronRight, Link2, RefreshCw, RotateCcw, Watch } from "lucide-react"
import { rowItemVariants, profileCardVariants, statusChipVariants } from "@/components/profile/variants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface IntegrationRow {
  icon: LucideIcon
  name: string
  description: string
  status?: "connected" | "available" | "warning"
  onClick?: () => void
}

interface IntegrationsListCardProps {
  garminConnected: boolean
  garminStatusLabel?: string
  garminStatusTone?: "connected" | "available" | "warning"
  garminAction?: "connect" | "sync" | "backfill" | "disconnect" | null
  onGarminConnect: () => void
  onGarminSync: () => void
  onGarminBackfill: () => void
  onGarminDisconnect: () => void
  onGarminDetails: () => void
  rows: IntegrationRow[]
}

export function IntegrationsListCard({
  garminConnected,
  garminStatusLabel,
  garminStatusTone = "connected",
  garminAction = null,
  onGarminConnect,
  onGarminSync,
  onGarminBackfill,
  onGarminDisconnect,
  onGarminDetails,
  rows,
}: IntegrationsListCardProps) {
  const showGarminAttention = garminStatusTone === "warning"

  return (
    <section aria-labelledby="integrations-heading" className="space-y-3">
      <div>
        <h2 id="integrations-heading" className="text-lg font-semibold">
          Devices & Apps
        </h2>
        <p className="text-sm text-muted-foreground">Manage sync status and connect more data sources.</p>
      </div>

      <div className={cn(profileCardVariants({ tone: "secondary" }), "space-y-3 p-4")}>
        <div className={cn(rowItemVariants({ tone: "default" }), "p-3")}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-[oklch(var(--surface-2))]">
              <Watch className="h-5 w-5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Garmin</p>
              <p className="truncate text-sm text-muted-foreground">
                {garminStatusLabel ?? (garminConnected ? "Connected and syncing" : "Not connected")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {garminConnected || showGarminAttention ? (
              <span className={statusChipVariants({ tone: showGarminAttention ? "warning" : "connected" })}>
                {showGarminAttention ? "Attention" : "Connected"}
              </span>
            ) : null}
            {garminConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={onGarminSync}
                  disabled={garminAction != null}
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", garminAction === "sync" && "animate-spin")} />
                  {garminAction === "sync" ? "Syncing..." : "Sync"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={onGarminBackfill}
                  disabled={garminAction != null}
                >
                  <RotateCcw className={cn("mr-1.5 h-3.5 w-3.5", garminAction === "backfill" && "animate-spin")} />
                  {garminAction === "backfill" ? "Syncing..." : "Re-sync all"}
                </Button>
                <Button
                  variant={showGarminAttention ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={onGarminConnect}
                  disabled={garminAction != null}
                >
                  {garminAction === "connect" ? "Opening..." : "Reconnect"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={onGarminDisconnect}
                  disabled={garminAction != null}
                >
                  {garminAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={onGarminDetails}>
                  Details
                </Button>
              </>
            ) : (
              <Button size="sm" className="h-8" onClick={onGarminConnect} disabled={garminAction != null}>
                {garminAction === "connect" ? "Opening..." : showGarminAttention ? "Reconnect" : "Connect"}
              </Button>
            )}
          </div>
        </div>

        <div className="pt-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available Integrations</p>
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.name}
                type="button"
                className={cn(rowItemVariants({ tone: row.status === "warning" ? "warning" : "subtle" }), "w-full p-3 text-left")}
                onClick={row.onClick}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/60">
                      <row.icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{row.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-[oklch(var(--surface-2))] p-3 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" />
            Connected sources improve coaching and analytics confidence.
          </p>
          {garminConnected ? (
            <p className="mt-1 inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Garmin data is active.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
