export const performanceConfig = {
  // Build performance tracking
  buildMetrics: {
    bundleSize: {
      maxSize: 500 * 1024, // 500KB
      warningThreshold: 400 * 1024, // 400KB
    },
    buildTime: {
      maxTime: 30000, // 30 seconds
      warningThreshold: 25000, // 25 seconds
    },
    chunkSizes: {
      maxChunkSize: 200 * 1024, // 200KB per chunk
      warningThreshold: 150 * 1024, // 150KB warning
    },
  },
  
  // Runtime performance monitoring
  runtimeMetrics: {
    pageLoadTime: {
      maxTime: 3000, // 3 seconds
      warningThreshold: 2500, // 2.5 seconds
    },
    firstContentfulPaint: {
      maxTime: 1800, // 1.8 seconds
      warningThreshold: 1500, // 1.5 seconds
    },
    largestContentfulPaint: {
      maxTime: 2500, // 2.5 seconds
      warningThreshold: 2000, // 2 seconds
    },
    cumulativeLayoutShift: {
      maxScore: 0.1,
      warningThreshold: 0.05,
    },
    firstInputDelay: {
      maxTime: 100, // 100ms
      warningThreshold: 75, // 75ms
    },
    memoryUsage: {
      maxUsage: 100 * 1024 * 1024, // 100MB
      warningThreshold: 80 * 1024 * 1024, // 80MB
    },
  },
  
  // Performance monitoring tools
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    endpoint: process.env.PERFORMANCE_MONITORING_ENDPOINT,
    sampleRate: 0.1, // 10% of requests
    reportingInterval: 60000, // 1 minute
    batchSize: 50, // Number of metrics to batch before sending
  },
  
  // Web Vitals thresholds
  webVitals: {
    // Core Web Vitals
    LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
    FID: { good: 100, needsImprovement: 300 },   // First Input Delay
    CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
    
    // Additional metrics
    FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
    TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
    TBT: { good: 200, needsImprovement: 600 },   // Total Blocking Time
  },
  
  // Resource loading optimization
  resourceOptimization: {
    // Image optimization
    images: {
      formats: ['webp', 'avif', 'jpeg'],
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1080,
      lazyLoading: true,
    },
    
    // Font optimization
    fonts: {
      preload: ['primary', 'secondary'],
      display: 'swap',
      fallbacks: ['system-ui', 'sans-serif'],
    },
    
    // JavaScript optimization
    javascript: {
      minification: true,
      compression: 'gzip',
      treeshaking: true,
      codesplitting: true,
    },
    
    // CSS optimization
    css: {
      minification: true,
      purgeUnused: true,
      criticalInline: true,
      compression: 'gzip',
    },
  },
  
  // Database performance
  database: {
    queryTimeout: 5000, // 5 seconds
    maxConnections: 10,
    connectionTimeout: 30000, // 30 seconds
    indexedDB: {
      transactionTimeout: 10000, // 10 seconds
      maxRecords: 10000,
      compactionThreshold: 0.7,
    },
  },
  
  // API performance
  api: {
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    rateLimiting: {
      requests: 100,
      window: 60000, // 1 minute
    },
  },
  
  // Caching configuration
  caching: {
    staticAssets: {
      maxAge: 31536000, // 1 year
      staleWhileRevalidate: 86400, // 1 day
    },
    apiResponses: {
      maxAge: 300, // 5 minutes
      staleWhileRevalidate: 60, // 1 minute
    },
    pages: {
      maxAge: 3600, // 1 hour
      staleWhileRevalidate: 300, // 5 minutes
    },
  },
};

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();

  // Start timing a performance metric
  startTiming(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  // End timing and record the metric
  endTiming(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      console.warn(`No start time found for metric: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.set(label, duration);
    this.startTimes.delete(label);

    return duration;
  }

  // Record a custom metric
  recordMetric(label: string, value: number): void {
    this.metrics.set(label, value);
  }

  // Get all recorded metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  // Check if a metric exceeds threshold
  checkThreshold(label: string, threshold: number): boolean {
    const value = this.metrics.get(label);
    return value ? value > threshold : false;
  }

  // Generate performance report
  generateReport(): string {
    const metrics = this.getMetrics();
    const report = Object.entries(metrics)
      .map(([label, value]) => `${label}: ${value.toFixed(2)}ms`)
      .join('\n');

    return `Performance Report:\n${report}`;
  }
}

// Web Vitals observer
export function observeWebVitals(callback: (metric: any) => void): void {
  if (typeof window === 'undefined') return;

  // Observe Core Web Vitals
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      callback({
        name: entry.name,
        value: entry.value || (entry as any).processingStart - entry.startTime,
        timestamp: entry.startTime,
      });
    }
  });

  // Observe different performance entry types
  try {
    observer.observe({ entryTypes: ['measure', 'navigation', 'resource', 'paint'] });
  } catch (error) {
    console.warn('Performance Observer not supported:', error);
  }
}

// Bundle analyzer utility
export function analyzeBundleSize(): void {
  if (typeof window === 'undefined') return;

  const scripts = document.querySelectorAll('script[src]');
  let totalSize = 0;

  scripts.forEach((script) => {
    const src = (script as HTMLScriptElement).src;
    if (src.includes('/_next/static/')) {
      // Estimate size based on response headers if available
      fetch(src, { method: 'HEAD' })
        .then((response) => {
          const size = response.headers.get('content-length');
          if (size) {
            totalSize += parseInt(size, 10);
            console.log(`Script ${src}: ${size} bytes`);
          }
        })
        .catch(() => {
          // Silently fail for cross-origin requests
        });
    }
  });

  setTimeout(() => {
    console.log(`Total estimated bundle size: ${totalSize} bytes`);
    const { maxSize, warningThreshold } = performanceConfig.buildMetrics.bundleSize;
    
    if (totalSize > maxSize) {
      console.error(`Bundle size exceeds maximum: ${totalSize} > ${maxSize}`);
    } else if (totalSize > warningThreshold) {
      console.warn(`Bundle size exceeds warning threshold: ${totalSize} > ${warningThreshold}`);
    }
  }, 2000);
}

// Memory usage monitor
export function monitorMemoryUsage(): void {
  if (typeof window === 'undefined' || !(performance as any).memory) return;

  const memory = (performance as any).memory;
  const used = memory.usedJSHeapSize;
  const total = memory.totalJSHeapSize;
  const limit = memory.jsHeapSizeLimit;

  console.log(`Memory usage: ${used} / ${total} (limit: ${limit})`);

  const { maxUsage, warningThreshold } = performanceConfig.runtimeMetrics.memoryUsage;

  if (used > maxUsage) {
    console.error(`Memory usage exceeds maximum: ${used} > ${maxUsage}`);
  } else if (used > warningThreshold) {
    console.warn(`Memory usage exceeds warning threshold: ${used} > ${warningThreshold}`);
  }
}

// Create a singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceConfig;