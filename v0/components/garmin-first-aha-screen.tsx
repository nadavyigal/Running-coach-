'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, SkipForward } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useData } from '@/contexts/DataContext'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { acceptGarminFirstAhaPlan, startGarminFirstAhaChallenge } from '@/lib/garminFirstAhaClient'
import { markGarminFirstAhaSeen } from '@/lib/garminFirstAhaStorage'
import type { GarminFirstAhaResult } from '@/lib/garminFirstAhaTypes'
import { getActivePlan } from '@/lib/dbUtils'

type ScreenPhase = 'loading' | 'ready' | 'error'

const LOADING_STEPS = [
  'Reading your recent Garmin runs',
  'Checking consistency and load',
  'Reviewing recovery signals',
  'Drafting your 14-day starter block',
]

function guardrailClass(level: GarminFirstAhaResult['guardrails']['level']): string {
  if (level === 'green') return 'border-green-200 bg-green-50 text-green-900'
  if (level === 'yellow') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-red-200 bg-red-50 text-red-900'
}

export function GarminFirstAhaScreen() {
  const router = useRouter()
  const { toast } = useToast()
  const { userId, refresh } = useData()
  const [phase, setPhase] = useState<ScreenPhase>('loading')
  const [loadingStep, setLoadingStep] = useState(0)
  const [result, setResult] = useState<GarminFirstAhaResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isStartingChallenge, setIsStartingChallenge] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)

  const analyticsProps = useMemo(
    () => ({
      activity_count_28d: result?.signals.consistency.runsLast28Days,
      has_wellness_data: Boolean(result?.signals.recovery),
      guardrail_level: result?.guardrails.level,
      runner_type: result?.profile.runnerType,
      recommended_challenge_id: result?.recommendedChallenge.id,
      plan_days_count: result?.starterPlan.days.length,
    }),
    [result]
  )

  const loadResult = useCallback(async () => {
    if (!userId) return
    setPhase('loading')
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/garmin/first-aha?userId=${userId}`, {
        headers: { 'x-user-id': String(userId) },
        credentials: 'include',
      })
      const data = (await response.json()) as GarminFirstAhaResult & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load Garmin First Aha')
      }

      setResult(data)
      setPhase('ready')

      const activePlan = await getActivePlan(userId)
      setHasActivePlan(Boolean(activePlan?.id))

      void trackAnalyticsEvent('garmin_first_aha_viewed', {
        activity_count_28d: data.signals.consistency.runsLast28Days,
        has_wellness_data: Boolean(data.signals.recovery),
        guardrail_level: data.guardrails.level,
        runner_type: data.profile.runnerType,
        recommended_challenge_id: data.recommendedChallenge.id,
        plan_days_count: data.starterPlan.days.length,
      })
      if (data.status === 'partial') {
        void trackAnalyticsEvent('garmin_first_aha_partial_data', {
          activity_count_28d: data.signals.consistency.runsLast28Days,
          has_wellness_data: Boolean(data.signals.recovery),
        })
      }
      void trackAnalyticsEvent('garmin_first_aha_generated', {
        status: data.status,
        activity_count_28d: data.signals.consistency.runsLast28Days,
      })
    } catch (error) {
      setPhase('error')
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
      void trackAnalyticsEvent('garmin_first_aha_error', {
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void loadResult()
  }, [loadResult, userId])

  useEffect(() => {
    if (phase !== 'loading') return
    const interval = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % LOADING_STEPS.length)
    }, 900)
    return () => window.clearInterval(interval)
  }, [phase])

  const handleSkip = () => {
    markGarminFirstAhaSeen()
    void trackAnalyticsEvent('garmin_first_aha_skipped', analyticsProps)
    router.replace('/?screen=profile')
  }

  const handleAcceptPlan = async (replaceExisting = false) => {
    if (!userId || !result) return
    if (hasActivePlan && !replaceExisting) {
      setShowReplaceConfirm(true)
      return
    }

    setIsAccepting(true)
    try {
      await acceptGarminFirstAhaPlan({ userId, result, replaceExisting })
      markGarminFirstAhaSeen()
      await refresh()
      void trackAnalyticsEvent('garmin_first_aha_plan_accepted', analyticsProps)
      toast({
        title: 'Starter plan saved',
        description: 'Your 14-day Garmin-based block is ready on Today.',
      })
      router.replace('/')
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTIVE_PLAN_EXISTS') {
        setShowReplaceConfirm(true)
        return
      }
      toast({
        title: 'Could not save plan',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsAccepting(false)
    }
  }

  const handleStartChallenge = async () => {
    if (!userId || !result) return
    setIsStartingChallenge(true)
    try {
      await startGarminFirstAhaChallenge({
        userId,
        challengeSlug: result.recommendedChallenge.id,
      })
      markGarminFirstAhaSeen()
      void trackAnalyticsEvent('garmin_first_aha_challenge_started', analyticsProps)
      toast({
        title: 'Challenge started',
        description: result.recommendedChallenge.title,
      })
      router.replace('/?screen=profile')
    } catch (error) {
      toast({
        title: 'Could not start challenge',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsStartingChallenge(false)
    }
  }

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
        <p className="text-sm text-gray-600">Sign in to view your Garmin running profile.</p>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">Reading your recent Garmin runs</h1>
          </div>
          <p className="mt-3 text-sm text-gray-600">{LOADING_STEPS[loadingStep]}</p>
        </div>
      </main>
    )
  }

  if (phase === 'error' || !result) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h1 className="text-lg font-semibold text-red-900">Could not build your profile</h1>
              <p className="mt-2 text-sm text-red-800">{errorMessage}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => void loadResult()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const statusLabel =
    result.status === 'ready'
      ? 'Ready'
      : result.status === 'partial'
        ? 'Partial data'
        : result.status === 'insufficient_data'
          ? 'Limited history'
          : 'Unavailable'

  return (
    <main className="mx-auto min-h-screen max-w-xl p-4 pb-24 sm:p-6">
      <div className="space-y-4">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Garmin connected</p>
          <h1 className="text-2xl font-semibold text-gray-900">Your running profile</h1>
          <p className="text-sm text-gray-600">{result.profile.headline}</p>
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {statusLabel}
          </span>
        </header>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">{result.profile.runnerType}</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {result.profile.summaryBullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`rounded-xl border p-4 ${guardrailClass(result.guardrails.level)}`}>
          <h2 className="text-sm font-semibold">Safety read</h2>
          <p className="mt-2 text-sm">{result.guardrails.message}</p>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">{result.starterPlan.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{result.starterPlan.rationale}</p>
          <div className="mt-3 space-y-2">
            {result.starterPlan.days.slice(0, 8).map((day) => (
              <div key={`${day.date}-${day.label}`} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{day.label}</p>
                  <p className="text-xs text-gray-500">{day.date}</p>
                </div>
                <p className="text-right text-gray-700">{day.target ?? 'Rest'}</p>
              </div>
            ))}
            {result.starterPlan.days.length > 8 && (
              <p className="text-xs text-gray-500">+ {result.starterPlan.days.length - 8} more sessions in this block</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Recommended challenge</h2>
          <p className="mt-1 text-base font-medium text-gray-900">{result.recommendedChallenge.title}</p>
          <p className="mt-2 text-sm text-gray-600">{result.recommendedChallenge.reason}</p>
          <p className="mt-2 text-xs text-gray-500">{result.recommendedChallenge.fitScoreLabel}</p>
        </section>

        {result.disclaimers.length > 0 && (
          <p className="text-xs text-gray-500">{result.disclaimers.join(' ')}</p>
        )}

        {showReplaceConfirm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">You already have an active plan.</p>
            <p className="mt-1">Review and replace it with this 14-day Garmin starter block?</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void handleAcceptPlan(true)} disabled={isAccepting}>
                Review and replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReplaceConfirm(false)}>
                Keep current plan
              </Button>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 space-y-2 border-t bg-gray-50 p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <Button className="w-full" onClick={() => void handleAcceptPlan()} disabled={isAccepting}>
            {isAccepting ? 'Saving plan...' : 'Accept 14-day plan'}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => void handleStartChallenge()}
            disabled={isStartingChallenge}
          >
            {isStartingChallenge ? 'Starting challenge...' : 'Start recommended challenge'}
          </Button>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" asChild>
              <Link href="/?screen=onboarding">Adjust goal</Link>
            </Button>
            <Button className="flex-1" variant="ghost" onClick={handleSkip}>
              <SkipForward className="mr-2 h-4 w-4" />
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
