'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

interface RecoveryPanelProps {
  readiness: ReadinessApiResponse | null
}

export function RecoveryPanel({ readiness }: RecoveryPanelProps) {
  const recommendation = readiness?.underRecovery.recommendation ?? 'Sync Garmin to unlock recovery guidance.'

  return (
    <Card data-testid="dashboard-panel-recovery">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recovery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{recommendation}</p>
        {readiness?.underRecovery.triggers.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {readiness.underRecovery.triggers.slice(0, 2).map((trigger) => (
              <li key={trigger}>{trigger}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No conservative under-recovery signature detected.</p>
        )}
      </CardContent>
    </Card>
  )
}
