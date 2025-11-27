import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { FindMyRouteModal } from './find-my-route-modal'

const mockTrackFindMyRouteClicked = vi.fn()
const mockTrackFindMyRouteSuccess = vi.fn()
const mockTrackFindMyRouteFailed = vi.fn()
const mockTrackRouteSelected = vi.fn()

vi.mock('@/lib/analytics', () => ({
  trackFindMyRouteClicked: (...args: unknown[]) => mockTrackFindMyRouteClicked(...args),
  trackFindMyRouteSuccess: (...args: unknown[]) => mockTrackFindMyRouteSuccess(...args),
  trackFindMyRouteFailed: (...args: unknown[]) => mockTrackFindMyRouteFailed(...args),
  trackRouteSelected: (...args: unknown[]) => mockTrackRouteSelected(...args),
}))

// Mock RouteMap to avoid MapLibre dependency in this test
vi.mock('@/components/maps/RouteMap', () => ({
  RouteMap: ({ onRouteClick }: { onRouteClick?: (route: any) => void }) => (
    <div data-testid="route-map" onClick={() => onRouteClick?.(null)}>Map</div>
  ),
}))

const mockGeolocation = {
  getCurrentPosition: vi.fn(),
} as any

describe('FindMyRouteModal', () => {
  const sampleRoutes = [
    {
      id: 1,
      name: 'Nearby Loop',
      distance: 3,
      difficulty: 'beginner' as const,
      safetyScore: 90,
      popularity: 80,
      elevationGain: 20,
      surfaceType: ['paved'],
      wellLit: true,
      lowTraffic: true,
      scenicScore: 80,
      estimatedTime: 20,
      description: 'A nice nearby loop',
      tags: ['custom'],
      startLat: 32,
      startLng: 34,
      routeType: 'predefined' as const,
      createdBy: 'system' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: 'Far Route',
      distance: 10,
      difficulty: 'advanced' as const,
      safetyScore: 70,
      popularity: 60,
      elevationGain: 200,
      surfaceType: ['trail'],
      wellLit: false,
      lowTraffic: true,
      scenicScore: 90,
      estimatedTime: 60,
      description: 'Farther away route',
      tags: ['custom'],
      startLat: 40,
      startLng: 10,
      routeType: 'predefined' as const,
      createdBy: 'system' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure secure context check passes
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', hostname: 'localhost' } as Location,
      writable: true,
    })
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
    })
  })

  it(
    'requests location on open, ranks routes, and fires selection analytics',
    async () => {
      const onRouteSelected = vi.fn()

      mockGeolocation.getCurrentPosition.mockImplementationOnce((success: any) => {
        success({
          coords: { latitude: 32.001, longitude: 34.001, accuracy: 5 },
        })
      })

    render(
      <FindMyRouteModal
        isOpen
        onClose={() => {}}
        onRouteSelected={onRouteSelected}
        userExperience="beginner"
        allRoutes={sampleRoutes as any}
      />
    )

    expect(mockTrackFindMyRouteClicked).toHaveBeenCalled()
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()

    await screen.findByText('Top Routes Near You')
    await waitFor(() => expect(mockTrackFindMyRouteSuccess).toHaveBeenCalled(), { timeout: 2000 })

      // Select the top route
      fireEvent.click(screen.getByText('Nearby Loop'))

      await waitFor(() => expect(onRouteSelected).toHaveBeenCalled())
      expect(mockTrackRouteSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          route_name: 'Nearby Loop',
          selection_method: 'find_my_route',
        })
      )
    },
    10000
  )
})
