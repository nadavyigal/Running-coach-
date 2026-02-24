'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

interface ReadinessPanelProps {
  readiness: ReadinessApiResponse | null
  loading?: boolean
}

function prettyState(state: ReadinessApiResponse['state'] | null): string {
  if (!state) return 'Unknown'
  if (state === 'ready') return 'Ready'
  if (state === 'steady') return 'Steady'
  return 'Caution'
}

export function ReadinessPanel({ readiness, loading = false }: ReadinessPanelProps) {
  const [showWhy, setShowWhy] = useState(false)

  return (
    <Card data-testid="dashboard-panel-readiness" className="border border-emerald-200/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading readiness...</p>
        ) : readiness ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-4xl font-semibold">{readiness.score}</div>
              <Badge variant="secondary">{prettyState(readiness.state)}</Badge>
            </div>

            <div className="text-xs text-muted-foreground" data-testid="readiness-confidence">
              Confidence: {readiness.confidence}
            </div>

            {readiness.underRecovery.flagged ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Under-recovery signature detected. Consider an easier day.
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowWhy((current) => !current)}
              data-testid="readiness-why-toggle"
            >
              {showWhy ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              Why
            </Button>

            {showWhy ? (
              <div className="space-y-2" data-testid="readiness-why-content">
                {readiness.drivers.map((driver) => (
                  <div key={driver.signal} className="rounded-md border p-2 text-xs">
                    <div className="font-medium capitalize">{driver.signal.replace('_', ' ')}</div>
                    <div className="text-muted-foreground">{driver.explanation}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No readiness data yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
