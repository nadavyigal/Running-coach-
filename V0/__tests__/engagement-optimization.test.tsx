import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EngagementOptimization } from '@/components/engagement-optimization';
import { dbUtils } from '@/lib/dbUtils';
import { engagementOptimizationService } from '@/lib/engagement-optimization';
import { vi } from 'vitest';

// Mock the database utilities
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getRuns: vi.fn(),
    updateUser: vi.fn(),
  },
}));

// Mock the engagement optimization service
vi.mock('@/lib/engagement-optimization', () => ({
  engagementOptimizationService: {
    calculateEngagementScore: vi.fn(),
    determineOptimalTiming: vi.fn(),
    generateMotivationalTriggers: vi.fn(),
  },
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  preferredTimes: ['08:00'],
  daysPerWeek: 3,
  consents: {
    data: true,
    gdpr: true,
    push: true,
  },
  onboardingComplete: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  currentStreak: 5,
  longestStreak: 10,
  notificationPreferences: {
    frequency: 'medium' as const,
    timing: 'morning' as const,
    types: [
      { id: 'motivational', name: 'Motivational', description: 'Daily motivation', enabled: true, category: 'motivational' as const },
      { id: 'reminder', name: 'Reminders', description: 'Run reminders', enabled: true, category: 'reminder' as const },
    ],
    quietHours: { start: '22:00', end: '07:00' },
  },
};

const mockRuns = [
  {
    id: 1,
    userId: 1,
    type: 'easy' as const,
    distance: 5,
    duration: 30,
    date: new Date('2024-01-01'),
    notes: 'Great run!',
  },
  {
    id: 2,
    userId: 1,
    type: 'tempo' as const,
    distance: 8,
    duration: 45,
    date: new Date('2024-01-03'),
    notes: 'Felt strong',
  },
];

describe('EngagementOptimization Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(dbUtils.getRuns).mockResolvedValue(mockRuns);
    vi.mocked(dbUtils.updateUser).mockResolvedValue(undefined);
  });

  it('renders engagement optimization interface', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Engagement Optimization')).toBeInTheDocument();
      expect(screen.getByText('Smart Notifications')).toBeInTheDocument();
      expect(screen.getByText('Achievement Celebrations')).toBeInTheDocument();
      expect(screen.getByText('Adaptive Frequency')).toBeInTheDocument();
    });
  });

  it('displays current engagement score', async () => {
    vi.mocked(engagementOptimizationService.calculateEngagementScore).mockResolvedValue(75);
    
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Engagement Score')).toBeInTheDocument();
    });
  });

  it('allows users to adjust notification frequency', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      const frequencySelect = screen.getByLabelText('Notification Frequency');
      expect(frequencySelect).toBeInTheDocument();
    });

    const frequencySelect = screen.getByLabelText('Notification Frequency');
    fireEvent.click(frequencySelect);
    
    const highOption = screen.getByText('High');
    fireEvent.click(highOption);
    
    expect(frequencySelect).toHaveValue('high');
  });

  it('allows users to set quiet hours', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
    });

    const startTimeInput = screen.getByLabelText('Start Time');
    const endTimeInput = screen.getByLabelText('End Time');
    
    fireEvent.change(startTimeInput, { target: { value: '23:00' } });
    fireEvent.change(endTimeInput, { target: { value: '08:00' } });
    
    expect(startTimeInput).toHaveValue('23:00');
    expect(endTimeInput).toHaveValue('08:00');
  });

  it('allows users to toggle notification types', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Motivational')).toBeInTheDocument();
      expect(screen.getByText('Reminders')).toBeInTheDocument();
    });

    const motivationalToggle = screen.getByRole('checkbox', { name: /motivational/i });
    fireEvent.click(motivationalToggle);
    
    expect(motivationalToggle).not.toBeChecked();
  });

  it('saves preferences when save button is clicked', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(dbUtils.updateUser).toHaveBeenCalled();
    });
  });

  it('displays motivational triggers', async () => {
    const mockTriggers = [
      { id: 'streak', type: 'streak', message: 'Keep your streak alive!', enabled: true },
      { id: 'milestone', type: 'milestone', message: 'You\'re close to a milestone!', enabled: true },
    ];
    
    vi.mocked(engagementOptimizationService.generateMotivationalTriggers).mockResolvedValue(mockTriggers);
    
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Keep your streak alive!')).toBeInTheDocument();
      expect(screen.getByText('You\'re close to a milestone!')).toBeInTheDocument();
    });
  });

  it('displays optimal timing recommendations', async () => {
    const mockTiming = {
      bestTime: '08:00',
      confidence: 0.85,
      reasoning: 'Based on your morning runs',
    };
    
    vi.mocked(engagementOptimizationService.determineOptimalTiming).mockResolvedValue(mockTiming);
    
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('Based on your morning runs')).toBeInTheDocument();
    });
  });

  it('shows engagement patterns', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Engagement Patterns')).toBeInTheDocument();
      expect(screen.getByText('Morning Runner')).toBeInTheDocument();
      expect(screen.getByText('Consistent Schedule')).toBeInTheDocument();
    });
  });

  it('allows users to customize achievement celebrations', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Achievement Celebrations')).toBeInTheDocument();
    });

    const celebrationToggle = screen.getByRole('checkbox', { name: /achievement celebrations/i });
    fireEvent.click(celebrationToggle);
    
    expect(celebrationToggle).toBeChecked();
  });

  it('displays engagement insights', async () => {
    render(<EngagementOptimization />);
    
    await waitFor(() => {
      expect(screen.getByText('Engagement Insights')).toBeInTheDocument();
      expect(screen.getByText('You\'re most active in the mornings')).toBeInTheDocument();
      expect(screen.getByText('Your consistency is improving')).toBeInTheDocument();
    });
  });
});