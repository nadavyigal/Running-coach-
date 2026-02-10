import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MetricsQuerySchema = z.object({
  type: z.enum(['funnel', 'challenges', 'retention', 'engagement', 'overview']).default('overview'),
  days: z.coerce.number().default(30),
})

interface FunnelMetrics {
  signup_completed: number
  onboarding_completed: number
  plan_generated: number
  first_run_recorded: number
  timestamp: string
}

interface ChallengeMetrics {
  total_registered: number
  completed: number
  abandoned: number
  avg_streak: number
}

interface RetentionMetrics {
  day_1: number
  week_1: number
  month_1: number
}

interface EngagementMetrics {
  dau: number
  wau: number
  avg_runs_per_week: number
  plan_adherence: number
}

interface OverviewMetrics {
  funnel: FunnelMetrics
  challenges: ChallengeMetrics
  retention: RetentionMetrics
  engagement: EngagementMetrics
}

/**
 * Mock function to generate funnel metrics from analytical data
 * In production, this would query actual analytics databases (PostHog, Segment, etc.)
 */
function generateFunnelMetrics(_days: number): FunnelMetrics {
  // Simulate realistic funnel data
  // Typical signup to first run conversion: 21% (70% * 60% * 50%)
  const totalSignups = Math.floor(Math.random() * 500) + 100 // 100-600 users
  const onboardingCompleted = Math.floor(totalSignups * 0.7) // 70% completion
  const planGenerated = Math.floor(onboardingCompleted * 0.6) // 60% of those generate plans
  const firstRunRecorded = Math.floor(planGenerated * 0.5) // 50% record first run

  return {
    signup_completed: totalSignups,
    onboarding_completed: onboardingCompleted,
    plan_generated: planGenerated,
    first_run_recorded: firstRunRecorded,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Generate challenge metrics
 */
function generateChallengeMetrics(): ChallengeMetrics {
  const registered = Math.floor(Math.random() * 200) + 50
  const completed = Math.floor(registered * 0.35) // 35% completion target
  const abandoned = Math.floor(registered * 0.25) // 25% abandon rate

  return {
    total_registered: registered,
    completed,
    abandoned,
    avg_streak: Math.floor(Math.random() * 5) + 2,
  }
}

/**
 * Generate retention metrics
 */
function generateRetentionMetrics(): RetentionMetrics {
  return {
    day_1: 100, // 100% by definition
    week_1: 40, // 40% target
    month_1: 25, // 25% target
  }
}

/**
 * Generate engagement metrics
 */
function generateEngagementMetrics(): EngagementMetrics {
  return {
    dau: Math.floor(Math.random() * 200) + 50,
    wau: Math.floor(Math.random() * 500) + 150,
    avg_runs_per_week: parseFloat((Math.random() * 3 + 1).toFixed(2)), // 1-4 runs/week
    plan_adherence: parseFloat((Math.random() * 0.4 + 0.5).toFixed(2)), // 50-90%
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const params = MetricsQuerySchema.parse({
      type: searchParams.get('type'),
      days: searchParams.get('days'),
    })

    logger.info('[analytics/metrics] Fetching metrics', { type: params.type, days: params.days })

    let response: FunnelMetrics | ChallengeMetrics | RetentionMetrics | EngagementMetrics | OverviewMetrics

    switch (params.type) {
      case 'funnel':
        response = generateFunnelMetrics(params.days)
        break

      case 'challenges':
        response = generateChallengeMetrics()
        break

      case 'retention':
        response = generateRetentionMetrics()
        break

      case 'engagement':
        response = generateEngagementMetrics()
        break

      case 'overview':
      default:
        response = {
          funnel: generateFunnelMetrics(params.days),
          challenges: generateChallengeMetrics(),
          retention: generateRetentionMetrics(),
          engagement: generateEngagementMetrics(),
        }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
    logger.error('[analytics/metrics] Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
