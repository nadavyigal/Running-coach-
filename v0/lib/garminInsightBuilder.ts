export type GarminInsightType = "daily" | "weekly" | "post_run"
export type GarminInsightConfidence = "high" | "medium" | "low"

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 800
const APPROX_CHARS_PER_TOKEN = 4

export interface GarminWorkoutSummary {
  date: string
  sport: string
  km: number
  type?: string
  avgHr?: number | null
  maxHr?: number | null
  cadenceSpm?: number | null
  elevGainM?: number | null
}

export interface GarminCoachContext {
  lastSyncAt?: string
  readiness?: {
    score: number
    label: string
    confidence: GarminInsightConfidence
  }
  load7d?: {
    acwr: number
    zone: string
    weeklyKm: number
  }
  load28d?: {
    avgWeeklyKm: number
    trend: "building" | "stable" | "declining"
  }
  sleep7dAvg?: number
  lastWorkouts?: GarminWorkoutSummary[]
}

export interface GarminInsightSection {
  title: string
  body: string
}

export interface GarminInsightSummary {
  type: GarminInsightType
  periodStart: string
  periodEnd: string
  confidence: GarminInsightConfidence
  safetyFlags: string[]
  sections: GarminInsightSection[]
  promptSummary: string
  tokenEstimate: number
}

export interface DailyInsightInput {
  type: "daily"
  date: string
  readinessScore: number | null
  readinessLabel: string | null
  readinessConfidence: GarminInsightConfidence
  sleepScore: number | null
  hrvDeltaPct: number | null
  acwr: number | null
  weeklyKm: number | null
  plannedWorkout: string | null
  safetyFlags?: string[]
}

export interface WeeklyInsightInput {
  type: "weekly"
  periodStart: string
  periodEnd: string
  acwr: number | null
  weeklyVolumeKm: number | null
  keyRuns: GarminWorkoutSummary[]
  sleepHoursAvg: number | null
  stressAvg: number | null
  confidence: GarminInsightConfidence
  safetyFlags?: string[]
}

export interface PostRunInsightInput {
  type: "post_run"
  date: string
  sport: string
  distanceKm: number | null
  durationSeconds: number | null
  readinessScore: number | null
  paceVsRecentPct: number | null
  confidence: GarminInsightConfidence
  safetyFlags?: string[]
}

export type GarminInsightInput = DailyInsightInput | WeeklyInsightInput | PostRunInsightInput

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN)
}

export function truncateToTokenBudget(text: string, maxTokens = DEFAULT_CONTEXT_TOKEN_BUDGET): string {
  if (!text) return ""
  const normalized = text.trim()
  if (!normalized) return ""

  const maxChars = Math.max(80, maxTokens * APPROX_CHARS_PER_TOKEN)
  if (normalized.length <= maxChars) return normalized

  const sliced = normalized.slice(0, maxChars)
  const lastBoundary = Math.max(sliced.lastIndexOf("\n"), sliced.lastIndexOf(". "), sliced.lastIndexOf(" "))
  const safeSlice = lastBoundary > 40 ? sliced.slice(0, lastBoundary).trimEnd() : sliced.trimEnd()
  return `${safeSlice}...`
}

function formatNullableNumber(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${toFixed(value, digits)}${suffix}`
}

function toReadinessLabel(score: number | null, fallback: string | null): string {
  if (fallback && fallback.trim().length > 0) return fallback
  if (score == null) return "Readiness unavailable"
  if (score >= 80) return "Ready to Train"
  if (score >= 60) return "Train with caution"
  return "Prioritize recovery"
}

function toAcwrZone(acwr: number | null): string {
  if (acwr == null || !Number.isFinite(acwr)) return "unknown"
  if (acwr < 0.8) return "underload"
  if (acwr <= 1.3) return "sweet"
  if (acwr <= 1.5) return "elevated"
  return "high-risk"
}

function buildDailySections(input: DailyInsightInput): GarminInsightSection[] {
  const readinessLabel = toReadinessLabel(input.readinessScore, input.readinessLabel)
  const hrvDelta =
    input.hrvDeltaPct == null || !Number.isFinite(input.hrvDeltaPct)
      ? "HRV delta unavailable"
      : input.hrvDeltaPct >= 0
        ? `HRV +${toFixed(input.hrvDeltaPct, 0)}% vs baseline`
        : `HRV ${toFixed(input.hrvDeltaPct, 0)}% vs baseline`

  return [
    {
      title: "Readiness",
      body: `Score ${formatNullableNumber(input.readinessScore, 0)} (${readinessLabel}), confidence ${input.readinessConfidence}.`,
    },
    {
      title: "Recovery",
      body: `Sleep score ${formatNullableNumber(input.sleepScore, 0)}. ${hrvDelta}.`,
    },
    {
      title: "Load + Plan",
      body: `ACWR ${formatNullableNumber(input.acwr, 2)} (${toAcwrZone(input.acwr)}), weekly volume ${formatNullableNumber(input.weeklyKm, 1, " km")}. Planned workout: ${input.plannedWorkout ?? "not available"}.`,
    },
  ]
}

function buildWeeklySections(input: WeeklyInsightInput): GarminInsightSection[] {
  const keyRuns =
    input.keyRuns.length === 0
      ? "No key runs available."
      : input.keyRuns
          .slice(0, 3)
          .map((run) => `${run.date}: ${toFixed(run.km, 1)} km ${run.type ? `(${run.type})` : ""}`.trim())
          .join("; ")

  return [
    {
      title: "Load",
      body: `Weekly volume ${formatNullableNumber(input.weeklyVolumeKm, 1, " km")} with ACWR ${formatNullableNumber(input.acwr, 2)} (${toAcwrZone(input.acwr)}).`,
    },
    {
      title: "Recovery",
      body: `Sleep average ${formatNullableNumber(input.sleepHoursAvg, 1, " h")} and stress average ${formatNullableNumber(input.stressAvg, 0)}.`,
    },
    {
      title: "Key Runs",
      body: keyRuns,
    },
  ]
}

function buildPostRunSections(input: PostRunInsightInput): GarminInsightSection[] {
  const paceDelta =
    input.paceVsRecentPct == null || !Number.isFinite(input.paceVsRecentPct)
      ? "Pace delta unavailable."
      : input.paceVsRecentPct <= 0
        ? `Pace was ${toFixed(Math.abs(input.paceVsRecentPct), 1)}% faster than recent average.`
        : `Pace was ${toFixed(input.paceVsRecentPct, 1)}% slower than recent average.`

  return [
    {
      title: "Run",
      body: `${input.sport} run ${formatNullableNumber(input.distanceKm, 2, " km")} in ${formatNullableNumber(
        input.durationSeconds != null ? input.durationSeconds / 60 : null,
        0,
        " min"
      )}.`,
    },
    {
      title: "Readiness at Run Time",
      body: `Readiness score ${formatNullableNumber(input.readinessScore, 0)}.`,
    },
    {
      title: "Pacing vs Baseline",
      body: paceDelta,
    },
  ]
}

function buildPromptSummary(sections: GarminInsightSection[]): string {
  return sections.map((section) => `- ${section.title}: ${section.body}`).join("\n")
}

export function buildGarminInsightSummary(
  input: GarminInsightInput,
  maxTokens = DEFAULT_CONTEXT_TOKEN_BUDGET
): GarminInsightSummary {
  const sections =
    input.type === "daily"
      ? buildDailySections(input)
      : input.type === "weekly"
        ? buildWeeklySections(input)
        : buildPostRunSections(input)

  const periodStart = input.type === "weekly" ? input.periodStart : input.date
  const periodEnd = input.type === "weekly" ? input.periodEnd : input.date
  const confidence =
    input.type === "daily"
      ? input.readinessConfidence
      : input.type === "weekly"
        ? input.confidence
        : input.confidence
  const safetyFlags = [...(input.safetyFlags ?? [])]
  const rawSummary = buildPromptSummary(sections)
  const promptSummary = truncateToTokenBudget(rawSummary, clamp(maxTokens, 120, 2000))

  return {
    type: input.type,
    periodStart,
    periodEnd,
    confidence,
    safetyFlags,
    sections,
    promptSummary,
    tokenEstimate: estimateTokenCount(promptSummary),
  }
}

export function buildInsightPrompts(summary: GarminInsightSummary): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    "You are RunSmart's endurance coach.",
    "Use only the provided structured summary and do not invent missing metrics.",
    "Never output raw JSON.",
    "Keep output concise, specific, and safe for training decisions.",
    "Always include this safety disclaimer verbatim at the end:",
    "\"This is not medical advice. If you feel pain, dizziness, or unusual symptoms, stop and consult a qualified professional.\"",
  ].join(" ")

  const styleHint =
    summary.type === "weekly"
      ? "Return exactly 3 markdown bullets titled Load, Recovery, Focus."
      : "Return a short coaching paragraph (2-4 sentences)."

  const userPrompt = [
    `Insight type: ${summary.type}`,
    `Period: ${summary.periodStart} to ${summary.periodEnd}`,
    `Confidence: ${summary.confidence}`,
    summary.safetyFlags.length > 0 ? `Safety flags: ${summary.safetyFlags.join("; ")}` : "Safety flags: none",
    "Structured summary:",
    summary.promptSummary,
    styleHint,
  ].join("\n")

  return { systemPrompt, userPrompt }
}

export function formatGarminContextForPrompt(
  context: GarminCoachContext,
  maxTokens = DEFAULT_CONTEXT_TOKEN_BUDGET
): string {
  const lines: string[] = []

  if (context.lastSyncAt) {
    lines.push(`- Last sync: ${context.lastSyncAt}`)
  }

  if (context.readiness) {
    lines.push(
      `- Readiness: ${Math.round(context.readiness.score)} (${context.readiness.label}), confidence ${context.readiness.confidence}`
    )
  }

  if (context.load7d) {
    lines.push(
      `- 7d load: ACWR ${toFixed(context.load7d.acwr, 2)} (${context.load7d.zone}), weekly ${toFixed(context.load7d.weeklyKm, 1)} km`
    )
  }

  if (context.load28d) {
    lines.push(
      `- 28d load: avg weekly ${toFixed(context.load28d.avgWeeklyKm, 1)} km, trend ${context.load28d.trend}`
    )
  }

  if (context.sleep7dAvg != null) {
    lines.push(`- Sleep (7d avg): ${toFixed(context.sleep7dAvg, 1)} h`)
  }

  if (context.lastWorkouts && context.lastWorkouts.length > 0) {
    const workouts = context.lastWorkouts
      .slice(0, 3)
      .map((run) => {
        let line = `${run.date} ${run.sport} ${toFixed(run.km, 1)}km${run.type ? ` ${run.type}` : ""}`
        if (run.avgHr != null) line += ` avgHR ${run.avgHr}bpm`
        if (run.maxHr != null) line += ` maxHR ${run.maxHr}bpm`
        if (run.cadenceSpm != null) line += ` cad ${run.cadenceSpm}spm`
        if (run.elevGainM != null && run.elevGainM > 0) line += ` +${run.elevGainM}m elev`
        return line
      })
      .join("; ")
    lines.push(`- Last workouts: ${workouts}`)
  }

  const summary = lines.length > 0 ? lines.join("\n") : "- Garmin context unavailable."
  return truncateToTokenBudget(summary, maxTokens)
}
