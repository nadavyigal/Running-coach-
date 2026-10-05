'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Share2, Sparkles, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { useToast } from '@/hooks/use-toast'

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
  const { toast } = useToast()
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

  const handlePublicShare = async () => {
    if (typeof window === 'undefined') return

    const shareUrl = window.location.href
    const sharePayload = {
      title: `RunSmart weekly recap: ${params.week}`,
      text: 'A weekly running recap built for accountability and momentum.',
      url: shareUrl,
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(sharePayload)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      toast({
        title: 'Link copied',
        description: 'This weekly recap is ready to share.',
      })
    } catch {
      toast({
        title: 'Share failed',
        description: 'Unable to copy this weekly recap link.',
        variant: 'destructive',
      })
    }
  }

  const handleSignupClick = () => {
    void trackAnalyticsEvent('weekly_share_signup_clicked', {
      week: params.week,
      has_report: Boolean(report),
      shared_user_id_present: Boolean(userId),
    })
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-4 p-4" data-testid="share-weekly-page">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared Weekly Snapshot</p>
        <h1 className="text-2xl font-semibold">Week {params.week}</h1>
      </header>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Weekly accountability
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3.5 w-3.5" />
              AI-guided progress
            </Badge>
          </div>
          <div className="space-y-2">
            <CardTitle>Progress sticks when the week is visible.</CardTitle>
            <CardDescription>
              RunSmart turns training into a simple weekly loop: plan, run, review, repeat. This shared recap is one weekly check-in from that flow.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:flex-1" data-testid="weekly-share-signup-cta">
            <Link href="/" onClick={handleSignupClick}>
              Start your own AI running plan
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="sm:flex-1"
            onClick={() => void handlePublicShare()}
            data-testid="weekly-share-copy-link"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share this recap
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="weekly-share-card">
        <CardHeader>
          <CardTitle>RunSmart Weekly Card</CardTitle>
          <CardDescription>
            {report
              ? `${toDisplayDate(report.periodStart)} - ${toDisplayDate(report.periodEnd)} • Confidence: ${report.confidence}`
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
        </CardContent>
      </Card>
    </main>
  )
}
