type AIUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
}

type AIGenerationCaptureArgs = {
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

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
const DATA_URL_PATTERN = /data:[^;,]+\/[^;,]+;base64,[A-Za-z0-9+/=]+/g
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g
const CAPTURE_TIMEOUT_MS = 1500

function getPostHogConfig(): { apiKey: string; host: string } | null {
  const apiKey = process.env.POSTHOG_API_KEY?.trim() || ''

  if (!apiKey) return null

  const host = (
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    DEFAULT_POSTHOG_HOST
  ).replace(/\/$/, '')

  return { apiKey, host }
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(DATA_URL_PATTERN, '[redacted-data-url]')
      .replace(EMAIL_PATTERN, '[redacted-email]')
      .replace(PHONE_PATTERN, '[redacted-phone]')
  }

  if (Array.isArray(value)) return value.map(redact)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item)])
    )
  }

  return value
}

function usageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
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
  const inputTokens = usageNumber(args.usage?.promptTokens ?? args.usage?.inputTokens)
  const outputTokens = usageNumber(args.usage?.completionTokens ?? args.usage?.outputTokens)
  const totalTokens = usageNumber(args.usage?.totalTokens) || inputTokens + outputTokens
  const outputChoices = args.output !== undefined ? [{ content: args.output }] : []

  try {
    await fetch(`${config.host}/capture/`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.apiKey,
        event: '$ai_generation',
        properties: {
          distinct_id: distinctId,
          $ai_lib: 'runsmart-worker-vercel-ai-sdk-manual',
          $ai_provider: 'openai',
          $ai_model: args.model,
          $ai_model_parameters: {},
          $ai_input: redact(args.input),
          $ai_output_choices: redact(outputChoices),
          $ai_http_status: args.error ? 500 : 200,
          $ai_input_tokens: inputTokens,
          $ai_output_tokens: outputTokens,
          $ai_total_tokens: totalTokens,
          $ai_latency: args.latencyMs,
          $ai_trace_id: traceId,
          $ai_trace_name: args.traceName,
          $ai_is_error: Boolean(args.error),
          ...(args.error ? { $ai_error: errorMessage(args.error) } : {}),
          ...args.properties,
        },
      }),
    })
  } catch {
    // Telemetry must not break background jobs.
  } finally {
    clearTimeout(timeout)
  }
}
