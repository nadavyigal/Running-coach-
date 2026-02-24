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
}

// Temporary local formatters if needed
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
}: CoreSummaryCardProps) {

    const getEffortColor = (effort?: string) => {
        switch (effort) {
            case 'easy': return 'text-emerald-500 bg-emerald-500/10'
            case 'moderate': return 'text-amber-500 bg-amber-500/10'
            case 'hard': return 'text-rose-500 bg-rose-500/10'
            default: return 'text-muted-foreground bg-muted'
        }
    }

    const getPaceConsistencyColor = (consistency?: string) => {
        switch (consistency) {
            case 'consistent': return 'text-emerald-500 bg-emerald-500/10'
            case 'negative-split': return 'text-sky-500 bg-sky-500/10'
            case 'fading': return 'text-amber-500 bg-amber-500/10'
            case 'erratic': return 'text-rose-500 bg-rose-500/10'
            default: return 'text-muted-foreground bg-muted'
        }
    }

    const formatDistance = (dist: number) => {
        return dist > 0 ? dist.toFixed(2) : '--'
    }

    return (
        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-md">
            <CardContent className="p-5">

                {/* Top 3 Primary Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-6 relative">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
                        <span className="text-3xl font-black text-primary tracking-tight">{formatDistance(distanceKm)}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1 text-center">Distance <span className="lowercase">km</span></span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3">
                        <span className="text-3xl font-black text-foreground tracking-tight">{formatTimeLocal(durationSec)}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1 text-center">Time</span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3">
                        <span className="text-3xl font-black text-foreground tracking-tight">{formatPaceLocal(avgPaceSecPerKm)}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1 text-center">Pace <span className="lowercase">/km</span></span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/50 w-full mb-6"></div>

                {/* Secondary KPIs Grid (2x2 or 3x2 depending on data) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                    {/* Elevation */}
                    {elevationGainM != null && elevationGainM > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <Mountain className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">{Math.round(elevationGainM)}<span className="text-xs font-normal text-muted-foreground ml-0.5">m</span></div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Gain</div>
                            </div>
                        </div>
                    )}

                    {/* Heart Rate */}
                    {avgHr != null && avgHr > 0 ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-rose-500/10">
                                <Heart className="w-4 h-4 text-rose-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">{Math.round(avgHr)}<span className="text-xs font-normal text-muted-foreground ml-0.5">bpm</span></div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Avg HR</div>
                            </div>
                        </div>
                    ) : (
                        /* Fallback if no HR but Cadence exists */
                        cadence != null && cadence > 0 && (
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-violet-500/10">
                                    <ActivitySquare className="w-4 h-4 text-violet-500" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold">{Math.round(cadence)}<span className="text-xs font-normal text-muted-foreground ml-0.5">spm</span></div>
                                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Cadence</div>
                                </div>
                            </div>
                        )
                    )}

                    {/* Effort */}
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

                    {/* Consistency */}
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

                    {/* Calories */}
                    {calories != null && calories > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <Zap className="w-4 h-4 text-orange-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">{Math.round(calories)}<span className="text-xs font-normal text-muted-foreground ml-0.5">kcal</span></div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Calories</div>
                            </div>
                        </div>
                    )}

                    {/* Load (if provided) */}
                    {runLoad != null && runLoad > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Target className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">{Math.round(runLoad)}</div>
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Training Load</div>
                            </div>
                        </div>
                    )}

                </div>
            </CardContent>
        </Card>
    )
}
