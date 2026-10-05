import { generateText, streamText } from 'ai'
import type { CoreMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { dbUtils } from '@/lib/dbUtils'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  userId?: number
  currentPhase?: string
  streaming?: boolean
  /**
   * Back-compat with older callers; mapped to AI SDK `maxOutputTokens`.
   */
  maxTokens?: number
  /**
   * AI SDK v5+ name. Prefer this in new code.
   */
  maxOutputTokens?: number
  model?: string
}

export interface ChatResponse {
  success: boolean
  data?: {
    response: string
    tokensIn: number
    tokensOut: number
    duration: number
    requestId: string
    model: string
  }
  error?: ChatError
  stream?: ReadableStream
}

export interface ChatError {
  type: 'auth' | 'rate_limit' | 'server_error' | 'timeout' | 'validation' | 'quota' | 'unknown'
  message: string
  code: number
  retryAfter?: number
  requestId: string
}

export interface ChatHealth {
  available: boolean
  model: string
  latency: number
  quota: {
    remaining: number
    resetAt: Date
  }
  lastError?: string
}

export interface PayloadMetrics {
  messagesCount: number
  tokensIn: number
  contextTruncated: boolean
  profileSummaryLength: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

type ChatConfig = {
  defaultModel: string
  maxOutputTokens: number
  timeoutMs: number
  maxMessages: number
  maxProfileSummaryChars: number
  monthlyTokenBudget: number
  hourlyRequestLimit: number
  healthCacheTtlMs: number
}

function parseEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getChatConfig(): ChatConfig {
  const timeoutDefault = process.env.NODE_ENV === 'test' ? 2000 : 15000

  return {
    defaultModel: process.env.CHAT_DEFAULT_MODEL || 'gpt-4o-mini',
    maxOutputTokens: parseEnvNumber('CHAT_MAX_TOKENS', 1000),
    timeoutMs: parseEnvNumber('CHAT_TIMEOUT_MS', timeoutDefault),
    maxMessages: parseEnvNumber('CHAT_MAX_MESSAGES', 10),
    maxProfileSummaryChars: parseEnvNumber('CHAT_MAX_PROFILE_SUMMARY_CHARS', 500),
    monthlyTokenBudget: parseEnvNumber('CHAT_MONTHLY_TOKEN_BUDGET', 200000),
    hourlyRequestLimit: parseEnvNumber('CHAT_HOURLY_REQUEST_LIMIT', 50),
    healthCacheTtlMs: parseEnvNumber('CHAT_HEALTH_CACHE_TTL_MS', 60000),
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRequestId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const anyErr = error as any
  const status = anyErr.statusCode ?? anyErr.status ?? anyErr.response?.status
  return typeof status === 'number' ? status : undefined
}

function extractRetryAfterSeconds(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const anyErr = error as any
  const retryAfter = anyErr.retryAfter ?? anyErr.response?.headers?.['retry-after']
  const parsed =
    typeof retryAfter === 'number'
      ? retryAfter
      : typeof retryAfter === 'string'
        ? Number.parseInt(retryAfter, 10)
        : undefined
  return Number.isFinite(parsed) ? parsed : undefined
}

function isTimeoutError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'string') return /timeout/i.test(error)
  if (error instanceof Error) {
    const anyErr = error as any
    return (
      /timeout/i.test(error.message) ||
      anyErr.code === 'ETIMEDOUT' ||
      anyErr.name === 'AbortError' ||
      anyErr.cause?.name === 'AbortError'
    )
  }
  return false
}

function mapAiError(error: unknown, requestId: string): ChatError {
  const status = extractStatus(error)
  const retryAfter = extractRetryAfterSeconds(error)

  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      message: 'AI service authentication failed. Please check configuration.',
      code: status,
      requestId,
    }
  }

  if (status === 429) {
    return {
      type: 'rate_limit',
      message: 'Too many requests. Please wait before trying again.',
      code: 429,
      retryAfter: retryAfter ?? 60,
      requestId,
    }
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      type: 'server_error',
      message: 'AI service is temporarily unavailable. Please try again.',
      code: status,
      requestId,
    }
  }

  if (isTimeoutError(error)) {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again with a shorter message.',
      code: 408,
      requestId,
    }
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    code: 500,
    requestId,
  }
}

function getUserMonthKey(userKey: string): string {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`
  return `${userKey}-${currentMonth}`
}

function getUserHourKey(userKey: string): string {
  const now = new Date()
  return `${userKey}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout()
      const err = new Error('timeout')
      ;(err as any).code = 'ETIMEDOUT'
      reject(err)
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

// ============================================================================
// CHAT DRIVER
// ============================================================================

export class ChatDriver {
  private static instance: ChatDriver | null = null

  static getInstance(): ChatDriver {
    if (!ChatDriver.instance) {
      ChatDriver.instance = new ChatDriver()
    }
    return ChatDriver.instance
  }

  private userTokenUsage = new Map<string, number>()
  private userRequestCounts = new Map<string, { count: number; lastResetMs: number }>()
  private healthCache: { lastCheckMs: number; data: ChatHealth | null } = { lastCheckMs: 0, data: null }

  private constructor() {}

  __resetForTests(): void {
    this.userTokenUsage.clear()
    this.userRequestCounts.clear()
    this.healthCache = { lastCheckMs: 0, data: null }
  }

  private getTokensUsed(monthKey: string): number {
    return this.userTokenUsage.get(monthKey) ?? 0
  }

  private addTokens(monthKey: string, tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) return
    this.userTokenUsage.set(monthKey, this.getTokensUsed(monthKey) + tokens)
  }

  private checkAndIncrementRateLimit(userKey: string, hourlyLimit: number): boolean {
    const hourKey = getUserHourKey(userKey)
    const now = Date.now()
    const entry = this.userRequestCounts.get(hourKey) ?? { count: 0, lastResetMs: now }

    if (now - entry.lastResetMs > 60 * 60 * 1000) {
      entry.count = 0
      entry.lastResetMs = now
    }

    entry.count += 1
    this.userRequestCounts.set(hourKey, entry)
    return entry.count <= hourlyLimit
  }

  private async preparePayload(
    request: ChatRequest,
    requestId: string
  ): Promise<{ messages: CoreMessage[]; metrics: PayloadMetrics }> {
    const config = getChatConfig()

    const originalMessages = request.messages ?? []
    console.log(`[chat:payload] requestId=${requestId} Original messages count: ${originalMessages.length}`)

    let profileSummary = ''
    if (request.userId) {
      try {
        const user = await dbUtils.getCurrentUser()
        if (user) {
          profileSummary = `${user.experience} runner, goal: ${user.goal}, ${user.daysPerWeek} days/week`
          if (profileSummary.length > config.maxProfileSummaryChars) {
            profileSummary = `${profileSummary.slice(0, config.maxProfileSummaryChars)}...`
          }
        }
      } catch (error) {
        console.warn(`[chat:payload] requestId=${requestId} Failed to get user profile:`, error)
      }
    }

    const systemPrompt = profileSummary
      ? `You are a helpful running coach. Context: ${profileSummary}. Keep responses concise and actionable.`
      : 'You are a helpful running coach. Keep responses concise and actionable.'

    const systemMessage: CoreMessage = { role: 'system', content: systemPrompt }

    const nonSystemMessages = originalMessages.filter((m) => m.role !== 'system')
    let processedMessages: CoreMessage[] = [systemMessage, ...nonSystemMessages]

    let contextTruncated = false
    if (processedMessages.length > config.maxMessages + 1) {
      const recentMessages = processedMessages.slice(-(config.maxMessages))
      processedMessages = [systemMessage, ...recentMessages]
      contextTruncated = true
      console.log(`[chat:payload] requestId=${requestId} Truncated to ${processedMessages.length} messages`)
    }

    const totalContent = processedMessages.map((m) => String((m as any).content ?? '')).join(' ')
    const tokensIn = estimateTokenCount(totalContent)

    const metrics: PayloadMetrics = {
      messagesCount: processedMessages.length,
      tokensIn,
      contextTruncated,
      profileSummaryLength: profileSummary.length,
    }

    console.log(`[chat:payload] requestId=${requestId} Prepared payload:`, metrics)

    return { messages: processedMessages, metrics }
  }

  async health(): Promise<ChatHealth> {
    const config = getChatConfig()
    const nowMs = Date.now()

    if (this.healthCache.data && nowMs - this.healthCache.lastCheckMs < config.healthCacheTtlMs) {
      return this.healthCache.data
    }

    console.log('[chat:health] Performing health check...')
    const startTime = Date.now()

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      const health: ChatHealth = {
        available: false,
        model: 'unavailable',
        latency: 0,
        quota: { remaining: 0, resetAt: new Date() },
        lastError: 'OpenAI API key not configured',
      }

      this.healthCache.data = health
      this.healthCache.lastCheckMs = nowMs
      return health
    }

    const controller = new AbortController()

    try {
      await withTimeout(
        generateText({
          model: openai(config.defaultModel),
          messages: [{ role: 'user', content: 'ping' }],
          maxOutputTokens: 16,
          abortSignal: controller.signal,
        }),
        config.timeoutMs,
        () => controller.abort()
      )

      const latency = Date.now() - startTime
      const health: ChatHealth = {
        available: true,
        model: config.defaultModel,
        latency,
        quota: {
          remaining: config.monthlyTokenBudget,
          resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }

      this.healthCache.data = health
      this.healthCache.lastCheckMs = nowMs
      return health
    } catch (error) {
      const health: ChatHealth = {
        available: false,
        model: config.defaultModel,
        latency: Date.now() - startTime,
        quota: { remaining: 0, resetAt: new Date() },
        lastError: error instanceof Error ? error.message : 'Unknown error',
      }

      this.healthCache.data = health
      this.healthCache.lastCheckMs = nowMs
      return health
    }
  }

  async ask(request: ChatRequest): Promise<ChatResponse> {
    const config = getChatConfig()

    const requestId = generateRequestId()
    const startTime = Date.now()

    console.log(`[chat:ask] requestId=${requestId} Starting chat request`)
    console.log(
      `[chat:ask] requestId=${requestId} Messages count: ${request.messages.length}, streaming: ${request.streaming || false}`
    )

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        return {
          success: false,
          error: {
            type: 'auth',
            message: 'AI coaching is temporarily unavailable. Please try the guided form instead.',
            code: 503,
            requestId,
          },
        }
      }

      const userKey = request.userId?.toString() || 'anonymous'
      if (!this.checkAndIncrementRateLimit(userKey, config.hourlyRequestLimit)) {
        return {
          success: false,
          error: {
            type: 'rate_limit',
            message: 'Too many requests. Please wait before trying again.',
            code: 429,
            retryAfter: 60,
            requestId,
          },
        }
      }

      const { messages, metrics } = await this.preparePayload(request, requestId)

      const monthKey = getUserMonthKey(userKey)
      const alreadyUsed = this.getTokensUsed(monthKey)
      if (alreadyUsed >= config.monthlyTokenBudget || alreadyUsed + metrics.tokensIn > config.monthlyTokenBudget) {
        return {
          success: false,
          error: {
            type: 'quota',
            message: 'Monthly usage limit reached. Please try again next month.',
            code: 429,
            requestId,
          },
        }
      }

      this.addTokens(monthKey, metrics.tokensIn)

      const modelName = request.model || config.defaultModel
      const maxOutputTokens = request.maxOutputTokens ?? request.maxTokens ?? config.maxOutputTokens
      const model = openai(modelName)

      const controller = new AbortController()

      if (request.streaming) {
        const result = await withTimeout(
          streamText({
            model,
            messages,
            maxOutputTokens,
            abortSignal: controller.signal,
          }),
          config.timeoutMs,
          () => controller.abort()
        )

        void Promise.resolve((result as any).usage)
          .then((usage: any) => {
            const promptTokens = typeof usage?.promptTokens === 'number' ? usage.promptTokens : metrics.tokensIn
            const completionTokens = typeof usage?.completionTokens === 'number' ? usage.completionTokens : 0
            this.addTokens(monthKey, Math.max(0, promptTokens - metrics.tokensIn) + completionTokens)
          })
          .catch(() => {})

        const response = (result as any).toDataStreamResponse?.() ?? (result as any).toTextStreamResponse?.()
        return { success: true, stream: response?.body }
      }

      const result = await withTimeout(
        generateText({
          model,
          messages,
          maxOutputTokens,
          abortSignal: controller.signal,
        }),
        config.timeoutMs,
        () => controller.abort()
      )

      const duration = Date.now() - startTime
      const usage = (result as any).usage
      const promptTokens = typeof usage?.promptTokens === 'number' ? usage.promptTokens : metrics.tokensIn
      const completionTokens =
        typeof usage?.completionTokens === 'number' ? usage.completionTokens : estimateTokenCount((result as any).text ?? '')

      this.addTokens(monthKey, Math.max(0, promptTokens - metrics.tokensIn) + completionTokens)

      return {
        success: true,
        data: {
          response: (result as any).text ?? '',
          tokensIn: promptTokens,
          tokensOut: completionTokens,
          duration,
          requestId,
          model: modelName,
        },
      }
    } catch (error) {
      return { success: false, error: mapAiError(error, requestId) }
    }
  }

  getMetrics(): {
    totalRequests: number
    totalTokens: number
    averageLatency: number
    errorRate: number
  } {
    return {
      totalRequests: 0,
      totalTokens: 0,
      averageLatency: 0,
      errorRate: 0,
    }
  }
}

export const chatDriver = ChatDriver.getInstance()
