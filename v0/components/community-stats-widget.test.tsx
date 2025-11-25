import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CommunityStatsWidget } from './community-stats-widget';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('CommunityStatsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<CommunityStatsWidget userId={1} />);
    expect(screen.getByText('Loading community stats...')).toBeInTheDocument();
  });

  it('renders "Join a cohort" message when user is not in a cohort', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'User not in a cohort' }),
    });

    render(<CommunityStatsWidget userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Join a cohort to see community stats!')).toBeInTheDocument();
    });
  });

  it('renders error message when API fails', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal server error' }),
    });

    render(<CommunityStatsWidget userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('renders stats when data is loaded successfully', async () => {
    const mockStats = {
      totalMembers: 10,
      activeMembers: 7,
      totalRuns: 45,
      totalDistance: 234.5,
      avgDistance: 5.2,
      weeklyRuns: 12,
      weeklyDistance: 58.3,
      cohortName: 'Running Buddies',
    };

    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<CommunityStatsWidget userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Running Buddies')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // Total members
      expect(screen.getByText('7')).toBeInTheDocument(); // Active members
      expect(screen.getByText('45')).toBeInTheDocument(); // Total runs
      expect(screen.getByText('234.5')).toBeInTheDocument(); // Total distance
      expect(screen.getByText('5.2 km avg')).toBeInTheDocument(); // Average distance
      expect(screen.getByText('12')).toBeInTheDocument(); // Weekly runs
      expect(screen.getByText('58.3 km')).toBeInTheDocument(); // Weekly distance
    });
  });

  it('handles fetch errors gracefully', async () => {
    (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<CommunityStatsWidget userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch cohort stats')).toBeInTheDocument();
    });
  });

  it('calls API with correct userId', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'User not in a cohort' }),
    });

    render(<CommunityStatsWidget userId={123} />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/cohort/stats?userId=123');
    });
  });

  it('does not render when userId is 0', () => {
    render(<CommunityStatsWidget userId={0} />);
    expect(screen.getByText('Loading community stats...')).toBeInTheDocument();
  });
});