import React from 'react';
import { analyzeError } from '@/lib/errorHandling';

interface ErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
  onAction?: (action: () => void) => void;
}

// Network Error Fallback
export const NetworkErrorFallback: React.FC<ErrorFallbackProps> = ({ error: _error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="text-orange-600 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-orange-800 mb-2">Connection Problem</h3>
      <p className="text-orange-700 text-center mb-4 max-w-md">
        We&apos;re having trouble connecting to our servers. Please check your internet connection and try again.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Refresh Page
        </button>
      </div>
      <div className="mt-4 text-sm text-orange-600">
        <p>Still having issues? Try:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Check your internet connection</li>
          <li>Disable VPN if you&apos;re using one</li>
          <li>Clear your browser cache</li>
        </ul>
      </div>
    </div>
  );
};

// Database Error Fallback
export const DatabaseErrorFallback: React.FC<ErrorFallbackProps> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="text-blue-600 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-blue-800 mb-2">Data Sync Issue</h3>
      <p className="text-blue-700 text-center mb-4 max-w-md">
        We&apos;re having trouble saving your data right now. Don&apos;t worry - your progress will be saved when the connection is restored.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Try Again
        </button>
        <button
          onClick={() => {/* Continue offline */}}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Continue Offline
        </button>
      </div>
      <div className="mt-4 p-3 bg-blue-100 rounded-lg">
        <p className="text-sm text-blue-700">
          💡 Your data is stored locally and will sync automatically when the connection is restored.
        </p>
      </div>
    </div>
  );
};

// AI Service Error Fallback
export const AIServiceErrorFallback: React.FC<ErrorFallbackProps> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="text-purple-600 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-purple-800 mb-2">AI Assistant Unavailable</h3>
      <p className="text-purple-700 text-center mb-4 max-w-md">
        Our AI coaching assistant is temporarily unavailable. You can still use the guided form to create your training plan.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {/* Switch to guided form */}}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Use Guided Form
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Try AI Again
        </button>
      </div>
      <div className="mt-4 p-3 bg-purple-100 rounded-lg">
        <p className="text-sm text-purple-700">
          ✨ The guided form will help you create a personalized training plan step by step.
        </p>
      </div>
    </div>
  );
};

// Validation Error Fallback
export const ValidationErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const errorInfo = error ? analyzeError(error) : null;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="text-yellow-600 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Please Check Your Input</h3>
      <p className="text-yellow-700 text-center mb-4">
        {errorInfo?.userMessage || 'There seems to be an issue with the information provided.'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
};

// Offline Error Fallback
export const OfflineErrorFallback: React.FC<ErrorFallbackProps> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-gray-600 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2v6m0 8v6M2 12h6m8 0h6" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">You&apos;re Offline</h3>
      <p className="text-gray-700 text-center mb-4 max-w-md">
        You appear to be offline. Some features may not be available, but you can still view your existing data and continue training.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {/* Continue offline */}}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Continue Offline
        </button>
        <button
          onClick={() => {
            onRetry();
            window.location.reload();
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Check Connection
        </button>
      </div>
      <div className="mt-4 p-3 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-700">
          📱 Your training data is stored locally and will sync when you&apos;re back online.
        </p>
      </div>
    </div>
  );
};

// Generic Loading Error Fallback
export const LoadingErrorFallback: React.FC<ErrorFallbackProps> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 mb-4">Loading...</p>
      <button
        onClick={onRetry}
        className="text-blue-600 hover:text-blue-800 underline text-sm"
      >
        Retry
      </button>
    </div>
  );
};

// Error Fallback Factory - selects appropriate fallback based on error type
export const createErrorFallback = (errorType?: string): React.FC<ErrorFallbackProps> => {
  switch (errorType) {
    case 'network':
      return NetworkErrorFallback;
    case 'database':
      return DatabaseErrorFallback;
    case 'ai_service':
      return AIServiceErrorFallback;
    case 'validation':
      return ValidationErrorFallback;
    case 'offline':
      return OfflineErrorFallback;
    default:
      return NetworkErrorFallback; // Default fallback
  }
};

// Graceful Degradation Component
interface GracefulDegradationProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorTypes?: string[];
}

export const GracefulDegradation: React.FC<GracefulDegradationProps> = ({ 
  children, 
  fallback, 
  errorTypes = ['network', 'database', 'ai_service'] 
}) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    const errorInfo = analyzeError(error);
    if (errorTypes.includes(errorInfo.errorType)) {
      setError(error);
      setHasError(true);
    }
  }, [errorTypes]);

  const handleRetry = React.useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  React.useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      handleError(event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(new Error(event.reason));
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleError]);

  if (hasError && error) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    const errorInfo = analyzeError(error);
    const FallbackComponent = createErrorFallback(errorInfo.errorType);
    return <FallbackComponent error={error} onRetry={handleRetry} />;
  }

  return <>{children}</>;
};
