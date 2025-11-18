'use client';

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Send,
  Bot,
  User,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Brain,
} from "lucide-react"
import { type User as UserType } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { trackChatMessageSent } from "@/lib/analytics"
import { CoachingFeedbackModal } from "@/components/coaching-feedback-modal"
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { EnhancedAICoach, type AICoachResponse } from "@/components/enhanced-ai-coach"
import { planAdaptationEngine } from "@/lib/planAdaptationEngine"
import type { ChatMessageDTO } from "@/lib/models/chat"

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokenCount?: number
  coachingInteractionId?: string
  adaptations?: string[]
  confidence?: number
  requestFeedback?: boolean
}

const buildAuthHeaders = (userId?: number | null): HeadersInit => {
  if (!userId) {
    return {}
  }

  return {
    Authorization: `Bearer user-${userId}`,
  }
}



export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [user, setUser] = useState<UserType | null>(null)
  const [conversationId] = useState<string>('default')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<ChatMessage | null>(null)
  const [showCoachingPreferences, setShowCoachingPreferences] = useState(false)
  const [showEnhancedCoach, setShowEnhancedCoach] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])
  
  useEffect(() => {
    if (user) {
      loadChatHistory()
    }
  }, [user, conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadUser = async () => {
    try {
      const currentUser = await dbUtils.getCurrentUser()
      setUser(currentUser || null)
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadChatHistory = async () => {
    if (!user?.id) {
      setIsLoadingHistory(false)
      // Show welcome message for users without ID
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hi there! I'm your AI running coach. I'm here to help you with training advice, motivation, and any running-related questions. How can I assist you today?`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
      return
    }

    try {
      setIsLoadingHistory(true)
      console.log('📚 Loading chat history for user:', user.id)

      const response = await fetch(`/api/chat?userId=${user.id}&conversationId=${conversationId}`, {
        headers: buildAuthHeaders(user?.id),
      })
      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.status}`)
      }

      const data = await response.json() as { messages?: ChatMessageDTO[] }
      const existingMessages: ChatMessageDTO[] = Array.isArray(data.messages) ? data.messages : []
      console.log(`📨 Loaded ${existingMessages.length} existing messages`)

      if (existingMessages.length > 0) {
        const chatMessages: ChatMessage[] = existingMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tokenCount: msg.tokenCount,
        }))

        setMessages(chatMessages)
        console.log('?£ו Chat history loaded successfully')
      } else {
        const welcomeMessage: ChatMessage = {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Hi there! I'm your AI running coach. I'm here to help you with training advice, motivation, and any running-related questions. How can I assist you today?`,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
        console.log('?ƒסכ No existing history, showing welcome message')
      }
    } catch (error) {
      console.error('?¥ל Failed to load chat history:', error)
      toast({
        title: "Chat History Error",
        description: "Failed to load previous messages. Starting fresh conversation.",
        variant: "destructive",
      })
      
      // Fallback to welcome message
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hi there! I'm your AI running coach. I'm here to help you with training advice, motivation, and any running-related questions. How can I assist you today?`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // Track chat message sent
    await trackChatMessageSent({
      message_length: content.trim().length,
      conversation_length: messages.length + 1,
      is_first_message: messages.length === 1
    })

    try {
      // Prepare context from user profile and recent runs
      const context = await buildUserContext()
      const userProfilePayload = user?.id ? {
        id: user.id,
        name: user.name,
        goal: user.goal,
        experience: user.experience,
        preferredTimes: user.preferredTimes,
        daysPerWeek: user.daysPerWeek,
        onboardingComplete: user.onboardingComplete,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
      } : undefined

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(user?.id),
        },
        body: JSON.stringify({
          messages: [
            ...messages.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: content.trim() }
          ],
          userId: user?.id?.toString(),
          userContext: context,
          conversationId,
          userProfile: userProfilePayload,
        }),
      })

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `API request failed: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.fallback) {
            // This is a fallback response, show it as a normal message
            const fallbackMessage: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: errorMessage,
              timestamp: new Date(),
            }
            setMessages(prev => [...prev, fallbackMessage])
            return; // Don't throw error for fallback responses
          }
        } catch {
          // If we can't parse the error, use the status code
        }
        throw new Error(errorMessage)
      }

      // Enhanced stream debugging implementation
      console.log('?ƒפ? Stream Response Status:', response.status);
      console.log('?ƒפ? Stream Headers:', Object.fromEntries(response.headers.entries()));
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let aiContent = ""
      let updateCount = 0

      // Extract coaching metadata from headers
      const coachingInteractionId = response.headers.get('X-Coaching-Interaction-Id')
      const adaptations = response.headers.get('X-Coaching-Adaptations')?.split(', ').filter(Boolean)
      const confidenceHeader = response.headers.get('X-Coaching-Confidence')
      const confidence = confidenceHeader ? parseFloat(confidenceHeader) : undefined

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "",
        timestamp: new Date(),
        ...(coachingInteractionId ? { coachingInteractionId } : {}),
        ...(normalizedConfidence ? { confidence: normalizedConfidence } : {}),
        adaptations: adaptations || [],
        coachingInteractionId: coachingInteractionId || undefined,
        confidence,
        requestFeedback: typeof confidence === 'number' && confidence > 0 && confidence < 0.8, // Request feedback for lower confidence responses
      }

      setMessages(prev => [...prev, assistantMessage])

      const STREAM_TIMEOUT_MS = 30000;
      let streamTimeoutError: Error | null = null;
      const streamTimeout = setTimeout(() => {
        streamTimeoutError = new Error('Streaming response timeout');
        reader?.cancel('timeout');
      }, STREAM_TIMEOUT_MS);

      try {
      while (reader) {
        if (streamTimeoutError) {
          throw streamTimeoutError;
        }

        const readResult = await reader.read().catch(err => {
          if (streamTimeoutError) {
            throw streamTimeoutError;
          }
          throw err;
        });
        const { done, value } = readResult;
        if (done) {
          console.log('?£ו Stream complete. Total updates:', updateCount);
          break
        }

        const chunk = decoder.decode(value)
        console.log('?ƒף? Chunk received:', chunk.length, 'chars');
        
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const data = JSON.parse(line.slice(2))
              if (data.textDelta) {
                aiContent += data.textDelta
                updateCount++;
                
                console.log('?ƒפה UI Update #', updateCount, 'Content length:', aiContent.length);
                
                setMessages(prev => {
                  const updated = prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: aiContent }
                      : msg
                  );
                  console.log('?ƒמ» Messages array updated:', updated.length, 'messages');
                  return updated;
                });
              }
            } catch (parseError) {
              console.error('?¥ל JSON Parse Error:', parseError, 'Line:', line);
            }
          }
        }
      }
      if (streamTimeoutError) {
        throw streamTimeoutError;
      }
      } finally {
        clearTimeout(streamTimeout);
      }

      // Update final message with feedback request if needed
      if (assistantMessage.requestFeedback) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, requestFeedback: true }
              : msg
          )
        )
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      toast({
        title: "Chat Error",
        description: "Failed to get response from AI coach. Please try again.",
        variant: "destructive",
      })

      // Remove the failed user message and show error message
      setMessages(prev => prev.slice(0, -1))
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const buildUserContext = async (): Promise<string> => {
    if (!user) return "User data not available."

    try {
      // Get last 3 runs for context
      const recentRuns = await dbUtils.getRunsByUser(user.id!)
      const lastThreeRuns = recentRuns.slice(-3)

      let context = `User Profile: ${user.goal} goal, ${user.experience} level, runs ${user.daysPerWeek} days per week.`
      
      if (lastThreeRuns.length > 0) {
        context += ` Recent runs: ${lastThreeRuns.map((run, i) => 
          `Run ${i + 1}: ${run.distance}km in ${Math.round(run.duration / 60)} min`
        ).join(', ')}.`
      }

      return context
    } catch (error) {
      console.error('Failed to build context:', error)
      return "Unable to load user context."
    }
  }

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage(inputValue)
  }

  const handleFeedbackClick = (message: ChatMessage) => {
    setSelectedMessageForFeedback(message)
    setShowFeedbackModal(true)
  }

  const handleAICoachResponse = (response: AICoachResponse) => {
    // Convert AI coach response to chat message
    const aiMessage: ChatMessage = {
      id: `ai-coach-${Date.now()}`,
      role: 'assistant',
      content: response.response,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, aiMessage])
    
    // Auto-scroll to new message
    setTimeout(() => scrollToBottom(), 100)
  }

  const MessageBubble = ({ message }: { message: ChatMessage }) => {
    const isUser = message.role === 'user'
    
    return (
      <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isUser && (
          <Avatar className="h-8 w-8 mt-1">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
          <div
            className={`rounded-lg px-4 py-2 ${
              isUser
                ? 'bg-primary text-primary-foreground ml-auto'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {/* Show adaptations for assistant messages */}
            {!isUser && message.adaptations && message.adaptations.length > 0 && (
              <div className="mt-2 text-xs opacity-70">
                <span className="font-medium">Adaptations: </span>
                {message.adaptations.join(', ')}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1 px-1">
            <p className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            
            {/* Feedback buttons for assistant messages */}
            {!isUser && message.coachingInteractionId && (
              <div className="flex items-center gap-1 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                  onClick={() => handleFeedbackClick(message)}
                  title="This was helpful"
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  onClick={() => handleFeedbackClick(message)}
                  title="This needs improvement"
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Request feedback indicator */}
            {!isUser && message.requestFeedback && (
              <Badge variant="outline" className="text-xs ml-auto">
                Feedback appreciated
              </Badge>
            )}
          </div>
        </div>

        {isUser && (
          <Avatar className="h-8 w-8 mt-1">
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-lg">AI Running Coach</h1>
              <p className="text-sm text-muted-foreground">
                Your personal training assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showEnhancedCoach ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowEnhancedCoach(!showEnhancedCoach)}
              title="Enhanced AI Coach"
            >
              <Brain className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCoachingPreferences(true)}
              title="Coaching preferences"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center py-8" role="status" aria-label="Loading chat history">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Loading chat history...</span>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex justify-start" role="status" aria-label="Loading">
                  <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">Coach is thinking...</span>
                  </div>
                </div>
              )}
              
              {/* Enhanced AI Coach Widget */}
              {user && showEnhancedCoach && (
                <div className="mt-4">
                  <EnhancedAICoach
                    user={user}
                    onResponse={handleAICoachResponse}
                  />
                </div>
              )}

              {/* Recovery Status Widget */}
              {user && (
                <div className="mt-4">
                  <RecoveryRecommendations
                    userId={user.id!}
                    date={new Date()}
                    showBreakdown={false}
                    onRefresh={() => {
                      console.log('Refreshing recovery data for chat...');
                    }}
                  />
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      

      {/* Input */}
      <div className="border-t bg-card p-4">
        <form onSubmit={handleInputSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask your running coach anything..."
            disabled={isLoading}
            className="flex-1"
          />
                     <Button 
             type="submit" 
             disabled={!inputValue.trim() || isLoading}
             size="icon"
           >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
      
      {/* Coaching Feedback Modal */}
      {showFeedbackModal && selectedMessageForFeedback && user && (
        <CoachingFeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false)
            setSelectedMessageForFeedback(null)
          }}
          interactionType="chat_response"
          userId={user.id!}
          {...(selectedMessageForFeedback.coachingInteractionId
            ? { interactionId: selectedMessageForFeedback.coachingInteractionId }
            : {})}
          initialContext={{
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
            userMood: 'neutral',
            recentPerformance: 'chatting'
          }}
        />
      )}
      
      {/* Coaching Preferences Settings Modal */}
      {showCoachingPreferences && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Coaching Preferences</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCoachingPreferences(false)}
              >
                ?ק
              </Button>
            </div>
            <div className="p-4">
              <CoachingPreferencesSettings
                userId={user.id!}
                onClose={() => setShowCoachingPreferences(false)}
              />
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
