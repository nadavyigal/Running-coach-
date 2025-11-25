import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddRunModal } from './add-run-modal'
import { useToast } from '@/hooks/use-toast'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

vi.mock('@/hooks/use-toast')
vi.mock('ai')
vi.mock('@ai-sdk/openai')

describe('AddRunModal', () => {
  it('shows success toast when workout scheduled', async () => {
    const mockToast = vi.fn()
    ;(useToast as any).mockReturnValue({ toast: mockToast })

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

    render(<AddRunModal isOpen={true} onClose={() => {}} />)

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
      expect.objectContaining({ title: 'Workout Scheduled! 🎉' })
    )
  })
})
