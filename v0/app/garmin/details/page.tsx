'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { GarminSyncPanel } from '@/components/garmin-sync-panel'
import { GarminReadinessCard } from '@/components/garmin-readiness-card'
import { PerformanceManagementChart } from '@/components/performance-management-chart'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/components/ui/use-toast'

export default function GarminDetailsPage() {
  const router = useRouter()
  const { userId } = useData()
  const { toast } = useToast()

  const handleReconnect = async () => {
    if (!userId) return
    try {
      const response = await fetch('/api/devices/garmin/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify({
          userId,
          redirectUri: `${window.location.origin}/garmin/callback`,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success || !data?.authUrl) {
        throw new Error(data?.error || 'Failed to initiate Garmin reconnect')
      }
      window.location.href = data.authUrl
    } catch (err) {
      console.error('Garmin reconnect failed:', err)
      toast({
        title: 'Reconnect failed',
        description: 'Could not start Garmin reconnect. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 backdrop-blur border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Garmin Details</h1>
      </div>
      <div className="p-4 space-y-4">
        {userId ? (
          <>
            <GarminReadinessCard userId={userId} />
            <PerformanceManagementChart userId={userId} days={90} />
            <GarminSyncPanel
              userId={userId}
              onReconnect={() => void handleReconnect()}
            />
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p>Sign in to view Garmin details.</p>
          </div>
        )}
      </div>
    </div>
  )
}
