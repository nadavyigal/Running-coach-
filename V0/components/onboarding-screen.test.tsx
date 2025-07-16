import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
}));

vi.mock('@/lib/db', () => ({
  dbUtils: {
    migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue(1),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock('@/lib/planGenerator', () => ({
  generatePlan: vi.fn().mockResolvedValue({
    plan: { id: 1, userId: 1 },
    workouts: [],
  }),
}));

const mockOnComplete = vi.fn();

describe('OnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    // Step 5: Availability
    expect(screen.getByText(/When can you run/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Morning/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 6: Consent
    expect(screen.getByLabelText(/I agree to the processing of my health data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/I agree to the processing of my health data/i));
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Service/i));
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 7: Summary
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
    fireEvent.click(screen.getByText(/Morning/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByLabelText(/I agree to the processing of my health data/i));
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Service/i));
    fireEvent.click(screen.getByText(/Continue/i));
    fireEvent.click(screen.getByLabelText(/Start My Journey/i));
    await waitFor(() => {
      expect(trackEngagementEvent).toHaveBeenCalledWith('onboard_complete', expect.objectContaining({ rookieChallenge: true }));
    });
  });
}); 