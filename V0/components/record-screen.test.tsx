import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { RecordScreen } from './record-screen'
import { dbUtils } from '@/lib/db'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// Mock dependencies
vi.mock('@/lib/db')
vi.mock('next/navigation')
vi.mock('@/hooks/use-toast')
vi.mock('@/components/route-selector-modal', () => ({
  RouteSelectorModal: ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => 
    isOpen ? <div data-testid="route-selector-modal">Route Selector Modal</div> : null
}))
vi.mock('@/components/manual-run-modal', () => ({
  ManualRunModal: ({ isOpen, onClose, onSaved }: { isOpen: boolean, onClose: () => void, onSaved?: () => void }) => 
    isOpen ? (
      <div data-testid="manual-run-modal">
        Manual Run Modal
        <button onClick={() => { onSaved?.(); onClose(); }}>Save Run</button>
      </div>
    ) : null
}))

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

const mockPermissions = {
  query: vi.fn(),
}

Object.defineProperty(global.navigator, 'permissions', {
  value: mockPermissions,
  writable: true,
})

const mockPush = vi.fn()
const mockToast = vi.fn()

describe('RecordScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Restore geolocation mock
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    })
    
    // Reset permissions mock to default 'prompt' state
    mockPermissions.query.mockResolvedValue({ state: 'prompt' })
    
    // Mock router
    ;(useRouter as any).mockReturnValue({
      push: mockPush,
    })
    
    // Mock toast
    ;(useToast as any).mockReturnValue({
      toast: mockToast,
    })
    
    // Mock database methods
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({
      id: 1,
      name: 'Test User'
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
      updatedAt: new Date()
    })
    ;(dbUtils.createRun as any).mockResolvedValue(1)
    ;(dbUtils.markWorkoutCompleted as any).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Load and GPS Setup', () => {
    it('should render record screen with GPS prompt', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' })
      
      await act(async () => {
        render(<RecordScreen />)
      })

      expect(screen.getByText('Record Run')).toBeInTheDocument()
      expect(screen.getByText('Enable GPS Tracking')).toBeInTheDocument()
      expect(screen.getByText('Allow location access for accurate run tracking')).toBeInTheDocument()
    })

    it('should show GPS unavailable message when geolocation is not supported', async () => {
      // Remove geolocation support
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      expect(screen.getAllByText('GPS Unavailable').length).toBeGreaterThan(0)
      expect(screen.getByText('You can still track your run manually')).toBeInTheDocument()
    })

    it('should request GPS permission when Enable button is clicked', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' })
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 5
          }
        })
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      // Wait for GPS prompt state to be recognized
      await waitFor(() => {
        expect(screen.getByText('Enable GPS Tracking')).toBeInTheDocument()
      })

      const enableButton = screen.getByRole('button', { name: 'Enable' })
      
      await act(async () => {
        fireEvent.click(enableButton)
      })

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
    })
  })

  describe('GPS Tracking Functionality', () => {
    beforeEach(() => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' })
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 5
          }
        })
      })
      mockGeolocation.watchPosition.mockImplementation((success) => {
        // Simulate position updates
        setTimeout(() => {
          success({
            coords: {
              latitude: 40.7129,
              longitude: -74.0061,
              accuracy: 5
            }
          })
        }, 100)
        return 1 // watch ID
      })
    })

    it('should start GPS tracking when run is started with granted permission', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      const startButton = screen.getByRole('button', { name: 'Start Run' })
      
      await act(async () => {
        fireEvent.click(startButton)
      })

      expect(mockGeolocation.watchPosition).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith({
        title: "Run Started! 🏃‍♂️",
        description: "GPS tracking active",
      })
    })

    it('should calculate distance from GPS coordinates', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      // Start run
      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      // Wait for GPS updates
      await waitFor(() => {
        const distanceElement = screen.getByText(/0\.00|0\.01/)
        expect(distanceElement).toBeInTheDocument()
      })
    })

    it('should pause and resume GPS tracking', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      // Start run
      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      // Pause run
      const pauseButton = screen.getByRole('button', { name: 'Pause Run' })
      await act(async () => {
        fireEvent.click(pauseButton)
      })

      expect(mockGeolocation.clearWatch).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith({
        title: "Run Paused ⏸️",
        description: "Tap resume when ready to continue",
      })

      // Resume run
      const resumeButton = screen.getByRole('button', { name: 'Resume Run' })
      await act(async () => {
        fireEvent.click(resumeButton)
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: "Run Resumed! 🏃‍♂️",
        description: "Keep going, you've got this!",
      })
    })
  })

  describe('Manual Entry Fallback', () => {
    it('should show manual entry option when GPS is denied', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'denied' })

      await act(async () => {
        render(<RecordScreen />)
      })

      expect(screen.getAllByText('GPS Unavailable').length).toBeGreaterThan(0)
      expect(screen.getByText('Manual Entry')).toBeInTheDocument()
    })

    it('should open manual run modal when manual entry is clicked', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'denied' })

      await act(async () => {
        render(<RecordScreen />)
      })

      const manualButton = screen.getByText('Manual Entry')
      
      await act(async () => {
        fireEvent.click(manualButton)
      })

      expect(screen.getByTestId('manual-run-modal')).toBeInTheDocument()
    })
  })

  describe('Run Data Persistence', () => {
    beforeEach(() => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' })
    })

    it('should save run data to database when stopped', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      // Start run
      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      // Wait a bit for metrics to accumulate
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Stop run
      const stopButton = screen.getByRole('button', { name: 'Stop Run' })
      await act(async () => {
        fireEvent.click(stopButton)
      })

      await waitFor(() => {
        expect(dbUtils.createRun).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 1,
            workoutId: 1,
            type: 'easy',
            distance: expect.any(Number),
            duration: expect.any(Number),
            pace: expect.any(Number),
            calories: expect.any(Number),
            completedAt: expect.any(Date)
          })
        )
      })

      expect(dbUtils.markWorkoutCompleted).toHaveBeenCalledWith(1)
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should handle run type conversion for rest workouts', async () => {
      ;(dbUtils.getTodaysWorkout as any).mockResolvedValue({
        id: 1,
        type: 'rest', // This should be converted to 'other' for Run interface
        distance: 0,
        planId: 1,
        week: 1,
        day: 'Mon',
        completed: false,
        scheduledDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      // Start and stop run
      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      const stopButton = screen.getByRole('button', { name: 'Stop Run' })
      await act(async () => {
        fireEvent.click(stopButton)
      })

      await waitFor(() => {
        expect(dbUtils.createRun).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'other' // Should be converted from 'rest'
          })
        )
      })
    })

    it('should show error message when user is not found', async () => {
      ;(dbUtils.getCurrentUser as any).mockResolvedValue(null)

      await act(async () => {
        render(<RecordScreen />)
      })

      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      const stopButton = screen.getByRole('button', { name: 'Stop Run' })
      await act(async () => {
        fireEvent.click(stopButton)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "User not found. Please complete onboarding first.",
          variant: "destructive"
        })
      })
    })
  })

  describe('Real-time Metrics Calculation', () => {
    beforeEach(() => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' })
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should update duration in real-time', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      // Start run
      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      // Advance time by 1 second
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Check that duration shows 00:01
      expect(screen.getByText('00:01')).toBeInTheDocument()

      // Advance time by 59 more seconds
      await act(async () => {
        vi.advanceTimersByTime(59000)
      })

      // Check that duration shows 01:00
      expect(screen.getByText('01:00')).toBeInTheDocument()
    })

    it('should calculate and display pace correctly', async () => {
      mockGeolocation.watchPosition.mockImplementation((success) => {
        // Simulate moving 1km in 300 seconds (5 minute pace)
        let callCount = 0
        const interval = setInterval(() => {
          callCount++
          success({
            coords: {
              latitude: 40.7128 + (callCount * 0.01), // Move roughly 1km over time
              longitude: -74.0060,
              accuracy: 5
            }
          })
          if (callCount >= 10) clearInterval(interval)
        }, 100)
        return 1
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      // Let some GPS updates happen
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Should show calculated pace
      await waitFor(() => {
        const paceElements = screen.getAllByText(/\d+:\d+/)
        expect(paceElements.length).toBeGreaterThan(1) // Duration and pace
      })
    })
  })

  describe('Navigation and UI Interactions', () => {
    it('should navigate back to today screen when back button is clicked', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      const backButton = screen.getByRole('button', { name: 'Back to Today Screen' })
      
      await act(async () => {
        fireEvent.click(backButton)
      })

      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('should open route selector modal when map button is clicked', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      const mapButton = screen.getByRole('button', { name: 'Open Route Selector' })
      
      await act(async () => {
        fireEvent.click(mapButton)
      })

      expect(screen.getByTestId('route-selector-modal')).toBeInTheDocument()
    })

    it('should display workout information when available', async () => {
      await act(async () => {
        render(<RecordScreen />)
      })

      await waitFor(() => {
        expect(screen.getByText('Easy')).toBeInTheDocument()
        expect(screen.getByText('5km target')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle GPS permission denied gracefully', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({ code: 1, message: 'Permission denied' })
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      const enableButton = screen.getByRole('button', { name: 'Enable' })
      
      await act(async () => {
        fireEvent.click(enableButton)
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: "GPS Access Denied",
        description: "You can still record your run manually or enable GPS in your browser settings.",
        variant: "destructive"
      })
    })

    it('should handle GPS tracking errors during run', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' })
      mockGeolocation.watchPosition.mockImplementation((success, error) => {
        error({ code: 2, message: 'Position unavailable' })
        return 1
      })

      await act(async () => {
        render(<RecordScreen />)
      })

      // Wait for GPS permission check to complete
      await waitFor(() => {
        expect(screen.queryByText('GPS Unavailable')).not.toBeInTheDocument()
      })

      const startButton = screen.getByRole('button', { name: 'Start Run' })
      
      await act(async () => {
        fireEvent.click(startButton)
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: "GPS Tracking Error",
        description: "Unable to track location. You can continue with manual entry.",
        variant: "destructive"
      })
    })

    it('should handle database save errors', async () => {
      ;(dbUtils.createRun as any).mockRejectedValue(new Error('Database error'))

      await act(async () => {
        render(<RecordScreen />)
      })

      const startButton = screen.getByRole('button', { name: 'Start Run' })
      await act(async () => {
        fireEvent.click(startButton)
      })

      const stopButton = screen.getByRole('button', { name: 'Stop Run' })
      await act(async () => {
        fireEvent.click(stopButton)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error Saving Run",
          description: "Your run data couldn't be saved. Please try again.",
          variant: "destructive"
        })
      })
    })
  })
}) 