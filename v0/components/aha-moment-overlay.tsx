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
