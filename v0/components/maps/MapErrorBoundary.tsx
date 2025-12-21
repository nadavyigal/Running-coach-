'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Map } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for map components
 * Prevents map errors from crashing the entire app or causing redirects
 */
export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[MapErrorBoundary] Map error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MapErrorBoundary] Map component error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Log to analytics if needed
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: `Map error: ${error.message}`,
          fatal: false,
        });
      }
    } catch {
      // Ignore analytics errors
    }
  }

  handleReset = () => {
    console.log('[MapErrorBoundary] Resetting map error state');
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackMessage = 'Unable to load map' } = this.props;
      const { error } = this.state;

      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center p-6 max-w-md">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Map className="h-16 w-16 text-gray-300" />
                <AlertCircle className="h-8 w-8 text-red-500 absolute -bottom-1 -right-1 bg-white rounded-full" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Map Unavailable
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              {fallbackMessage}. The map feature is temporarily unavailable.
            </p>

            {error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {error.toString()}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>

            <p className="text-xs text-gray-500 mt-4">
              You can continue using other features while we fix this.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
