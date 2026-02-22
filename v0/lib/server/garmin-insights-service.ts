import "server-only"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

import {
  buildGarminInsightSummary,
  buildInsightPrompts,
  type DailyInsightInput,
  type GarminInsightConfidence,
  type GarminInsightSummary,
  type GarminInsightType,
  type PostRunInsightInput,
  type WeeklyInsightInput,
} from "@/lib/garminInsightBuilder"
import { logger } from "@/lib/logger"
import { getGarminOAuthState } from "@/lib/server/garmin-oauth-store"
import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"

interface DerivedMetricRow {
  date: string
  acwr: number | null
  weekly_volume_m: number | null
  weekly_intensity_score: number | null
  flags_json: Record<string, unknown> | null
}

interface GarminDailyRow {
  date: string
  sleep_score: number | null
  sleep_duration_s: number | null
  hrv: number | null
  stress: number | null
  training_readiness: number | null
}

interface GarminActivityRow {
  activity_id: string
  start_time: string | null
  sport: string | null
  distance_m: number | null
  duration_s: number | null
  avg_hr: number | null
}

export interface GenerateGarminInsightRequest {
  userId: number
  insightType: GarminInsightType
  requestedAt?: string
  plannedWorkout?: string | null
  activityId?: string | null
  activityDate?: string | null
  derivedSummary?: {
    acwr?: number | null
    readinessScore?: number | null
    readinessLabel?: string
    confidence?: GarminInsightConfidence
    flags?: string[]
  }
}

export interface GeneratedGarminInsight {
  userId: number
  type: GarminInsightType
  periodStart: string
  periodEnd: string
  insightMarkdown: string
  confidenceScore: number
  confidenceLabel: GarminInsightConfidence
  evidence: Record<string, unknown>
}

interface AiInsightRow {
  id: number
  type: GarminInsightType
  period_start: string
  period_end: string
  insight_markdown: string
  confidence: number | null
  evidence_json: Record<string, unknown> | null
  created_at: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toConfidence(value: unknown, fallback: GarminInsightConfidence = "medium"): GarminInsightConfidence {
  const raw = getString(value)?.toLowerCase()
  if (raw === "high" || raw === "medium" || raw === "low") return raw
  return fallback
}

function confidenceToScore(confidence: GarminInsightConfidence): number {
  if (confidence === "high") return 0.9
  if (confidence === "medium") return 0.7
  return 0.5
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function toIsoDate(value: string | null | undefined, fallback = new Date().toISOString().slice(0, 10)): string {
  if (!value) return fallback
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return fallback
  return new Date(parsed).toISOString().slice(0, 10)
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const parsed = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(parsed + deltaDays * dayMs).toISOString().slice(0, 10)
}

function getSafetyFlagsFromDerived(row: DerivedMetricRow | null): string[] {
  if (!row) return []
  const flagsJson = asRecord(row.flags_json)
  const flags = flagsJson.flags
  if (!Array.isArray(flags)) return []
  return flags.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function resolveReadinessFromDerived(row: DerivedMetricRow | null): {
  score: number | null
  label: string | null
  confidence: GarminInsightConfidence
} {
  if (!row) return { score: null, label: null, confidence: "low" }
  const flagsJson = asRecord(row.flags_json)
  const readiness = asRecord(flagsJson.readiness)
  return {
    score: getNumber(readiness.score) ?? getNumber(row.weekly_intensity_score),
    label: getString(readiness.label),
    confidence: toConfidence(readiness.confidence ?? flagsJson.confidence, "medium"),
  }
}

function classifyWorkoutType(activity: GarminActivityRow): string {
  const sport = (activity.sport || "").toLowerCase()
  if (!sport.includes("run")) return "cross"

  const distanceKm = activity.distance_m != null ? activity.distance_m / 1000 : null
  const avgHr = activity.avg_hr

  if (distanceKm != null && distanceKm >= 16) return "long"
  if (avgHr != null && avgHr >= 165) return "intervals"
  if (avgHr != null && avgHr >= 150) return "tempo"
  return "easy"
}

function isRunActivity(activity: GarminActivityRow): boolean {
  const sport = (activity.sport || "").toLowerCase()
  return sport.includes("run")
}

function paceSecondsPerKm(activity: GarminActivityRow): number | null {
  if (activity.duration_s == null || activity.distance_m == null || activity.distance_m <= 0) return null
  return activity.duration_s / (activity.distance_m / 1000)
}

async function loadUserRows(userId: number): Promise<{
  derivedRows: DerivedMetricRow[]
  dailyRows: GarminDailyRow[]
  activityRows: GarminActivityRow[]
}> {
  const supabase = createAdminClient()

  const [derivedQuery, dailyQuery, activityQuery] = await Promise.all([
    supabase
      .from("training_derived_metrics")
      .select("date,acwr,weekly_volume_m,weekly_intensity_score,flags_json")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(42),
    supabase
      .from("garmin_daily_metrics")
      .select("date,sleep_score,sleep_duration_s,hrv,stress,training_readiness")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(42),
    supabase
      .from("garmin_activities")
      .select("activity_id,start_time,sport,distance_m,duration_s,avg_hr")
      .eq("user_id", userId)
      .order("start_time", { ascending: false })
      .limit(120),
  ])

  if (derivedQuery.error) throw new Error(`Failed to load training_derived_metrics: ${derivedQuery.error.message}`)
  if (dailyQuery.error) throw new Error(`Failed to load garmin_daily_metrics: ${dailyQuery.error.message}`)
  if (activityQuery.error) throw new Error(`Failed to load garmin_activities: ${activityQuery.error.message}`)

  return {
    derivedRows: (derivedQuery.data ?? []) as DerivedMetricRow[],
    dailyRows: (dailyQuery.data ?? []) as GarminDailyRow[],
    activityRows: (activityQuery.data ?? []) as GarminActivityRow[],
  }
}

function buildDailyInput(params: {
  rows: { derivedRows: DerivedMetricRow[]; dailyRows: GarminDailyRow[] }
  request: GenerateGarminInsightRequest
}): DailyInsightInput {
  const { derivedRows, dailyRows } = params.rows
  const latestDerived = derivedRows[0] ?? null
  const latestDaily = dailyRows[0] ?? null
  const date = latestDerived?.date ?? latestDaily?.date ?? toIsoDate(params.request.requestedAt)
  const readiness = resolveReadinessFromDerived(latestDerived)
  const baselineHrv = average(dailyRows.slice(0, 28).map((row) => row.hrv))
  const latestHrv = latestDaily?.hrv ?? null
  const hrvDeltaPct =
    latestHrv != null && baselineHrv != null && baselineHrv > 0 ? ((latestHrv - baselineHrv) / baselineHrv) * 100 : null

  const fallbackFlags = getSafetyFlagsFromDerived(latestDerived)
  const mergedFlags = [...new Set([...(params.request.derivedSummary?.flags ?? []), ...fallbackFlags])]

  return {
    type: "daily",
    date,
    readinessScore: params.request.derivedSummary?.readinessScore ?? readiness.score,
    readinessLabel: params.request.derivedSummary?.readinessLabel ?? readiness.label,
    readinessConfidence: params.request.derivedSummary?.confidence ?? readiness.confidence,
    sleepScore: latestDaily?.sleep_score ?? null,
    hrvDeltaPct,
    acwr: params.request.derivedSummary?.acwr ?? latestDerived?.acwr ?? null,
    weeklyKm: latestDerived?.weekly_volume_m != null ? latestDerived.weekly_volume_m / 1000 : null,
    plannedWorkout: params.request.plannedWorkout ?? null,
    safetyFlags: mergedFlags,
  }
}

function buildWeeklyInput(params: {
  rows: { derivedRows: DerivedMetricRow[]; dailyRows: GarminDailyRow[]; activityRows: GarminActivityRow[] }
  request: GenerateGarminInsightRequest
}): WeeklyInsightInput {
  const { derivedRows, dailyRows, activityRows } = params.rows
  const periodEnd = toIsoDate(params.request.requestedAt ?? derivedRows[0]?.date)
  const periodStart = shiftIsoDate(periodEnd, -6)
  const latestDerived = derivedRows[0] ?? null

  const weekDaily = dailyRows.filter((row) => row.date >= periodStart && row.date <= periodEnd)
  const weekRuns = activityRows
    .filter((activity) => isRunActivity(activity))
    .filter((activity) => {
      const date = toIsoDate(activity.start_time, "")
      return date >= periodStart && date <= periodEnd
    })

  const keyRuns = weekRuns
    .slice()
    .sort((a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0))
    .slice(0, 3)
    .map((run) => ({
      date: toIsoDate(run.start_time),
      sport: run.sport ?? "run",
      km: (run.distance_m ?? 0) / 1000,
      type: classifyWorkoutType(run),
    }))

  const weeklyVolumeKm =
    weekRuns.reduce((sum, activity) => sum + (activity.distance_m ?? 0), 0) > 0
      ? weekRuns.reduce((sum, activity) => sum + (activity.distance_m ?? 0), 0) / 1000
      : latestDerived?.weekly_volume_m != null
        ? latestDerived.weekly_volume_m / 1000
        : null

  const sleepHoursAvg = average(weekDaily.map((row) => (row.sleep_duration_s != null ? row.sleep_duration_s / 3600 : null)))
  const stressAvg = average(weekDaily.map((row) => row.stress))
  const derivedFlags = getSafetyFlagsFromDerived(latestDerived)
  const confidence =
    params.request.derivedSummary?.confidence ??
    (weekDaily.length >= 5 && weekRuns.length >= 3 ? "high" : weekDaily.length >= 3 ? "medium" : "low")

  return {
    type: "weekly",
    periodStart,
    periodEnd,
    acwr: params.request.derivedSummary?.acwr ?? latestDerived?.acwr ?? null,
    weeklyVolumeKm,
    keyRuns,
    sleepHoursAvg,
    stressAvg,
    confidence,
    safetyFlags: [...new Set([...(params.request.derivedSummary?.flags ?? []), ...derivedFlags])],
  }
}

function buildPostRunInput(params: {
  rows: { derivedRows: DerivedMetricRow[]; activityRows: GarminActivityRow[] }
  request: GenerateGarminInsightRequest
}): PostRunInsightInput {
  const { derivedRows, activityRows } = params.rows
  const runActivities = activityRows.filter((activity) => isRunActivity(activity))
  const target =
    (params.request.activityId
      ? runActivities.find((activity) => activity.activity_id === params.request.activityId)
      : null) ??
    (params.request.activityDate
      ? runActivities.find((activity) => toIsoDate(activity.start_time, "") === toIsoDate(params.request.activityDate, ""))
      : null) ??
    runActivities[0] ??
    null

  const runDate = target ? toIsoDate(target.start_time) : toIsoDate(params.request.requestedAt)
  const runPace = target ? paceSecondsPerKm(target) : null
  const priorRuns = runActivities
    .filter((activity) => (target ? activity.activity_id !== target.activity_id : true))
    .slice(0, 28)
  const priorAvgPace = average(priorRuns.map((activity) => paceSecondsPerKm(activity)))
  const paceVsRecentPct =
    runPace != null && priorAvgPace != null && priorAvgPace > 0 ? ((runPace - priorAvgPace) / priorAvgPace) * 100 : null

  const derivedForDate = derivedRows.find((row) => row.date === runDate) ?? derivedRows[0] ?? null
  const readiness = resolveReadinessFromDerived(derivedForDate)
  const derivedFlags = getSafetyFlagsFromDerived(derivedForDate)
  const confidence: GarminInsightConfidence = priorRuns.length >= 7 ? "high" : priorRuns.length >= 3 ? "medium" : "low"

  return {
    type: "post_run",
    date: runDate,
    sport: target?.sport ?? "running",
    distanceKm: target?.distance_m != null ? target.distance_m / 1000 : null,
    durationSeconds: target?.duration_s ?? null,
    readinessScore: params.request.derivedSummary?.readinessScore ?? readiness.score,
    paceVsRecentPct,
    confidence: params.request.derivedSummary?.confidence ?? confidence,
    safetyFlags: [...new Set([...(params.request.derivedSummary?.flags ?? []), ...derivedFlags])],
  }
}

export async function buildInsightSummaryForUser(
  request: GenerateGarminInsightRequest
): Promise<GarminInsightSummary | null> {
  try {
    const rows = await loadUserRows(request.userId)

    const input =
      request.insightType === "daily"
        ? buildDailyInput({ rows, request })
        : request.insightType === "weekly"
          ? buildWeeklyInput({ rows, request })
          : buildPostRunInput({ rows, request })

    return buildGarminInsightSummary(input)
  } catch (error) {
    logger.error("Failed to build Garmin insight summary:", error)
    return null
  }
}

export async function generateInsightForUser(
  request: GenerateGarminInsightRequest
): Promise<GeneratedGarminInsight | null> {
  const summary = await buildInsightSummaryForUser(request)
  if (!summary) return null

  const prompts = buildInsightPrompts(summary)
  const result = await generateText({
    model: openai(DEFAULT_MODEL),
    messages: [
      { role: "system", content: prompts.systemPrompt },
      { role: "user", content: prompts.userPrompt },
    ],
    temperature: 0.35,
    maxOutputTokens: 220,
  })

  return {
    userId: request.userId,
    type: summary.type,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    insightMarkdown: result.text.trim(),
    confidenceScore: confidenceToScore(summary.confidence),
    confidenceLabel: summary.confidence,
    evidence: {
      summary,
      prompts: {
        userPrompt: prompts.userPrompt,
      },
      generatedAt: new Date().toISOString(),
      model: DEFAULT_MODEL,
    },
  }
}

export async function persistGeneratedInsight(insight: GeneratedGarminInsight): Promise<void> {
  const oauthState = await getGarminOAuthState(insight.userId).catch(() => null)
  const authUserId = oauthState?.authUserId ?? null
  const supabase = createAdminClient()

  const { error: deleteError } = await supabase
    .from("ai_insights")
    .delete()
    .eq("user_id", insight.userId)
    .eq("type", insight.type)
    .eq("period_start", insight.periodStart)
    .eq("period_end", insight.periodEnd)

  if (deleteError) {
    throw new Error(`Failed to delete existing ai_insights row: ${deleteError.message}`)
  }

  const { error } = await supabase.from("ai_insights").insert({
    user_id: insight.userId,
    auth_user_id: authUserId,
    period_start: insight.periodStart,
    period_end: insight.periodEnd,
    type: insight.type,
    insight_markdown: insight.insightMarkdown,
    confidence: insight.confidenceScore,
    evidence_json: insight.evidence,
  })

  if (error) {
    throw new Error(`Failed to insert ai_insights: ${error.message}`)
  }
}

export async function fetchLatestInsight(params: {
  userId: number
  type?: GarminInsightType
}): Promise<AiInsightRow | null> {
  const supabase = createAdminClient()
  let query = supabase
    .from("ai_insights")
    .select("id,type,period_start,period_end,insight_markdown,confidence,evidence_json,created_at")
    .eq("user_id", params.userId)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  if (params.type) {
    query = query.eq("type", params.type)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch ai_insights: ${error.message}`)
  }

  if (!data || data.length === 0) return null
  return data[0] as AiInsightRow
}
