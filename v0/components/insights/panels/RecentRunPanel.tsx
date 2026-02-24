'use client'

import type { Run } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RecentRunPanelProps {
  run: Run | null
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `${minutes} min`
}

export function RecentRunPanel({ run }: RecentRunPanelProps) {
  return (
    <Card data-testid="dashboard-panel-recent-run">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Run</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {run ? (
          <>
            <div className="font-medium capitalize">{run.type} run</div>
            <div className="text-xs text-muted-foreground">
              {run.distance.toFixed(1)} km in {formatDuration(run.duration)}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(run.completedAt).toLocaleDateString()}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No recent runs found.</div>
        )}
      </CardContent>
    </Card>
  )
}
