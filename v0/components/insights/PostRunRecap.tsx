'use client'

import { useCallback, useEffect, useState } from 'react'

import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PostRunRecapPayload {
  activityId: string
  oneThing: string
  why: string
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

interface PostRunRecapProps {
  userId: number
  activityId: string
}

export function PostRunRecap({ userId, activityId }: PostRunRecapProps) {
  const [recap, setRecap] = useState<PostRunRecapPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadRecap = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/garmin/activities/${encodeURIComponent(activityId)}/recap?userId=${encodeURIComponent(String(userId))}`,
        {
          headers: {
            'x-user-id': String(userId),
          },
        }
      )

      if (!response.ok) {
        setRecap(null)
        return
      }

      const payload = (await response.json()) as PostRunRecapPayload
      setRecap(payload)
    } catch {
      setRecap(null)
    } finally {
      setIsLoading(false)
    }
  }, [activityId, userId])

  useEffect(() => {
    void loadRecap()
  }, [loadRecap])

  return (
    <Card data-testid="post-run-recap">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          Post-Run Recap
          <Badge variant="secondary">{recap?.confidence ?? 'none'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building recap...
          </div>
        ) : recap ? (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">One thing to improve</p>
              <p className="mt-1 font-medium" data-testid="post-run-one-thing">{recap.oneThing}</p>
            </div>
            <p className="text-xs text-muted-foreground">{recap.why}</p>
            {recap.evidence.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {recap.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">No recap available for this activity.</p>
        )}

        <Button variant="outline" size="sm" onClick={() => void loadRecap()}>
          Refresh recap
        </Button>
      </CardContent>
    </Card>
  )
}
