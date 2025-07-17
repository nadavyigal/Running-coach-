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
} from "lucide-react"
import { dbUtils, type User as UserType } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { trackChatMessageSent } from "@/lib/analytics"

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokenCount?: number
}

const SUGGESTED_QUESTIONS = [
  "How should I prepare for my next run?",
  "What's a good pace for my level?", 
  "Help me with running form tips",
  "How to prevent running injuries?",
  "What should I eat before running?",
  "How to stay motivated?",
]

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

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

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "",
        timestamp: new Date(),
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
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
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

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="p-4 border-t">
          <p className="text-sm text-muted-foreground mb-3">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question, index) => (
                             <Badge
                 key={index}
                 variant="secondary"
                 className="cursor-pointer hover:bg-secondary/80 transition-colors"
                 onClick={() => handleSuggestedQuestion(question)}
              >
                {question}
              </Badge>
            ))}
          </div>
        </div>
      )}

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
    </div>
  )
}
