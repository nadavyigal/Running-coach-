'use client'

import { WeeklyReportCard } from '@/components/insights/WeeklyReportCard'
import { useData } from '@/contexts/DataContext'

export default function WeeklyInsightsPage() {
  const { userId } = useData()

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 p-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Insights</p>
        <h1 className="text-2xl font-semibold">Weekly Report</h1>
      </header>

      {userId ? (
        <WeeklyReportCard userId={userId} />
      ) : (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">Sign in to view weekly insights.</div>
      )}
    </main>
  )
}
