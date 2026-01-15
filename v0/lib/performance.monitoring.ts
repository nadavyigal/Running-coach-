export interface PerformanceMetrics {
  pageLoadTime: number;
  memoryUsage: number;
  bundleSize: number;
  apiResponseTime: number;
  errorRate: number;
  renderTime: number;
  interactionTime: number;
}

export interface PerformanceAlert {
  type: string;
  severity: 'low' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface PerformanceThresholds {
  pageLoadTime: number;
  memoryUsage: number;
  bundleSize: number;
  apiResponseTime: number;
  errorRate: number;
  renderTime: number;
  interactionTime: number;
}

const defaultThresholds: PerformanceThresholds = {
  pageLoadTime: 3000, // 3 seconds
  memoryUsage: 100 * 1024 * 1024, // 100MB
  bundleSize: 500 * 1024, // 500KB
  apiResponseTime: 1000, // 1 second
  errorRate: 0.05, // 5%
  renderTime: 100, // 100ms
  interactionTime: 50, // 50ms
};

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    memoryUsage: 0,
    bundleSize: 0,
    apiResponseTime: 0,
    errorRate: 0,
    renderTime: 0,
    interactionTime: 0,
  };

  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private apiCalls: { startTime: number; endTime?: number; success: boolean }[] = [];
  private errors: number = 0;
  private totalRequests: number = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...defaultThresholds, ...thresholds };
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor page load performance
    if (document.readyState === 'complete') {
      this.trackPageLoad();
    } else {
      window.addEventListener('load', () => this.trackPageLoad());
    }

    // Monitor memory usage periodically
    setInterval(() => this.trackMemoryUsage(), 30000); // Every 30 seconds

    // Monitor performance observer
    this.setupPerformanceObserver();

    // Monitor errors
    this.setupErrorTracking();

    // Track initial bundle size
    this.trackBundleSize();
  }

  // Track page load performance
  trackPageLoad() {
    if (typeof window === 'undefined' || !performance) return;

    const entries = performance.getEntriesByType('navigation');
    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }
    const navigation = entries[0] as PerformanceNavigationTiming;
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;
      this.metrics.pageLoadTime = loadTime;
      this.reportMetric('page_load_time', loadTime);
      this.checkThreshold('pageLoadTime', loadTime);
    }
  }

  // Track memory usage
  trackMemoryUsage() {
    if (typeof window === 'undefined' || !('memory' in performance)) return;

    const memory = (performance as any).memory;
    if (memory) {
      const memoryUsage = memory.usedJSHeapSize;
      this.metrics.memoryUsage = memoryUsage;
      this.reportMetric('memory_usage', memoryUsage);
      this.checkThreshold('memoryUsage', memoryUsage);
    }
  }

  // Track API response times
  trackApiCall(url: string, startTime: number, endTime: number, success: boolean = true) {
    const responseTime = endTime - startTime;
    this.metrics.apiResponseTime = responseTime;
    this.reportMetric('api_response_time', responseTime, { url, success: success.toString() });
    this.checkThreshold('apiResponseTime', responseTime);

    // Track for error rate calculation
    this.apiCalls.push({ startTime, endTime, success });
    this.totalRequests++;
    if (!success) {
      this.errors++;
    }

    // Calculate error rate
    this.calculateErrorRate();

    // Keep only recent calls (last 100)
    if (this.apiCalls.length > 100) {
      this.apiCalls.shift();
    }
  }

  // Track bundle size
  trackBundleSize() {
    if (typeof window === 'undefined') return;

    // Estimate bundle size from script tags
    const scripts = document.querySelectorAll('script[src]');
    let totalSize = 0;

    const promises: Promise<void>[] = [];
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && (src.includes('_next') || src.includes('chunks'))) {
        promises.push(
          fetch(src, { method: 'HEAD' })
            .then(response => {
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                totalSize += parseInt(contentLength, 10);
              }
            })
            .catch(() => {
              // Fallback estimation
              totalSize += 50 * 1024; // 50KB estimate per script
            })
        );
      }
    });

    Promise.all(promises).then(() => {
      this.metrics.bundleSize = totalSize;
      this.reportMetric('bundle_size', totalSize);
      this.checkThreshold('bundleSize', totalSize);
    });
  }

  // Setup Performance Observer
  private setupPerformanceObserver() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      // Observe paint metrics
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.renderTime = entry.startTime;
            this.reportMetric('first_contentful_paint', entry.startTime);
            this.checkThreshold('renderTime', entry.startTime);
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // Observe layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let cumulativeLayoutShift = 0;
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            cumulativeLayoutShift += entry.value;
          }
        });
        this.reportMetric('cumulative_layout_shift', cumulativeLayoutShift);
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

      // Observe first input delay
      const inputObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.metrics.interactionTime = entry.processingStart - entry.startTime;
          this.reportMetric('first_input_delay', this.metrics.interactionTime);
          this.checkThreshold('interactionTime', this.metrics.interactionTime);
        });
      });
      inputObserver.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  // Setup error tracking
  private setupErrorTracking() {
    if (typeof window === 'undefined') return;

    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.errors++;
      this.calculateErrorRate();
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', () => {
      this.errors++;
      this.calculateErrorRate();
    });

    window.addEventListener('unhandledrejection', () => {
      this.errors++;
      this.calculateErrorRate();
    });
  }

  // Calculate error rate
  private calculateErrorRate() {
    if (this.totalRequests === 0) {
      this.metrics.errorRate = 0;
    } else {
      this.metrics.errorRate = this.errors / this.totalRequests;
    }
    this.checkThreshold('errorRate', this.metrics.errorRate);
  }

  // Check performance thresholds
  private checkThreshold(metric: keyof PerformanceThresholds, value: number) {
    const threshold = this.thresholds[metric];
    
    if (value > threshold) {
      const severity = this.getSeverity(metric, value, threshold);
      const alert: PerformanceAlert = {
        type: metric,
        severity,
        message: `${metric} (${this.formatValue(metric, value)}) exceeds threshold (${this.formatValue(metric, threshold)})`,
        value,
        threshold,
        timestamp: new Date().toISOString(),
      };
      
      this.alerts.push(alert);
      this.handleAlert(alert);
      
      // Keep only recent alerts (last 50)
      if (this.alerts.length > 50) {
        this.alerts.shift();
      }
    }
  }

  // Get alert severity based on how much the threshold is exceeded
  private getSeverity(metric: keyof PerformanceThresholds, value: number, threshold: number): 'low' | 'warning' | 'critical' {
    const ratio = value / threshold;
    
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'warning';
    return 'low';
  }

  // Format values for display
  private formatValue(metric: keyof PerformanceThresholds, value: number): string {
    switch (metric) {
      case 'pageLoadTime':
      case 'apiResponseTime':
      case 'renderTime':
      case 'interactionTime':
        return `${Math.round(value)}ms`;
      case 'memoryUsage':
        return `${Math.round(value / 1024 / 1024)}MB`;
      case 'bundleSize':
        return `${Math.round(value / 1024)}KB`;
      case 'errorRate':
        return `${(value * 100).toFixed(2)}%`;
      default:
        return value.toString();
    }
  }

  // Handle performance alerts
  private handleAlert(alert: PerformanceAlert) {
    console.warn(`Performance Alert [${alert.severity.toUpperCase()}]:`, alert.message);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendAlert(alert);
    }
  }

  // Send alert to monitoring service
  private async sendAlert(alert: PerformanceAlert) {
    try {
      await fetch('/api/monitoring/performance-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('Failed to send performance alert:', error);
    }
  }

  // Report metrics to monitoring service
  private reportMetric(name: string, value: number, tags?: Record<string, string>) {
    // In development, just log
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance metric: ${name} = ${value}`, tags);
      return;
    }

    // In production, send to monitoring service
    try {
      fetch('/api/monitoring/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          value,
          tags,
          timestamp: new Date().toISOString(),
        }),
      }).catch(error => {
        console.error('Failed to report metric:', error);
      });
    } catch (error) {
      console.error('Failed to report metric:', error);
    }
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get performance alerts
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  // Get recent critical alerts
  getCriticalAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => alert.severity === 'critical');
  }

  // Check for performance regressions
  checkPerformanceRegressions(): PerformanceAlert[] {
    const regressionAlerts: PerformanceAlert[] = [];
    
    Object.entries(this.metrics).forEach(([key, value]) => {
      if (key in this.thresholds) {
        const metricKey = key as keyof PerformanceThresholds;
        const threshold = this.thresholds[metricKey];
        
        if (value > threshold) {
          regressionAlerts.push({
            type: metricKey,
            severity: this.getSeverity(metricKey, value, threshold),
            message: `Performance regression detected: ${metricKey}`,
            value,
            threshold,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
    
    return regressionAlerts;
  }

  // Generate performance report
  generateReport(): {
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    summary: {
      healthy: boolean;
      criticalIssues: number;
      warnings: number;
      recommendations: string[];
    };
  } {
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical');
    const warningAlerts = this.alerts.filter(a => a.severity === 'warning');
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (this.metrics.pageLoadTime > this.thresholds.pageLoadTime) {
      recommendations.push('Consider implementing code splitting and lazy loading');
    }
    
    if (this.metrics.memoryUsage > this.thresholds.memoryUsage) {
      recommendations.push('Check for memory leaks and optimize data structures');
    }
    
    if (this.metrics.bundleSize > this.thresholds.bundleSize) {
      recommendations.push('Optimize bundle size by removing unused dependencies');
    }
    
    if (this.metrics.apiResponseTime > this.thresholds.apiResponseTime) {
      recommendations.push('Optimize API endpoints and implement caching');
    }
    
    return {
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      summary: {
        healthy: criticalAlerts.length === 0,
        criticalIssues: criticalAlerts.length,
        warnings: warningAlerts.length,
        recommendations,
      },
    };
  }

  // Reset metrics and alerts
  reset() {
    this.metrics = {
      pageLoadTime: 0,
      memoryUsage: 0,
      bundleSize: 0,
      apiResponseTime: 0,
      errorRate: 0,
      renderTime: 0,
      interactionTime: 0,
    };
    this.alerts = [];
    this.apiCalls = [];
    this.errors = 0;
    this.totalRequests = 0;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring in browser
if (typeof window !== 'undefined') {
  // Start monitoring when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performanceMonitor.trackPageLoad();
    });
  }
}

export default PerformanceMonitor;
