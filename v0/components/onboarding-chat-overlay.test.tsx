import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OnboardingChatOverlay } from './onboarding-chat-overlay'
import { useToast } from '@/hooks/use-toast'

const { mockAiChatWithFallback } = vi.hoisted(() => ({
  mockAiChatWithFallback: vi.fn()
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn()
}))

vi.mock('@/hooks/use-ai-service-error-handling', () => ({
  useAIServiceErrorHandling: () => ({
    aiChatWithFallback: mockAiChatWithFallback
  })
}))

// Mock the analytics tracking
vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
  trackEngagementEvent: vi.fn(),
}))

vi.mock('@/lib/sessionManager', () => ({
  sessionManager: {
    resumeSession: vi.fn().mockResolvedValue(null),
    createSession: vi.fn().mockResolvedValue({
      session: {
        id: 1,
        userId: 1,
        conversationId: 'conv-123',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'supportive',
        sessionProgress: 0,
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      conflicts: [],
      wasResumed: false
    }),
    updateSession: vi.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      conversationId: 'conv-123',
      goalDiscoveryPhase: 'motivation',
      discoveredGoals: [],
      coachingStyle: 'supportive',
      sessionProgress: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
}))

vi.mock('@/lib/conversationStorage', () => ({
  conversationStorage: {
    saveMessage: vi.fn().mockResolvedValue({
      id: 1,
      conversationId: 'conv-123',
      role: 'assistant',
      content: 'Saved message',
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    loadConversation: vi.fn().mockResolvedValue({
      messages: [],
      session: null,
      totalMessages: 0,
      lastUpdated: new Date(),
      dataIntegrity: {
        isValid: true,
        errors: [],
        warnings: []
      }
    })
  }
}))

vi.mock('@/lib/onboardingManager', () => ({
  onboardingManager: {
    completeAIChatOnboarding: vi.fn().mockResolvedValue({
      success: true,
      user: { id: 1 },
      planId: 1
    })
  }
}))

// Mock the database utilities
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test User',
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3
    }),
    getRunsByUser: vi.fn().mockResolvedValue([
      { id: 1, distance: 5, duration: 1800, completedAt: new Date() },
      { id: 2, distance: 3, duration: 1200, completedAt: new Date() },
      { id: 3, distance: 7, duration: 2400, completedAt: new Date() }
    ])
  }
}))

const createStreamingResponse = (text: string, nextPhase: string) => ({
  ok: true,
  body: {
    getReader: () => ({
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`0:${JSON.stringify({ textDelta: text })}`)
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined
        })
    })
  },
  headers: new Headers({
    'X-Coaching-Interaction-Id': 'onboarding-123',
    'X-Coaching-Confidence': '0.8',
    'X-Onboarding-Next-Phase': nextPhase
  })
})

const waitForHistoryLoad = async () => {
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading conversation history')).not.toBeInTheDocument()
  })
}

describe('OnboardingChatOverlay', () => {
  const mockToast = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useToast as any).mockReturnValue({ toast: mockToast })
    mockAiChatWithFallback.mockResolvedValue(
      createStreamingResponse(
        "Great! I can see you're motivated to start running. What specific goals do you have in mind?",
        'assessment'
      )
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders when isOpen is true', () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    expect(screen.getByText('AI Onboarding Coach')).toBeInTheDocument()
    expect(screen.getByText("Let's set your personalized running goals")).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(
      <OnboardingChatOverlay
        isOpen={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    expect(screen.queryByText('AI Onboarding Coach')).not.toBeInTheDocument()
  })

  it('shows welcome message when opened', () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    return waitForHistoryLoad().then(() => {
      expect(screen.getByText(/Welcome to your AI-guided onboarding/)).toBeInTheDocument()
    })
  })

  it('allows user to send messages', async () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    await waitForHistoryLoad()
    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: '' }) // Icon button without text

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('I want to get healthier')).toBeInTheDocument()
    })
  })

  it('shows loading state while processing message', async () => {
    mockAiChatWithFallback.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => {
        resolve(
          createStreamingResponse(
            "That's great! Let's explore your goals further.",
            'assessment'
          )
        )
      }, 100))
    )

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    await waitForHistoryLoad()
    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: '' })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    // Should show loading spinner
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    mockAiChatWithFallback.mockResolvedValue({
      fallback: true,
      message: "AI chat is not available right now. Let's continue with the guided form instead.",
      redirectToForm: true
    })

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    await waitForHistoryLoad()
    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: '' })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Switching to Guided Form",
        description: "AI chat is not available right now. Let's continue with the guided form instead.",
        variant: "default",
      })
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('calls onComplete when conversation is finished', async () => {
    mockAiChatWithFallback.mockResolvedValue(
      createStreamingResponse(
        "Perfect! I've created your personalized goals.",
        'complete'
      )
    )

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    await waitForHistoryLoad()
    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: '' })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('updates progress based on conversation phase', async () => {
    mockAiChatWithFallback.mockResolvedValue(
      createStreamingResponse(
        "Let's assess your experience level.",
        'assessment'
      )
    )

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    await waitForHistoryLoad()
    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: '' })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText("Let's assess your experience level.")).toBeInTheDocument()
    })
  })

  it('allows closing the overlay', () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={6}
      />
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })
}) 
