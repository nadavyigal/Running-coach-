/**
 * OpenAI model tiers for RunSmart web.
 *
 * Every model id used by the AI routes comes from here. Each tier reads one env
 * var and defaults to the model the call sites used before tiers existed, so
 * merging this changes nothing until the env var is set. Rollback = unset it.
 *
 *   OPENAI_MODEL_PLAN        training-plan generation      target gpt-6.2-sol
 *   OPENAI_MODEL_WRITER      chat, coaching, onboarding    target gpt-6.1-terra
 *   OPENAI_MODEL_FAST        reports, insights, cues       target gpt-6-luna
 *   OPENAI_MODEL_VISION      activity screenshot reading   target gpt-6.1-terra
 *   OPENAI_MODEL_VISION_OCR  OCR fallback                  target gpt-6-luna
 *
 *   OPENAI_REASONING_EFFORT_<TIER>  overrides the default effort below
 *
 * Older per-feature overrides (OPENAI_MODEL, CHAT_COACHING_MODEL,
 * CHAT_DEFAULT_MODEL, RUN_REPORT_MODEL, AI_ACTIVITY_MODEL, AI_ACTIVITY_OCR_MODEL)
 * keep priority over the tier env var where a call site already read them.
 *
 * The gpt-5 / gpt-6 families are reasoning models. @ai-sdk/openai 2.x treats
 * every id outside gpt-3 / gpt-4 / chatgpt-4o as reasoning: it drops
 * temperature / topP (with a warning) and forwards
 * providerOptions.openai.reasoningEffort. Checked against the live API on
 * 2026-11-23: gpt-6.2-sol rejects effort "none" (lowest is "low").
 */

export type ModelTier = "PLAN" | "WRITER" | "FAST" | "VISION" | "VISION_OCR"

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"

const EFFORTS: readonly ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh"]

/** Current models: the code default per tier. */
export const CURRENT_MODELS: Record<ModelTier, string> = {
  PLAN: "gpt-4o",
  WRITER: "gpt-4o",
  FAST: "gpt-4o-mini",
  VISION: "gpt-4o",
  VISION_OCR: "gpt-4o-mini",
}

/** Target ids, verified on developers.openai.com/api/docs/models on 2026-11-23. */
export const TARGET_MODELS: Record<ModelTier, string> = {
  PLAN: "gpt-6.2-sol",
  WRITER: "gpt-6.1-terra",
  FAST: "gpt-6-luna",
  VISION: "gpt-6.1-terra",
  VISION_OCR: "gpt-6-luna",
}

/**
 * Default effort when the selected model is a reasoning model. Low for planning,
 * none elsewhere: several WRITER / FAST call sites cap output at 60 to 300
 * tokens, and reasoning tokens count against that cap.
 */
const DEFAULT_EFFORT: Record<ModelTier, ReasoningEffort> = {
  PLAN: "low",
  WRITER: "none",
  FAST: "none",
  VISION: "none",
  VISION_OCR: "none",
}

export interface ModelSelection {
  tier: ModelTier
  model: string
  /** Set only when `model` is a reasoning model. */
  reasoningEffort?: ReasoningEffort
}

export interface SelectOptions {
  /** Older env vars that keep priority over OPENAI_MODEL_<tier>, first wins. */
  overrideEnv?: string[]
  /** Fixed effort for this call site; wins over OPENAI_REASONING_EFFORT_<tier>. */
  effort?: ReasoningEffort
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/** True for model families that take reasoning effort and reject sampling params. */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5|gpt-6)/i.test(model.trim())
}

/**
 * Lowest effort each family accepts. gpt-6.2-sol and the o-series reject "none"
 * and "minimal" (lowest is "low"); gpt-5 / gpt-5-mini / gpt-5-nano accept
 * "minimal" but not "none" (gpt-5.1 and later accept "none").
 */
export function normalizeEffort(model: string, effort: ReasoningEffort): ReasoningEffort {
  const id = model.trim().toLowerCase()
  const low = effort === "none" || effort === "minimal"
  if (low && (/^gpt-6\.2-sol/.test(id) || /^o\d/.test(id))) return "low"
  if (effort === "none" && /^gpt-5(-|$)/.test(id)) return "minimal"
  return effort
}

export function selectModel(tier: ModelTier, options: SelectOptions = {}): ModelSelection {
  const override = options.overrideEnv?.map(readEnv).find(Boolean)
  const model = override ?? readEnv(`OPENAI_MODEL_${tier}`) ?? CURRENT_MODELS[tier]
  if (!isReasoningModel(model)) return { tier, model }

  const envEffort = readEnv(`OPENAI_REASONING_EFFORT_${tier}`) as ReasoningEffort | undefined
  const effort =
    options.effort ?? (envEffort && EFFORTS.includes(envEffort) ? envEffort : DEFAULT_EFFORT[tier])
  return { tier, model, reasoningEffort: normalizeEffort(model, effort) }
}

/** Selection for an explicit model id (e.g. a request-level override) in a tier. */
export function selectionForModel(tier: ModelTier, model: string, effort?: ReasoningEffort): ModelSelection {
  if (!isReasoningModel(model)) return { tier, model }
  const envEffort = readEnv(`OPENAI_REASONING_EFFORT_${tier}`) as ReasoningEffort | undefined
  const chosen = effort ?? (envEffort && EFFORTS.includes(envEffort) ? envEffort : DEFAULT_EFFORT[tier])
  return { tier, model, reasoningEffort: normalizeEffort(model, chosen) }
}

/**
 * AI SDK providerOptions for a selection. Undefined for non-reasoning models, so
 * current calls are sent exactly as before.
 */
export function providerOptionsFor(selection: ModelSelection): { openai: { reasoningEffort: ReasoningEffort } } | undefined {
  return selection.reasoningEffort ? { openai: { reasoningEffort: selection.reasoningEffort } } : undefined
}

/** Tier ids as resolved at load time (env first, current model as default). */
export const MODEL_PLAN = selectModel("PLAN").model
export const MODEL_WRITER = selectModel("WRITER").model
export const MODEL_FAST = selectModel("FAST").model
export const MODEL_VISION = selectModel("VISION").model
export const MODEL_VISION_OCR = selectModel("VISION_OCR").model
