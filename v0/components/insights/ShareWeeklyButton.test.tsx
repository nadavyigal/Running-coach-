import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ShareWeeklyButton } from './ShareWeeklyButton'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { useToast } from '@/hooks/use-toast'

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

describe('ShareWeeklyButton', () => {
  const toastSpy = vi.fn()
  const shareSpy = vi.fn()
  const clipboardSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useToast as unknown as vi.Mock).mockReturnValue({ toast: toastSpy })

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: clipboardSpy,
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      configurable: true,
      writable: true,
    })
  })

  it('uses the Web Share API when available', async () => {
    render(<ShareWeeklyButton week="2026-W12" userId={42} />)

    fireEvent.click(screen.getByTestId('share-weekly-button'))

    await waitFor(() => {
      expect(trackAnalyticsEvent).toHaveBeenCalledWith('weekly_share_clicked', {
        week: '2026-W12',
        has_user_id: true,
      })
      expect(shareSpy).toHaveBeenCalledWith({
        title: 'My RunSmart weekly recap',
        text: 'See how my training week went in RunSmart.',
        url: 'http://localhost:3000/weekly/2026-W12?userId=42',
      })
    })
  })

  it('falls back to copying the link when Web Share API is unavailable', async () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    render(<ShareWeeklyButton week="2026-W12" userId={42} />)

    fireEvent.click(screen.getByTestId('share-weekly-button'))

    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledWith('http://localhost:3000/weekly/2026-W12?userId=42')
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Weekly link copied',
        description: 'Share your weekly recap anywhere.',
      })
    })
  })

  it('tracks the share click even without a user id', async () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    render(<ShareWeeklyButton week="2026-W12" />)

    fireEvent.click(screen.getByTestId('share-weekly-button'))

    await waitFor(() => {
      expect(trackAnalyticsEvent).toHaveBeenCalledWith('weekly_share_clicked', {
        week: '2026-W12',
        has_user_id: false,
      })
      expect(clipboardSpy).toHaveBeenCalledWith('http://localhost:3000/weekly/2026-W12')
    })
  })
})
