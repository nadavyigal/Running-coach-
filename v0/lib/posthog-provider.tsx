'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST

type PosthogInstance = NonNullable<Window['posthog']>

let posthogInitialized = false
let posthogLoadingPromise: Promise<PosthogInstance | undefined> | null = null

const loadPosthogLibrary = async (): Promise<PosthogInstance | undefined> => {
  if (typeof window === 'undefined') {
    return undefined
  }

  if (window.posthog) {
    return window.posthog
  }

  if (posthogLoadingPromise) {
    return posthogLoadingPromise
  }

  posthogLoadingPromise = import('posthog-js')
    .then((module) => {
      const posthog = module.default
      if (!window.posthog) {
        window.posthog = posthog
      }
      return posthog
    })
    .catch((error) => {
      logger.error('Unable to load PostHog library:', error)
      posthogLoadingPromise = null
      return undefined
    })

  return posthogLoadingPromise
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initialize = async () => {
      if (typeof window === 'undefined') {
        return
      }

      if (posthogInitialized) return

      const apiKey =
        process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_API_KEY
      if (!apiKey || apiKey.trim() === '') {
        if (process.env.NODE_ENV === 'development') {
          logger.info('PostHog API key not provided - analytics disabled')
        }
        return
      }

      const setup = async () => {
        const posthog = await loadPosthogLibrary()
        if (!posthog || posthogInitialized) {
          return
        }

        if (typeof posthog.init !== 'function') {
          logger.error('PostHog loaded but init is unavailable')
          return
        }

        posthog.init(apiKey, {
          api_host: API_HOST,
          person_profiles: 'identified_only',
          loaded: () => {
            posthogInitialized = true
            if (process.env.NODE_ENV === 'development') {
              logger.info('PostHog initialized (deferred)')
            }
          },
        })
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          setup().catch((error) => logger.error('Failed to initialize PostHog:', error))
        }, { timeout: 2000 })
      } else {
        setTimeout(() => {
          setup().catch((error) => logger.error('Failed to initialize PostHog:', error))
        }, 1000)
      }
    }

    initialize()
  }, [])

  return <>{children}</>
}
