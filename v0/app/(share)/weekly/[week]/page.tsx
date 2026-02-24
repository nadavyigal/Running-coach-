'use client'

import { useEffect, useMemo, useState } from 'react'

import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SharedWeeklyReport {
  contentMd: string
  confidence: 'high' | 'medium' | 'low'
  periodStart: string
  periodEnd: string
}

function toDisplayDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export default function ShareWeeklyPage({ params }: { params: { week: string } }) {
  const searchParams = useSearchParams()
  const userId = useMemo(() => {
    const value = searchParams.get('userId')
    if (!value) return null
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])

  const [report, setReport] = useState<SharedWeeklyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setReport(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/garmin/reports/weekly?userId=${encodeURIComponent(String(userId))}`, {
          headers: {
            'x-user-id': String(userId),
          },
        })

        if (!response.ok) {
          if (!cancelled) setReport(null)
          return
        }

        const payload = (await response.json()) as { report: SharedWeeklyReport | null }
        if (!cancelled) setReport(payload.report)
      } catch {
        if (!cancelled) setReport(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-4 p-4" data-testid="share-weekly-page">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared Weekly Snapshot</p>
        <h1 className="text-2xl font-semibold">Week {params.week}</h1>
      </header>

      <Card data-testid="weekly-share-card">
        <CardHeader>
          <CardTitle>RunSmart Weekly Card</CardTitle>
          <CardDescription>
            {report
              ? `${toDisplayDate(report.periodStart)} - ${toDisplayDate(report.periodEnd)} � Confidence: ${report.confidence}`
              : 'A lightweight weekly share card for accountability and streak momentum.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading shared summary...</p>
          ) : report ? (
            <div className="whitespace-pre-wrap rounded-md border p-3 text-sm">{report.contentMd}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No weekly report attached to this share yet. Generate one in insights and share again.
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(window.location.href)
              }
            }}
          >
            Copy Link
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
