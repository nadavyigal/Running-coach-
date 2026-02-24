'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

interface LoadPanelProps {
  readiness: ReadinessApiResponse | null
}

function formatLoad(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

export function LoadPanel({ readiness }: LoadPanelProps) {
  const load = readiness?.load

  return (
    <Card data-testid="dashboard-panel-load">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Load</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Acute 7d</div>
          <div className="font-semibold">{formatLoad(load?.acuteLoad7d)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Chronic 28d</div>
          <div className="font-semibold">{formatLoad(load?.chronicLoad28d)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">ACWR</div>
          <div className="font-semibold">{formatLoad(load?.acwr, 2)}</div>
        </div>
      </CardContent>
    </Card>
  )
}
