import { PersonStanding, Lightbulb } from 'lucide-react'

export interface Biomechanics {
  cadenceAssessment?: string
  groundContactAssessment?: string
  verticalOscillationAssessment?: string
  strideLengthAssessment?: string
  overallFormRating?: 'excellent' | 'good' | 'fair' | 'needs-work'
  keyRecommendation?: string
}

export interface RunningDynamicsData {
  avgCadence?: number
  avgGroundContactTime?: number
  avgVerticalOscillation?: number
  avgStrideLength?: number
  groundContactBalance?: string
  verticalRatio?: number
}

interface BiomechanicsCardProps {
  dynamics: RunningDynamicsData
  biomechanics?: Biomechanics | null
  variant?: 'garmin' | 'light'
}

interface MetricRow {
  label: string
  value: string
  unit: string
  percent: number // 0-100 position in optimal range
  zone: 'optimal' | 'acceptable' | 'needs-work'
}

function getZoneColor(zone: MetricRow['zone'], dark: boolean): string {
  switch (zone) {
    case 'optimal': return dark ? '#10b981' : '#10b981'
    case 'acceptable': return dark ? '#f59e0b' : '#f59e0b'
    case 'needs-work': return dark ? '#f43f5e' : '#f43f5e'
  }
}

function assessCadence(spm: number): { percent: number; zone: MetricRow['zone'] } {
  if (spm >= 170 && spm <= 185) return { percent: 80 + (spm - 170) * 1.3, zone: 'optimal' }
  if (spm >= 160 && spm < 170) return { percent: 50 + (spm - 160) * 3, zone: 'acceptable' }
  if (spm > 185 && spm <= 195) return { percent: 70, zone: 'acceptable' }
  return { percent: Math.max(10, Math.min(40, spm / 5)), zone: 'needs-work' }
}

function assessGCT(ms: number): { percent: number; zone: MetricRow['zone'] } {
  if (ms <= 240) return { percent: 90, zone: 'optimal' }
  if (ms <= 260) return { percent: 70, zone: 'acceptable' }
  if (ms <= 300) return { percent: 45, zone: 'acceptable' }
  return { percent: 25, zone: 'needs-work' }
}

function assessVO(cm: number): { percent: number; zone: MetricRow['zone'] } {
  if (cm <= 7) return { percent: 90, zone: 'optimal' }
  if (cm <= 9) return { percent: 65, zone: 'acceptable' }
  return { percent: 30, zone: 'needs-work' }
}

function assessStride(m: number): { percent: number; zone: MetricRow['zone'] } {
  if (m >= 1.0 && m <= 1.5) return { percent: 80, zone: 'optimal' }
  if (m >= 0.8 && m < 1.0) return { percent: 55, zone: 'acceptable' }
  if (m > 1.5 && m <= 1.7) return { percent: 60, zone: 'acceptable' }
  return { percent: 30, zone: 'needs-work' }
}

const FORM_RATING_CONFIG = {
  excellent: { label: 'Excellent', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  good: { label: 'Good', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  fair: { label: 'Fair', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  'needs-work': { label: 'Needs Work', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
}

export function BiomechanicsCard({ dynamics, biomechanics, variant = 'light' }: BiomechanicsCardProps) {
  const hasData = dynamics.avgCadence || dynamics.avgGroundContactTime ||
    dynamics.avgVerticalOscillation || dynamics.avgStrideLength

  if (!hasData) return null

  const dark = variant === 'garmin'
  const metrics: MetricRow[] = []

  if (dynamics.avgCadence && dynamics.avgCadence > 0) {
    const assessment = assessCadence(dynamics.avgCadence)
    metrics.push({
      label: 'Cadence',
      value: String(Math.round(dynamics.avgCadence)),
      unit: 'spm',
      ...assessment,
    })
  }

  if (dynamics.avgGroundContactTime && dynamics.avgGroundContactTime > 0) {
    const assessment = assessGCT(dynamics.avgGroundContactTime)
    metrics.push({
      label: 'Ground Contact',
      value: String(Math.round(dynamics.avgGroundContactTime)),
      unit: 'ms',
      ...assessment,
    })
  }

  if (dynamics.avgVerticalOscillation && dynamics.avgVerticalOscillation > 0) {
    const assessment = assessVO(dynamics.avgVerticalOscillation)
    metrics.push({
      label: 'Vert. Oscillation',
      value: dynamics.avgVerticalOscillation.toFixed(1),
      unit: 'cm',
      ...assessment,
    })
  }

  if (dynamics.avgStrideLength && dynamics.avgStrideLength > 0) {
    const assessment = assessStride(dynamics.avgStrideLength)
    metrics.push({
      label: 'Stride Length',
      value: dynamics.avgStrideLength.toFixed(2),
      unit: 'm',
      ...assessment,
    })
  }

  if (metrics.length === 0) return null

  const formRating = biomechanics?.overallFormRating
  const recommendation = biomechanics?.keyRecommendation

  if (dark) {
    return (
      <div className="mx-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PersonStanding className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400/70">
              Running Form
            </span>
          </div>
          {formRating && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${FORM_RATING_CONFIG[formRating].color}`}>
              {FORM_RATING_CONFIG[formRating].label}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {metrics.map((m, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{m.label}</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {m.value}<span className="text-[10px] text-white/30 ml-0.5 font-normal">{m.unit}</span>
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${m.percent}%`, backgroundColor: getZoneColor(m.zone, true) }}
                />
              </div>
            </div>
          ))}
        </div>

        {recommendation && (
          <div className="flex items-start gap-2 mt-4 pt-3 border-t border-white/5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-none mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">{recommendation}</p>
          </div>
        )}
      </div>
    )
  }

  // Light variant
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PersonStanding className="w-4 h-4 text-violet-500" />
          <span className="font-bold text-base">Running Form</span>
        </div>
        {formRating && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${FORM_RATING_CONFIG[formRating].color}`}>
            {FORM_RATING_CONFIG[formRating].label}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</span>
              <span className="text-sm font-bold tabular-nums">
                {m.value}<span className="text-[10px] text-muted-foreground ml-0.5 font-normal">{m.unit}</span>
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${m.percent}%`, backgroundColor: getZoneColor(m.zone, false) }}
              />
            </div>
          </div>
        ))}
      </div>

      {recommendation && (
        <div className="flex items-start gap-2 mt-4 pt-3 border-t border-border/40">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-none mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  )
}
