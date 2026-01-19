import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingScreen } from './onboarding-screen';
vi.mock('@/lib/analytics', () => ({
  trackEngagementEvent: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
  trackOnboardingEvent: vi.fn(),
  trackOnboardingChatMessage: vi.fn(),
  trackConversationPhase: vi.fn(),
  trackAIGuidanceUsage: vi.fn(),
  trackOnboardingCompletion: vi.fn(),
  trackError: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    users: {
      toArray: vi.fn().mockResolvedValue([{ id: 1, onboardingComplete: false }]),
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 1 }),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(1),
      and: vi.fn().mockReturnThis(),
    },
    plans: {
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      and: vi.fn().mockReturnThis(),
    },
    workouts: {
      bulkAdd: vi.fn().mockResolvedValue([1, 2, 3]),
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      and: vi.fn().mockReturnThis(),
    },
    onboardingSessions: {
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      and: vi.fn().mockReturnThis(),
    },
    conversationMessages: {
      add: vi.fn().mockResolvedValue(1),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      and: vi.fn().mockReturnThis(),
    },
  },
  dbUtils: {
    migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue(1),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1 }),
    updateUser: vi.fn().mockResolvedValue(undefined),
  },
  resetDatabaseInstance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/planGenerator', () => ({
  generatePlan: vi.fn().mockResolvedValue({
    plan: { id: 1, userId: 1 },
    workouts: [],
  }),
}));

vi.mock('@/lib/planAdjustmentService', () => ({
  planAdjustmentService: {
    init: vi.fn(),
    afterRun: vi.fn(),
    clear: vi.fn(),
  },
}));

const mockOnComplete = vi.fn();

describe('OnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows onboarding intro', () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    expect(screen.getByRole('heading', { name: /Unlock Your Personalized Running Potential/i })).toBeInTheDocument();
  });

  it('renders and navigates through all steps', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    // Step 1: Welcome
    expect(screen.getByRole('heading', { name: /Unlock Your Personalized Running Potential/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Let's Get Started/i }));

    // Step 2: Goal selection
    expect(screen.getByText(/What is your main goal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Build a running habit/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3: Experience
    expect(screen.getByRole('heading', { name: /Running experience/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Beginner/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 4: Age
    expect(screen.getByText(/How old are you/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 5: Current race time
    expect(screen.getByText(/estimated current race time/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 6: Schedule
    expect(screen.getByText(/How many days per week would you like to run/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Saturday/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 7: Summary
    expect(screen.getByText(/Summary and confirmation/i)).toBeInTheDocument();
  });

  it('validates required fields before proceeding', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /Let's Get Started/i }));
    // Try to continue without selecting a goal
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled();
  });

  it('shows the finish button on the summary step', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /Let's Get Started/i }));
    fireEvent.click(screen.getByText(/Build a running habit/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByText(/Beginner/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByText(/Saturday/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('button', { name: /Complete setup/i })).toBeInTheDocument();
  });
}); 
