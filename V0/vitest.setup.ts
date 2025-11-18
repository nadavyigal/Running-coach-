import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { configure, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundaryAssertions } from './lib/test-utils';

// Mock URL constructor for relative URLs in tests
const OriginalURL = global.URL;
global.URL = class MockURL extends OriginalURL {
  constructor(url: string | URL, base?: string | URL) {
    // Handle relative URLs in test environment
    if (typeof url === 'string' && url.startsWith('/') && !base) {
      super(url, 'http://localhost:3000');
    } else {
      super(url, base);
    }
  }
} as any;

// Configure React Testing Library for fast testing
configure({ 
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 2000,
  // This suppresses the act warnings - we handle async properly in our tests
  suppressHydrationWarnings: true
});

// Mock global fetch to handle API calls in tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Default fetch mock implementation
mockFetch.mockImplementation((url: string | URL, options?: RequestInit) => {
  let urlString: string;
  if (typeof url === 'string') {
    // Handle relative URLs by adding base URL
    urlString = url.startsWith('/') ? `http://localhost:3000${url}` : url;
  } else {
    urlString = url.href;
  }
  
  // Mock API responses based on URL patterns - Enhanced with all recovery endpoints
  if (urlString.includes('/api/recovery/recommendations')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        recommendations: [
          'Get more sleep to improve recovery',
          'Stay hydrated throughout the day',
          'Consider a light stretching session',
          'Monitor your heart rate variability'
        ],
        recoveryScore: 75,
        confidence: 85
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  if (urlString.includes('/api/recovery/score')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        id: 1,
        userId: 1,
        date: new Date().toISOString(),
        overallScore: 85,
        sleepScore: 90,
        hrvScore: 80,
        restingHRScore: 75,
        subjectiveWellnessScore: 85,
        trainingLoadImpact: -5,
        stressLevel: 30,
        recommendations: [
          'Your recovery looks good today',
          'Consider a moderate intensity workout'
        ],
        confidence: 85,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  if (urlString.includes('/api/recovery/trends')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        trends: [
          { 
            id: 1,
            userId: 1,
            date: '2025-07-20', 
            overallScore: 82,
            sleepScore: 80,
            hrvScore: 85,
            restingHRScore: 70,
            recommendations: ['Good recovery trend'],
            confidence: 80,
            trainingLoadImpact: -3,
            createdAt: '2025-07-20T00:00:00Z',
            updatedAt: '2025-07-20T00:00:00Z'
          },
          { 
            id: 2,
            userId: 1,
            date: '2025-07-21', 
            overallScore: 85,
            sleepScore: 85,
            hrvScore: 88,
            restingHRScore: 72,
            recommendations: ['Excellent recovery'],
            confidence: 85,
            trainingLoadImpact: -2,
            createdAt: '2025-07-21T00:00:00Z',
            updatedAt: '2025-07-21T00:00:00Z'
          },
          { 
            id: 3,
            userId: 1,
            date: '2025-07-22', 
            overallScore: 88,
            sleepScore: 90,
            hrvScore: 85,
            restingHRScore: 68,
            recommendations: ['Peak recovery state'],
            confidence: 90,
            trainingLoadImpact: -1,
            createdAt: '2025-07-22T00:00:00Z',
            updatedAt: '2025-07-22T00:00:00Z'
          }
        ],
        stats: {
          overall: { avg: 85, min: 80, max: 90, trend: 'improving' },
          sleep: { avg: 85, min: 80, max: 90, trend: 'stable' },
          hrv: { avg: 86, min: 80, max: 88, trend: 'improving' },
          restingHR: { avg: 70, min: 68, max: 72, trend: 'stable' }
        },
        period: '30 days'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  if (urlString.includes('/api/recovery/wellness')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        id: 1,
        userId: 1,
        date: new Date().toISOString(),
        energyLevel: 8,
        moodScore: 7,
        sorenessLevel: 3,
        stressLevel: 4,
        motivationLevel: 9,
        notes: 'Feeling great today!',
        createdAt: new Date().toISOString()
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  if (urlString.includes('/api/chat')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        response: 'Mock AI response'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Device sync endpoints
  if (urlString.includes('/api/devices/') && urlString.includes('/sync')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        syncStatus: 'completed',
        lastSyncTime: new Date().toISOString(),
        recordsProcessed: 10
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Background sync endpoints
  if (urlString.includes('/api/sync/jobs')) {
    if (options?.method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        data: {
          jobId: 'job-123',
          status: 'queued',
          createdAt: new Date().toISOString()
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } else {
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        data: [
          {
            id: 'job-123',
            status: 'completed',
            deviceId: 'device-1',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            recordsProcessed: 5
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
  }
  
  // Coaching feedback endpoints
  if (urlString.includes('/api/coaching/feedback')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        id: 1,
        feedback: 'Great job!',
        timestamp: new Date().toISOString()
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Generate plan endpoint
  if (urlString.includes('/api/generate-plan')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        id: 1,
        name: 'Test Training Plan',
        duration: 12,
        workouts: []
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Onboarding endpoints
  if (urlString.includes('/api/onboarding')) {
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        step: 'complete',
        progress: 100
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Default mock response
  return Promise.resolve(new Response(JSON.stringify({
    success: true,
    data: {}
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
});

// Mock DOM objects and methods
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}));

if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.addEventListener for performance monitoring
if (typeof window !== 'undefined') {
  window.addEventListener = vi.fn();
  window.removeEventListener = vi.fn();
  window.dispatchEvent = vi.fn();
  
  // Mock window properties needed for performance monitoring
  Object.defineProperty(window, 'performance', {
    writable: true,
    value: {
      getEntriesByType: vi.fn().mockReturnValue([]),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024,
      },
    },
  });
  
  Object.defineProperty(window, 'PerformanceObserver', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    })),
  });
}

// Suppress React act warnings in test environment
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: An update to') &&
    args[0].includes('was not wrapped in act')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Analytics Mock Configuration - Complete coverage of all exports
vi.mock("@/lib/analytics", () => ({
  // Core analytics functions
  trackAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
  trackOnboardingChatMessage: vi.fn().mockResolvedValue(undefined),
  trackConversationPhase: vi.fn().mockResolvedValue(undefined),
  trackAIGuidanceUsage: vi.fn().mockResolvedValue(undefined),
  trackOnboardingCompletion: vi.fn().mockResolvedValue(undefined),
  trackError: vi.fn().mockResolvedValue(undefined),
  
  // Event-specific tracking functions
  trackReminderEvent: vi.fn().mockResolvedValue(undefined),
  trackPlanAdjustmentEvent: vi.fn().mockResolvedValue(undefined),
  trackFeedbackEvent: vi.fn().mockResolvedValue(undefined),
  trackEngagementEvent: vi.fn().mockResolvedValue(undefined),
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
  
  // Action-specific tracking functions
  trackPlanSessionCompleted: vi.fn().mockResolvedValue(undefined),
  trackChatMessageSent: vi.fn().mockResolvedValue(undefined),
  trackRouteSelected: vi.fn().mockResolvedValue(undefined),
  trackReminderClicked: vi.fn().mockResolvedValue(undefined),
}));

// Error Handling Mock Configuration - Enhanced with null safety
vi.mock("@/lib/errorHandling", () => ({
  // Error analysis with proper null handling
  analyzeError: vi.fn().mockImplementation((error: unknown) => {
    // Handle null/undefined inputs safely
    if (!error || typeof error !== 'object') {
      return {
        error: new Error('Invalid error object provided'),
        errorType: 'unknown',
        userMessage: 'An unexpected error occurred',
        canRetry: true,
        suggestedAction: 'Try again or contact support if the problem persists',
        fallbackOptions: ['Try again', 'Contact support']
      };
    }
    
    // Return appropriate error info based on error type
    const errorObj = error as Error;
    if (errorObj.name === 'NetworkError' || errorObj.message?.includes('network')) {
      return {
        error,
        errorType: 'network',
        userMessage: 'Network error occurred',
        canRetry: true,
        suggestedAction: 'Check your network connection and try again',
        fallbackOptions: ['Try again later', 'Check network settings']
      };
    }
    
    if (errorObj.name === 'ValidationError') {
      return {
        error,
        errorType: 'validation',
        userMessage: 'Please check your input and try again',
        canRetry: false,
        suggestedAction: 'Please correct the highlighted fields',
        fallbackOptions: ['Review your input']
      };
    }
    
    return {
      error,
      errorType: 'unknown',
      userMessage: 'Something went wrong. Please try again.',
      canRetry: true,
      suggestedAction: 'Try again or contact support if the problem persists',
      fallbackOptions: ['Try again', 'Contact support']
    };
  }),
  
  // Network error detection
  isNetworkErrorClient: vi.fn().mockImplementation((error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Error;
    return errorObj.name === 'NetworkError' || errorObj.message?.includes('network') || false;
  }),
  
  // Error classes
  ValidationError: class MockValidationError extends Error {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    constructor(message: string, public details?: Record<string, unknown>) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  
  NotFoundError: class MockNotFoundError extends Error {
    statusCode = 404;
    code = 'NOT_FOUND';
    constructor(resource: string) {
      super(`${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  
  UnauthorizedError: class MockUnauthorizedError extends Error {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    constructor(message = 'Unauthorized access') {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
  
  NetworkError: class MockNetworkError extends Error {
    statusCode = 503;
    code = 'NETWORK_ERROR';
    constructor(message = 'Network connection failed') {
      super(message);
      this.name = 'NetworkError';
    }
  },
  
  OfflineError: class MockOfflineError extends Error {
    statusCode = 503;
    code = 'OFFLINE_ERROR';
    constructor(message = 'Application is offline') {
      super(message);
      this.name = 'OfflineError';
    }
  },
  
  AIServiceError: class MockAIServiceError extends Error {
    statusCode = 502;
    code = 'AI_SERVICE_ERROR';
    constructor(message = 'AI service is temporarily unavailable') {
      super(message);
      this.name = 'AIServiceError';
    }
  },
  
  DatabaseError: class MockDatabaseError extends Error {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    constructor(operation: string, originalError?: Error) {
      super(`Database ${operation} failed`);
      this.name = 'DatabaseError';
      this.details = { originalError: originalError?.message };
    }
  },
  
  // Validation functions
  validateRequired: vi.fn().mockImplementation((data: Record<string, unknown>, fields: string[]) => {
    const missing = fields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }),
  
  validateEnum: vi.fn().mockImplementation((value: unknown, enumValues: string[], fieldName: string) => {
    if (typeof value !== 'string' || !enumValues.includes(value)) {
      throw new Error(`Invalid ${fieldName}. Must be one of: ${enumValues.join(', ')}`);
    }
  }),
  
  validateRange: vi.fn().mockImplementation((value: number, min: number, max: number, fieldName: string) => {
    if (value < min || value > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
  }),
  
  validateEmail: vi.fn().mockImplementation((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }),
  
  validateUrl: vi.fn().mockImplementation((url: string) => {
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }
  }),
  
  // Safe operation wrappers
  safeDbOperation: vi.fn().mockImplementation(async (operation: () => Promise<any>, operationName: string) => {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`Database ${operationName} failed`);
    }
  }),
  
  safeExternalCall: vi.fn().mockImplementation(async (call: () => Promise<any>, serviceName: string) => {
    try {
      return await call();
    } catch (error) {
      throw new Error(`External service ${serviceName} failed`);
    }
  }),
  
  // Rate limiting
  checkRateLimit: vi.fn().mockImplementation(() => {
    // Mock implementation - doesn't throw by default
  }),
  
  // Utility functions
  sanitizeInput: vi.fn().mockImplementation((input: string) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '').substring(0, 1000);
  }),
  
  sanitizeUserData: vi.fn().mockImplementation((data: unknown) => data),
  logRequest: vi.fn().mockImplementation(() => {}),
  performHealthCheck: vi.fn().mockResolvedValue({
    status: 'healthy',
    checks: { database: { status: 'up', responseTime: 50 } },
    timestamp: new Date().toISOString()
  }),
  
  // Client-side error handling utilities
  networkStatus: {
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    getStatus: vi.fn().mockReturnValue(true),
    checkConnectivity: vi.fn().mockResolvedValue(true)
  },
  
  offlineStorage: {
    saveData: vi.fn(),
    getData: vi.fn().mockReturnValue(null),
    markSynced: vi.fn(),
    getUnsyncedData: vi.fn().mockReturnValue({})
  },
  
  getRecoveryActions: vi.fn().mockReturnValue([
    { label: 'Try Again', action: vi.fn(), primary: true }
  ])
}));

// Server-only error handling utilities mock
vi.mock("@/lib/serverErrorHandling", () => ({
  formatErrorResponse: vi.fn().mockImplementation((error: any) => {
    const status = error?.statusCode || 500;
    const message = error?.message || 'Internal server error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: message,
      code: error?.code || 'INTERNAL_ERROR'
    }), { status, headers: { 'Content-Type': 'application/json' } });
  }),
  withErrorHandling: vi.fn().mockImplementation((handler: any) => handler),
}));

// Database Mock Configuration - Enhanced with comprehensive mocking
vi.mock("@/lib/db", () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    age: 30,
    experience: 'intermediate',
    goal: 'habit',
    daysPerWeek: 3,
    preferredTimes: ['morning'],
    consents: { data: true, gdpr: true, push: true },
    onboardingComplete: true,
    currentStreak: 5,
    longestStreak: 12,
    lastActivityDate: new Date('2025-01-14'),
    cohortId: 'cohort-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  };
  
  const mockPlan = {
    id: 1,
    userId: 1,
    name: 'Test Plan',
    type: 'beginner',
    duration: 12,
    workouts: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const createMockTable = (data: any[]) => ({
    toArray: vi.fn().mockResolvedValue(data),
    get: vi.fn().mockResolvedValue(data[0]),
    add: vi.fn().mockResolvedValue(1),
    put: vi.fn().mockResolvedValue(1),
    update: vi.fn().mockResolvedValue(1),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(data[0]),
    orderBy: vi.fn().mockReturnThis(),
    reverse: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue(data.length),
  });
  
  const mockDb = {
    users: createMockTable([mockUser]),
    plans: createMockTable([mockPlan]),
    workouts: createMockTable([]),
    runs: createMockTable([]),
    goals: createMockTable([]), // Add missing goals table
    chatMessages: createMockTable([]),
    conversationMessages: createMockTable([]),
    onboardingSessions: createMockTable([]),
    badges: createMockTable([]),
    cohorts: createMockTable([]), // Fix typo: should be cohorts
    cohortMembers: createMockTable([]), // Fix typo: should be cohortMembers
    syncJobs: createMockTable([]),
    wearableDevices: createMockTable([]),
    delete: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  };
  
  return {
    db: mockDb,
    
    dbUtils: {
      getCurrentUser: vi.fn().mockResolvedValue(mockUser),
      createUser: vi.fn().mockResolvedValue(1),
      updateUser: vi.fn().mockResolvedValue(1),
      createPlan: vi.fn().mockResolvedValue(mockPlan),
      updatePlan: vi.fn().mockResolvedValue(1),
      createWorkout: vi.fn().mockResolvedValue(1),
      createRun: vi.fn().mockResolvedValue(1),
      createChatMessage: vi.fn().mockResolvedValue(1),
      ensureCoachingTablesExist: vi.fn().mockResolvedValue(true),
      handlePlanError: vi.fn().mockReturnValue({
        title: 'Error',
        description: 'Something went wrong'
      }),
      clearDatabase: vi.fn().mockResolvedValue(undefined),
      calculateCurrentStreak: vi.fn().mockResolvedValue(0),
      updateUserStreak: vi.fn().mockResolvedValue(undefined),
      getStreakStats: vi.fn().mockResolvedValue({ currentStreak: 0, longestStreak: 0 }),
      normalizeDate: vi.fn(date => date),
      isSameDay: vi.fn(() => false),
      getDaysDifference: vi.fn(() => 0),
      markWorkoutCompleted: vi.fn().mockResolvedValue(undefined),
      getUserBadges: vi.fn().mockResolvedValue([]),
      deactivateAllUserPlans: vi.fn().mockResolvedValue(undefined),
      getRunsByUser: vi.fn().mockResolvedValue([]),
      getUserById: vi.fn().mockResolvedValue(mockUser),
      getCohortStats: vi.fn().mockResolvedValue({}),
    }
  };
});

// Geolocation API Mock
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// Mock Web APIs
Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: vi.fn().mockResolvedValue({ state: 'granted' })
  },
  writable: true,
});

// Setup before/after each test hooks for cleanup
beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
});

// Global test setup
vi.useFakeTimers();

// Make error boundary assertions globally available
global.ErrorBoundaryAssertions = ErrorBoundaryAssertions;

// Enhanced error handling for uncaught errors in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
