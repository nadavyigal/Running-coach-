'use client'


import { useEffect } from 'react'
import { logger } from '@/lib/logger'

const POSTHOG_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/posthog-js@1.257.0/dist/posthog.min.js'
const POSTHOG_SCRIPT_ID = 'posthog-js-script'
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

type PosthogInstance = {
  init: (apiKey: string, config?: Record<string, unknown>) => void
  capture?: (eventName: string, properties?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    posthog?: PosthogInstance
  }
}

let posthogInitialized = false
let scriptLoadingPromise: Promise<PosthogInstance | undefined> | null = null

const loadPosthogLibrary = async (): Promise<PosthogInstance | undefined> => {
  if (typeof window === 'undefined') {
    return undefined
  }

  if (window.posthog) {
    return window.posthog
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise
  }

  scriptLoadingPromise = new Promise<PosthogInstance | undefined>((resolve, reject) => {
    const existingScript = document.getElementById(POSTHOG_SCRIPT_ID) as HTMLScriptElement | null

    if (existingScript) {
      if (window.posthog) {
        resolve(window.posthog)
        return
      }

      existingScript.addEventListener('load', () => resolve(window.posthog))
      existingScript.addEventListener('error', (error) => reject(new Error('Failed to load PostHog script')))
      return
    }

    const script = document.createElement('script')
    script.id = POSTHOG_SCRIPT_ID
    script.src = POSTHOG_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.posthog)
    script.onerror = (event) => reject(new Error('Failed to load PostHog script'))
    document.head.appendChild(script)
  }).catch((error) => {
    logger.error('Unable to load PostHog script:', error)
    scriptLoadingPromise = null
    return undefined
  })

  return scriptLoadingPromise
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initialize = async () => {
      if (typeof window === 'undefined') {
        return
      }

      if (posthogInitialized) return

      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
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
