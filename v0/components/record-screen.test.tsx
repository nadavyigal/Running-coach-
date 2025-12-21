import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { RecordScreen } from './record-screen'
import { dbUtils } from '@/lib/dbUtils'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

vi.mock('@/lib/dbUtils')
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

    ;(dbUtils.createRun as any).mockResolvedValue(1)
    ;(dbUtils.markWorkoutCompleted as any).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not start GPS watch on mount', async () => {
    render(<RecordScreen />)

    await waitFor(() => expect(mockPermissions.query).toHaveBeenCalled())
    expect(mockGeolocation.watchPosition).not.toHaveBeenCalled()
  })

  it('Enable GPS uses watchPosition and clears even when watch id is 0', async () => {
    mockPermissions.query.mockResolvedValue({ state: 'prompt' })
    mockGeolocation.watchPosition.mockImplementation((success: any) => {
      success(makePosition({ latitude: 40.7128, longitude: -74.006, accuracy: 5, timestamp: 1000 }))
      return 0
    })

    render(<RecordScreen />)

    fireEvent.click(await screen.findByRole('button', { name: 'Enable GPS' }))

    await waitFor(() => {
      expect(mockGeolocation.watchPosition).toHaveBeenCalled()
      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(0)
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'GPS Ready',
      })
    )
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
    vi.useFakeTimers()
    const start = new Date('2020-01-01T00:00:00.000Z')
    vi.setSystemTime(start)

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

    await act(async () => {
      vi.setSystemTime(new Date(start.getTime() + 2000))
      vi.advanceTimersByTime(2000)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    })

    await waitFor(() => {
      expect(dbUtils.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: 'easy',
          distance: expect.any(Number),
          duration: expect.any(Number),
          pace: expect.any(Number),
          calories: expect.any(Number),
        })
      )
    })

    expect(dbUtils.markWorkoutCompleted).toHaveBeenCalledWith(1)
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})

