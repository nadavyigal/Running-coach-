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
