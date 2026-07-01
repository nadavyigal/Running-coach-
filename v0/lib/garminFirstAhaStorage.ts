export const GARMIN_FIRST_AHA_SEEN_KEY = 'runsmart.garmin-first-aha.seen'

export function hasSeenGarminFirstAha(userId: number): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(`${GARMIN_FIRST_AHA_SEEN_KEY}.${userId}`) === 'true'
}

export function markGarminFirstAhaSeen(userId: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${GARMIN_FIRST_AHA_SEEN_KEY}.${userId}`, 'true')
}
