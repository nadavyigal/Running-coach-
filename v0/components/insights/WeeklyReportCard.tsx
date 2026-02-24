'use client'

import { useCallback, useEffect, useState } from 'react'

import { Loader2, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WeeklyReport {
  id: number
  type: 'daily' | 'weekly' | 'post_run'
  periodStart: string
  periodEnd: string
  contentMd: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number | null
  createdAt: string
}

interface WeeklyReportCardProps {
  userId: number
}

function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleDateString()
}

export function WeeklyReportCard({ userId }: WeeklyReportCardProps) {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const loadLatest = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/garmin/reports/weekly?userId=${encodeURIComponent(String(userId))}`, {
        headers: {
          'x-user-id': String(userId),
        },
      })
      if (!response.ok) {
        setReport(null)
        return
      }

      const payload = (await response.json()) as { report: WeeklyReport | null }
      setReport(payload.report)
    } catch {
      setReport(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/garmin/reports/weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) return

      const payload = (await response.json()) as { report: WeeklyReport | null }
      setReport(payload.report)
    } finally {
      setIsGenerating(false)
    }
  }, [userId])

  return (
    <Card data-testid="weekly-report-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          Weekly Digest
          <Badge variant="secondary">{report?.confidence ?? 'none'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading weekly report...
          </div>
        ) : report ? (
          <>
            <div className="text-xs text-muted-foreground">
              {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
            </div>
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm" data-testid="weekly-report-content">
              {report.contentMd}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No weekly report yet. Generate one now.</p>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={() => void handleGenerate()} disabled={isGenerating} data-testid="weekly-report-generate">
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate
          </Button>
          <Button size="sm" variant="outline" onClick={() => void loadLatest()}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
