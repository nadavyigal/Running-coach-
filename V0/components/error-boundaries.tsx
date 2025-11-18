import React from 'react';
import { analyzeError } from '@/lib/errorHandling';

// Error logging interface
interface ErrorLogData {
  error: Error;
  errorInfo?: React.ErrorInfo;
  componentStack?: string;
  timestamp: string;
  userId?: number;
  sessionId?: string;
}

// Error ID generation
const generateErrorId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Error categorization
const categorizeError = (error: Error): string => {
  if (error.message.includes('network')) return 'network';
  if (error.message.includes('validation')) return 'validation';
  if (error.message.includes('authentication')) return 'authentication';
  if (error.message.includes('authorization')) return 'authorization';
  if (error.message.includes('database')) return 'database';
  return 'application';
};

// Error severity determination
const determineSeverity = (error: Error): 'low' | 'medium' | 'high' | 'critical' => {
  if (error.message.includes('critical') || error.name === 'SecurityError') return 'critical';
  if (error.message.includes('network') || error.message.includes('timeout')) return 'high';
  if (error.message.includes('validation')) return 'medium';
  return 'low';
};

// Comprehensive error logging
export const logError = async (errorData: ErrorLogData): Promise<void> => {
  try {
    // Categorize error
    const category = categorizeError(errorData.error);
    
    // Prepare error log entry
    const logEntry = {
      id: generateErrorId(),
      category,
      severity: determineSeverity(errorData.error),
      message: errorData.error.message || 'Unknown error',
      stack: errorData.error.stack || '',
      componentStack: errorData.errorInfo?.componentStack || '',
      timestamp: errorData.timestamp,
      userId: errorData.userId,
      sessionId: errorData.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };

    // Send to error monitoring service (placeholder)
    console.error('Error logged:', logEntry);
    
    // Store locally for offline analysis
    if (typeof localStorage !== 'undefined') {
      const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingErrors.push(logEntry);
      // Keep only last 50 errors to prevent storage overflow
      const recentErrors = existingErrors.slice(-50);
      localStorage.setItem('error_logs', JSON.stringify(recentErrors));
    }
    
  } catch (loggingError) {
    // Fallback logging to console
    console.error('Error logging failed:', loggingError);
    console.error('Original error:', errorData);
  }
};

// Component-specific error logging
export const logComponentError = async (errorData: {
  componentName: string;
  error: Error;
  errorInfo: React.ErrorInfo;
}): Promise<void> => {
  await logError({
    error: errorData.error,
    errorInfo: errorData.errorInfo,
    componentStack: errorData.errorInfo.componentStack,
    timestamp: new Date().toISOString()
  });
};

// Error Fallback Components
interface ErrorFallbackProps {
  error: Error | undefined;
  onRetry: () => void;
}

export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const errorInfo = error ? analyzeError(error) : null;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
      <p className="text-red-700 text-center mb-4">
        {errorInfo?.userMessage || 'An unexpected error occurred. Please try again.'}
      </p>
      {errorInfo?.suggestedAction && (
        <p className="text-sm text-red-600 text-center mb-4">
          {errorInfo.suggestedAction}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
        {errorInfo?.fallbackOptions && errorInfo.fallbackOptions.length > 0 && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Refresh Page
          </button>
        )}
      </div>
    </div>
  );
};

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  return <DefaultErrorFallback error={error} onRetry={onRetry} />;
};

// Global Error Boundary Component
interface GlobalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  GlobalErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { 
      hasError: true, 
      error,
      errorId: generateErrorId()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('Global error boundary caught error:', error, errorInfo);
    
    // Send to error monitoring service
    logError({
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full mx-4">
            <ErrorFallback
              error={this.state.error}
              onRetry={this.handleRetry}
            />
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-4 bg-gray-100 rounded border">
                <summary className="cursor-pointer font-medium text-gray-700">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component-specific Error Boundary
interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error | undefined; onRetry: () => void }>;
  componentName?: string;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ComponentErrorBoundary extends React.Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log component-specific error
    logComponentError({
      componentName: this.props.componentName || this.constructor.name,
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// Hook for error handling in functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    logError({
      error,
      errorInfo,
      timestamp: new Date().toISOString()
    });
  }, []);

  return handleError;
};

// Higher-order component for adding error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error | undefined; onRetry: () => void }>
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ComponentErrorBoundary 
      fallback={fallback}
      componentName={Component.displayName || Component.name}
    >
      <Component {...props} ref={ref} />
    </ComponentErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
