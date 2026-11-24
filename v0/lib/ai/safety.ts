/**
 * Deterministic pain / injury detection for runner free text (run notes,
 * soreness). It runs whether or not the model answers, so it must cover every
 * language the app's runners write in.
 *
 * English terms are the original run-report list. Hebrew terms match as
 * substrings so prefixes (ה, ב, ו, ש) and endings still match: כאב / כאבים,
 * כואב / כואבת, נפצע / נפצעתי, התעלפ / התעלפתי. Not מתיחה: it also means
 * "stretching" and would flag ordinary notes.
 *
 * The same Hebrew list lives in coach_message/safety.ts in
 * nadavyigal/IOS-runsmart-light-app-; change both together.
 */
const ENGLISH_INJURY_TERMS = ['pain', 'injury', 'dizzy', 'dizziness', 'sharp', 'strain']

const HEBREW_INJURY_TERMS = [
  'כאב',
  'כואב',
  'מכאיב',
  'פציעה',
  'פצוע',
  'נפצע',
  'נקע',
  'סחרחורת',
  'סחרחר',
  'מסוחרר',
  'התעלפ',
  'עילפון',
  'לחץ בחזה',
  'קוצר נשימה',
  'דקירה',
]

export function hasInjurySignal(text?: string): boolean {
  if (!text) return false
  const normalized = text.toLowerCase()
  return (
    ENGLISH_INJURY_TERMS.some((term) => normalized.includes(term)) ||
    HEBREW_INJURY_TERMS.some((term) => text.includes(term))
  )
}
