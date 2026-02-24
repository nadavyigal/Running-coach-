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
}

export function RunReportHeader({
    runType,
    completedAt,
    source,
    isGarminImport,
    gpsQualityLevel,
    syncFreshness,
}: RunReportHeaderProps) {
    const date = new Date(completedAt)
    const formattedDate = !isNaN(date.getTime()) ? format(date, 'EEEE, MMM d • h:mm a') : 'Unknown Date'

    const TypeIcon = runType.toLowerCase() === 'interval' ? Zap : runType.toLowerCase() === 'tempo' ? ActivitySquare : Activity

    const getGpsQualityProps = (level?: GPSQualityLevel) => {
        switch (level) {
            case 'Excellent':
                return { icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Great Data' }
            case 'Good':
                return { icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10', label: 'Good Data' }
            case 'Fair':
                return { icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Usable Data' }
            case 'Poor':
                return { icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'Limited Data' }
            default:
                // No GPS data or indoor run
                return { icon: Cpu, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Non-GPS' }
        }
    }

    const gpsProps = getGpsQualityProps(gpsQualityLevel)
    const SourceIcon = gpsProps.icon

    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <TypeIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight capitalize">{runType || 'Run'}</h1>
                        <p className="text-sm text-muted-foreground font-medium">{formattedDate}</p>
                    </div>
                </div>

            </div>

            {/* Trust Signals Row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                {isGarminImport ? (
                    <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border-transparent gap-1">
                        <BadgeCheck className="w-3 h-3" /> Garmin
                    </Badge>
                ) : source === 'manual' ? (
                    <Badge variant="secondary" className="gap-1">
                        <MoveDownLeft className="w-3 h-3" /> Manual
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent gap-1">
                        <Activity className="w-3 h-3" /> RunSmart
                    </Badge>
                )}

                {gpsQualityLevel && (
                    <Badge variant="outline" className={`${gpsProps.bg} ${gpsProps.color} border-transparent gap-1`}>
                        <SourceIcon className="w-3 h-3" /> {gpsProps.label}
                    </Badge>
                )}
            </div>
        </div>
    )
}
