'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { trackOnboardingEvent } from '@/lib/analytics'
import { AhaMomentOverlay } from './aha-moment-overlay'
import type { GoalTimeline } from '@/lib/userInsightService'

interface GoalTimelineMomentProps {
  goal: string
  timeline: GoalTimeline
  onCTA: () => void
  onSkip: () => void
}

function formatProjectedDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildHeadline(goal: string, timeline: GoalTimeline): string {
  switch (goal) {
    case 'distance':
      return `Your ${timeline.goalLabel} is ${timeline.weeks} weeks away.`
    case 'speed':
      return `In ${timeline.weeks} weeks, you'll be running faster than today.`
    case 'habit':
    default:
      return `In ${timeline.weeks} weeks, running will feel like a habit.`
  }
}

function buildSubline(goal: string, timeline: GoalTimeline): string {
  const dateStr = formatProjectedDate(timeline.projectedDate)
  switch (goal) {
    case 'distance':
      return `Follow your plan 3 days a week. By ${dateStr}, you'll be there.`
    case 'speed':
      return `We'll sharpen your pace week by week. By ${dateStr}, you'll feel it.`
    case 'habit':
    default:
      return `Three runs a week is all it takes. By ${dateStr}, it'll be automatic.`
  }
}

function TimelineGraphic({
  milestoneWeek,
  milestoneLabel,
  goalLabel,
  weeks,
}: Pick<GoalTimeline, 'milestoneWeek' | 'milestoneLabel' | 'goalLabel' | 'weeks'>) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 400)
    return () => clearTimeout(id)
  }, [])

  return (
    <div data-testid="timeline-graphic" className="w-full max-w-xs mx-auto">
      <div className="relative flex items-start justify-between pt-2">
        {/* Background line */}
        <div className="absolute top-5 left-4 right-4 h-0.5 bg-white/10" />
        {/* Animated progress line */}
        <div
          className="absolute top-5 left-4 h-0.5 bg-primary transition-all duration-700 ease-out"
          style={{ right: animated ? '1rem' : '100%' }}
        />

        {/* Today dot */}
        <div className="relative z-10 flex flex-col items-center gap-2 w-14">
          <div className="w-4 h-4 rounded-full bg-white/50 border-2 border-white/70 mt-1" />
          <span className="text-[10px] text-white/50 text-center leading-tight">Today</span>
        </div>

        {/* Milestone dot */}
        <div className="relative z-10 flex flex-col items-center gap-2 w-20">
          <div className="w-3 h-3 rounded-full bg-white/15 border border-white/30 mt-1.5" />
          <span className="text-[10px] text-white/40 text-center leading-tight">{milestoneLabel}</span>
          <span className="text-[10px] text-white/25 text-center">Wk {milestoneWeek}</span>
        </div>

        {/* Goal dot */}
        <div className="relative z-10 flex flex-col items-center gap-2 w-14">
          <div className="w-5 h-5 rounded-full bg-primary shadow-lg shadow-primary/30 mt-0.5" />
          <span className="text-[10px] text-primary font-medium text-center leading-tight">{goalLabel}</span>
          <span className="text-[10px] text-white/30 text-center">Wk {weeks}</span>
        </div>
      </div>
    </div>
  )
}

export function GoalTimelineMoment({ goal, timeline, onCTA, onSkip }: GoalTimelineMomentProps) {
  const headline = buildHeadline(goal, timeline)
  const subline = buildSubline(goal, timeline)

  useEffect(() => {
    void trackOnboardingEvent('aha_moment_fired', {
      moment_id: 'future_vision',
      variant: 'C',
      goal,
      weeks_to_goal: timeline.weeks,
    })
  }, [goal, timeline.weeks])

  const handleCTA = () => {
    void trackOnboardingEvent('aha_moment_cta_clicked', {
      moment_id: 'future_vision',
      variant: 'C',
      goal,
    })
    onCTA()
  }

  const handleSkip = () => {
    void trackOnboardingEvent('aha_moment_dismissed', {
      moment_id: 'future_vision',
      variant: 'C',
      goal,
    })
    onSkip()
  }

  return (
    <AhaMomentOverlay
      headline={headline}
      subline={subline}
      ctaLabel="Show me the plan"
      onCTA={handleCTA}
      onSkip={handleSkip}
    >
      <TimelineGraphic
        milestoneWeek={timeline.milestoneWeek}
        milestoneLabel={timeline.milestoneLabel}
        goalLabel={timeline.goalLabel}
        weeks={timeline.weeks}
      />
    </AhaMomentOverlay>
  )
}
