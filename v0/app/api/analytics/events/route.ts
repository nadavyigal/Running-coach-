import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const EventSchema = z.object({
  eventName: z.string(),
  userId: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.any()).optional(),
})

const QuerySchema = z.object({
  days: z.coerce.number().optional().default(7),
  limit: z.coerce.number().optional().default(1000),
  userId: z.union([z.string(), z.number()]).optional(),
  eventName: z.string().optional(),
})

/**
 * POST: Record a new analytics event
 * Used by client-side analytics tracking to log user interactions
 * Stores events in PostgreSQL via Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = EventSchema.parse(body)

    const supabase = await createClient()

    // Store in Supabase PostgreSQL
    const { error } = await supabase.from('analytics_events').insert({
      event_name: data.eventName,
      user_id: data.userId?.toString() || null,
      properties: data.properties || {},
      timestamp: new Date().toISOString(),
    })

    if (error) {
      logger.error('[analytics/events] Supabase insert error:', error)
      throw error
    }

    logger.debug('[analytics/events] Event recorded', {
      eventName: data.eventName,
      userId: data.userId,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('[analytics/events] POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to record event' },
      { status: 500 }
    )
  }
}

/**
 * GET: Retrieve analytics events for analysis
 * Query parameters:
 *  - days: number of days to look back (default: 7)
 *  - limit: max number of events to return (default: 1000)
 *  - userId: filter by specific user
 *  - eventName: filter by specific event name
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const params = QuerySchema.parse({
      days: searchParams.get('days'),
      limit: searchParams.get('limit'),
      userId: searchParams.get('userId'),
      eventName: searchParams.get('eventName'),
    })

    const supabase = await createClient()
    const startDate = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000)

    // Build query
    let query = supabase
      .from('analytics_events')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(params.limit)

    if (params.userId) {
      query = query.eq('user_id', params.userId.toString())
    }

    if (params.eventName) {
      query = query.eq('event_name', params.eventName)
    }

    const { data: events, error } = await query

    if (error) {
      logger.error('[analytics/events] Supabase query error:', error)
      throw error
    }

    const now = new Date()

    // Calculate event counts
    interface AnalyticsEventRecord {
      event_name: string
      [key: string]: unknown
    }

    const eventCounts = (events || []).reduce(
      (acc, event: AnalyticsEventRecord) => {
        acc[event.event_name] = (acc[event.event_name] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    logger.debug('[analytics/events] GET query', {
      days: params.days,
      limit: params.limit,
      resultCount: events?.length || 0,
    })

    return NextResponse.json({
      events: events || [],
      eventCounts,
      totalCount: events?.length || 0,
      queryParams: params,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    logger.error('[analytics/events] GET error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
