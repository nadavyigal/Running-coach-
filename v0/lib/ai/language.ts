/**
 * Language for athlete-facing AI text.
 *
 * Structured outputs (plan, run report) use only an explicit `language` field
 * in the request body: "he" or "en", default "en". Accept-Language is never
 * read: browsers send it, and the web app's screens are English, so a Hebrew
 * browser would suddenly get Hebrew plans. JSON keys, enum values and weekday
 * tokens always stay English.
 *
 * HEBREW_STYLE is the same text as coach_message/coach_prompts.ts in
 * nadavyigal/IOS-runsmart-light-app-; change both together.
 */
export type AthleteLanguage = 'en' | 'he'

export function resolveAthleteLanguage(value: unknown): AthleteLanguage {
  return value === 'he' ? 'he' : 'en'
}

export function languageName(language: AthleteLanguage): string {
  return language === 'he' ? 'Hebrew' : 'English'
}

export const HEBREW_STYLE =
  'Write in natural, simple Hebrew. Use gender-neutral phrasing (infinitives, "כדאי", "אפשר") instead of guessing the runner\'s gender. Use Western digits, "ק״מ" for kilometers, and write paces as m:ss לק״מ.'

/** Style line to add after a language instruction; empty for English. */
export function hebrewStyleLine(language: AthleteLanguage): string {
  return language === 'he' ? `\n${HEBREW_STYLE}` : ''
}
