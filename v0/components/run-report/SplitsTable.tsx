import { Card, CardContent } from '@/components/ui/card'
import { Gauge, ArrowDownUp } from 'lucide-react'

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

export function SplitsTable({ splits, type }: SplitsTableProps) {
    if (!splits || splits.length === 0) return null

    // Find best and worst splits for highlighting (if type is km)
    let bestSplitIndex = -1
    let worstSplitIndex = -1

    if (type === 'km' && splits.length > 1) {
        let minPace = Infinity
        let maxPace = -1

        splits.forEach(s => {
            // Basic heuristic: ignore very short partial km for best/worst calculation
            if (s.paceSecPerKm && (s.distanceKm || 0) > 0.8) {
                if (s.paceSecPerKm < minPace) {
                    minPace = s.paceSecPerKm
                    bestSplitIndex = s.index
                }
                if (s.paceSecPerKm > maxPace) {
                    maxPace = s.paceSecPerKm
                    worstSplitIndex = s.index
                }
            }
        })
    }

    const title = type === 'km' ? 'Kilometer Splits' : type === 'interval' ? 'Interval Breakdown' : 'Laps'

    return (
        <Card className="border-none shadow-sm bg-[oklch(var(--surface-2))]">
            <CardContent className="p-0">
                <div className="p-4 pb-2 flex items-center justify-between border-b border-border/50">
                    <h3 className="font-bold flex items-center gap-2">
                        {type === 'km' ? <Gauge className="w-4 h-4 text-primary" /> : <ArrowDownUp className="w-4 h-4 text-primary" />}
                        {title}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground bg-[oklch(var(--surface-3))] uppercase tracking-wider">
                            <tr>
                                <th className="py-2.5 px-4 text-left font-semibold">{type === 'interval' ? 'Rep' : type === 'lap' ? 'Lap' : 'KM'}</th>
                                {type !== 'km' && <th className="py-2.5 px-2 text-left font-semibold">Dist</th>}
                                <th className="py-2.5 px-2 text-left font-semibold">Time</th>
                                <th className="py-2.5 px-2 text-left font-semibold">Pace</th>
                                <th className="py-2.5 px-2 text-left font-semibold">Avg HR</th>
                                <th className="py-2.5 px-4 text-right font-semibold">Cadence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {splits.map((split) => {
                                const isBest = split.index === bestSplitIndex
                                const isWorst = split.index === worstSplitIndex

                                return (
                                    <tr key={split.index} className={`
                    hover:bg-[oklch(var(--surface-3))]/50 transition-colors
                    ${isBest ? 'bg-emerald-500/5' : ''}
                    ${isWorst ? 'bg-amber-500/5' : ''}
                  `}>
                                        <td className="py-2.5 px-4 font-medium">
                                            <div className="flex items-center gap-2">
                                                {split.index}
                                                {isBest && <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded">Best</span>}
                                                {isWorst && <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 bg-amber-500/10 px-1 py-0.5 rounded">Slowest</span>}
                                            </div>
                                        </td>
                                        {type !== 'km' && <td className="py-2.5 px-2">{(split.distanceKm || 0).toFixed(2)}</td>}
                                        <td className="py-2.5 px-2 text-muted-foreground">{formatDuration(split.durationSec)}</td>
                                        <td className={`py-2.5 px-2 font-semibold ${isBest ? 'text-emerald-500' : isWorst ? 'text-amber-500' : 'text-foreground'}`}>
                                            {formatPace(split.paceSecPerKm)}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <div className="flex items-center gap-1.5">
                                                {formatNumber(split.avgHr)}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4 text-right text-muted-foreground">{formatNumber(split.avgCadence)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
