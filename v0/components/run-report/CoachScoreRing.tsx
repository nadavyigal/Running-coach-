'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'

export interface CoachScore {
  overall: number
  execution?: number
  effort?: number
  consistency?: number
  form?: number
}

interface CoachScoreRingProps {
  score: CoachScore
  variant?: 'garmin' | 'light'
}

function getScoreColor(score: number): { stroke: string; text: string; bg: string } {
  if (score >= 80) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10' }
  return { stroke: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500/10' }
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Great'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Needs Work'
}

const SUB_CATEGORIES: { key: keyof Omit<CoachScore, 'overall'>; label: string }[] = [
  { key: 'execution', label: 'Execution' },
  { key: 'effort', label: 'Effort' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'form', label: 'Form' },
]

export function CoachScoreRing({ score, variant = 'light' }: CoachScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score.overall), 100)
    return () => clearTimeout(timer)
  }, [score.overall])

  const { stroke, text } = getScoreColor(score.overall)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (animatedScore / 100) * circumference

  const subScores = SUB_CATEGORIES.filter(c => score[c.key] != null)

  if (variant === 'garmin') {
    return (
      <div className="mx-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-[#40DCBE]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#40DCBE]/70">
            Run Score
          </span>
        </div>

        <div className="flex items-center gap-6">
          {/* Score Ring */}
          <div className="relative flex-none w-[120px] h-[120px]">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke={stroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black tabular-nums ${text}`}>
                {Math.round(animatedScore)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                {getScoreLabel(score.overall)}
              </span>
            </div>
          </div>

          {/* Sub-scores */}
          {subScores.length > 0 && (
            <div className="flex-1 space-y-2.5">
              {subScores.map(({ key, label }) => {
                const val = score[key]!
                const barColor = getScoreColor(val)
                return (
                  <div key={key}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</span>
                      <span className="text-[10px] font-bold text-white/50 tabular-nums">{Math.round(val)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${val}%`, backgroundColor: barColor.stroke }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Light variant
  const lightColor = getScoreColor(score.overall)
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-primary" />
        <span className="font-bold text-base">Run Score</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative flex-none w-[100px] h-[100px]">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={lightColor.stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black tabular-nums">
              {Math.round(animatedScore)}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {getScoreLabel(score.overall)}
            </span>
          </div>
        </div>

        {subScores.length > 0 && (
          <div className="flex-1 space-y-2">
            {subScores.map(({ key, label }) => {
              const val = score[key]!
              const barColor = getScoreColor(val)
              return (
                <div key={key}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                    <span className="text-[10px] font-bold tabular-nums">{Math.round(val)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${val}%`, backgroundColor: barColor.stroke }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
