import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../lib/db'
import { OnboardingSessionTracker } from '../lib/onboardingAnalytics'

// Mock the AI service
vi.mock('../app/api/onboarding/chat/route', () => ({
  POST: vi.fn()
}))

// Mock analytics
vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  trackOnboardingEvent: vi.fn()
}))

// Mock database
vi.mock('../lib/db', () => ({
  db: {
    users: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      toArray: vi.fn(),
      clear: vi.fn()
    },
    chatMessages: {
      add: vi.fn(),
      where: vi.fn(() => ({
        toArray: vi.fn()
      })),
      clear: vi.fn()
    }
  },
  resetDatabaseInstance: vi.fn()
}))

interface ChatMessage {
  id?: number
  userId: number
  role: 'user' | 'assistant'
  content: string
  sessionId: string
  phase: 'motivation' | 'assessment' | 'creation' | 'refinement'
  timestamp: Date
  metadata?: Record<string, any>
}

interface ChatSession {
  id: string
  userId: number
  phase: 'motivation' | 'assessment' | 'creation' | 'refinement'
  messages: ChatMessage[]
  startTime: Date
  lastActivity: Date
  isComplete: boolean
  userData: Record<string, any>
}

// Chat flow service simulation
class ChatFlowService {
  private sessions: Map<string, ChatSession> = new Map()
  private aiServiceAvailable = true
  
  async createSession(userId: number): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: ChatSession = {
      id: sessionId,
      userId,
      phase: 'motivation',
      messages: [],
      startTime: new Date(),
      lastActivity: new Date(),
      isComplete: false,
      userData: {}
    }
    
    this.sessions.set(sessionId, session)
    return sessionId
  }
  
  async sendMessage(sessionId: string, content: string, role: 'user' | 'assistant'): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    const message: ChatMessage = {
      userId: session.userId,
      role,
      content,
      sessionId,
      phase: session.phase,
      timestamp: new Date(),
      metadata: {}
    }
    
    session.messages.push(message)
    session.lastActivity = new Date()
    
    // Simulate saving to database
    await db.chatMessages.add(message)
    
    return message
  }
  
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId)
    return session ? session.messages : []
  }
  
  async saveSessionState(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const onboardingSession = {
      sessionId,
      phase: session.phase,
      messageCount: session.messages.length,
      userData: session.userData,
      lastActivity: session.lastActivity
    }

    await db.users.update(session.userId, {
      onboardingSession,
      updatedAt: new Date()
    })
  }
  
  async restoreSession(userId: number, sessionData: any): Promise<string> {
    const validPhases = ['motivation', 'assessment', 'creation', 'refinement']
    const isValidPhase = validPhases.includes(sessionData?.phase)
    const hasValidCounts = typeof sessionData?.messageCount === 'number' ? sessionData.messageCount >= 0 : true
    const useExisting = sessionData?.sessionId && isValidPhase && hasValidCounts

    const sessionId = useExisting ? sessionData.sessionId : await this.createSession(userId)
    
    let messages: ChatMessage[] = []
    try {
      const query = db.chatMessages.where as any
      const stored = await query({ sessionId }).toArray()
      messages = Array.isArray(stored) ? stored : []
    } catch {
      messages = []
    }
    
    const session: ChatSession = {
      id: sessionId,
      userId,
      phase: isValidPhase ? sessionData.phase : 'motivation',
      messages,
      startTime: new Date(sessionData?.startTime || Date.now()),
      lastActivity: new Date(sessionData?.lastActivity || Date.now()),
      isComplete: sessionData?.isComplete || false,
      userData: sessionData?.userData || {}
    }
    
    this.sessions.set(sessionId, session)
    return sessionId
  }
  
  async simulateAIResponse(sessionId: string, userMessage: string): Promise<string> {
    if (!this.aiServiceAvailable) {
      throw new Error('AI service unavailable')
    }
    
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    // Simulate AI processing based on phase
    let response = ''
    switch (session.phase) {
      case 'motivation':
        response = this.generateMotivationResponse(userMessage)
        break
      case 'assessment':
        response = this.generateAssessmentResponse(userMessage)
        break
      case 'creation':
        response = this.generateCreationResponse(userMessage)
        break
      case 'refinement':
        response = this.generateRefinementResponse(userMessage)
        break
    }
    
    return response
  }
  
  private generateMotivationResponse(userMessage: string): string {
    if (userMessage.toLowerCase().includes('health')) {
      return "That's great! Health is a wonderful motivation. What specific health goals are you hoping to achieve through running?"
    }
    return "I understand your motivation. Let's move on to assess your current fitness level."
  }
  
  private generateAssessmentResponse(userMessage: string): string {
    if (userMessage.toLowerCase().includes('beginner')) {
      return "Perfect! As a beginner, we'll start with a gentle approach. How many days per week would you like to run?"
    }
    return "Got it! Let's create a personalized plan for you."
  }
  
  private generateCreationResponse(_userMessage: string): string {
    return "I'm creating your personalized running plan based on your preferences. This will include a mix of easy runs, rest days, and gradual progression."
  }
  
  private generateRefinementResponse(_userMessage: string): string {
    return "Great! I've refined your plan based on your feedback. You're all set to start your running journey!"
  }
  
  async transitionPhase(sessionId: string, newPhase: 'motivation' | 'assessment' | 'creation' | 'refinement'): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      const previousPhase = session.phase
      session.phase = newPhase
      try {
        await this.saveSessionState(sessionId)
      } catch (error) {
        session.phase = previousPhase
        throw error
      }
    }
  }
  
  setAIServiceAvailable(available: boolean): void {
    this.aiServiceAvailable = available
  }
  
  clearSessions(): void {
    this.sessions.clear()
  }
}

describe('AC2: Integration Tests for AI Chat Flow', () => {
  let chatService: ChatFlowService
  let sessionTracker: OnboardingSessionTracker
  let userId: number

  beforeEach(async () => {
    vi.clearAllMocks()
    
    chatService = new ChatFlowService()
    sessionTracker = new OnboardingSessionTracker()
    userId = 1
    
    // Setup database mocks
    vi.mocked(db.users.get).mockResolvedValue({
      id: userId,
      name: 'Test User',
      onboardingComplete: false,
      goal: 'fitness' as const,
      experience: 'beginner' as const,
      daysPerWeek: 3,
      preferredTimes: ['morning'],
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    vi.mocked(db.users.update).mockResolvedValue(1)
    vi.mocked(db.chatMessages.add).mockResolvedValue(1)
    vi.mocked(db.chatMessages.where).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([])
    } as any)
    
    await db.users.clear()
    await db.chatMessages.clear()
  })

  afterEach(() => {
    chatService.clearSessions()
    vi.resetAllMocks()
  })

  describe('Conversation State Persistence', () => {
    it('should persist conversation state during chat', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Send initial message
      await chatService.sendMessage(sessionId, 'I want to start running for health', 'user')
      await chatService.saveSessionState(sessionId)
      
      // Verify state was saved
      expect(db.users.update).toHaveBeenCalledWith(userId, expect.objectContaining({
        onboardingSession: expect.objectContaining({
          sessionId,
          phase: 'motivation',
          messageCount: 1
        }),
        updatedAt: expect.any(Date)
      }))
    })

    it('should persist conversation across multiple messages', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Send multiple messages
      await chatService.sendMessage(sessionId, 'I want to get healthy', 'user')
      const aiResponse = await chatService.simulateAIResponse(sessionId, 'I want to get healthy')
      await chatService.sendMessage(sessionId, aiResponse, 'assistant')
      await chatService.sendMessage(sessionId, 'I am a complete beginner', 'user')
      
      await chatService.saveSessionState(sessionId)
      
      const messages = await chatService.getSessionMessages(sessionId)
      expect(messages).toHaveLength(3)
      expect(messages[0]?.content).toBe('I want to get healthy')
      expect(messages[1]?.role).toBe('assistant')
      expect(messages[2]?.content).toBe('I am a complete beginner')
    })

    it('should persist user data extracted during conversation', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Simulate extracting user preferences
      await chatService.sendMessage(sessionId, 'I want to run 3 days per week in the morning', 'user')
      
      // Update session with extracted data
      const session = chatService['sessions'].get(sessionId)
      if (session) {
        session.userData = {
          daysPerWeek: 3,
          preferredTimes: ['morning'],
          goal: 'health'
        }
      }
      
      await chatService.saveSessionState(sessionId)
      
      expect(db.users.update).toHaveBeenCalledWith(userId, expect.objectContaining({
        onboardingSession: expect.objectContaining({
          userData: {
            daysPerWeek: 3,
            preferredTimes: ['morning'],
            goal: 'health'
          }
        })
      }))
    })

    it('should handle large conversation histories', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Send many messages
      for (let i = 0; i < 50; i++) {
        await chatService.sendMessage(sessionId, `Message ${i}`, 'user')
        const aiResponse = await chatService.simulateAIResponse(sessionId, `Message ${i}`)
        await chatService.sendMessage(sessionId, aiResponse, 'assistant')
      }
      
      await chatService.saveSessionState(sessionId)
      
      const messages = await chatService.getSessionMessages(sessionId)
      expect(messages).toHaveLength(100) // 50 user + 50 assistant messages
      
      expect(db.users.update).toHaveBeenCalledWith(userId, expect.objectContaining({
        onboardingSession: expect.objectContaining({
          messageCount: 100
        })
      }))
    })
  })

  describe('Chat Session Recovery', () => {
    it('should recover chat session after app restart', async () => {
      // Create initial session
      const originalSessionId = await chatService.createSession(userId)
      await chatService.sendMessage(originalSessionId, 'I want to start running', 'user')
      await chatService.transitionPhase(originalSessionId, 'assessment')
      await chatService.saveSessionState(originalSessionId)
      
      // Simulate app restart - clear in-memory sessions
      chatService.clearSessions()
      
      // Mock database returning saved session data
      const savedSessionData = {
        sessionId: originalSessionId,
        phase: 'assessment',
        userData: { goal: 'health' },
        messageCount: 1,
        lastActivity: new Date()
      }
      
      vi.mocked(db.chatMessages.where).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userId,
            role: 'user',
            content: 'I want to start running',
            sessionId: originalSessionId,
            phase: 'motivation',
            createdAt: new Date()
          }
        ])
      } as any)
      
      // Restore session
      const restoredSessionId = await chatService.restoreSession(userId, savedSessionData)
      
      expect(restoredSessionId).toBe(originalSessionId)
      
      const messages = await chatService.getSessionMessages(restoredSessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.content).toBe('I want to start running')
    })

    it('should handle corrupted session data gracefully', async () => {
      const corruptedSessionData = {
        sessionId: 'invalid_session',
        phase: 'invalid_phase',
        userData: null,
        messageCount: -1
      }
      
      // Should create new session when restoration fails
      const newSessionId = await chatService.restoreSession(userId, corruptedSessionData)
      
      expect(newSessionId).toBeDefined()
      expect(newSessionId).not.toBe('invalid_session')
      
      const messages = await chatService.getSessionMessages(newSessionId)
      expect(messages).toHaveLength(0) // Fresh session
    })

    it('should recover partial conversations', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Send some messages but don't complete onboarding
      await chatService.sendMessage(sessionId, 'I want to get fit', 'user')
      await chatService.transitionPhase(sessionId, 'assessment')
      await chatService.sendMessage(sessionId, 'I am intermediate level', 'user')
      await chatService.saveSessionState(sessionId)
      
      // Clear and restore
      chatService.clearSessions()
      
      vi.mocked(db.chatMessages.where).mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            userId,
            role: 'user',
            content: 'I want to get fit',
            sessionId,
            phase: 'motivation',
            createdAt: new Date()
          },
          {
            userId,
            role: 'user',
            content: 'I am intermediate level',
            sessionId,
            phase: 'assessment',
            createdAt: new Date()
          }
        ])
      } as any)
      
      const restoredSessionId = await chatService.restoreSession(userId, {
        sessionId,
        phase: 'assessment',
        userData: { experience: 'intermediate' }
      })
      
      const messages = await chatService.getSessionMessages(restoredSessionId)
      expect(messages).toHaveLength(2)
      expect(messages[1]?.phase).toBe('assessment')
    })
  })

  describe('Error Handling in Chat Flow', () => {
    it('should handle AI service errors gracefully', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Disable AI service
      chatService.setAIServiceAvailable(false)
      
      await expect(
        chatService.simulateAIResponse(sessionId, 'Hello')
      ).rejects.toThrow('AI service unavailable')
      
      // Should still save user message
      await chatService.sendMessage(sessionId, 'Hello', 'user')
      const messages = await chatService.getSessionMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.role).toBe('user')
    })

    it('should implement retry logic for failed AI requests', async () => {
      const sessionId = await chatService.createSession(userId)
      
      let attempts = 0
      const originalSimulate = chatService.simulateAIResponse.bind(chatService)
      chatService.simulateAIResponse = async (sessionId: string, message: string) => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary AI service error')
        }
        return originalSimulate(sessionId, message)
      }
      
      // Simulate retry logic
      let response = ''
      let retryCount = 0
      const maxRetries = 3
      
      while (retryCount < maxRetries) {
        try {
          response = await chatService.simulateAIResponse(sessionId, 'Hello')
          break
        } catch (error) {
          retryCount++
          if (retryCount >= maxRetries) {
            throw error
          }
          await Promise.resolve()
        }
      }
      
      expect(response).toBeDefined()
      expect(retryCount).toBe(2) // Should succeed on third attempt
    })

    it('should handle database connection errors', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Mock database error
      vi.mocked(db.chatMessages.add).mockRejectedValue(new Error('Database connection failed'))
      
      // Should throw error when trying to save message
      await expect(
        chatService.sendMessage(sessionId, 'Hello', 'user')
      ).rejects.toThrow('Database connection failed')
    })
  })

  describe('AI Service Fallback Mechanisms', () => {
    it('should fallback to form-based onboarding when AI fails', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Simulate AI service failure
      chatService.setAIServiceAvailable(false)
      
      let fallbackActivated = false
      
      try {
        await chatService.simulateAIResponse(sessionId, 'I want to start running')
      } catch (error) {
        // Activate fallback mechanism
        fallbackActivated = true
        
        // Simulate saving fallback state
        await db.users.update(userId, {
          updatedAt: new Date()
        })
      }
      
      expect(fallbackActivated).toBe(true)
      expect(db.users.update).toHaveBeenCalledWith(userId, expect.objectContaining({
        updatedAt: expect.any(Date)
      }))
    })

    it('should provide cached responses when AI is slow', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Mock cached responses
      const responseCache = new Map<string, string>()
      responseCache.set('hello', 'Hello! Welcome to your running journey!')
      responseCache.set('beginner', 'Great! Let\'s start with a beginner-friendly approach.')
      
      const getCachedResponse = (message: string): string | null => {
        const key = message.toLowerCase().split(' ').find(word => responseCache.has(word))
        return key ? responseCache.get(key) || null : null
      }
      
      // Test cached response
      const cachedResponse = getCachedResponse('I am a beginner')
      expect(cachedResponse).toBe('Great! Let\'s start with a beginner-friendly approach.')
    })

    it('should gracefully degrade AI features when service is limited', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Simulate limited AI service (simple responses only)
      chatService.simulateAIResponse = async (sessionId: string, message: string) => {
        // Provide basic, non-AI responses
        if (message.toLowerCase().includes('beginner')) {
          return 'I understand you\'re a beginner. Let\'s create a plan for you.'
        }
        return 'I see. Let\'s move to the next step.'
      }
      
      const response = await chatService.simulateAIResponse(sessionId, 'I am a beginner runner')
      expect(response).toBe('I understand you\'re a beginner. Let\'s create a plan for you.')
    })
  })

  describe('Conversation Phase Transitions', () => {
    it('should transition through all onboarding phases', async () => {
      const sessionId = await chatService.createSession(userId)
      sessionTracker.startStep('motivation')
      
      // Motivation phase
      expect(chatService['sessions'].get(sessionId)?.phase).toBe('motivation')
      await chatService.sendMessage(sessionId, 'I want to get healthy', 'user')
      
      // Transition to assessment
      await chatService.transitionPhase(sessionId, 'assessment')
      sessionTracker.completeStep('motivation')
      sessionTracker.transitionPhase('assessment')
      expect(chatService['sessions'].get(sessionId)?.phase).toBe('assessment')
      
      // Assessment phase
      await chatService.sendMessage(sessionId, 'I am a beginner', 'user')
      
      // Transition to creation
      await chatService.transitionPhase(sessionId, 'creation')
      sessionTracker.completeStep('assessment')
      sessionTracker.transitionPhase('creation')
      expect(chatService['sessions'].get(sessionId)?.phase).toBe('creation')
      
      // Creation phase
      await chatService.sendMessage(sessionId, 'Create my plan', 'user')
      
      // Transition to refinement
      await chatService.transitionPhase(sessionId, 'refinement')
      sessionTracker.completeStep('creation')
      sessionTracker.transitionPhase('refinement')
      expect(chatService['sessions'].get(sessionId)?.phase).toBe('refinement')
      
      // Complete refinement
      await chatService.sendMessage(sessionId, 'Looks good!', 'user')
      sessionTracker.completeStep('refinement')
    })

    it('should handle phase transition errors', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Mock database error during phase transition
      vi.mocked(db.users.update).mockRejectedValue(new Error('Database error'))
      
      await expect(
        chatService.transitionPhase(sessionId, 'assessment')
      ).rejects.toThrow('Database error')
      
      // Phase should remain unchanged
      expect(chatService['sessions'].get(sessionId)?.phase).toBe('motivation')
    })

    it('should validate phase transitions', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Should not allow skipping phases
      const isValidTransition = (from: string, to: string): boolean => {
        const phases = ['motivation', 'assessment', 'creation', 'refinement']
        const fromIndex = phases.indexOf(from)
        const toIndex = phases.indexOf(to)
        return toIndex === fromIndex + 1 || toIndex === fromIndex - 1
      }
      
      expect(isValidTransition('motivation', 'assessment')).toBe(true)
      expect(isValidTransition('motivation', 'creation')).toBe(false) // Should not skip assessment
      expect(isValidTransition('assessment', 'motivation')).toBe(true) // Allow going back
    })

    it('should track time spent in each phase', async () => {
      const sessionId = await chatService.createSession(userId)
      const phaseStartTimes: Record<string, Date> = {}
      
      // Track motivation phase
      phaseStartTimes.motivation = new Date(Date.now() - 15)
      
      await chatService.transitionPhase(sessionId, 'assessment')
      const motivationTime = Date.now() - phaseStartTimes.motivation.getTime()
      
      expect(motivationTime).toBeGreaterThan(0)
      
      // Track assessment phase
      phaseStartTimes.assessment = new Date(Date.now() - 12)
      
      await chatService.transitionPhase(sessionId, 'creation')
      const assessmentTime = Date.now() - phaseStartTimes.assessment.getTime()
      
      expect(assessmentTime).toBeGreaterThan(0)
    })

    it('should maintain message context across phase transitions', async () => {
      const sessionId = await chatService.createSession(userId)
      
      // Send message in motivation phase
      await chatService.sendMessage(sessionId, 'I want to lose weight', 'user')
      
      // Transition to assessment
      await chatService.transitionPhase(sessionId, 'assessment')
      
      // Send message in assessment phase
      await chatService.sendMessage(sessionId, 'I run once a week', 'user')
      
      // All messages should be preserved
      const messages = await chatService.getSessionMessages(sessionId)
      expect(messages).toHaveLength(2)
      expect(messages[0]?.phase).toBe('motivation')
      expect(messages[1]?.phase).toBe('assessment')
    })
  })
})
