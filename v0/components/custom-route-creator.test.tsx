import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CustomRouteCreator } from './custom-route-creator'

const mockAdd = vi.fn()
vi.mock('@/lib/db', () => ({
  db: { routes: { add: (...args: unknown[]) => mockAdd(...args) } },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/analytics', () => ({
  trackCustomRouteSaved: vi.fn(),
}))

vi.mock('@/components/maps/RouteMap', () => ({
  RouteMap: ({ onMapClick }: { onMapClick?: (lngLat: { lng: number; lat: number }) => void }) => (
    <div data-testid="route-map" onClick={() => onMapClick?.({ lng: 10, lat: 20 })}>
      Map
    </div>
  ),
}))

describe('CustomRouteCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'adds waypoints and saves a custom route',
    async () => {
      mockAdd.mockResolvedValueOnce(42)
      const onRouteSaved = vi.fn()

      render(
        <CustomRouteCreator
        isOpen
        onClose={() => {}}
        onRouteSaved={onRouteSaved as any}
      />
    )

    // Add two waypoints via map click
    const map = screen.getByTestId('route-map')
    fireEvent.click(map)
    fireEvent.click(map)

    // Fill name
    const nameInput = screen.getByPlaceholderText('My Morning Run')
    fireEvent.change(nameInput, { target: { value: 'Test Custom Route' } })

    // Save
    const saveButton = screen.getByRole('button', { name: /save route/i })
    fireEvent.click(saveButton)

    await waitFor(() => expect(mockAdd).toHaveBeenCalled())

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Custom Route',
          routeType: 'custom',
          gpsPath: expect.any(String),
        })
      )
      expect(onRouteSaved).toHaveBeenCalled()
    },
    10000
  )
})
