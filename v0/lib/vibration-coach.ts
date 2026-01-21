import { ENABLE_VIBRATION_COACH } from '@/lib/featureFlags'

const VIBRATION_PREF_KEY = 'vibrationEnabled'

const canAccessStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

export const isVibrationSupported = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }

  return typeof navigator.vibrate === 'function'
}

export const isVibrationEnabled = (): boolean => {
  if (!canAccessStorage()) {
    return true
  }

  try {
    const value = window.localStorage.getItem(VIBRATION_PREF_KEY)
    if (value === null) {
      return true
    }

    return value === 'true'
  } catch {
    return true
  }
}

export const setVibrationEnabled = (enabled: boolean): void => {
  if (!canAccessStorage()) {
    return
  }

  try {
    window.localStorage.setItem(VIBRATION_PREF_KEY, enabled ? 'true' : 'false')
  } catch {
  }
}

const shouldVibrate = (): boolean => {
  if (!ENABLE_VIBRATION_COACH) {
    return false
  }

  if (!isVibrationEnabled()) {
    return false
  }

  return isVibrationSupported()
}

const vibrate = (pattern: number | number[]): void => {
  if (!shouldVibrate()) {
    return
  }

  try {
    navigator.vibrate(pattern)
  } catch {
  }
}

export const vibrateSingle = (duration = 100): void => {
  vibrate(duration)
}

export const vibrateDouble = (): void => {
  vibrate([100, 50, 100])
}

export const vibrateAlert = (): void => {
  vibrate([200, 100, 200])
}
