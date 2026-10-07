'use client'

import { useEffect } from 'react'
import { onPosthogLoaded } from '@/lib/analytics-identity'
import { logger } from '@/lib/logger'
import {
  resolvePosthogHost,
  resolvePublicPosthogKey,
  warnMissingPosthogKey,
} from '@/lib/posthog-config'

const API_HOST = resolvePosthogHost()

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

      const apiKey = resolvePublicPosthogKey()
      if (!apiKey) {
        warnMissingPosthogKey('client')
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
          loaded: (instance: PosthogInstance) => {
            posthogInitialized = true
            onPosthogLoaded(instance)
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
