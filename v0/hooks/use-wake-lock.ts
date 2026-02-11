import { useEffect, useRef, useState, useCallback } from 'react'
import NoSleep from 'nosleep.js'

export interface WakeLockOptions {
    /** Called when lock status changes */
    onLockStatusChange?: (status: 'active' | 'inactive' | 'error') => void
    /** Called when page visibility changes (screen on/off) */
    onVisibilityChange?: (isVisible: boolean) => void
}

/**
 * useWakeLock - Prevents screen from auto-dimming during run recording.
 *
 * Strategy (layered, most → least reliable):
 * 1. NoSleep.js (creates a hidden video element - most reliable on iOS Safari)
 * 2. Screen Wake Lock API (native browser API - Chrome/Edge, partial Safari support)
 *
 * IMPORTANT: Neither approach can prevent MANUAL screen lock by user.
 * When the user presses the power button, the browser suspends JavaScript
 * and GPS tracking stops. The app MUST make this clear to the user.
 */
export function useWakeLock({
    onLockStatusChange,
    onVisibilityChange
}: WakeLockOptions = {}) {
    const [isActive, setIsActive] = useState(false)
    const isActiveRef = useRef(false)
    const noSleepRef = useRef<NoSleep | null>(null)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
    const visibilityHandlerRef = useRef<(() => void) | null>(null)

    // Track callbacks in refs to avoid stale closures
    const onLockStatusChangeRef = useRef(onLockStatusChange)
    const onVisibilityChangeRef = useRef(onVisibilityChange)
    useEffect(() => {
        onLockStatusChangeRef.current = onLockStatusChange
        onVisibilityChangeRef.current = onVisibilityChange
    }, [onLockStatusChange, onVisibilityChange])

    const requestWakeLock = useCallback(async () => {
        if (isActiveRef.current) return

        let anyLockAcquired = false

        // Layer 1: NoSleep.js (video-based - most reliable on iOS Safari)
        try {
            if (!noSleepRef.current) {
                noSleepRef.current = new NoSleep()
            }
            await noSleepRef.current.enable()
            anyLockAcquired = true
            console.log('[WakeLock] NoSleep.js video lock active')
        } catch (err) {
            console.warn('[WakeLock] NoSleep.js failed:', err)
        }

        // Layer 2: Screen Wake Lock API (native browser support)
        if ('wakeLock' in navigator) {
            try {
                const lock = await navigator.wakeLock.request('screen')
                wakeLockRef.current = lock

                lock.addEventListener('release', () => {
                    console.log('[WakeLock] Screen Wake Lock released by system')
                    wakeLockRef.current = null
                    // Re-acquire when page becomes visible again
                    // (handled in visibility change listener)
                })

                anyLockAcquired = true
                console.log('[WakeLock] Screen Wake Lock API active')
            } catch (err) {
                console.warn('[WakeLock] Screen Wake Lock API failed:', err)
            }
        }

        if (anyLockAcquired) {
            isActiveRef.current = true
            setIsActive(true)
            onLockStatusChangeRef.current?.('active')
        } else {
            console.error('[WakeLock] No wake lock mechanism available')
            onLockStatusChangeRef.current?.('error')
        }
    }, [])

    const releaseWakeLock = useCallback(async () => {
        if (!isActiveRef.current) return

        // Release NoSleep.js
        if (noSleepRef.current) {
            try {
                noSleepRef.current.disable()
                console.log('[WakeLock] NoSleep.js disabled')
            } catch (err) {
                console.warn('[WakeLock] NoSleep.js disable failed:', err)
            }
        }

        // Release Screen Wake Lock
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release()
                wakeLockRef.current = null
                console.log('[WakeLock] Screen Wake Lock released')
            } catch (err) {
                console.warn('[WakeLock] Screen Wake Lock release failed:', err)
            }
        }

        isActiveRef.current = false
        setIsActive(false)
        onLockStatusChangeRef.current?.('inactive')
    }, [])

    // Monitor visibility changes and re-acquire wake lock
    useEffect(() => {
        const handleVisibilityChange = async () => {
            const isVisible = document.visibilityState === 'visible'
            console.log('[WakeLock] Visibility:', isVisible ? 'visible' : 'hidden')

            onVisibilityChangeRef.current?.(isVisible)

            if (isVisible && isActiveRef.current) {
                // Page became visible again - re-acquire Screen Wake Lock
                // (NoSleep.js video should auto-resume)
                if ('wakeLock' in navigator && !wakeLockRef.current) {
                    try {
                        const lock = await navigator.wakeLock.request('screen')
                        wakeLockRef.current = lock
                        lock.addEventListener('release', () => {
                            wakeLockRef.current = null
                        })
                        console.log('[WakeLock] Screen Wake Lock re-acquired')
                    } catch (err) {
                        console.warn('[WakeLock] Failed to re-acquire screen lock:', err)
                    }
                }
            }
        }

        visibilityHandlerRef.current = handleVisibilityChange
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isActiveRef.current) {
                noSleepRef.current?.disable()
                wakeLockRef.current?.release().catch(() => {})
                isActiveRef.current = false
            }
        }
    }, [])

    return {
        isActive,
        requestWakeLock,
        releaseWakeLock
    }
}
