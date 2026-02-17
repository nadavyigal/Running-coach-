
import { useEffect, useRef, useState, useCallback } from 'react'

// 1 second of silence
const SILENT_AUDIO_URL = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='

// Keepalive interval: 30 seconds (helps prevent audio suspension on iOS)
const AUDIO_KEEPALIVE_INTERVAL = 30_000

export interface WakeLockOptions {
    enableScreenLock?: boolean
    enableAudioLock?: boolean
    onLockStatusChange?: (status: 'active' | 'inactive' | 'error') => void
    onVisibilityChange?: (isVisible: boolean) => void
}

export function useWakeLock({
    enableScreenLock = true,
    enableAudioLock = true,
    onLockStatusChange,
    onVisibilityChange
}: WakeLockOptions = {}) {
    const [isActive, setIsActive] = useState(false)
    const isActiveRef = useRef(false)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const audioKeepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        isActiveRef.current = isActive
    }, [isActive])

    const requestWakeLock = useCallback(async () => {
        if (isActiveRef.current) return

        try {
            // 1. Screen Wake Lock
            if (enableScreenLock && 'wakeLock' in navigator) {
                try {
                    const lock = await navigator.wakeLock.request('screen')
                    wakeLockRef.current = lock

                    lock.addEventListener('release', () => {
                        console.log('[WakeLock] Screen lock released')
                        // Try to re-acquire if we're still supposed to be active
                        if (isActiveRef.current) {
                            console.log('[WakeLock] Attempting to re-acquire released lock')
                            setTimeout(async () => {
                                if (isActiveRef.current && 'wakeLock' in navigator) {
                                    try {
                                        const newLock = await navigator.wakeLock.request('screen')
                                        wakeLockRef.current = newLock
                                        console.log('[WakeLock] Screen lock re-acquired')
                                    } catch (err) {
                                        console.warn('[WakeLock] Failed to re-acquire:', err)
                                    }
                                }
                            }, 1000)
                        }
                    })

                    console.log('[WakeLock] Screen lock active')
                } catch (err) {
                    console.warn('[WakeLock] Failed to acquire screen lock:', err)
                }
            }

            // 2. Audio Wake Lock (Silent Loop) - Enhanced for mobile browsers
            if (enableAudioLock) {
                if (!audioRef.current) {
                    audioRef.current = new Audio(SILENT_AUDIO_URL)
                    audioRef.current.loop = true

                    // Critical mobile browser settings
                    // @ts-expect-error - playsInline is supported in browsers but not typed on HTMLAudioElement
                    audioRef.current.playsInline = true
                    // @ts-expect-error - webkitPlaysInline for older iOS versions
                    audioRef.current.webkitPlaysInline = true

                    // Prevent audio from being paused by system
                    audioRef.current.preservesPitch = false

                    // Set volume to very low but not zero (iOS optimization)
                    audioRef.current.volume = 0.01

                    // Add event listeners for debugging
                    audioRef.current.addEventListener('pause', () => {
                        console.warn('[WakeLock] Audio paused unexpectedly')
                        // Attempt to resume if we're still active
                        if (isActiveRef.current && audioRef.current && audioRef.current.paused) {
                            console.log('[WakeLock] Attempting to resume audio')
                            audioRef.current.play().catch(err => {
                                console.error('[WakeLock] Failed to resume audio:', err)
                            })
                        }
                    })

                    audioRef.current.addEventListener('ended', () => {
                        console.warn('[WakeLock] Audio ended unexpectedly (should loop)')
                    })
                }

                try {
                    await audioRef.current.play()
                    console.log('[WakeLock] Audio lock active')

                    // Start keepalive interval to ensure audio stays active
                    if (audioKeepaliveIntervalRef.current) {
                        clearInterval(audioKeepaliveIntervalRef.current)
                    }
                    audioKeepaliveIntervalRef.current = setInterval(() => {
                        if (audioRef.current && audioRef.current.paused && isActiveRef.current) {
                            console.log('[WakeLock] Keepalive: restarting paused audio')
                            audioRef.current.play().catch(err => {
                                console.error('[WakeLock] Keepalive failed:', err)
                            })
                        }
                    }, AUDIO_KEEPALIVE_INTERVAL)

                } catch (err) {
                    console.warn('[WakeLock] Failed to play silent audio:', err)
                    console.warn('[WakeLock] Audio may not work until user interaction')
                }
            }

            setIsActive(true)
            isActiveRef.current = true
            onLockStatusChange?.('active')

        } catch (err) {
            console.error('[WakeLock] Error activating locks:', err)
            onLockStatusChange?.('error')
        }
    }, [enableScreenLock, enableAudioLock, onLockStatusChange])

    const releaseWakeLock = useCallback(async () => {
        if (!isActiveRef.current) return

        // 1. Clear keepalive interval
        if (audioKeepaliveIntervalRef.current) {
            clearInterval(audioKeepaliveIntervalRef.current)
            audioKeepaliveIntervalRef.current = null
        }

        // 2. Release Screen Lock
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release()
                wakeLockRef.current = null
            } catch (err) {
                console.warn('[WakeLock] Failed to release screen lock:', err)
            }
        }

        // 3. Stop Audio
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }

        setIsActive(false)
        isActiveRef.current = false
        onLockStatusChange?.('inactive')
        console.log('[WakeLock] Released all locks')
    }, [onLockStatusChange])

    // Monitor visibility changes and re-acquire screen lock
    useEffect(() => {
        const handleVisibilityChange = async () => {
            const isVisible = document.visibilityState === 'visible'
            console.log('[WakeLock] Visibility changed:', isVisible ? 'visible' : 'hidden')

            // Notify parent component of visibility change
            onVisibilityChange?.(isVisible)

            if (isVisible && isActiveRef.current) {
                // Page became visible - try to re-acquire screen lock if needed
                if (enableScreenLock && 'wakeLock' in navigator && !wakeLockRef.current) {
                    try {
                        const lock = await navigator.wakeLock.request('screen')
                        wakeLockRef.current = lock
                        console.log('[WakeLock] Screen lock re-acquired after visibility change')
                    } catch (err) {
                        console.warn('[WakeLock] Failed to re-acquire screen lock:', err)
                    }
                }

                // Ensure audio is still playing
                if (enableAudioLock && audioRef.current && audioRef.current.paused) {
                    console.log('[WakeLock] Restarting audio after becoming visible')
                    try {
                        await audioRef.current.play()
                    } catch (err) {
                        console.warn('[WakeLock] Failed to restart audio:', err)
                    }
                }
            } else if (!isVisible && isActiveRef.current) {
                // Page became hidden - log warning but audio should continue
                console.warn('[WakeLock] Page hidden - screen lock released, audio should continue')
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isActive, enableScreenLock, enableAudioLock, onVisibilityChange])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear keepalive interval
            if (audioKeepaliveIntervalRef.current) {
                clearInterval(audioKeepaliveIntervalRef.current)
            }
            releaseWakeLock()
        }
    }, [releaseWakeLock])

    return {
        isActive,
        requestWakeLock,
        releaseWakeLock
    }
}
