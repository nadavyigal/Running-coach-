import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Flame, Activity, Heart, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react'

export interface Insight {
    type: 'effort' | 'pacing' | 'recovery' | 'general'
    title: string
    message: string
    confidence?: 'High' | 'Med' | 'Low'
    isPositive?: boolean
}

interface KeyInsightsProps {
    insights: Insight[]
    isGenerating?: boolean
    onRegenerate?: () => void
}

export function KeyInsights({ insights, isGenerating, onRegenerate }: KeyInsightsProps) {
    if (isGenerating) {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                    <h3 className="text-lg font-bold">Coach Insights</h3>
                </div>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse bg-muted/50 border-none shadow-sm h-24"></Card>
                ))}
            </div>
        )
    }

    if (!insights || insights.length === 0) {
        return null
    }

    const getIconForType = (type: Insight['type'], isPositive: boolean = true) => {
        switch (type) {
            case 'effort': return <Flame className={`w-5 h-5 ${isPositive ? 'text-orange-500' : 'text-rose-500'}`} />
            case 'pacing': return <Activity className={`w-5 h-5 ${isPositive ? 'text-emerald-500' : 'text-amber-500'}`} />
            case 'recovery': return <Heart className={`w-5 h-5 ${isPositive ? 'text-sky-500' : 'text-violet-500'}`} />
            default: return <Sparkles className="w-5 h-5 text-primary" />
        }
    }

    const getConfidenceBadge = (confidence?: string) => {
        if (!confidence) return null
        if (confidence === 'High') {
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> High Confidence
                </span>
            )
        }
        if (confidence === 'Med') {
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                    <ShieldAlert className="w-3 h-3" /> Med Confidence
                </span>
            )
        }
        return (
            <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                <Cpu className="w-3 h-3" /> Low Confidence
            </span>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold">Coach Insights</h3>
                </div>
                {onRegenerate && (
                    <button
                        onClick={onRegenerate}
                        className="text-xs font-semibold text-primary/80 hover:text-primary transition-colors"
                    >
                        Regenerate
                    </button>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight, index) => (
                    <Card key={index} className="overflow-hidden border-none shadow-sm bg-[oklch(var(--surface-3))] hover:bg-[oklch(var(--surface-3))]/80 transition-colors">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-md bg-background shadow-sm`}>
                                        {getIconForType(insight.type, insight.isPositive)}
                                    </div>
                                    <h4 className="font-semibold text-sm">{insight.title}</h4>
                                </div>
                                {getConfidenceBadge(insight.confidence)}
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                {insight.message}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
