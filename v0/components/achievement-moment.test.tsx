import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AchievementMoment } from './achievement-moment'
import { trackOnboardingEvent } from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./animated-counter', () => ({
  AnimatedCounter: ({ to, suffix }: { to: number; suffix?: string }) => (
    <span data-testid="animated-counter">{to}{suffix}</span>
  ),
}))

describe('AchievementMoment', () => {
  const onDismiss = vi.fn()

  beforeEach(() => {
    onDismiss.mockClear()
    vi.mocked(trackOnboardingEvent).mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders without error for first_run context', () => {
    render(
      <AchievementMoment
        context={{ type: 'first_run', distanceKm: 0.8 }}
        onDismiss={onDismiss}
      />
    )
    expect(screen.getByText('You showed up.')).toBeInTheDocument()
  })

  it('renders animated counter for personal_best', () => {
    render(
      <AchievementMoment
        context={{ type: 'personal_best', distanceKm: 6, previousBestKm: 4 }}
        onDismiss={onDismiss}
      />
    )
    expect(screen.getByTestId('animated-counter')).toBeInTheDocument()
  })

  it('fires aha_moment_fired on mount', () => {
    render(
      <AchievementMoment
        context={{ type: 'first_run', distanceKm: 1.2 }}
        onDismiss={onDismiss}
      />
    )
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      'aha_moment_fired',
      expect.objectContaining({ moment_id: 'achievement', achievement_type: 'first_run' })
    )
  })

  it('fires aha_moment_dismissed on tap', () => {
    render(
      <AchievementMoment
        context={{ type: 'first_run', distanceKm: 1.2 }}
        onDismiss={onDismiss}
      />
    )
    fireEvent.click(screen.getByTestId('achievement-moment'))
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      'aha_moment_dismissed',
      expect.objectContaining({ moment_id: 'achievement' })
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after 4500ms', () => {
    render(
      <AchievementMoment
        context={{ type: 'first_run', distanceKm: 1.2 }}
        onDismiss={onDismiss}
      />
    )
    vi.advanceTimersByTime(4500)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not render a CTA button', () => {
    render(
      <AchievementMoment
        context={{ type: 'milestone', distanceKm: 5.2, milestoneKm: 5 }}
        onDismiss={onDismiss}
      />
    )
    expect(screen.queryByTestId('aha-moment-cta')).not.toBeInTheDocument()
  })
})
