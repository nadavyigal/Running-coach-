import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoticedMoment } from './noticed-moment'
import { trackOnboardingEvent } from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

describe('NoticedMoment', () => {
  beforeEach(() => {
    vi.mocked(trackOnboardingEvent).mockClear()
  })

  it('renders correct headline for streak context', () => {
    render(<NoticedMoment context={{ type: 'streak', days: 7 }} />)
    expect(screen.getByText('Seven days in a row.')).toBeInTheDocument()
  })

  it('renders correct headline for comeback context', () => {
    render(<NoticedMoment context={{ type: 'comeback', daysSince: 12 }} />)
    expect(screen.getByText("You're back.")).toBeInTheDocument()
  })

  it('fires aha_moment_fired on mount with correct context', () => {
    render(<NoticedMoment context={{ type: 'third_run_week' }} />)
    expect(trackOnboardingEvent).toHaveBeenCalledWith('aha_moment_fired', {
      moment_id: 'noticed',
      context: 'third_run_week',
    })
  })

  it('share button calls onShare', () => {
    const onShare = vi.fn()
    render(<NoticedMoment context={{ type: 'streak', days: 3 }} onShare={onShare} />)
    fireEvent.click(screen.getByTestId('noticed-moment-share'))
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      'aha_moment_shared',
      expect.objectContaining({ moment_id: 'noticed', context: 'streak' })
    )
  })

  it('does not render share button when onShare is undefined', () => {
    render(<NoticedMoment context={{ type: 'streak', days: 3 }} />)
    expect(screen.queryByTestId('noticed-moment-share')).not.toBeInTheDocument()
  })
})
