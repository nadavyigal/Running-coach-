import { describe, expect, it } from 'vitest'
import { zodSchema } from 'ai'
import { InsightSchema } from './run-report-schema'

describe('InsightSchema (iOS contract)', () => {
  it('keeps the response keys and required fields', () => {
    const json = zodSchema(InsightSchema).jsonSchema as { properties: Record<string, unknown>; required: string[] }
    expect(Object.keys(json.properties).sort()).toEqual(
      [
        'biomechanics', 'coachScore', 'comparison', 'detailedRecovery', 'effort', 'metrics', 'pacingAnalysis',
        'paceConsistency', 'paceVariability', 'raceReadiness', 'recovery', 'runId', 'safetyFlags',
        'structuredNextWorkout', 'summary', 'trainingContext', 'nextSessionNudge',
      ].sort()
    )
    expect(json.required.sort()).toEqual(['effort', 'metrics', 'recovery', 'runId', 'summary'])
  })

  it('sends per-field guidance as schema descriptions', () => {
    const text = JSON.stringify(zodSchema(InsightSchema).jsonSchema)
    expect(text).toContain('strideDetection.detected')
    expect(text).toContain('ACWR 0.8-1.3')
    expect(text).toContain('Treat them as references, not targets')
  })

  it('accepts a Hebrew report with English enums', () => {
    const parsed = InsightSchema.safeParse({
      runId: 1,
      summary: ['6 ק״מ ב-36 דקות, קצב 6:00 לק״מ'],
      effort: 'easy',
      metrics: { paceStability: 'קצב יציב' },
      recovery: { priority: ['לשתות ולאכול'] },
      safetyFlags: [{ code: 'injury_signal', severity: 'high', message: 'כאב בברך: לעצור ולהתייעץ עם איש מקצוע.' }],
    })
    expect(parsed.success).toBe(true)
  })
})
