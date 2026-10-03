import { createAdminClient } from '@/lib/supabase/admin'

export class EmailSequenceDataSourceError extends Error {
  readonly code: 'not_configured' | 'query_failed'

  constructor(message: string, code: 'not_configured' | 'query_failed') {
    super(message)
    this.name = 'EmailSequenceDataSourceError'
    this.code = code
  }
}

export interface EmailSequenceUser {
  profileId: string
  email: string
  name: string | null
  goal: string | null
  createdAt: Date
}

export interface EmailSequencePlan {
  id: string
  workoutCount: number
}

const PROFILE_PAGE_SIZE = 100

export function isEmailSequenceStoreConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return Boolean(url && serviceRoleKey)
}

export function assertEmailSequenceStoreConfigured(): void {
  if (!isEmailSequenceStoreConfigured()) {
    throw new EmailSequenceDataSourceError(
      'Email sequence data source is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      'not_configured'
    )
  }
}

function getConfiguredAdminClient() {
  assertEmailSequenceStoreConfigured()
  return createAdminClient()
}

export async function listEligibleUsers(): Promise<EmailSequenceUser[]> {
  const supabase = getConfiguredAdminClient()
  const users: EmailSequenceUser[] = []
  let offset = 0

  while (true) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, goal, created_at, auth_user_id')
      .eq('onboarding_complete', true)
      .not('auth_user_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PROFILE_PAGE_SIZE - 1)

    if (error) {
      throw new EmailSequenceDataSourceError(
        `Failed to list profiles for email sequences: ${error.message}`,
        'query_failed'
      )
    }

    if (!profiles?.length) {
      break
    }

    for (const profile of profiles) {
      if (!profile.auth_user_id) continue

      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
        profile.auth_user_id
      )

      if (authError) {
        throw new EmailSequenceDataSourceError(
          `Failed to load auth user ${profile.auth_user_id}: ${authError.message}`,
          'query_failed'
        )
      }

      const email = authData.user?.email?.trim()
      if (!email) continue

      users.push({
        profileId: profile.id,
        email,
        name: profile.name,
        goal: profile.goal,
        createdAt: new Date(profile.created_at),
      })
    }

    if (profiles.length < PROFILE_PAGE_SIZE) {
      break
    }

    offset += PROFILE_PAGE_SIZE
  }

  return users
}

export async function countRuns(profileId: string): Promise<number> {
  const supabase = getConfiguredAdminClient()
  const { count, error } = await supabase
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to count runs for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }

  return count ?? 0
}

export async function getActivePlan(profileId: string): Promise<EmailSequencePlan | null> {
  const supabase = getConfiguredAdminClient()
  const { data: plan, error } = await supabase
    .from('plans')
    .select('id')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to load active plan for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }

  if (!plan) {
    return null
  }

  const { count, error: workoutError } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', plan.id)

  if (workoutError) {
    throw new EmailSequenceDataSourceError(
      `Failed to count workouts for plan ${plan.id}: ${workoutError.message}`,
      'query_failed'
    )
  }

  return {
    id: plan.id,
    workoutCount: count ?? 0,
  }
}

export async function countRunsForPlan(profileId: string, planId: string): Promise<number> {
  const supabase = getConfiguredAdminClient()
  const { data: workouts, error: workoutError } = await supabase
    .from('workouts')
    .select('id')
    .eq('plan_id', planId)

  if (workoutError) {
    throw new EmailSequenceDataSourceError(
      `Failed to load workouts for plan ${planId}: ${workoutError.message}`,
      'query_failed'
    )
  }

  const workoutIds = (workouts ?? []).map((workout) => workout.id)
  if (workoutIds.length === 0) {
    return 0
  }

  const { count, error } = await supabase
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .in('workout_id', workoutIds)

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to count plan runs for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }

  return count ?? 0
}

export async function getLastRunCompletedAt(profileId: string): Promise<Date | null> {
  const supabase = getConfiguredAdminClient()
  const { data, error } = await supabase
    .from('runs')
    .select('completed_at')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to load last run for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }

  return data?.completed_at ? new Date(data.completed_at) : null
}

export async function wasSequenceSent(
  profileId: string,
  sequenceId: string
): Promise<boolean> {
  const supabase = getConfiguredAdminClient()
  const { data, error } = await supabase
    .from('email_sends')
    .select('id')
    .eq('profile_id', profileId)
    .eq('sequence_id', sequenceId)
    .maybeSingle()

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to check email send history for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }

  return Boolean(data)
}

export async function recordSequenceSent(
  profileId: string,
  sequenceId: string
): Promise<void> {
  const supabase = getConfiguredAdminClient()
  const { error } = await supabase.from('email_sends').upsert(
    {
      profile_id: profileId,
      sequence_id: sequenceId,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,sequence_id' }
  )

  if (error) {
    throw new EmailSequenceDataSourceError(
      `Failed to record email send for profile ${profileId}: ${error.message}`,
      'query_failed'
    )
  }
}
