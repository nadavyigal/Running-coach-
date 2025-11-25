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
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('0:{"textDelta": "Great! I can see you\'re motivated to start running. What specific goals do you have in mind?"}')
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
        'X-Onboarding-Next-Phase': 'assessment'
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
    const sendButton = screen.getByRole('button', { name: '' }) // Icon button without text

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
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('0:{"textDelta": "That\'s great! Let\'s explore your goals further."}')
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
          'X-Onboarding-Next-Phase': 'assessment'
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
    const sendButton = screen.getByRole('button', { name: '' })

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
    const sendButton = screen.getByRole('button', { name: '' })

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
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('0:{"textDelta": "Perfect! I\'ve created your personalized goals."}')
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
        'X-Onboarding-Next-Phase': 'complete'
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
    const sendButton = screen.getByRole('button', { name: '' })

    fireEvent.change(input, { target: { value: 'I want to get healthier' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('updates progress based on conversation phase', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('0:{"textDelta": "Let\'s assess your experience level."}')
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
        'X-Onboarding-Next-Phase': 'assessment'
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
        totalSteps={8}
      />
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })
}) 