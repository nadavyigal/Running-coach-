import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddRunModal } from './add-run-modal'
import { useToast } from '@/hooks/use-toast'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { dbUtils } from '@/lib/dbUtils'

vi.mock('@/hooks/use-toast')
vi.mock('ai')
vi.mock('@ai-sdk/openai')
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    ensureUserHasActivePlan: vi.fn(),
    createWorkout: vi.fn(),
    handleDatabaseError: vi.fn()
  }
}))

describe('AddRunModal', () => {
  it('shows success toast when workout scheduled', async () => {
    const mockToast = vi.fn()
    ;(useToast as any).mockReturnValue({ toast: mockToast })
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({
      id: 1,
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      onboardingComplete: true
    })
    ;(dbUtils.ensureUserHasActivePlan as any).mockResolvedValue({
      id: 1,
      userId: 1,
      title: 'Test Plan',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      totalWeeks: 2,
      isActive: true
    })
    ;(dbUtils.createWorkout as any).mockResolvedValue(1)
    ;(dbUtils.handleDatabaseError as any).mockReturnValue({ userMessage: 'Error' })

    // Mock generateText to return a valid workout plan
    ;(generateText as any).mockResolvedValue({
      text: JSON.stringify({
        title: "Easy Run Workout",
        description: "A simple easy run",
        duration: "30 min",
        phases: [
          {
            phase: "Warm-up",
            color: "bg-gray-500",
            steps: [{ step: 1, description: "5 min walk", type: "WARMUP" }],
          },
          {
            phase: "Main Workout",
            color: "bg-green-500",
            steps: [{ step: 2, description: "20 min easy run", type: "RUN" }],
          },
          {
            phase: "Cool Down",
            color: "bg-gray-500",
            steps: [{ step: 3, description: "5 min walk", type: "COOLDOWN" }],
          },
        ],
      }),
    })

    render(<AddRunModal open={true} onOpenChange={() => {}} />)

    // Simulate selecting a workout type
    fireEvent.click(screen.getByText('Easy Run'))

    // Simulate generating the workout plan
    await waitFor(() => {
      fireEvent.click(screen.getByText('Generate Workout Plan'))
    })

    // Now, click the Schedule Workout button
    await waitFor(() => {
      const scheduleButton = screen.getByText('Schedule Workout')
      fireEvent.click(scheduleButton)
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Workout Scheduled!') })
    )
  })
})
