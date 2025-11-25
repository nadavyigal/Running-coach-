'use client'

import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Defer PostHog loading until page is interactive (performance optimization)
    const initPostHog = async () => {
      if (typeof window === 'undefined') return

      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY

      // Only initialize PostHog if API key is provided
      if (apiKey && apiKey.trim() !== '') {
        // Wait for page to be fully interactive before loading analytics
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => loadPostHog(apiKey), { timeout: 2000 })
        } else {
          setTimeout(() => loadPostHog(apiKey), 1000)
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log('PostHog API key not provided - analytics disabled')
      }
    }

    const loadPostHog = async (apiKey: string) => {
      try {
        // Dynamic import to reduce initial bundle size
        const posthog = (await import('posthog-js')).default

        posthog.init(apiKey, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          person_profiles: 'identified_only',
          loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('PostHog initialized (deferred)')
            }
          }
        })
      } catch (error) {
        console.error('Failed to load PostHog:', error)
      }
    }

    initPostHog()
  }, [])

  return <>{children}</>
}