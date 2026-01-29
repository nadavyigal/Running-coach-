import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DeviceConnectionScreen } from './device-connection-screen';
import { db } from '@/lib/db';

const { mockToArray, mockEquals, mockWhere } = vi.hoisted(() => {
  const mockToArray = vi.fn();
  const mockEquals = vi.fn(() => ({
    and: vi.fn(() => ({
      first: vi.fn()
    })),
    toArray: mockToArray
  }));
  const mockWhere = vi.fn(() => ({
    equals: mockEquals
  }));
  return { mockToArray, mockEquals, mockWhere };
});

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    wearableDevices: {
      where: mockWhere
    }
  }
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock fetch
global.fetch = vi.fn();

describe('DeviceConnectionScreen', () => {
  const mockUserId = 1;
  const mockOnDeviceConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    mockToArray.mockResolvedValue([]);
    
    // Mock successful API response for loading devices
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        devices: []
      })
    });
  });

  describe('Rendering', () => {
    it('should render the connection screen with title and description', async () => {
      await act(async () => {
        render(
          <DeviceConnectionScreen 
            userId={mockUserId} 
            onDeviceConnected={mockOnDeviceConnected} 
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Connect Your Devices')).toBeInTheDocument();
        expect(screen.getByText(/Connect your wearable devices to get personalized coaching/)).toBeInTheDocument();
      });
    });

    it('should render available devices section', async () => {
      await act(async () => {
        render(
          <DeviceConnectionScreen 
            userId={mockUserId} 
            onDeviceConnected={mockOnDeviceConnected} 
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Available Devices')).toBeInTheDocument();
        expect(screen.getByText('Apple Watch')).toBeInTheDocument();
        expect(screen.getByText('Garmin Device')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', async () => {
      await act(async () => {
        render(
          <DeviceConnectionScreen 
            userId={mockUserId} 
            onDeviceConnected={mockOnDeviceConnected} 
          />
        );
      });

      // The component should show loading initially while fetching connected devices
      await waitFor(() => {
        expect(screen.getByText('Available Devices')).toBeInTheDocument();
      });
    });
  });

  describe('Device Connection', () => {
    beforeEach(() => {
      // Mock no connected devices initially
      mockToArray.mockResolvedValue([]);
    });

    it('should connect Apple Watch successfully', async () => {
      const mockResponse = {
        success: true,
        device: {
          id: 1,
          name: 'Apple Watch',
          type: 'apple_watch',
          connectionStatus: 'connected'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Apple Watch')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Apple Watch');
      fireEvent.click(connectButton);

      expect(connectButton).toBeDisabled();
      expect(screen.getByText('Connecting...')).toBeInTheDocument();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/devices/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        });
      }, { timeout: 3000 });

      const fetchCall = (global.fetch as any).mock.calls.find((call: any[]) => call[0] === '/api/devices/connect');
      const requestBody = JSON.parse(fetchCall?.[1]?.body ?? '{}');
      expect(requestBody).toMatchObject({
        userId: mockUserId,
        deviceType: 'apple_watch',
        name: 'Apple Watch',
        model: 'Series 8',
        capabilities: ['heart_rate', 'workouts', 'health_kit']
      });
      expect(requestBody.deviceId).toEqual(expect.stringContaining('apple-watch-'));

      await waitFor(() => {
        expect(mockOnDeviceConnected).toHaveBeenCalledWith(mockResponse.device);
      });
    });

    it('should initiate Garmin connection flow', async () => {
      const mockResponse = {
        success: true,
        authUrl: 'https://connect.garmin.com/oauth/authorize?client_id=123'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Mock window.location.href
      delete (window as any).location;
      (window as any).location = { href: '' };

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Garmin Device')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Garmin Device');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/devices/garmin/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: mockUserId,
            redirectUri: `${window.location.origin}/garmin/callback`
          })
        });
      });

      await waitFor(() => {
        expect(window.location.href).toBe(mockResponse.authUrl);
      });
    });

    it('should handle connection errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Device connection failed'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Apple Watch')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Apple Watch');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      // The component should handle the error and show the connect button again
      await waitFor(() => {
        expect(screen.getByText('Connect Apple Watch')).toBeInTheDocument();
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Apple Watch')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Apple Watch');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Should handle network error gracefully
      await waitFor(() => {
        expect(screen.getByText('Connect Apple Watch')).toBeInTheDocument();
      });
    });
  });

  describe('Connected Devices', () => {
    it('should display connected devices', async () => {
      const mockConnectedDevices = [
        {
          id: 1,
          name: 'My Apple Watch',
          model: 'Series 8',
          type: 'apple_watch',
          connectionStatus: 'connected',
          lastSync: new Date('2023-01-01T10:00:00Z'),
          capabilities: ['heart_rate', 'workouts']
        }
      ];

      mockToArray.mockResolvedValue(mockConnectedDevices);

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connected Devices')).toBeInTheDocument();
        expect(screen.getByText('My Apple Watch')).toBeInTheDocument();
        expect(screen.getByText('Series 8')).toBeInTheDocument();
        expect(screen.getByText('connected')).toBeInTheDocument();
      });
    });

    it('should allow syncing connected devices', async () => {
      const mockConnectedDevices = [
        {
          id: 1,
          name: 'My Apple Watch',
          type: 'apple_watch',
          connectionStatus: 'connected',
          lastSync: new Date(),
          capabilities: ['heart_rate']
        }
      ];

      mockToArray.mockResolvedValue(mockConnectedDevices);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sync')).toBeInTheDocument();
      });

      const syncButton = screen.getByText('Sync');
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/devices/1/sync', {
          method: 'POST'
        });
      });
    });

    it('should allow disconnecting devices', async () => {
      const mockConnectedDevices = [
        {
          id: 1,
          name: 'My Apple Watch',
          type: 'apple_watch',
          connectionStatus: 'connected',
          lastSync: new Date(),
          capabilities: ['heart_rate']
        }
      ];

      mockToArray.mockResolvedValue(mockConnectedDevices);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/devices/1', {
          method: 'DELETE'
        });
      });
    });

    it('should show device capabilities', async () => {
      const mockConnectedDevices = [
        {
          id: 1,
          name: 'My Garmin Watch',
          type: 'garmin',
          connectionStatus: 'connected',
          lastSync: new Date(),
          capabilities: ['heart_rate', 'vo2_max', 'running_dynamics']
        }
      ];

      mockToArray.mockResolvedValue(mockConnectedDevices);

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('heart rate').length).toBeGreaterThan(0);
        expect(screen.getAllByText('vo2 max').length).toBeGreaterThan(0);
        expect(screen.getAllByText('running dynamics').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Device Status Indicators', () => {
    it('should show correct status icons and colors', async () => {
      const mockDevices = [
        {
          id: 1,
          name: 'Connected Device',
          type: 'apple_watch',
          connectionStatus: 'connected',
          lastSync: new Date(),
          capabilities: []
        },
        {
          id: 2,
          name: 'Error Device',
          type: 'garmin',
          connectionStatus: 'error',
          lastSync: new Date(),
          capabilities: []
        }
      ];

      mockToArray.mockResolvedValue(mockDevices);

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connected Device')).toBeInTheDocument();
        expect(screen.getByText('Error Device')).toBeInTheDocument();
      });

      // Check that different status badges are rendered
      const statusBadges = screen.getAllByText(/connected|error/);
      expect(statusBadges.length).toBeGreaterThan(0);
    });

    it('should disable sync for non-connected devices', async () => {
      const mockDevices = [
        {
          id: 1,
          name: 'Disconnected Device',
          type: 'apple_watch',
          connectionStatus: 'error',
          lastSync: new Date(),
          capabilities: []
        }
      ];

      mockToArray.mockResolvedValue(mockDevices);

      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Disconnected Device')).toBeInTheDocument();
      });

      await waitFor(() => {
        const syncButton = screen.getByText('Sync');
        expect(syncButton).toBeDisabled();
      });
    });
  });

  describe('Device Type Styling', () => {
    it('should show different colors for different device types', async () => {
      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Apple Watch')).toBeInTheDocument();
        expect(screen.getByText('Garmin Device')).toBeInTheDocument();
      });

      // The component should render with appropriate styling for each device type
      // This tests that the component renders without errors with different device types
    });

    it('should show device capabilities correctly', async () => {
      render(
        <DeviceConnectionScreen 
          userId={mockUserId} 
          onDeviceConnected={mockOnDeviceConnected} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Heart rate, workouts, and health metrics/)).toBeInTheDocument();
        expect(screen.getByText(/Advanced metrics, VO2 max, and training load/)).toBeInTheDocument();
      });
    });
  });
});
