import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createExperiment,
  listExperiments,
  getExperiment,
  startExperiment,
  endExperiment,
  assignUserToVariant,
  Experiment,
} from '@/lib/ab-testing'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CreateExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    features: z.record(z.unknown()),
    trafficAllocation: z.number().min(0).max(1),
  })),
  primaryMetric: z.string(),
  secondaryMetrics: z.array(z.string()).optional(),
  hypothesis: z.string(),
  expectedLift: z.number().optional(),
  sampleSize: z.number().optional(),
  duration: z.number().optional(),
})

const StartExperimentSchema = z.object({
  experimentId: z.string(),
})

const EndExperimentSchema = z.object({
  experimentId: z.string(),
})

const AssignUserSchema = z.object({
  experimentId: z.string(),
  userId: z.number(),
})

/**
 * GET /api/analytics/ab-tests
 * List experiments
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const experimentId = searchParams.get('experimentId')
    const status = searchParams.get('status')

    logger.info('[analytics/ab-tests] GET request', { experimentId, status })

    if (experimentId) {
      const experiment = getExperiment(experimentId)
      if (!experiment) {
        return NextResponse.json(
          { error: 'Experiment not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(experiment)
    }

    const experiments = listExperiments(
      status as 'draft' | 'running' | 'paused' | 'completed' | 'archived' | undefined
    )
    return NextResponse.json({ experiments, total: experiments.length })
  } catch (error) {
    logger.error('[analytics/ab-tests] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/ab-tests
 * Create, start, end experiment, or assign user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('[analytics/ab-tests] POST request', { body })

    // Create experiment
    if (body.variants && body.primaryMetric) {
      const params = CreateExperimentSchema.parse(body)
      const experiment: Experiment = {
        id: params.id,
        name: params.name,
        description: params.description,
        status: 'draft',
        startDate: new Date(),
        variants: params.variants,
        primaryMetric: params.primaryMetric,
        secondaryMetrics: params.secondaryMetrics,
        hypothesis: params.hypothesis,
        expectedLift: params.expectedLift,
        sampleSize: params.sampleSize,
        duration: params.duration,
      }

      const created = await createExperiment(experiment)
      return NextResponse.json(created, { status: 201 })
    }

    // Start experiment
    if (body.action === 'start') {
      const { experimentId } = StartExperimentSchema.parse(body)
      await startExperiment(experimentId)
      const experiment = getExperiment(experimentId)
      return NextResponse.json(experiment)
    }

    // End experiment
    if (body.action === 'end') {
      const { experimentId } = EndExperimentSchema.parse(body)
      const results = await endExperiment(experimentId)
      return NextResponse.json({ experimentId, results })
    }

    // Assign user to variant
    if (body.action === 'assign') {
      const { experimentId, userId } = AssignUserSchema.parse(body)
      const variant = await assignUserToVariant(experimentId, userId)
      if (!variant) {
        return NextResponse.json(
          { error: 'Could not assign user to experiment' },
          { status: 400 }
        )
      }
      return NextResponse.json(variant)
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('[analytics/ab-tests] POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
