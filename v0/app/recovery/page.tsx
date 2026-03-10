import type { Metadata } from "next"
import RecoveryDashboard from "@/components/recovery-dashboard"

export const metadata: Metadata = {
  title: "Recovery Dashboard | RunSmart",
  description: "Track your recovery score, sleep quality, HRV, and wellness data to optimize your training.",
}

export default function RecoveryPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <RecoveryDashboard />
    </main>
  )
}
