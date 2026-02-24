'use client'

import { CheckCircle2, Flame, Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export interface ChallengeProgressPayload {
  challengeId: string
  challengeTitle: string | null
  startedAt: string
  durationDays: number
  currentDay: number
  completedDays: number
  progressPercent: number
  daysRemaining: number
  completedToday: boolean
  completionBadgeEarned: boolean
  canSelfReport: boolean
  streak: {
    current: number
    best: number
    lastActiveDay: string | null
  }
}

interface ChallengeProgressProps {
  progress: ChallengeProgressPayload
  markingSelfReport: boolean
  onMarkSelfReport: () => void
}

export function ChallengeProgress({ progress, markingSelfReport, onMarkSelfReport }: ChallengeProgressProps) {
  return (
    <Card data-testid="challenge-progress">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{progress.challengeTitle ?? 'Challenge Progress'}</span>
          <Badge variant={progress.completionBadgeEarned ? 'default' : 'secondary'}>
            Day {progress.currentDay}/{progress.durationDays}
          </Badge>
        </CardTitle>
        <CardDescription>
          Started {new Date(`${progress.startedAt}T00:00:00.000Z`).toLocaleDateString()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{progress.completedDays} days completed</span>
            <span>{progress.progressPercent}%</span>
          </div>
          <Progress value={progress.progressPercent} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md border p-2">
            <div className="flex items-center justify-center gap-1 text-orange-600">
              <Flame className="h-4 w-4" />
              <span className="text-sm font-semibold">{progress.streak.current}</span>
            </div>
            <p className="text-xs text-muted-foreground">Current streak</p>
          </div>
          <div className="rounded-md border p-2">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <Trophy className="h-4 w-4" />
              <span className="text-sm font-semibold">{progress.streak.best}</span>
            </div>
            <p className="text-xs text-muted-foreground">Best streak</p>
          </div>
          <div className="rounded-md border p-2">
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">{progress.daysRemaining}</span>
            </div>
            <p className="text-xs text-muted-foreground">Days left</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={progress.completedToday ? 'default' : 'outline'}>
            {progress.completedToday ? 'Completed today' : 'Not completed today'}
          </Badge>
          {progress.completionBadgeEarned ? <Badge>Completion badge earned</Badge> : null}
        </div>

        {progress.canSelfReport ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onMarkSelfReport}
            disabled={markingSelfReport}
            data-testid="challenge-self-report"
          >
            {markingSelfReport ? 'Saving...' : 'Mark today complete'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
