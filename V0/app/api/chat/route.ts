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
  try {
    const { messages, userId, userContext } = await req.json()

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Rate limiting
    if (userId && !checkRateLimit(userId)) {
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

    if (userId && !trackTokenUsage(userId, estimatedTokens)) {
      return new Response(JSON.stringify({ 
        error: "Monthly token budget exceeded. Please try again next month." 
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Check if we should use adaptive coaching
    const useAdaptiveCoaching = userId && parseInt(userId) > 0;
    
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
        // Generate adaptive coaching response
        const coachingResponse = await adaptiveCoachingEngine.generatePersonalizedResponse(
          parseInt(userId),
          userMessage,
          adaptiveContext
        );

        // Store the conversation in database
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

        // Return adaptive response as a stream
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

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Coaching-Interaction-Id': coachingResponse.interactionId,
            'X-Coaching-Adaptations': coachingResponse.adaptations.join(', '),
            'X-Coaching-Confidence': coachingResponse.confidence.toString(),
          }
        });
      } catch (adaptiveError) {
        console.error('Adaptive coaching failed, falling back to standard chat:', adaptiveError);
        // Fall through to standard chat
      }
    }

    // Standard chat system (fallback or for users without adaptive coaching)
    let systemPrompt = `You are an expert AI running coach. You provide helpful, encouraging, and scientifically-backed advice about running training, technique, nutrition, injury prevention, and motivation. Keep responses concise but informative. Always be supportive and positive. Focus on practical, actionable advice.`

    if (userContext) {
      systemPrompt += `\n\nUser Context: ${userContext}`
    }

    // Prepare messages with system prompt
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ]

    const result = streamText({
      model: openai("gpt-4o"),
      messages: apiMessages,
      maxTokens: 500, // Limit response length to control costs
      temperature: 0.7,
    })

    return result.toDataStreamResponse()

  } catch (error) {
    console.error('Chat API error:', error)
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return new Response(JSON.stringify({ 
          error: "Request timeout. Please try again." 
        }), {
          status: 408,
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (error.message.includes('rate limit')) {
        return new Response(JSON.stringify({ 
          error: "API rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        })
      }
    }

    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred. Please try again." 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}
