'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { syncGarminEnabledData } from '@/lib/garminSync'
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
      console.warn(
        '[useGarminRealtime] Skipping realtime subscription due to unsupported browser context',
        {
          hasWebSocket,
          secureEnough,
          hasMixedContentRisk,
          protocol: window.location.protocol,
        }
      )
      return
    }

    let supabase: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    try {
      supabase = createClient()
      channel = supabase
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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useGarminRealtime] Supabase realtime channel error')
          }
        })
    } catch (error) {
      console.warn('[useGarminRealtime] Failed to initialize realtime subscription:', error)
      return
    }

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [toast, userId])
}

