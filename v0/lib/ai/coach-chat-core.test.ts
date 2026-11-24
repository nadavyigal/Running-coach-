import { describe, expect, it } from 'vitest'
import { COACH_CHAT_CORE, WEB_CHAT_SYSTEM_PROMPT } from './coach-chat-core'

// Same phrases as coach_prompt_test.ts in the iOS repo.
const SAFETY_PHRASES = [
  'This is not medical advice. Do not diagnose injuries or illness.',
  'tell them to stop the activity and talk to a qualified professional',
  'For chest pain, fainting or trouble breathing, tell them to get urgent medical help.',
  'pain, dizziness, chest pain, fainting, shortness of breath',
  'When unsure, choose the more conservative option.',
  'Do not say you changed the training plan unless a change was actually applied.',
  'Do not reveal raw GPS data, coordinates or private route details.',
  "Reply in the language of the runner's latest message (Hebrew or English).",
]

describe('web chat prompt', () => {
  it('keeps every shared safety line', () => {
    for (const phrase of SAFETY_PHRASES) expect(COACH_CHAT_CORE, phrase).toContain(phrase)
  })

  it('does not limit the audience to beginners (web serves advanced runners too)', () => {
    expect(WEB_CHAT_SYSTEM_PROMPT).not.toContain('beginner')
  })

  it('keeps the <user_data_update> contract the chat screen parses', () => {
    expect(WEB_CHAT_SYSTEM_PROMPT.startsWith(COACH_CHAT_CORE)).toBe(true)
    expect(WEB_CHAT_SYSTEM_PROMPT).toContain('<user_data_update>{"message":"...","data":{...}}</user_data_update>')
    expect(WEB_CHAT_SYSTEM_PROMPT).toContain('only after the runner explicitly confirms')
    expect(WEB_CHAT_SYSTEM_PROMPT).toContain('Do not wrap it in markdown.')
  })
})
