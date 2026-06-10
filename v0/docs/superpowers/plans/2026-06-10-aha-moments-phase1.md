# Aha Moments Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Moment #1 ("This knows me") and Moment #3 ("I can see where I'm going") as full-screen overlays that fire immediately after onboarding completes, before the user enters the Today screen.

**Architecture:** Two new overlay components intercept the `onComplete()` callback in `OnboardingScreen`. After the DB write succeeds, instead of navigating immediately, we show Moment #1 (identity badge), then Moment #3 (goal timeline), then call `onComplete()`. A shared pure-function service (`userInsightService.ts`) computes identity and timeline from the data already present in onboarding state — no extra DB calls at render time.

**Tech Stack:** Next.js 14, React, Tailwind CSS, vitest + @testing-library/react, PostHog via `trackOnboardingEvent` from `lib/analytics.ts`

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `v0/lib/userInsightService.ts` | Pure functions: `getRunningIdentity`, `projectGoalTimeline`, exported types |
| Create | `v0/lib/userInsightService.test.ts` | Unit tests for all pure functions (no DOM) |
| Create | `v0/components/aha-moment-overlay.tsx` | Shared full-screen overlay shell: dark bg, fade-in animation, headline/subline/CTA/skip layout |
| Create | `v0/components/runner-identity-moment.tsx` | Moment #1 UI: identity badge, glyph, warm copy (Variant C), PostHog fire |
| Create | `v0/components/goal-timeline-moment.tsx` | Moment #3 UI: animated timeline, goal headline, PostHog fire |
| Modify | `v0/components/onboarding-screen.tsx` | Add `ahaMomentStage` state; intercept `onComplete()` to show moments in sequence |

---

## Task 1: Create `userInsightService.ts`

**Files:**
- Create: `v0/lib/userInsightService.ts`

- [ ] **Step 1: Write the file**

```typescript
// v0/lib/userInsightService.ts

export type RunnerIdentityId =
  | 'endurance_builder'
  | 'speed_seeker'
  | 'first_timer'
  | 'balanced_athlete'

export interface RunnerIdentity {
  id: RunnerIdentityId
  label: string
  glyph: string
  accentColor: string // Tailwind text color class
  ringColor: string   // Tailwind ring color class
  headline: string
  subline: string
  ctaLabel: string
}

export interface GoalTimeline {
  weeks: number
  milestoneWeek: number
  milestoneLabel: string
  goalLabel: string
  projectedDate: Date
}

const IDENTITIES: Record<RunnerIdentityId, RunnerIdentity> = {
  endurance_builder: {
    id: 'endurance_builder',
    label: 'Endurance Builder',
    glyph: '⛰️',
    accentColor: 'text-emerald-400',
    ringColor: 'ring-emerald-400/40',
    headline: "We can already tell — you're in it for the miles, not the medals.",
    subline: "That's the kind of runner who surprises themselves. Let's find out how far.",
    ctaLabel: "I'm ready",
  },
  speed_seeker: {
    id: 'speed_seeker',
    label: 'Speed Seeker',
    glyph: '⚡',
    accentColor: 'text-orange-400',
    ringColor: 'ring-orange-400/40',
    headline: "You're chasing time, not just distance.",
    subline: "Every second you shave off is earned. We'll help you earn more of them.",
    ctaLabel: "Let's go faster",
  },
  first_timer: {
    id: 'first_timer',
    label: 'First Timer',
    glyph: '🌱',
    accentColor: 'text-sky-400',
    ringColor: 'ring-sky-400/40',
    headline: "Everyone starts somewhere. Yours starts now.",
    subline: "The runners who stick with it are the ones who start slowly. We've got you.",
    ctaLabel: "Start my journey",
  },
  balanced_athlete: {
    id: 'balanced_athlete',
    label: 'All-Round Runner',
    glyph: '🏃',
    accentColor: 'text-teal-400',
    ringColor: 'ring-teal-400/40',
    headline: "You've got a good base. Let's do something with it.",
    subline: "Consistent runners who mix pace and distance improve fastest. That's your path.",
    ctaLabel: "Build on it",
  },
}

const WEEKS_TO_GOAL: Record<string, Record<string, number>> = {
  habit:    { beginner: 4, occasional: 4, regular: 3 },
  distance: { beginner: 8, occasional: 6, regular: 5 },
  speed:    { beginner: 6, occasional: 5, regular: 4 },
}

const MILESTONE_LABELS: Record<string, string> = {
  habit:    'First consistent week',
  distance: 'Halfway there',
  speed:    'Feeling the difference',
}

const GOAL_LABELS: Record<string, string> = {
  habit:    'Running 3× / week',
  distance: 'New distance goal',
  speed:    'Faster than today',
}

/**
 * Classify a runner's identity from onboarding data.
 * paceMinPerKm is referenceRaceTimeSeconds / 60 / referenceRaceDistanceKm.
 */
export function getRunningIdentity(
  goal: string,
  experience: string,
  paceMinPerKm: number
): RunnerIdentity {
  if (experience === 'beginner') return IDENTITIES.first_timer
  if (goal === 'speed' || paceMinPerKm < 5.5) return IDENTITIES.speed_seeker
  if (goal === 'distance' && paceMinPerKm > 6.5) return IDENTITIES.endurance_builder
  return IDENTITIES.balanced_athlete
}

/**
 * Project when the user will reach their goal based on onboarding data.
 */
export function projectGoalTimeline(
  goal: string,
  experience: string,
): GoalTimeline {
  const normalizedGoal = goal in WEEKS_TO_GOAL ? goal : 'habit'
  const normalizedExp = experience in (WEEKS_TO_GOAL[normalizedGoal] ?? {}) ? experience : 'beginner'

  const weeks = WEEKS_TO_GOAL[normalizedGoal]![normalizedExp]!
  const milestoneWeek = Math.max(1, Math.floor(weeks / 2))

  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + weeks * 7)

  return {
    weeks,
    milestoneWeek,
    milestoneLabel: MILESTONE_LABELS[normalizedGoal] ?? 'Milestone',
    goalLabel: GOAL_LABELS[normalizedGoal] ?? 'Your goal',
    projectedDate,
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/lib/userInsightService.ts
git commit -m "feat: add userInsightService with getRunningIdentity and projectGoalTimeline"
```

---

## Task 2: Unit tests for `userInsightService`

**Files:**
- Create: `v0/lib/userInsightService.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// v0/lib/userInsightService.test.ts
import { describe, it, expect } from 'vitest'
import {
  getRunningIdentity,
  projectGoalTimeline,
} from './userInsightService'

describe('getRunningIdentity', () => {
  it('returns first_timer for beginners regardless of pace or goal', () => {
    const result = getRunningIdentity('distance', 'beginner', 7.0)
    expect(result.id).toBe('first_timer')
  })

  it('returns first_timer for beginners even with fast pace', () => {
    const result = getRunningIdentity('speed', 'beginner', 4.5)
    expect(result.id).toBe('first_timer')
  })

  it('returns speed_seeker when goal is speed and experience is not beginner', () => {
    const result = getRunningIdentity('speed', 'regular', 6.0)
    expect(result.id).toBe('speed_seeker')
  })

  it('returns speed_seeker when pace is below 5.5 min/km', () => {
    const result = getRunningIdentity('distance', 'regular', 5.2)
    expect(result.id).toBe('speed_seeker')
  })

  it('returns endurance_builder when goal is distance and pace is above 6.5 min/km', () => {
    const result = getRunningIdentity('distance', 'occasional', 7.0)
    expect(result.id).toBe('endurance_builder')
  })

  it('returns balanced_athlete for regular runners with moderate pace and habit goal', () => {
    const result = getRunningIdentity('habit', 'regular', 6.0)
    expect(result.id).toBe('balanced_athlete')
  })

  it('returns an identity with all required fields', () => {
    const result = getRunningIdentity('distance', 'occasional', 7.0)
    expect(result.id).toBeDefined()
    expect(result.label).toBeTruthy()
    expect(result.glyph).toBeTruthy()
    expect(result.headline).toBeTruthy()
    expect(result.subline).toBeTruthy()
    expect(result.ctaLabel).toBeTruthy()
  })
})

describe('projectGoalTimeline', () => {
  it('returns 4 weeks for a beginner with habit goal', () => {
    const result = projectGoalTimeline('habit', 'beginner')
    expect(result.weeks).toBe(4)
  })

  it('returns 8 weeks for a beginner with distance goal', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.weeks).toBe(8)
  })

  it('returns 5 weeks for a regular runner with distance goal', () => {
    const result = projectGoalTimeline('distance', 'regular')
    expect(result.weeks).toBe(5)
  })

  it('returns 3 weeks for a regular runner with habit goal', () => {
    const result = projectGoalTimeline('habit', 'regular')
    expect(result.weeks).toBe(3)
  })

  it('sets milestoneWeek to roughly half the weeks', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.milestoneWeek).toBe(4)
  })

  it('milestoneWeek is at least 1', () => {
    const result = projectGoalTimeline('habit', 'regular')
    expect(result.milestoneWeek).toBeGreaterThanOrEqual(1)
  })

  it('projectedDate is in the future', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.projectedDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('projectedDate is approximately weeks * 7 days from now', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    const expectedMs = result.weeks * 7 * 24 * 60 * 60 * 1000
    const actualMs = result.projectedDate.getTime() - Date.now()
    expect(actualMs).toBeGreaterThan(expectedMs - 5000) // within 5 seconds
    expect(actualMs).toBeLessThan(expectedMs + 5000)
  })

  it('uses beginner as fallback for unknown experience', () => {
    const known = projectGoalTimeline('distance', 'beginner')
    const unknown = projectGoalTimeline('distance', 'unknown_experience')
    expect(unknown.weeks).toBe(known.weeks)
  })

  it('uses habit as fallback for unknown goal', () => {
    const known = projectGoalTimeline('habit', 'beginner')
    const unknown = projectGoalTimeline('unknown_goal', 'beginner')
    expect(unknown.weeks).toBe(known.weeks)
  })

  it('returns goalLabel and milestoneLabel strings', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.goalLabel).toBeTruthy()
    expect(result.milestoneLabel).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests — expect all to pass**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run lib/userInsightService.test.ts
```

Expected: 16 tests passing, 0 failing.

- [ ] **Step 3: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/lib/userInsightService.test.ts
git commit -m "test: add unit tests for userInsightService"
```

---

## Task 3: Create `AhaMomentOverlay` (shared shell)

**Files:**
- Create: `v0/components/aha-moment-overlay.tsx`

- [ ] **Step 1: Write the component**

```tsx
// v0/components/aha-moment-overlay.tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface AhaMomentOverlayProps {
  headline: string
  subline: string
  ctaLabel: string
  onCTA: () => void
  onSkip: () => void
  skipLabel?: string
  children?: React.ReactNode // slot for the visual above headline
}

export function AhaMomentOverlay({
  headline,
  subline,
  ctaLabel,
  onCTA,
  onSkip,
  skipLabel = 'Skip for now',
  children,
}: AhaMomentOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Defer to next frame so CSS transition fires
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      data-testid="aha-moment-overlay"
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        'bg-[oklch(12%_0.02_255)] text-white px-8',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Visual slot */}
      {children && (
        <div
          className={cn(
            'mb-8 transition-all duration-300 delay-100',
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          )}
        >
          {children}
        </div>
      )}

      {/* Text */}
      <div
        className={cn(
          'text-center space-y-3 max-w-sm transition-all duration-300 delay-200',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
      >
        <h2 className="text-2xl font-semibold leading-snug">{headline}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{subline}</p>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'mt-10 w-full max-w-sm flex flex-col gap-3 transition-all duration-300 delay-300',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
      >
        <Button
          type="button"
          data-testid="aha-moment-cta"
          className="w-full h-14 text-lg font-bold rounded-2xl bg-white text-neutral-950 hover:bg-white/95"
          onClick={onCTA}
        >
          {ctaLabel}
        </Button>
        <button
          type="button"
          data-testid="aha-moment-skip"
          className="w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          onClick={onSkip}
        >
          {skipLabel}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/components/aha-moment-overlay.tsx
git commit -m "feat: add AhaMomentOverlay shared shell component"
```

---

## Task 4: Create `RunnerIdentityMoment` (Moment #1)

**Files:**
- Create: `v0/components/runner-identity-moment.tsx`
- Create: `v0/components/runner-identity-moment.test.tsx`

- [ ] **Step 1: Write the component**

```tsx
// v0/components/runner-identity-moment.tsx
'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { trackOnboardingEvent } from '@/lib/analytics'
import { AhaMomentOverlay } from './aha-moment-overlay'
import type { RunnerIdentity } from '@/lib/userInsightService'

interface RunnerIdentityMomentProps {
  identity: RunnerIdentity
  onCTA: () => void
  onSkip: () => void
}

export function RunnerIdentityMoment({ identity, onCTA, onSkip }: RunnerIdentityMomentProps) {
  useEffect(() => {
    void trackOnboardingEvent('aha_moment_fired', {
      moment_id: 'knows_me',
      variant: 'C',
      identity_id: identity.id,
    })
  }, [identity.id])

  const handleCTA = () => {
    void trackOnboardingEvent('aha_moment_cta_clicked', {
      moment_id: 'knows_me',
      variant: 'C',
      identity_id: identity.id,
    })
    onCTA()
  }

  const handleSkip = () => {
    void trackOnboardingEvent('aha_moment_dismissed', {
      moment_id: 'knows_me',
      variant: 'C',
      identity_id: identity.id,
    })
    onSkip()
  }

  return (
    <AhaMomentOverlay
      headline={identity.headline}
      subline={identity.subline}
      ctaLabel={identity.ctaLabel}
      onCTA={handleCTA}
      onSkip={handleSkip}
    >
      {/* Identity badge */}
      <div className="flex flex-col items-center gap-3">
        <div
          data-testid="identity-glyph"
          className="text-6xl leading-none"
          aria-hidden="true"
        >
          {identity.glyph}
        </div>
        <div
          className={cn(
            'px-4 py-1.5 rounded-full border text-sm font-semibold',
            'bg-white/5',
            identity.accentColor,
            `ring-2 ${identity.ringColor}`
          )}
        >
          {identity.label}
        </div>
      </div>
    </AhaMomentOverlay>
  )
}
```

- [ ] **Step 2: Write the tests**

```tsx
// v0/components/runner-identity-moment.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RunnerIdentityMoment } from './runner-identity-moment'

vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}))

const mockIdentity = {
  id: 'endurance_builder' as const,
  label: 'Endurance Builder',
  glyph: '⛰️',
  accentColor: 'text-emerald-400',
  ringColor: 'ring-emerald-400/40',
  headline: "We can already tell — you're in it for the miles, not the medals.",
  subline: "That's the kind of runner who surprises themselves. Let's find out how far.",
  ctaLabel: "I'm ready",
}

describe('RunnerIdentityMoment', () => {
  const onCTA = vi.fn()
  const onSkip = vi.fn()

  beforeEach(() => {
    onCTA.mockClear()
    onSkip.mockClear()
  })

  it('renders the identity label', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText('Endurance Builder')).toBeInTheDocument()
  })

  it('renders the identity glyph', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByTestId('identity-glyph')).toBeInTheDocument()
  })

  it('renders the headline', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText(/in it for the miles/i)).toBeInTheDocument()
  })

  it('calls onCTA when CTA button is clicked', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('aha-moment-cta'))
    expect(onCTA).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when skip button is clicked', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('aha-moment-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('renders the overlay container', () => {
    render(<RunnerIdentityMoment identity={mockIdentity} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByTestId('aha-moment-overlay')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run components/runner-identity-moment.test.tsx
```

Expected: 6 tests passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/components/runner-identity-moment.tsx v0/components/runner-identity-moment.test.tsx
git commit -m "feat: add RunnerIdentityMoment component (Aha Moment #1)"
```

---

## Task 5: Create `GoalTimelineMoment` (Moment #3)

**Files:**
- Create: `v0/components/goal-timeline-moment.tsx`
- Create: `v0/components/goal-timeline-moment.test.tsx`

- [ ] **Step 1: Write the component**

```tsx
// v0/components/goal-timeline-moment.tsx
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
      {/* Dots row */}
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
```

- [ ] **Step 2: Write the tests**

```tsx
// v0/components/goal-timeline-moment.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoalTimelineMoment } from './goal-timeline-moment'

vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}))

const mockTimeline = {
  weeks: 8,
  milestoneWeek: 4,
  milestoneLabel: 'Halfway there',
  goalLabel: 'New distance goal',
  projectedDate: new Date('2026-08-05'),
}

describe('GoalTimelineMoment', () => {
  const onCTA = vi.fn()
  const onSkip = vi.fn()

  beforeEach(() => {
    onCTA.mockClear()
    onSkip.mockClear()
  })

  it('renders the timeline graphic', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByTestId('timeline-graphic')).toBeInTheDocument()
  })

  it('renders the correct headline for distance goal', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText(/8 weeks away/i)).toBeInTheDocument()
  })

  it('renders the correct headline for habit goal', () => {
    render(<GoalTimelineMoment goal="habit" timeline={{ ...mockTimeline, weeks: 4 }} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText(/feel like a habit/i)).toBeInTheDocument()
  })

  it('renders the correct headline for speed goal', () => {
    render(<GoalTimelineMoment goal="speed" timeline={{ ...mockTimeline, weeks: 6 }} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText(/running faster/i)).toBeInTheDocument()
  })

  it('shows milestone label in timeline', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByText('Halfway there')).toBeInTheDocument()
  })

  it('calls onCTA when CTA is clicked', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('aha-moment-cta'))
    expect(onCTA).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when skip is clicked', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('aha-moment-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('CTA button label is "Show me the plan"', () => {
    render(<GoalTimelineMoment goal="distance" timeline={mockTimeline} onCTA={onCTA} onSkip={onSkip} />)
    expect(screen.getByTestId('aha-moment-cta')).toHaveTextContent('Show me the plan')
  })
})
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run components/goal-timeline-moment.test.tsx
```

Expected: 8 tests passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/components/goal-timeline-moment.tsx v0/components/goal-timeline-moment.test.tsx
git commit -m "feat: add GoalTimelineMoment component (Aha Moment #3)"
```

---

## Task 6: Wire aha moments into `onboarding-screen.tsx`

**Files:**
- Modify: `v0/components/onboarding-screen.tsx`

This is the integration task. We intercept `onComplete()` after a successful DB write and show Moment #1 → Moment #3 → `onComplete()`.

**What changes:**
1. Import `getRunningIdentity`, `projectGoalTimeline`, `RunnerIdentity`, `GoalTimeline` from `userInsightService`
2. Import `RunnerIdentityMoment` and `GoalTimelineMoment`
3. Add two new state variables below the existing state declarations
4. In `handleComplete()`, replace the call to `onComplete()` with state updates to show moments
5. Render the two moment components conditionally at the end of the JSX (inside the error boundary, after the main div)

- [ ] **Step 1: Add imports at the top of `onboarding-screen.tsx`**

Find the last import line (around line 36, `import { syncPlanWithChallenge }...`) and add after it:

```typescript
import {
  getRunningIdentity,
  projectGoalTimeline,
  type RunnerIdentity,
  type GoalTimeline,
} from '@/lib/userInsightService'
import { RunnerIdentityMoment } from '@/components/runner-identity-moment'
import { GoalTimelineMoment } from '@/components/goal-timeline-moment'
```

- [ ] **Step 2: Add aha moment state variables**

Find the line:
```typescript
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
```
(around line 427) and add directly after it:

```typescript
  type AhaMomentStage = 'identity' | 'timeline' | null
  const [ahaMomentStage, setAhaMomentStage] = useState<AhaMomentStage>(null)
  const [ahaMomentData, setAhaMomentData] = useState<{
    identity: RunnerIdentity
    timeline: GoalTimeline
  } | null>(null)
```

- [ ] **Step 3: Replace `onComplete()` call in `handleComplete()`**

Find this block (around line 880-895):
```typescript
        // Call the parent's onComplete callback to trigger navigation
        try {
          onComplete()
          console.log('✅ [OnboardingScreen] onComplete() called successfully')
        } catch (error) {
          console.error('❌ [OnboardingScreen] Error calling onComplete():', error)
          // Force navigation even if callback fails
          setIsGeneratingPlan(false)
        }
```

Replace it with:
```typescript
        // Show aha moments before navigating
        try {
          const paceMinPerKm = referenceRaceTimeSeconds > 0 && referenceRaceDistance > 0
            ? (referenceRaceTimeSeconds / 60) / referenceRaceDistance
            : 7.0
          const identity = getRunningIdentity(selectedGoal, selectedExperience, paceMinPerKm)
          const timeline = projectGoalTimeline(selectedGoal, selectedExperience)
          setAhaMomentData({ identity, timeline })
          setAhaMomentStage('identity')
          console.log('✅ [OnboardingScreen] Aha moments queued')
        } catch (momentError) {
          console.error('❌ [OnboardingScreen] Aha moment setup failed, skipping to app:', momentError)
          // Non-critical — fall through to app if moments fail
          try {
            onComplete()
          } catch {
            setIsGeneratingPlan(false)
          }
        }
```

- [ ] **Step 4: Add moment renders at end of return JSX**

Find the closing `</OnboardingErrorBoundary>` tag (the final line of the return statement) and add before it:

```tsx
      {ahaMomentStage === 'identity' && ahaMomentData && (
        <RunnerIdentityMoment
          identity={ahaMomentData.identity}
          onCTA={() => setAhaMomentStage('timeline')}
          onSkip={() => {
            setAhaMomentStage(null)
            onComplete()
          }}
        />
      )}
      {ahaMomentStage === 'timeline' && ahaMomentData && (
        <GoalTimelineMoment
          goal={selectedGoal}
          timeline={ahaMomentData.timeline}
          onCTA={() => {
            setAhaMomentStage(null)
            onComplete()
          }}
          onSkip={() => {
            setAhaMomentStage(null)
            onComplete()
          }}
        />
      )}
```

- [ ] **Step 5: Run the existing onboarding tests to confirm no regression**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run components/onboarding-screen.test.tsx
```

Expected: same number of passing tests as before this task, 0 new failures.

If tests fail due to missing mocks for the new imports, add these to the mock block at the top of `onboarding-screen.test.tsx`:

```typescript
vi.mock('@/lib/userInsightService', () => ({
  getRunningIdentity: vi.fn().mockReturnValue({
    id: 'first_timer',
    label: 'First Timer',
    glyph: '🌱',
    accentColor: 'text-sky-400',
    ringColor: 'ring-sky-400/40',
    headline: 'Test headline',
    subline: 'Test subline',
    ctaLabel: 'Test CTA',
  }),
  projectGoalTimeline: vi.fn().mockReturnValue({
    weeks: 4,
    milestoneWeek: 2,
    milestoneLabel: 'Halfway there',
    goalLabel: 'Your goal',
    projectedDate: new Date('2026-08-01'),
  }),
}))

vi.mock('@/components/runner-identity-moment', () => ({
  RunnerIdentityMoment: () => null,
}))

vi.mock('@/components/goal-timeline-moment', () => ({
  GoalTimelineMoment: () => null,
}))
```

- [ ] **Step 6: Run lint and type-check**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx tsc --noEmit 2>&1 | head -30
npm run lint 2>&1 | tail -20
```

Expected: 0 type errors on new files. If lint reports max-lines or complexity on `onboarding-screen.tsx`, note but do not refactor — we are not touching unrelated code.

- [ ] **Step 7: Commit**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git add v0/components/onboarding-screen.tsx v0/components/onboarding-screen.test.tsx
git commit -m "feat: wire Aha Moments #1 and #3 into onboarding flow"
```

---

## Task 7: Run full test suite and confirm clean

- [ ] **Step 1: Run all new tests together**

```bash
cd /Users/nadavyigal/Documents/RunSmart/v0
npx vitest run lib/userInsightService.test.ts components/runner-identity-moment.test.tsx components/goal-timeline-moment.test.tsx components/onboarding-screen.test.tsx
```

Expected: all tests pass. Total new tests: ~30. No existing tests broken.

- [ ] **Step 2: Final commit if any fixup needed**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git status
# commit only if there are changes from fixups
```

---

## Self-Review: Spec Coverage Check

| Spec Requirement | Covered by Task |
|---|---|
| Moment #1 fires after onboarding completion | Task 6 — intercepts `onComplete()` |
| Moment #1 shows identity badge + label | Task 4 — `RunnerIdentityMoment` |
| Moment #1 uses goal + experience + pace to classify | Task 1 — `getRunningIdentity` |
| Moment #1 fires once (PostHog event) | Task 4 — `useEffect` fires `aha_moment_fired` |
| Moment #1 CTA → Moment #3 (not straight to app) | Task 6 — `setAhaMomentStage('timeline')` |
| Moment #3 fires after Moment #1 CTA | Task 6 — sequenced in `ahaMomentStage` |
| Moment #3 shows timeline graphic | Task 5 — `TimelineGraphic` component |
| Moment #3 headline changes by goal type | Task 5 — `buildHeadline()` |
| Moment #3 CTA → `onComplete()` | Task 6 — `setAhaMomentStage(null); onComplete()` |
| Skip on either moment goes straight to app | Task 6 — both skip handlers call `onComplete()` |
| PostHog events for all moment interactions | Tasks 4, 5 — `trackOnboardingEvent` calls |
| No new npm dependencies | All tasks — only existing imports |
| Error in moment setup doesn't block user | Task 6 — try/catch falls through to `onComplete()` |
| Existing onboarding tests still pass | Task 6 — regression check in Step 5 |

No gaps found.
