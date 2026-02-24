import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Database } from 'lucide-react'

// Reuse generic types for props
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
}

export function AdvancedDetails({ runId, hasGarminData, gpsQualityScore, metrics }: AdvancedDetailsProps) {
    const [isOpen, setIsOpen] = useState(false)

    if (!hasGarminData && !gpsQualityScore && (!metrics || Object.keys(metrics).length === 0)) return null

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

                    {/* Data Quality Section */}
                    {(hasGarminData || gpsQualityScore != null) && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data Quality</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {gpsQualityScore != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">GPS Reliability</div>
                                        <div className="flex items-end gap-1">
                                            <span className="text-lg font-bold">{gpsQualityScore}</span>
                                            <span className="text-xs text-muted-foreground mb-1">%</span>
                                        </div>
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

                    {/* Advanced Analytics */}
                    {metrics && Object.keys(metrics).length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Garmin Analytics</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                                {metrics.paceVariabilitySecPerKm != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-blue-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Pace Variability</div>
                                        <div className="text-base font-bold text-foreground">
                                            {metrics.paceVariabilitySecPerKm.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">s</span>
                                        </div>
                                    </div>
                                )}

                                {metrics.splitDeltaSecPerKm != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-indigo-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Half Split Δ</div>
                                        <div className="text-base font-bold text-foreground">
                                            {metrics.splitDeltaSecPerKm > 0 ? '+' : ''}{metrics.splitDeltaSecPerKm.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">s/km</span>
                                        </div>
                                    </div>
                                )}

                                {metrics.cadenceDriftPct != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-violet-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Cadence Drift</div>
                                        <div className="text-base font-bold text-foreground">
                                            {metrics.cadenceDriftPct > 0 ? '+' : ''}{metrics.cadenceDriftPct.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">%</span>
                                        </div>
                                    </div>
                                )}

                                {metrics.intervalConsistencyPct != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-amber-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Rep Consistency</div>
                                        <div className="text-base font-bold text-foreground">
                                            {metrics.intervalConsistencyPct.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">%</span>
                                        </div>
                                    </div>
                                )}

                                {metrics.elevationLossM != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-emerald-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Elevation Loss</div>
                                        <div className="text-base font-bold text-foreground">
                                            -{metrics.elevationLossM.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">m</span>
                                        </div>
                                    </div>
                                )}

                                {metrics.maxSpeedKmph != null && (
                                    <div className="bg-[oklch(var(--surface-3))] p-3 rounded-lg border-l-2 border-sky-500">
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Top Speed</div>
                                        <div className="text-base font-bold text-foreground">
                                            {metrics.maxSpeedKmph.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">km/h</span>
                                        </div>
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
