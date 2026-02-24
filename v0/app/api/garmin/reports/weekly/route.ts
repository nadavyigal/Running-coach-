import { NextResponse } from 'next/server'

import {
  buildInsightSummaryForUser,
  fetchLatestInsight,
  generateInsightForUser,
  persistGeneratedInsight,
  type GeneratedGarminInsight,
} from '@/lib/server/garmin-insights-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseUserIdFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function parseUserId(req: Request, body?: Record<string, unknown>): number | null {
  const fromHeader = parseUserIdFromValue(req.headers.get('x-user-id'))
  if (fromHeader) return fromHeader

  const fromQuery = parseUserIdFromValue(new URL(req.url).searchParams.get('userId'))
  if (fromQuery) return fromQuery

  if (body) {
    const fromBody = parseUserIdFromValue(body.userId)
    if (fromBody) return fromBody
  }

  return null
}

function confidenceLabelFromScore(score: number | null): 'high' | 'medium' | 'low' {
  if (score == null || !Number.isFinite(score)) return 'low'
  if (score >= 0.85) return 'high'
  if (score >= 0.65) return 'medium'
  return 'low'
}

function scoreFromConfidence(confidence: 'high' | 'medium' | 'low'): number {
  if (confidence === 'high') return 0.9
  if (confidence === 'medium') return 0.7
  return 0.5
}

function formatInsight(row: {
  id: number
  type: 'daily' | 'weekly' | 'post_run'
  period_start: string
  period_end: string
  insight_markdown: string
  confidence: number | null
  created_at: string
}) {
  return {
    id: row.id,
    type: row.type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    contentMd: row.insight_markdown,
    confidence: confidenceLabelFromScore(row.confidence),
    confidenceScore: row.confidence,
    createdAt: row.created_at,
  }
}

async function generateFallbackWeeklyInsight(userId: number): Promise<GeneratedGarminInsight | null> {
  const summary = await buildInsightSummaryForUser({
    userId,
    insightType: 'weekly',
    requestedAt: new Date().toISOString(),
  })

  if (!summary) return null

  const contentMd = [
    '# Weekly Digest',
    ...summary.sections.map((section) => `## ${section.title}\n- ${section.body}`),
    '',
    'This is not medical advice. If you feel pain, dizziness, or unusual symptoms, stop and consult a qualified professional.',
  ].join('\n\n')

  return {
    userId,
    type: 'weekly',
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    insightMarkdown: contentMd,
    confidenceScore: scoreFromConfidence(summary.confidence),
    confidenceLabel: summary.confidence,
    evidence: {
      source: 'deterministic_fallback',
      summary,
      generatedAt: new Date().toISOString(),
    },
  }
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  try {
    const latest = await fetchLatestInsight({ userId, type: 'weekly' })

    if (!latest) {
      return NextResponse.json({ report: null, found: false })
    }

    return NextResponse.json({
      report: formatInsight(latest),
      found: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch weekly report',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const userId = parseUserId(req, body)

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  try {
    const generated =
      (await generateInsightForUser({
        userId,
        insightType: 'weekly',
        requestedAt: new Date().toISOString(),
      }).catch(() => null)) ??
      (await generateFallbackWeeklyInsight(userId))

    if (!generated) {
      return NextResponse.json({ error: 'Unable to generate weekly report' }, { status: 424 })
    }

    await persistGeneratedInsight(generated)

    const latest = await fetchLatestInsight({ userId, type: 'weekly' })
    if (!latest) {
      return NextResponse.json({ error: 'Weekly report generated but unavailable for fetch' }, { status: 500 })
    }

    return NextResponse.json({
      report: formatInsight(latest),
      generated: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate weekly report',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
