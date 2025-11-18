'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import { dbUtils, type User as UserType, type OnboardingSession } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { trackOnboardingEvent } from "@/lib/analytics"
import { 
  trackOnboardingChatMessage,
  trackConversationPhase,
  trackOnboardingError,
  trackAIGuidanceUsage,
  OnboardingPhase
} from '@/lib/onboardingAnalytics'
import { useErrorToast } from '@/components/error-toast'
import { useAIServiceErrorHandling } from '@/hooks/use-ai-service-error-handling'
import { useNetworkErrorHandling } from '@/hooks/use-network-error-handling'
import { CoachingFeedbackModal } from "@/components/coaching-feedback-modal"
// import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings"
import { conversationStorage } from '@/lib/conversationStorage'
import { sessionManager, type SessionResumeData } from '@/lib/sessionManager'

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

// OnboardingPhase is now imported from onboardingAnalytics

interface OnboardingChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (goals: any[], userProfile: any) => void;
  currentStep?: number;
  totalSteps?: number;
}

export function OnboardingChatOverlay({ isOpen, onClose, onComplete }: OnboardingChatOverlayProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<ChatMessage | null>(null)
  const [currentPhase, setCurrentPhase] = useState<OnboardingPhase>('motivation')
  const [phaseStartTime, setPhaseStartTime] = useState<Date>(new Date())
  const [messagesInCurrentPhase, setMessagesInCurrentPhase] = useState<number>(0)
  
  // Session and persistence state
  const [currentSession, setCurrentSession] = useState<OnboardingSession | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const [isResumingSession, setIsResumingSession] = useState(false)
  const [sessionConflicts, setSessionConflicts] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  
  // Error handling hooks
  const { showError } = useErrorToast()
  const { 
    aiChatWithFallback, 
    getAIServiceStatus, 
    enableFallbackMode 
  } = useAIServiceErrorHandling({
    enableFallbacks: true,
    showUserFeedback: true
  })
  const { safeApiCall, isOnline } = useNetworkErrorHandling({
    enableOfflineMode: false, // Chat requires internet
    enableAutoRetry: true,
    showToasts: true
  })

  useEffect(() => {
    initializeOnboardingSession()
  }, [])

  useEffect(() => {
    // If dialog opens after initial mount, ensure a session is loaded/created
    if (isOpen && user && !currentSession && !isLoadingHistory) {
      loadOrCreateSession()
    }
  }, [isOpen])

  useEffect(() => {
    if (user && !currentSession) {
      loadOrCreateSession()
    }
  }, [user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initializeOnboardingSession = async () => {
    try {
      const currentUser = await dbUtils.getCurrentUser()
      setUser(currentUser || null)
    } catch (error) {
      console.error('Failed to load user:', error)
      setIsLoadingHistory(false)
    }
  }

  const loadOrCreateSession = async () => {
    if (!user?.id) return

    try {
      setIsLoadingHistory(true)
      
      // Try to resume existing session first
      const resumeData = await sessionManager.resumeSession(user.id)
      
      if (resumeData && resumeData.canResume) {
        await resumeExistingSession(resumeData)
      } else {
        await createNewSession()
      }
      
      if (resumeData?.conflicts && resumeData.conflicts.length > 0) {
        setSessionConflicts(resumeData.conflicts)
        // Optionally show conflict resolution UI
        showConflictResolutionToast(resumeData.conflicts.length)
      }
      
    } catch (error) {
      console.error('Failed to load or create session:', error)
      showError(new Error('Failed to initialize conversation. Please try again.'))
      await createFallbackSession()
    } finally {
      setIsLoadingHistory(false)
      console.log('✅ Chat history loading completed')
    }
  }

  const resumeExistingSession = async (resumeData: SessionResumeData) => {
    try {
      setIsResumingSession(true)
      setCurrentSession(resumeData.session)
      setConversationId(resumeData.conversationId)
      setCurrentPhase(mapSessionPhaseToOnboardingPhase(resumeData.session.goalDiscoveryPhase))
      
      // Load conversation history
      const conversationData = await conversationStorage.loadConversation(resumeData.conversationId, {
        limit: 100,
        includeMetadata: true,
        validateIntegrity: true
      })

      // Convert stored messages to chat messages
      const loadedMessages: ChatMessage[] = conversationData.messages.map(msg => ({
        id: msg.id?.toString() || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        tokenCount: msg.metadata?.tokenCount as number,
        coachingInteractionId: msg.metadata?.coachingInteractionId as string,
        adaptations: msg.metadata?.adaptations as string[],
        confidence: msg.metadata?.confidence as number,
        requestFeedback: msg.metadata?.requestFeedback as boolean,
      }))

      setMessages(loadedMessages)
      
      toast({
        title: "Session Resumed",
        description: `Continuing your conversation from ${conversationData.lastUpdated.toLocaleDateString()}`,
      })

      trackOnboardingEvent('conversation_resumed', { 
        userId: user?.id, 
        sessionId: resumeData.session.id,
        messageCount: loadedMessages.length,
        phase: currentPhase
      })
      
    } catch (error) {
      console.error('Failed to resume session:', error)
      await createNewSession()
    } finally {
      setIsResumingSession(false)
    }
  }

  const createNewSession = async () => {
    if (!user?.id) return

    try {
      const { session, conflicts, wasResumed } = await sessionManager.createSession({
        userId: user.id,
        initialPhase: 'motivation',
        coachingStyle: 'supportive',
        forceNew: false
      })

      setCurrentSession(session)
      setConversationId(session.conversationId)
      setSessionConflicts(conflicts)

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: getWelcomeMessage(currentPhase),
        timestamp: new Date(),
      }

      setMessages([welcomeMessage])

      // Save welcome message to storage
      await conversationStorage.saveMessage(
        session.conversationId,
        'assistant',
        welcomeMessage.content,
        { isWelcomeMessage: true },
        currentPhase,
        session.id
      )

      trackOnboardingEvent('conversation_started', { 
        userId: user.id, 
        sessionId: session.id,
        wasResumed,
        timestamp: new Date() 
      })

    } catch (error) {
      console.error('Failed to create new session:', error)
      await createFallbackSession()
    }
  }

  const createFallbackSession = async () => {
    // Create minimal fallback session without persistence
    const fallbackMessage: ChatMessage = {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content: 'Welcome! Let\'s start your onboarding. What motivates you to run?',
      timestamp: new Date(),
    }
    setMessages([fallbackMessage])
    setIsLoadingHistory(false) // Ensure loading state is cleared
    
    toast({
      title: "Limited Mode",
      description: "Running in limited mode. Your conversation may not be saved.",
      variant: "default"
    })
  }

  const getWelcomeMessage = (phase: OnboardingPhase): string => {
    const messages = {
      motivation: "Welcome to your AI-guided onboarding! Let's start by discovering your running motivations. What drives you to run, or what do you hope to achieve?",
      assessment: "Great! Now let's assess your current running situation. Tell me about your recent running experience.",
      creation: "Perfect! Based on what we've discussed, let's create some personalized goals for your running journey.",
      refinement: "Excellent! Now let's refine these goals to make sure they're perfectly suited to you.",
      complete: "Wonderful! Your onboarding is nearly complete. Let's finalize everything."
    }
    return messages[phase] || messages.motivation
  }

  const mapSessionPhaseToOnboardingPhase = (sessionPhase: OnboardingSession['goalDiscoveryPhase']): OnboardingPhase => {
    const phaseMap = {
      motivation: 'motivation' as OnboardingPhase,
      assessment: 'assessment' as OnboardingPhase,
      creation: 'creation' as OnboardingPhase,
      refinement: 'refinement' as OnboardingPhase,
      complete: 'complete' as OnboardingPhase
    }
    return phaseMap[sessionPhase] || 'motivation'
  }

  const showConflictResolutionToast = (conflictCount: number) => {
    toast({
      title: "Session Conflicts Detected",
      description: `Found ${conflictCount} session conflicts. They have been automatically resolved.`,
      variant: "default"
    })
  }

  const calculatePhaseProgress = (phase: OnboardingPhase): number => {
    const phaseProgress = {
      motivation: 20,
      assessment: 40,
      creation: 60,
      refinement: 80,
      complete: 100
    }
    return phaseProgress[phase] || 0
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    console.log('💬 Sending user message:', content.trim())
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    
    // Save user message to persistent storage
    if (conversationId && currentSession?.id) {
      try {
        await conversationStorage.saveMessage(
          conversationId,
          'user',
          userMessage.content,
          {
            timestamp: userMessage.timestamp.toISOString(),
            phase: currentPhase,
            sessionId: currentSession.id
          },
          currentPhase,
          currentSession.id
        )
      } catch (error) {
        console.warn('Failed to save user message to storage:', error)
      }
    }
    
    // Track user message
    trackOnboardingChatMessage({
      phase: currentPhase,
      messageLength: userMessage.content.length,
      messageType: 'user'
    })
    
    setMessagesInCurrentPhase(prev => prev + 1)
    
    try {
      const context = await buildUserContext()
      
      const requestBody = {
        messages: [
          ...messages.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: content.trim() }
        ],
        userId: user?.id?.toString(),
        userContext: context,
        currentPhase: currentPhase, // Pass current phase to API
      };

      // Check if online before attempting chat
      if (!isOnline) {
        throw new Error('Chat requires internet connection. Please check your connection and try again.')
      }

      // Use AI chat with fallback
      const response = await aiChatWithFallback(
        [
          ...messages.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: content.trim() }
        ],
        { userId: user?.id?.toString() ?? '', userContext: context, currentPhase }
      )

      // Handle fallback response
      if (response && typeof response === 'object' && 'fallback' in (response as any)) {
        const fallbackResponse = (response as unknown) as { fallback: boolean, message: string, redirectToForm: boolean }
        if (fallbackResponse.redirectToForm) {
          toast({
            title: "Switching to Guided Form",
            description: fallbackResponse.message,
            variant: "default"
          })
          onClose() // Close chat overlay to allow form-based onboarding
          return
        }
      }

      // Check if response is a proper Response object
      if (!response || !('ok' in response)) {
        throw new Error('Invalid response from AI service')
      }

      if (!response.ok) {
        let errorText = `API request failed with status ${response.status}`
        
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorText = errorData.error
          }
          if (errorData.fallback) {
            // Handle fallback response
            errorText = errorData.message || errorText
            
            // If this is a redirect to form, handle it gracefully
            if (errorData.redirectToForm) {
              toast({
                title: "Switching to Guided Form",
                description: errorText,
                variant: "default"
              })
              onClose() // Close chat overlay to allow form-based onboarding
              return
            }
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorText = response.statusText || errorText
        }
        
        throw new Error(errorText)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body reader is not available')
      }
      
      const decoder = new TextDecoder()
      let aiContent = ""

      const coachingInteractionId = response.headers.get('X-Coaching-Interaction-Id')
      const adaptations = response.headers.get('X-Coaching-Adaptations')?.split(', ').filter(Boolean)
      const confidenceHeader = response.headers.get('X-Coaching-Confidence') || '0'
      const parsedConfidence = parseFloat(confidenceHeader)
      const confidence = Number.isFinite(parsedConfidence) ? parsedConfidence : 0
      const nextPhase = response.headers.get('X-Onboarding-Next-Phase') as OnboardingPhase || currentPhase; // Get next phase from header

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "",
        timestamp: new Date(),
        coachingInteractionId: coachingInteractionId ?? '',
        adaptations: adaptations || [],
        confidence: isNaN(confidence) ? 0 : confidence,
        requestFeedback: confidence > 0 && confidence < 0.8,
      }

      setMessages(prev => [...prev, assistantMessage])

      // Add timeout for streaming
      const timeout = setTimeout(() => {
        reader.cancel()
        throw new Error('Streaming response timeout')
      }, 30000) // 30 second timeout

      try {
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (!line) continue
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
                console.warn('Failed to parse streaming chunk:', e)
              }
            } else {
              // Ignore control/error channels (2:, 3:) and any stray lines
            }
          }
        }
      } finally {
        clearTimeout(timeout)
      }
      
      // If no content was received, show an error
      if (!aiContent.trim()) {
        throw new Error('No response content received from AI service')
      }

      if (assistantMessage.requestFeedback) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, requestFeedback: true }
              : msg
          )
        )
      }

      // Save assistant message to persistent storage
      if (conversationId && currentSession?.id) {
        try {
          await conversationStorage.saveMessage(
            conversationId,
            'assistant',
            aiContent,
            {
              timestamp: assistantMessage.timestamp.toISOString(),
              phase: currentPhase,
              sessionId: currentSession.id,
              coachingInteractionId: assistantMessage.coachingInteractionId,
              adaptations: assistantMessage.adaptations,
              confidence: assistantMessage.confidence,
              requestFeedback: assistantMessage.requestFeedback,
              tokenCount: Math.ceil(aiContent.length / 4)
            },
            currentPhase,
            currentSession.id
          )
        } catch (error) {
          console.warn('Failed to save assistant message to storage:', error)
        }
      }
      
      // Track assistant message
      trackOnboardingChatMessage({
        phase: currentPhase,
        messageLength: aiContent.length,
        messageType: 'assistant',
        tokensUsed: aiContent.length / 4 // Rough token estimate
      })
      
      // Track phase transition if phase changed
      if (nextPhase !== currentPhase) {
        const phaseEndTime = new Date()
        trackConversationPhase({
          fromPhase: currentPhase,
          toPhase: nextPhase,
          timeSpentInPhaseMs: phaseEndTime.getTime() - phaseStartTime.getTime(),
          messagesInPhase: messagesInCurrentPhase,
          phaseCompletionRate: 1.0,
          userEngagementScore: Math.min(messagesInCurrentPhase / 3, 1.0)
        })
        
        // Update session with new phase
        if (currentSession?.id) {
          try {
            const updatedSession = await sessionManager.updateSession(currentSession.id, {
              goalDiscoveryPhase: nextPhase,
              sessionProgress: calculatePhaseProgress(nextPhase)
            })
            setCurrentSession(updatedSession)
          } catch (error) {
            console.warn('Failed to update session phase:', error)
          }
        }
        
        setPhaseStartTime(phaseEndTime)
        setMessagesInCurrentPhase(0)
      }
      
      setCurrentPhase(nextPhase); // Update current phase
      setMessagesInCurrentPhase(prev => prev + 1)
      
      // Check if onboarding is complete
      if (nextPhase === 'complete') {
        console.log('🎉 Onboarding chat completed, creating user and plan via OnboardingManager...')
        
        try {
          // Step 1: Extract user profile and goals from conversation
          const userProfile = extractUserProfileFromConversation(messages);
          const goals = extractGoalsFromConversation(messages);
          console.log('📋 Extracted user profile:', userProfile);
          console.log('📋 Extracted goals:', goals);
          
          // Step 2: Complete AI chat onboarding through OnboardingManager
          console.log('📋 Creating user via OnboardingManager...');
          const { onboardingManager } = await import('@/lib/onboardingManager');
          const onboardingResult = await onboardingManager.completeAIChatOnboarding(
            goals, 
            userProfile, 
            messages
          );
          
          if (!onboardingResult.success) {
            throw new Error(onboardingResult.errors?.join(', ') || 'Failed to complete AI onboarding');
          }
          
          console.log('✅ User and plan created successfully via OnboardingManager:', {
            userId: onboardingResult.user.id,
            planId: onboardingResult.planId
          });
          
          // Step 3: Track completion
          const { trackEngagementEvent } = await import('@/lib/analytics');
          trackEngagementEvent('onboard_complete', { 
            rookieChallenge: true, 
            age: userProfile.age || 0, 
            goalDist: userProfile.goal === 'distance' ? 5 : 0 
          });

          // Track AI guidance success
          trackAIGuidanceUsage({
            feature: 'plan_generation',
            success: true,
            confidenceScore: 0.9
          });
          
          console.log('🎉 AI chat onboarding completed successfully!');
          
          // Step 4: Call onComplete with extracted data
          setTimeout(() => {
            onComplete(goals, userProfile);
          }, 2000);
          
        } catch (error) {
          console.error('❌ Failed to complete AI onboarding:', error);
          
          // Track onboarding completion error
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          trackOnboardingError({
            errorType: 'plan_generation_failure',
            errorMessage,
            errorContext: { phase: 'complete', onboardingMethod: 'ai_chat' },
            recoveryAttempted: false,
            recoverySuccessful: false,
            userImpact: 'high',
            onboardingStep: 'completion',
            phase: 'complete'
          });

          // Track AI guidance failure
          trackAIGuidanceUsage({
            feature: 'plan_generation',
            success: false
          });
          
          toast({
            title: "Onboarding Failed",
            description: "Failed to complete onboarding. Please try again.",
            variant: "destructive"
          });
          
          // Add error message to chat
          const errorChatMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: "I'm sorry, there was an issue completing your onboarding. Please try again or contact support.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorChatMessage]);
        }
      }
      
      // Messages and session state are automatically saved to Dexie.js via conversationStorage and sessionManager
      
    } catch (error) {
      console.error('Onboarding chat error:', error)
      
      // More specific error handling
      let errorDescription = "Failed to get response from AI coach. Please try again."
      let errorContent = "I'm sorry, I'm having trouble responding right now. Please try again in a moment."
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
          errorDescription = "Network connection failed. Please check your internet and try again."
          errorContent = "It looks like there's a connection issue. Please check your internet connection and try again."
        } else if (error.message.includes('429')) {
          errorDescription = "Too many requests. Please wait a moment and try again."
          errorContent = "I'm receiving too many requests right now. Please wait a moment and try again."
        } else if (error.message.includes('503')) {
          errorDescription = "AI service is temporarily unavailable."
          errorContent = "The AI service is temporarily unavailable. Let's continue with the guided form setup instead. I'll close this chat and you can proceed with the standard onboarding."
        }
      }
      
      // Track the error
      const errorType = error instanceof Error && error.message.includes('Failed to fetch') ? 'network_failure' :
                        error instanceof Error && error.message.includes('429') ? 'api_timeout' :
                        error instanceof Error && error.message.includes('503') ? 'network_failure' : 'api_timeout'
      
      trackOnboardingError({
        errorType,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorContext: { 
          phase: currentPhase,
          messagesCount: messages.length,
          isStreaming: true
        },
        recoveryAttempted: false,
        recoverySuccessful: false,
        userImpact: 'medium',
        onboardingStep: 'chat_interaction',
        phase: currentPhase
      })

      toast({
        title: "Onboarding Error",
        description: errorDescription,
        variant: "destructive",
      })

      setMessages(prev => prev.slice(0, -1))
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
      
      // If it's a service unavailable error, suggest fallback after a delay
      if (error instanceof Error && error.message.includes('503')) {
        setTimeout(() => {
          onClose() // Close the chat overlay to let user continue with standard onboarding
        }, 3000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const buildUserContext = async (): Promise<string> => {
    // For onboarding, we don't need complex user context since user is new
    return "New user starting onboarding process"
  }

  // Helper function to extract user profile from conversation
  const extractUserProfileFromConversation = (messages: ChatMessage[]): any => {
    const profile = {
      goal: 'habit' as 'habit' | 'distance' | 'speed',
      experience: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
      preferredTimes: ['morning'] as string[],
      daysPerWeek: 3,
      age: 25,
      coachingStyle: 'supportive' as 'supportive' | 'challenging' | 'analytical' | 'encouraging'
    };
    
    // Extract information from conversation messages
    const conversationText = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase())
      .join(' ');
    
    // Extract goal
    if (conversationText.includes('distance') || conversationText.includes('marathon') || conversationText.includes('5k') || conversationText.includes('10k')) {
      profile.goal = 'distance';
    } else if (conversationText.includes('speed') || conversationText.includes('faster') || conversationText.includes('pace')) {
      profile.goal = 'speed';
    }
    
    // Extract experience
    if (conversationText.includes('beginner') || conversationText.includes('new') || conversationText.includes('start')) {
      profile.experience = 'beginner';
    } else if (conversationText.includes('intermediate') || conversationText.includes('regular')) {
      profile.experience = 'intermediate';
    } else if (conversationText.includes('advanced') || conversationText.includes('experienced')) {
      profile.experience = 'advanced';
    }
    
    // Extract preferred times
    if (conversationText.includes('morning')) {
      profile.preferredTimes = ['morning'];
    } else if (conversationText.includes('evening')) {
      profile.preferredTimes = ['evening'];
    } else if (conversationText.includes('afternoon')) {
      profile.preferredTimes = ['afternoon'];
    }
    
    // Extract days per week
    if (conversationText.includes('3 days') || conversationText.includes('three days')) {
      profile.daysPerWeek = 3;
    } else if (conversationText.includes('4 days') || conversationText.includes('four days')) {
      profile.daysPerWeek = 4;
    } else if (conversationText.includes('5 days') || conversationText.includes('five days')) {
      profile.daysPerWeek = 5;
    }
    
    // Extract coaching style
    if (conversationText.includes('supportive') || conversationText.includes('encouraging')) {
      profile.coachingStyle = 'supportive';
    } else if (conversationText.includes('challenging') || conversationText.includes('push')) {
      profile.coachingStyle = 'challenging';
    } else if (conversationText.includes('analytical') || conversationText.includes('data')) {
      profile.coachingStyle = 'analytical';
    }
    
    return profile;
  };

  // Helper function to extract goals from conversation
  const extractGoalsFromConversation = (messages: ChatMessage[]): any[] => {
    const goals: any[] = [];
    
    // Extract goals from conversation messages
    const conversationText = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase())
      .join(' ');
    
    // Create default goals based on extracted profile
    const profile = extractUserProfileFromConversation(messages);
    
    if (profile.goal === 'habit') {
      goals.push({
        id: 'habit-1',
        title: 'Build Consistent Running Habit',
        description: 'Establish a regular running routine',
        type: 'primary',
        category: 'consistency'
      });
    } else if (profile.goal === 'distance') {
      goals.push({
        id: 'distance-1',
        title: 'Increase Running Distance',
        description: 'Gradually build up to longer runs',
        type: 'primary',
        category: 'endurance'
      });
    } else if (profile.goal === 'speed') {
      goals.push({
        id: 'speed-1',
        title: 'Improve Running Speed',
        description: 'Work on pace and speed training',
        type: 'primary',
        category: 'speed'
      });
    }
    
    // Add health goal
    goals.push({
      id: 'health-1',
      title: 'Improve Overall Fitness',
      description: 'Enhance cardiovascular health and endurance',
      type: 'supporting',
      category: 'health'
    });
    
    return goals;
  };

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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full h-[90vh] sm:h-[80vh] p-0 sm:rounded-lg">
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
              <h1 className="font-semibold text-lg">AI Onboarding Coach</h1>
              <p className="text-sm text-muted-foreground">
                Let's set your personalized running goals
              </p>
            </div>
          </div>
          {/* No settings button for onboarding, as preferences are set during the process */}
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="bg-blue-500 h-full transition-all duration-500 ease-in-out" 
          style={{
            width: 
              currentPhase === 'motivation' ? '25%' :
              currentPhase === 'assessment' ? '50%' :
              currentPhase === 'creation' ? '75%' :
              currentPhase === 'refinement' ? '90%' :
              '100%'
          }}
        ></div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-32" role="status" aria-label="Loading conversation history">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  {isResumingSession ? 'Resuming your conversation...' : 'Loading conversation history...'}
                </span>
              </div>
            </div>
          ) : (
            <>
              {sessionConflicts.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      Session conflicts were detected and resolved automatically.
                    </span>
                  </div>
                </div>
              )}
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
            </>
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
            placeholder="Tell me more about your running goals..."
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
