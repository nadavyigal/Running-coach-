'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a chunk loading error
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return { hasError: true, error }
    }
    return { hasError: false }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo)
    
    // If it's a chunk loading error, try to reload the page
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      console.log('Detected chunk loading error, attempting to reload...')
      
      // Wait a bit before reloading to avoid infinite loops
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload()
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

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Loading Error
            </h2>
            <p className="text-gray-600 mb-4">
              There was an issue loading the application. The page will reload automatically in a few seconds.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reload Now
            </button>
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
          window.location.reload()
        }, 2000)
      }
    }

    window.addEventListener('error', handleChunkError)
    
    return () => {
      window.removeEventListener('error', handleChunkError)
    }
  }, [])
} 