import { NextResponse } from 'next/server'

import { CHALLENGE_TEMPLATES } from '@/lib/challengeTemplates'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ChallengeRow = {
  id: string
  slug: string
  title: string
  description: string | null
  duration_days: number
  rules: Record<string, unknown> | null
}

type ChallengeEnrollmentRow = {
  challenge_id: string
}

function parseUserId(req: Request, body?: Record<string, unknown>): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader.length > 0) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromQuery = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (fromQuery.length > 0) {
    const parsed = Number.parseInt(fromQuery, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const rawFromBody = body?.userId
  if (typeof rawFromBody === 'number' && Number.isFinite(rawFromBody) && rawFromBody > 0) {
    return Math.round(rawFromBody)
  }

  if (typeof rawFromBody === 'string' && rawFromBody.trim().length > 0) {
    const parsed = Number.parseInt(rawFromBody, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

function toSeedPayload() {
  return CHALLENGE_TEMPLATES.map((template) => ({
    slug: template.slug,
    title: template.name,
    description: template.description,
    duration_days: template.durationDays,
    rules: {
      difficulty: template.difficulty,
      category: template.category,
      workoutPattern: template.workoutPattern,
      coachTone: template.coachTone,
      promise: template.promise,
    },
  }))
}

async function fetchOrSeedChallenges() {
  const supabase = createAdminClient()

  const existing = await supabase
    .from('challenges')
    .select('id,slug,title,description,duration_days,rules')
    .order('created_at', { ascending: true })

  if (existing.error) {
    throw new Error(`Failed to load challenges: ${existing.error.message}`)
  }

  if ((existing.data ?? []).length > 0) {
    return (existing.data ?? []) as ChallengeRow[]
  }

  const seeded = await supabase
    .from('challenges')
    .upsert(toSeedPayload(), { onConflict: 'slug' })
    .select('id,slug,title,description,duration_days,rules')

  if (seeded.error) {
    throw new Error(`Failed to seed challenges: ${seeded.error.message}`)
  }

  return (seeded.data ?? []) as ChallengeRow[]
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const payload = (await req.json()) as unknown
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

async function resolveAuthUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

async function resolveChallengeBySelector(input: {
  challengeId?: string | null
  slug?: string | null
}): Promise<ChallengeRow | null> {
  const supabase = createAdminClient()

  if (input.challengeId) {
    const byId = await supabase
      .from('challenges')
      .select('id,slug,title,description,duration_days,rules')
      .eq('id', input.challengeId)
      .maybeSingle()

    if (byId.error) {
      throw new Error(`Failed to load challenge by id: ${byId.error.message}`)
    }

    return (byId.data as ChallengeRow | null) ?? null
  }

  if (!input.slug) return null

  const existing = await supabase
    .from('challenges')
    .select('id,slug,title,description,duration_days,rules')
    .eq('slug', input.slug)
    .maybeSingle()

  if (existing.error) {
    throw new Error(`Failed to load challenge by slug: ${existing.error.message}`)
  }

  if (existing.data) {
    return existing.data as ChallengeRow
  }

  const template = CHALLENGE_TEMPLATES.find((entry) => entry.slug === input.slug)
  if (!template) return null

  const inserted = await supabase
    .from('challenges')
    .upsert(
      {
        slug: template.slug,
        title: template.name,
        description: template.description,
        duration_days: template.durationDays,
        rules: {
          difficulty: template.difficulty,
          category: template.category,
          workoutPattern: template.workoutPattern,
          coachTone: template.coachTone,
          promise: template.promise,
        },
      },
      { onConflict: 'slug' }
    )
    .select('id,slug,title,description,duration_days,rules')
    .single()

  if (inserted.error) {
    throw new Error(`Failed to provision challenge: ${inserted.error.message}`)
  }

  return inserted.data as ChallengeRow
}

export async function GET(req: Request) {
  const userId = parseUserId(req)

  try {
    const [challenges, enrollments] = await Promise.all([
      fetchOrSeedChallenges(),
      userId
        ? createAdminClient()
            .from('challenge_enrollments')
            .select('challenge_id')
            .eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (enrollments.error) {
      throw new Error(`Failed to load challenge enrollments: ${enrollments.error.message}`)
    }

    const joinedChallengeIds = new Set(
      ((enrollments.data ?? []) as ChallengeEnrollmentRow[]).map((row) => row.challenge_id)
    )

    return NextResponse.json({
      challenges: challenges.map((challenge) => ({
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.duration_days,
        rules: challenge.rules,
        joined: joinedChallengeIds.has(challenge.id),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load challenges',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req)
  const userId = parseUserId(req, body)

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''

  if (!challengeId && !slug) {
    return NextResponse.json({ error: 'challengeId or slug is required' }, { status: 400 })
  }

  const startedAtRaw = typeof body.startedAt === 'string' ? body.startedAt : null
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date()
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startedAt date' }, { status: 400 })
  }

  startedAt.setHours(0, 0, 0, 0)
  const startedAtDate = startedAt.toISOString().slice(0, 10)

  try {
    const challenge = await resolveChallengeBySelector({
      challengeId: challengeId || null,
      slug: slug || null,
    })

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const authUserId = await resolveAuthUserId()

    const upserted = await createAdminClient()
      .from('challenge_enrollments')
      .upsert(
        {
          user_id: userId,
          auth_user_id: authUserId,
          challenge_id: challenge.id,
          started_at: startedAtDate,
          progress: {
            completedDays: [],
            completionSource: {},
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,challenge_id', ignoreDuplicates: true }
      )
      .select('challenge_id,started_at,completed_at,progress')
      .single()

    if (upserted.error) {
      throw new Error(`Failed to join challenge: ${upserted.error.message}`)
    }

    return NextResponse.json(
      {
        joined: true,
        challenge: {
          id: challenge.id,
          slug: challenge.slug,
          title: challenge.title,
          description: challenge.description,
          durationDays: challenge.duration_days,
        },
        enrollment: upserted.data,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to join challenge',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
