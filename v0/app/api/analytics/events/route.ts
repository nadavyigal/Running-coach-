import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Simple in-memory event store (in production, this would be a database)
interface AnalyticsEvent {
  eventName: string
  userId?: string | number
  properties?: Record<string, unknown>
  timestamp: string
}

const eventStore: AnalyticsEvent[] = []

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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = EventSchema.parse(body)

    const event = {
      eventName: data.eventName,
      userId: data.userId,
      properties: data.properties,
      timestamp: new Date().toISOString(),
    }

    // Store in memory (replace with database in production)
    eventStore.push(event)

    // Keep only last 10000 events in memory
    if (eventStore.length > 10000) {
      eventStore.shift()
    }

    logger.debug('[analytics/events] Event recorded', {
      eventName: data.eventName,
      userId: data.userId,
    })

    return NextResponse.json({ success: true, timestamp: event.timestamp })
  } catch (error) {
    logger.error('[analytics/events] POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
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

    // Calculate date range
    const now = new Date()
    const startDate = new Date(now.getTime() - params.days * 24 * 60 * 60 * 1000)

    // Filter events
    let filtered = eventStore.filter((event) => {
      const eventDate = new Date(event.timestamp)
      if (eventDate < startDate) return false

      if (params.userId && event.userId !== params.userId) return false

      if (params.eventName && event.eventName !== params.eventName) return false

      return true
    })

    // Sort by timestamp descending and limit results
    filtered = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, params.limit)

    logger.debug('[analytics/events] GET query', {
      days: params.days,
      limit: params.limit,
      resultCount: filtered.length,
    })

    // Calculate basic metrics from filtered events
    const eventCounts = filtered.reduce(
      (acc, event) => {
        acc[event.eventName] = (acc[event.eventName] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      events: filtered,
      eventCounts,
      totalCount: filtered.length,
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

    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
