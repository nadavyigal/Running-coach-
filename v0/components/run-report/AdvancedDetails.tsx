import { useState } from 'react'
import { ChevronDown, ChevronUp, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface AdvancedDetailsProps {
  runId: number
  hasGarminData: boolean
  gpsQualityScore?: number
  metrics?: {
    paceVariabilitySecPerKm?: number
    splitDeltaSecPerKm?: number
    cadenceDriftPct?: number
    intervalConsistencyPct?: number
    maxSpeedKmph?: number
    elevationLossM?: number
  }
  variant?: 'garmin' | 'light'
}

export function AdvancedDetails({ runId, hasGarminData, gpsQualityScore, metrics, variant = 'light' }: AdvancedDetailsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasMetrics = metrics && Object.values(metrics).some(v => v != null)
  if (!hasGarminData && !gpsQualityScore && !hasMetrics) return null

  // ─── GARMIN DARK — always-visible colored tile grid ───────────────────────
  if (variant === 'garmin') {
    // Only show if there are actual analytics tiles to display
    if (!hasMetrics) return null

    const tiles = [
      metrics?.paceVariabilitySecPerKm != null && {
        label: 'Pace Variability',
        value: `${metrics.paceVariabilitySecPerKm.toFixed(0)}`,
        unit: 's/km',
        color: 'text-blue-400',
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/8',
      },
      metrics?.splitDeltaSecPerKm != null && {
        label: 'Half Split Δ',
        value: `${metrics.splitDeltaSecPerKm > 0 ? '+' : ''}${metrics.splitDeltaSecPerKm.toFixed(0)}`,
        unit: 's/km',
        color: 'text-indigo-400',
        border: 'border-indigo-500/20',
        bg: 'bg-indigo-500/8',
      },
      metrics?.cadenceDriftPct != null && {
        label: 'Cadence Drift',
        value: `${metrics.cadenceDriftPct > 0 ? '+' : ''}${metrics.cadenceDriftPct.toFixed(1)}`,
        unit: '%',
        color: 'text-violet-400',
        border: 'border-violet-500/20',
        bg: 'bg-violet-500/8',
      },
      metrics?.intervalConsistencyPct != null && {
        label: 'Rep Consistency',
        value: `${metrics.intervalConsistencyPct.toFixed(0)}`,
        unit: '%',
        color: 'text-amber-400',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/8',
      },
      metrics?.elevationLossM != null && {
        label: 'Elevation Loss',
        value: `-${metrics.elevationLossM.toFixed(0)}`,
        unit: 'm',
        color: 'text-emerald-400',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/8',
      },
      metrics?.maxSpeedKmph != null && {
        label: 'Top Speed',
        value: `${metrics.maxSpeedKmph.toFixed(1)}`,
        unit: 'km/h',
        color: 'text-sky-400',
        border: 'border-sky-500/20',
        bg: 'bg-sky-500/8',
      },
    ].filter(Boolean) as NonNullable<{ label: string; value: string; unit: string; color: string; border: string; bg: string }>[]

    if (tiles.length === 0) return null

    return (
      <div className="mx-4 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-white/25" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
            Garmin Analytics
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((tile, i) => (
            <div
              key={i}
              className={`rounded-xl p-3.5 border ${tile.border} ${tile.bg}`}
            >
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${tile.color} opacity-70`}>
                {tile.label}
              </div>
              <div className="text-xl font-black text-white tabular-nums leading-none">
                {tile.value}
                <span className="text-xs font-normal text-white/30 ml-1">{tile.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── LIGHT — collapsible accordion (original design) ─────────────────────
  return (
    <Card className="border-none shadow-sm bg-[oklch(var(--surface-2))] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[oklch(var(--surface-3))]/20 hover:bg-[oklch(var(--surface-3))]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground/80">Advanced Metrics & Data Quality</h3>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <CardContent className="p-4 pt-2 border-t border-border/10 space-y-6 animate-in slide-in-from-top-2 duration-200">
          {(hasGarminData || gpsQualityScore != null) && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data Quality</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {gpsQualityScore != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">GPS Reliability</div>
                    <div className="text-lg font-bold">{gpsQualityScore}<span className="text-xs text-muted-foreground ml-0.5">%</span></div>
                  </div>
                )}
                {hasGarminData && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Source</div>
                    <div className="text-sm font-semibold text-primary">Garmin Connect</div>
                  </div>
                )}
                <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">System ID</div>
                  <div className="text-sm font-mono text-muted-foreground">{runId}</div>
                </div>
              </div>
            </div>
          )}

          {hasMetrics && metrics && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Garmin Analytics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {metrics.paceVariabilitySecPerKm != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-blue-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Pace Variability</div>
                    <div className="text-base font-bold">{metrics.paceVariabilitySecPerKm.toFixed(0)} <span className="text-xs text-muted-foreground">s</span></div>
                  </div>
                )}
                {metrics.splitDeltaSecPerKm != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-indigo-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Half Split Δ</div>
                    <div className="text-base font-bold">{metrics.splitDeltaSecPerKm > 0 ? '+' : ''}{metrics.splitDeltaSecPerKm.toFixed(0)} <span className="text-xs text-muted-foreground">s/km</span></div>
                  </div>
                )}
                {metrics.cadenceDriftPct != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-violet-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Cadence Drift</div>
                    <div className="text-base font-bold">{metrics.cadenceDriftPct > 0 ? '+' : ''}{metrics.cadenceDriftPct.toFixed(1)} <span className="text-xs text-muted-foreground">%</span></div>
                  </div>
                )}
                {metrics.intervalConsistencyPct != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-amber-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Rep Consistency</div>
                    <div className="text-base font-bold">{metrics.intervalConsistencyPct.toFixed(0)} <span className="text-xs text-muted-foreground">%</span></div>
                  </div>
                )}
                {metrics.elevationLossM != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-emerald-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Elevation Loss</div>
                    <div className="text-base font-bold">-{metrics.elevationLossM.toFixed(0)} <span className="text-xs text-muted-foreground">m</span></div>
                  </div>
                )}
                {metrics.maxSpeedKmph != null && (
                  <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-sky-500">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Top Speed</div>
                    <div className="text-base font-bold">{metrics.maxSpeedKmph.toFixed(1)} <span className="text-xs text-muted-foreground">km/h</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
