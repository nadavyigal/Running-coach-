import {
  DEFAULT_CONTEXT_TOKEN_BUDGET,
  estimateTokenCount,
  formatGarminContextForPrompt,
  type GarminCoachContext,
} from "@/lib/garminInsightBuilder"
import { logger } from "@/lib/logger"

export interface PerformanceTrend {
  metric: "distance" | "pace" | "duration" | "frequency"
  trend: "improving" | "declining" | "stable"
  value: number
  period: "week" | "month" | "quarter"
}

export interface UserPreferences {
  name?: string
  coachingStyle?: "encouraging" | "technical" | "motivational" | "educational"
}

export interface Run {
  id?: number
  distance: number
  duration: number
}

export interface Plan {
  id?: number
  name?: string
}

export interface AICoachContext {
  userId: string
  recentRuns: Run[]
  currentPlan?: Plan | null
  performanceTrends: PerformanceTrend[]
  userPreferences: UserPreferences
  coachingStyle: "encouraging" | "technical" | "motivational" | "educational"
}

export interface FollowUpAction {
  action: string
}

export interface AICoachResponse {
  response: string
  suggestedQuestions: string[]
  followUpActions: FollowUpAction[]
  confidence: number
  contextUsed: string[]
}

interface DerivedMetricRow {
  date: string
  acwr: number | null
  weekly_volume_m: number | null
  weekly_intensity_score: number | null
  flags_json: Record<string, unknown> | null
}

interface GarminDailyRow {
  date: string
  sleep_duration_s: number | null
  training_readiness: number | null
}

interface GarminActivityRow {
  start_time: string | null
  sport: string | null
  distance_m: number | null
  avg_hr: number | null
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

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toRelativeTime(dateIso: string | null | undefined): string | undefined {
  if (!dateIso) return undefined
  const parsed = Date.parse(dateIso)
  if (!Number.isFinite(parsed)) return undefined

  const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000))
  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return `${Math.floor(diffHours / 24)}d ago`
}

function acwrToZone(acwr: number): string {
  if (acwr < 0.8) return "underload"
  if (acwr <= 1.3) return "sweet"
  if (acwr <= 1.5) return "elevated"
  return "high-risk"
}

function readinessLabel(score: number): string {
  if (score >= 80) return "Ready to Train"
  if (score >= 60) return "Train with caution"
  return "Prioritize recovery"
}

function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  const raw = getString(value)?.toLowerCase()
  if (raw === "high" || raw === "medium" || raw === "low") return raw
  return "medium"
}

function activityType(activity: GarminActivityRow): string {
  const distanceKm = activity.distance_m != null ? activity.distance_m / 1000 : null
  const avgHr = activity.avg_hr

  if (distanceKm != null && distanceKm >= 16) return "long"
  if (avgHr != null && avgHr >= 165) return "intervals"
  if (avgHr != null && avgHr >= 150) return "tempo"
  return "easy"
}

export async function buildGarminContext(userId: number): Promise<GarminCoachContext> {
  if (!Number.isFinite(userId) || userId <= 0) return {}

  try {
    const [{ createAdminClient }, { getGarminOAuthState }] = await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/server/garmin-oauth-store"),
    ])

    const supabase = createAdminClient()
    const [oauthState, derivedQuery, dailyQuery, activityQuery] = await Promise.all([
      getGarminOAuthState(userId).catch(() => null),
      supabase
        .from("training_derived_metrics")
        .select("date,acwr,weekly_volume_m,weekly_intensity_score,flags_json")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(28),
      supabase
        .from("garmin_daily_metrics")
        .select("date,sleep_duration_s,training_readiness")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(14),
      supabase
        .from("garmin_activities")
        .select("start_time,sport,distance_m,avg_hr")
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(12),
    ])

    if (derivedQuery.error) throw new Error(derivedQuery.error.message)
    if (dailyQuery.error) throw new Error(dailyQuery.error.message)
    if (activityQuery.error) throw new Error(activityQuery.error.message)

    const derivedRows = (derivedQuery.data ?? []) as DerivedMetricRow[]
    const dailyRows = (dailyQuery.data ?? []) as GarminDailyRow[]
    const activityRows = (activityQuery.data ?? []) as GarminActivityRow[]

    const context: GarminCoachContext = {}

    const syncLabel = toRelativeTime(oauthState?.lastSyncAt)
    if (syncLabel) context.lastSyncAt = syncLabel

    const latestDerived = derivedRows[0] ?? null
    const latestDaily = dailyRows[0] ?? null
    const flagsJson = asRecord(latestDerived?.flags_json)
    const readinessData = asRecord(flagsJson.readiness)
    const readinessScore =
      getNumber(readinessData.score) ??
      getNumber(latestDerived?.weekly_intensity_score) ??
      getNumber(latestDaily?.training_readiness)

    if (readinessScore != null) {
      context.readiness = {
        score: Math.round(readinessScore),
        label: getString(readinessData.label) ?? readinessLabel(readinessScore),
        confidence: normalizeConfidence(readinessData.confidence ?? flagsJson.confidence),
      }
    }

    if (latestDerived?.acwr != null && latestDerived.weekly_volume_m != null) {
      const acwrZone =
        getString(asRecord(flagsJson.acwr).zone) ??
        acwrToZone(latestDerived.acwr)

      context.load7d = {
        acwr: round(latestDerived.acwr, 2),
        zone: acwrZone,
        weeklyKm: round(latestDerived.weekly_volume_m / 1000, 1),
      }
    }

    const weeklyVolumesKm = derivedRows
      .map((row) => (row.weekly_volume_m != null ? row.weekly_volume_m / 1000 : null))
      .filter((value): value is number => value != null && Number.isFinite(value))

    if (weeklyVolumesKm.length > 0) {
      const avgWeeklyKm = average(weeklyVolumesKm)
      if (avgWeeklyKm != null) {
        const newest = weeklyVolumesKm[0]
        const oldest = weeklyVolumesKm[weeklyVolumesKm.length - 1]
        const deltaPct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0
        const trend = deltaPct > 5 ? "building" : deltaPct < -5 ? "declining" : "stable"

        context.load28d = {
          avgWeeklyKm: round(avgWeeklyKm, 1),
          trend,
        }
      }
    }

    const sleepHoursAvg = average(
      dailyRows.slice(0, 7).map((row) => (row.sleep_duration_s != null ? row.sleep_duration_s / 3600 : null))
    )
    if (sleepHoursAvg != null) {
      context.sleep7dAvg = round(sleepHoursAvg, 1)
    }

    const workouts = activityRows
      .filter((activity) => activity.start_time != null && activity.distance_m != null && activity.distance_m > 0)
      .slice(0, 3)
      .map((activity) => ({
        date: new Date(activity.start_time as string).toISOString().slice(0, 10),
        sport: getString(activity.sport)?.toLowerCase() ?? "running",
        km: round((activity.distance_m as number) / 1000, 1),
        type: activityType(activity),
      }))

    if (workouts.length > 0) {
      context.lastWorkouts = workouts
    }

    return context
  } catch (error) {
    logger.warn("Failed to build Garmin context:", error)
    return {}
  }
}

export function buildGarminContextSummary(
  context: GarminCoachContext,
  maxTokens = DEFAULT_CONTEXT_TOKEN_BUDGET
): string {
  return formatGarminContextForPrompt(context, maxTokens)
}

export function getGarminContextTokenEstimate(
  context: GarminCoachContext,
  maxTokens = DEFAULT_CONTEXT_TOKEN_BUDGET
): number {
  return estimateTokenCount(buildGarminContextSummary(context, maxTokens))
}

export async function generateContextAwareResponse(
  message: string,
  context: AICoachContext
): Promise<AICoachResponse> {
  try {
    const lastRun = context.recentRuns[context.recentRuns.length - 1]
    const name = context.userPreferences.name || "runner"
    const runInfo = lastRun
      ? `your last run was ${lastRun.distance}km in ${Math.round(lastRun.duration / 60)} min`
      : "you have no recent runs"
    const response = `Hi ${name}, ${runInfo}. ${message}`
    return {
      response,
      suggestedQuestions: ["How did you feel?", "Ready for the next workout?"],
      followUpActions: [],
      confidence: 0.9,
      contextUsed: ["recentRuns", "userPreferences"],
    }
  } catch {
    return {
      response: "Sorry, I could not generate a coaching response.",
      suggestedQuestions: [],
      followUpActions: [],
      confidence: 0,
      contextUsed: [],
    }
  }
}

