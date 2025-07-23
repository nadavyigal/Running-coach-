import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class OnboardingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in OnboardingErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
    // You can also log the error to an error reporting service here
    // logErrorToMyService(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return (
          <div>
            {this.props.fallback}
            <button onClick={this.handleReset}>Try again</button>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-4">
          <h1 className="text-2xl font-bold mb-4">Oops! Something went wrong.</h1>
          <p className="text-lg text-center mb-6">
            We're sorry, but an unexpected error occurred during the onboarding process.
            Please try again.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
          >
            Restart Onboarding
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-8 p-4 bg-red-100 dark:bg-red-900 rounded-lg text-sm text-red-700 dark:text-red-300 max-w-xl overflow-auto">
              <summary className="font-semibold cursor-pointer">Error Details (for developers)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.toString()}
                <br />
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default OnboardingErrorBoundary;
