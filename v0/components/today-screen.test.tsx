import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayScreen } from './today-screen'
import { dbUtils } from '@/lib/dbUtils'

vi.mock('@/lib/dbUtils')
const mockUseData = vi.hoisted(() => vi.fn())
const mockUseGoalProgress = vi.hoisted(() => vi.fn())

vi.mock('@/contexts/DataContext', () => ({
  useData: () => mockUseData(),
  useGoalProgress: () => mockUseGoalProgress(),
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    profileId: null,
    loading: false,
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  }),
}))
vi.mock('@/components/auth/auth-modal', () => ({
  AuthModal: () => null,
}))
vi.mock('@/components/add-run-modal', () => ({
  AddRunModal: ({ open }: { open: boolean }) => (open ? <div data-testid="add-run-modal" /> : null),
}))
vi.mock('@/components/add-activity-modal', () => ({
  AddActivityModal: ({ open }: { open: boolean }) => (open ? <div data-testid="add-activity-modal" /> : null),
}))
vi.mock('@/components/route-selector-modal', () => ({
  RouteSelectorModal: () => null,
}))
vi.mock('@/components/reschedule-modal', () => ({
  RescheduleModal: () => null,
}))
vi.mock('@/components/date-workout-modal', () => ({
  DateWorkoutModal: () => null,
}))
vi.mock('@/components/community-stats-widget', () => ({
  CommunityStatsWidget: () => <div data-testid="community-stats-widget" />,
}))
vi.mock('@/components/goal-recommendations', () => ({
  GoalRecommendations: () => <div data-testid="goal-recommendations" />,
}))
vi.mock('@/components/habit-analytics-widget', () => ({
  HabitAnalyticsWidget: () => <div data-testid="habit-analytics-widget" />,
}))
vi.mock('@/lib/goalProgressEngine', () => ({
  GoalProgressEngine: vi.fn().mockImplementation(() => ({
    calculateGoalProgress: vi.fn().mockResolvedValue({
      progressPercentage: 40,
      trajectory: 'on_track',
    }),
  })),
}))
vi.mock('@/components/modal-error-boundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const baseWorkout = {
  id: 101,
  type: 'easy',
  distance: 5,
  duration: 30,
  planId: 10,
  week: 1,
  day: 'Mon',
  completed: false,
  scheduledDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('TodayScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseData.mockReturnValue({
      userId: 1,
      plan: { id: 10, title: 'Base Plan' },
      primaryGoal: null,
      weeklyRuns: [],
      weeklyWorkouts: [],
      weeklyStats: {
        runsCompleted: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
        plannedWorkouts: 0,
        completedWorkouts: 0,
        consistencyRate: 0,
      },
      refresh: vi.fn().mockResolvedValue(undefined),
    })
    mockUseGoalProgress.mockReturnValue(0)
    ;(dbUtils.getCurrentUser as any).mockResolvedValue({ id: 1 })
    ;(dbUtils.getActivePlan as any).mockResolvedValue({ id: 10, title: 'Base Plan' })
    ;(dbUtils.getPrimaryGoal as any).mockResolvedValue(null)
    ;(dbUtils.getWorkoutsForDateRange as any).mockResolvedValue([])
    ;(dbUtils.getTodaysWorkout as any).mockResolvedValue(baseWorkout)
  })

  it('renders today workout details and quick actions', async () => {
    render(<TodayScreen />)

    expect(await screen.findByText('Easy Run')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /start run/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Add Run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument()
  })

  it('renders rest day state when no workout exists', async () => {
    ;(dbUtils.getTodaysWorkout as any).mockResolvedValueOnce(null)

    render(<TodayScreen />)

    expect(await screen.findByText('Rest Day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record run/i })).toBeInTheDocument()
  })

  it('opens add run modal when Add Run is clicked', async () => {
    render(<TodayScreen />)

    await screen.findByText('Easy Run')
    expect(screen.queryByTestId('add-run-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Run' }))

    await waitFor(() => {
      expect(screen.getByTestId('add-run-modal')).toBeInTheDocument()
    })
  })

  it('shows the active goal card when a primary goal exists', async () => {
    const primaryGoal = {
      id: 7,
      title: 'Run 10K',
      description: 'Build up to 10K',
      baselineValue: 0,
      targetValue: 10,
      currentValue: 4,
      goalType: 'distance_achievement',
      category: 'endurance',
      priority: 1,
      status: 'active',
      specificTarget: { metric: 'distance', value: 10, unit: 'km' },
      timeBound: {
        startDate: new Date(),
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        milestoneSchedule: [25, 50, 75],
        totalDuration: 14,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockUseData.mockReturnValue({
      userId: 1,
      plan: { id: 10, title: 'Base Plan' },
      primaryGoal,
      weeklyRuns: [],
      weeklyWorkouts: [],
      weeklyStats: {
        runsCompleted: 0,
        totalDistanceKm: 0,
        totalDurationSeconds: 0,
        plannedWorkouts: 0,
        completedWorkouts: 0,
        consistencyRate: 0,
      },
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    render(<TodayScreen />)

    expect(await screen.findByText('Active Goal')).toBeInTheDocument()
    expect(screen.getByText('Run 10K')).toBeInTheDocument()
  })
})
