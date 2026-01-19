'use client'

import { useEffect, useState } from 'react'
import { SyncService } from '@/lib/sync/sync-service'
import { CheckCircle, RefreshCw, AlertCircle, Cloud, CloudOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

type SyncStatus = 'idle' | 'syncing' | 'error'

export function SyncStatusIndicator() {
  const { user, profileId } = useAuth()
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Poll sync service for status
  useEffect(() => {
    if (!user || !profileId) {
      return
    }

    const updateStatus = () => {
      const syncService = SyncService.getInstance()
      setStatus(syncService.getStatus())
      setLastSync(syncService.getLastSyncTime())
      setErrorMessage(syncService.getErrorMessage())
    }

    // Update immediately
    updateStatus()

    // Poll every second
    const interval = setInterval(updateStatus, 1000)

    return () => clearInterval(interval)
  }, [user, profileId])

  // Don't show if user is not authenticated
  if (!user || !profileId) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CloudOff className="h-3 w-3" />
        <span>Not syncing (sign in to enable)</span>
      </div>
    )
  }

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)

    if (diffSecs < 60) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'idle' && (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">Synced</span>
            <span className="text-xs text-muted-foreground">
              {formatLastSync(lastSync)}
            </span>
          </div>
        </>
      )}

      {status === 'syncing' && (
        <>
          <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">Syncing...</span>
            <span className="text-xs text-muted-foreground">Updating cloud data</span>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">Sync Error</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {errorMessage || 'Failed to sync'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// Compact version for header/navbar
export function SyncStatusIcon() {
  const { user, profileId } = useAuth()
  const [status, setStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    if (!user || !profileId) {
      return
    }

    const updateStatus = () => {
      const syncService = SyncService.getInstance()
      setStatus(syncService.getStatus())
    }

    updateStatus()
    const interval = setInterval(updateStatus, 1000)

    return () => clearInterval(interval)
  }, [user, profileId])

  if (!user || !profileId) {
    return <CloudOff className="h-4 w-4 text-muted-foreground" />
  }

  if (status === 'syncing') {
    return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
  }

  if (status === 'error') {
    return <AlertCircle className="h-4 w-4 text-red-500" />
  }

  return <Cloud className="h-4 w-4 text-green-500" />
}
