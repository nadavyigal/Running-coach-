'use client'

import { InsightsPanelsDashboard } from '@/components/insights/panels/InsightsPanelsDashboard'

export default function GroupBDashboardDebugPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Group B Dashboard Debug</h1>
      <InsightsPanelsDashboard
        userId={42}
        runsCompleted={3}
        plannedRuns={4}
        consistencyRate={75}
        goalProgress={48}
        goalTrajectory="on_track"
      />
    </main>
  )
}
