'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { ChallengeCard, type ChallengeListItem } from '@/components/challenges/ChallengeCard'
import {
  ChallengeProgress,
  type ChallengeProgressPayload,
} from '@/components/challenges/ChallengeProgress'
import { Badge } from '@/components/ui/badge'
import { useData } from '@/contexts/DataContext'

interface ChallengesListResponse {
  challenges: ChallengeListItem[]
}

export default function ChallengesPage() {
  const { userId } = useData()
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ChallengeProgressPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoiningId, setIsJoiningId] = useState<string | null>(null)
  const [isMarkingSelfReport, setIsMarkingSelfReport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const joinedChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.joined),
    [challenges]
  )

  const loadChallenges = useCallback(async () => {
    if (!userId) {
      setChallenges([])
      setSelectedChallengeId(null)
      setProgress(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/challenges?userId=${encodeURIComponent(String(userId))}`, {
        headers: {
          'x-user-id': String(userId),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load challenges')
      }

      const payload = (await response.json()) as ChallengesListResponse
      setChallenges(payload.challenges ?? [])

      const nextSelected =
        payload.challenges.find((challenge) => challenge.id === selectedChallengeId)?.id ??
        payload.challenges.find((challenge) => challenge.joined)?.id ??
        null
      setSelectedChallengeId(nextSelected)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load challenges')
    } finally {
      setIsLoading(false)
    }
  }, [selectedChallengeId, userId])

  const loadProgress = useCallback(
    async (challengeId: string, selfReport = false) => {
      if (!userId) return

      const query = new URLSearchParams({ userId: String(userId) })
      if (selfReport) {
        query.set('selfReport', 'true')
      }

      const response = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/progress?${query.toString()}`, {
        headers: {
          'x-user-id': String(userId),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load challenge progress')
      }

      const payload = (await response.json()) as ChallengeProgressPayload
      setProgress(payload)
    },
    [userId]
  )

  useEffect(() => {
    void loadChallenges()
  }, [loadChallenges])

  useEffect(() => {
    if (!selectedChallengeId) {
      setProgress(null)
      return
    }

    void loadProgress(selectedChallengeId).catch(() => {
      setProgress(null)
    })
  }, [loadProgress, selectedChallengeId])

  const handleJoin = useCallback(
    async (challenge: ChallengeListItem) => {
      if (!userId) return

      setIsJoiningId(challenge.id)
      setError(null)

      try {
        const response = await fetch('/api/challenges', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(userId),
          },
          body: JSON.stringify({
            userId,
            challengeId: challenge.id,
          }),
        })

        if (!response.ok) {
          throw new Error('Unable to join challenge')
        }

        await loadChallenges()
        setSelectedChallengeId(challenge.id)
        await loadProgress(challenge.id)
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : 'Unable to join challenge')
      } finally {
        setIsJoiningId(null)
      }
    },
    [loadChallenges, loadProgress, userId]
  )

  const handleSelfReport = useCallback(async () => {
    if (!selectedChallengeId) return

    setIsMarkingSelfReport(true)
    setError(null)

    try {
      await loadProgress(selectedChallengeId, true)
    } catch (progressError) {
      setError(progressError instanceof Error ? progressError.message : 'Unable to mark completion')
    } finally {
      setIsMarkingSelfReport(false)
    }
  }, [loadProgress, selectedChallengeId])

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 p-4" data-testid="challenges-page">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Habit loops</p>
        <h1 className="text-2xl font-semibold">21-Day Challenges</h1>
        <p className="text-sm text-muted-foreground">
          Join a challenge, keep your streak alive, and use self-report only when Garmin data is missing.
        </p>
      </header>

      {!userId ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Sign in to browse and join challenges.
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Available</h2>
          {joinedChallenges.length > 0 ? <Badge>{joinedChallenges.length} joined</Badge> : null}
        </div>

        {isLoading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading challenges...</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                joining={isJoiningId === challenge.id}
                onJoin={handleJoin}
              />
            ))}
          </div>
        )}
      </section>

      {progress ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your Progress</h2>
            <Link href="/today" className="text-sm text-blue-600 hover:underline">
              Back to today
            </Link>
          </div>
          <ChallengeProgress
            progress={progress}
            markingSelfReport={isMarkingSelfReport}
            onMarkSelfReport={handleSelfReport}
          />
        </section>
      ) : null}
    </main>
  )
}
