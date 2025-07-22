import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddRunModal } from '@/components/add-run-modal'
import { dbUtils } from '@/lib/db'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      title: 'Test Workout',
      description: 'Test workout description',
      duration: '30-45 min',
      phases: [
        {
          phase: 'Warm-up',
          color: 'bg-gray-500',
          steps: [
            {
              step: 1,
              description: 'Start with a 5-minute easy walk',
              detail: 'Focus on good posture',
              type: 'WALK'
            }
          ]
        }
      ]
    })
  })
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn()
}))

// Mock the database utilities
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test User',
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3,
      onboardingComplete: true
    }),
    ensureUserHasActivePlan: vi.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      title: 'Test Plan',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-04-01'), // 3 months from start
      totalWeeks: 12,
      isActive: true
    }),
    createWorkout: vi.fn().mockResolvedValue(123)
  }
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('Future Scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the modal', async () => {
    const mockDate = new Date('2024-01-15')
    vi.setSystemTime(mockDate)

    render(React.createElement(AddRunModal, { isOpen: true, onClose: vi.fn() }))

    // Click on a workout type to trigger the configure step
    const easyRunCard = screen.getByText('Easy Run')
    fireEvent.click(easyRunCard)

    await waitFor(() => {
      expect(dbUtils.getCurrentUser).toHaveBeenCalled()
    })

    vi.useRealTimers()
  })
}) 