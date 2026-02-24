'use client'

import { useMemo } from 'react'

import { Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { trackAnalyticsEvent } from '@/lib/analytics'

interface ShareWeeklyButtonProps {
  week?: string
  userId?: number | null
  className?: string
}

function getIsoWeekKey(input: Date = new Date()): string {
  const date = new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const paddedWeek = `${weekNo}`.padStart(2, '0')

  return `${date.getUTCFullYear()}-W${paddedWeek}`
}

export function ShareWeeklyButton({ week, userId, className }: ShareWeeklyButtonProps) {
  const weekKey = useMemo(() => week ?? getIsoWeekKey(), [week])

  const href = useMemo(() => {
    const base = `/weekly/${encodeURIComponent(weekKey)}`
    if (!userId) return base
    const query = new URLSearchParams({ userId: String(userId) })
    return `${base}?${query.toString()}`
  }, [userId, weekKey])

  const handleClick = async () => {
    void trackAnalyticsEvent('weekly_share_clicked', {
      week: weekKey,
      has_user_id: Boolean(userId),
    })
    if (typeof window !== 'undefined') {
      window.location.assign(href)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void handleClick()} className={className} data-testid="share-weekly-button">
      <Share2 className="mr-2 h-4 w-4" />
      Share Week
    </Button>
  )
}
