'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PerformancePanelProps {
  goalProgress: number
  goalTrajectory: string | null
}

function prettifyTrajectory(value: string | null): string {
  if (!value) return 'No trajectory yet'
  return value.replace('_', ' ')
}

export function PerformancePanel({ goalProgress, goalTrajectory }: PerformancePanelProps) {
  return (
    <Card data-testid="dashboard-panel-performance">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-3xl font-semibold">{Math.round(goalProgress)}%</div>
        <div className="text-xs text-muted-foreground">Goal progress</div>
        <div className="rounded-md border p-2 text-xs capitalize">Trajectory: {prettifyTrajectory(goalTrajectory)}</div>
      </CardContent>
    </Card>
  )
}
