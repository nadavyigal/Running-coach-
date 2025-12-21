'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  isChunkError?: boolean
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')

    // Always render a fallback when a descendant throws; chunk errors get special auto-reload handling.
    return { hasError: true, error, isChunkError }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo)
    
    // If it's a chunk loading error, try to reload the page with cache-busting
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      console.log('Detected chunk loading error, attempting to reload...')
      
      // Wait a bit before reloading to avoid infinite loops
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
          if (reloadCount < 2) {
            sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
            const url = new URL(window.location.href)
            url.searchParams.set('cb', Date.now().toString())
            window.location.replace(url.toString())
          } else {
            // Give user a manual option after two attempts
            console.warn('Chunk reload attempts exceeded. Showing fallback UI.')
          }
        }
      }, 2000)
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback for chunk loading errors
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isChunkError = this.state.isChunkError
      const errorMessage = this.state.error?.message ?? 'Unknown error'

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8 max-w-md space-y-4">
            <div className="mb-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isChunkError ? 'Loading Error' : 'Application Error'}
            </h2>
            <p className="text-gray-600">
              {isChunkError
                ? 'There was an issue loading the application. The page will reload automatically in a few seconds.'
                : 'Something went wrong while rendering this screen. You can reload, or return to Today.'}
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Reload
              </button>
              {!isChunkError && (
                <button
                  onClick={() => {
                    try {
                      sessionStorage.setItem('last-screen', 'today')
                    } catch {
                      // ignore
                    }
                    window.location.href = '/today?screen=today'
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Go to Today
                </button>
              )}
            </div>

            <details className="text-left">
              <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
              <pre className="text-xs bg-gray-100 p-3 mt-2 rounded border overflow-auto">{errorMessage}</pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook to handle chunk loading errors
export function useChunkErrorHandler() {
  React.useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      if (event.error && event.error.message && 
          (event.error.message.includes('ChunkLoadError') || 
           event.error.message.includes('Loading chunk'))) {
        console.log('Chunk loading error detected, reloading page...')
        setTimeout(() => {
          const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
          if (reloadCount < 2) {
            sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
            const url = new URL(window.location.href)
            url.searchParams.set('cb', Date.now().toString())
            window.location.replace(url.toString())
          }
        }, 2000)
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = (event.reason && (event.reason.message || event.reason.toString())) || ''
      if (typeof reason === 'string' && (reason.includes('ChunkLoadError') || reason.includes('Loading chunk'))) {
        console.log('Unhandled rejection due to chunk error, reloading...')
        const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
        if (reloadCount < 2) {
          sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
          const url = new URL(window.location.href)
          url.searchParams.set('cb', Date.now().toString())
          window.location.replace(url.toString())
        }
      }
    }

    window.addEventListener('error', handleChunkError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    return () => {
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
} 
