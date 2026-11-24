import { describe, expect, it } from 'vitest'
import { HEBREW_STYLE } from './language'
import { buildRunReportSystemPrompt } from './run-report-prompt'

describe('buildRunReportSystemPrompt', () => {
  it('keeps the safety rule with the exact flag code', () => {
    const p = buildRunReportSystemPrompt()
    expect(p).toContain('this is not medical advice; do not diagnose.')
    expect(p).toContain('add a safety flag with code injury_signal')
    expect(p).toContain('see a qualified professional')
    expect(p).toContain('make the next session rest or gentle cross-training')
  })

  it('forbids invented data and keeps the scoring bands', () => {
    const p = buildRunReportSystemPrompt()
    expect(p).toContain('Never invent telemetry, VDOT, race predictions or comparisons')
    expect(p).toContain('A well-executed easy run can score 90+.')
  })

  it('defaults to English and switches to Hebrew only when asked; enums stay English', () => {
    expect(buildRunReportSystemPrompt()).toContain('text field the runner reads in English.')
    expect(buildRunReportSystemPrompt()).not.toContain(HEBREW_STYLE)
    const he = buildRunReportSystemPrompt('he')
    expect(he).toContain('text field the runner reads in Hebrew.')
    expect(he).toContain(HEBREW_STYLE)
    expect(he).toContain('Keep enum values (easy, moderate, hard')
  })
})
