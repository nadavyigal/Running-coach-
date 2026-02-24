"use client"

import { SyncStatus } from "@/components/garmin/SyncStatus"

export default function GarminSyncStatusDebugPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Garmin Sync Status Debug</h1>
      <SyncStatus userId={42} />
    </main>
  )
}

