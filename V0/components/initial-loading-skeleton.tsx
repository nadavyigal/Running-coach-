'use client'

import { useEffect, useState } from 'react'

/**
 * Initial loading skeleton that appears immediately on page load
 * Improves perceived performance by showing content structure while app loads
 * Automatically hides after React hydration to prevent blocking onboarding
 */
export function InitialLoadingSkeleton() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Hide skeleton quickly after React hydrates
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 50) // Minimal delay for faster transition

    return () => clearTimeout(timer)
  }, [])

  // Don't render skeleton after it's been hidden
  if (!isVisible) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-10 bg-white pointer-events-none"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 150ms ease-out',
        willChange: 'opacity'
      }}
    >
      {/* Simplified skeleton - no animations for better performance */}
      <div className="h-16 bg-gray-50 border-b border-gray-100 flex items-center px-4">
        <div className="h-6 w-24 bg-gray-200 rounded" />
      </div>

      <div className="p-4 space-y-3">
        <div className="h-6 w-40 bg-gray-200 rounded" />

        <div className="space-y-2">
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="h-14 bg-gray-100 rounded-lg" />
          <div className="h-14 bg-gray-100 rounded-lg" />
          <div className="h-14 bg-gray-100 rounded-lg" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gray-50 border-t border-gray-100 flex items-center justify-around">
        <div className="h-6 w-6 bg-gray-200 rounded-full" />
        <div className="h-6 w-6 bg-gray-200 rounded-full" />
        <div className="h-10 w-10 bg-gray-300 rounded-full" />
        <div className="h-6 w-6 bg-gray-200 rounded-full" />
        <div className="h-6 w-6 bg-gray-200 rounded-full" />
      </div>
    </div>
  )
}
