import React from 'react';
import { render, RenderOptions, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Error boundary for testing error scenarios
interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback: React.ComponentType<{ error: Error }>;
}

export class TestErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return React.createElement(FallbackComponent, { error: this.state.error });
    }

    return this.props.children;
  }
}

// Error boundary test utilities
export const createErrorBoundaryTest = (
  Component: React.ComponentType,
  props: any = {},
  options: {
    fallback?: React.ComponentType<{ error: Error }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  } = {}
) => {
  const ErrorFallback = options.fallback || (({ error }: { error: Error }) => (
    React.createElement('div', { 
      'data-testid': 'error-boundary',
      'role': 'alert'
    }, `Error occurred: ${error.message}`)
  ));

  return render(
    React.createElement(
      TestErrorBoundary,
      { fallback: ErrorFallback },
      React.createElement(Component, props)
    )
  );
};

// Error simulation utilities
export const ErrorSimulators = {
  renderError: (message = 'Render error occurred') => {
    const ErrorComponent = () => {
      throw new Error(message);
    };
    return ErrorComponent;
  },

  asyncError: async (message = 'Async operation failed') => {
    throw new Error(message);
  },

  networkError: (url = '/api/test', status = 500) => {
    const error = new Error(`Network request failed: ${status}`);
    (error as any).name = 'NetworkError';
    (error as any).url = url;
    (error as any).status = status;
    return error;
  },

  validationError: (field = 'testField', value = 'invalid') => {
    const error = new Error(`Validation failed for ${field}: ${value}`);
    (error as any).name = 'ValidationError';
    (error as any).field = field;
    (error as any).value = value;
    return error;
  },

  databaseError: (operation = 'query', table = 'users') => {
    const error = new Error(`Database ${operation} failed on ${table}`);
    (error as any).name = 'DatabaseError';
    (error as any).operation = operation;
    (error as any).table = table;
    return error;
  }
};

// Error boundary assertions
export const ErrorBoundaryAssertions = {
  expectErrorBoundaryToBeVisible: () => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
  },

  expectErrorMessage: (message: string) => {
    expect(screen.getByText(new RegExp(message, 'i'))).toBeInTheDocument();
  },

  expectRecovery: () => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  }
};

export const simulateError = (_component: HTMLElement, error: Error) => {
  const errorEvent = new ErrorEvent('error', { 
    error,
    message: error.message,
    filename: 'test',
    lineno: 1,
    colno: 1
  });
  window.dispatchEvent(errorEvent);
};

// Error recovery test helpers
export const ErrorRecoveryHelpers = {
  mockSuccessfulRetry: (fn: any) => {
    let callCount = 0;
    return vi.fn().mockImplementation((...args) => {
      callCount++;
      if (callCount === 1) {
        throw ErrorSimulators.networkError();
      }
      return fn(...args);
    });
  },

  mockEventualSuccess: (fn: any, failureCount = 2) => {
    let callCount = 0;
    return vi.fn().mockImplementation((...args) => {
      callCount++;
      if (callCount <= failureCount) {
        throw ErrorSimulators.networkError();
      }
      return fn(...args);
    });
  },

  mockPersistentFailure: (errorType = 'network') => {
    const errorMap = {
      network: ErrorSimulators.networkError(),
      validation: ErrorSimulators.validationError(),
      database: ErrorSimulators.databaseError()
    };
    
    return vi.fn().mockRejectedValue(errorMap[errorType as keyof typeof errorMap]);
  }
};

// Test data factories
export const createTestUser = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  preferredTimes: ['morning'],
  daysPerWeek: 3,
  consents: { data: true, gdpr: true, push: false },
  onboardingComplete: true,
  currentStreak: 5,
  cohortId: 1,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestWorkout = (overrides: Partial<any> = {}) => ({
  id: 1,
  planId: 1,
  userId: 1,
  type: 'run' as const,
  duration: 30,
  distance: 5,
  intensity: 'easy' as const,
  completed: false,
  scheduledDate: new Date('2023-01-01'),
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestPlan = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  name: 'Test Training Plan',
  description: 'A sample training plan for testing',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  daysPerWeek: 3,
  durationWeeks: 12,
  isActive: true,
  generatedByAI: true,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestRun = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  workoutId: 1,
  distance: 5.0,
  duration: 1800, // 30 minutes
  pace: 6.0, // minutes per km
  date: new Date('2023-01-01'),
  route: 'Test Route',
  notes: 'Great run!',
  weather: 'sunny',
  rpe: 6,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestBadge = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  type: 'streak' as const,
  level: 'bronze' as const,
  title: 'First Steps',
  description: 'Complete your first workout',
  iconName: 'trophy',
  unlockedAt: new Date('2023-01-01'),
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestChatMessage = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  message: 'Hello, how can I help you today?',
  isFromUser: false,
  phase: 'motivation' as const,
  timestamp: new Date('2023-01-01'),
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestCohort = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: 'Beginner Runners',
  description: 'A group for beginner runners',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  memberCount: 25,
  isActive: true,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestSleepData = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  date: new Date('2023-01-01'),
  hoursSlept: 8.0,
  sleepQuality: 8,
  bedtime: new Date('2023-01-01T22:00:00'),
  wakeTime: new Date('2023-01-02T06:00:00'),
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestHRVMeasurement = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  date: new Date('2023-01-01'),
  rmssd: 35.5,
  baseline: 40.0,
  status: 'normal' as const,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestRecoveryScore = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  date: new Date('2023-01-01'),
  score: 75.0,
  sleepScore: 80,
  hrvScore: 70,
  wellnessScore: 75,
  recommendation: 'normal' as const,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createTestSubjectiveWellness = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  date: new Date('2023-01-01'),
  energy: 7,
  mood: 8,
  motivation: 7,
  stress: 3,
  soreness: 2,
  overall: 7,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

// Mock reset utilities
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

// Custom render function with error boundary
export const renderWithErrorBoundary = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const ErrorFallback = ({ error }: { error: Error }) => (
    React.createElement('div', { 'data-testid': 'error-boundary' }, `Error: ${error.message}`)
  );

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      TestErrorBoundary,
      { fallback: ErrorFallback },
      children
    );

  return render(ui, { wrapper: Wrapper, ...options });
};

// Async test utilities
export const waitForAsyncOperation = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const createAsyncMock = <T = any>(
  resolveValue: T,
  delay: number = 0
): (() => Promise<T>) => {
  return vi.fn().mockImplementation(() => 
    new Promise(resolve => setTimeout(() => resolve(resolveValue), delay))
  );
};

export const createRejectedMock = <T = any>(
  error: Error,
  delay: number = 0
): (() => Promise<T>) => {
  return vi.fn().mockImplementation(() => 
    new Promise((_, reject) => setTimeout(() => reject(error), delay))
  );
};

// Network and connectivity test utilities
export const mockOnlineStatus = (isOnline: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: isOnline
  });
};

export const mockGeolocation = (
  latitude: number = 37.7749,
  longitude: number = -122.4194
) => {
  const mockGeolocation = {
    getCurrentPosition: vi.fn().mockImplementation((success) => {
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn()
  };

  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true
  });

  return mockGeolocation;
};

// Performance test utilities
// Use Date.now() directly for reliability in test environment
export const measurePerformance = (fn: () => Promise<void> | void): number | Promise<number> => {
  const start = Date.now();
  const result = fn();

  // Check if result is a Promise-like object
  if (result && typeof result === 'object' && typeof (result as Promise<void>).then === 'function') {
    return (result as Promise<void>).then(() => {
      const end = Date.now();
      const duration = end - start;
      return Number.isFinite(duration) ? duration : 0;
    });
  }

  const end = Date.now();
  const duration = end - start;
  return Number.isFinite(duration) ? duration : 0;
};

export const expectPerformance = async (
  fn: () => Promise<void> | void,
  maxTimeMs: number
) => {
  const result = measurePerformance(fn);
  const duration = typeof result === 'number' ? result : await result;
  expect(duration).toBeLessThan(maxTimeMs);
};

// Database test utilities
export const createMockDatabase = () => {
  const mockDb = {
    users: new Map(),
    plans: new Map(),
    workouts: new Map(),
    runs: new Map(),
    badges: new Map(),
    chatMessages: new Map(),
    cohorts: new Map(),
    sleepData: new Map(),
    hrvMeasurements: new Map(),
    recoveryScores: new Map(),
    subjectiveWellness: new Map()
  };

  return {
    mockDb,
    seedData: (tableName: string, data: any[]) => {
      const table = mockDb[tableName as keyof typeof mockDb];
      if (table instanceof Map) {
        data.forEach((item, index) => {
          table.set(item.id || index + 1, item);
        });
      }
    },
    clearData: () => {
      Object.values(mockDb).forEach(table => {
        if (table instanceof Map) {
          table.clear();
        }
      });
    }
  };
};
