import { Gauge, ArrowDownUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Split {
  index: number
  distanceKm: number | null
  durationSec: number | null
  paceSecPerKm: number | null
  avgHr: number | null
  avgCadence: number | null
  elevationGainM: number | null
}

interface SplitsTableProps {
  splits: Split[]
  type: 'km' | 'lap' | 'interval'
  variant?: 'garmin' | 'light'
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm: number | null | undefined): string {
  return formatDuration(secondsPerKm)
}

function formatNumber(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '--'
  return Math.round(val).toString()
}

export function SplitsTable({ splits, type, variant = 'light' }: SplitsTableProps) {
  if (!splits || splits.length === 0) return null

  // Find best and worst splits
  let bestSplitIndex = -1
  let worstSplitIndex = -1
  let minPace = Infinity
  let maxPace = -1

  if (type === 'km' && splits.length > 1) {
    splits.forEach(s => {
      if (s.paceSecPerKm && (s.distanceKm || 0) > 0.8) {
        if (s.paceSecPerKm < minPace) { minPace = s.paceSecPerKm; bestSplitIndex = s.index }
        if (s.paceSecPerKm > maxPace) { maxPace = s.paceSecPerKm; worstSplitIndex = s.index }
      }
    })
  }

  const title = type === 'km' ? 'Km Splits' : type === 'interval' ? 'Intervals' : 'Laps'
  const TitleIcon = type === 'km' ? Gauge : ArrowDownUp
  const paceDiff = maxPace - minPace || 1

  // ─── GARMIN DARK BAR CHART ────────────────────────────────────────────────
  if (variant === 'garmin') {
    return (
      <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <TitleIcon className="w-4 h-4 text-[#40DCBE]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">{title}</h3>
          <span className="ml-auto text-[10px] text-white/25">{splits.length} splits</span>
        </div>

        {/* Split rows with pace bar */}
        <div className="divide-y divide-white/5">
          {splits.map(split => {
            const isBest = split.index === bestSplitIndex
            const isWorst = split.index === worstSplitIndex
            const barWidth = split.paceSecPerKm && Number.isFinite(maxPace) && maxPace > 0
              ? Math.max(10, ((maxPace - split.paceSecPerKm) / paceDiff) * 100)
              : 0

            return (
              <div key={split.index} className="relative group">
                {/* Background pace bar */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                    isBest ? 'bg-[#40DCBE]/12' : isWorst ? 'bg-[#EED678]/8' : 'bg-white/3'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />

                {/* Content */}
                <div className="relative flex items-center gap-3 px-4 py-3">
                  {/* Index */}
                  <span className="w-6 text-xs text-white/30 font-mono tabular-nums flex-none">
                    {split.index}
                  </span>

                  {/* Pace (main) */}
                  <span className={`flex-1 text-base font-black font-mono tabular-nums ${
                    isBest ? 'text-[#40DCBE]' : isWorst ? 'text-[#EED678]' : 'text-white'
                  }`}>
                    {formatPace(split.paceSecPerKm)}
                  </span>

                  {/* Duration */}
                  <span className="text-xs text-white/30 tabular-nums font-mono">
                    {formatDuration(split.durationSec)}
                  </span>

                  {/* HR */}
                  {split.avgHr != null && (
                    <span className="flex items-center gap-1 text-xs text-rose-400 tabular-nums">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-none" />
                      {formatNumber(split.avgHr)}
                    </span>
                  )}

                  {/* Best / Worst badge */}
                  {isBest && (
                    <span className="text-[9px] font-black text-[#40DCBE] bg-[#40DCBE]/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex-none">
                      Best
                    </span>
                  )}
                  {isWorst && (
                    <span className="text-[9px] font-black text-[#EED678] bg-[#EED678]/10 px-1.5 py-0.5 rounded uppercase tracking-widest flex-none">
                      Slow
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── LIGHT — plain table ──────────────────────────────────────────────────
  return (
    <Card className="border-none shadow-sm bg-[oklch(var(--surface-2))]">
      <CardContent className="p-0">
        <div className="p-4 pb-2 flex items-center gap-2 border-b border-border/50">
          <TitleIcon className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        <div className="divide-y divide-border/40">
          {splits.map(split => {
            const isBest = split.index === bestSplitIndex
            const isWorst = split.index === worstSplitIndex
            return (
              <div
                key={split.index}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                  isBest ? 'bg-emerald-500/5' : isWorst ? 'bg-amber-500/5' : ''
                }`}
              >
                <span className="text-muted-foreground w-7 flex-none tabular-nums">
                  {type === 'km' ? `km ${split.index}` : split.index}
                </span>
                <span className={`flex-1 font-bold tabular-nums font-mono ${
                  isBest ? 'text-emerald-600' : isWorst ? 'text-amber-600' : ''
                }`}>
                  {formatPace(split.paceSecPerKm)}
                </span>
                {split.avgHr != null && (
                  <span className="text-xs text-rose-500 tabular-nums">{formatNumber(split.avgHr)} bpm</span>
                )}
                {isBest && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">Best</span>}
                {isWorst && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Slow</span>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
