'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

interface DataQualityPanelProps {
  readiness: ReadinessApiResponse | null
}

function formatSyncDate(value: string | null): string {
  if (!value) return 'Never'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Unknown'
  return new Date(parsed).toLocaleString()
}

export function DataQualityPanel({ readiness }: DataQualityPanelProps) {
  const missing = readiness?.missingSignals ?? []

  return (
    <Card data-testid="dashboard-panel-data-quality">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Data Quality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-xs text-muted-foreground">Last sync: {formatSyncDate(readiness?.lastSyncAt ?? null)}</div>
        <div className="text-xs text-muted-foreground">Confidence: {readiness?.confidence ?? 'low'}</div>
        {missing.length > 0 ? (
          <div className="rounded-md border p-2 text-xs">
            Missing: {missing.map((signal) => signal.replace('_', ' ')).join(', ')}
          </div>
        ) : (
          <div className="rounded-md border p-2 text-xs">All core recovery signals available.</div>
        )}
      </CardContent>
    </Card>
  )
}
