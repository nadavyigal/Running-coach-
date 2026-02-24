import { Card, CardContent } from '@/components/ui/card'
import { Flame, HeartPulse } from 'lucide-react'

// Heart Rate Zone definitions
type HRZone = {
    name: string
    min: number
    max: number
    color: string
    bg: string
    description: string
}

// Very basic generic zones (ideally these come from user settings)
const defaultZones: HRZone[] = [
    { name: 'Zone 5', min: 172, max: 200, color: 'bg-rose-500', bg: 'bg-rose-500/10', description: 'Anaerobic / Max' },
    { name: 'Zone 4', min: 153, max: 171, color: 'bg-orange-500', bg: 'bg-orange-500/10', description: 'Threshold' },
    { name: 'Zone 3', min: 134, max: 152, color: 'bg-emerald-500', bg: 'bg-emerald-500/10', description: 'Aerobic' },
    { name: 'Zone 2', min: 115, max: 133, color: 'bg-sky-500', bg: 'bg-sky-500/10', description: 'Easy / Endurance' },
    { name: 'Zone 1', min: 0, max: 114, color: 'bg-slate-300', bg: 'bg-slate-500/10', description: 'Recovery' },
]

interface EffortAnalysisProps {
    avgHr?: number | null
    maxHr?: number | null
    effortScore?: 'easy' | 'moderate' | 'hard'
    // In a real app we'd pass an array of time spent in each zone
    // For UI mockup we'll fake a distribution if HR exists
}

export function EffortAnalysis({ avgHr, maxHr, effortScore }: EffortAnalysisProps) {
    if (!avgHr && !effortScore) return null

    // FAKE DISTRIBUTION for UI purposes since we don't have the stream data yet
    const fakeDistribution = avgHr ? getFakeDistribution(avgHr) : []

    return (
        <Card className="border-none shadow-sm bg-[oklch(var(--surface-2))]">
            <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-4">
                    {avgHr ? <HeartPulse className="w-5 h-5 text-rose-500" /> : <Flame className="w-5 h-5 text-orange-500" />}
                    <h3 className="font-bold text-lg">Effort & Heart Rate</h3>
                </div>

                <div className="flex flex-col md:flex-row gap-6">

                    {/* Quick Stats Column */}
                    <div className="flex flex-row md:flex-col gap-4 w-full md:w-1/3 justify-between md:justify-start">
                        {avgHr != null && (
                            <div className="flex-1 bg-[oklch(var(--surface-3))] p-3 rounded-xl border border-border/50">
                                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Avg HR</div>
                                <div className="text-2xl font-black">{Math.round(avgHr)} <span className="text-sm font-medium text-muted-foreground">bpm</span></div>
                            </div>
                        )}
                        {maxHr != null && (
                            <div className="flex-1 bg-[oklch(var(--surface-3))] p-3 rounded-xl border border-border/50">
                                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Max HR</div>
                                <div className="text-2xl font-black text-rose-500">{Math.round(maxHr)} <span className="text-sm font-medium text-rose-500/70">bpm</span></div>
                            </div>
                        )}
                    </div>

                    {/* Zones Breakdown Column */}
                    {avgHr ? (
                        <div className="w-full md:w-2/3 space-y-2">
                            <div className="text-sm font-semibold mb-2">Estimated Zone Time</div>
                            {fakeDistribution.map((zone, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <div className="w-16 font-medium text-foreground/80">{zone.name}</div>
                                    <div className="flex-1 h-3 bg-[oklch(var(--surface-3))] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${zone.color} transition-all duration-1000`}
                                            style={{ width: `${zone.percent}%` }}
                                        />
                                    </div>
                                    <div className="w-12 text-right font-medium text-muted-foreground">{zone.percent}%</div>
                                </div>
                            ))}
                            <p className="text-xs text-muted-foreground text-right mt-2">*Estimated from average HR</p>
                        </div>
                    ) : (
                        <div className="w-full md:w-2/3 flex items-center justify-center p-6 border border-dashed border-border rounded-xl">
                            <p className="text-sm text-muted-foreground text-center">Detailed heart rate stream not available for this run.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// Helper to fake a visually appealing distribution for the mockup
function getFakeDistribution(avgHr: number) {
    if (avgHr > 165) return [
        { ...defaultZones[0], percent: 35 },
        { ...defaultZones[1], percent: 45 },
        { ...defaultZones[2], percent: 15 },
        { ...defaultZones[3], percent: 5 },
        { ...defaultZones[4], percent: 0 },
    ]
    if (avgHr > 145) return [
        { ...defaultZones[0], percent: 5 },
        { ...defaultZones[1], percent: 25 },
        { ...defaultZones[2], percent: 50 },
        { ...defaultZones[3], percent: 15 },
        { ...defaultZones[4], percent: 5 },
    ]
    return [
        { ...defaultZones[0], percent: 0 },
        { ...defaultZones[1], percent: 5 },
        { ...defaultZones[2], percent: 20 },
        { ...defaultZones[3], percent: 60 },
        { ...defaultZones[4], percent: 15 },
    ]
}
