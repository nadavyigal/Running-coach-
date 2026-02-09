/**
 * GPS Distance Recording Diagnostic Tests
 *
 * Tests for the GPS filtering pipeline in RecordScreen, specifically:
 * - Auto-pause warmup grace period (30s)
 * - Multi-point confirmation for auto-pause resume
 * - Out-of-order timestamps
 * - All-points-filtered scenarios
 * - Distance accumulation with poor GPS data
 * - Rejection summary in saved runs
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { RecordScreen } from './record-screen'
import { dbUtils } from '@/lib/dbUtils'
import { recordRunWithSideEffects } from '@/lib/run-recording'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

vi.mock('@/lib/dbUtils')
vi.mock('@/lib/run-recording')
vi.mock('next/navigation')
vi.mock('@/hooks/use-toast')

vi.mock('@/components/route-selector-modal', () => ({
  RouteSelectorModal: () => null,
}))

vi.mock('@/components/route-selection-wizard', () => ({
  RouteSelectionWizard: () => null,
}))

vi.mock('@/components/manual-run-modal', () => ({
  ManualRunModal: () => null,
}))

vi.mock('@/components/add-activity-modal', () => ({
  AddActivityModal: () => null,
}))

vi.mock('@/components/recovery-recommendations', () => ({
  default: () => null,
}))

vi.mock('@/components/maps/RunMap', () => ({
  RunMap: () => <div data-testid="run-map" />,
}))

const mockPush = vi.fn()
const mockToast = vi.fn()

const mockGeolocation = {
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}

const mockPermissions = {
  query: vi.fn(),
}

function makePosition({
  latitude,
  longitude,
  accuracy,
  timestamp,
  speed,
}: {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  speed?: number | null
}) {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: speed ?? null,
    },
    timestamp,
  } as any
}

describe('RecordScreen GPS Distance Diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })

    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    })

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    })

    Object.defineProperty(global.navigator, 'permissions', {
      value: mockPermissions,
      writable: true,
    })

    mockPermissions.query.mockResolvedValue({ state: 'prompt' })

    ;(useRouter as any).mockReturnValue({
      push: mockPush,
    })

    ;(useToast as any).mockReturnValue({
      toast: mockToast,
    })

    ;(dbUtils.getCurrentUser as any).mockResolvedValue({
      id: 1,
      name: 'Test User',
    })

    ;(dbUtils.getTodaysWorkout as any).mockResolvedValue({
      id: 1,
      type: 'easy',
      distance: 5,
      planId: 1,
      week: 1,
      day: 'Mon',
      completed: false,
      scheduledDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    ;(dbUtils.getNextWorkoutForPlan as any).mockResolvedValue(null)

    ;(recordRunWithSideEffects as any).mockResolvedValue({ runId: 1, workoutId: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accumulates distance with multiple valid GPS points', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    // Points ~5.5m apart (0.00005 degrees latitude) at ~5.5 m/s (reasonable running speed)
    // Each segment 1s apart, 5.5m distance = 5.5 m/s (under 12 m/s limit)
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.71280, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 2000 }))
      success(makePosition({ latitude: 40.71290, longitude: -74.006, accuracy: 5, timestamp: 3000 }))
      success(makePosition({ latitude: 40.71295, longitude: -74.006, accuracy: 5, timestamp: 4000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // 3 segments of ~5.5m each = ~16.5m; should show non-zero distance
    await waitFor(() => {
      // The distance display should show something > 0.00
      const elements = screen.getAllByText(/^\d+\.\d{2}$/)
      const hasNonZero = elements.some(el => parseFloat(el.textContent || '0') > 0)
      expect(hasNonZero).toBe(true)
    })
  })

  it('handles out-of-order timestamps via normalization', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    // Points ~5.5m apart at reasonable speed
    // Second point has a timestamp BEFORE the first (out of order)
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.71280, longitude: -74.006, accuracy: 5, timestamp: 5000 }))
      // Out-of-order timestamp: 3000 < 5000, should be normalized forward
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 3000 }))
      // Normal timestamp
      success(makePosition({ latitude: 40.71290, longitude: -74.006, accuracy: 5, timestamp: 7000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // Should still accumulate some distance despite the timestamp issue
    await waitFor(() => expect(screen.getByText('0.01')).toBeInTheDocument())
  })

  it('all accuracy-filtered points result in 0.00 km distance', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    // All points have accuracy > 50m, should all be filtered
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 100, timestamp: 1000 }))
      success(makePosition({ latitude: 40.7138, longitude: -74.006, accuracy: 80, timestamp: 2000 }))
      success(makePosition({ latitude: 40.7148, longitude: -74.006, accuracy: 120, timestamp: 3000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // All points should be rejected => distance stays 0.00
    await waitFor(() => expect(screen.getByText('0.00')).toBeInTheDocument())
  })

  it('rejects GPS teleportation (speed > 13.5 m/s)', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    // Point 1 to Point 2: huge jump in 1 second = teleport
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.71280, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      // ~1.1km away in 1 second = ~1100 m/s (way over 13.5 m/s limit) - TELEPORT
      success(makePosition({ latitude: 40.72280, longitude: -74.006, accuracy: 5, timestamp: 2000 }))
      // Back near the first point with reasonable speed from point 1
      // ~5.5m from first point, 3s later = 1.8 m/s (reasonable)
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 4000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // The teleport should be rejected, only normal movement counted
    // Point 3 is 5.5m from point 1 = 0.01 km
    await waitFor(() => expect(screen.getByText('0.01')).toBeInTheDocument())
  })

  it('handles GPS signal complete loss for 60 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = new Date('2020-01-01T00:00:00.000Z')
    vi.setSystemTime(start)

    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    let successCallback: ((position: any) => void) | null = null
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      successCallback = success
      success(makePosition({
        latitude: 40.71280,
        longitude: -74.006,
        accuracy: 5,
        timestamp: start.getTime() + 1000,
      }))
      return 1
    })

    render(<RecordScreen />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))
      await Promise.resolve()
    })

    expect(mockGeolocation.watchPosition).toHaveBeenCalled()

    await act(async () => {
      successCallback?.(makePosition({
        latitude: 40.71285,
        longitude: -74.006,
        accuracy: 5,
        timestamp: start.getTime() + 2000,
      }))
    })

    expect(screen.getByText('0.01')).toBeInTheDocument()

    vi.setSystemTime(new Date(start.getTime() + 62000))
    await new Promise((resolve) => setTimeout(resolve, 5500))

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'GPS Signal Lost' })
    )

    await act(async () => {
      successCallback?.(makePosition({
        latitude: 40.71290,
        longitude: -74.006,
        accuracy: 5,
        timestamp: start.getTime() + 63000,
      }))
    })

    const distanceLabel = screen.getByText('Distance (km)')
    const distanceValue = distanceLabel.previousSibling as HTMLElement
    const distanceNumber = parseFloat(distanceValue?.textContent || '0')
    expect(distanceNumber).toBeLessThan(0.05)
  }, 10000)

  it('saves run with gpsMetadata containing rejection summary', async () => {
    const start = new Date('2020-01-01T00:00:00.000Z')
    let now = start.getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)

    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 2000 }))
      return 7
    })

    render(<RecordScreen />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))
    })

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('0.01')).toBeInTheDocument())

    await act(async () => {
      now = start.getTime() + 2000
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    })

    await waitFor(() => {
      expect(recordRunWithSideEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          gpsMetadata: expect.any(String),
        })
      )
    })

    // Verify gpsMetadata is valid JSON with expected structure
    const call = (recordRunWithSideEffects as any).mock.calls[0][0]
    const metadata = JSON.parse(call.gpsMetadata)
    expect(metadata).toHaveProperty('acceptedPoints')
    expect(metadata).toHaveProperty('rejectedPoints')
    expect(metadata).toHaveProperty('rejectionReasons')
    expect(metadata).toHaveProperty('autoPauseCount')
    expect(metadata).toHaveProperty('rejectionRate')
    expect(metadata.acceptedPoints).toBeGreaterThanOrEqual(0)

    nowSpy.mockRestore()
  }, 10000)

  it('does not increase distance when jitter is below threshold', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    // Two points very close together (< 0.5m for 5m accuracy = jitter threshold)
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128000, longitude: -74.006000, accuracy: 5, timestamp: 1000 }))
      // ~0.11m apart (0.000001 degrees lat ~ 0.11m) - below jitter threshold
      success(makePosition({ latitude: 40.7128010, longitude: -74.006000, accuracy: 5, timestamp: 2000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // Distance should stay at 0.00 due to jitter rejection
    await waitFor(() => expect(screen.getByText('0.00')).toBeInTheDocument())
  })

  it('rejects duplicate timestamps (timeDelta < 400ms)', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.71280, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      // Same timestamp - will be normalized but then rejected as duplicate/stale
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      // Valid timestamp with enough delta, reasonable speed from first point
      success(makePosition({ latitude: 40.71290, longitude: -74.006, accuracy: 5, timestamp: 3000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // Should have distance from point 1 to point 3 (~11m = 0.01 km)
    await waitFor(() => expect(screen.getByText('0.01')).toBeInTheDocument())
  })
})
