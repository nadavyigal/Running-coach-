import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatScreen } from './chat-screen'
import { dbUtils } from '@/lib/dbUtils'

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

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('ChatScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default fetch mock
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('0:{"textDelta": "Hello! "}')
            })
            .mockResolvedValueOnce({
              done: false, 
              value: new TextEncoder().encode('0:{"textDelta": "How can I help?"}')
            })
            .mockResolvedValueOnce({
              done: true,
              value: undefined
            })
        })
      }
    })
  })

  it('renders chat interface correctly', () => {
    render(<ChatScreen />)
    
    expect(screen.getByText('AI Running Coach')).toBeInTheDocument()
    expect(screen.getByText('Your personal training assistant')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask your running coach anything...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays welcome message on load', async () => {
    render(<ChatScreen />)
    
    await waitFor(() => {
      expect(screen.getByText(/Hi there! I'm your AI running coach/)).toBeInTheDocument()
    })
  })

  it('shows suggested questions initially', async () => {
    render(<ChatScreen />)
    
    await waitFor(() => {
      expect(screen.getByText('Suggested questions:')).toBeInTheDocument()
      expect(screen.getByText('How should I prepare for my next run?')).toBeInTheDocument()
      expect(screen.getByText("What's a good pace for my level?")).toBeInTheDocument()
    })
  })

  it('sends message when form is submitted', async () => {
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    const submitButton = screen.getByRole('button')
    
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"Test message"')
      }))
    })
  })

  it('handles suggested question clicks', async () => {
    render(<ChatScreen />)
    
    await waitFor(() => {
      const suggestedQuestion = screen.getByText('How should I prepare for my next run?')
      fireEvent.click(suggestedQuestion)
    })
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('displays loading state during API call', async () => {
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    const submitButton = screen.getByRole('button')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Coach is thinking...')).toBeInTheDocument()
    })
  })

  it('includes user context in API calls', async () => {
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    const submitButton = screen.getByRole('button')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        body: expect.stringContaining('"userContext"')
      }))
    })
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))
    
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    const submitButton = screen.getByRole('button')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/I'm sorry, I'm having trouble responding/)).toBeInTheDocument()
    })
  })

  it('disables input during loading', async () => {
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    const submitButton = screen.getByRole('button')
    fireEvent.click(submitButton)
    
    expect(input).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('formats message timestamps correctly', async () => {
    render(<ChatScreen />)
    
    await waitFor(() => {
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/)
      expect(timeElements.length).toBeGreaterThan(0)
    })
  })

  it('builds user context from profile and runs', async () => {
    render(<ChatScreen />)
    
    const input = screen.getByPlaceholderText('Ask your running coach anything...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    const submitButton = screen.getByRole('button')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled()
      expect(dbUtils.getRunsByUser).toHaveBeenCalledWith(1)
    })
  })
}) 