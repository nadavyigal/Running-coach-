import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingScreen } from './onboarding-screen';
import posthog from 'posthog-js';
import { trackEngagementEvent } from '@/lib/analytics';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

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

  it('shows progress indicator with exactly 8 steps', () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    
    // Check that all 8 step indicators are present
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument();
    }
    
    // Verify no additional steps beyond 8
    const stepElements = screen.getAllByText(/^[1-8]$/);
    expect(stepElements).toHaveLength(8);
  });

  it('renders and navigates through all steps', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    // Step 1: Welcome
    expect(screen.getByText(/Welcome to Run-Smart/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Get Started/i));

    // Step 2: Goal selection
    expect(screen.getByText(/What's your running goal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Build a Running Habit/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 3: Experience
    expect(screen.getByText(/Running experience/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Beginner/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 4: RPE slider (optional)
    expect(screen.getByText(/Fitness Assessment/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 5: Age
    expect(screen.getByText(/How old are you/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: '30' } });
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 6: Availability
    expect(screen.getByText(/When can you run/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Morning/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 7: Consent
    expect(screen.getByLabelText(/I agree to the processing of my health data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/I agree to the processing of my health data/i));
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Service/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 8: Summary
    expect(screen.getByText(/Summary & Confirmation/i)).toBeInTheDocument();
  });

  it('validates required fields before proceeding', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByText(/Get Started/i));
    // Try to continue without selecting a goal
    expect(screen.getByText(/Continue/i)).toBeDisabled();
  });

  it('fires PostHog event on completion', async () => {
    render(<OnboardingScreen onComplete={mockOnComplete} />);
    // Fast-forward through steps
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/Build a Running Habit/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByText(/Beginner/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByText(/Continue/i)); // RPE
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: '30' } });
    fireEvent.click(screen.getByText(/Continue/i)); // Age
    fireEvent.click(screen.getByText(/Morning/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByLabelText(/I agree to the processing of my health data/i));
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Service/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByLabelText(/Start My Journey/i));
    await waitFor(() => {
      expect(trackEngagementEvent).toHaveBeenCalledWith('onboard_complete', expect.objectContaining({ rookieChallenge: true, age: 30, goalDist: 0 }));
    });
  });
}); 