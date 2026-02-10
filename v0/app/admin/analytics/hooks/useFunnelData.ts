'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface FunnelStep {
  step: string
  stepName: string
  users: number
  conversion: number
  dropOff: number
}

export interface FunnelData {
  steps: FunnelStep[]
  totalStarted: number
  totalCompleted: number
  overallConversion: number
}

export type FunnelType = 'activation' | 'challenge' | 'retention'

const FUNNEL_STEPS: Record<FunnelType, { event: string; name: string }[]> = {
  activation: [
    { event: 'signup_completed', name: 'Signed Up' },
    { event: 'onboarding_completed', name: 'Completed Onboarding' },
    { event: 'plan_generated', name: 'Generated Plan' },
    { event: 'first_run_recorded', name: 'First Run' },
  ],
  challenge: [
    { event: 'challenge_registered', name: 'Registered' },
    { event: 'challenge_day_started', name: 'Started Day 1' },
    { event: 'challenge_day_completed', name: 'Completed Day 1' },
    { event: 'challenge_completed', name: 'Finished Challenge' },
  ],
  retention: [
    { event: 'app_opened', name: 'Opened App' },
    { event: 'workout_viewed', name: 'Viewed Workout' },
    { event: 'run_started', name: 'Started Run' },
    { event: 'run_completed', name: 'Completed Run' },
  ],
}

export function useFunnelData(funnelType: FunnelType, days: number = 30) {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFunnelData() {
      try {
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const steps = FUNNEL_STEPS[funnelType]
        const startDate = new Date(Date.now() - days * 86400000).toISOString()

        // Fetch unique user counts for each step
        const results = await Promise.all(
          steps.map(async ({ event }) => {
            const { data, error } = await supabase
              .from('analytics_events')
              .select('user_id')
              .eq('event_name', event)
              .gte('timestamp', startDate)

            if (error) throw error

            // Count unique users
            const uniqueUsers = new Set(data?.map((row) => row.user_id).filter(Boolean))
            return uniqueUsers.size
          })
        )

        const totalStarted = results[0] || 0

        // Calculate funnel steps with conversion rates
        const funnelSteps: FunnelStep[] = steps.map(({ event, name }, index) => {
          const users = results[index] || 0
          const prevUsers = index > 0 ? results[index - 1] || 1 : totalStarted || 1
          const conversion = totalStarted > 0 ? (users / totalStarted) * 100 : 0
          const stepConversion = prevUsers > 0 ? (users / prevUsers) * 100 : 0
          const dropOff = 100 - stepConversion

          return {
            step: event,
            stepName: name,
            users,
            conversion: Math.round(conversion * 10) / 10,
            dropOff: Math.round(dropOff * 10) / 10,
          }
        })

        const totalCompleted = results[results.length - 1] || 0
        const overallConversion =
          totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0

        setData({
          steps: funnelSteps,
          totalStarted,
          totalCompleted,
          overallConversion: Math.round(overallConversion * 10) / 10,
        })
      } catch (err) {
        console.error('[useFunnelData] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch funnel data')
      } finally {
        setLoading(false)
      }
    }

    fetchFunnelData()
  }, [funnelType, days])

  return { data, loading, error }
}
