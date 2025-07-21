import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { NextRequest } from "next/server"
import { adaptiveCoachingEngine, UserContext } from '@/lib/adaptiveCoachingEngine'
import { dbUtils } from '@/lib/db'

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

export async function POST(req: NextRequest) {
  console.log('💬 Chat API: Starting request');
  
  try {
    const body = await req.json();
    console.log('📝 Request body keys:', Object.keys(body));
    console.log('👤 User ID:', body.userId);
    
    const { messages, userId, userContext } = body;

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
    console.log('📨 Latest message:', messages[messages.length - 1]);

    // Rate limiting
    console.log('🔍 Checking rate limits...');
    if (userId && !checkRateLimit(userId)) {
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

    if (userId && !trackTokenUsage(userId, estimatedTokens)) {
      console.warn(`⚠️ Token budget exceeded for user ${userId}`);
      return new Response(JSON.stringify({ 
        error: "Monthly token budget exceeded. Please try again next month." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Check if we should use adaptive coaching
    const useAdaptiveCoaching = userId && parseInt(userId) > 0;
    console.log(`🤖 Use adaptive coaching: ${useAdaptiveCoaching} (userId: ${userId})`);
    
    // Check OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    console.log(`🔑 OpenAI API key: ${openaiKey ? 'Present' : '❌ MISSING'}`);
    
    if (!openaiKey) {
      console.error('❌ OpenAI API key is not configured!');
      return new Response(JSON.stringify({ 
        error: "AI service is not configured. Please contact support." 
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      })
    }
    
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
        
        // Generate adaptive coaching response
        const coachingResponse = await adaptiveCoachingEngine.generatePersonalizedResponse(
          parseInt(userId),
          userMessage,
          adaptiveContext
        );
        
        console.log('✅ Adaptive coaching response generated successfully');
        console.log('📊 Response confidence:', coachingResponse.confidence);
        console.log('🔧 Adaptations:', coachingResponse.adaptations);

        // Store the conversation in database
        console.log('💾 Storing conversation messages...');
        try {
          await dbUtils.createChatMessage({
            userId: parseInt(userId),
            role: 'user',
            content: userMessage,
            conversationId: userContext?.conversationId || 'default'
          });

          await dbUtils.createChatMessage({
            userId: parseInt(userId),
            role: 'assistant',
            content: coachingResponse.response,
            conversationId: userContext?.conversationId || 'default'
          });
          
          console.log('✅ Chat messages stored successfully');
        } catch (storageError) {
          console.error('❌ Failed to store chat messages:', storageError);
          // Continue anyway - message storage failure shouldn't block response
        }

        // Return adaptive response as a stream
        console.log('📤 Creating adaptive response stream...');
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            
            // Send the response
            controller.enqueue(encoder.encode(coachingResponse.response));
            
            // Add coaching metadata if feedback is requested
            if (coachingResponse.requestFeedback) {
              controller.enqueue(encoder.encode('\n\n---\n*How was this response? Your feedback helps me improve my coaching for you.*'));
            }
            
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

    try {
      console.log('🔄 Calling OpenAI streamText...');
      const result = streamText({
        model: openai("gpt-4o"),
        messages: apiMessages,
        maxTokens: 500, // Limit response length to control costs
        temperature: 0.7,
      })

      console.log('✅ OpenAI streamText call initiated successfully');
      return result.toDataStreamResponse()
      
    } catch (openaiError) {
      console.error('❌ OpenAI streamText failed:', openaiError);
      throw openaiError; // Re-throw to be caught by outer catch block
    }

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
