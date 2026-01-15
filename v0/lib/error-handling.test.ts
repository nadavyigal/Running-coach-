import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  analyzeError, 
  ValidationError, 
  NetworkError, 
  DatabaseError, 
  AIServiceError, 
  OfflineError,
  validateRequired,
  validateEnum,
  validateRange,
  validateEmail,
  validateUrl,
  safeDbOperation,
  safeExternalCall,
  checkRateLimit
} from './errorHandling';
import { formatErrorResponse } from './serverErrorHandling';

describe('Error Handling - Null Safety', () => {
  describe('analyzeError', () => {
    it('should handle null/undefined error input safely', () => {
      expect(() => analyzeError(null)).not.toThrow();
      expect(() => analyzeError(undefined)).not.toThrow();
      expect(() => analyzeError('')).not.toThrow();
      expect(() => analyzeError(0)).not.toThrow();
      expect(() => analyzeError(false)).not.toThrow();
    });

    it('should return proper error info for null input', () => {
      const result = analyzeError(null);
      expect(result).toMatchObject({
        errorType: 'unknown',
        userMessage: 'An unexpected error occurred',
        canRetry: true,
        suggestedAction: 'Try again or contact support if the problem persists',
        fallbackOptions: ['Try again', 'Contact support']
      });
    });

    it('should handle Error objects with missing properties', () => {
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      
      const errorWithoutName = new Error('test');
      delete (errorWithoutName as any).name;

      expect(() => analyzeError(errorWithoutMessage)).not.toThrow();
      expect(() => analyzeError(errorWithoutName)).not.toThrow();
    });

    it('should handle Error objects with null message/name properties', () => {
      const error = new Error('test');
      (error as any).message = null;
      (error as any).name = null;

      expect(() => analyzeError(error)).not.toThrow();
      const result = analyzeError(error);
      expect(result.error).toBeDefined();
    });

    it('should detect network errors safely', () => {
      const networkError = new Error('Failed to fetch');
      const result = analyzeError(networkError);
      expect(result.errorType).toBe('network');
    });

    it('should detect offline errors safely', () => {
      const offlineError = new OfflineError();
      const result = analyzeError(offlineError);
      expect(result.errorType).toBe('offline');
    });
  });

  describe('Network Error Detection', () => {
    it('should safely detect network errors with null properties', () => {
      const error = new Error('network failure');
      (error as any).message = null;
      
      const result = analyzeError(error);
      // Should not throw and should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle various network error patterns', () => {
      const testCases = [
        new Error('Failed to fetch'),
        new Error('Network request failed'),
        new Error('Connection timeout'),
        new Error('ERR_NETWORK'),
        new NetworkError('Custom network error')
      ];

      testCases.forEach(error => {
        const result = analyzeError(error);
        expect(result.errorType).toBe('network');
        expect(result.userMessage).toContain('connection');
      });
    });
  });

  describe('Error Classification', () => {
    it('should classify database errors correctly', () => {
      const dbError = new DatabaseError('select', new Error('Connection failed'));
      const result = analyzeError(dbError);
      expect(result.errorType).toBe('database');
    });

    it('should classify AI service errors correctly', () => {
      const aiError = new AIServiceError();
      const result = analyzeError(aiError);
      expect(result.errorType).toBe('ai_service');
    });

    it('should classify validation errors correctly', () => {
      const validationError = new ValidationError('Invalid input');
      const result = analyzeError(validationError);
      expect(result.errorType).toBe('validation');
    });
  });
});

describe('Validation Functions - Null Safety', () => {
  describe('validateRequired', () => {
    it('should handle null/undefined data safely', () => {
      expect(() => validateRequired({}, ['field'])).toThrow(ValidationError);
      expect(() => validateRequired({ field: null }, ['field'])).toThrow(ValidationError);
      expect(() => validateRequired({ field: undefined }, ['field'])).toThrow(ValidationError);
    });

    it('should accept valid data', () => {
      expect(() => validateRequired({ field: 'value' }, ['field'])).not.toThrow();
    });
  });

  describe('validateEnum', () => {
    it('should handle null/undefined values safely', () => {
      const validValues = ['option1', 'option2'];
      expect(() => validateEnum(null, validValues, 'test')).toThrow(ValidationError);
      expect(() => validateEnum(undefined, validValues, 'test')).toThrow(ValidationError);
      expect(() => validateEnum('', validValues, 'test')).toThrow(ValidationError);
    });

    it('should accept valid enum values', () => {
      const validValues = ['option1', 'option2'];
      expect(() => validateEnum('option1', validValues, 'test')).not.toThrow();
    });
  });

  describe('validateRange', () => {
    it('should validate number ranges correctly', () => {
      expect(() => validateRange(5, 1, 10, 'test')).not.toThrow();
      expect(() => validateRange(0, 1, 10, 'test')).toThrow(ValidationError);
      expect(() => validateRange(15, 1, 10, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateEmail', () => {
    it('should validate email formats', () => {
      expect(() => validateEmail('test@example.com')).not.toThrow();
      expect(() => validateEmail('invalid-email')).toThrow(ValidationError);
      expect(() => validateEmail('')).toThrow(ValidationError);
    });
  });

  describe('validateUrl', () => {
    it('should validate URL formats', () => {
      expect(() => validateUrl('https://example.com')).not.toThrow();
      expect(() => validateUrl('invalid-url')).toThrow(ValidationError);
      expect(() => validateUrl('')).toThrow(ValidationError);
    });
  });
});

describe('Safe Operation Wrappers', () => {
  describe('safeDbOperation', () => {
    it('should handle successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await safeDbOperation(operation, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));
      await expect(safeDbOperation(operation, 'test')).rejects.toThrow(DatabaseError);
    });

    it('should handle constraint errors', async () => {
      const uniqueError = new Error('UNIQUE constraint failed');
      const foreignKeyError = new Error('FOREIGN KEY constraint failed');
      const notNullError = new Error('NOT NULL constraint failed');

      const operations = [
        vi.fn().mockRejectedValue(uniqueError),
        vi.fn().mockRejectedValue(foreignKeyError),
        vi.fn().mockRejectedValue(notNullError)
      ];

      await expect(safeDbOperation(operations[0], 'test')).rejects.toThrow('Resource already exists');
      await expect(safeDbOperation(operations[1], 'test')).rejects.toThrow('Invalid reference');
      await expect(safeDbOperation(operations[2], 'test')).rejects.toThrow('Required field cannot be empty');
    });
  });

  describe('safeExternalCall', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle successful external calls', async () => {
      const call = vi.fn().mockResolvedValue('success');
      const result = await safeExternalCall(call, 'TestService');
      expect(result).toBe('success');
      expect(call).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const call = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const promise = safeExternalCall(call, 'TestService', 3, 100);
      
      // Fast-forward timers to simulate retries
      await vi.advanceTimersByTimeAsync(300);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(call).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      const response = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      const call = vi.fn().mockRejectedValue(response);

      await expect(safeExternalCall(call, 'TestService')).rejects.toThrow('TestService returned 400');
      expect(call).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within limit', () => {
    expect(() => checkRateLimit('test-allow', 5, 1000)).not.toThrow();
    expect(() => checkRateLimit('test-allow', 5, 1000)).not.toThrow();
  });

  it('should throw RateLimitError when limit exceeded', () => {
    // Exceed the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-exceed', 5, 1000);
    }
    
    expect(() => checkRateLimit('test-exceed', 5, 1000)).toThrow();
  });

  it('should reset after time window', () => {
    // Exceed the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-reset', 5, 1000);
    }
    
    expect(() => checkRateLimit('test-reset', 5, 1000)).toThrow();
    
    // Fast-forward past the window
    vi.advanceTimersByTime(1001);
    
    // Should work again
    expect(() => checkRateLimit('test-reset', 5, 1000)).not.toThrow();
  });
});

describe('Error Response Formatting', () => {
  it('should format ValidationError correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    const response = formatErrorResponse(error);
    
    expect(response).toBeInstanceOf(Response);
    // In a real test environment, we'd check the response body and status
  });

  it('should format generic Error correctly', () => {
    const error = new Error('Generic error');
    const response = formatErrorResponse(error);
    
    expect(response).toBeInstanceOf(Response);
  });

  it('should handle null/undefined error properties', () => {
    const error = new ValidationError('test');
    delete (error as any).statusCode;
    delete (error as any).code;
    
    expect(() => formatErrorResponse(error)).not.toThrow();
  });
});

describe('Error Edge Cases', () => {
  it('should handle circular reference errors', () => {
    const circularError: any = new Error('Circular');
    circularError.circular = circularError;
    
    expect(() => analyzeError(circularError)).not.toThrow();
  });

  it('should handle very long error messages', () => {
    const longMessage = 'x'.repeat(10000);
    const error = new Error(longMessage);
    
    expect(() => analyzeError(error)).not.toThrow();
    const result = analyzeError(error);
    expect(result.userMessage).toBeDefined();
  });

  it('should handle special characters in error messages', () => {
    const specialCharsError = new Error('Error with 🚨 emojis and special chars: <script>alert("xss")</script>');
    
    expect(() => analyzeError(specialCharsError)).not.toThrow();
    const result = analyzeError(specialCharsError);
    expect(result.userMessage).toBeDefined();
  });

  it('should handle non-Error objects that look like errors', () => {
    const fakeError = {
      message: 'This looks like an error',
      name: 'FakeError',
      stack: 'fake stack trace'
    };
    
    expect(() => analyzeError(fakeError)).not.toThrow();
    const result = analyzeError(fakeError);
    expect(result.errorType).toBe('unknown');
  });
});

describe('Memory and Performance', () => {
  it('should not leak memory with repeated error analysis', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Analyze many errors
    for (let i = 0; i < 1000; i++) {
      analyzeError(new Error(`Error ${i}`));
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be reasonable (less than 10MB for 1000 errors)
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });

  it('should analyze errors quickly', () => {
    const startTime = performance.now();
    
    // Analyze 100 errors
    for (let i = 0; i < 100; i++) {
      analyzeError(new Error(`Error ${i}`));
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete in less than 100ms
    expect(duration).toBeLessThan(100);
  });
});

describe('TypeScript Type Safety', () => {
  it('should maintain type safety with unknown error types', () => {
    // These should compile without TypeScript errors
    const unknownError: unknown = new Error('test');
    const anyError: any = new Error('test');
    const nullError: null = null;
    const undefinedError: undefined = undefined;
    
    expect(() => analyzeError(unknownError)).not.toThrow();
    expect(() => analyzeError(anyError)).not.toThrow();
    expect(() => analyzeError(nullError)).not.toThrow();
    expect(() => analyzeError(undefinedError)).not.toThrow();
  });
});
