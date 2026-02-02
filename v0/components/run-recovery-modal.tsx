'use client';

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, Trash2, Clock, MapPin, Activity, Info } from "lucide-react"
import type { ActiveRecordingSession } from "@/lib/db"

interface RunRecoveryModalProps {
  session: ActiveRecordingSession;
  onResume: () => void;
  onDiscard: () => void;
  isOpen: boolean;
}

export function RunRecoveryModal({
  session,
  onResume,
  onDiscard,
  isOpen,
}: RunRecoveryModalProps) {
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  const handleResume = async () => {
    setIsResuming(true)
    try {
      await onResume()
    } finally {
      setIsResuming(false)
    }
  }

  const handleDiscard = async () => {
    setIsDiscarding(true)
    try {
      await onDiscard()
    } finally {
      setIsDiscarding(false)
    }
  }

  // Format duration from seconds
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // Format date and time
  const formatDateTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  }

  // Parse GPS path to get point count
  let gpsPointCount = 0
  try {
    const gpsPath = JSON.parse(session.gpsPath)
    gpsPointCount = Array.isArray(gpsPath) ? gpsPath.length : 0
  } catch (err) {
    console.error('Failed to parse GPS path:', err)
  }

  // Calculate how long ago the session was started
  const minutesAgo = Math.floor((Date.now() - session.startedAt.getTime()) / (1000 * 60))
  const timeAgoText = minutesAgo < 60
    ? `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`
    : `${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''} ago`

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Incomplete Run Found
          </DialogTitle>
          <DialogDescription>
            You have an unfinished recording from {timeAgoText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your run data has been automatically saved and can be resumed or discarded.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Started</span>
              </div>
              <span className="font-medium">{formatDateTime(session.startedAt)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>Duration</span>
              </div>
              <span className="font-medium">{formatDuration(session.durationSeconds)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Distance</span>
              </div>
              <span className="font-medium">{session.distanceKm.toFixed(2)} km</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>GPS Points</span>
              </div>
              <span className="font-medium">{gpsPointCount.toLocaleString()}</span>
            </div>

            {session.status === 'paused' && (
              <div className="rounded bg-yellow-50 dark:bg-yellow-900/10 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
                This run was paused
              </div>
            )}

            {session.status === 'interrupted' && (
              <div className="rounded bg-orange-50 dark:bg-orange-900/10 px-3 py-2 text-sm text-orange-800 dark:text-orange-200">
                This run was interrupted
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={isDiscarding || isResuming}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDiscarding ? 'Discarding...' : 'Discard'}
          </Button>
          <Button
            onClick={handleResume}
            disabled={isDiscarding || isResuming}
            className="w-full sm:w-auto"
          >
            <Play className="h-4 w-4 mr-2" />
            {isResuming ? 'Resuming...' : 'Resume Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
