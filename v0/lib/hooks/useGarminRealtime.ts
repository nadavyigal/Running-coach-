'use client'

import { useEffect, useRef } from 'react'

import { useToast } from '@/hooks/use-toast'
import { syncGarminRunsToClient } from '@/lib/garmin/client-sync'
import { createClient } from '@/lib/supabase/client'

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function useGarminRealtime(userId: number | null) {
  const { toast } = useToast()
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const hostname = window.location.hostname
    const hasWebSocket = typeof window.WebSocket !== 'undefined'
    const secureEnough = window.isSecureContext || isLocalDevelopmentHost(hostname)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const hasMixedContentRisk = window.location.protocol === 'https:' && /^http:\/\//i.test(supabaseUrl)

    if (!hasWebSocket || !secureEnough || hasMixedContentRisk) {
      console.warn('[useGarminRealtime] Skipping realtime subscription due to unsupported browser context')
      return
    }

    let supabase: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    const refreshFromServer = async () => {
      if (syncInFlightRef.current) return

      syncInFlightRef.current = true
      try {
        const { imported } = await syncGarminRunsToClient(userId)
        if (imported > 0) {
          toast({
            title: 'New Garmin run synced',
            description: 'Your latest Garmin Connect activity is now in RunSmart.',
          })
        }
      } catch (error) {
        console.warn('[useGarminRealtime] Failed to refresh Garmin runs from Supabase:', error)
      } finally {
        syncInFlightRef.current = false
      }
    }

    try {
      supabase = createClient()
      channel = supabase
        .channel('garmin-runs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'runs',
            filter: 'source_provider=eq.garmin',
          },
          async () => {
            await refreshFromServer()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'garmin_connections',
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            await refreshFromServer()
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useGarminRealtime] Supabase realtime channel error')
          }
        })
    } catch (error) {
      console.warn('[useGarminRealtime] Failed to initialize realtime subscription:', error)
      return
    }

    void refreshFromServer()

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [toast, userId])
}
