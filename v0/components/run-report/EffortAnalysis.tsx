import { Flame, HeartPulse, TrendingUp } from 'lucide-react'
import { getZoneDistribution } from '@/lib/hrZoneUtils'

interface EffortAnalysisProps {
  avgHr?: number | null
  maxHr?: number | null
  effortScore?: 'easy' | 'moderate' | 'hard'
  paceConsistency?: 'consistent' | 'fading' | 'negative-split' | 'erratic'
  variant?: 'garmin' | 'light'
}

const EFFORT_CONFIG = {
  easy:     { deg: 120, hex: '#10b981', text: 'text-emerald-400', pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  moderate: { deg: 200, hex: '#f59e0b', text: 'text-amber-400',   pill: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  hard:     { deg: 300, hex: '#f43f5e', text: 'text-rose-400',    pill: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
} as const

const CONSISTENCY_CONFIG = {
  'consistent':     { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Consistent' },
  'negative-split': { pill: 'text-sky-400 bg-sky-500/10 border-sky-500/20',             label: 'Negative Split' },
  'fading':         { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       label: 'Fading' },
  'erratic':        { pill: 'text-rose-400 bg-rose-500/10 border-rose-500/20',          label: 'Erratic' },
} as const

export function EffortAnalysis({ avgHr, maxHr, effortScore, paceConsistency, variant = 'light' }: EffortAnalysisProps) {
  if (!avgHr && !effortScore) return null

  const fakeDistribution = avgHr ? getZoneDistribution(avgHr) : []
  const effort = effortScore ? EFFORT_CONFIG[effortScore] : null

  // ─── GARMIN DARK ─────────────────────────────────────────────────────────
  if (variant === 'garmin') {
    const effortDeg = effort?.deg ?? 0
    const effortHex = effort?.hex ?? 'rgba(255,255,255,0.08)'

    return (
      <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-5 mb-4">
          {/* Circular effort ring */}
          {effortScore && (
            <div className="relative flex-none w-20 h-20">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(${effortHex} 0deg, ${effortHex} ${effortDeg}deg, rgba(255,255,255,0.06) ${effortDeg}deg 360deg)`,
                }}
              />
              <div className="absolute inset-[14%] rounded-full bg-slate-900 flex flex-col items-center justify-center gap-0.5">
                <Flame className={`w-4 h-4 ${effort?.text ?? 'text-white/40'}`} />
                <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${effort?.text ?? 'text-white/40'}`}>
                  {effortScore}
                </span>
              </div>
            </div>
          )}

          {/* HR quick stats */}
          <div className="flex-1 space-y-2">
            {avgHr != null && (
              <div>
                <span className="text-2xl font-black text-white tabular-nums">{Math.round(avgHr)}</span>
                <span className="text-sm text-white/35 ml-1">bpm avg</span>
              </div>
            )}
            {maxHr != null && (
              <div>
                <span className="text-base font-bold text-rose-400 tabular-nums">{Math.round(maxHr)}</span>
                <span className="text-xs text-rose-400/50 ml-1">bpm peak</span>
              </div>
            )}
          </div>
        </div>

        {/* Zone bars (dark themed) */}
        {avgHr != null && fakeDistribution.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
              Estimated Zone Time
            </div>
            {fakeDistribution.map((zone, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-8 text-[10px] text-white/35 font-mono">{zone.name}</div>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${zone.percent}%`, backgroundColor: zone.hexColor }}
                  />
                </div>
                <div className="w-7 text-right text-[10px] text-white/30 tabular-nums">{zone.percent}%</div>
              </div>
            ))}
            <p className="text-[9px] text-white/20 text-right mt-1">*Estimated from avg HR</p>
          </div>
        )}
      </div>
    )
  }

  // ─── LIGHT — compact badge pills ─────────────────────────────────────────
  return (
    <div className="flex flex-wrap gap-2">
      {effortScore && effort && (
        <span className={`flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-full border ${effort.pill}`}>
          <Flame className="w-4 h-4" />
          {effortScore.charAt(0).toUpperCase() + effortScore.slice(1)} Effort
        </span>
      )}
      {paceConsistency && CONSISTENCY_CONFIG[paceConsistency] && (
        <span className={`flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-full border ${CONSISTENCY_CONFIG[paceConsistency].pill}`}>
          <TrendingUp className="w-4 h-4" />
          {CONSISTENCY_CONFIG[paceConsistency].label}
        </span>
      )}
      {avgHr != null && (
        <span className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-full border border-rose-500/20 text-rose-500 bg-rose-500/8">
          <HeartPulse className="w-4 h-4" />
          {Math.round(avgHr)} bpm
        </span>
      )}
    </div>
  )
}
