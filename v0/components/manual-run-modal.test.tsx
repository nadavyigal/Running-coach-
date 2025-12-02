import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManualRunModal, analyzeRunPhoto, validateManualRunFile } from './manual-run-modal'
import { dbUtils } from '@/lib/dbUtils'
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
vi.mock('@/lib/planAdjustmentService')
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

describe('ManualRunModal AI helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns normalized AI response from analyzeRunPhoto', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { distanceKm: 8, durationSeconds: 2400, runType: 'tempo', notes: 'solid' } })
    })
    const file = new File(['image'], 'run.jpg', { type: 'image/jpeg' })

    const result = await analyzeRunPhoto(file, mockFetch as any)

    expect(mockFetch).toHaveBeenCalled()
    expect(result.distanceKm).toBe(8)
    expect(result.durationSeconds).toBe(2400)
    expect(result.runType).toBe('tempo')
    expect(result.notes).toBe('solid')
  })

  it('validates unsupported files before analysis', async () => {
    const badFile = new File(['text'], 'note.txt', { type: 'text/plain' })

    await expect(analyzeRunPhoto(badFile, vi.fn() as any)).rejects.toThrow(/Only JPG/)
  })
})

describe('ManualRunModal manual overrides', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({ id: 1 })
    ;(dbUtils.createRun as any).mockResolvedValue(1)
    ;(dbUtils.markWorkoutCompleted as any).mockResolvedValue(undefined)
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

    expect(dbUtils.createRun).toHaveBeenCalled()
    const saved = (dbUtils.createRun as any).mock.calls[0][0]
    expect(saved.distance).toBe(7.5)
    expect(saved.duration).toBe(2400)
    expect(saved.notes).toBe('User override')
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
