import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OnboardingChatOverlay } from './onboarding-chat-overlay'
import { useToast } from '@/hooks/use-toast'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn()
}))

// Mock the analytics tracking
vi.mock('@/lib/analytics', () => ({
  trackOnboardingEvent: vi.fn()
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('OnboardingChatOverlay', () => {
  const mockToast = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useToast as any).mockReturnValue({ toast: mockToast })
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "Great! I can see you're motivated to start running. What specific goals do you have in mind?",
        nextPhase: 'assessment',
        goals: [],
        userProfile: {},
        coachingStyle: 'supportive'
      })
    })
  })

  it('renders when isOpen is true', () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
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
        totalSteps={8}
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
        totalSteps={8}
      />
    )

    expect(screen.getByText(/Welcome to your AI-guided onboarding/)).toBeInTheDocument()
  })

  it('allows user to send messages', async () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('I want to get healthier')).toBeInTheDocument()
    })
  })

  it('shows loading state while processing message', async () => {
    ;(global.fetch as any).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          response: "That's great! Let's explore your goals further.",
          nextPhase: 'assessment',
          goals: [],
          userProfile: {},
          coachingStyle: 'supportive'
        })
      }), 100))
    )

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    // Should show loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500
    })

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Onboarding Error",
        description: "Failed to get response from AI coach. Please try again.",
        variant: "destructive",
      })
    })
  })

  it('calls onComplete when conversation is finished', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "Perfect! I've created your personalized goals.",
        nextPhase: 'complete',
        goals: [{ type: 'habit', description: 'Build a running habit' }],
        userProfile: { goal: 'habit', coachingStyle: 'supportive' },
        coachingStyle: 'supportive'
      })
    })

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        [{ type: 'habit', description: 'Build a running habit' }],
        { goal: 'habit', coachingStyle: 'supportive' }
      )
    }, { timeout: 3000 })
  })

  it('updates progress based on conversation phase', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "Let's assess your experience level.",
        nextPhase: 'assessment',
        goals: [],
        userProfile: {},
        coachingStyle: 'supportive'
      })
    })

    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const input = screen.getByPlaceholderText('Tell me more about your running goals...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Assessing Your Experience')).toBeInTheDocument()
    })
  })

  it('allows closing the overlay', () => {
    render(
      <OnboardingChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        currentStep={2}
        totalSteps={8}
      />
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })
}) 