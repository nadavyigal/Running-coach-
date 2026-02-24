'use client'

import { HeartPulse } from 'lucide-react'
import { getZoneDistribution, DEFAULT_HR_ZONES, type ZoneDistribution } from '@/lib/hrZoneUtils'

// Destructure to typed constants to avoid array-indexing undefined issues
const [HR_Z5, HR_Z4, HR_Z3, HR_Z2, HR_Z1] = DEFAULT_HR_ZONES as [typeof DEFAULT_HR_ZONES[number], typeof DEFAULT_HR_ZONES[number], typeof DEFAULT_HR_ZONES[number], typeof DEFAULT_HR_ZONES[number], typeof DEFAULT_HR_ZONES[number]]

interface HRZoneWheelProps {
  avgHr: number
  maxHr?: number | null
  /** Optional real zone seconds from Garmin telemetry: z1–z5 */
  zoneSeconds?: Partial<Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5', number>>
}

function buildDistributionFromSeconds(
  zoneSeconds: Partial<Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5', number>>
): ZoneDistribution[] | null {
  const rawVals = [
    zoneSeconds.z5 ?? 0,
    zoneSeconds.z4 ?? 0,
    zoneSeconds.z3 ?? 0,
    zoneSeconds.z2 ?? 0,
    zoneSeconds.z1 ?? 0,
  ]
  const total = rawVals.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const s5 = rawVals[0] ?? 0
  const s4 = rawVals[1] ?? 0
  const s3 = rawVals[2] ?? 0
  const s2 = rawVals[3] ?? 0
  const s1 = rawVals[4] ?? 0
  return [
    { name: HR_Z5.name, min: HR_Z5.min, max: HR_Z5.max, color: HR_Z5.color, hexColor: HR_Z5.hexColor, description: HR_Z5.description, percent: Math.round((s5 / total) * 100) },
    { name: HR_Z4.name, min: HR_Z4.min, max: HR_Z4.max, color: HR_Z4.color, hexColor: HR_Z4.hexColor, description: HR_Z4.description, percent: Math.round((s4 / total) * 100) },
    { name: HR_Z3.name, min: HR_Z3.min, max: HR_Z3.max, color: HR_Z3.color, hexColor: HR_Z3.hexColor, description: HR_Z3.description, percent: Math.round((s3 / total) * 100) },
    { name: HR_Z2.name, min: HR_Z2.min, max: HR_Z2.max, color: HR_Z2.color, hexColor: HR_Z2.hexColor, description: HR_Z2.description, percent: Math.round((s2 / total) * 100) },
    { name: HR_Z1.name, min: HR_Z1.min, max: HR_Z1.max, color: HR_Z1.color, hexColor: HR_Z1.hexColor, description: HR_Z1.description, percent: Math.round((s1 / total) * 100) },
  ]
}

export function HRZoneWheel({ avgHr, maxHr, zoneSeconds }: HRZoneWheelProps) {
  const dist: ZoneDistribution[] =
    (zoneSeconds ? buildDistributionFromSeconds(zoneSeconds) : null) ??
    getZoneDistribution(avgHr)

  const isReal = Boolean(
    zoneSeconds && buildDistributionFromSeconds(zoneSeconds) !== null
  )

  // Build conic-gradient stops (reduce to avoid mutable cursor in map)
  const stops = dist.reduce<{ items: string[]; pct: number }>(
    ({ items, pct }, z) => {
      if (z.percent > 0) items.push(`${z.hexColor} ${pct}% ${pct + z.percent}%`)
      return { items, pct: pct + z.percent }
    },
    { items: [], pct: 0 }
  ).items

  const gradient = stops.length > 0
    ? `conic-gradient(${stops.join(', ')})`
    : `conic-gradient(#94a3b8 0% 100%)`

  return (
    <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <HeartPulse className="w-4 h-4 text-rose-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
          HR Zone Distribution
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Donut chart */}
        <div className="relative flex-none w-28 h-28">
          <div
            className="w-full h-full rounded-full"
            style={{ background: gradient }}
          />
          {/* Donut hole */}
          <div className="absolute inset-[22%] rounded-full bg-slate-900 flex flex-col items-center justify-center">
            <span className="text-sm font-black text-white tabular-nums leading-none">
              {Math.round(avgHr)}
            </span>
            <span className="text-[9px] text-white/40 uppercase tracking-wider leading-none mt-0.5">
              avg bpm
            </span>
            {maxHr != null && (
              <span className="text-[9px] text-rose-400 font-bold leading-none mt-1">
                {Math.round(maxHr)} pk
              </span>
            )}
          </div>
        </div>

        {/* Zone legend */}
        <div className="flex-1 space-y-2">
          {dist.map((zone, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-none"
                style={{ backgroundColor: zone.hexColor }}
              />
              <span className="text-[10px] text-white/40 w-20 truncate">
                {zone.name} {zone.description}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${zone.percent}%`, backgroundColor: zone.hexColor }}
                />
              </div>
              <span className="text-[10px] text-white/40 w-7 text-right tabular-nums">
                {zone.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {!isReal && (
        <p className="text-[9px] text-white/20 text-right mt-3">
          *Estimated from avg HR
        </p>
      )}
    </div>
  )
}
