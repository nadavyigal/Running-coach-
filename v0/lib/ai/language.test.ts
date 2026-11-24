import { describe, expect, it } from 'vitest'
import { HEBREW_STYLE, hebrewStyleLine, languageName, resolveAthleteLanguage } from './language'

describe('athlete language', () => {
  it('is English unless the field is exactly "he"', () => {
    expect(resolveAthleteLanguage('he')).toBe('he')
    for (const value of ['en', 'HE', 'he-IL', 'iw', '', undefined, null, 1]) {
      expect(resolveAthleteLanguage(value), String(value)).toBe('en')
    }
  })

  it('adds the Hebrew style line only for Hebrew', () => {
    expect(languageName('he')).toBe('Hebrew')
    expect(languageName('en')).toBe('English')
    expect(hebrewStyleLine('he')).toBe(`\n${HEBREW_STYLE}`)
    expect(hebrewStyleLine('en')).toBe('')
  })
})
