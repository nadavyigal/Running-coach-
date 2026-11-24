import { describe, expect, it } from 'vitest'
import { HEBREW_STYLE } from '@/lib/ai/language'
import { buildPlanPrompt, resolveTotalWeeks, resolveUser, type PlanRequest } from '@/lib/plan/plan-core'

function prompt(body: PlanRequest, metrics?: Parameters<typeof buildPlanPrompt>[6], language?: 'en' | 'he') {
  return buildPlanPrompt(
    resolveUser(body),
    resolveTotalWeeks(body),
    body.planPreferences,
    body.planType,
    body.targetDistance,
    body.challenge,
    metrics,
    body.trainingHistory,
    body.goals,
    language
  )
}

const base: PlanRequest = {
  userContext: {
    experience: 'intermediate',
    goal: 'distance',
    daysPerWeek: 4,
    preferredTimes: ['evening'],
    age: 58,
    barriers: ['coming back from shin splints'],
  },
  totalWeeks: 8,
  trainingHistory: { recentRuns: [{ date: '2026-11-18', distanceKm: 4, notes: 'sore shin\nstopped at 4 km' }] },
}

describe('buildPlanPrompt', () => {
  it('defaults to English and keeps schema values English', () => {
    const p = prompt(base)
    expect(p).toContain('Language: write title, description and notes in English.')
    expect(p).toContain('Keep schema values in English: type (easy, tempo, intervals, long, time-trial, hill, rest) and day (Mon to Sun).')
    expect(p).not.toContain(HEBREW_STYLE)
  })

  it('writes Hebrew only when language is explicitly he', () => {
    const p = prompt(base, undefined, 'he')
    expect(p).toContain('in Hebrew.')
    expect(p).toContain(HEBREW_STYLE)
  })

  it('keeps every hard rule and the injury-return safety rule', () => {
    const p = prompt(base)
    expect(p).toContain('totalWeeks is 8; use weeks 1 to 8.')
    expect(p).toContain('Total weekly distance grows at most 10% over the previous week.')
    expect(p).toContain('No single run is longer than 28 km.')
    expect(p).toContain('At most 2 quality session(s)')
    expect(p).toContain('keep the first two weeks easy and short')
    expect(p).toContain('stop and see a qualified professional if pain returns. Do not diagnose.')
  })

  it('passes age, barriers and run notes to the model, sanitized', () => {
    const p = prompt(base)
    expect(p).toContain('- Age: 58')
    expect(p).toContain('- Says it gets in the way: coming back from shin splints')
    expect(p).toContain('note: "sore shin')
  })

  it('has no JSON example and no double dash', () => {
    const p = prompt(base)
    expect(p).not.toContain('Return JSON only')
    expect(p).not.toContain('"workouts"')
    expect(p).not.toContain('- - ')
  })

  it('uses metric paces only when VDOT or LT pace is given', () => {
    expect(prompt(base)).toContain('Do not invent pace numbers.')
    const withMetrics = prompt(base, { vdot: 52, lactateThreshold: 240, lactateThresholdHR: 172 })
    expect(withMetrics).toContain('tempo at LT pace or up to 10 s/km slower')
    expect(withMetrics).toContain('VDOT 52.0 | LT pace 4:00/km | LT HR 172 bpm')
  })

  it('low-intensity runners get the no-hard-sessions rule', () => {
    const p = prompt({ user: { experience: 'beginner', goal: 'habit' }, totalWeeks: 4 })
    expect(p).toContain('Low-intensity plan: use only easy, long and rest workouts.')
  })
})
