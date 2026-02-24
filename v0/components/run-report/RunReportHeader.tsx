import { format } from 'date-fns'
import { Activity, ShieldCheck, ShieldAlert, BadgeCheck, Zap, ActivitySquare, Cpu, MoveDownLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type GPSQualityLevel = 'Excellent' | 'Good' | 'Fair' | 'Poor'

interface RunReportHeaderProps {
  runType: string
  completedAt: Date | string
  source: 'garmin' | 'runsmart' | 'manual'
  isGarminImport: boolean
  gpsQualityLevel?: GPSQualityLevel
  syncFreshness?: string
  variant?: 'garmin' | 'light'
}

const GPS_QUALITY_MAP = {
  Excellent: { icon: ShieldCheck, textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15 border-emerald-500/30', label: 'Great GPS' },
  Good:      { icon: ShieldCheck, textColor: 'text-sky-400',     bgColor: 'bg-sky-500/15 border-sky-500/30',         label: 'Good GPS' },
  Fair:      { icon: ShieldAlert, textColor: 'text-amber-400',   bgColor: 'bg-amber-500/15 border-amber-500/30',     label: 'Fair GPS' },
  Poor:      { icon: ShieldAlert, textColor: 'text-rose-400',    bgColor: 'bg-rose-500/15 border-rose-500/30',       label: 'Limited GPS' },
} as const

export function RunReportHeader({
  runType,
  completedAt,
  source,
  isGarminImport,
  gpsQualityLevel,
  variant = 'light',
}: RunReportHeaderProps) {
  const date = new Date(completedAt)
  const formattedDate = !isNaN(date.getTime())
    ? format(date, "EEE, MMM d · h:mm a")
    : 'Unknown Date'

  const TypeIcon =
    runType.toLowerCase() === 'interval' || runType.toLowerCase() === 'intervals'
      ? Zap
      : runType.toLowerCase() === 'tempo'
        ? ActivitySquare
        : Activity

  const gpsProps = gpsQualityLevel ? GPS_QUALITY_MAP[gpsQualityLevel] : null
  const GPSIcon = gpsProps?.icon ?? Cpu

  // ─── GARMIN DARK HERO ────────────────────────────────────────────────────
  if (variant === 'garmin') {
    return (
      <div className="relative overflow-hidden px-6 pt-8 pb-6">
        {/* Background glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#40DCBE]/5 rounded-full blur-2xl pointer-events-none" />

        {/* Date */}
        <p className="relative z-10 text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2">
          {formattedDate}
        </p>

        {/* Run type title */}
        <h1 className="relative z-10 text-4xl font-black text-white capitalize tracking-tight mb-5 leading-none">
          {runType || 'Run'} Run
        </h1>

        {/* Trust badges */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {isGarminImport ? (
            <span className="flex items-center gap-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold px-3 py-1.5 rounded-full">
              <BadgeCheck className="w-3.5 h-3.5" /> Garmin Verified
            </span>
          ) : source === 'manual' ? (
            <span className="flex items-center gap-1.5 bg-white/8 border border-white/15 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full">
              <MoveDownLeft className="w-3.5 h-3.5" /> Manual Entry
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-[#40DCBE]/10 border border-[#40DCBE]/25 text-[#40DCBE] text-xs font-bold px-3 py-1.5 rounded-full">
              <Activity className="w-3.5 h-3.5" /> RunSmart GPS
            </span>
          )}

          {gpsProps && (
            <span className={`flex items-center gap-1.5 border text-xs font-bold px-3 py-1.5 rounded-full ${gpsProps.bgColor} ${gpsProps.textColor}`}>
              <GPSIcon className="w-3.5 h-3.5" /> {gpsProps.label}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ─── LIGHT DEFAULT ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2 mb-2">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <TypeIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight capitalize">{runType || 'Run'}</h1>
          <p className="text-sm text-muted-foreground font-medium">{formattedDate}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-1">
        {isGarminImport ? (
          <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 border-transparent gap-1">
            <BadgeCheck className="w-3 h-3" /> Garmin
          </Badge>
        ) : source === 'manual' ? (
          <Badge variant="secondary" className="gap-1">
            <MoveDownLeft className="w-3 h-3" /> Manual
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-transparent gap-1">
            <Activity className="w-3 h-3" /> RunSmart
          </Badge>
        )}

        {gpsProps && (
          <Badge variant="outline" className={`border-transparent gap-1 ${gpsProps.textColor}`}>
            <GPSIcon className="w-3 h-3" /> {gpsProps.label}
          </Badge>
        )}
      </div>
    </div>
  )
}
