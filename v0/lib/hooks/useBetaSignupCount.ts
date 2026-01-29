import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SIGNUP_LIMIT = 500
const FALLBACK_COUNT = 200 // Fallback if Supabase fails

/**
 * Hook to fetch real-time beta signup count from Supabase
 * Returns count and loading state
 */
export function useBetaSignupCount() {
  const [count, setCount] = useState<number>(FALLBACK_COUNT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
          console.warn('Supabase not configured, using fallback count')
          setCount(FALLBACK_COUNT)
          setLoading(false)
          return
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Count beta signups
        const { count: signupCount, error: countError } = await supabase
          .from('beta_signups')
          .select('*', { count: 'exact', head: true })

        if (countError) {
          throw countError
        }

        setCount(signupCount || FALLBACK_COUNT)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch beta signup count:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setCount(FALLBACK_COUNT) // Use fallback on error
      } finally {
        setLoading(false)
      }
    }

    fetchCount()

    // Optionally refetch every 5 minutes to keep count fresh
    const interval = setInterval(fetchCount, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    count,
    loading,
    error,
    spotsRemaining: Math.max(0, SIGNUP_LIMIT - count),
    percentFilled: Math.min(100, Math.round((count / SIGNUP_LIMIT) * 100)),
    isNearCapacity: count >= SIGNUP_LIMIT * 0.9, // 90% full
  }
}
