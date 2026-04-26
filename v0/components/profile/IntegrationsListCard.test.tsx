import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Music } from 'lucide-react'
import { IntegrationsListCard } from './IntegrationsListCard'
import type { ComponentProps } from 'react'

function renderCard(overrides: Partial<ComponentProps<typeof IntegrationsListCard>> = {}) {
  const props: ComponentProps<typeof IntegrationsListCard> = {
    garminConnected: false,
    onGarminConnect: vi.fn(),
    onGarminSync: vi.fn(),
    onGarminDisconnect: vi.fn(),
    onGarminDetails: vi.fn(),
    rows: [
      {
        icon: Music,
        name: 'Spotify',
        description: 'Sync playlists for training sessions.',
        status: 'available',
        onClick: vi.fn(),
      },
    ],
    ...overrides,
  }

  render(<IntegrationsListCard {...props} />)
  return props
}

describe('IntegrationsListCard', () => {
  it('shows Garmin connect when Garmin is not connected', () => {
    const props = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(props.onGarminConnect).toHaveBeenCalledTimes(1)
  })

  it('keeps Garmin reconnect, sync, and disconnect visible when connected', () => {
    const props = renderCard({
      garminConnected: true,
      garminStatusLabel: 'Connected to Garmin Connect',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    expect(props.onGarminSync).toHaveBeenCalledTimes(1)
    expect(props.onGarminConnect).toHaveBeenCalledTimes(1)
    expect(props.onGarminDisconnect).toHaveBeenCalledTimes(1)
  })

  it('uses reconnect as the primary Garmin action when attention is required', () => {
    const props = renderCard({
      garminConnected: false,
      garminStatusTone: 'warning',
      garminStatusLabel: 'Reconnect Garmin to resume data sync',
    })

    expect(screen.getByText('Attention')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))

    expect(props.onGarminConnect).toHaveBeenCalledTimes(1)
  })
})
