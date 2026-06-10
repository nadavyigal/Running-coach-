// v0/lib/userInsightService.ts

export type RunnerIdentityId =
  | 'endurance_builder'
  | 'speed_seeker'
  | 'first_timer'
  | 'balanced_athlete'

export interface RunnerIdentity {
  id: RunnerIdentityId
  label: string
  glyph: string
  accentColor: string // Tailwind text color class
  ringColor: string   // Tailwind ring color class
  headline: string
  subline: string
  ctaLabel: string
}

export interface GoalTimeline {
  weeks: number
  milestoneWeek: number
  milestoneLabel: string
  goalLabel: string
  projectedDate: Date
}

const IDENTITIES: Record<RunnerIdentityId, RunnerIdentity> = {
  endurance_builder: {
    id: 'endurance_builder',
    label: 'Endurance Builder',
    glyph: '⛰️',
    accentColor: 'text-emerald-400',
    ringColor: 'ring-emerald-400/40',
    headline: "We can already tell — you're in it for the miles, not the medals.",
    subline: "That's the kind of runner who surprises themselves. Let's find out how far.",
    ctaLabel: "I'm ready",
  },
  speed_seeker: {
    id: 'speed_seeker',
    label: 'Speed Seeker',
    glyph: '⚡',
    accentColor: 'text-orange-400',
    ringColor: 'ring-orange-400/40',
    headline: "You're chasing time, not just distance.",
    subline: "Every second you shave off is earned. We'll help you earn more of them.",
    ctaLabel: "Let's go faster",
  },
  first_timer: {
    id: 'first_timer',
    label: 'First Timer',
    glyph: '🌱',
    accentColor: 'text-sky-400',
    ringColor: 'ring-sky-400/40',
    headline: "Everyone starts somewhere. Yours starts now.",
    subline: "The runners who stick with it are the ones who start slowly. We've got you.",
    ctaLabel: "Start my journey",
  },
  balanced_athlete: {
    id: 'balanced_athlete',
    label: 'All-Round Runner',
    glyph: '🏃',
    accentColor: 'text-teal-400',
    ringColor: 'ring-teal-400/40',
    headline: "You've got a good base. Let's do something with it.",
    subline: "Consistent runners who mix pace and distance improve fastest. That's your path.",
    ctaLabel: "Build on it",
  },
}

const WEEKS_TO_GOAL: Record<string, Record<string, number>> = {
  habit:    { beginner: 4, occasional: 4, regular: 3 },
  distance: { beginner: 8, occasional: 6, regular: 5 },
  speed:    { beginner: 6, occasional: 5, regular: 4 },
}

const MILESTONE_LABELS: Record<string, string> = {
  habit:    'First consistent week',
  distance: 'Halfway there',
  speed:    'Feeling the difference',
}

const GOAL_LABELS: Record<string, string> = {
  habit:    'Running 3× / week',
  distance: 'New distance goal',
  speed:    'Faster than today',
}

/**
 * Classify a runner's identity from onboarding data.
 * paceMinPerKm is referenceRaceTimeSeconds / 60 / referenceRaceDistanceKm.
 */
export function getRunningIdentity(
  goal: string,
  experience: string,
  paceMinPerKm: number
): RunnerIdentity {
  if (experience === 'beginner') return IDENTITIES.first_timer
  if (goal === 'speed' || paceMinPerKm < 5.5) return IDENTITIES.speed_seeker
  if (goal === 'distance' && paceMinPerKm > 6.5) return IDENTITIES.endurance_builder
  return IDENTITIES.balanced_athlete
}

/**
 * Project when the user will reach their goal based on onboarding data.
 */
export function projectGoalTimeline(
  goal: string,
  experience: string,
): GoalTimeline {
  const normalizedGoal = goal in WEEKS_TO_GOAL ? goal : 'habit'
  const normalizedExp = experience in (WEEKS_TO_GOAL[normalizedGoal] ?? {}) ? experience : 'beginner'

  const weeks = WEEKS_TO_GOAL[normalizedGoal]![normalizedExp]!
  const milestoneWeek = Math.max(1, Math.floor(weeks / 2))

  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + weeks * 7)

  return {
    weeks,
    milestoneWeek,
    milestoneLabel: MILESTONE_LABELS[normalizedGoal] ?? 'Milestone',
    goalLabel: GOAL_LABELS[normalizedGoal] ?? 'Your goal',
    projectedDate,
  }
}
