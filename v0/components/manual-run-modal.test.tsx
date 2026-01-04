import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManualRunModal } from './manual-run-modal'
import { dbUtils } from '@/lib/dbUtils'
import { recordRunWithSideEffects } from '@/lib/run-recording'
import { planAdjustmentService } from '@/lib/planAdjustmentService'

vi.mock('@/lib/db', () => ({
  resetDatabaseInstance: vi.fn(),
  db: {}
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>
}))
vi.mock('@/lib/dbUtils')
vi.mock('@/lib/run-recording')
vi.mock('@/lib/planAdjustmentService')
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))
vi.mock('@/lib/ai-activity-client')

describe('ManualRunModal manual overrides', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({ id: 1 })
    ;(recordRunWithSideEffects as any).mockResolvedValue({ runId: 1 })
    ;(planAdjustmentService.afterRun as any).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves with user edits after AI-prefilled values', async () => {
    render(<ManualRunModal isOpen onClose={onClose} onSaved={onSaved} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '5' } })
      fireEvent.change(screen.getByLabelText('Duration (MM:SS or HH:MM:SS)'), { target: { value: '30:00' } })
      fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'AI prefill' } })
    })

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '7.5' } })
      fireEvent.change(screen.getByLabelText('Duration (MM:SS or HH:MM:SS)'), { target: { value: '40:00' } })
      fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'User override' } })
      fireEvent.click(screen.getByRole('button', { name: /save run/i }))
    })

    expect(recordRunWithSideEffects).toHaveBeenCalled()
    const saved = (recordRunWithSideEffects as any).mock.calls[0][0]
    expect(saved.distanceKm).toBe(7.5)
    expect(saved.durationSeconds).toBe(2400)
    expect(saved.notes).toBe('User override')
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
