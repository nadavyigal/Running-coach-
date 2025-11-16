import { streamText, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { dbUtils } from '@/lib/dbUtils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  userId?: number;
  currentPhase?: string;
  streaming?: boolean;
  maxTokens?: number;
  model?: string;
}

export interface ChatResponse {
  success: boolean;
  data?: {
    response: string;
    tokensIn: number;
    tokensOut: number;
    duration: number;
    requestId: string;
    model: string;
  };
  error?: ChatError;
  stream?: ReadableStream;
}

export interface ChatError {
  type: 'auth' | 'rate_limit' | 'server_error' | 'timeout' | 'validation' | 'quota' | 'unknown';
  message: string;
  code: number;
  retryAfter?: number;
  requestId: string;
}

export interface ChatHealth {
  available: boolean;
  model: string;
  latency: number;
  quota: {
    remaining: number;
    resetAt: Date;
  };
  lastError?: string;
}

export interface PayloadMetrics {
  messagesCount: number;
  tokensIn: number;
  contextTruncated: boolean;
  profileSummaryLength: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Model settings
  DEFAULT_MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 1000,
  TIMEOUT_MS: 15000,
  
  // Context limits
  MAX_MESSAGES: 10,
  MAX_PROFILE_SUMMARY_CHARS: 500,
  
  // Budget limits
  MONTHLY_TOKEN_BUDGET: 200000,
  HOURLY_REQUEST_LIMIT: 50,
  
  // Performance targets
  P95_LATENCY_MS: 1500,
} as const;

// ============================================================================
// IN-MEMORY TRACKING (Replace with Redis/Database in production)
// ============================================================================

const userTokenUsage = new Map<string, { tokens: number; lastReset: Date }>();
const userRequestCounts = new Map<string, { count: number; lastReset: Date }>();
const healthCache = {
  lastCheck: new Date(0),
  data: null as ChatHealth | null,
  ttl: 60000, // 1 minute
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRequestId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4);
}

function mapOpenAIError(error: any, requestId: string): ChatError {
  console.error(`[chat:error] requestId=${requestId} OpenAI error:`, error);
  
  if (error.status === 401) {
    return {
      type: 'auth',
      message: 'AI service authentication failed. Please check configuration.',
      code: 401,
      requestId,
    };
  }
  
  if (error.status === 429) {
    return {
      type: 'rate_limit',
      message: 'Too many requests. Please wait before trying again.',
      code: 429,
      retryAfter: error.retryAfter || 60,
      requestId,
    };
  }
  
  if (error.status >= 500) {
    return {
      type: 'server_error',
      message: 'AI service is temporarily unavailable. Please try again.',
      code: error.status || 500,
      requestId,
    };
  }
  
  if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again with a shorter message.',
      code: 408,
      requestId,
    };
  }
  
  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    code: 500,
    requestId,
  };
}

function trackTokenUsage(userId: string, tokens: number): boolean {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const key = `${userId}-${currentMonth}`;
  
  const usage = userTokenUsage.get(key) || { tokens: 0, lastReset: now };
  usage.tokens += tokens;
  userTokenUsage.set(key, usage);
  
  return usage.tokens < CONFIG.MONTHLY_TOKEN_BUDGET;
}

function checkRateLimit(userId: string): boolean {
  const now = new Date();
  const hourKey = `${userId}-${now.getHours()}`;
  
  const requests = userRequestCounts.get(hourKey) || { count: 0, lastReset: now };
  
  // Reset if it's a new hour
  if (now.getTime() - requests.lastReset.getTime() > 3600000) {
    requests.count = 0;
    requests.lastReset = now;
  }
  
  requests.count++;
  userRequestCounts.set(hourKey, requests);
  
  return requests.count <= CONFIG.HOURLY_REQUEST_LIMIT;
}

// ============================================================================
// PAYLOAD MANAGEMENT
// ============================================================================

async function preparePayload(request: ChatRequest): Promise<{
  messages: typeof request.messages;
  metrics: PayloadMetrics;
}> {
  const { messages, userId } = request;
  const requestId = generateRequestId();
  
  console.log(`[chat:payload] requestId=${requestId} Original messages count: ${messages.length}`);
  
  // Get user profile for context
  let profileSummary = '';
  if (userId) {
    try {
      const user = await dbUtils.getCurrentUser();
      if (user) {
        profileSummary = `User: ${user.experience} runner, goal: ${user.goal}, ${user.daysPerWeek} days/week`;
        if (profileSummary.length > CONFIG.MAX_PROFILE_SUMMARY_CHARS) {
          profileSummary = profileSummary.slice(0, CONFIG.MAX_PROFILE_SUMMARY_CHARS) + '...';
        }
      }
    } catch (error) {
      console.warn(`[chat:payload] requestId=${requestId} Failed to get user profile:`, error);
    }
  }
  
  // Prepare messages array
  let processedMessages = [...messages];
  let contextTruncated = false;
  
  // Add system message with profile if available
  if (profileSummary) {
    const systemMessage = {
      role: 'system' as const,
      content: `You are a helpful running coach. Context: ${profileSummary}. Keep responses concise and actionable.`
    };
    processedMessages.unshift(systemMessage);
  }
  
  // Truncate messages if necessary (keep system + last N user messages)
  if (processedMessages.length > CONFIG.MAX_MESSAGES + 1) { // +1 for system message
    const systemMsg = processedMessages[0];
    const recentMessages = processedMessages.slice(-(CONFIG.MAX_MESSAGES));
    processedMessages = [systemMsg, ...recentMessages];
    contextTruncated = true;
    console.log(`[chat:payload] requestId=${requestId} Truncated to ${processedMessages.length} messages`);
  }
  
  // Calculate token estimate
  const totalContent = processedMessages.map(m => m.content).join(' ');
  const tokensIn = estimateTokenCount(totalContent);
  
  const metrics: PayloadMetrics = {
    messagesCount: processedMessages.length,
    tokensIn,
    contextTruncated,
    profileSummaryLength: profileSummary.length,
  };
  
  console.log(`[chat:payload] requestId=${requestId} Prepared payload:`, metrics);
  
  return { messages: processedMessages, metrics };
}

// ============================================================================
// CHAT DRIVER CLASS
// ============================================================================

export class ChatDriver {
  private static instance: ChatDriver | null = null;
  
  static getInstance(): ChatDriver {
    if (!ChatDriver.instance) {
      ChatDriver.instance = new ChatDriver();
    }
    return ChatDriver.instance;
  }
  
  private constructor() {}
  
  /**
   * Check health and availability of the chat service
   */
  async health(): Promise<ChatHealth> {
    const now = new Date();
    
    // Use cached health data if still valid
    if (healthCache.data && (now.getTime() - healthCache.lastCheck.getTime()) < healthCache.ttl) {
      return healthCache.data;
    }
    
    console.log('[chat:health] Performing health check...');
    const startTime = Date.now();
    
    // Check API key availability
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      const health: ChatHealth = {
        available: false,
        model: 'unavailable',
        latency: 0,
        quota: { remaining: 0, resetAt: new Date() },
        lastError: 'OpenAI API key not configured',
      };
      
      healthCache.data = health;
      healthCache.lastCheck = now;
      return health;
    }
    
    try {
      // Simple ping test with minimal token usage
      const response = await generateText({
        model: openai(CONFIG.DEFAULT_MODEL),
        prompt: 'ping',
        maxTokens: 5,
      });
      
      const latency = Date.now() - startTime;
      
      const health: ChatHealth = {
        available: true,
        model: CONFIG.DEFAULT_MODEL,
        latency,
        quota: {
          remaining: CONFIG.MONTHLY_TOKEN_BUDGET,
          resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      };
      
      console.log(`[chat:health] ✅ Healthy - latency: ${latency}ms`);
      
      healthCache.data = health;
      healthCache.lastCheck = now;
      return health;
      
    } catch (error) {
      const health: ChatHealth = {
        available: false,
        model: CONFIG.DEFAULT_MODEL,
        latency: Date.now() - startTime,
        quota: { remaining: 0, resetAt: new Date() },
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
      
      console.log(`[chat:health] ❌ Unhealthy:`, error);
      
      healthCache.data = health;
      healthCache.lastCheck = now;
      return health;
    }
  }
  
  /**
   * Send a chat request with comprehensive error handling and observability
   */
  async ask(request: ChatRequest): Promise<ChatResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    console.log(`[chat:ask] requestId=${requestId} Starting chat request`);
    console.log(`[chat:ask] requestId=${requestId} Messages count: ${request.messages.length}, streaming: ${request.streaming || false}`);
    
    try {
      // Validate API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        return {
          success: false,
          error: {
            type: 'auth',
            message: 'AI coaching is temporarily unavailable. Please try the guided form instead.',
            code: 503,
            requestId,
          },
        };
      }
      
      // Rate limiting
      const userId = request.userId?.toString() || 'anonymous';
      if (!checkRateLimit(userId)) {
        return {
          success: false,
          error: {
            type: 'rate_limit',
            message: 'Too many requests. Please wait before trying again.',
            code: 429,
            retryAfter: 60,
            requestId,
          },
        };
      }
      
      // Prepare payload with truncation and context management
      const { messages, metrics } = await preparePayload(request);
      
      // Check token budget
      if (!trackTokenUsage(userId, metrics.tokensIn)) {
        return {
          success: false,
          error: {
            type: 'quota',
            message: 'Monthly usage limit reached. Please try again next month.',
            code: 429,
            requestId,
          },
        };
      }
      
      const model = openai(request.model || CONFIG.DEFAULT_MODEL);
      const maxTokens = request.maxTokens || CONFIG.MAX_TOKENS;
      
      console.log(`[chat:ask] requestId=${requestId} Using model: ${request.model || CONFIG.DEFAULT_MODEL}, maxTokens: ${maxTokens}`);
      
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, CONFIG.TIMEOUT_MS);
      
      try {
        if (request.streaming) {
          // Streaming response
          console.log(`[chat:ask] requestId=${requestId} Starting streaming response`);
          
          const result = await streamText({
            model,
            messages,
            maxTokens,
            abortSignal: timeoutController.signal,
          });
          
          clearTimeout(timeoutId);
          
          // Note: For streaming, we return the stream and let the caller handle tokens/duration
          return {
            success: true,
            stream: result.toTextStreamResponse().body,
          };
          
        } else {
          // Non-streaming response
          console.log(`[chat:ask] requestId=${requestId} Starting non-streaming response`);
          
          const result = await generateText({
            model,
            messages,
            maxTokens,
            abortSignal: timeoutController.signal,
          });
          
          clearTimeout(timeoutId);
          
          const duration = Date.now() - startTime;
          const tokensOut = estimateTokenCount(result.text);
          
          // Track output tokens
          trackTokenUsage(userId, tokensOut);
          
          console.log(`[chat:ask] requestId=${requestId} ✅ Success - duration: ${duration}ms, tokensIn: ${metrics.tokensIn}, tokensOut: ${tokensOut}`);
          
          return {
            success: true,
            data: {
              response: result.text,
              tokensIn: metrics.tokensIn,
              tokensOut,
              duration,
              requestId,
              model: request.model || CONFIG.DEFAULT_MODEL,
            },
          };
        }
        
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const chatError = mapOpenAIError(error, requestId);
      
      console.error(`[chat:ask] requestId=${requestId} ❌ Failed after ${duration}ms:`, chatError);
      
      return {
        success: false,
        error: chatError,
      };
    }
  }
  
  /**
   * Get performance and usage metrics
   */
  getMetrics(): {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorRate: number;
  } {
    // In a real implementation, this would query analytics/metrics storage
    return {
      totalRequests: 0,
      totalTokens: 0,
      averageLatency: 0,
      errorRate: 0,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const chatDriver = ChatDriver.getInstance();