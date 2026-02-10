import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createCohort,
  listCohorts,
  getCohort,
  addUserToCohort,
  removeUserFromCohort,
  getCohortMembers,
  getCohortMetrics,
  calculateCohortRetention,
  getCohortRetention,
  compareCohorts,
  Cohort,
} from '@/lib/cohort-analysis'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CreateCohortSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['date_based', 'attribute_based', 'custom']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  attributes: z.record(z.unknown()).optional(),
})

const ManageMemberSchema = z.object({
  cohortId: z.string(),
  userId: z.number(),
  action: z.enum(['add', 'remove']),
})

const CompareCohortsSchema = z.object({
  cohortIdA: z.string(),
  cohortIdB: z.string(),
})

/**
 * GET /api/analytics/cohorts
 * List cohorts or get specific cohort details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const cohortId = searchParams.get('cohortId')
    const include = searchParams.get('include') // 'members', 'metrics', 'retention'

    logger.info('[analytics/cohorts] GET request', { cohortId, include })

    if (cohortId) {
      const cohort = getCohort(cohortId)
      if (!cohort) {
        return NextResponse.json(
          { error: 'Cohort not found' },
          { status: 404 }
        )
      }

      const response: Record<string, unknown> = { cohort }

      if (include?.includes('members')) {
        response.members = getCohortMembers(cohortId)
      }

      if (include?.includes('metrics')) {
        response.metrics = getCohortMetrics(cohortId)
      }

      if (include?.includes('retention')) {
        response.retention = getCohortRetention(cohortId)
      }

      return NextResponse.json(response)
    }

    const cohorts = listCohorts()
    return NextResponse.json({ cohorts, total: cohorts.length })
  } catch (error) {
    logger.error('[analytics/cohorts] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cohorts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/cohorts
 * Create cohort, manage members, compare cohorts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('[analytics/cohorts] POST request', { body })

    // Create cohort
    if (body.name && !body.action && !body.cohortIdA) {
      const params = CreateCohortSchema.parse(body)
      const cohort: Cohort = {
        id: params.id,
        name: params.name,
        description: params.description,
        type: params.type,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        attributes: params.attributes,
        createdAt: new Date(),
        userCount: 0,
      }

      const created = await createCohort(cohort)
      return NextResponse.json(created, { status: 201 })
    }

    // Manage cohort members
    if (body.action === 'manage_member') {
      const params = ManageMemberSchema.parse(body)

      if (params.action === 'add') {
        await addUserToCohort(params.cohortId, params.userId)
        const members = getCohortMembers(params.cohortId)
        return NextResponse.json({ cohortId: params.cohortId, members })
      } else if (params.action === 'remove') {
        await removeUserFromCohort(params.cohortId, params.userId)
        const members = getCohortMembers(params.cohortId)
        return NextResponse.json({ cohortId: params.cohortId, members })
      }
    }

    // Calculate retention
    if (body.action === 'calculate_retention') {
      const retention = await calculateCohortRetention(body.cohortId)
      return NextResponse.json(retention)
    }

    // Compare cohorts
    if (body.action === 'compare') {
      const params = CompareCohortsSchema.parse(body)
      const comparison = await compareCohorts(params.cohortIdA, params.cohortIdB)
      if (!comparison) {
        return NextResponse.json(
          { error: 'Could not compare cohorts' },
          { status: 400 }
        )
      }
      return NextResponse.json(comparison)
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('[analytics/cohorts] POST error:', error)

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
