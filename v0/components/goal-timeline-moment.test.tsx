import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoalTimelineMoment } from './goal-timeline-moment'

vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./aha-moment-overlay', () => ({
  AhaMomentOverlay: ({ headline, subline, ctaLabel, onCTA, onSkip, children }: {
    headline: string
    subline: string
    ctaLabel: string
    onCTA: () => void
    onSkip: () => void
    children?: React.ReactNode
  }) => (
    <div data-testid="aha-moment-overlay">
      <div>{headline}</div>
      <div>{subline}</div>
      {children}
      <button data-testid="aha-moment-cta" onClick={onCTA}>{ctaLabel}</button>
      <button data-testid="aha-moment-skip" onClick={onSkip}>Skip</button>
    </div>
  ),
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
