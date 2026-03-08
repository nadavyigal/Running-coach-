'use client'

import { useState } from 'react'
import { Droplets, Utensils, Moon, Battery, ChevronDown, ChevronUp } from 'lucide-react'

export interface DetailedRecovery {
  immediate: string
  next2h: string
  next24h: string
  next48h?: string
  readinessEstimate?: string
}

interface RecoveryTimelineProps {
  recovery: DetailedRecovery
  variant?: 'garmin' | 'light'
}

const PHASE_ICONS = [Droplets, Utensils, Moon, Battery] as const

type PhaseIcon = typeof PHASE_ICONS[number]
function getPhaseIcon(i: number): PhaseIcon { return PHASE_ICONS[i] ?? Droplets }

function getPhaseConfig(index: number, dark: boolean): { label: string; color: string; bgClass: string } {
  const configs = [
    { label: 'Now', color: dark ? '#40DCBE' : '#10b981', bgClass: dark ? 'bg-[#40DCBE]/15' : 'bg-emerald-500/10' },
    { label: '2 Hours', color: dark ? '#38bdf8' : '#3b82f6', bgClass: dark ? 'bg-sky-500/15' : 'bg-blue-500/10' },
    { label: '24 Hours', color: dark ? '#a78bfa' : '#8b5cf6', bgClass: dark ? 'bg-violet-500/15' : 'bg-violet-500/10' },
    { label: '48 Hours', color: dark ? '#f472b6' : '#ec4899', bgClass: dark ? 'bg-pink-500/15' : 'bg-pink-500/10' },
  ] as const
  return configs[index] ?? configs[0]!
}

export function RecoveryTimeline({ recovery, variant = 'light' }: RecoveryTimelineProps) {
  const [expanded, setExpanded] = useState(false)
  const dark = variant === 'garmin'

  const phases = [
    recovery.immediate,
    recovery.next2h,
    recovery.next24h,
    ...(recovery.next48h ? [recovery.next48h] : []),
  ]

  const visiblePhases = expanded ? phases : phases.slice(0, 1)

  if (dark) {
    return (
      <div className="mx-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-[#40DCBE]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#40DCBE]/70">
              Recovery Plan
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-semibold text-white/25 hover:text-white/50 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            {expanded ? 'Less' : 'Full Plan'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="relative">
          {/* Connecting line */}
          {visiblePhases.length > 1 && (
            <div
              className="absolute left-[15px] top-[30px] w-0.5 rounded-full"
              style={{
                height: `calc(100% - 40px)`,
                background: 'linear-gradient(to bottom, #40DCBE, #a78bfa, #f472b6)',
                opacity: 0.3,
              }}
            />
          )}

          <div className="space-y-4">
            {visiblePhases.map((text, i) => {
              const config = getPhaseConfig(i, true)
              const Icon = getPhaseIcon(i)
              return (
                <div key={i} className="flex items-start gap-3 relative">
                  <div
                    className="flex-none w-[30px] h-[30px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    <p className="text-sm text-white/70 leading-relaxed mt-0.5">{text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {recovery.readinessEstimate && expanded && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[11px] text-white/40 italic">{recovery.readinessEstimate}</p>
          </div>
        )}
      </div>
    )
  }

  // Light variant
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-primary" />
          <span className="font-bold text-base">Recovery Plan</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
        >
          {expanded ? 'Less' : 'Full Plan'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="relative">
        {visiblePhases.length > 1 && (
          <div
            className="absolute left-[15px] top-[30px] w-0.5 bg-gradient-to-b from-emerald-500/30 via-blue-500/30 to-violet-500/30 rounded-full"
            style={{ height: `calc(100% - 40px)` }}
          />
        )}

        <div className="space-y-4">
          {visiblePhases.map((text, i) => {
            const config = getPhaseConfig(i, false)
            const Icon = PHASE_ICONS[i] ?? PHASE_ICONS[0]
            return (
              <div key={i} className="flex items-start gap-3 relative">
                <div className={`flex-none w-[30px] h-[30px] rounded-full flex items-center justify-center ${config.bgClass}`}>
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                </div>
                <div className="flex-1 pt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {config.label}
                  </span>
                  <p className="text-sm text-foreground/70 leading-relaxed mt-0.5">{text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {recovery.readinessEstimate && expanded && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground italic">{recovery.readinessEstimate}</p>
        </div>
      )}
    </div>
  )
}
