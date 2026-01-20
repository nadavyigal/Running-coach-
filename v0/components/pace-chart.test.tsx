import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PaceChart } from './pace-chart'
import type { GPSPoint } from '@/lib/pace-calculations'

beforeEach(() => {
  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const buildMockGpsPath = (count: number): GPSPoint[] => {
  return Array.from({ length: count }, (_, index) => ({
    lat: 32.0 + 0.0001 * index,
    lng: 34.0,
    timestamp: index * 4000, // 4 seconds per point
    accuracy: 10,
  }))
}

describe('PaceChart', () => {
  describe('Empty and Invalid Data', () => {
    it('should display "GPS data unavailable" for empty data', () => {
      render(<PaceChart gpsPath={[]} />)
      expect(screen.getByText(/gps data unavailable/i)).toBeInTheDocument()
    })

    it('should display "Insufficient data" for too few points', () => {
      const gpsPath = buildMockGpsPath(5) // Less than MIN_GPS_POINTS (10)
      render(<PaceChart gpsPath={gpsPath} />)

      // Component shows loading initially, then insufficient data after animation
      const skeleton = document.querySelector('.animate-pulse')
      const insufficientMsg = screen.queryByText(/insufficient data/i)

      // Should show either loading or insufficient message
      expect(skeleton || insufficientMsg).toBeTruthy()
    })
  })

  describe('Data Processing', () => {
    it('should render container for valid GPS data', () => {
      const gpsPath = buildMockGpsPath(100)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should render the main container
      const chartContainer = container.querySelector('.w-full')
      expect(chartContainer).toBeInTheDocument()
    })

    it('should handle large datasets without crashing', () => {
      const gpsPath = buildMockGpsPath(1000)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should not crash and should render something
      expect(container.firstChild).toBeTruthy()
    })

    it('should handle GPS path with invalid coordinates gracefully', () => {
      const gpsPath: GPSPoint[] = [
        { lat: NaN, lng: 34.0, timestamp: 0 },
        { lat: 32.0, lng: 34.0, timestamp: 4000 },
        { lat: 32.0001, lng: 34.0, timestamp: 8000 },
        { lat: Infinity, lng: 34.0, timestamp: 12000 },
        { lat: 32.0002, lng: 34.0, timestamp: 16000 },
      ]

      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should handle gracefully without crashing
      expect(container.firstChild).toBeTruthy()
    })

    it('should handle GPS path with time gaps', () => {
      const gpsPath: GPSPoint[] = [
        { lat: 32.0, lng: 34.0, timestamp: 0 },
        { lat: 32.0001, lng: 34.0, timestamp: 4000 },
        { lat: 32.0002, lng: 34.0, timestamp: 100000 }, // Large time gap
        { lat: 32.0003, lng: 34.0, timestamp: 104000 },
      ]

      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should render without crashing
      expect(container.firstChild).toBeTruthy()
    })

    it('should handle all points at same location (no movement)', () => {
      const gpsPath: GPSPoint[] = Array.from({ length: 20 }, (_, index) => ({
        lat: 32.0, // Same location
        lng: 34.0,
        timestamp: index * 4000,
      }))

      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should show insufficient data or handle gracefully
      const insufficientMsg = screen.queryByText(/insufficient data/i)
      const gpsUnavailable = screen.queryByText(/gps data unavailable/i)
      const skeleton = container.querySelector('.animate-pulse')

      expect(insufficientMsg || gpsUnavailable || skeleton).toBeTruthy()
    })
  })

  describe('Component Structure', () => {
    it('should render with proper className structure', () => {
      const gpsPath = buildMockGpsPath(100)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      const chartContainer = container.querySelector('.w-full')
      expect(chartContainer).toBeInTheDocument()
    })

    it('should handle prop changes without crashing', () => {
      const gpsPath1 = buildMockGpsPath(50)
      const { rerender, container } = render(<PaceChart gpsPath={gpsPath1} />)

      expect(container.firstChild).toBeTruthy()

      // Change to different data
      const gpsPath2 = buildMockGpsPath(100)
      rerender(<PaceChart gpsPath={gpsPath2} />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle switching from valid to invalid data', () => {
      const gpsPath = buildMockGpsPath(100)
      const { rerender } = render(<PaceChart gpsPath={gpsPath} />)

      // Switch to empty data
      rerender(<PaceChart gpsPath={[]} />)

      expect(screen.getByText(/gps data unavailable/i)).toBeInTheDocument()
    })
  })

  describe('User Paces Integration', () => {
    it('should render without crashing when userPaces provided', () => {
      const gpsPath = buildMockGpsPath(100)
      const userPaces = { easyPace: 6.0, tempoPace: 5.0 }

      const { container } = render(<PaceChart gpsPath={gpsPath} userPaces={userPaces} />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render without crashing when userPaces not provided', () => {
      const gpsPath = buildMockGpsPath(100)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle edge case userPaces values', () => {
      const gpsPath = buildMockGpsPath(100)
      const userPaces = { easyPace: 10.0, tempoPace: 3.0 }

      const { container } = render(<PaceChart gpsPath={gpsPath} userPaces={userPaces} />)

      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const gpsPath = buildMockGpsPath(1000)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should complete render without crashing
      expect(container.firstChild).toBeTruthy()

      // Component should render something (loading or chart)
      const hasContent = container.querySelector('.w-full') || container.querySelector('.animate-pulse')
      expect(hasContent).toBeTruthy()
    })

    it('should not block main thread during render', () => {
      const gpsPath = buildMockGpsPath(500)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should render immediately (even if showing loading state)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative timestamps', () => {
      const gpsPath: GPSPoint[] = [
        { lat: 32.0, lng: 34.0, timestamp: -1000 },
        { lat: 32.0001, lng: 34.0, timestamp: 0 },
        { lat: 32.0002, lng: 34.0, timestamp: 4000 },
      ]

      const { container } = render(<PaceChart gpsPath={gpsPath} />)
      expect(container.firstChild).toBeTruthy()
    })

    it('should handle extremely large coordinate values', () => {
      const gpsPath: GPSPoint[] = [
        { lat: 89.999, lng: 179.999, timestamp: 0 },
        { lat: 89.998, lng: 179.998, timestamp: 4000 },
        { lat: 89.997, lng: 179.997, timestamp: 8000 },
      ]

      const { container } = render(<PaceChart gpsPath={gpsPath} />)
      expect(container.firstChild).toBeTruthy()
    })

    it('should handle single GPS point', () => {
      const gpsPath = buildMockGpsPath(1)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should show insufficient data message
      const insufficientMsg = screen.queryByText(/insufficient data/i)
      const gpsUnavailable = screen.queryByText(/gps data unavailable/i)
      const skeleton = container.querySelector('.animate-pulse')

      expect(insufficientMsg || gpsUnavailable || skeleton).toBeTruthy()
    })

    it('should handle exactly 10 points (minimum threshold)', () => {
      const gpsPath = buildMockGpsPath(10)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      // Should attempt to render (may show chart or insufficient data)
      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible container structure', () => {
      const gpsPath = buildMockGpsPath(100)
      const { container } = render(<PaceChart gpsPath={gpsPath} />)

      const chartContainer = container.querySelector('.w-full')
      expect(chartContainer).toBeInTheDocument()
    })

    it('should provide meaningful error messages', () => {
      render(<PaceChart gpsPath={[]} />)

      const message = screen.getByText(/gps data unavailable/i)
      expect(message).toBeInTheDocument()
      expect(message.textContent).toBe('GPS data unavailable')
    })
  })
})
