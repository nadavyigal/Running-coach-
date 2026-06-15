import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockValues = vi.hoisted(() => ({
  emptyArray: [] as [],
}))

const mockDataContext = vi.hoisted(() => ({
  user: { id: 1, name: 'Test Runner' },
  userId: 1,
  plan: null,
  primaryGoal: null,
  activeGoals: mockValues.emptyArray,
  weeklyRuns: mockValues.emptyArray,
  weeklyStats: {
    runsCompleted: 0,
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
    plannedWorkouts: 0,
    completedWorkouts: 0,
    consistencyRate: 0,
  },
  weeklyWorkouts: mockValues.emptyArray,
  recentRuns: mockValues.emptyArray,
  allTimeStats: {
    totalRuns: 0,
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
  },
  isLoading: false,
  isInitialized: true,
  error: null,
  refresh: vi.fn(async () => undefined),
  refreshGoals: vi.fn(async () => undefined),
  refreshRuns: vi.fn(async () => undefined),
  refreshPlan: vi.fn(async () => undefined),
  triggerGarminSyncRefresh: vi.fn(async () => undefined),
  syncData: vi.fn(async () => ({ linkedRuns: 0, updatedGoals: 0, updatedWorkouts: 0 })),
}))

const dbUtilsMock = vi.hoisted(() => ({
  initializeDatabase: vi.fn(async () => true),
  getCurrentUser: vi.fn(async () => ({ id: 1, name: 'Test Runner' })),
  getRunsInTimeRange: vi.fn(async () => mockValues.emptyArray),
  getPrimaryGoal: vi.fn(async () => null),
  getUserGoals: vi.fn(async () => mockValues.emptyArray),
  checkAndUnlockBadges: vi.fn(async () => mockValues.emptyArray),
  ensureUserHasActivePlan: vi.fn(async () => null),
  setPrimaryGoal: vi.fn(async () => undefined),
  mergeGoals: vi.fn(async () => undefined),
  deleteGoal: vi.fn(async () => undefined),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/contexts/DataContext', () => ({
  useData: () => mockDataContext,
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    profileId: null,
    loading: false,
    signOut: vi.fn(async () => undefined),
    refreshSession: vi.fn(async () => undefined),
  }),
}))

vi.mock('@/lib/hooks/useGarminConnectionStatus', () => ({
  useGarminConnectionStatus: () => ({
    connected: false,
    syncState: 'disconnected',
    status: null,
    isLoading: false,
    refresh: vi.fn(async () => undefined),
  }),
}))

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: dbUtilsMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    users: { toArray: vi.fn(async () => [{ id: 1 }]) },
    wearableDevices: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(async () => null),
        })),
      })),
      update: vi.fn(async () => undefined),
    },
  },
}))

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(async () => undefined),
  trackFeatureUsed: vi.fn(async () => undefined),
  trackScreenViewed: vi.fn(async () => undefined),
}))

vi.mock('@/lib/challengeEngine', () => ({
  getActiveChallenge: vi.fn(async () => null),
  getChallengeHistory: vi.fn(async () => mockValues.emptyArray),
}))

vi.mock('@/lib/challengeTemplates', () => ({
  getActiveChallengeTemplates: () => mockValues.emptyArray,
}))

vi.mock('@/lib/challenge-plan-sync', () => ({
  startChallengeAndSyncPlan: vi.fn(async () => undefined),
}))

vi.mock('@/lib/garminSync', () => ({
  syncGarminEnabledData: vi.fn(async () => undefined),
}))

vi.mock('@/lib/goalProgressEngine', () => ({
  GoalProgressEngine: vi.fn(() => ({
    calculateGoalProgress: vi.fn(async () => null),
  })),
}))

vi.mock('@/components/add-shoes-modal', () => ({ AddShoesModal: () => <div data-testid="add-shoes-modal" /> }))
vi.mock('@/components/coaching-preferences-settings', () => ({ CoachingPreferencesSettings: () => <div data-testid="coaching-preferences-settings" /> }))
vi.mock('@/components/join-cohort-modal', () => ({ JoinCohortModal: () => <div data-testid="join-cohort-modal" /> }))
vi.mock('@/components/plan-template-flow', () => ({ PlanTemplateFlow: () => <div data-testid="plan-template-flow" /> }))
vi.mock('@/components/profile/ProfileHeroCard', () => ({ ProfileHeroCard: () => <div data-testid="profile-hero-card" /> }))
vi.mock('@/components/profile/PrimaryGoalCard', () => ({ PrimaryGoalCard: () => <div data-testid="primary-goal-card" /> }))
vi.mock('@/components/profile/MomentumSnapshotGrid', () => ({ MomentumSnapshotGrid: () => <div data-testid="momentum-snapshot-grid" /> }))
vi.mock('@/components/profile/ChallengeSection', () => ({ ChallengeSection: () => <div data-testid="challenge-section" /> }))
vi.mock('@/components/profile/CoachingProfilePanel', () => ({ CoachingProfilePanel: () => <div data-testid="coaching-profile-panel" /> }))
vi.mock('@/components/profile/PerformanceAnalyticsSection', () => ({ PerformanceAnalyticsSection: () => <div data-testid="performance-analytics-section" /> }))
vi.mock('@/components/profile/AchievementsSection', () => ({ AchievementsSection: () => <div data-testid="achievements-section" /> }))
vi.mock('@/components/garmin-readiness-card', () => ({ GarminReadinessCard: () => <div data-testid="garmin-readiness-card" /> }))
vi.mock('@/components/profile/IntegrationsListCard', () => ({ IntegrationsListCard: () => <div data-testid="integrations-list-card" /> }))
vi.mock('@/components/profile/SettingsListCard', () => ({ SettingsListCard: () => <div data-testid="settings-list-card" /> }))
vi.mock('@/components/profile/DeveloperToolsAccordion', () => ({ DeveloperToolsAccordion: () => <div data-testid="developer-tools-accordion" /> }))
vi.mock('@/components/profile/ProfilePageSkeleton', () => ({ ProfilePageSkeleton: () => <div data-testid="profile-page-skeleton" /> }))
vi.mock('@/components/profile/ProfileEmptyStates', () => ({ ProfileEmptyState: () => <div data-testid="profile-empty-state" /> }))
vi.mock('@/components/reminder-settings', () => ({ ReminderSettings: () => <div data-testid="reminder-settings" /> }))
vi.mock('@/components/user-data-settings', () => ({ UserDataSettings: () => <div data-testid="user-data-settings" /> }))
vi.mock('@/components/auth/auth-modal', () => ({ AuthModal: () => <div data-testid="auth-modal" /> }))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('ProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the loaded profile hub shell', async () => {
    const { ProfileScreen } = await import('./profile-screen')

    render(<ProfileScreen />)

    expect(screen.getByText('Profile Hub')).toBeInTheDocument()

    await waitFor(() => {
      expect(dbUtilsMock.getCurrentUser).toHaveBeenCalled()
    })
    expect(screen.getByTestId('profile-hero-card')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-page-skeleton')).not.toBeInTheDocument()
  })
})
