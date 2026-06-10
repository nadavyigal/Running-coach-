// v0/lib/userInsightService.test.ts
import { describe, it, expect } from 'vitest'
import {
  getRunningIdentity,
  projectGoalTimeline,
} from './userInsightService'

describe('getRunningIdentity', () => {
  it('returns first_timer for beginners regardless of pace or goal', () => {
    const result = getRunningIdentity('distance', 'beginner', 7.0)
    expect(result.id).toBe('first_timer')
  })

  it('returns first_timer for beginners even with fast pace', () => {
    const result = getRunningIdentity('speed', 'beginner', 4.5)
    expect(result.id).toBe('first_timer')
  })

  it('returns speed_seeker when goal is speed and experience is not beginner', () => {
    const result = getRunningIdentity('speed', 'regular', 6.0)
    expect(result.id).toBe('speed_seeker')
  })

  it('returns speed_seeker when pace is below 5.5 min/km', () => {
    const result = getRunningIdentity('distance', 'regular', 5.2)
    expect(result.id).toBe('speed_seeker')
  })

  it('returns endurance_builder when goal is distance and pace is above 6.5 min/km', () => {
    const result = getRunningIdentity('distance', 'occasional', 7.0)
    expect(result.id).toBe('endurance_builder')
  })

  it('returns balanced_athlete for regular runners with moderate pace and habit goal', () => {
    const result = getRunningIdentity('habit', 'regular', 6.0)
    expect(result.id).toBe('balanced_athlete')
  })

  it('returns an identity with all required fields', () => {
    const result = getRunningIdentity('distance', 'occasional', 7.0)
    expect(result.id).toBeDefined()
    expect(result.label).toBeTruthy()
    expect(result.glyph).toBeTruthy()
    expect(result.headline).toBeTruthy()
    expect(result.subline).toBeTruthy()
    expect(result.ctaLabel).toBeTruthy()
  })
})

describe('projectGoalTimeline', () => {
  it('returns 4 weeks for a beginner with habit goal', () => {
    const result = projectGoalTimeline('habit', 'beginner')
    expect(result.weeks).toBe(4)
  })

  it('returns 8 weeks for a beginner with distance goal', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.weeks).toBe(8)
  })

  it('returns 5 weeks for a regular runner with distance goal', () => {
    const result = projectGoalTimeline('distance', 'regular')
    expect(result.weeks).toBe(5)
  })

  it('returns 3 weeks for a regular runner with habit goal', () => {
    const result = projectGoalTimeline('habit', 'regular')
    expect(result.weeks).toBe(3)
  })

  it('sets milestoneWeek to roughly half the weeks', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.milestoneWeek).toBe(4)
  })

  it('milestoneWeek is at least 1', () => {
    const result = projectGoalTimeline('habit', 'regular')
    expect(result.milestoneWeek).toBeGreaterThanOrEqual(1)
  })

  it('projectedDate is in the future', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.projectedDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('projectedDate is approximately weeks * 7 days from now', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    const expectedMs = result.weeks * 7 * 24 * 60 * 60 * 1000
    const actualMs = result.projectedDate.getTime() - Date.now()
    expect(actualMs).toBeGreaterThan(expectedMs - 5000) // within 5 seconds
    expect(actualMs).toBeLessThan(expectedMs + 5000)
  })

  it('uses beginner as fallback for unknown experience', () => {
    const known = projectGoalTimeline('distance', 'beginner')
    const unknown = projectGoalTimeline('distance', 'unknown_experience')
    expect(unknown.weeks).toBe(known.weeks)
  })

  it('uses habit as fallback for unknown goal', () => {
    const known = projectGoalTimeline('habit', 'beginner')
    const unknown = projectGoalTimeline('unknown_goal', 'beginner')
    expect(unknown.weeks).toBe(known.weeks)
  })

  it('returns goalLabel and milestoneLabel strings', () => {
    const result = projectGoalTimeline('distance', 'beginner')
    expect(result.goalLabel).toBeTruthy()
    expect(result.milestoneLabel).toBeTruthy()
  })
})
