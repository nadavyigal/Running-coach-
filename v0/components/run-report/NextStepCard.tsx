import { CalendarPlus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface NextStepCardProps {
    suggestedRun: string
    rationale: string
    onSaveToPlan?: () => void
}

export function NextStepCard({ suggestedRun, rationale, onSaveToPlan }: NextStepCardProps) {
    if (!suggestedRun) return null

    return (
        <Card className="overflow-hidden border-2 border-primary/20 shadow-md bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-5">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex-1 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Recommended Next Step</div>
                        <h3 className="text-xl font-bold">{suggestedRun}</h3>
                        <p className="text-sm text-muted-foreground">{rationale}</p>
                    </div>

                    <Button
                        onClick={onSaveToPlan}
                        className="w-full md:w-auto shadow-sm group hover:shadow-md transition-all"
                    >
                        <CalendarPlus className="w-4 h-4 mr-2" />
                        Save to Plan
                        <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
