'use client'

import { Activity } from 'lucide-react'

interface SplitPoint {
  index: number
  paceSecPerKm: number | null
  avgHr: number | null
}

interface PaceHRDualChartProps {
  splits: SplitPoint[]
}

function formatPaceLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PaceHRDualChart({ splits }: PaceHRDualChartProps) {
  const valid = splits.filter(s => s.paceSecPerKm != null && s.paceSecPerKm > 0)
  if (valid.length < 3) return null

  const W = 400
  const H = 100
  const PAD = { t: 10, r: 12, b: 6, l: 12 }
  const WI = W - PAD.l - PAD.r
  const HI = H - PAD.t - PAD.b

  const paces = valid.map(s => s.paceSecPerKm!)
  const hrs = valid.map(s => s.avgHr).filter((v): v is number => v != null)
  const hasHR = hrs.length === valid.length

  const paceMin = Math.min(...paces)
  const paceMax = Math.max(...paces)
  const paceDiff = paceMax - paceMin || 1

  const hrMin = hasHR ? Math.min(...hrs) - 8 : 0
  const hrMax = hasHR ? Math.max(...hrs) + 8 : 200
  const hrDiff = hrMax - hrMin || 1

  const xAt = (i: number) => PAD.l + (i / (valid.length - 1)) * WI
  // Pace: lower pace (faster) = higher on chart → invert
  const yPace = (p: number) => PAD.t + ((p - paceMin) / paceDiff) * HI
  const yHR = (hr: number) => PAD.t + HI - ((hr - hrMin) / hrDiff) * HI

  const paceLine = valid.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yPace(s.paceSecPerKm!).toFixed(1)}`).join(' ')
  const hrLine = hasHR
    ? valid.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yHR(s.avgHr!).toFixed(1)}`).join(' ')
    : null
  const hrArea = hrLine
    ? `${hrLine} L${xAt(valid.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${PAD.l.toFixed(1)},${(H - PAD.b).toFixed(1)} Z`
    : null

  // Step for x-axis labels (show at most 6)
  const step = Math.max(1, Math.floor(valid.length / 6))

  return (
    <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#40DCBE]" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">
            Pace + Heart Rate
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-[#40DCBE]">
            <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
              <line x1="0" y1="1" x2="14" y2="1" stroke="#40DCBE" strokeWidth="2" />
            </svg>
            Pace
          </span>
          {hasHR && (
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-3 h-2 bg-rose-500/30 inline-block rounded" />
              HR
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        preserveAspectRatio="none"
        style={{ height: '72px' }}
      >
        {/* HR area fill */}
        {hrArea && (
          <path d={hrArea} fill="rgba(239,68,68,0.12)" />
        )}
        {/* HR line */}
        {hrLine && (
          <path
            d={hrLine}
            fill="none"
            stroke="rgba(239,68,68,0.5)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        {/* Pace area fill (subtle) */}
        <path
          d={`${paceLine} L${xAt(valid.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${PAD.l.toFixed(1)},${(H - PAD.b).toFixed(1)} Z`}
          fill="rgba(64,220,190,0.06)"
        />
        {/* Pace line */}
        <path
          d={paceLine}
          fill="none"
          stroke="#40DCBE"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Pace dots */}
        {valid.map((s, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yPace(s.paceSecPerKm!)}
            r="2.5"
            fill="#40DCBE"
          />
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-1">
        {valid.map((s, i) =>
          i % step === 0 ? (
            <span key={i} className="text-[9px] text-white/25 tabular-nums">
              km {s.index}
            </span>
          ) : null
        )}
      </div>

      {/* Pace range labels */}
      <div className="flex justify-between mt-2 text-[9px] text-white/30 tabular-nums">
        <span>Fastest {formatPaceLabel(paceMin)}</span>
        <span>Slowest {formatPaceLabel(paceMax)}</span>
      </div>
    </div>
  )
}
