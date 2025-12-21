// Error monitoring configuration
interface ErrorMonitoringConfig {
  apiEndpoint?: string;
  apiKey?: string;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  maxLocalErrors: number;
  enablePerformanceTracking: boolean;
  enableUserInteractionTracking: boolean;
}

const defaultConfig: ErrorMonitoringConfig = {
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableLocalStorage: true,
  maxLocalErrors: 100,
  enablePerformanceTracking: true,
  enableUserInteractionTracking: true,
};

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory = 
  | 'network' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'database' 
  | 'application' 
  | 'performance' 
  | 'security'
  | 'user_interaction';

// Enhanced error log entry
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  componentStack?: string;
  userId?: number;
  sessionId: string;
  userAgent: string;
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  performance?: {
    memoryUsage?: number;
    connectionType?: string;
    pageLoadTime?: number;
  };
  userContext?: {
    lastAction?: string;
    currentScreen?: string;
    breadcrumbs?: string[];
  };
  metadata?: Record<string, unknown>;
}

// Error monitoring class
export class ErrorMonitoringService {
  private config: ErrorMonitoringConfig;
  private sessionId: string;
  private breadcrumbs: string[] = [];
  private lastUserAction: string = '';
  private currentScreen: string = '';

  constructor(config: Partial<ErrorMonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
    this.initializeGlobalErrorHandlers();
    this.initializePerformanceTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Initialize global error handlers
  private initializeGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError(event.error || new Error(event.message), {
        category: 'application',
        severity: 'high',
        metadata: {
          fileName: event.filename,
          lineNumber: event.lineno,
          columnNumber: event.colno,
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(new Error(event.reason), {
        category: 'application',
        severity: 'high',
        metadata: {
          type: 'unhandled_promise_rejection',
          reason: event.reason,
        }
      });
    });

    // Handle network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.logError(new Error(`HTTP ${response.status}: ${response.statusText}`), {
            category: 'network',
            severity: this.getNetworkErrorSeverity(response.status),
            metadata: {
              url: args[0],
              status: response.status,
              statusText: response.statusText,
            }
          });
        }
        return response;
      } catch (error) {
        this.logError(error as Error, {
          category: 'network',
          severity: 'high',
          metadata: {
            url: args[0],
            type: 'fetch_error',
          }
        });
        throw error;
      }
    };
  }

  // Initialize performance tracking
  private initializePerformanceTracking(): void {
    if (!this.config.enablePerformanceTracking || typeof window === 'undefined') return;

    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (perfData) {
          const loadTime = perfData.loadEventEnd - perfData.navigationStart;
          if (loadTime > 5000) { // Alert on slow loads > 5s
            this.logError(new Error('Slow page load detected'), {
              category: 'performance',
              severity: 'medium',
              metadata: {
                loadTime,
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
                firstContentfulPaint: this.getFirstContentfulPaint(),
              }
            });
          }
        }
      }, 1000);
    });

    // Track memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          this.logError(new Error('High memory usage detected'), {
            category: 'performance',
            severity: 'high',
            metadata: {
              usedJSHeapSize: memory.usedJSHeapSize,
              jsHeapSizeLimit: memory.jsHeapSizeLimit,
              percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
            }
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private getFirstContentfulPaint(): number | undefined {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    return fcpEntry?.startTime;
  }

  private getNetworkErrorSeverity(status: number): ErrorSeverity {
    if (status >= 500) return 'critical';
    if (status >= 400) return 'high';
    if (status >= 300) return 'medium';
    return 'low';
  }

  // Categorize error based on error object and context
  private categorizeError(error: Error, providedCategory?: ErrorCategory): ErrorCategory {
    if (providedCategory) return providedCategory;
    const message = error.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'authentication';
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return 'authorization';
    }
    if (message.includes('database') || message.includes('storage') || message.includes('indexeddb')) {
      return 'database';
    }
    if (message.includes('security') || message.includes('xss') || message.includes('csrf')) {
      return 'security';
    }
    if (message.includes('performance') || message.includes('memory') || message.includes('slow')) {
      return 'performance';
    }

    return 'application';
  }

  // Determine error severity
  private determineSeverity(error: Error, providedSeverity?: ErrorSeverity): ErrorSeverity {
    if (providedSeverity) return providedSeverity;

    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    if (name.includes('security') || message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (name.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'high';
    }
    if (message.includes('validation') || message.includes('warning')) {
      return 'medium';
    }

    return 'medium'; // Default severity
  }

  // Main error logging method
  public async logError(
    error: Error,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      userId?: number;
      metadata?: Record<string, unknown>;
      componentStack?: string;
    } = {}
  ): Promise<void> {
    try {
      const logEntry: ErrorLogEntry = {
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        category: this.categorizeError(error, options.category),
        severity: this.determineSeverity(error, options.severity),
        message: error.message || 'Unknown error',
        stack: error.stack,
        componentStack: options.componentStack,
        userId: options.userId,
        sessionId: this.sessionId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        viewport: typeof window !== 'undefined' ? {
          width: window.innerWidth,
          height: window.innerHeight,
        } : { width: 0, height: 0 },
        performance: this.getPerformanceData(),
        userContext: {
          lastAction: this.lastUserAction,
          currentScreen: this.currentScreen,
          breadcrumbs: [...this.breadcrumbs],
        },
        metadata: options.metadata,
      };

      // Log to console in development
      if (this.config.enableConsoleLogging) {
        console.group(`🚨 Error [${logEntry.severity.toUpperCase()}] - ${logEntry.category}`);
        console.error('Message:', logEntry.message);
        console.error('Error:', error);
        console.log('Context:', {
          userId: logEntry.userId,
          sessionId: logEntry.sessionId,
          userContext: logEntry.userContext,
          metadata: logEntry.metadata,
        });
        console.groupEnd();
      }

      // Store locally
      if (this.config.enableLocalStorage) {
        await this.storeErrorLocally(logEntry);
      }

      // Send to external monitoring service
      if (this.config.apiEndpoint) {
        await this.sendToMonitoringService(logEntry);
      }

      // Trigger alerts for critical errors
      if (logEntry.severity === 'critical') {
        await this.triggerCriticalErrorAlert(logEntry);
      }

    } catch (loggingError) {
      // Fallback logging to console
      console.error('Error logging failed:', loggingError);
      console.error('Original error:', error);
    }
  }

  private getPerformanceData() {
    if (typeof window === 'undefined') return undefined;

    const data: any = {};

    // Memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      data.memoryUsage = memory.usedJSHeapSize;
    }

    // Connection type
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      data.connectionType = connection?.effectiveType;
    }

    // Page load time
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (perfData) {
      data.pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    }

    return Object.keys(data).length > 0 ? data : undefined;
  }

  private async storeErrorLocally(logEntry: ErrorLogEntry): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingErrors.push(logEntry);

      // Keep only the most recent errors
      const recentErrors = existingErrors.slice(-this.config.maxLocalErrors);
      localStorage.setItem('error_logs', JSON.stringify(recentErrors));
    } catch (error) {
      console.warn('Failed to store error locally:', error);
    }
  }

  private async sendToMonitoringService(logEntry: ErrorLogEntry): Promise<void> {
    if (!this.config.apiEndpoint) return;

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(logEntry),
      });

      if (!response.ok) {
        throw new Error(`Monitoring service responded with ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send error to monitoring service:', error);
    }
  }

  private async triggerCriticalErrorAlert(logEntry: ErrorLogEntry): Promise<void> {
    // Implement critical error alerting logic
    // This could send notifications, emails, or trigger alerts in monitoring systems
    console.warn('🚨 CRITICAL ERROR DETECTED:', logEntry);
    
    // Store critical errors separately for immediate attention
    if (typeof localStorage !== 'undefined') {
      try {
        const criticalErrors = JSON.parse(localStorage.getItem('critical_errors') || '[]');
        criticalErrors.push(logEntry);
        localStorage.setItem('critical_errors', JSON.stringify(criticalErrors.slice(-10)));
      } catch (error) {
        console.warn('Failed to store critical error:', error);
      }
    }
  }

  // User context tracking methods
  public setUserAction(action: string): void {
    this.lastUserAction = action;
    this.addBreadcrumb(`Action: ${action}`);
  }

  public setCurrentScreen(screen: string): void {
    this.currentScreen = screen;
    this.addBreadcrumb(`Screen: ${screen}`);
  }

  public addBreadcrumb(crumb: string): void {
    this.breadcrumbs.push(`${new Date().toISOString()}: ${crumb}`);
    if (this.breadcrumbs.length > 20) {
      this.breadcrumbs = this.breadcrumbs.slice(-20);
    }
  }

  // Get local error logs
  public getLocalErrors(): ErrorLogEntry[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      return JSON.parse(localStorage.getItem('error_logs') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve local errors:', error);
      return [];
    }
  }

  // Get critical errors
  public getCriticalErrors(): ErrorLogEntry[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      return JSON.parse(localStorage.getItem('critical_errors') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve critical errors:', error);
      return [];
    }
  }

  // Clear error logs
  public clearErrorLogs(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem('error_logs');
      localStorage.removeItem('critical_errors');
    } catch (error) {
      console.warn('Failed to clear error logs:', error);
    }
  }

  // Get error statistics
  public getErrorStatistics(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: number; // Last 24 hours
  } {
    const errors = this.getLocalErrors();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const stats = {
      total: errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: 0,
    };

    errors.forEach(error => {
      // Count by category
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count recent errors
      if (new Date(error.timestamp).getTime() > oneDayAgo) {
        stats.recent++;
      }
    });

    return stats;
  }
}

// Global error monitoring instance
export const errorMonitoring = new ErrorMonitoringService({
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableLocalStorage: true,
  maxLocalErrors: 100,
  enablePerformanceTracking: true,
  enableUserInteractionTracking: true,
});

// Convenience functions
export const logError = (error: Error, options?: Parameters<ErrorMonitoringService['logError']>[1]) => {
  return errorMonitoring.logError(error, options);
};

export const setUserAction = (action: string) => {
  errorMonitoring.setUserAction(action);
};

export const setCurrentScreen = (screen: string) => {
  errorMonitoring.setCurrentScreen(screen);
};

export const addBreadcrumb = (crumb: string) => {
  errorMonitoring.addBreadcrumb(crumb);
};
