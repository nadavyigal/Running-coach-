import { describe, it, expect, beforeEach } from 'vitest';
import { isDatabaseAvailable, safeDbOperation, getDatabase } from '../db';
import { initializeDatabase, getCurrentUser, upsertUser } from '../dbUtils';

// Mock window for testing
Object.defineProperty(globalThis, 'window', {
  value: {
    indexedDB: {
      open: () => ({}),
      deleteDatabase: () => ({})
    },
    navigator: {
      platform: 'test'
    }
  },
  writable: true
});

describe('Database Initialization', () => {
  beforeEach(() => {
    // Reset any cached database instances
    jest.clearAllMocks();
  });

  it('should initialize database successfully in browser environment', async () => {
    const result = await initializeDatabase();
    expect(result).toBe(true);
  });

  it('should check database availability correctly', () => {
    const isAvailable = isDatabaseAvailable();
    expect(typeof isAvailable).toBe('boolean');
  });

  it('should get database instance in browser environment', () => {
    const database = getDatabase();
    expect(database).toBeDefined();
  });

  it('should handle safe database operations with fallback', async () => {
    const result = await safeDbOperation(
      async () => {
        throw new Error('Test error');
      },
      'test_operation',
      'fallback_value'
    );
    
    expect(result).toBe('fallback_value');
  });

  it('should handle getCurrentUser safely', async () => {
    const user = await getCurrentUser();
    expect(user).toBeDefined(); // Should not throw
  });

  it('should handle upsertUser with minimal data', async () => {
    const userData = {
      goal: 'habit' as const,
      experience: 'beginner' as const,
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      onboardingComplete: false
    };

    const result = await upsertUser(userData);
    expect(typeof result).toBe('number');
  });
});

describe('Server-side behavior', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Mock server environment (no window)
    delete (globalThis as any).window;
  });

  afterEach(() => {
    // Restore window
    globalThis.window = originalWindow;
  });

  it('should return false for isDatabaseAvailable on server', () => {
    const isAvailable = isDatabaseAvailable();
    expect(isAvailable).toBe(false);
  });

  it('should return null for getDatabase on server', () => {
    const database = getDatabase();
    expect(database).toBe(null);
  });

  it('should handle initializeDatabase gracefully on server', async () => {
    const result = await initializeDatabase();
    expect(result).toBe(true); // Should return true to not block server
  });

  it('should handle safe operations with fallback on server', async () => {
    const result = await safeDbOperation(
      async () => {
        return 'should not execute';
      },
      'test_operation',
      'server_fallback'
    );
    
    expect(result).toBe('server_fallback');
  });
});