import { ArrowRight, CalendarClock, Flag, Plus, Target, Trash2 } from "lucide-react"
import { statusChipVariants, profileCardVariants } from "@/components/profile/variants"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface PrimaryGoalCardProps {
  hasGoal: boolean
  goalTitle?: string
  goalDescription?: string
  goalTarget?: string
  progressValue: number
  trajectory?: string | null
  daysRemaining?: number | null
  deadlineLabel?: string | null
  coachGuidance: string
  onCreateGoal: () => void
  onOpenGoalSettings: () => void
  onViewPlan: () => void
  onDeleteGoal?: () => void
}

function getTrajectoryTone(trajectory?: string | null) {
  if (trajectory === "ahead" || trajectory === "on_track") return "active"
  if (trajectory === "behind") return "warning"
  return "neutral"
}

function formatTrajectoryLabel(trajectory?: string | null) {
  if (!trajectory) return "No trend yet"
  return trajectory.replace("_", " ")
}

export function PrimaryGoalCard({
  hasGoal,
  goalTitle,
  goalDescription,
  goalTarget,
  progressValue,
  trajectory,
  daysRemaining,
  deadlineLabel,
  coachGuidance,
  onCreateGoal,
  onOpenGoalSettings,
  onViewPlan,
  onDeleteGoal,
}: PrimaryGoalCardProps) {
  if (!hasGoal) {
    return (
      <section aria-labelledby="goal-heading" className={cn(profileCardVariants({ tone: "primary" }), "p-5")}>
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 id="goal-heading" className="text-lg font-semibold">
            Current Goal
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No active goal yet. Set a target to unlock tailored plans, momentum tracking, and coaching suggestions.
        </p>
        <div className="mt-4">
          <Button onClick={onCreateGoal} className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Create First Goal
          </Button>
        </div>
      </section>
    )
  }

  const clampedProgress = Math.max(0, Math.min(100, progressValue))
  const progressDegrees = `${Math.round(clampedProgress * 3.6)}deg`

  return (
    <section aria-labelledby="goal-heading" className={cn(profileCardVariants({ tone: "primary" }), "p-5 md:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 id="goal-heading" className="text-lg font-semibold">
              Current Goal
            </h2>
          </div>
          <h3 className="text-xl font-bold leading-tight">{goalTitle}</h3>
          {goalTarget ? <p className="text-sm text-primary">{goalTarget}</p> : null}
          {goalDescription ? <p className="text-sm text-muted-foreground">{goalDescription}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {onDeleteGoal ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-600"
              onClick={onDeleteGoal}
              aria-label="Delete primary goal"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <div
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{
              background: `conic-gradient(oklch(var(--primary)) ${progressDegrees}, oklch(var(--muted)) 0)`,
            }}
            aria-hidden
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-card text-xs font-bold">{Math.round(clampedProgress)}%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border bg-[oklch(var(--surface-2))] p-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Timeline
          </div>
          <p className="text-sm font-medium">{daysRemaining != null ? `${daysRemaining} days left` : "No deadline set"}</p>
          {deadlineLabel ? <p className="text-xs text-muted-foreground">{deadlineLabel}</p> : null}
        </div>
        <div className="rounded-xl border bg-[oklch(var(--surface-2))] p-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Flag className="h-3.5 w-3.5" />
            Trajectory
          </div>
          <span className={statusChipVariants({ tone: getTrajectoryTone(trajectory) })}>{formatTrajectoryLabel(trajectory)}</span>
        </div>
        <div className="rounded-xl border bg-[oklch(var(--surface-2))] p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coach Guidance</p>
          <p className="text-sm font-medium leading-snug">{coachGuidance}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Goal progress</span>
          <span className="font-semibold">{Math.round(clampedProgress)}%</span>
        </div>
        <Progress value={clampedProgress} className="h-2 motion-safe:animate-in motion-safe:fade-in" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="h-9 gap-2" onClick={onViewPlan}>
          View Plan
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="h-9 gap-2" onClick={onOpenGoalSettings}>
          Goal Settings
        </Button>
      </div>
    </section>
  )
}
