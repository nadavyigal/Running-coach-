import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddRunModal } from './add-run-modal'
import { useToast } from '@/hooks/use-toast'

vi.mock('@/hooks/use-toast')

describe('AddRunModal', () => {
  it('shows success toast when workout scheduled', () => {
    const mockToast = vi.fn()
    ;(useToast as any).mockReturnValue({ toast: mockToast })

    render(<AddRunModal isOpen={true} onClose={() => {}} />)

    const button = screen.getByText('Schedule Workout')
    fireEvent.click(button)

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Workout Scheduled! 🎉' })
    )
  })
})
