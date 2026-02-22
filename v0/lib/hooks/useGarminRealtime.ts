'use client'

import { useEffect, useRef } from 'react'

import { useToast } from '@/hooks/use-toast'
import { syncGarminEnabledData } from '@/lib/garminSync'
import { createClient } from '@/lib/supabase/client'

export function useGarminRealtime(userId: number | null) {
  const { toast } = useToast()
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel('garmin-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'garmin_activities',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          if (syncInFlightRef.current) return

          syncInFlightRef.current = true
          try {
            await syncGarminEnabledData(userId)
            toast({
              title: 'New Garmin run synced',
              description: 'Your latest activity is now in RunSmart.',
            })
            window.dispatchEvent(new Event('garmin-run-synced'))
          } catch (error) {
            console.warn('[useGarminRealtime] Failed to sync Garmin activity:', error)
          } finally {
            syncInFlightRef.current = false
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [toast, userId])
}

