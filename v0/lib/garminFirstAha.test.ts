import { describe, expect, it } from 'vitest'

import { buildGarminFirstAhaResult } from '@/lib/garminFirstAhaBuilder'
import { selectRecommendedChallenge } from '@/lib/garminFirstAhaChallenge'
import {
  buildStarterPlan,
  classifyRunnerType,
  computeGuardrails,
  shiftIsoDate,
} from '@/lib/garminFirstAhaPlan'
import { computeGarminAcwrMetrics } from '@/lib/garminAcwr'
import type { GarminFirstAhaRunInput } from '@/lib/garminFirstAhaTypes'

function buildRuns(endDate: string, count: number, spacingDays = 2): GarminFirstAhaRunInput[] {
  return Array.from({ length: count }, (_, index) => ({
    completedAt: `${shiftIsoDate(endDate, -(index * spacingDays))}T07:00:00.000Z`,
    durationSeconds: 1800,
    distanceMeters: 5000,
    averageHeartRate: 135,
  }))
}

describe('buildGarminFirstAhaResult', () => {
  const endDate = '2026-06-30'

  it('returns insufficient_data for empty history with a useful partial result', () => {
    const result = buildGarminFirstAhaResult({
      runs: [],
      wellnessDays: [],
      endDate,
      generatedAt: '2026-06-30T12:00:00.000Z',
    })

    expect(result.status).toBe('insufficient_data')
    expect(result.profile.summaryBullets.length).toBeGreaterThan(0)
    expect(result.starterPlan.days.length).toBeGreaterThan(0)
    expect(result.recommendedChallenge.id).toBeTruthy()
  })

  it('returns a conservative plan for low-frequency runners', () => {
    const runs = buildRuns(endDate, 2, 7)
    const result = buildGarminFirstAhaResult({ runs, wellnessDays: [], endDate })

    expect(result.status).toBe('partial')
    expect(result.starterPlan.days.some((day) => day.type === 'walk_run' || day.type === 'easy_run')).toBe(
      true
    )
    expect(result.guardrails.level).not.toBe('red')
  })

  it('produces yellow guardrails for elevated load', () => {
    const spikeRuns = [
      ...buildRuns(endDate, 5, 1),
      ...Array.from({ length: 3 }, (_, index) => ({
        completedAt: `${shiftIsoDate(endDate, -index)}T07:00:00.000Z`,
        durationSeconds: 5400,
        distanceMeters: 15000,
        averageHeartRate: 175,
      })),
    ]

    const result = buildGarminFirstAhaResult({
      runs: spikeRuns,
      wellnessDays: [],
      endDate,
    })

    expect(['yellow', 'red']).toContain(result.guardrails.level)
    expect(result.signals.load.acwrLabel).toBe('elevated')
  })

  it('lowers confidence without blocking when wellness data is missing', () => {
    const runs = buildRuns(endDate, 10, 2)
    const result = buildGarminFirstAhaResult({ runs, wellnessDays: [], endDate })

    expect(result.status).toBe('partial')
    expect(result.profile.confidence).not.toBe('high')
    expect(result.signals.recovery).toBeUndefined()
    expect(result.disclaimers.some((line) => line.includes('wellness'))).toBe(true)
  })
})

describe('selectRecommendedChallenge', () => {
  it('maps low frequency to start-running', () => {
    const challenge = selectRecommendedChallenge({
      runnerType: 'new_or_low_data_runner',
      guardrailLevel: 'green',
      runs28: 2,
      gapDays: null,
    })

    expect(challenge.id).toBe('start-running')
  })

  it('maps elevated load to plateau-breaker', () => {
    const challenge = selectRecommendedChallenge({
      runnerType: 'overreaching_risk',
      guardrailLevel: 'yellow',
      runs28: 10,
      gapDays: 2,
    })

    expect(challenge.id).toBe('plateau-breaker')
  })
})

describe('computeGuardrails', () => {
  it('marks severe load spike with red when recovery is weak', () => {
    const endDate = '2026-06-30'
    const runs = buildRuns(endDate, 12, 1).map((run, index) => ({
      ...run,
      distanceMeters: index < 4 ? 12000 : 5000,
      averageHeartRate: 170,
    }))
    const acwr = computeGarminAcwrMetrics({
      activities: runs.map((run) => ({
        startTime: run.completedAt,
        durationSeconds: run.durationSeconds,
        averageHeartRate: run.averageHeartRate,
        distanceMeters: run.distanceMeters,
      })),
      endDate,
    })

    const guardrails = computeGuardrails({
      runs,
      endDate,
      acwr,
      hardRunShare: 0.5,
      readinessScore: 30,
      hasWellness: true,
      runs28: runs.length,
    })

    expect(guardrails.level).toBe('red')
  })
})

describe('classifyRunnerType', () => {
  it('classifies sparse history as new_or_low_data_runner', () => {
    const endDate = '2026-06-30'
    const runs = buildRuns(endDate, 2)
    const acwr = computeGarminAcwrMetrics({
      activities: runs.map((run) => ({
        startTime: run.completedAt,
        durationSeconds: run.durationSeconds,
        averageHeartRate: run.averageHeartRate,
        distanceMeters: run.distanceMeters,
      })),
      endDate,
    })

    expect(
      classifyRunnerType({
        runs,
        endDate,
        acwr,
        hardRunShare: 0.1,
        readinessScore: null,
      })
    ).toBe('new_or_low_data_runner')
  })
})

describe('buildStarterPlan', () => {
  it('includes rest days in a 14-day block', () => {
    const plan = buildStarterPlan({
      runnerType: 'building_consistency',
      guardrailLevel: 'green',
      runs28: 8,
      startDate: '2026-07-01',
    })

    expect(plan.days.length).toBeGreaterThanOrEqual(6)
    expect(plan.days.some((day) => day.type === 'rest')).toBe(true)
  })
})
