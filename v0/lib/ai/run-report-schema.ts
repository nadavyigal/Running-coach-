import { z } from 'zod'

/**
 * Output schema for /api/run-report. Moved unchanged from the route (Next.js
 * route files may only export handlers) so evals can use the production
 * schema. The .describe() text is per-field guidance the AI SDK sends with the
 * schema. Keys, enums and optionality are an iOS contract: do not change them.
 */
const SafetyFlagSchema = z.object({
  code: z.enum(['load_spike', 'injury_signal', 'heat_risk', 'missing_data', 'uncertain']),
  severity: z.enum(['low', 'medium', 'high']),
  message: z.string().min(1),
})

const CoachScoreSchema = z.object({
  overall: z.coerce.number().min(0).max(100),
  execution: z.coerce.number().min(0).max(100).optional(),
  effort: z.coerce.number().min(0).max(100).optional(),
  consistency: z.coerce.number().min(0).max(100).optional(),
  form: z.coerce.number().min(0).max(100).optional(),
}).optional()

const BiomechanicsSchema = z.object({
  cadenceAssessment: z.string().optional(),
  groundContactAssessment: z.string().optional(),
  verticalOscillationAssessment: z.string().optional(),
  strideLengthAssessment: z.string().optional(),
  overallFormRating: z.enum(['excellent', 'good', 'fair', 'needs-work']).optional(),
  keyRecommendation: z.string().optional(),
}).optional().describe(
  'Only when runningDynamics is provided. Typical reference ranges: cadence about 170-180 spm, ground contact under 250 ms, vertical oscillation under 8 cm. Treat them as references, not targets every runner must hit.'
)

const DetailedRecoverySchema = z.object({
  immediate: z.string().min(1),
  next2h: z.string().min(1),
  next24h: z.string().min(1),
  next48h: z.string().optional(),
  readinessEstimate: z.string().optional(),
}).optional().describe('Timed phases: immediate, next2h, next24h, and next48h after hard efforts only.')

const StructuredWorkoutSchema = z.object({
  sessionType: z.string().min(1),
  warmup: z.string().min(1),
  main: z.string().min(1),
  cooldown: z.string().min(1),
  totalDurationMin: z.coerce.number().min(0).optional(),
  targetEffort: z.string().optional(),
  coachingCue: z.string().optional(),
}).optional().describe('Phased next workout: warmup, main, cooldown, total minutes, target effort, one coaching cue.')

const TrainingContextSchema = z.object({
  weeklyVolumeKm: z.coerce.number().min(0).optional(),
  weeklyRunCount: z.coerce.number().min(0).optional(),
  volumeVsLastWeek: z.string().optional(),
  acwrZone: z.string().optional(),
  planPhase: z.string().optional(),
  planFitSummary: z.string().optional(),
}).optional().describe('Only when historicalContext.recentRuns is provided. ACWR 0.8-1.3 is the usual safe range.')

const ComparisonSchema = z.object({
  vsSimilarRuns: z.string().optional(),
  paceImprovement: z.string().optional(),
  cadenceTrend: z.string().optional(),
  hrTrend: z.string().optional(),
}).optional().describe('Only when similar past runs are provided: pace, cadence and heart-rate trends.')

const RaceReadinessSchema = z.object({
  estimatedVdot: z.coerce.number().min(0).optional(),
  predictions: z.array(z.object({
    distance: z.string(),
    time: z.string(),
  })).optional(),
  fitnessDirection: z.enum(['improving', 'maintaining', 'declining']).optional(),
  note: z.string().optional(),
}).optional().describe('Only when VDOT is known: 5K / 10K / half / marathon predictions and fitness direction.')

export const InsightSchema = z.object({
  runId: z.number().int().nonnegative(),
  summary: z
    .array(z.string().min(1))
    .min(1)
    .max(4)
    .describe(
      'Up to 4 short lines: 1) headline with distance, duration and average pace; 2) one specific thing that went well; 3) the adaptation this run builds; 4) how it sets up the next session.'
    ),
  effort: z.enum(['easy', 'moderate', 'hard']).describe('From RPE, pace, heart rate and run type.'),
  metrics: z.object({
    paceStability: z.string().min(1),
    cadenceNote: z.string().optional(),
    hrNote: z.string().optional(),
  }),
  pacingAnalysis: z
    .string()
    .min(1)
    .optional()
    .describe(
      '1-2 sentences. If strideDetection.detected is true, describe the strides (neuromuscular activation, running economy) and compare peak pace with average; otherwise assess consistency, fade or negative split.'
    ),
  paceConsistency: z.enum(['consistent', 'fading', 'negative-split', 'erratic']).optional(),
  paceVariability: z.coerce.number().min(0).optional(),
  recovery: z.object({
    priority: z.array(z.string().min(1)).min(1).describe('2-3 concrete recovery steps.'),
    optional: z.array(z.string().min(1)).optional(),
  }),
  nextSessionNudge: z.string().optional(),
  safetyFlags: z.array(SafetyFlagSchema).optional(),
  coachScore: CoachScoreSchema,
  biomechanics: BiomechanicsSchema,
  detailedRecovery: DetailedRecoverySchema,
  structuredNextWorkout: StructuredWorkoutSchema,
  trainingContext: TrainingContextSchema,
  comparison: ComparisonSchema,
  raceReadiness: RaceReadinessSchema,
})

export type RunInsight = z.infer<typeof InsightSchema>
