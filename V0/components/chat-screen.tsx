'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Settings,
} from "lucide-react"
import { dbUtils, type User as UserType } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { trackChatMessageSent } from "@/lib/analytics"
import { CoachingFeedbackModal } from "@/components/coaching-feedback-modal"

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



export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<ChatMessage | null>(null)

  useEffect(() => {
    loadUser()
    loadChatHistory()
  }, [])

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
    // TODO: Implement chat history loading from Dexie.js
    // For now, add a welcome message
    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Hi there! I'm your AI running coach. I'm here to help you with training advice, motivation, and any running-related questions. How can I assist you today?`,
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
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
      
             const response = await fetch('/api/chat', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           messages: [
             ...messages.map(msg => ({ role: msg.role, content: msg.content })),
             { role: 'user', content: content.trim() }
           ],
           userId: user?.id?.toString(),
           userContext: context
         }),
       })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let aiContent = ""

      // Extract coaching metadata from headers
      const coachingInteractionId = response.headers.get('X-Coaching-Interaction-Id')
      const adaptations = response.headers.get('X-Coaching-Adaptations')?.split(', ').filter(Boolean)
      const confidence = parseFloat(response.headers.get('X-Coaching-Confidence') || '0')
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "",
        timestamp: new Date(),
        coachingInteractionId: coachingInteractionId || undefined,
        adaptations: adaptations || [],
        confidence: confidence || undefined,
        requestFeedback: confidence > 0 && confidence < 0.8, // Request feedback for lower confidence responses
      }

      setMessages(prev => [...prev, assistantMessage])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const data = JSON.parse(line.slice(2))
              if (data.textDelta) {
                aiContent += data.textDelta
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: aiContent }
                      : msg
                  )
                )
              }
            } catch (e) {
              // Ignore JSON parse errors for streaming chunks
            }
          }
        }
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
      
      // TODO: Save messages to Dexie.js
      
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

  const handleSuggestedQuestion = (question: string) => {
    handleSendMessage(question)
  }

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage(inputValue)
  }

  const handleFeedbackClick = (message: ChatMessage) => {
    setSelectedMessageForFeedback(message)
    setShowFeedbackModal(true)
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
          <div ref={messagesEndRef} />
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
          interactionId={selectedMessageForFeedback.coachingInteractionId}
          initialContext={{
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
            userMood: 'neutral',
            recentPerformance: 'chatting'
          }}
        />
      )}
      
      
    </div>
  )
}
