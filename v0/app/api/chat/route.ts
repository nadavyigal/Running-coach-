import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { adaptiveCoachingEngine, UserContext } from '@/lib/adaptiveCoachingEngine'
import { chatRepository } from '@/lib/server/chatRepository'
import type { ChatUserProfile } from '@/lib/models/chat'
import { withChatSecurity, validateAndSanitizeInput, ApiRequest } from '@/lib/security.middleware'
// Error handling is managed by the secure wrapper and middleware
import { withSecureOpenAI } from '@/lib/apiKeyManager'
import { logger } from '@/lib/logger'

// Token budget configuration
const MONTHLY_TOKEN_BUDGET = 200000 // Approximate tokens for $50/mo budget
const RATE_LIMIT_PER_USER_PER_HOUR = 50

// In-memory tracking (in production, use Redis or database)
const userTokenUsage = new Map<string, { tokens: number; lastReset: Date }>()
const userRequestCounts = new Map<string, { count: number; lastReset: Date }>()

function trackTokenUsage(userId: string, tokens: number): boolean {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`
  const key = `${userId}-${currentMonth}`
  
  const usage = userTokenUsage.get(key) || { tokens: 0, lastReset: now }
  usage.tokens += tokens
  userTokenUsage.set(key, usage)
  
  return usage.tokens < MONTHLY_TOKEN_BUDGET
}

function checkRateLimit(userId: string): boolean {
  const now = new Date()
  const hourKey = `${userId}-${now.getHours()}`
  
  const requests = userRequestCounts.get(hourKey) || { count: 0, lastReset: now }
  
  // Reset if it's a new hour
  if (now.getTime() - requests.lastReset.getTime() > 3600000) {
    requests.count = 0
    requests.lastReset = now
  }
  
  requests.count++
  userRequestCounts.set(hourKey, requests)
  
  return requests.count <= RATE_LIMIT_PER_USER_PER_HOUR
}

export async function chatHandler(req: ApiRequest) {
  logger.log('💬 Chat API: Starting request');
  
  try {
    // Validate and sanitize input
    const validation = await validateAndSanitizeInput(req, 1000);
    if (!validation.valid) {
      const errorMessage = validation.error || "Invalid input";

      // Requests can be aborted mid-stream during SPA navigation, resulting in truncated JSON bodies.
      // Treat these as no-op to avoid noisy logs/alerts.
      if (/unexpected end of json input/i.test(errorMessage)) {
        return new Response(null, { status: 204 });
      }

      logger.error('❌ Input validation failed:', errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = validation.sanitized || await req.json();
    logger.log('📝 Request body keys:', Object.keys(body));
    logger.log('👤 User ID:', body.userId);

    const { messages, userId, userContext } = body;
    const conversationId = typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : 'default';
    const userProfile = body.userProfile as ChatUserProfile | undefined;

    const rawUserId = typeof userId === 'string' || typeof userId === 'number' ? userId : undefined;
    const parsedUserId = typeof rawUserId === 'string' ? Number.parseInt(rawUserId, 10) : rawUserId;
    const hasValidUserId = typeof parsedUserId === 'number' && !Number.isNaN(parsedUserId);
    const normalizedUserId = hasValidUserId ? parsedUserId : undefined;
    const userIdKey = normalizedUserId ? normalizedUserId.toString() : rawUserId ? String(rawUserId) : undefined;

    if (rawUserId && !hasValidUserId) {
      logger.error('❌ Invalid userId provided to chat route:', rawUserId);
      return new Response(JSON.stringify({ error: 'Invalid user identifier provided' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate input
    logger.log('🔍 Validating input...');
    if (!messages || !Array.isArray(messages)) {
      logger.error('❌ Invalid messages format:', messages);
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    
    logger.log(`📨 Received ${messages.length} messages`);
    const latestMessage = messages[messages.length - 1];
    logger.log('📨 Latest message:', latestMessage);

    const userMessageContent = latestMessage?.content || '';

    let userMessageStored = false;
    const persistUserMessage = async () => {
      if (!normalizedUserId || !userMessageContent || userMessageStored) {
        return;
      }

      try {
        await chatRepository.createChatMessage({
          userId: normalizedUserId,
          role: 'user',
          content: userMessageContent,
          conversationId,
        });
        userMessageStored = true;
      } catch (storageError) {
        logger.error('❌ Failed to persist user message:', storageError);
      }
    };

    // Rate limiting
    logger.log('🔍 Checking rate limits...');
    if (userIdKey && !checkRateLimit(userIdKey)) {
      logger.warn(`⚠️ Rate limit exceeded for user ${userId}`);
      return new Response(JSON.stringify({ 
        error: "Rate limit exceeded. Please try again later." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Estimate token usage for budget check
    const estimatedTokens = messages.reduce((acc: number, msg: any) => 
      acc + (msg.content?.length || 0) / 4, 0) // Rough estimation: 4 chars per token
    
    logger.log(`📊 Estimated tokens: ${estimatedTokens}`);

    if (userIdKey && !trackTokenUsage(userIdKey, estimatedTokens)) {
      logger.warn(`⚠️ Token budget exceeded for user ${userId}`);
      return new Response(JSON.stringify({ 
        error: "Monthly token budget exceeded. Please try again next month." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Validate userId
    let validUserId: number | null = null;
    if (userId) {
      const parsed = parseInt(userId);
      if (!isNaN(parsed) && parsed > 0) {
        validUserId = parsed;
      } else {
        logger.warn(`⚠️ Invalid userId provided: ${userId}`);
      }
    }

    // Check if we should use adaptive coaching
    const useAdaptiveCoaching = normalizedUserId !== undefined && normalizedUserId > 0;
    logger.log(`🤖 Use adaptive coaching: ${useAdaptiveCoaching} (userId: ${userId})`);
    
    // If userId is provided, verify user exists
    if (normalizedUserId && normalizedUserId > 0) {
      try {
        if (userProfile && userProfile.id === normalizedUserId) {
          await chatRepository.saveUserProfile({ ...userProfile, id: normalizedUserId });
        }

        const user = await chatRepository.getUserById(normalizedUserId);
        if (!user) {
          logger.warn(`⚠️ User ${normalizedUserId} not found, proceeding with anonymous chat`);
          // Don't fail the request, just proceed without user-specific features
        } else {
          logger.log(`✅ User ${normalizedUserId} found and verified`);
        }
      } catch (userCheckError) {
        logger.warn('⚠️ User verification failed, proceeding with anonymous chat:', userCheckError);
        // Don't fail the request, just proceed without user-specific features
      }
    }
    
    // OpenAI API key validation is now handled by withSecureOpenAI wrapper

    // Add explicit timeout for the entire request
    const TIMEOUT_MS = 60000; // 60 seconds - increased for complex responses
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS);
    });
    
    if (useAdaptiveCoaching) {
      // Get the user's latest message
      const userMessage = messages[messages.length - 1]?.content || '';
      
      // Build user context
      const adaptiveContext: UserContext = {
        currentGoals: userContext?.goals || ['get running guidance'],
        recentActivity: userContext?.recentActivity || 'Chatting with coach',
        mood: userContext?.mood,
        environment: userContext?.environment,
        timeConstraints: userContext?.timeConstraints,
        weather: userContext?.weather,
        schedule: userContext?.schedule,
      };

      try {
        logger.log('🤖 Attempting adaptive coaching response...');
        logger.log('📝 User message:', userMessage);
        logger.log('🎯 Adaptive context:', adaptiveContext);
        
        // Generate adaptive coaching response with timeout
        const coachingResponse = await Promise.race([
          adaptiveCoachingEngine.generatePersonalizedResponse(
            validUserId!,
            userMessage,
            adaptiveContext
          ),
          timeoutPromise
        ]) as any;
        
        logger.log('✅ Adaptive coaching response generated successfully');
        logger.log('📊 Response confidence:', coachingResponse.confidence);
        logger.log('🔧 Adaptations:', coachingResponse.adaptations);

        // Store the conversation in database
        logger.log('💾 Storing conversation messages...');
        try {
          await persistUserMessage();

          if (normalizedUserId) {
            await chatRepository.createChatMessage({
              userId: normalizedUserId,
              role: 'assistant',
              content: coachingResponse.response,
              conversationId,
              tokenCount: Math.ceil(coachingResponse.response.length / 4),
            });
          }

          logger.log('✅ Chat messages stored successfully');
        } catch (storageError) {
          logger.error('❌ Failed to store chat messages:', storageError);
          // Continue anyway - message storage failure shouldn't block response
        }

        // Return adaptive response as a stream in the same SSE-like format the client expects
        logger.log('📤 Creating adaptive response stream...');
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const chunk = `0:${JSON.stringify({ textDelta: coachingResponse.response })}\n`;
            controller.enqueue(encoder.encode(chunk));
            controller.close();
          }
        });

        logger.log('✅ Adaptive coaching response completed successfully');
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Coaching-Interaction-Id': coachingResponse.interactionId,
            'X-Coaching-Adaptations': coachingResponse.adaptations.join(', '),
            'X-Coaching-Confidence': coachingResponse.confidence.toString(),
          }
        });
      } catch (adaptiveError) {
        logger.error('❌ Adaptive coaching failed, falling back to standard chat:');
        logger.error('❌ Adaptive error details:', adaptiveError);
        logger.error('❌ Adaptive error stack:', adaptiveError instanceof Error ? adaptiveError.stack : 'No stack trace');
        
        // If adaptive coaching fails completely, try to provide a basic response
        if (adaptiveError instanceof Error && adaptiveError.message === 'Request timeout') {
          logger.log('⏱️ Adaptive coaching timed out, trying basic response');
          return new Response(JSON.stringify({
            error: "I'm taking a bit longer than usual to respond. Let me try with a simpler approach - what specific running question can I help you with?",
            fallback: true
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        }
        
        // Fall through to standard chat
      }
    }

    // Standard chat system (fallback or for users without adaptive coaching)
    logger.log('🗨️ Using standard chat system...');
    
    let systemPrompt = `You are an expert AI endurance running coach following the AI Endurance Coach Master Protocol. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation.

## NUTRITION ENGINE KNOWLEDGE

### Pre-Run Fueling:
- Easy/short runs (<60 min): 0.5g carbs/kg body weight 1-2 hours before
- Long runs (>60 min) or hard workouts: 1.0g carbs/kg body weight 2-3 hours before
- Examples: banana, toast with honey, oatmeal, energy bar

### Intra-Run Fueling:
- <60 minutes: Water only, 300mg sodium/L
- 60-89 minutes: 30g carbs/hour, water + electrolytes, 400mg sodium/L
- 90-180 minutes: 60g carbs/hour, glucose/fructose mix, 500mg sodium/L
- >180 minutes: 90g carbs/hour, high-carb mix, 600mg sodium/L
- Hydration: 500-750ml per hour depending on conditions

### Post-Run Recovery Nutrition:
- Protein: 0.25-0.30g/kg within 30 minutes (whey, greek yogurt, eggs)
- Carbs for runs <45min: 0.6g/kg; 46-89min: 0.8g/kg; >90min: 1.0g/kg
- Window: Consume within 30-60 minutes post-workout for optimal glycogen replenishment

## RECOVERY PROTOCOL KNOWLEDGE

### Readiness Tiers:
- Low readiness (0-49): Reduce intensity, focus on recovery activities
- Moderate readiness (50-74): Standard training with monitoring
- High readiness (75-100): Optimal for key workouts and progression

### Recovery Factors:
- Sleep: 7-9 hours for athletes, sleep quality matters as much as duration
- HRV: Morning HRV trending down suggests need for recovery
- Soreness scale (1-10): >7 suggests backing off intensity
- Stress: High mental stress impacts physical recovery

### Recovery Recommendations by ACWR (Acute:Chronic Workload Ratio):
- ACWR <0.8 (Underload): Gradually increase load 5-10%
- ACWR 0.8-1.3 (Optimal): Maintain progressive overload
- ACWR 1.3-1.5 (Elevated): Hold or slightly reduce, avoid stacking hard days
- ACWR >1.5 (High Risk): Prioritize recovery, cap intensity

## TRAINING ZONE KNOWLEDGE

### Heart Rate Zones (using Karvonen method):
- Z1 (55-72% HRR): Recovery, very easy, RPE 2-3
- Z2 (72-82% HRR): Aerobic base, easy conversation pace, RPE 3-4
- Z3 (82-89% HRR): Tempo/threshold, comfortably hard, RPE 5-6
- Z4 (89-95% HRR): VO2max intervals, hard effort, RPE 7-8
- Z5 (95-100% HRR): Anaerobic/sprint, maximum effort, RPE 9+

### Training Intensity Distribution:
- 80/20 rule: 80% easy (Z1-Z2), 20% hard (Z3-Z5)
- Polarized training: Minimize Z3 "gray zone" training
- Key workouts: Long runs, tempo, intervals - schedule with adequate recovery

## COACHING GUIDELINES

Keep responses concise but informative. Always be supportive and positive. Focus on practical, actionable advice. When discussing nutrition or recovery, provide specific numbers and examples. Consider the user's training phase (base, build, peak, taper, recovery) when giving advice.`

    if (userContext) {
      systemPrompt += `\n\nUser Context: ${userContext}`
      logger.log('🎯 Added user context to system prompt');
    }

    // Prepare messages with system prompt
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ]
    
    logger.log(`📨 Prepared ${apiMessages.length} messages for OpenAI`);
    logger.log('⚙️ Using model: gpt-4o, maxTokens: 500, temperature: 0.7');

    // Use secure OpenAI wrapper for stream generation
    await persistUserMessage();

    const result = await withSecureOpenAI(
      async () => {
        logger.log('🔄 Calling OpenAI streamText...');
        
        const streamResult = await Promise.race([
          streamText({
            model: openai("gpt-4o"),
            messages: apiMessages,
            maxOutputTokens: 500, // Limit response length to control costs
            temperature: 0.7,
          }),
          timeoutPromise
        ]) as any;

        logger.log('✅ OpenAI streamText call initiated successfully');
        return streamResult;
      }
    );
    
    if (!result.success) {
      const apiError = result.error || {};
      const fallbackRequired = Boolean(apiError.fallbackRequired);
      const status = typeof apiError.status === 'number' ? apiError.status : 503;

      const payload = {
        error: apiError.message || 'AI service temporarily unavailable. Please try again later.',
        errorType: apiError.errorType || 'AI_SERVICE_ERROR',
        fallback: fallbackRequired,
        fallbackRequired,
        redirectToForm: false,
        message: apiError.message || 'AI service temporarily unavailable. Please try again later.'
      };

      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Ensure the returned stream uses the same '0:{json}' lines format
    const original = await result.data.toDataStreamResponse();
    const reader = original.body?.getReader();
    if (!reader) return original;
    const transformed = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let aggregatedContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          // Wrap raw text chunks into the expected format if they are plain text
          const lines = text.split('\n').filter(Boolean);
          for (const line of lines) {
            // If already in the expected format, pass through
            if (line.startsWith('0:')) {
              controller.enqueue(encoder.encode(line + '\n'));
              try {
                const data = JSON.parse(line.slice(2));
                if (typeof data.textDelta === 'string') {
                  aggregatedContent += data.textDelta;
                }
              } catch (parseError) {
                logger.error('❌ Failed to parse streamed chat chunk:', parseError);
              }
            } else {
              aggregatedContent += line;
              controller.enqueue(encoder.encode(`0:${JSON.stringify({ textDelta: line })}\n`));
            }
          }
        }
        if (normalizedUserId && aggregatedContent) {
          try {
            await chatRepository.createChatMessage({
              userId: normalizedUserId,
              role: 'assistant',
              content: aggregatedContent,
              conversationId,
              tokenCount: Math.ceil(aggregatedContent.length / 4),
            });
          } catch (storageError) {
            logger.error('❌ Failed to store assistant message from stream:', storageError);
          }
        }
        controller.close();
      }
    });
    return new Response(transformed, { headers: original.headers });

  } catch (error) {
    logger.error('❌ Chat API error occurred:', error);
    logger.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    logger.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return appropriate error response
    if (error instanceof Error) {
      logger.log('🔍 Analyzing error type and message...');
      
      if (error.message.includes('timeout')) {
        logger.log('⏱️ Timeout error detected');
        return new Response(JSON.stringify({ 
          error: "Request timeout. Please try again." 
        }), {
          status: 408,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('rate limit')) {
        logger.log('🚫 Rate limit error detected');
        return new Response(JSON.stringify({ 
          error: "API rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('API key') || error.message.includes('unauthorized')) {
        logger.log('🔑 API key error detected');
        return new Response(JSON.stringify({ 
          error: "AI service authentication failed. Please contact support." 
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        logger.log('🌐 Network error detected');
        return new Response(JSON.stringify({ 
          error: "Network connection failed. Please check your internet and try again." 
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      }
    }

    logger.log('❌ Returning generic error response');
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred. Please try again.",
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}

// Export the secured handler
export const POST = withChatSecurity(chatHandler);

function extractUserIdFromString(value: string | undefined | null): number | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const numericMatch = trimmed.match(/^(?:user-)?(\d+)$/i)
  const valueToParse = numericMatch ? (numericMatch[1] || trimmed) : trimmed
  const parsed = Number.parseInt(valueToParse, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function getAuthenticatedUserId(req: ApiRequest): number | null {
  const headerUserId = extractUserIdFromString(req.headers.get('x-user-id'))
  if (headerUserId != null) {
    return headerUserId
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
    const token = bearerMatch ? bearerMatch[1] : authHeader
    const parsedAuth = extractUserIdFromString(token)
    if (parsedAuth != null) {
      return parsedAuth
    }
  }

  const sessionCookie = req.cookies.get('session')
  if (sessionCookie) {
    const parsedCookie = extractUserIdFromString(sessionCookie.value)
    if (parsedCookie != null) {
      return parsedCookie
    }
  }

  return null
}

async function chatHistoryHandler(req: ApiRequest): Promise<NextResponse> {
  try {
    const requestUrl = new URL(req.url);
    const userIdParam = requestUrl.searchParams.get('userId');
    const conversationId = requestUrl.searchParams.get('conversationId')?.trim() || 'default';

    if (!userIdParam) {
      return NextResponse.json({ error: 'Missing userId query parameter' }, { status: 400 });
    }

    const parsedUserId = Number.parseInt(userIdParam, 10);
    if (Number.isNaN(parsedUserId)) {
      return NextResponse.json({ error: 'Invalid userId query parameter' }, { status: 400 });
    }

    const authenticatedUserId = getAuthenticatedUserId(req)
    if (authenticatedUserId == null) {
      return NextResponse.json({ error: 'Authentication required to access chat history' }, { status: 401 });
    }

    if (authenticatedUserId !== parsedUserId) {
      return NextResponse.json({ error: 'Forbidden: cannot access chat history for another user' }, { status: 403 });
    }

    const [user, messages] = await Promise.all([
      chatRepository.getUserById(parsedUserId),
      chatRepository.getChatHistory(parsedUserId, conversationId),
    ]);

    return NextResponse.json({
      user,
      messages,
      conversationId,
    });
  } catch (error) {
    logger.error('❌ Failed to load chat history:', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

export const GET = withChatSecurity(chatHistoryHandler);
