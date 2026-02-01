
import { useEffect, useRef, useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

// 1 second of silence
const SILENT_AUDIO_URL = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='

export interface WakeLockOptions {
    enableScreenLock?: boolean
    enableAudioLock?: boolean
    onLockStatusChange?: (status: 'active' | 'inactive' | 'error') => void
}

export function useWakeLock({
    enableScreenLock = true,
    enableAudioLock = true,
    onLockStatusChange
}: WakeLockOptions = {}) {
    const [isActive, setIsActive] = useState(false)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const { toast } = useToast()

    const requestWakeLock = useCallback(async () => {
        if (isActive) return

        try {
            // 1. Screen Wake Lock
            if (enableScreenLock && 'wakeLock' in navigator) {
                try {
                    const lock = await navigator.wakeLock.request('screen')
                    wakeLockRef.current = lock

                    lock.addEventListener('release', () => {
                        console.log('[WakeLock] Screen lock released')
                    })

                    console.log('[WakeLock] Screen lock active')
                } catch (err) {
                    console.warn('[WakeLock] Failed to acquire screen lock:', err)
                }
            }

            // 2. Audio Wake Lock (Silent Loop)
            if (enableAudioLock) {
                if (!audioRef.current) {
                    audioRef.current = new Audio(SILENT_AUDIO_URL)
                    audioRef.current.loop = true
                    // @ts-ignore
                    audioRef.current.playsInline = true
                }

                try {
                    await audioRef.current.play()
                    console.log('[WakeLock] Audio lock active')
                } catch (err) {
                    console.warn('[WakeLock] Failed to play silent audio:', err)
                }
            }

            setIsActive(true)
            onLockStatusChange?.('active')

        } catch (err) {
            console.error('[WakeLock] Error activating locks:', err)
            onLockStatusChange?.('error')
        }
    }, [enableScreenLock, enableAudioLock, isActive, onLockStatusChange])

    const releaseWakeLock = useCallback(async () => {
        if (!isActive) return

        // 1. Release Screen Lock
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release()
                wakeLockRef.current = null
            } catch (err) {
                console.warn('[WakeLock] Failed to release screen lock:', err)
            }
        }

        // 2. Stop Audio
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }

        setIsActive(false)
        onLockStatusChange?.('inactive')
        console.log('[WakeLock] Released all locks')
    }, [isActive, onLockStatusChange])

    // Re-acquire screen lock on visibility change
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isActive && enableScreenLock) {
                if ('wakeLock' in navigator && !wakeLockRef.current) {
                    try {
                        const lock = await navigator.wakeLock.request('screen')
                        wakeLockRef.current = lock
                        console.log('[WakeLock] Screen lock re-acquired after visibility change')
                    } catch (err) {
                        console.warn('[WakeLock] Failed to re-acquire screen lock:', err)
                    }
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isActive, enableScreenLock])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseWakeLock()
        }
    }, [releaseWakeLock])

    return {
        isActive,
        requestWakeLock,
        releaseWakeLock
    }
}
