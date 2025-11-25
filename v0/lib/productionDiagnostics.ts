/**
 * Production Diagnostics
 * 
 * Utilities for debugging and monitoring the application in production
 * without exposing sensitive information.
 */

import { getEnvironmentStatus } from './apiKeyManager';

interface DiagnosticEvent {
  timestamp: string;
  category: 'database' | 'api' | 'auth' | 'navigation' | 'error';
  event: string;
  details?: Record<string, unknown>;
  duration?: number;
}

// In-memory log buffer for production debugging (limited size)
const diagnosticLogs: DiagnosticEvent[] = [];
const MAX_LOGS = 100;

/**
 * Check if production diagnostics are enabled
 */
export function isDiagnosticsEnabled(): boolean {
  // Enable diagnostics in development or when explicitly enabled via URL param
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') {
      return true;
    }
  }
  return process.env.NODE_ENV === 'development';
}

/**
 * Log a diagnostic event
 */
export function logDiagnostic(
  category: DiagnosticEvent['category'],
  event: string,
  details?: Record<string, unknown>,
  duration?: number
): void {
  const diagnosticEvent: DiagnosticEvent = {
    timestamp: new Date().toISOString(),
    category,
    event,
  };
  
  // Only add optional properties if defined (for exactOptionalPropertyTypes)
  if (details !== undefined) {
    diagnosticEvent.details = details;
  }
  if (duration !== undefined) {
    diagnosticEvent.duration = duration;
  }

  // Add to buffer
  diagnosticLogs.push(diagnosticEvent);
  
  // Keep buffer size limited
  if (diagnosticLogs.length > MAX_LOGS) {
    diagnosticLogs.shift();
  }

  // Log to console if diagnostics are enabled
  if (isDiagnosticsEnabled()) {
    const prefix = `[${category.toUpperCase()}]`;
    const durationStr = duration !== undefined ? ` (${duration}ms)` : '';
    console.log(`${prefix} ${event}${durationStr}`, details || '');
  }
}

/**
 * Time an async operation and log diagnostics
 */
export async function timeOperation<T>(
  category: DiagnosticEvent['category'],
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = Math.round(performance.now() - startTime);
    
    logDiagnostic(category, `${operationName} completed`, { success: true }, duration);
    
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    
    logDiagnostic(
      category, 
      `${operationName} failed`, 
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      duration
    );
    
    throw error;
  }
}

/**
 * Get diagnostic summary for debugging
 */
export function getDiagnosticSummary(): {
  environment: ReturnType<typeof getEnvironmentStatus>;
  recentLogs: DiagnosticEvent[];
  errorCount: number;
  warnings: string[];
} {
  const environment = getEnvironmentStatus();
  const recentLogs = diagnosticLogs.slice(-20);
  const errorCount = diagnosticLogs.filter(log => log.category === 'error').length;
  
  const warnings: string[] = [];
  
  if (environment.openai !== 'configured') {
    warnings.push('OpenAI API key is not configured - AI features will use fallbacks');
  }
  
  if (environment.isProduction && environment.posthog !== 'configured') {
    warnings.push('PostHog is not configured - analytics will be disabled');
  }
  
  // Check for slow database operations
  const slowDbOps = diagnosticLogs.filter(
    log => log.category === 'database' && log.duration && log.duration > 3000
  );
  if (slowDbOps.length > 0) {
    warnings.push(`${slowDbOps.length} slow database operations detected (>3s)`);
  }
  
  return {
    environment,
    recentLogs,
    errorCount,
    warnings
  };
}

/**
 * Log database initialization status
 */
export function logDatabaseInit(success: boolean, duration: number, error?: string): void {
  logDiagnostic(
    'database',
    success ? 'Database initialized' : 'Database initialization failed',
    { success, error },
    duration
  );
}

/**
 * Log API call status
 */
export function logApiCall(
  endpoint: string, 
  method: string, 
  status: number, 
  duration: number,
  error?: string
): void {
  logDiagnostic(
    'api',
    `${method} ${endpoint}`,
    { status, success: status >= 200 && status < 300, error },
    duration
  );
}

/**
 * Log user navigation events
 */
export function logNavigation(from: string, to: string, reason?: string): void {
  logDiagnostic(
    'navigation',
    `Navigate: ${from} -> ${to}`,
    { from, to, reason }
  );
}

/**
 * Log errors with context
 */
export function logError(
  context: string,
  error: Error | string,
  additionalInfo?: Record<string, unknown>
): void {
  logDiagnostic(
    'error',
    context,
    {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined,
      ...additionalInfo
    }
  );
}

/**
 * Export diagnostic data for support
 */
export function exportDiagnosticData(): string {
  const summary = getDiagnosticSummary();
  
  // Create a safe export that doesn't include sensitive data
  const exportData = {
    exportedAt: new Date().toISOString(),
    environment: {
      ...summary.environment,
      // Don't include actual key status, just availability
      openaiAvailable: summary.environment.openai === 'configured',
      posthogAvailable: summary.environment.posthog === 'configured'
    },
    warnings: summary.warnings,
    errorCount: summary.errorCount,
    recentEvents: summary.recentLogs.map(log => ({
      timestamp: log.timestamp,
      category: log.category,
      event: log.event,
      duration: log.duration
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
}

