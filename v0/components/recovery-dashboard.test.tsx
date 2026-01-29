import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import RecoveryDashboard from './recovery-dashboard';

// Use the global fetch mock from vitest.setup.ts - don't override it

describe('RecoveryDashboard', () => {
  let originalFetch: any;
  
  beforeEach(() => {
    // Clear all mock calls before each test and store original fetch
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });
  
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  it('renders loading state initially', () => {
    // Override the global mock temporarily for this specific test
    const mockFetch = vi.fn().mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );
    global.fetch = mockFetch;

    render(<RecoveryDashboard />);
    
    // Look for loading spinner by its specific structure
    expect(screen.getByTestId('loading-spinner') || document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error state when API calls fail', async () => {
    // Override the global mock temporarily to simulate API failure
    const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    render(<RecoveryDashboard />);
    
    // Wait for loading to finish and error to appear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load recovery data')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders recovery dashboard with data', async () => {
    // Use the default global fetch mock - it already returns proper recovery data
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Then check for dashboard content
    expect(screen.getByText('Recovery Dashboard')).toBeInTheDocument();
    expect(screen.getByText("Today's Recovery Score")).toBeInTheDocument();
  });

  it('displays individual recovery scores', async () => {
    // Use the default global fetch mock
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Then check for score elements
    expect(screen.getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('HRV')).toBeInTheDocument();
    expect(screen.getAllByText('Resting HR').length).toBeGreaterThan(0);
  });

  it('displays recovery recommendations', async () => {
    // Use the default global fetch mock that includes recommendations
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Then check for recommendations
    expect(screen.getByText('Recovery Recommendations')).toBeInTheDocument();
  });

  it('displays confidence score', async () => {
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Then check for confidence score
    expect(screen.getByText('Confidence')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('displays recovery trends', async () => {
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Then check for trends
    expect(screen.getByText('Recovery Trends')).toBeInTheDocument();
  });

  it('displays wellness data when available', async () => {
    render(<RecoveryDashboard />);
    
    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Click on wellness tab to see the content
    const wellnessTab = screen.getByRole('tab', { name: /wellness input/i });
    fireEvent.mouseDown(wellnessTab);
    fireEvent.click(wellnessTab);
    
    // Then check for wellness content
    await waitFor(() => {
      expect(screen.getByText('How are you feeling today?')).toBeInTheDocument();
    });
  });
});
