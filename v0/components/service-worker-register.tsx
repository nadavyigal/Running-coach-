'use client'

import { useEffect } from 'react'

/**
 * Registers service worker for PWA functionality and caching
 * Improves performance by caching static assets
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register service worker in production and if supported
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      // Register service worker after page load to avoid blocking
      window.addEventListener('load', () => {
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
      })
    }
  }, [])

  return null // This component doesn't render anything
}
