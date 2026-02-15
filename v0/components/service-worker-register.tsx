'use client'

import { useEffect } from 'react'
import { trackPWAInstallPromptShown, trackPWAInstalled } from '@/lib/analytics'

/**
 * Registers service worker for PWA functionality and caching
 * Improves performance by caching static assets
 * Also tracks PWA installation events for analytics
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register service worker in production and if supported
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered:', registration.scope)

            // Check for updates periodically
            setInterval(() => {
              registration.update()
            }, 60 * 60 * 1000) // Check every hour
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error)
          })
      }

      // If the load event already fired, register immediately.
      if (document.readyState === 'complete') {
        register()
        return
      }

      // Register service worker after page load to avoid blocking initial paint.
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }

    return undefined
  }, [])

  // Track PWA installation events
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let deferredPrompt: any = null

    // Track when browser shows install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()

      // Stash the event so it can be triggered later
      deferredPrompt = e

      // Track that the prompt was shown
      trackPWAInstallPromptShown({
        platform: (navigator as any).userAgentData?.platform || 'unknown',
        timing: 'auto',
      })

      console.log('PWA install prompt available')
    }

    // Track successful installation
    const handleAppInstalled = () => {
      console.log('PWA installed successfully')

      trackPWAInstalled({
        install_method: deferredPrompt ? 'browser_prompt' : 'share_menu',
        platform: (navigator as any).userAgentData?.platform || 'unknown',
      })

      // Clear the deferredPrompt
      deferredPrompt = null
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return null // This component doesn't render anything
}
