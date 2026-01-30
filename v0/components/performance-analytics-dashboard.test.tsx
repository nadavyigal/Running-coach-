import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceAnalyticsDashboard } from './performance-analytics-dashboard';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';

const mockDbUtils = vi.hoisted(() => ({
  getRunsInTimeRange: vi.fn(),
  calculatePerformanceTrends: vi.fn(),
  getPersonalRecords: vi.fn(),
  getPerformanceInsights: vi.fn(),
}));

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: mockDbUtils,
}));

vi.mock('@/components/performance-overview-tab', () => ({
  PerformanceOverviewTab: () => <div>Overview Content</div>,
}));

vi.mock('@/components/performance-trends-tab', () => ({
  PerformanceTrendsTab: () => (
    <div>
      <div>Pace Progression</div>
      <div>Distance Progression</div>
    </div>
  ),
}));

vi.mock('@/components/personal-records-card', () => ({
  PersonalRecordsCard: () => <div>Records</div>,
}));

vi.mock('@/components/community-comparison', () => ({
  CommunityComparison: () => <div>Community Comparison</div>,
}));

// Mock IndexedDB
global.indexedDB = new FDBFactory();

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

describe('PerformanceAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    const runs = [
      { distance: 5, duration: 1800 },
      { distance: 10, duration: 3600 },
    ];
    const previousRuns = [{ distance: 7, duration: 2400 }];

    const trends = {
      averagePace: 360,
      consistencyScore: 85,
      performanceScore: 78,
      paceProgression: [{ date: new Date('2023-11-01'), pace: 360 }],
      distanceProgression: [{ date: new Date('2023-11-01'), distance: 5 }],
      consistencyProgression: [{ date: new Date('2023-11-01'), consistency: 85 }],
      performanceProgression: [{ date: new Date('2023-11-01'), performance: 78 }],
    };

    const previousTrends = {
      averagePace: 370,
      consistencyScore: 80,
      performanceScore: 70,
      paceProgression: [{ date: new Date('2023-10-01'), pace: 370 }],
      distanceProgression: [{ date: new Date('2023-10-01'), distance: 7 }],
      consistencyProgression: [{ date: new Date('2023-10-01'), consistency: 80 }],
      performanceProgression: [{ date: new Date('2023-10-01'), performance: 70 }],
    };

    mockDbUtils.getRunsInTimeRange
      .mockResolvedValueOnce(runs)
      .mockResolvedValueOnce(previousRuns)
      .mockResolvedValue(runs);
    mockDbUtils.calculatePerformanceTrends
      .mockResolvedValueOnce(trends)
      .mockResolvedValueOnce(previousTrends)
      .mockResolvedValue(trends);
    mockDbUtils.getPersonalRecords.mockResolvedValue([]);
    mockDbUtils.getPerformanceInsights.mockResolvedValue([]);
  });

  it('renders loading state initially', () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    // Should show loading skeletons
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(7); // Header + 4 cards + chart
  });

  it('renders analytics data after loading', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Total runs
      expect(screen.getByText('15.0 km')).toBeInTheDocument(); // Total distance
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
      expect(mockDbUtils.getRunsInTimeRange).toHaveBeenCalled();
    });

    const lastCall = mockDbUtils.getRunsInTimeRange.mock.calls.at(-1);
    const startDate = lastCall?.[1] as Date;
    const endDate = lastCall?.[2] as Date;
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(7);
  });

  it('handles export functionality', async () => {
    // Mock URL.createObjectURL and related DOM methods
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();
    
    const mockBlob = new Blob(['test data'], { type: 'text/csv' });
    (global.fetch as any).mockResolvedValueOnce({
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
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/performance/export')
      );
    });
  });

  it('handles error state', async () => {
    mockDbUtils.getRunsInTimeRange.mockReset();
    mockDbUtils.getRunsInTimeRange.mockRejectedValueOnce(new Error('API Error'));
    
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
    const trendsTab = screen.getByRole('tab', { name: 'Trends' });
    fireEvent.mouseDown(trendsTab);
    fireEvent.click(trendsTab);
    
    await waitFor(() => {
      expect(trendsTab).toHaveAttribute('data-state', 'active');
    });

    // Click on records tab
    const recordsTab = screen.getByRole('tab', { name: 'Records' });
    fireEvent.mouseDown(recordsTab);
    fireEvent.click(recordsTab);
    
    await waitFor(() => {
      expect(recordsTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('displays comparison data correctly', async () => {
    render(<PerformanceAnalyticsDashboard userId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument();
    });

    // Check comparison indicators
    expect(screen.getByText('+1')).toBeInTheDocument(); // Total runs change
    expect(screen.getByText('+8.0 km')).toBeInTheDocument(); // Distance change
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
      expect(mockDbUtils.getRunsInTimeRange).toHaveBeenCalled();
    });

    const calls = mockDbUtils.getRunsInTimeRange.mock.calls;
    for (const call of calls) {
      expect(call[0]).toBe(2);
    }
  });
});
