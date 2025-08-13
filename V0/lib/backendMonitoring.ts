/**
 * Backend Integration Monitoring and Logging System
 * Provides comprehensive monitoring for database operations and API integrations
 */

export interface OperationMetrics {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  retryCount?: number;
  context?: Record<string, any>;
}

export interface DatabaseMetrics {
  connectionHealth: 'excellent' | 'good' | 'poor' | 'failed';
  averageLatency: number;
  operationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  lastHealthCheck: Date;
  concurrentOperations: number;
}

export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  timestamp: Date;
}

class BackendMonitoringService {
  private static instance: BackendMonitoringService;
  private operationMetrics: OperationMetrics[] = [];
  private databaseMetrics: DatabaseMetrics = {
    connectionHealth: 'failed',
    averageLatency: 0,
    operationCounts: {},
    errorCounts: {},
    lastHealthCheck: new Date(),
    concurrentOperations: 0
  };
  private apiMetrics: APIMetrics[] = [];
  private maxMetricsHistory = 1000; // Keep last 1000 operations
  private metricsCleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startMetricsCleanup();
  }

  public static getInstance(): BackendMonitoringService {
    if (!BackendMonitoringService.instance) {
      BackendMonitoringService.instance = new BackendMonitoringService();
    }
    return BackendMonitoringService.instance;
  }

  /**
   * Track database operation performance and errors
   */
  public trackDatabaseOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    const metrics: OperationMetrics = {
      operationName,
      startTime,
      success: false,
      context
    };

    // Update concurrent operations count
    this.databaseMetrics.concurrentOperations++;

    // Update operation count
    this.databaseMetrics.operationCounts[operationName] = 
      (this.databaseMetrics.operationCounts[operationName] || 0) + 1;

    return operation()
      .then(result => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        metrics.endTime = endTime;
        metrics.duration = duration;
        metrics.success = true;

        this.addOperationMetric(metrics);
        this.updateDatabaseLatency(duration);
        
        console.log(`✅ DB Operation '${operationName}' completed in ${duration}ms`, context);
        return result;
      })
      .catch(error => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        metrics.endTime = endTime;
        metrics.duration = duration;
        metrics.success = false;
        metrics.error = error instanceof Error ? error.message : String(error);

        this.addOperationMetric(metrics);
        
        // Update error count
        this.databaseMetrics.errorCounts[operationName] = 
          (this.databaseMetrics.errorCounts[operationName] || 0) + 1;

        console.error(`❌ DB Operation '${operationName}' failed after ${duration}ms:`, {
          error: metrics.error,
          context
        });

        throw error;
      })
      .finally(() => {
        this.databaseMetrics.concurrentOperations--;
      });
  }

  /**
   * Track API endpoint performance and errors
   */
  public trackAPICall(
    endpoint: string,
    method: string,
    operation: () => Promise<Response>
  ): Promise<Response> {
    const startTime = Date.now();

    return operation()
      .then(response => {
        const responseTime = Date.now() - startTime;
        
        const apiMetric: APIMetrics = {
          endpoint,
          method,
          statusCode: response.status,
          responseTime,
          timestamp: new Date()
        };

        this.addAPIMetric(apiMetric);

        if (!response.ok) {
          console.warn(`⚠️ API Call '${method} ${endpoint}' returned status ${response.status} in ${responseTime}ms`);
        } else {
          console.log(`✅ API Call '${method} ${endpoint}' completed in ${responseTime}ms`);
        }

        return response;
      })
      .catch(error => {
        const responseTime = Date.now() - startTime;
        
        const apiMetric: APIMetrics = {
          endpoint,
          method,
          responseTime,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        };

        this.addAPIMetric(apiMetric);
        
        console.error(`❌ API Call '${method} ${endpoint}' failed after ${responseTime}ms:`, error);
        throw error;
      });
  }

  /**
   * Update database health status
   */
  public updateDatabaseHealth(health: {
    connectionStatus: 'excellent' | 'good' | 'poor' | 'failed';
    latency?: number;
  }): void {
    this.databaseMetrics.connectionHealth = health.connectionStatus;
    this.databaseMetrics.lastHealthCheck = new Date();
    
    if (health.latency !== undefined) {
      this.updateDatabaseLatency(health.latency);
    }
  }

  /**
   * Get comprehensive backend health summary
   */
  public getHealthSummary(): {
    database: DatabaseMetrics;
    recentOperations: OperationMetrics[];
    recentAPIcalls: APIMetrics[];
    healthScore: number; // 0-100
    recommendations: string[];
  } {
    const recentOperations = this.operationMetrics.slice(-10);
    const recentAPIcalls = this.apiMetrics.slice(-10);
    
    // Calculate health score
    const healthScore = this.calculateHealthScore();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      database: { ...this.databaseMetrics },
      recentOperations,
      recentAPIcalls,
      healthScore,
      recommendations
    };
  }

  /**
   * Get error patterns and trends
   */
  public getErrorAnalysis(): {
    topErrors: { error: string; count: number; operations: string[] }[];
    errorTrends: { operation: string; errorRate: number }[];
    criticalIssues: string[];
  } {
    const errorMap = new Map<string, { count: number; operations: Set<string> }>();
    
    // Analyze operation errors
    this.operationMetrics
      .filter(m => !m.success && m.error)
      .forEach(m => {
        const error = m.error!;
        if (!errorMap.has(error)) {
          errorMap.set(error, { count: 0, operations: new Set() });
        }
        const entry = errorMap.get(error)!;
        entry.count++;
        entry.operations.add(m.operationName);
      });

    const topErrors = Array.from(errorMap.entries())
      .map(([error, data]) => ({
        error,
        count: data.count,
        operations: Array.from(data.operations)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate error rates by operation
    const errorTrends = Object.entries(this.databaseMetrics.operationCounts)
      .map(([operation, totalCount]) => {
        const errorCount = this.databaseMetrics.errorCounts[operation] || 0;
        return {
          operation,
          errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0
        };
      })
      .filter(trend => trend.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate);

    // Identify critical issues
    const criticalIssues = [];
    if (this.databaseMetrics.connectionHealth === 'failed') {
      criticalIssues.push('Database connection failed');
    }
    if (this.databaseMetrics.averageLatency > 1000) {
      criticalIssues.push('High database latency detected');
    }
    if (this.databaseMetrics.concurrentOperations > 5) {
      criticalIssues.push('High concurrent operations detected');
    }

    return {
      topErrors,
      errorTrends,
      criticalIssues
    };
  }

  /**
   * Log structured error for better debugging
   */
  public logStructuredError(
    operation: string,
    error: Error | string,
    context?: Record<string, any>
  ): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      operation,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : { message: String(error) },
      context,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };

    console.error('🔍 Structured Error Log:', JSON.stringify(errorLog, null, 2));
  }

  /**
   * Private helper methods
   */
  private addOperationMetric(metric: OperationMetrics): void {
    this.operationMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.operationMetrics.length > this.maxMetricsHistory) {
      this.operationMetrics = this.operationMetrics.slice(-this.maxMetricsHistory);
    }
  }

  private addAPIMetric(metric: APIMetrics): void {
    this.apiMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.apiMetrics.length > this.maxMetricsHistory) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsHistory);
    }
  }

  private updateDatabaseLatency(latency: number): void {
    const recentOperations = this.operationMetrics.slice(-100);
    const totalLatency = recentOperations.reduce((sum, op) => sum + (op.duration || 0), 0);
    this.databaseMetrics.averageLatency = recentOperations.length > 0 ? 
      totalLatency / recentOperations.length : 0;
  }

  private calculateHealthScore(): number {
    let score = 100;

    // Database connection health (40% weight)
    switch (this.databaseMetrics.connectionHealth) {
      case 'failed':
        score -= 40;
        break;
      case 'poor':
        score -= 20;
        break;
      case 'good':
        score -= 5;
        break;
      case 'excellent':
        // No deduction
        break;
    }

    // Error rates (30% weight)
    const recentOperations = this.operationMetrics.slice(-50);
    const errorRate = recentOperations.length > 0 ? 
      recentOperations.filter(op => !op.success).length / recentOperations.length : 0;
    score -= errorRate * 30;

    // Latency (20% weight)
    if (this.databaseMetrics.averageLatency > 1000) {
      score -= 20;
    } else if (this.databaseMetrics.averageLatency > 500) {
      score -= 10;
    } else if (this.databaseMetrics.averageLatency > 200) {
      score -= 5;
    }

    // Concurrent operations (10% weight)
    if (this.databaseMetrics.concurrentOperations > 10) {
      score -= 10;
    } else if (this.databaseMetrics.concurrentOperations > 5) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Database health recommendations
    if (this.databaseMetrics.connectionHealth === 'failed') {
      recommendations.push('Check IndexedDB support and browser storage settings');
      recommendations.push('Consider implementing offline mode fallbacks');
    }

    // Performance recommendations
    if (this.databaseMetrics.averageLatency > 500) {
      recommendations.push('Optimize database queries and consider indexing');
      recommendations.push('Reduce transaction complexity');
    }

    // Concurrency recommendations
    if (this.databaseMetrics.concurrentOperations > 5) {
      recommendations.push('Implement operation queuing to reduce concurrent access');
      recommendations.push('Consider using database connection pooling');
    }

    // Error rate recommendations
    const recentOperations = this.operationMetrics.slice(-50);
    const errorRate = recentOperations.length > 0 ? 
      recentOperations.filter(op => !op.success).length / recentOperations.length : 0;
    
    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - review error handling patterns');
      recommendations.push('Implement circuit breakers for failing operations');
    }

    return recommendations;
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every 5 minutes
    this.metricsCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      
      this.operationMetrics = this.operationMetrics.filter(
        m => m.startTime > cutoff
      );
      
      this.apiMetrics = this.apiMetrics.filter(
        m => m.timestamp.getTime() > cutoff
      );
      
      console.log('🧹 Cleaned up old monitoring metrics');
    }, 5 * 60 * 1000);
  }

  public destroy(): void {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = null;
    }
  }
}

// Export singleton instance
export const backendMonitoring = BackendMonitoringService.getInstance();

// Convenience wrapper functions
export const trackDatabaseOperation = <T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> => {
  return backendMonitoring.trackDatabaseOperation(operationName, operation, context);
};

export const trackAPICall = (
  endpoint: string,
  method: string,
  operation: () => Promise<Response>
): Promise<Response> => {
  return backendMonitoring.trackAPICall(endpoint, method, operation);
};

export const logError = (
  operation: string,
  error: Error | string,
  context?: Record<string, any>
): void => {
  backendMonitoring.logStructuredError(operation, error, context);
};