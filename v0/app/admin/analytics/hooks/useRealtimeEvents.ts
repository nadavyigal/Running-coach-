'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export interface RealtimeAnalyticsEvent {
  id: string
  event_name: string
  user_id: string | null
  session_id: string | null
  properties: Record<string, unknown>
  timestamp: string
  created_at: string
}

export interface UseRealtimeEventsOptions {
  limit?: number
  eventName?: string
}

export function useRealtimeEvents(options?: UseRealtimeEventsOptions) {
  const [events, setEvents] = useState<RealtimeAnalyticsEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to new events
    const channel = supabase
      .channel('analytics_events_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events'
        },
        (payload) => {
          const newEvent = payload.new as RealtimeAnalyticsEvent

          // Filter by event name if specified
          if (options?.eventName && newEvent.event_name !== options.eventName) {
            return
          }

          setEvents((prev) => [newEvent, ...prev].slice(0, options?.limit || 100))
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [options?.eventName, options?.limit])

  return { events, isConnected }
}
