'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      
      // Only initialize PostHog if API key is provided
      if (apiKey && apiKey.trim() !== '') {
        posthog.init(apiKey, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          person_profiles: 'identified_only',
          loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('PostHog initialized')
            }
          }
        })
      } else if (process.env.NODE_ENV === 'development') {
        console.log('PostHog API key not provided - analytics disabled')
      }
    }
  }, [])

  return <>{children}</>
}