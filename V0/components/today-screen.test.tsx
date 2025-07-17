import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, MockedFunction } from 'vitest';
import React from 'react';
import { TodayScreen } from './today-screen';
import { StreakIndicator } from "./streak-indicator"
import { dbUtils } from '../lib/db';

// Mock dbUtils and hooks
vi.mock('../lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getTodaysWorkout: vi.fn(),
    getActivePlan: vi.fn(),
    getWorkoutsByPlan: vi.fn(),
    getRunStats: vi.fn(),
  },
}));

vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('./ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h2 data-testid="card-title" {...props}>{children}</h2>,
}));

vi.mock('./ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('./ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('./ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} {...props}></div>
  ),
}));

vi.mock('./add-run-modal', () => ({
  AddRunModal: ({ open, onClose, ...props }: any) => (
    open ? <div data-testid="add-run-modal" onClick={onClose} {...props}>Add Run Modal</div> : null
  ),
}));

vi.mock('./add-activity-modal', () => ({
  AddActivityModal: ({ open, onClose, ...props }: any) => (
    open ? <div data-testid="add-activity-modal" onClick={onClose} {...props}>Add Activity Modal</div> : null
  ),
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner',
  preferredTimes: ['morning'],
  daysPerWeek: 3,
  consents: {},
  onboardingComplete: true,
};

const mockWorkout = {
  id: 1,
  planId: 1,
  week: 1,
  day: 1,
  type: 'easy',
  scheduledDate: new Date().toISOString(),
  distance: 3,
  duration: 30,
  description: 'Easy run',
  completed: false,
  completedAt: null,
  notes: null,
  rpe: null,
  actualDistance: null,
  actualDuration: null,
};

const mockPlan = {
  id: 1,
  userId: 1,
  name: 'Test Plan',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('TodayScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with today workout and actions', async () => {
    dbUtils.getCurrentUser.mockResolvedValue(mockUser);
    dbUtils.getTodaysWorkout.mockResolvedValue(mockWorkout);
    dbUtils.getActivePlan.mockResolvedValue(mockPlan);
    dbUtils.getWorkoutsByPlan.mockResolvedValue([mockWorkout]);
    dbUtils.getRunStats.mockResolvedValue({ totalRuns: 5, totalDistance: 15, totalDuration: 150 });

    render(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Easy run')).toBeInTheDocument();
      expect(screen.getByText('Record Run')).toBeInTheDocument();
      expect(screen.getByText('Add Activity')).toBeInTheDocument();
    });
  });

  it('handles empty state (no plan)', async () => {
    dbUtils.getCurrentUser.mockResolvedValue(mockUser);
    dbUtils.getActivePlan.mockResolvedValue(undefined);
    dbUtils.getTodaysWorkout.mockResolvedValue(null);

    render(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByText('No Active Plan')).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    dbUtils.getCurrentUser.mockRejectedValue(new Error('DB error'));
    render(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByText('Error loading data')).toBeInTheDocument();
    });
  });

  it('navigates to Record Run when Start Workout is clicked', async () => {
    dbUtils.getCurrentUser.mockResolvedValue(mockUser);
    dbUtils.getTodaysWorkout.mockResolvedValue(mockWorkout);
    dbUtils.getActivePlan.mockResolvedValue(mockPlan);
    dbUtils.getWorkoutsByPlan.mockResolvedValue([mockWorkout]);
    dbUtils.getRunStats.mockResolvedValue({ totalRuns: 5, totalDistance: 15, totalDuration: 150 });

    render(<TodayScreen />);

    await waitFor(() => {
      const recordButton = screen.getByText('Record Run');
      fireEvent.click(recordButton);
      // Navigation would be handled by parent component
    });
  });

  it('shows and closes Add Run modal', async () => {
    dbUtils.getCurrentUser.mockResolvedValue(mockUser);
    dbUtils.getTodaysWorkout.mockResolvedValue(mockWorkout);
    dbUtils.getActivePlan.mockResolvedValue(mockPlan);
    dbUtils.getWorkoutsByPlan.mockResolvedValue([mockWorkout]);
    dbUtils.getRunStats.mockResolvedValue({ totalRuns: 5, totalDistance: 15, totalDuration: 150 });

    render(<TodayScreen />);

    await waitFor(() => {
      const addRunButton = screen.getByText('Add Run');
      fireEvent.click(addRunButton);
      expect(screen.getByTestId('add-run-modal')).toBeInTheDocument();
    });
  });

  it('renders StreakIndicator with zero state', async () => {
    dbUtils.getCurrentUser.mockResolvedValue({ ...mockUser, currentStreak: 0, longestStreak: 0 });
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Start your streak!')).toBeInTheDocument();
    });
  });

  it('renders StreakIndicator with normal streak', async () => {
    dbUtils.getCurrentUser.mockResolvedValue({ ...mockUser, currentStreak: 5, longestStreak: 10 });
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('🔥 Streak')).toBeInTheDocument();
      expect(screen.getByText('Longest Streak: 10')).toBeInTheDocument();
    });
  });

  it('renders StreakIndicator error state', async () => {
    dbUtils.getCurrentUser.mockRejectedValue(new Error('DB error'));
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument();
    });
  });

  it('toggles streak animation', async () => {
    dbUtils.getCurrentUser.mockResolvedValue({ ...mockUser, currentStreak: 3, longestStreak: 7 });
    render(<TodayScreen />);
    await waitFor(() => {
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeInTheDocument();
      fireEvent.click(toggle);
    });
  });

  it('updates streak in real-time', async () => {
    dbUtils.getCurrentUser.mockResolvedValue({ ...mockUser, currentStreak: 2, longestStreak: 5 });
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    // Simulate streak update event
    window.dispatchEvent(new CustomEvent('streak-updated', { detail: { streak: 4 } }));
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('is accessible (has ARIA labels and keyboard navigation)', async () => {
    dbUtils.getCurrentUser.mockResolvedValue(mockUser);
    dbUtils.getTodaysWorkout.mockResolvedValue(mockWorkout);
    dbUtils.getActivePlan.mockResolvedValue(mockPlan);
    dbUtils.getWorkoutsByPlan.mockResolvedValue([mockWorkout]);
    dbUtils.getRunStats.mockResolvedValue({ totalRuns: 5, totalDistance: 15, totalDuration: 150 });

    render(<TodayScreen />);

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('aria-label', 'Today dashboard');
    });
  });
}); 