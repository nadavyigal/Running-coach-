import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  upsertFeatureFlag,
  getFeatureFlag,
  listFeatureFlags,
  isFeatureEnabled,
  enableFeaturePercentage,
  enableFeatureForUsers,
  launchFeature,
  disableFeature,
  linkToExperiment,
  FeatureFlag,
} from '@/lib/feature-flags'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CreateFlagSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  rolloutType: z.enum(['all', 'percentage', 'users', 'cohorts']).default('all'),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targetedUsers: z.array(z.number()).optional(),
  targetedCohorts: z.array(z.string()).optional(),
  targetingRules: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  experimentId: z.string().optional(),
})

const UpdateRolloutSchema = z.object({
  flagId: z.string(),
  action: z.enum(['enable_percentage', 'enable_users', 'launch', 'disable', 'link_experiment']),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targetedUsers: z.array(z.number()).optional(),
  experimentId: z.string().optional(),
})

/**
 * GET /api/analytics/feature-flags
 * Get flags or check if a flag is enabled
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const flagId = searchParams.get('flagId')
    const userId = searchParams.get('userId')
    const checkEnabled = searchParams.get('checkEnabled')

    logger.info('[analytics/feature-flags] GET request', { flagId, userId, checkEnabled })

    if (flagId && checkEnabled) {
      const enabled = await isFeatureEnabled(flagId, userId ? parseInt(userId) : undefined)
      return NextResponse.json({ flagId, enabled, userId })
    }

    if (flagId) {
      const flag = getFeatureFlag(flagId)
      if (!flag) {
        return NextResponse.json(
          { error: 'Feature flag not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(flag)
    }

    const flags = listFeatureFlags()
    return NextResponse.json({ flags, total: flags.length })
  } catch (error) {
    logger.error('[analytics/feature-flags] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/feature-flags
 * Create or update feature flag, or perform rollout action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('[analytics/feature-flags] POST request', { body })

    // Create/update flag
    if (body.name && !body.action) {
      const params = CreateFlagSchema.parse(body)
      const flag: FeatureFlag = {
        id: params.id,
        name: params.name,
        description: params.description,
        enabled: params.enabled,
        rolloutType: params.rolloutType,
        rolloutPercentage: params.rolloutPercentage,
        targetedUsers: params.targetedUsers,
        targetedCohorts: params.targetedCohorts,
        targetingRules: params.targetingRules,
        config: params.config,
        experimentId: params.experimentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const created = await upsertFeatureFlag(flag)
      return NextResponse.json(created, { status: 201 })
    }

    // Perform rollout actions
    if (body.action) {
      const params = UpdateRolloutSchema.parse(body)

      switch (params.action) {
        case 'enable_percentage': {
          const updated = await enableFeaturePercentage(
            params.flagId,
            params.rolloutPercentage || 0
          )
          return NextResponse.json(updated)
        }

        case 'enable_users': {
          const updated = await enableFeatureForUsers(
            params.flagId,
            params.targetedUsers || []
          )
          return NextResponse.json(updated)
        }

        case 'launch': {
          const updated = await launchFeature(params.flagId)
          return NextResponse.json(updated)
        }

        case 'disable': {
          const updated = await disableFeature(params.flagId)
          return NextResponse.json(updated)
        }

        case 'link_experiment': {
          const updated = await linkToExperiment(params.flagId, params.experimentId || '')
          return NextResponse.json(updated)
        }
      }
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('[analytics/feature-flags] POST error:', error)

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
