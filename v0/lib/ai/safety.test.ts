import { describe, expect, it } from 'vitest'
import { hasInjurySignal } from './safety'

describe('hasInjurySignal', () => {
  it('keeps every English term from the original run-report list', () => {
    for (const note of ['knee pain', 'small injury', 'felt dizzy', 'dizziness at the end', 'sharp calf', 'hamstring strain']) {
      expect(hasInjurySignal(note), note).toBe(true)
    }
  })

  it('flags Hebrew pain, injury and dizziness notes with prefixes and endings', () => {
    for (const note of [
      'כואב לי בברך',
      'כאבים בשוק',
      'הברך מכאיבה',
      'נפצעתי בקילומטר 5',
      'פציעה ישנה בקרסול',
      'נקע קל',
      'הייתה סחרחורת',
      'הרגשתי מסוחרר',
      'כמעט התעלפתי',
      'לחץ בחזה בעלייה',
      'קוצר נשימה',
      'דקירה בצד',
    ]) {
      expect(hasInjurySignal(note), note).toBe(true)
    }
  })

  it('does not flag ordinary notes in either language', () => {
    for (const note of ['felt great', 'easy and relaxed', 'ריצה טובה', 'עשיתי מתיחות אחרי', undefined, '']) {
      expect(hasInjurySignal(note), String(note)).toBe(false)
    }
  })
})
