import { Heart, Target, Flame, Mountain, ActivitySquare, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface CoreSummaryCardProps {
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  elevationGainM?: number | undefined
  avgHr?: number | undefined
  calories?: number | undefined
  cadence?: number | undefined
  relativeEffort?: 'easy' | 'moderate' | 'hard' | undefined
  paceConsistency?: 'consistent' | 'fading' | 'negative-split' | 'erratic' | undefined
  runLoad?: number | undefined
  variant?: 'garmin' | 'light'
}

function formatTimeLocal(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatPaceLocal(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDistance(dist: number): string {
  return dist > 0 ? dist.toFixed(2) : '--'
}

export function CoreSummaryCard({
  distanceKm,
  durationSec,
  avgPaceSecPerKm,
  elevationGainM,
  avgHr,
  calories,
  cadence,
  relativeEffort,
  paceConsistency,
  runLoad,
  variant = 'light',
}: CoreSummaryCardProps) {

  // ─── GARMIN DARK HERO ────────────────────────────────────────────────────
  if (variant === 'garmin') {
    const metricTiles = [
      { label: 'Pace', value: formatPaceLocal(avgPaceSecPerKm), unit: '/km', color: 'text-[#40DCBE]' },
      ...(elevationGainM && elevationGainM > 0
        ? [{ label: 'Elevation', value: String(Math.round(elevationGainM)), unit: 'm↑', color: 'text-emerald-400' }]
        : []),
      ...(cadence && cadence > 0
        ? [{ label: 'Cadence', value: String(Math.round(cadence)), unit: 'spm', color: 'text-violet-400' }]
        : []),
      ...(calories && calories > 0
        ? [{ label: 'Calories', value: String(Math.round(calories)), unit: 'kcal', color: 'text-orange-400' }]
        : []),
      ...(avgHr && avgHr > 0
        ? [{ label: 'Avg HR', value: String(Math.round(avgHr)), unit: 'bpm', color: 'text-rose-400' }]
        : []),
    ]

    const effortColors: Record<string, string> = {
      easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      moderate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    }
    const consistencyColors: Record<string, string> = {
      'consistent': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      'negative-split': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      'fading': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      'erratic': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    }

    return (
      <div className="px-4 -mt-2 pb-4">
        {/* Distance + Time hero row */}
        <div className="flex items-end gap-5 mb-5">
          <div>
            <span className="text-5xl font-black text-white tracking-tight leading-none">
              {formatDistance(distanceKm)}
            </span>
            <span className="text-lg font-semibold text-white/30 ml-1.5">km</span>
          </div>
          <div className="pb-1">
            <span className="text-2xl font-black text-white/60 tracking-tight leading-none">
              {formatTimeLocal(durationSec)}
            </span>
          </div>
        </div>

        {/* Horizontal scrolling metric tiles */}
        {metricTiles.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {metricTiles.map((m, i) => (
              <div
                key={i}
                className="flex-none bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 min-w-[80px]"
              >
                <div className={`text-lg font-black tabular-nums leading-none ${m.color}`}>
                  {m.value}
                </div>
                <div className="text-[9px] text-white/35 uppercase tracking-widest mt-1">
                  {m.label} <span className="normal-case font-normal">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Effort + consistency badges */}
        {(relativeEffort || paceConsistency) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {relativeEffort && (
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${effortColors[relativeEffort] ?? 'text-white/50 bg-white/5 border-white/10'}`}>
                <Flame className="w-3.5 h-3.5" />
                {relativeEffort.charAt(0).toUpperCase() + relativeEffort.slice(1)} Effort
              </span>
            )}
            {paceConsistency && (
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${consistencyColors[paceConsistency] ?? 'text-white/50 bg-white/5 border-white/10'}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {paceConsistency.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── LIGHT VERSION ───────────────────────────────────────────────────────
  const getEffortColor = (effort?: string) => {
    switch (effort) {
      case 'easy': return 'text-emerald-600 bg-emerald-500/10'
      case 'moderate': return 'text-amber-600 bg-amber-500/10'
      case 'hard': return 'text-rose-600 bg-rose-500/10'
      default: return 'text-muted-foreground bg-muted'
    }
  }
  const getPaceConsistencyColor = (consistency?: string) => {
    switch (consistency) {
      case 'consistent': return 'text-emerald-600 bg-emerald-500/10'
      case 'negative-split': return 'text-sky-600 bg-sky-500/10'
      case 'fading': return 'text-amber-600 bg-amber-500/10'
      case 'erratic': return 'text-rose-600 bg-rose-500/10'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <div className="space-y-4">
      {/* Three hero metric cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-primary text-primary-foreground shadow-md">
          <span className="text-3xl font-black tracking-tight leading-none">{formatDistance(distanceKm)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1.5">km</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <span className="text-2xl font-black tracking-tight leading-none">{formatTimeLocal(durationSec)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">Time</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <span className="text-2xl font-black tracking-tight leading-none">{formatPaceLocal(avgPaceSecPerKm)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">/km</span>
        </div>
      </div>

      {/* Secondary KPIs */}
      {(elevationGainM != null && elevationGainM > 0 || avgHr != null || cadence != null || relativeEffort || paceConsistency || calories != null || runLoad != null) && (
        <Card className="border-none shadow-sm bg-[oklch(var(--surface-2))]">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {elevationGainM != null && elevationGainM > 0 && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10"><Mountain className="w-4 h-4 text-emerald-500" /></div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(elevationGainM)}<span className="text-xs font-normal text-muted-foreground ml-0.5">m</span></div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Gain</div>
                  </div>
                </div>
              )}
              {avgHr != null && avgHr > 0 && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10"><Heart className="w-4 h-4 text-rose-500" /></div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(avgHr)}<span className="text-xs font-normal text-muted-foreground ml-0.5">bpm</span></div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Avg HR</div>
                  </div>
                </div>
              )}
              {relativeEffort && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getEffortColor(relativeEffort).split(' ')[1]}`}>
                    <Flame className={`w-4 h-4 ${getEffortColor(relativeEffort).split(' ')[0]}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold capitalize">{relativeEffort}</div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Effort</div>
                  </div>
                </div>
              )}
              {paceConsistency && (
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getPaceConsistencyColor(paceConsistency).split(' ')[1]}`}>
                    <TrendingUp className={`w-4 h-4 ${getPaceConsistencyColor(paceConsistency).split(' ')[0]}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold capitalize">{paceConsistency.replace('-', ' ')}</div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Consistency</div>
                  </div>
                </div>
              )}
              {calories != null && calories > 0 && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10"><Zap className="w-4 h-4 text-orange-500" /></div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(calories)}<span className="text-xs font-normal text-muted-foreground ml-0.5">kcal</span></div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Calories</div>
                  </div>
                </div>
              )}
              {runLoad != null && runLoad > 0 && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10"><Target className="w-4 h-4 text-blue-500" /></div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(runLoad)}</div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Load</div>
                  </div>
                </div>
              )}
              {cadence != null && cadence > 0 && avgHr == null && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10"><ActivitySquare className="w-4 h-4 text-violet-500" /></div>
                  <div>
                    <div className="text-sm font-bold">{Math.round(cadence)}<span className="text-xs font-normal text-muted-foreground ml-0.5">spm</span></div>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Cadence</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
