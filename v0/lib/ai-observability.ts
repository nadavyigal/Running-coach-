type AIUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
}

export type AIGenerationCaptureArgs = {
  traceName: string
  distinctId?: string | number | null
  model: string
  input: unknown
  output?: unknown
  usage?: AIUsage | null
  latencyMs: number
  error?: unknown
  properties?: Record<string, unknown>
}

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g
const DATA_URL_PATTERN = /data:[^;,]+\/[^;,]+;base64,[A-Za-z0-9+/=]+/g
const CONTACT_FIELD_KEYS = new Set(["name", "email", "phone"])
const CAPTURE_TIMEOUT_MS = 1500

function getPostHogConfig(): { apiKey: string; host: string } | null {
  if (typeof window !== "undefined") return null

  const apiKey = process.env.POSTHOG_API_KEY?.trim() || ""

  if (!apiKey) return null

  const host = (
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    DEFAULT_POSTHOG_HOST
  ).replace(/\/$/, "")

  return { apiKey, host }
}

function redactTelemetryValue(value: unknown, key?: string): unknown {
  const normalizedKey = key?.toLowerCase()
  if (normalizedKey && CONTACT_FIELD_KEYS.has(normalizedKey)) {
    return `[redacted-${normalizedKey}]`
  }

  if (typeof value === "string") {
    return value
      .replace(DATA_URL_PATTERN, "[redacted-data-url]")
      .replace(EMAIL_PATTERN, "[redacted-email]")
      .replace(PHONE_PATTERN, "[redacted-phone]")
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTelemetryValue(item))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactTelemetryValue(entryValue, entryKey),
      ])
    )
  }

  return value
}

function usageNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function getInputTokens(usage?: AIUsage | null): number {
  return usageNumber(usage?.promptTokens ?? usage?.inputTokens)
}

function getOutputTokens(usage?: AIUsage | null): number {
  return usageNumber(usage?.completionTokens ?? usage?.outputTokens)
}

function getTotalTokens(usage?: AIUsage | null): number {
  return usageNumber(usage?.totalTokens) || getInputTokens(usage) + getOutputTokens(usage)
}

function getHttpStatus(error?: unknown): number {
  if (!error || typeof error !== "object") return 200
  const err = error as {
    statusCode?: unknown
    status?: unknown
    response?: { status?: unknown }
  }
  const status = err.statusCode ?? err.status ?? err.response?.status
  return typeof status === "number" ? status : 500
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function captureAIGeneration(args: AIGenerationCaptureArgs): Promise<void> {
  const config = getPostHogConfig()
  if (!config) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS)
  const traceId = crypto.randomUUID()
  const distinctId = args.distinctId !== undefined && args.distinctId !== null ? String(args.distinctId) : traceId
  const outputChoices = args.output !== undefined ? [{ content: args.output }] : []

  const properties = {
    distinct_id: distinctId,
    $ai_lib: "runsmart-vercel-ai-sdk-manual",
    $ai_provider: "openai",
    $ai_model: args.model,
    $ai_model_parameters: {},
    $ai_input: redactTelemetryValue(args.input),
    $ai_output_choices: redactTelemetryValue(outputChoices),
    $ai_http_status: getHttpStatus(args.error),
    $ai_input_tokens: getInputTokens(args.usage),
    $ai_output_tokens: getOutputTokens(args.usage),
    $ai_total_tokens: getTotalTokens(args.usage),
    $ai_latency: args.latencyMs,
    $ai_trace_id: traceId,
    $ai_trace_name: args.traceName,
    $ai_is_error: Boolean(args.error),
    ...(args.error ? { $ai_error: errorMessage(args.error) } : {}),
    ...args.properties,
  }

  try {
    await fetch(`${config.host}/capture/`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: "$ai_generation",
        properties,
      }),
    })
  } catch {
    // Telemetry must never break AI product paths.
  } finally {
    clearTimeout(timeout)
  }
}

export const aiObservabilityTestUtils = {
  redactTelemetryValue,
}
