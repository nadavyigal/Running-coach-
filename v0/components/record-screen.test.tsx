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
}: {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}) {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
  } as any
}

describe('RecordScreen GPS lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

    ;(recordRunWithSideEffects as any).mockResolvedValue({ runId: 1, workoutId: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not start GPS watch on mount', async () => {
    render(<RecordScreen />)

    await waitFor(() => expect(mockPermissions.query).toHaveBeenCalled())
    expect(mockGeolocation.watchPosition).not.toHaveBeenCalled()
  })

  it('Start Run clears watchPosition even when watch id is 0', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      return 0
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }))

    await waitFor(() => expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(0))
  })

  it('Start Run starts watchPosition and accumulates distance from points', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      success(makePosition({ latitude: 40.71285, longitude: -74.006, accuracy: 5, timestamp: 2000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // 0.00005 degrees lat ~ 5.5m => ~0.01km after rounding.
    await waitFor(() => expect(screen.getByText('0.01')).toBeInTheDocument())
  })

  it('filters points with very low accuracy (distance does not increase)', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 250, timestamp: 1000 }))
      success(makePosition({ latitude: 40.7138, longitude: -74.006, accuracy: 250, timestamp: 2000 }))
      return 1
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalled())

    // Distance display should remain at 0.00 km when points are discarded by accuracy filter.
    await waitFor(() => expect(screen.getByText('0.00')).toBeInTheDocument())
  })

  it('pauses clears watch and resume starts a new watch', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'granted' })

    let nextWatchId = 0
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      nextWatchId += 1
      success(
        makePosition({
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          timestamp: 1000 + nextWatchId * 1000,
        })
      )
      return nextWatchId
    })

    render(<RecordScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))
    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(1))

    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(1))

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(mockGeolocation.watchPosition).toHaveBeenCalledTimes(2))
  })

  it('saves a run on Stop when duration and distance are > 0', async () => {
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
          distanceKm: expect.any(Number),
          durationSeconds: expect.any(Number),
          completedAt: expect.any(Date),
        })
      )
    })
    nowSpy.mockRestore()
  }, 10000)
})

