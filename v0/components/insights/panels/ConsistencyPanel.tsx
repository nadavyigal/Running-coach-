'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface ConsistencyPanelProps {
  runsCompleted: number
  plannedRuns: number
  consistencyRate: number
}

export function ConsistencyPanel({ runsCompleted, plannedRuns, consistencyRate }: ConsistencyPanelProps) {
  const normalized = Math.max(0, Math.min(100, consistencyRate))

  return (
    <Card data-testid="dashboard-panel-consistency">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Consistency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          {runsCompleted}/{plannedRuns} planned runs completed this week
        </div>
        <Progress value={normalized} className="h-2" />
        <div className="text-xs text-muted-foreground">{Math.round(normalized)}% consistency</div>
      </CardContent>
    </Card>
  )
}
