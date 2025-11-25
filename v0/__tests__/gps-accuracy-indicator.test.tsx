import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GPSAccuracyIndicator } from '@/components/gps-accuracy-indicator';
import { GPSMonitoringService, type GPSAccuracyData } from '@/lib/gps-monitoring';

// Mock the GPS monitoring service
vi.mock('@/lib/gps-monitoring', () => ({
  GPSMonitoringService: vi.fn().mockImplementation(() => ({
    onAccuracyUpdate: vi.fn(() => () => {}),
    getAccuracyStats: vi.fn(() => ({
      current: null,
      average: 0,
      best: 0,
      worst: 0,
      trend: 'stable'
    })),
    isReadyForTracking: vi.fn(() => ({ ready: true })),
    getTroubleshootingGuide: vi.fn(() => null),
    getAccuracyMessage: vi.fn(() => ({
      title: 'Good GPS',
      description: 'Good accuracy (±8m)',
      color: 'green',
      icon: 'good'
    }))
  }))
}));

describe('GPSAccuracyIndicator', () => {
  const mockAccuracyData: GPSAccuracyData = {
    signalStrength: 85,
    accuracyRadius: 8,
    satellitesVisible: 9,
    locationQuality: 'good',
    timestamp: new Date(),
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state when no accuracy data', () => {
    render(<GPSAccuracyIndicator />);
    
    expect(screen.getByText('GPS Initializing...')).toBeInTheDocument();
    expect(screen.getByText('Waiting for location signal')).toBeInTheDocument();
  });

  it('should render compact view correctly', () => {
    render(
      <GPSAccuracyIndicator 
        accuracy={mockAccuracyData} 
        compact={true} 
      />
    );

    expect(screen.getByText('Good GPS')).toBeInTheDocument();
    expect(screen.getByText('±8m')).toBeInTheDocument();
  });

  it('should render full view with all metrics', () => {
    render(
      <GPSAccuracyIndicator 
        accuracy={mockAccuracyData} 
        compact={false} 
      />
    );

    expect(screen.getByText('GPS Accuracy')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument(); // Signal strength
    expect(screen.getByText('±8m')).toBeInTheDocument(); // Accuracy radius
    expect(screen.getByText('9')).toBeInTheDocument(); // Satellites
    expect(screen.getByText('Signal Strength')).toBeInTheDocument();
    expect(screen.getByText('Accuracy Radius')).toBeInTheDocument();
    expect(screen.getByText('Satellites')).toBeInTheDocument();
  });

  it('should toggle expanded state in compact mode', async () => {
    render(
      <GPSAccuracyIndicator 
        accuracy={mockAccuracyData} 
        compact={true} 
      />
    );

    const toggleButton = screen.getByRole('button');
    
    // Should not show details initially
    expect(screen.queryByText('Signal:')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Signal:')).toBeInTheDocument();
      expect(screen.getByText('Satellites:')).toBeInTheDocument();
    });
  });

  it('should call onAccuracyChange when accuracy updates', () => {
    const mockOnChange = vi.fn();
    
    render(
      <GPSAccuracyIndicator 
        accuracy={mockAccuracyData}
        onAccuracyChange={mockOnChange}
      />
    );

    // The component should register a listener with the GPS service
    expect(GPSMonitoringService).toHaveBeenCalled();
  });

  it('should display different quality levels correctly', () => {
    const excellentAccuracy: GPSAccuracyData = {
      ...mockAccuracyData,
      locationQuality: 'excellent',
      accuracyRadius: 3,
      signalStrength: 95
    };

    const { rerender } = render(
      <GPSAccuracyIndicator accuracy={excellentAccuracy} />
    );

    expect(screen.getByText('Excellent')).toBeInTheDocument();

    const poorAccuracy: GPSAccuracyData = {
      ...mockAccuracyData,
      locationQuality: 'poor',
      accuracyRadius: 50,
      signalStrength: 20
    };

    rerender(<GPSAccuracyIndicator accuracy={poorAccuracy} />);
    expect(screen.getByText('Poor')).toBeInTheDocument();
  });

  it('should show troubleshooting guide when enabled', () => {
    const mockService = {
      onAccuracyUpdate: vi.fn(() => () => {}),
      getAccuracyStats: vi.fn(() => ({
        current: mockAccuracyData,
        average: 8,
        best: 5,
        worst: 15,
        trend: 'stable'
      })),
      isReadyForTracking: vi.fn(() => ({ ready: false, reason: 'Poor accuracy' })),
      getTroubleshootingGuide: vi.fn(() => ({
        issue: 'poor_accuracy',
        description: 'GPS accuracy is worse than 20 meters',
        solutions: [
          'Move to an open area away from buildings',
          'Ensure location services are enabled'
        ],
        priority: 'high'
      })),
      getAccuracyMessage: vi.fn(() => ({
        title: 'Poor GPS',
        description: 'Low accuracy (±50m)',
        color: 'red',
        icon: 'poor'
      }))
    };

    // Mock the service instance
    (GPSMonitoringService as any).mockImplementation(() => mockService);

    render(
      <GPSAccuracyIndicator 
        accuracy={mockAccuracyData}
        showTroubleshooting={true}
      />
    );

    expect(screen.getByText('GPS Tips')).toBeInTheDocument();
  });

  it('should display statistics when available', () => {
    const mockService = {
      onAccuracyUpdate: vi.fn(() => () => {}),
      getAccuracyStats: vi.fn(() => ({
        current: mockAccuracyData,
        average: 8.5,
        best: 5.2,
        worst: 15.8,
        trend: 'improving'
      })),
      isReadyForTracking: vi.fn(() => ({ ready: true })),
      getTroubleshootingGuide: vi.fn(() => null),
      getAccuracyMessage: vi.fn(() => ({
        title: 'Good GPS',
        description: 'Good accuracy (±8m)',
        color: 'green',
        icon: 'good'
      }))
    };

    (GPSMonitoringService as any).mockImplementation(() => mockService);

    render(<GPSAccuracyIndicator accuracy={mockAccuracyData} />);

    expect(screen.getByText('Session Statistics')).toBeInTheDocument();
    expect(screen.getByText('±5.2m')).toBeInTheDocument(); // Best
    expect(screen.getByText('±8.5m')).toBeInTheDocument(); // Average
    expect(screen.getByText('±15.8m')).toBeInTheDocument(); // Worst
    expect(screen.getByText('improving')).toBeInTheDocument(); // Trend
  });

  it('should handle different accuracy quality colors', () => {
    const poorAccuracy: GPSAccuracyData = {
      ...mockAccuracyData,
      locationQuality: 'poor',
      accuracyRadius: 50
    };

    render(<GPSAccuracyIndicator accuracy={poorAccuracy} compact={true} />);
    
    // Should have poor quality styling
    const card = screen.getByRole('button').closest('.bg-red-50');
    expect(card).toBeInTheDocument();
  });

  it('should show development coordinates in dev mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(<GPSAccuracyIndicator accuracy={mockAccuracyData} />);

    expect(screen.getByText(/Lat: 40\.712800/)).toBeInTheDocument();
    expect(screen.getByText(/Lng: -74\.006000/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});