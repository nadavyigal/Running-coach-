/**
 * Audio coaching cues using Web Audio API
 * Fallback for iOS devices where vibration is not supported
 */

const AUDIO_PREF_KEY = 'audioCoachEnabled'

// Feature flag check
export const ENABLE_AUDIO_COACH =
  process.env.NEXT_PUBLIC_ENABLE_AUDIO_COACH === 'true'

// AudioContext singleton
let audioContext: AudioContext | null = null

const canAccessStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

/**
 * Check if Web Audio API is supported
 */
export const isAudioSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!(
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  )
}

/**
 * Check if running on iOS device (where vibration is not supported)
 */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/.test(userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  )
}

/**
 * Get user preference for audio cues (defaults to true)
 */
export const isAudioEnabled = (): boolean => {
  if (!canAccessStorage()) return true

  try {
    const value = window.localStorage.getItem(AUDIO_PREF_KEY)
    if (value === null) return true
    return value === 'true'
  } catch {
    return true
  }
}

/**
 * Set user preference for audio cues
 */
export const setAudioEnabled = (enabled: boolean): void => {
  if (!canAccessStorage()) return

  try {
    window.localStorage.setItem(AUDIO_PREF_KEY, enabled ? 'true' : 'false')
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize AudioContext (lazy initialization)
 */
export const initializeAudioContext = (): boolean => {
  if (audioContext) return true

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return false

    audioContext = new AudioContextClass()
    return true
  } catch {
    return false
  }
}

/**
 * Resume AudioContext (required after user gesture on iOS)
 */
export const resumeAudioContext = async (): Promise<boolean> => {
  if (!audioContext) {
    if (!initializeAudioContext()) return false
  }

  if (audioContext!.state === 'suspended') {
    try {
      await audioContext!.resume()
      return true
    } catch {
      return false
    }
  }

  return audioContext!.state === 'running'
}

/**
 * Check if audio system is ready to play
 */
export const isAudioReady = (): boolean => {
  return audioContext !== null && audioContext.state === 'running'
}

/**
 * Check if audio cue should play (all conditions met)
 */
const shouldPlayAudio = (): boolean => {
  if (!ENABLE_AUDIO_COACH) return false
  if (!isAudioEnabled()) return false
  if (!isAudioSupported()) return false
  return isAudioReady()
}

/**
 * Generate and play a tone using Web Audio API
 */
const playTone = (
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void => {
  if (!shouldPlayAudio() || !audioContext) return

  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)

    // Envelope: quick attack, sustain, quick release
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(
      volume,
      audioContext.currentTime + 0.01
    )
    gainNode.gain.linearRampToValueAtTime(
      volume,
      audioContext.currentTime + duration - 0.05
    )
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration)
  } catch {
    // Ignore audio errors
  }
}

/**
 * Single audio cue: Short pleasant tone (interval end)
 * A5 at 880Hz, 150ms duration
 */
export const audioSingle = (): void => {
  playTone(880, 0.15, 'sine', 0.25)
}

/**
 * Double audio cue: Two ascending tones (workout complete, interval start)
 * C5 (523Hz) then E5 (659Hz)
 */
export const audioDouble = (): void => {
  if (!shouldPlayAudio() || !audioContext) return

  try {
    // First tone: C5
    playTone(523, 0.12, 'sine', 0.25)

    // Second tone: E5 after 150ms
    setTimeout(() => playTone(659, 0.12, 'sine', 0.25), 150)
  } catch {
    // Ignore audio errors
  }
}

/**
 * Alert audio cue: Attention-grabbing pattern (warnings, important changes)
 * G4-C5-G4 pattern
 */
export const audioAlert = (): void => {
  if (!shouldPlayAudio() || !audioContext) return

  try {
    // Two-tone alert: G4-C5-G4
    playTone(392, 0.1, 'triangle', 0.3)
    setTimeout(() => playTone(523, 0.15, 'triangle', 0.35), 120)
    setTimeout(() => playTone(392, 0.1, 'triangle', 0.3), 270)
  } catch {
    // Ignore audio errors
  }
}

/**
 * Cleanup AudioContext (call on unmount)
 */
export const cleanupAudioContext = (): void => {
  if (audioContext) {
    audioContext.close().catch(() => {
      // Ignore close errors
    })
    audioContext = null
  }
}
