'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { trackOnboardingEvent } from '@/lib/analytics'
import { AnimatedCounter } from './animated-counter'
import type { AchievementContext } from '@/lib/achievementDetector'

interface AchievementMomentProps {
  context: AchievementContext
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 4500

function getCopy(context: AchievementContext): { headline: string; subline: string } {
  switch (context.type) {
    case 'first_run':
      if (context.distanceKm >= 1) {
        return {
          headline: 'Your first run. It had to start somewhere.',
          subline: 'It started today. Everything else builds from here.',
        }
      }
      return {
        headline: 'You showed up.',
        subline: "That's not nothing. Most people didn't.",
      }
    case 'personal_best':
      return {
        headline: 'You just ran further than you ever have.',
        subline: "We noticed. That wasn't on anyone's schedule — it just happened.",
      }
    case 'milestone':
      if (context.milestoneKm === 5) {
        return { headline: 'You crossed 5K.', subline: 'That distance means something. It always will.' }
      }
      if (context.milestoneKm === 10) {
        return {
          headline: 'You ran 10 kilometres.',
          subline: 'Most people talk about it. You just did it.',
        }
      }
      return {
        headline: 'Half marathon distance.',
        subline: 'Every step from here is an encore.',
      }
    default:
      return { headline: 'Nice work.', subline: 'Keep going.' }
  }
}

export function AchievementMoment({ context, onDismiss }: AchievementMomentProps) {
  const [visible, setVisible] = useState(false)
  const { headline, subline } = getCopy(context)

  const handleDismiss = useCallback(() => {
    void trackOnboardingEvent('aha_moment_dismissed', {
      moment_id: 'achievement',
      achievement_type: context.type,
      distance_km: context.distanceKm,
      is_first_run: context.type === 'first_run',
    })
    onDismiss()
  }, [context, onDismiss])

  useEffect(() => {
    void trackOnboardingEvent('aha_moment_fired', {
      moment_id: 'achievement',
      achievement_type: context.type,
      distance_km: context.distanceKm,
      is_first_run: context.type === 'first_run',
    })
  }, [context])

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setVisible(true))
    const timerId = window.setTimeout(handleDismiss, AUTO_DISMISS_MS)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(timerId)
    }
  }, [handleDismiss])

  const showCounter = context.type === 'personal_best' || context.type === 'milestone'

  return (
    <div
      data-testid="achievement-moment"
      role="button"
      tabIndex={0}
      onClick={handleDismiss}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleDismiss()
        }
      }}
      className={cn(
        'fixed inset-0 z-[60] flex flex-col items-center justify-center',
        'bg-[oklch(12%_0.02_255)] text-white px-8 cursor-pointer',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {showCounter && (
        <div
          className={cn(
            'mb-8 text-5xl font-bold tabular-nums transition-all duration-300 delay-100',
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          )}
        >
          {context.type === 'personal_best' ? (
            <AnimatedCounter
              from={context.previousBestKm}
              to={context.distanceKm}
              suffix=" km"
            />
          ) : (
            <AnimatedCounter from={0} to={context.milestoneKm} suffix=" km" />
          )}
        </div>
      )}

      <div
        className={cn(
          'text-center space-y-3 max-w-sm transition-all duration-300 delay-200',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
      >
        <h2 className="text-2xl font-semibold leading-snug">{headline}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{subline}</p>
      </div>
    </div>
  )
}
