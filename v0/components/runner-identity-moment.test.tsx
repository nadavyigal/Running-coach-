import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RunnerIdentityMoment } from './runner-identity-moment'
import { trackOnboardingEvent } from '@/lib/analytics'

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
    vi.mocked(trackOnboardingEvent).mockClear()
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
