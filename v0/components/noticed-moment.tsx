'use client'

import { useEffect } from 'react'
import {
  Calendar,
  Flame,
  Moon,
  RotateCcw,
  Share2,
  Sun,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackOnboardingEvent } from '@/lib/analytics'
import type { NoticeContext } from '@/lib/contextDetector'

interface NoticedMomentProps {
  context: NoticeContext
  onShare?: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getCopy(context: NoticeContext): { headline: string; subline: string } {
  switch (context.type) {
    case 'streak':
      if (context.days === 3) {
        return {
          headline: 'Three days straight.',
          subline: 'The streak has started. This is how habits form.',
        }
      }
      if (context.days === 7) {
        return {
          headline: 'Seven days in a row.',
          subline: "The streak everyone talks about — the one you almost didn't start.",
        }
      }
      if (context.days === 14) {
        return {
          headline: 'Two weeks straight.',
          subline: "You've been at this for two weeks. It's becoming who you are.",
        }
      }
      if (context.days === 30) {
        return {
          headline: 'Thirty days.',
          subline: "A month. Most people don't get here. You did.",
        }
      }
      return {
        headline: `${context.days} days in a row.`,
        subline: 'Consistency like this is rare. Keep showing up.',
      }
    case 'comeback':
      return {
        headline: "You're back.",
        subline: "Gaps aren't failures. Getting back out is what matters.",
      }
    case 'high_effort':
      return {
        headline: 'You pushed today.',
        subline: `You ran ${context.percentAbove}% faster than usual. That's not nothing.`,
      }
    case 'early_morning':
      return {
        headline: `${formatTime(context.startedAt)} run.`,
        subline: "Most of your city is still asleep. You're already done.",
      }
    case 'late_night':
      return {
        headline: `${formatTime(context.startedAt)} run.`,
        subline: 'Whatever was in the way — you went anyway.',
      }
    case 'third_run_week':
      return {
        headline: 'Three runs this week.',
        subline: "That's the habit. You're building it.",
      }
    default:
      return { headline: 'Nice work.', subline: 'We noticed.' }
  }
}

function getVisual(context: NoticeContext): { Icon: LucideIcon; accentClass: string } {
  switch (context.type) {
    case 'streak':
      return { Icon: Flame, accentClass: 'border-emerald-500 text-emerald-600' }
    case 'comeback':
      return { Icon: RotateCcw, accentClass: 'border-violet-500 text-violet-600' }
    case 'high_effort':
      return { Icon: Zap, accentClass: 'border-orange-500 text-orange-600' }
    case 'early_morning':
      return { Icon: Sun, accentClass: 'border-slate-500 text-slate-600' }
    case 'late_night':
      return { Icon: Moon, accentClass: 'border-slate-500 text-slate-600' }
    case 'third_run_week':
      return { Icon: Calendar, accentClass: 'border-emerald-500 text-emerald-600' }
    default:
      return { Icon: Flame, accentClass: 'border-emerald-500 text-emerald-600' }
  }
}

export function NoticedMoment({ context, onShare }: NoticedMomentProps) {
  const { headline, subline } = getCopy(context)
  const { Icon, accentClass } = getVisual(context)

  useEffect(() => {
    void trackOnboardingEvent('aha_moment_fired', {
      moment_id: 'noticed',
      context: context.type,
    })
  }, [context.type])

  const handleShare = () => {
    void trackOnboardingEvent('aha_moment_shared', {
      moment_id: 'noticed',
      context: context.type,
    })
    onShare?.()
  }

  return (
    <div
      data-testid="noticed-moment"
      className={cn('bg-card border-l-4 rounded-lg p-4 mx-4 relative', accentClass.split(' ')[0])}
    >
      <div className="flex items-start gap-3 pr-8">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', accentClass.split(' ')[1])} aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground leading-snug">{headline}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{subline}</p>
        </div>
      </div>
      {onShare && (
        <button
          type="button"
          data-testid="noticed-moment-share"
          onClick={handleShare}
          className="absolute bottom-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
