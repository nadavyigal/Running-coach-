'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { dbUtils, type User } from '@/lib/db'
import {
  AICoachContext,
  AICoachResponse,
  generateContextAwareResponse
} from '@/lib/enhanced-ai-coach'

interface EnhancedAICoachProps {
  user: User
  onResponse: (res: AICoachResponse) => void
}

export function EnhancedAICoach({ user, onResponse }: EnhancedAICoachProps) {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<AICoachResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)
    try {
      const runs = await dbUtils.getRunsByUser(user.id!)
      const context: AICoachContext = {
        userId: String(user.id),
        recentRuns: runs.slice(-3),
        currentPlan: null,
        performanceTrends: [],
        userPreferences: { name: user.name, coachingStyle: user.coachingStyle as any },
        coachingStyle: (user.coachingStyle as any) || 'encouraging'
      }
      const res = await generateContextAwareResponse(text, context)
      setResponse(res)
      onResponse(res)
    } catch (e) {
      const fallback: AICoachResponse = {
        response: 'Unable to generate response.',
        suggestedQuestions: [],
        followUpActions: [],
        confidence: 0,
        contextUsed: []
      }
      setResponse(fallback)
      onResponse(fallback)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ask the coach..."
          data-testid="input"
        />
        <Button onClick={handleSend} disabled={isLoading || !text.trim()} data-testid="send">
          Send
        </Button>
      </div>
      {response && <p data-testid="response">{response.response}</p>}
    </div>
  )
}

EnhancedAICoach.displayName = 'EnhancedAICoach'
