export type GarminFirstAhaStatus = 'ready' | 'partial' | 'insufficient_data' | 'error'

export type RunnerTypeId =
  | 'new_or_low_data_runner'
  | 'building_consistency'
  | 'consistent_base_builder'
  | 'overreaching_risk'
  | 'race_focused'

export type GuardrailLevel = 'green' | 'yellow' | 'red'

export type StarterDayType =
  | 'easy_run'
  | 'long_run'
  | 'recovery'
  | 'rest'
  | 'strength'
  | 'walk_run'

export type StarterIntensity = 'easy' | 'moderate' | 'hard' | 'rest'

export interface GarminFirstAhaRunInput {
  completedAt: string
  durationSeconds: number | null
  distanceMeters: number | null
  averageHeartRate: number | null
}

export interface GarminFirstAhaWellnessDay {
  date: string
  hrv: number | null
  sleepScore: number | null
  restingHr: number | null
  stress: number | null
}

export interface GarminFirstAhaResult {
  status: GarminFirstAhaStatus
  generatedAt: string
  dataWindow: {
    activitiesDays: number
    wellnessDays?: number
  }
  profile: {
    runnerType: string
    headline: string
    summaryBullets: string[]
    confidence: 'high' | 'medium' | 'low'
  }
  signals: {
    consistency: {
      runsLast14Days: number
      runsLast28Days: number
      weeklyPatternLabel: string
    }
    load: {
      weeklyDistanceTrend?: string
      acwrLabel?: 'low' | 'stable' | 'elevated' | 'unknown'
      longestRunLabel?: string
    }
    intensity: {
      label: string
      easyShare?: number
      hardShare?: number
      source: 'heart_rate' | 'pace' | 'mixed' | 'insufficient'
    }
    recovery?: {
      readinessLabel: string
      availableSignals: string[]
      missingSignals: string[]
    }
  }
  guardrails: {
    level: GuardrailLevel
    message: string
    reasons: string[]
  }
  starterPlan: {
    title: string
    rationale: string
    days: Array<{
      date: string
      type: StarterDayType
      label: string
      target?: string
      intensity: StarterIntensity
      purpose: string
    }>
  }
  recommendedChallenge: {
    id: string
    title: string
    reason: string
    fitScoreLabel: string
  }
  disclaimers: string[]
}

export const RUNNER_TYPE_LABELS: Record<RunnerTypeId, string> = {
  new_or_low_data_runner: 'Getting started',
  building_consistency: 'Building consistency',
  consistent_base_builder: 'Base-building runner',
  overreaching_risk: 'Recovery-focused runner',
  race_focused: 'Fitness-focused runner',
}

export const MEDICAL_DISCLAIMER =
  'This is coaching guidance, not medical advice. Stop and seek professional help if you feel pain or dizziness.'
