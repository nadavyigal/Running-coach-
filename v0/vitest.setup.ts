import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { configure, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundaryAssertions } from './lib/test-utils';
import './lib/mapLibreMock';
import { rateLimiter } from './lib/security.config';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

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

const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
const nativeSetInterval = globalThis.setInterval;
const nativeClearInterval = globalThis.clearInterval;

// Configure React Testing Library for fast testing
configure({ 
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 2000
});

if (typeof document !== 'undefined' && !document.body) {
  const body = document.createElement('body');
  document.documentElement?.appendChild(body);
}

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
  
  // Mock window properties needed for performance monitoring
  const mockPerformance = {
    now: vi.fn().mockReturnValue(Date.now()),
    getEntriesByType: vi.fn().mockReturnValue([]),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 200 * 1024 * 1024,
    },
  } as Performance & {
    memory: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  Object.defineProperty(window, 'performance', {
    configurable: true,
    writable: true,
    value: mockPerformance,
  });

  if (!globalThis.performance || typeof globalThis.performance.now !== 'function') {
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      writable: true,
      value: mockPerformance,
    });
  }
  
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
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'font-inter' }),
  Bebas_Neue: () => ({ className: 'font-bebas' }),
  Manrope: () => ({ className: 'font-manrope' }),
}));

beforeEach(() => {
  if (typeof globalThis.setTimeout !== 'function' && nativeSetTimeout) {
    globalThis.setTimeout = nativeSetTimeout;
  }
  if (typeof globalThis.clearTimeout !== 'function' && nativeClearTimeout) {
    globalThis.clearTimeout = nativeClearTimeout;
  }
  if (typeof globalThis.setInterval !== 'function' && nativeSetInterval) {
    globalThis.setInterval = nativeSetInterval;
  }
  if (typeof globalThis.clearInterval !== 'function' && nativeClearInterval) {
    globalThis.clearInterval = nativeClearInterval;
  }

  vi.useRealTimers();
  vi.clearAllMocks();
  mockFetch.mockClear();
  rateLimiter.reset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// Make error boundary assertions globally available
(global as any).ErrorBoundaryAssertions = ErrorBoundaryAssertions;

// Enhanced error handling for uncaught errors in tests
// Guard against adding multiple listeners (fixes MaxListenersExceededWarning)
const UNHANDLED_REJECTION_HANDLER_KEY = '__vitest_unhandled_rejection_handler__';
const UNCAUGHT_EXCEPTION_HANDLER_KEY = '__vitest_uncaught_exception_handler__';

if (!(globalThis as any)[UNHANDLED_REJECTION_HANDLER_KEY]) {
  (globalThis as any)[UNHANDLED_REJECTION_HANDLER_KEY] = true;
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

if (!(globalThis as any)[UNCAUGHT_EXCEPTION_HANDLER_KEY]) {
  (globalThis as any)[UNCAUGHT_EXCEPTION_HANDLER_KEY] = true;
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });
}
