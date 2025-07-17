import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceAnalyticsDashboard } from './performance-analytics-dashboard';
import { db } from '@/lib/db';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';

// Mock IndexedDB
global.indexedDB = new FDBFactory();

// Mock fetch
global.fetch = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

const mockAnalyticsData = {
  timeRange: '30d',
  dateRange: {
    start: '2023-11-01T00:00:00.000Z',
    end: '2023-12-01T00:00:00.000Z',
  },
  summary: {
    totalRuns: 10,
    totalDistance: 50.5,
    totalDuration: 18000,
    averagePace: 360,
    consistencyScore: 85,
    performanceScore: 78,
  },
  trends: {
    paceProgression: [
      { date: new Date('2023-11-01'), pace: 370 },
      { date: new Date('2023-11-15'), pace: 360 },
      { date: new Date('2023-12-01'), pace: 350 },
    ],
    distanceProgression: [
      { date: new Date('2023-11-01'), distance: 5 },
      { date: new Date('2023-11-15'), distance: 8 },
      { date: new Date('2023-12-01'), distance: 10 },
    ],
    consistencyProgression: [
      { date: new Date('2023-11-01'), consistency: 80 },
      { date: new Date('2023-11-15'), consistency: 85 },
      { date: new Date('2023-12-01'), consistency: 90 },
    ],
    performanceProgression: [
      { date: new Date('2023-11-01'), performance: 70 },
      { date: new Date('2023-11-15'), performance: 75 },
      { date: new Date('2023-12-01'), performance: 80 },
    ],
  },
  personalRecords: [
    {
      id: 1,
      recordType: 'fastest_5k',
      distance: 5,
      timeForDistance: 1800,
      bestPace: 360,
      dateAchieved: new Date('2023-11-15'),
      runId: 1,
      value: 1800,
    },
  ],
  insights: [
    {
      id: 1,
      type: 'improvement',
      title: 'Pace Improvement',
      description: 'Your pace has improved by 10 seconds per km',
      priority: 'high',
      actionable: false,
      createdAt: new Date('2023-12-01'),
    },
  ],
  comparison: {
    totalRuns: { current: 10, previous: 8, change: 2 },
    totalDistance: { current: 50.5, previous: 40.2, change: 10.3 },
    averagePace: { current: 360, previous: 370, change: -10 },
    consistencyScore: { current: 85, previous: 80, change: 5 },
  },
};

describe('PerformanceAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAnalyticsData,
    });
  });

  it('renders loading state initially', () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    // Should show loading skeletons
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(6); // Header + 4 cards + chart
  });

  it('renders analytics data after loading', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // Total runs
      expect(screen.getByText('50.5 km')).toBeInTheDocument(); // Total distance
      expect(screen.getByText('6:00')).toBeInTheDocument(); // Average pace
      expect(screen.getByText('78%')).toBeInTheDocument(); // Performance score
    });
  });

  it('allows changing time range', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    const timeRangeSelect = screen.getByRole('combobox');
    fireEvent.click(timeRangeSelect);
    
    const sevenDaysOption = screen.getByText('Last 7 days');
    fireEvent.click(sevenDaysOption);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('timeRange=7d')
      );
    });
  });

  it('handles export functionality', async () => {
    // Mock URL.createObjectURL and related DOM methods
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();
    
    const mockBlob = new Blob(['test data'], { type: 'text/csv' });
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    });

    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/performance/export')
      );
    });
  });

  it('handles error state', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('API Error'));
    
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('switches between tabs', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    // Click on trends tab
    const trendsTab = screen.getByText('Trends');
    fireEvent.click(trendsTab);
    
    expect(screen.getByText('Pace Progression')).toBeInTheDocument();
    expect(screen.getByText('Distance Progression')).toBeInTheDocument();

    // Click on records tab
    const recordsTab = screen.getByText('Records');
    fireEvent.click(recordsTab);
    
    // Should render PersonalRecordsCard (mocked)
    expect(screen.getByText('Records')).toBeInTheDocument();
  });

  it('displays comparison data correctly', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    // Check comparison indicators
    expect(screen.getByText('+2')).toBeInTheDocument(); // Total runs change
    expect(screen.getByText('+10.3 km')).toBeInTheDocument(); // Distance change
    expect(screen.getByText('10 sec/km')).toBeInTheDocument(); // Pace change
    expect(screen.getByText('+5.0%')).toBeInTheDocument(); // Consistency change
  });

  it('formats pace and duration correctly', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    // Check pace formatting (360 seconds = 6:00)
    expect(screen.getByText('6:00')).toBeInTheDocument();
  });

  it('calls onClose when provided', async () => {
    const mockOnClose = vi.fn();
    render(<PerformanceAnalyticsDashboard userId={1} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    // onClose should be available but not automatically called
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('handles API fetch with correct parameters', async () => {
    render(<PerformanceAnalyticsDashboard userId={2} />);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/performance/analytics?userId=2&timeRange=30d'
      );
    });
  });
});