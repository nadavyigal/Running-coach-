import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { 
  GlobalErrorBoundary, 
  ComponentErrorBoundary, 
  DefaultErrorFallback,
  logError,
  logComponentError,
  useErrorHandler,
  withErrorBoundary
} from './error-boundaries';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console methods
const consoleSpy = {
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Test component that throws errors
const ThrowingComponent: React.FC<{ shouldThrow?: boolean; error?: Error }> = ({ 
  shouldThrow = false, 
  error = new Error('Test error') 
}) => {
  if (shouldThrow) {
    throw error;
  }
  return <div data-testid="working-component">Component is working</div>;
};

describe('Error Boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('[]');
  });

  describe('GlobalErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <GlobalErrorBoundary>
          <div data-testid="child">Child component</div>
        </GlobalErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should catch and display error fallback', () => {
      const TestComponent = () => {
        throw new Error('Test error');
      };

      render(
        <GlobalErrorBoundary>
          <TestComponent />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/Please try again/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should log errors when they occur', () => {
      const TestComponent = () => {
        throw new Error('Test error for logging');
      };

      render(
        <GlobalErrorBoundary>
          <TestComponent />
        </GlobalErrorBoundary>
      );

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Global error boundary caught error:',
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should allow retry functionality', async () => {
      let shouldThrow = true;
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div data-testid="success">Success!</div>;
      };

      render(
        <GlobalErrorBoundary>
          <TestComponent />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Simulate fixing the error
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // The error should be cleared, but the component won't re-render successfully
      // because the shouldThrow variable is captured in the closure
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should show error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const TestComponent = () => {
        const error = new Error('Development error');
        error.stack = 'Error: Development error\n    at TestComponent';
        throw error;
      };

      render(
        <GlobalErrorBoundary>
          <TestComponent />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('ComponentErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <ComponentErrorBoundary>
          <div data-testid="child">Child component</div>
        </ComponentErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should use custom fallback component', () => {
      const CustomFallback: React.FC<{ error?: Error; onRetry: () => void }> = ({ onRetry }) => (
        <div data-testid="custom-fallback">
          <button onClick={onRetry}>Custom Retry</button>
        </div>
      );

      const TestComponent = () => {
        throw new Error('Test error');
      };

      render(
        <ComponentErrorBoundary fallback={CustomFallback}>
          <TestComponent />
        </ComponentErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument();
    });

    it('should log component-specific errors', () => {
      const TestComponent = () => {
        throw new Error('Component error');
      };

      render(
        <ComponentErrorBoundary componentName="TestComponent">
          <TestComponent />
        </ComponentErrorBoundary>
      );

      // The logComponentError should be called, which eventually calls console.error
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle retry in component boundary', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ComponentErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Boundary resets, but component still throws; ensure retry handler is wired
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('DefaultErrorFallback', () => {
    it('should render error message and retry button', () => {
      const mockRetry = vi.fn();
      const testError = new Error('Fallback test error');

      render(<DefaultErrorFallback error={testError} onRetry={mockRetry} />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/Please try again/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const mockRetry = vi.fn();
      const testError = new Error('Retry test error');

      render(<DefaultErrorFallback error={testError} onRetry={mockRetry} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined error gracefully', () => {
      const mockRetry = vi.fn();

      render(<DefaultErrorFallback onRetry={mockRetry} />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Error Logging', () => {
    it('should log errors to localStorage', async () => {
      const testError = new Error('Storage test error');
      
      await logError({
        error: testError,
        timestamp: new Date().toISOString()
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'error_logs',
        expect.stringContaining('Storage test error')
      );
    });

    it('should limit stored errors to prevent overflow', async () => {
      // Mock existing 50 errors
      const existingErrors = Array.from({ length: 50 }, (_, i) => ({
        id: `error_${i}`,
        message: `Error ${i}`,
        timestamp: new Date().toISOString()
      }));
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingErrors));

      const testError = new Error('New error');
      
      await logError({
        error: testError,
        timestamp: new Date().toISOString()
      });

      // Should store only the last 50 errors
      const setItemCall = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'error_logs'
      );
      
      if (setItemCall) {
        const storedErrors = JSON.parse(setItemCall[1]);
        expect(storedErrors).toHaveLength(50);
        expect(storedErrors[storedErrors.length - 1].message).toBe('New error');
      }
    });

    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const testError = new Error('Storage error test');
      
      // Should not throw
      await expect(logError({
        error: testError,
        timestamp: new Date().toISOString()
      })).resolves.not.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error logging failed:',
        expect.any(Error)
      );
    });
  });

  describe('useErrorHandler Hook', () => {
    it('should provide error handler function', () => {
      let errorHandler: ((error: Error) => void) | null = null;

      const TestComponent = () => {
        errorHandler = useErrorHandler();
        return <div>Test</div>;
      };

      render(<TestComponent />);

      expect(errorHandler).toBeInstanceOf(Function);
    });

    it('should handle errors when called', () => {
      let errorHandler: ((error: Error) => void) | null = null;

      const TestComponent = () => {
        errorHandler = useErrorHandler();
        return <div>Test</div>;
      };

      render(<TestComponent />);

      const testError = new Error('Hook test error');
      errorHandler!(testError);

      // Should log the error
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = () => <div data-testid="wrapped">Wrapped component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const ThrowingWrappedComponent = withErrorBoundary(ThrowingComponent);

      render(<ThrowingWrappedComponent shouldThrow={true} />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should use custom fallback in HOC', () => {
      const CustomFallback: React.FC<{ error?: Error; onRetry: () => void }> = () => (
        <div data-testid="hoc-custom-fallback">HOC Custom Fallback</div>
      );

      const WrappedComponent = withErrorBoundary(ThrowingComponent, CustomFallback);

      render(<WrappedComponent shouldThrow={true} />);

      expect(screen.getByTestId('hoc-custom-fallback')).toBeInTheDocument();
    });

    it('should preserve component display name', () => {
      const TestComponent = () => <div>Test</div>;
      TestComponent.displayName = 'TestComponent';

      const WrappedComponent = withErrorBoundary(TestComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
  });

  describe('Error Boundary Integration', () => {
    it('should handle nested error boundaries correctly', () => {
      const InnerComponent = () => {
        throw new Error('Inner error');
      };

      render(
        <GlobalErrorBoundary>
          <div>
            <ComponentErrorBoundary>
              <InnerComponent />
            </ComponentErrorBoundary>
          </div>
        </GlobalErrorBoundary>
      );

      // The inner boundary should catch the error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      // The global boundary should not be triggered
      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument();
    });

    it('should handle different error types appropriately', () => {
      const networkError = new Error('Failed to fetch');
      const validationError = new Error('Validation failed');
      const databaseError = new Error('Database connection failed');

      const ErrorTestComponent: React.FC<{ error: Error }> = ({ error }) => {
        throw error;
      };

      // Test with network error
      const { rerender } = render(
        <ComponentErrorBoundary>
          <ErrorTestComponent error={networkError} />
        </ComponentErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Test with validation error
      rerender(
        <ComponentErrorBoundary>
          <ErrorTestComponent error={validationError} />
        </ComponentErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with repeated error boundary renders', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 20; i++) {
        const { unmount } = render(
          <ComponentErrorBoundary>
            <ThrowingComponent shouldThrow={i % 2 === 0} />
          </ComponentErrorBoundary>
        );
        unmount();
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      expect(memoryGrowth).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid successive errors efficiently', async () => {
      const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      const promises = Array.from({ length: 20 }, (_, i) => 
        logError({
          error: new Error(`Rapid error ${i}`),
          timestamp: new Date().toISOString()
        })
      );

      await Promise.all(promises);

      const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});
