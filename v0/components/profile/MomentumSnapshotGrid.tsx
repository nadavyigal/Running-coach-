import { Activity, CalendarCheck2, Flame, Route, TrendingUp } from "lucide-react"
import { ProfileStatCard } from "@/components/profile/ProfileStatCard"

export interface MomentumSnapshotGridProps {
  weeklyDistanceKm: number
  weeklyRuns: number
  totalRuns: number
  totalDistanceKm: number
  consistencyScore: number
  streakDays?: number
  distanceSparkline?: number[]
}

export function MomentumSnapshotGrid({
  weeklyDistanceKm,
  weeklyRuns,
  totalRuns,
  totalDistanceKm,
  consistencyScore,
  streakDays = 0,
  distanceSparkline,
}: MomentumSnapshotGridProps) {
  return (
    <section aria-labelledby="momentum-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="momentum-heading" className="text-lg font-semibold">
            Momentum Snapshot
          </h2>
          <p className="text-sm text-muted-foreground">How your training trend looks right now.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <ProfileStatCard
          icon={Route}
          label="Weekly Distance"
          value={`${weeklyDistanceKm.toFixed(1)} km`}
          helper="Last 7 days"
          tone="positive"
          sparkline={distanceSparkline}
        />
        <ProfileStatCard
          icon={CalendarCheck2}
          label="Weekly Runs"
          value={`${weeklyRuns}`}
          helper={weeklyRuns >= 3 ? "Habit on track" : "Add one more run"}
          tone={weeklyRuns >= 3 ? "positive" : "neutral"}
        />
        <ProfileStatCard
          icon={Activity}
          label="Consistency"
          value={`${Math.round(consistencyScore)}%`}
          helper="Planned workouts completed"
          tone={consistencyScore >= 70 ? "positive" : "warning"}
        />
        <ProfileStatCard
          icon={TrendingUp}
          label="Total Runs"
          value={`${totalRuns}`}
          helper="All-time completion"
        />
        <ProfileStatCard
          icon={Flame}
          label="Momentum Streak"
          value={`${streakDays} days`}
          helper={streakDays > 0 ? "Keep the chain alive" : "Start your first streak"}
          tone={streakDays > 0 ? "positive" : "neutral"}
        />
        <ProfileStatCard
          icon={Route}
          label="Total Distance"
          value={`${totalDistanceKm.toFixed(1)} km`}
          helper="All-time volume"
        />
      </div>
    </section>
  )
}
