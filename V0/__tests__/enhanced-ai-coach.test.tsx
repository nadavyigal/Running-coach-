import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnhancedAICoach } from '../components/enhanced-ai-coach'
import { dbUtils } from '../lib/db'
import { generateContextAwareResponse } from '../lib/enhanced-ai-coach'

vi.mock('../lib/db', () => ({
  dbUtils: {
    getRunsByUser: vi.fn().mockResolvedValue([
      { id: 1, distance: 5, duration: 1500 },
      { id: 2, distance: 4, duration: 1400 }
    ])
  }
}))

vi.mock('../lib/enhanced-ai-coach', async () => {
  const actual = await vi.importActual('../lib/enhanced-ai-coach')
  return {
    ...actual,
    generateContextAwareResponse: vi.fn().mockResolvedValue({
      response: 'Hi Test, your last run was 4km.',
      suggestedQuestions: [],
      followUpActions: [],
      confidence: 1,
      contextUsed: ['recentRuns']
    })
  }
})

const mockUser = { id: 1, name: 'Test', coachingStyle: 'encouraging' } as any

describe('EnhancedAICoach', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends context aware message', async () => {
    const onResponse = vi.fn()
    render(<EnhancedAICoach user={mockUser} onResponse={onResponse} />)

    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByTestId('send'))

    await waitFor(() => {
      expect(generateContextAwareResponse).toHaveBeenCalled()
      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({ response: expect.stringContaining('last run') })
      )
      expect(screen.getByTestId('response')).toBeInTheDocument()
    })
  })

  it('handles service errors', async () => {
    ;(generateContextAwareResponse as any).mockRejectedValueOnce(new Error('fail'))
    const onResponse = vi.fn()
    render(<EnhancedAICoach user={mockUser} onResponse={onResponse} />)

    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByTestId('send'))

    await waitFor(() => {
      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({ response: 'Unable to generate response.' })
      )
      expect(screen.getByText('Unable to generate response.')).toBeInTheDocument()
    })
  })
})
