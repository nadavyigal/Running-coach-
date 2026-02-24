'use client'

import { useCallback, useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'

interface PlanAdjustmentApiRow {
  id: number
  created_at: string
  session_date: string | null
  reasons: unknown
  old_session: Record<string, unknown> | null
  new_session: Record<string, unknown> | null
}

interface PlanAdjustmentNoticeProps {
  userId: number | null
}

function formatDate(value: string | null): string {
  if (!value) return 'Today'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleDateString()
}

function formatReasons(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (Array.isArray(value)) {
    const parts = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    if (parts.length > 0) return parts.join('; ')
  }
  if (value && typeof value === 'object') {
    const reasons = (value as Record<string, unknown>).reasons
    if (Array.isArray(reasons)) {
      const parts = reasons.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      if (parts.length > 0) return parts.join('; ')
    }
  }
  return 'Adaptation applied to keep training aligned with your recent data.'
}

function summarizeChange(oldSession: Record<string, unknown> | null, newSession: Record<string, unknown> | null): string {
  if (!oldSession && !newSession) return 'Session details unavailable.'

  const oldType = typeof oldSession?.type === 'string' ? oldSession.type : null
  const newType = typeof newSession?.type === 'string' ? newSession.type : null

  if (oldType && newType && oldType !== newType) {
    return `Workout changed from ${oldType} to ${newType}.`
  }

  const oldDistance = typeof oldSession?.distance === 'number' ? oldSession.distance : null
  const newDistance = typeof newSession?.distance === 'number' ? newSession.distance : null

  if (oldDistance != null && newDistance != null && oldDistance !== newDistance) {
    return `Distance updated from ${oldDistance} km to ${newDistance} km.`
  }

  return 'Session details were adjusted.'
}

export function PlanAdjustmentNotice({ userId }: PlanAdjustmentNoticeProps) {
  const [latest, setLatest] = useState<PlanAdjustmentApiRow | null>(null)

  const loadLatest = useCallback(async () => {
    if (!userId) {
      setLatest(null)
      return
    }

    try {
      const response = await fetch(`/api/plan/adjustments?userId=${encodeURIComponent(String(userId))}&limit=1`, {
        headers: {
          'x-user-id': String(userId),
        },
      })

      if (!response.ok) {
        setLatest(null)
        return
      }

      const payload = (await response.json()) as { latest: PlanAdjustmentApiRow | null }
      setLatest(payload.latest)
    } catch {
      setLatest(null)
    }
  }, [userId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadLatest()
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [loadLatest])

  if (!latest) return null

  return (
    <Card data-testid="plan-adjustment-notice" className="border-blue-200 bg-blue-50">
      <CardContent className="space-y-1 p-3 text-sm text-blue-900">
        <p className="font-medium">Plan adjusted on {formatDate(latest.created_at)}</p>
        <p className="text-xs">{summarizeChange(latest.old_session, latest.new_session)}</p>
        <p className="text-xs">Why: {formatReasons(latest.reasons)}</p>
      </CardContent>
    </Card>
  )
}
