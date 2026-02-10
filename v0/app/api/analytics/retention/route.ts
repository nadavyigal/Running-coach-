import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  recordUserRetention,
  getUserRetention,
  calculateChurnRisk,
  determineRetentionStatus,
  getRetentionCohort,
  recordRetentionCohort,
  calculateRetentionSummary,
  getUsersAtRisk,
  getChurnedUsers,
  getReactivationCandidates,
  trackReactivation,
  trackChurn,
  UserRetention,
  RetentionCohort,
} from '@/lib/retention-analysis'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const RecordRetentionSchema = z.object({
  userId: z.number(),
  signupDate: z.string().datetime(),
  lastActiveDate: z.string().datetime(),
  daysSinceSignup: z.number(),
  daysSinceActive: z.number(),
  daysBetweenSessions: z.number(),
  totalSessions: z.number(),
  totalRuns: z.number(),
  totalDistanceKm: z.number(),
})

const RecordRetentionCohortSchema = z.object({
  cohortName: z.string(),
  cohortSize: z.number(),
  day_0: z.number(),
  day_1: z.number(),
  day_3: z.number(),
  day_7: z.number(),
  day_14: z.number(),
  day_30: z.number(),
  day_60: z.number(),
  day_90: z.number(),
  avgDaysSinceSignup: z.number(),
  avgDaysSinceLastActive: z.number(),
  churnRate: z.number(),
})

/**
 * GET /api/analytics/retention
 * Get retention data or summary
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const userId = searchParams.get('userId')
    const cohortName = searchParams.get('cohortName')
    const action = searchParams.get('action') // 'summary', 'at_risk', 'churned', 'reactivation'

    logger.info('[analytics/retention] GET request', {
      userId,
      cohortName,
      action,
    })

    // Get specific user retention
    if (userId) {
      const retention = getUserRetention(parseInt(userId))
      if (!retention) {
        return NextResponse.json(
          { error: 'User retention data not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(retention)
    }

    // Get cohort retention
    if (cohortName) {
      const retention = getRetentionCohort(cohortName)
      if (!retention) {
        return NextResponse.json(
          { error: 'Cohort retention data not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(retention)
    }

    // Get summary or lists based on action
    switch (action) {
      case 'summary': {
        const summary = calculateRetentionSummary()
        return NextResponse.json(summary)
      }

      case 'at_risk': {
        const riskThreshold = parseInt(searchParams.get('riskThreshold') || '60')
        const users = getUsersAtRisk(riskThreshold)
        return NextResponse.json({ users, total: users.length })
      }

      case 'churned': {
        const daysSinceActive = parseInt(searchParams.get('daysSinceActive') || '90')
        const users = getChurnedUsers(daysSinceActive)
        return NextResponse.json({ users, total: users.length })
      }

      case 'reactivation': {
        const candidates = getReactivationCandidates()
        return NextResponse.json({ candidates, total: candidates.length })
      }

      default: {
        const summary = calculateRetentionSummary()
        return NextResponse.json(summary)
      }
    }
  } catch (error) {
    logger.error('[analytics/retention] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retention data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/retention
 * Record retention data or track events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.info('[analytics/retention] POST request', { body })

    // Record user retention
    if (body.userId && body.daysSinceSignup !== undefined) {
      const params = RecordRetentionSchema.parse(body)

      const retention: UserRetention = {
        userId: params.userId,
        signupDate: new Date(params.signupDate),
        lastActiveDate: new Date(params.lastActiveDate),
        daysSinceSignup: params.daysSinceSignup,
        daysSinceActive: params.daysSinceActive,
        daysBetweenSessions: params.daysBetweenSessions,
        totalSessions: params.totalSessions,
        totalRuns: params.totalRuns,
        totalDistanceKm: params.totalDistanceKm,
        status: 'active',
        churnRiskScore: 0,
        updatedAt: new Date(),
      }

      // Calculate churn risk
      retention.churnRiskScore = calculateChurnRisk(retention)
      retention.status = determineRetentionStatus(retention)

      await recordUserRetention(retention)

      return NextResponse.json(retention, { status: 201 })
    }

    // Record cohort retention
    if (body.cohortName && body.cohortSize !== undefined) {
      const params = RecordRetentionCohortSchema.parse(body)

      const cohort: RetentionCohort = {
        cohortName: params.cohortName,
        cohortSize: params.cohortSize,
        day_0: params.day_0,
        day_1: params.day_1,
        day_3: params.day_3,
        day_7: params.day_7,
        day_14: params.day_14,
        day_30: params.day_30,
        day_60: params.day_60,
        day_90: params.day_90,
        avgDaysSinceSignup: params.avgDaysSinceSignup,
        avgDaysSinceLastActive: params.avgDaysSinceLastActive,
        churnRate: params.churnRate,
      }

      await recordRetentionCohort(cohort)

      return NextResponse.json(cohort, { status: 201 })
    }

    // Track reactivation event
    if (body.action === 'reactivate' && body.userId) {
      await trackReactivation(body.userId)
      return NextResponse.json({
        userId: body.userId,
        action: 'reactivated',
      })
    }

    // Track churn event
    if (body.action === 'churn' && body.userId) {
      await trackChurn(body.userId)
      return NextResponse.json({
        userId: body.userId,
        action: 'churned',
      })
    }

    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('[analytics/retention] POST error:', error)

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
