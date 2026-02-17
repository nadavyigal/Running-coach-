/**
 * Unified coaching cue manager
 * Coordinates vibration and audio cues based on device capabilities
 */

import {
  isVibrationSupported,
  isVibrationEnabled,
  setVibrationEnabled,
  vibrateSingle,
  vibrateDouble,
  vibrateAlert,
} from './vibration-coach'

import {
  isAudioSupported,
  isAudioEnabled,
  setAudioEnabled,
  audioSingle,
  audioDouble,
  audioAlert,
  speakCoachingText,
  resumeAudioContext,
  isAudioReady,
  isIOSDevice,
  cleanupAudioContext,
  ENABLE_AUDIO_COACH,
} from './audio-coach'

import { ENABLE_VIBRATION_COACH } from './featureFlags'

export type CueType = 'vibration' | 'audio' | 'both' | 'none'

export interface CoachingCueState {
  vibrationSupported: boolean
  vibrationEnabled: boolean
  audioSupported: boolean
  audioEnabled: boolean
  audioReady: boolean
  isIOS: boolean
  activeCueType: CueType
}

/**
 * Determine which cue type is currently active
 */
export const getActiveCueType = (): CueType => {
  const vibrationAvailable =
    ENABLE_VIBRATION_COACH && isVibrationSupported() && isVibrationEnabled()
  const audioAvailable =
    ENABLE_AUDIO_COACH && isAudioSupported() && isAudioEnabled() && isAudioReady()

  if (vibrationAvailable && audioAvailable) return 'both'
  if (vibrationAvailable) return 'vibration'
  if (audioAvailable) return 'audio'
  return 'none'
}

/**
 * Get full coaching cue state for UI
 */
export const getCoachingCueState = (): CoachingCueState => ({
  vibrationSupported: isVibrationSupported(),
  vibrationEnabled: isVibrationEnabled(),
  audioSupported: isAudioSupported(),
  audioEnabled: isAudioEnabled(),
  audioReady: isAudioReady(),
  isIOS: isIOSDevice(),
  activeCueType: getActiveCueType(),
})

/**
 * Initialize coaching cues (call on user interaction for iOS audio)
 */
export const initializeCoachingCues = async (): Promise<boolean> => {
  // Vibration doesn't need initialization
  // Audio needs AudioContext resume on user gesture
  if (ENABLE_AUDIO_COACH && isAudioSupported()) {
    return await resumeAudioContext()
  }
  return true
}

/**
 * Unified single cue (interval end)
 */
export const cueSingle = (): void => {
  const cueType = getActiveCueType()
  if (cueType === 'vibration' || cueType === 'both') vibrateSingle()
  if (cueType === 'audio' || cueType === 'both') audioSingle()
}

/**
 * Unified double cue (workout complete, interval start)
 */
export const cueDouble = (): void => {
  const cueType = getActiveCueType()
  if (cueType === 'vibration' || cueType === 'both') vibrateDouble()
  if (cueType === 'audio' || cueType === 'both') audioDouble()
}

/**
 * Unified alert cue (warnings, important changes)
 */
export const cueAlert = (): void => {
  const cueType = getActiveCueType()
  if (cueType === 'vibration' || cueType === 'both') vibrateAlert()
  if (cueType === 'audio' || cueType === 'both') audioAlert()
}

/**
 * Speak a coach phrase when audio cues are available.
 */
export const speakCoachMessage = (
  message: string,
  options?: { interrupt?: boolean; force?: boolean }
): boolean => {
  const cueType = getActiveCueType()
  if (cueType !== 'audio' && cueType !== 'both') return false
  return speakCoachingText(message, options)
}

/**
 * Cleanup coaching cues (call on unmount)
 */
export const cleanupCoachingCues = (): void => {
  cleanupAudioContext()
}

// Re-export setters for settings UI
export { setVibrationEnabled, setAudioEnabled }
