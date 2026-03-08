import { CalendarPlus, ArrowRight, Flame, Snowflake, Target } from 'lucide-react'

export interface StructuredWorkout {
  sessionType: string
  warmup: string
  main: string
  cooldown: string
  totalDurationMin?: number
  targetEffort?: string
  coachingCue?: string
}

interface StructuredWorkoutCardProps {
  workout: StructuredWorkout
  variant?: 'garmin' | 'light'
  onSaveToPlan?: () => void
}

const EFFORT_COLORS: Record<string, { pill: string; icon: typeof Flame }> = {
  easy: { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: Snowflake },
  moderate: { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Flame },
  hard: { pill: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: Flame },
}

type PhaseConf = { label: string; borderColor: string; dotColor: string }

const PHASE_CONFIG: PhaseConf[] = [
  { label: 'Warmup', borderColor: 'border-emerald-500/40', dotColor: 'bg-emerald-500' },
  { label: 'Main', borderColor: 'border-amber-500/40', dotColor: 'bg-amber-500' },
  { label: 'Cooldown', borderColor: 'border-sky-500/40', dotColor: 'bg-sky-500' },
]

const PHASE_FALLBACK: PhaseConf = { label: 'Phase', borderColor: 'border-white/20', dotColor: 'bg-white/40' }

function getPhaseConfig(i: number): PhaseConf {
  return PHASE_CONFIG[i] ?? PHASE_FALLBACK
}

export function StructuredWorkoutCard({ workout, variant = 'light', onSaveToPlan }: StructuredWorkoutCardProps) {
  const effortKey = (workout.targetEffort ?? '').toLowerCase()
  const effortConfig = EFFORT_COLORS[effortKey]

  if (variant === 'garmin') {
    return (
      <div className="mx-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#40DCBE]/70 mb-1">
              Next Workout
            </div>
            <h3 className="text-lg font-black text-white">{workout.sessionType}</h3>
          </div>
          <div className="flex items-center gap-2">
            {workout.totalDurationMin && (
              <span className="text-xs font-bold text-white/40 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                {workout.totalDurationMin} min
              </span>
            )}
            {effortConfig && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${effortConfig.pill}`}>
                {effortKey.charAt(0).toUpperCase() + effortKey.slice(1)}
              </span>
            )}
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-3 mb-4">
          {[workout.warmup, workout.main, workout.cooldown].map((text, i) => {
            const config = getPhaseConfig(i)
            return (
              <div key={i} className={`border-l-2 ${config.borderColor} pl-3.5`}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                  {config.label}
                </span>
                <p className="text-sm text-white/75 leading-relaxed">{text}</p>
              </div>
            )
          })}
        </div>

        {/* Coaching cue */}
        {workout.coachingCue && (
          <div className="flex items-start gap-2 mb-4 bg-[#40DCBE]/5 border border-[#40DCBE]/10 rounded-xl p-3">
            <Target className="w-3.5 h-3.5 text-[#40DCBE] flex-none mt-0.5" />
            <p className="text-xs text-[#40DCBE]/80 italic leading-relaxed">{workout.coachingCue}</p>
          </div>
        )}

        {/* Save button */}
        {onSaveToPlan && (
          <button
            onClick={onSaveToPlan}
            className="w-full flex items-center justify-center gap-2 bg-[#40DCBE]/10 hover:bg-[#40DCBE]/20 border border-[#40DCBE]/20 text-[#40DCBE] font-bold text-sm py-2.5 rounded-xl transition-all group"
          >
            <CalendarPlus className="w-4 h-4" />
            Save to Plan
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
          </button>
        )}
      </div>
    )
  }

  // Light variant
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
            Next Workout
          </div>
          <h3 className="text-lg font-bold">{workout.sessionType}</h3>
        </div>
        <div className="flex items-center gap-2">
          {workout.totalDurationMin && (
            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1">
              {workout.totalDurationMin} min
            </span>
          )}
          {workout.targetEffort && (
            <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 capitalize">
              {workout.targetEffort}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {[workout.warmup, workout.main, workout.cooldown].map((text, i) => {
          const config = getPhaseConfig(i)
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`flex-none w-2 h-2 rounded-full ${config.dotColor} mt-1.5`} />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </span>
                <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
              </div>
            </div>
          )
        })}
      </div>

      {workout.coachingCue && (
        <div className="flex items-start gap-2 mb-4 bg-primary/5 border border-primary/10 rounded-xl p-3">
          <Target className="w-3.5 h-3.5 text-primary flex-none mt-0.5" />
          <p className="text-xs text-primary/70 italic leading-relaxed">{workout.coachingCue}</p>
        </div>
      )}

      {onSaveToPlan && (
        <button
          onClick={onSaveToPlan}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all group"
        >
          <CalendarPlus className="w-4 h-4" />
          Save to Plan
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
        </button>
      )}
    </div>
  )
}
