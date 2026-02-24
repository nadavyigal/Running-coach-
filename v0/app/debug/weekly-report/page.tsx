'use client'

import { WeeklyReportCard } from '@/components/insights/WeeklyReportCard'

export default function WeeklyReportDebugPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Weekly Report Debug</h1>
      <WeeklyReportCard userId={42} />
    </main>
  )
}
