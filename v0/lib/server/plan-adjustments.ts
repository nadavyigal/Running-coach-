import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export interface PlanAdjustmentInsertInput {
  userId: number
  authUserId?: string | null
  sessionDate?: string | null
  oldSession?: Record<string, unknown> | null
  newSession?: Record<string, unknown> | null
  reasons?: unknown
  evidence?: unknown
}

export interface PlanAdjustmentRow {
  id: number
  user_id: number
  auth_user_id: string | null
  created_at: string
  session_date: string | null
  old_session: Record<string, unknown> | null
  new_session: Record<string, unknown> | null
  reasons: unknown
  evidence: unknown
}

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export async function recordPlanAdjustment(input: PlanAdjustmentInsertInput): Promise<void> {
  const supabase = createAdminClient()

  const payload = {
    user_id: input.userId,
    auth_user_id: input.authUserId ?? null,
    session_date: toDateOnly(input.sessionDate),
    old_session: toRecord(input.oldSession),
    new_session: toRecord(input.newSession),
    reasons: input.reasons ?? null,
    evidence: input.evidence ?? null,
  }

  const { error } = await supabase.from('plan_adjustments').insert(payload)
  if (error) {
    throw new Error(`Failed to insert plan_adjustments row: ${error.message}`)
  }
}

export async function getLatestPlanAdjustments(params: {
  userId: number
  limit?: number
}): Promise<PlanAdjustmentRow[]> {
  const supabase = createAdminClient()
  const limit = Math.min(Math.max(params.limit ?? 3, 1), 20)

  const { data, error } = await supabase
    .from('plan_adjustments')
    .select('id,user_id,auth_user_id,created_at,session_date,old_session,new_session,reasons,evidence')
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch plan_adjustments: ${error.message}`)
  }

  return (data ?? []) as PlanAdjustmentRow[]
}
