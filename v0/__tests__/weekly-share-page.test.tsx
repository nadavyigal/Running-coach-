import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ShareWeeklyPage from '@/app/(share)/weekly/[week]/page'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { useToast } from '@/hooks/use-toast'

const useSearchParamsMock = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: any) => {
    const resolvedHref =
      typeof href === 'string' ? href : typeof href?.pathname === 'string' ? href.pathname : ''
    return (
      <a
        href={resolvedHref}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
        {...props}
      >
        {children}
      </a>
    )
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

describe('weekly share page', () => {
  const toastSpy = vi.fn()
  const clipboardSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useSearchParamsMock.mockReturnValue(new URLSearchParams('userId=42'))
    ;(useToast as unknown as vi.Mock).mockReturnValue({ toast: toastSpy })

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: clipboardSpy,
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    window.history.replaceState({}, '', 'http://localhost:3000/weekly/2026-W12?userId=42')
    ;(global.fetch as unknown as vi.Mock).mockImplementation((url: string | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('/api/garmin/reports/weekly?userId=42')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              found: true,
              report: {
                contentMd: '## Load\n- Stable volume and strong consistency.',
                confidence: 'high',
                periodStart: '2026-03-09',
                periodEnd: '2026-03-15',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
  })

  it('renders the shared weekly report and acquisition CTA', async () => {
    render(<ShareWeeklyPage params={{ week: '2026-W12' }} />)

    expect(screen.getByTestId('weekly-share-signup-cta')).toHaveAttribute('href', '/')
    expect(await screen.findByText(/stable volume and strong consistency/i)).toBeInTheDocument()
  })

  it('tracks signup CTA clicks from the public share page', async () => {
    render(<ShareWeeklyPage params={{ week: '2026-W12' }} />)

    fireEvent.click(screen.getByTestId('weekly-share-signup-cta'))

    await waitFor(() => {
      expect(trackAnalyticsEvent).toHaveBeenCalledWith('weekly_share_signup_clicked', {
        week: '2026-W12',
        has_report: false,
        shared_user_id_present: true,
      })
    })
  })

  it('copies the public share link when secondary share is clicked', async () => {
    render(<ShareWeeklyPage params={{ week: '2026-W12' }} />)

    await screen.findByText(/stable volume and strong consistency/i)
    fireEvent.click(screen.getByTestId('weekly-share-copy-link'))

    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledWith('http://localhost:3000/weekly/2026-W12?userId=42')
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'This weekly recap is ready to share.',
      })
    })
  })
})
