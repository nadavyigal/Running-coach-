import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { adaptiveCoachingEngine, UserContext } from '@/lib/adaptiveCoachingEngine'
import { chatRepository } from '@/lib/server/chatRepository'
import type { ChatUserProfile } from '@/lib/models/chat'
import { withChatSecurity, validateAndSanitizeInput, ApiRequest } from '@/lib/security.middleware'
// Error handling is managed by the secure wrapper and middleware
import { withSecureOpenAI } from '@/lib/apiKeyManager'

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

async function chatHandler(req: ApiRequest) {
  console.log('💬 Chat API: Starting request');
  
  try {
    // Validate and sanitize input
    const validation = await validateAndSanitizeInput(req, 1000);
    if (!validation.valid) {
      console.error('❌ Input validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error || "Invalid input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = validation.sanitized || await req.json();
    console.log('📝 Request body keys:', Object.keys(body));
    console.log('👤 User ID:', body.userId);

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
      console.error('❌ Invalid userId provided to chat route:', rawUserId);
      return new Response(JSON.stringify({ error: 'Invalid user identifier provided' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate input
    console.log('🔍 Validating input...');
    if (!messages || !Array.isArray(messages)) {
      console.error('❌ Invalid messages format:', messages);
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }
    
    console.log(`📨 Received ${messages.length} messages`);
    const latestMessage = messages[messages.length - 1];
    console.log('📨 Latest message:', latestMessage);

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
        console.error('❌ Failed to persist user message:', storageError);
      }
    };

    // Rate limiting
    console.log('🔍 Checking rate limits...');
    if (userIdKey && !checkRateLimit(userIdKey)) {
      console.warn(`⚠️ Rate limit exceeded for user ${userId}`);
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
    
    console.log(`📊 Estimated tokens: ${estimatedTokens}`);

    if (userIdKey && !trackTokenUsage(userIdKey, estimatedTokens)) {
      console.warn(`⚠️ Token budget exceeded for user ${userId}`);
      return new Response(JSON.stringify({ 
        error: "Monthly token budget exceeded. Please try again next month." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Check if we should use adaptive coaching
    const useAdaptiveCoaching = normalizedUserId !== undefined && normalizedUserId > 0;
    console.log(`🤖 Use adaptive coaching: ${useAdaptiveCoaching} (userId: ${userId})`);
    
    // If userId is provided, verify user exists
    if (normalizedUserId && normalizedUserId > 0) {
      try {
        if (userProfile && userProfile.id === normalizedUserId) {
          await chatRepository.saveUserProfile({ ...userProfile, id: normalizedUserId });
        }

        const user = await chatRepository.getUserById(normalizedUserId);
        if (!user) {
          console.warn(`⚠️ User ${normalizedUserId} not found, proceeding with anonymous chat`);
          // Don't fail the request, just proceed without user-specific features
        } else {
          console.log(`✅ User ${normalizedUserId} found and verified`);
        }
      } catch (userCheckError) {
        console.warn('⚠️ User verification failed, proceeding with anonymous chat:', userCheckError);
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
        console.log('🤖 Attempting adaptive coaching response...');
        console.log('📝 User message:', userMessage);
        console.log('🎯 Adaptive context:', adaptiveContext);
        
        // Generate adaptive coaching response with timeout
        const coachingResponse = await Promise.race([
          adaptiveCoachingEngine.generatePersonalizedResponse(
            parseInt(userId),
            userMessage,
            adaptiveContext
          ),
          timeoutPromise
        ]) as any;
        
        console.log('✅ Adaptive coaching response generated successfully');
        console.log('📊 Response confidence:', coachingResponse.confidence);
        console.log('🔧 Adaptations:', coachingResponse.adaptations);

        // Store the conversation in database
        console.log('💾 Storing conversation messages...');
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

          console.log('✅ Chat messages stored successfully');
        } catch (storageError) {
          console.error('❌ Failed to store chat messages:', storageError);
          // Continue anyway - message storage failure shouldn't block response
        }

        // Return adaptive response as a stream in the same SSE-like format the client expects
        console.log('📤 Creating adaptive response stream...');
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const chunk = `0:${JSON.stringify({ textDelta: coachingResponse.response })}\n`;
            controller.enqueue(encoder.encode(chunk));
            controller.close();
          }
        });

        console.log('✅ Adaptive coaching response completed successfully');
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Coaching-Interaction-Id': coachingResponse.interactionId,
            'X-Coaching-Adaptations': coachingResponse.adaptations.join(', '),
            'X-Coaching-Confidence': coachingResponse.confidence.toString(),
          }
        });
      } catch (adaptiveError) {
        console.error('❌ Adaptive coaching failed, falling back to standard chat:');
        console.error('❌ Adaptive error details:', adaptiveError);
        console.error('❌ Adaptive error stack:', adaptiveError instanceof Error ? adaptiveError.stack : 'No stack trace');
        
        // If adaptive coaching fails completely, try to provide a basic response
        if (adaptiveError instanceof Error && adaptiveError.message === 'Request timeout') {
          console.log('⏱️ Adaptive coaching timed out, trying basic response');
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
    console.log('🗨️ Using standard chat system...');
    
    let systemPrompt = `You are an expert AI running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative. Always be supportive and positive. Focus on practical, actionable advice.`

    if (userContext) {
      systemPrompt += `\n\nUser Context: ${userContext}`
      console.log('🎯 Added user context to system prompt');
    }

    // Prepare messages with system prompt
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ]
    
    console.log(`📨 Prepared ${apiMessages.length} messages for OpenAI`);
    console.log('⚙️ Using model: gpt-4o, maxTokens: 500, temperature: 0.7');

    // Use secure OpenAI wrapper for stream generation
    await persistUserMessage();

    const result = await withSecureOpenAI(
      async () => {
        console.log('🔄 Calling OpenAI streamText...');
        
        const streamResult = await Promise.race([
          streamText({
            model: openai("gpt-4o"),
            messages: apiMessages,
            maxTokens: 500, // Limit response length to control costs
            temperature: 0.7,
          }),
          timeoutPromise
        ]) as any;

        console.log('✅ OpenAI streamText call initiated successfully');
        return streamResult;
      }
    );
    
    if (!result.success) {
      return new Response(JSON.stringify(result.error), {
        status: result.error.status,
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
                console.error('❌ Failed to parse streamed chat chunk:', parseError);
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
            console.error('❌ Failed to store assistant message from stream:', storageError);
          }
        }
        controller.close();
      }
    });
    return new Response(transformed, { headers: original.headers });

  } catch (error) {
    console.error('❌ Chat API error occurred:', error);
    console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return appropriate error response
    if (error instanceof Error) {
      console.log('🔍 Analyzing error type and message...');
      
      if (error.message.includes('timeout')) {
        console.log('⏱️ Timeout error detected');
        return new Response(JSON.stringify({ 
          error: "Request timeout. Please try again." 
        }), {
          status: 408,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('rate limit')) {
        console.log('🚫 Rate limit error detected');
        return new Response(JSON.stringify({ 
          error: "API rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('API key') || error.message.includes('unauthorized')) {
        console.log('🔑 API key error detected');
        return new Response(JSON.stringify({ 
          error: "AI service authentication failed. Please contact support." 
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        console.log('🌐 Network error detected');
        return new Response(JSON.stringify({ 
          error: "Network connection failed. Please check your internet and try again." 
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      }
    }

    console.log('❌ Returning generic error response');
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
    console.error('❌ Failed to load chat history:', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

export const GET = withChatSecurity(chatHistoryHandler);
