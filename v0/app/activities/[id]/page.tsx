'use client'

import Link from 'next/link'

import { PostRunRecap } from '@/components/insights/PostRunRecap'
import { useData } from '@/contexts/DataContext'

export default function ActivityDetailPage({ params }: { params: { id: string } }) {
  const { userId } = useData()

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 p-4">
      <div className="text-sm">
        <Link href="/today" className="text-blue-600 hover:underline">
          Back to today
        </Link>
      </div>

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity</p>
        <h1 className="text-2xl font-semibold">{params.id}</h1>
      </header>

      {userId ? (
        <PostRunRecap userId={userId} activityId={params.id} />
      ) : (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">Sign in to view activity recap.</div>
      )}
    </main>
  )
}
