'use client'

import { Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export interface ChallengeListItem {
  id: string
  slug: string
  title: string
  description: string | null
  durationDays: number
  joined: boolean
}

interface ChallengeCardProps {
  challenge: ChallengeListItem
  joining: boolean
  onJoin: (challenge: ChallengeListItem) => void
}

export function ChallengeCard({ challenge, joining, onJoin }: ChallengeCardProps) {
  return (
    <Card data-testid={`challenge-card-${challenge.slug}`}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{challenge.title}</CardTitle>
          <Badge variant={challenge.joined ? 'default' : 'secondary'}>
            {challenge.durationDays} days
          </Badge>
        </div>
        <CardDescription>
          {challenge.description ?? 'Build consistency with a simple daily challenge loop.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 pt-0">
        {challenge.joined ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <Trophy className="h-4 w-4" />
            Joined
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Join to start tracking daily completions.</span>
        )}
        <Button
          size="sm"
          disabled={challenge.joined || joining}
          onClick={() => onJoin(challenge)}
          data-testid={`challenge-join-${challenge.slug}`}
        >
          {challenge.joined ? 'Joined' : joining ? 'Joining...' : 'Join'}
        </Button>
      </CardContent>
    </Card>
  )
}
