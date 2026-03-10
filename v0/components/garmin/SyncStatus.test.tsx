import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

import { SyncStatus } from '@/components/garmin/SyncStatus'

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('SyncStatus', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([
    ['connected', 'Connected'],
    ['syncing', 'Syncing…'],
    ['waiting_for_first_activity', 'Waiting for first Garmin activity'],
    ['delayed', 'Delayed, Garmin may be experiencing sync lag'],
    ['reauth_required', 'Reconnect Garmin'],
  ])('renders the %s trust state', async (syncState, expectedText) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            connected: syncState !== 'reauth_required',
            connectionStatus: syncState === 'reauth_required' ? 'reauth_required' : 'connected',
            syncState,
            lastSyncAt: '2026-03-01T07:00:00.000Z',
            errorState: syncState === 'reauth_required' ? { message: 'Reconnect Garmin' } : null,
            freshnessLabel: 'fresh',
            confidenceLabel: 'high',
          }),
          { status: 200 }
        )
      )
    )

    render(<SyncStatus userId={42} />)

    await waitFor(() => {
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    })
  })
})
