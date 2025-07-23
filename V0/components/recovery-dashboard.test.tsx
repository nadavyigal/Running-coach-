import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, MockedFunction } from 'vitest';
import '@testing-library/jest-dom';
import RecoveryDashboard from './recovery-dashboard';

// Mock fetch
global.fetch = vi.fn();

const mockRecoveryScore = {
  id: 1,
  userId: 1,
  date: new Date('2024-01-15'),
  overallScore: 75,
  sleepScore: 80,
  hrvScore: 70,
  restingHRScore: 75,
  subjectiveWellnessScore: 80,
  trainingLoadImpact: -5,
  stressLevel: 30,
  recommendations: [
    'Your HRV indicates good recovery. You can handle moderate intensity training',
    'Consider maintaining your current sleep routine for optimal recovery'
  ],
  confidence: 85,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15')
};

const mockTrends = {
  trends: [mockRecoveryScore],
  stats: {
    overall: { avg: 75, min: 70, max: 80, trend: 'improving' },
    sleep: { avg: 80, min: 75, max: 85, trend: 'stable' },
    hrv: { avg: 70, min: 65, max: 75, trend: 'improving' },
    restingHR: { avg: 75, min: 70, max: 80, trend: 'stable' }
  },
  period: '30 days'
};

const mockWellnessData = {
  id: 1,
  userId: 1,
  date: new Date('2024-01-15'),
  energyLevel: 8,
  moodScore: 7,
  sorenessLevel: 3,
  stressLevel: 4,
  motivationLevel: 9,
  notes: 'Feeling great today!',
  createdAt: new Date('2024-01-15')
};

describe('RecoveryDashboard', () => {
  beforeEach(() => {
    (fetch as MockedFunction<typeof fetch>).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as MockedFunction<typeof fetch>).mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(<RecoveryDashboard />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error state when API calls fail', async () => {
    (fetch as MockedFunction<typeof fetch>).mockRejectedValue(new Error('API Error'));

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load recovery data')).toBeInTheDocument();
    });
  });

  it('renders recovery dashboard with data', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Recovery Dashboard')).toBeInTheDocument();
      expect(screen.getByText("Today's Recovery Score")).toBeInTheDocument();
      expect(screen.getByText('75/100')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });
  });

  it('displays individual recovery scores', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Sleep')).toBeInTheDocument();
      expect(screen.getByText('HRV')).toBeInTheDocument();
      expect(screen.getByText('Resting HR')).toBeInTheDocument();
      expect(screen.getByText('Wellness')).toBeInTheDocument();
    });
  });

  it('displays recovery recommendations', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Recovery Recommendations')).toBeInTheDocument();
      expect(screen.getByText(/Your HRV indicates good recovery/)).toBeInTheDocument();
      expect(screen.getByText(/Consider maintaining your current sleep routine/)).toBeInTheDocument();
    });
  });

  it('displays confidence score', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Confidence')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('displays recovery trends', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Recovery Trends')).toBeInTheDocument();
      expect(screen.getByText('Overall Recovery')).toBeInTheDocument();
      expect(screen.getByText('Sleep Quality')).toBeInTheDocument();
      expect(screen.getByText('HRV Score')).toBeInTheDocument();
      expect(screen.getByText('Resting HR')).toBeInTheDocument();
    });
  });

  it('displays wellness data when available', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('How are you feeling today?')).toBeInTheDocument();
      expect(screen.getByText('Energy Level')).toBeInTheDocument();
      expect(screen.getByText('Mood')).toBeInTheDocument();
      expect(screen.getByText('Soreness')).toBeInTheDocument();
      expect(screen.getByText('Stress Level')).toBeInTheDocument();
      expect(screen.getByText('Motivation')).toBeInTheDocument();
    });
  });

  it('displays wellness scores correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('8/10')).toBeInTheDocument(); // Energy Level
      expect(screen.getByText('7/10')).toBeInTheDocument(); // Mood
      expect(screen.getByText('3/10')).toBeInTheDocument(); // Soreness
      expect(screen.getByText('4/10')).toBeInTheDocument(); // Stress Level
      expect(screen.getByText('9/10')).toBeInTheDocument(); // Motivation
    });
  });

  it('displays wellness labels correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Excellent')).toHaveLength(2); // Energy and Motivation
      expect(screen.getAllByText('Good')).toHaveLength(2); // Mood and Stress
      expect(screen.getAllByText('Excellent')).toHaveLength(2); // Soreness (inverted)
    });
  });

  it('allows date selection', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
      expect(dateInput).toBeInTheDocument();
      
      fireEvent.change(dateInput, { target: { value: '2024-01-10' } });
      
      // Should trigger new API calls with the new date
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('date=2024-01-10')
      );
    });
  });

  it('handles missing wellness data gracefully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: null })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('No wellness data for today')).toBeInTheDocument();
      expect(screen.getByText('Add Wellness Data')).toBeInTheDocument();
    });
  });

  it('displays trend statistics correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument(); // Overall avg
      expect(screen.getByText('80')).toBeInTheDocument(); // Sleep avg
      expect(screen.getByText('70')).toBeInTheDocument(); // HRV avg
      expect(screen.getByText('75')).toBeInTheDocument(); // Resting HR avg
    });
  });

  it('displays trend ranges correctly', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockRecoveryScore })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockTrends })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockWellnessData })
      });

    render(<RecoveryDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('70-80 range')).toBeInTheDocument(); // Overall range
      expect(screen.getByText('75-85 range')).toBeInTheDocument(); // Sleep range
      expect(screen.getByText('65-75 range')).toBeInTheDocument(); // HRV range
      expect(screen.getByText('70-80 range')).toBeInTheDocument(); // Resting HR range
    });
  });
}); 