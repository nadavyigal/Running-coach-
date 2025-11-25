/**
 * Performance monitoring and optimization utilities
 * Provides tools for tracking and optimizing application performance
 */

import { DATABASE } from './constants';

/**
 * Performance metric tracker
 * Tracks timing and performance metrics for operations
 */
export class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Start tracking an operation
   *
   * @param name - Operation name
   */
  start(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End tracking and record the duration
   *
   * @param name - Operation name
   * @returns Duration in milliseconds
   */
  end(name: string): number {
    const startTime = this.startTimes.get(name);

    if (!startTime) {
      console.warn(`No start time found for operation: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(name);

    // Store metric
    const existing = this.metrics.get(name) || [];
    existing.push(duration);

    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }

    this.metrics.set(name, existing);

    return duration;
  }

  /**
   * Get statistics for an operation
   *
   * @param name - Operation name
   * @returns Stats object with min, max, avg, count
   */
  getStats(name: string): { min: number; max: number; avg: number; count: number } | null {
    const measurements = this.metrics.get(name);

    if (!measurements || measurements.length === 0) {
      return null;
    }

    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      count: measurements.length,
    };
  }

  /**
   * Get all tracked metrics
   *
   * @returns Map of operation names to stats
   */
  getAllStats(): Map<string, ReturnType<typeof this.getStats>> {
    const allStats = new Map();

    for (const name of this.metrics.keys()) {
      allStats.set(name, this.getStats(name));
    }

    return allStats;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    console.group('Performance Report');

    for (const [name, stats] of this.getAllStats()) {
      if (stats) {
        console.log(
          `${name}: avg=${stats.avg}ms, min=${stats.min}ms, max=${stats.max}ms (${stats.count} samples)`
        );
      }
    }

    console.groupEnd();
  }
}

/**
 * Global performance tracker instance
 */
export const performanceTracker = new PerformanceTracker();

/**
 * Measure execution time of a function
 *
 * @param fn - Function to measure
 * @param name - Operation name for tracking
 * @returns Promise with result and duration
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
  name: string
): Promise<{ result: T; duration: number }> {
  performanceTracker.start(name);
  const result = await fn();
  const duration = performanceTracker.end(name);

  return { result, duration };
}

/**
 * Measure synchronous function execution
 *
 * @param fn - Function to measure
 * @param name - Operation name for tracking
 * @returns Result and duration
 */
export function measureSync<T>(
  fn: () => T,
  name: string
): { result: T; duration: number } {
  performanceTracker.start(name);
  const result = fn();
  const duration = performanceTracker.end(name);

  return { result, duration };
}

/**
 * Debounce function to limit execution frequency
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle function to limit execution rate
 *
 * @param fn - Function to throttle
 * @param delay - Minimum interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Memoize expensive function calls
 *
 * @param fn - Function to memoize
 * @param keyGenerator - Optional function to generate cache key
 * @param maxSize - Maximum cache size (default: 100)
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string,
  maxSize = 100
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);

    // Implement LRU cache
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, result);

    return result;
  }) as T;
}

/**
 * Batch function calls to reduce execution frequency
 *
 * @param fn - Function to batch
 * @param delay - Batch interval in milliseconds
 * @returns Batched function
 */
export function batch<T>(
  fn: (items: T[]) => void,
  delay: number
): (item: T) => void {
  let items: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  return (item: T) => {
    items.push(item);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(items);
      items = [];
    }, delay);
  };
}

/**
 * Retry failed operations with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum retry attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise with result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = DATABASE.MAX_RETRIES,
  baseDelay: number = DATABASE.RETRY_DELAY_BASE
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if value is a Promise
 *
 * @param value - Value to check
 * @returns Boolean indicating if value is a Promise
 */
export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function';
}

/**
 * Create a cancelable Promise
 *
 * @param promise - Original promise
 * @returns Cancelable promise with cancel method
 */
export function makeCancelable<T>(promise: Promise<T>): {
  promise: Promise<T>;
  cancel: () => void;
} {
  let isCanceled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then(value => (isCanceled ? reject(new Error('Canceled')) : resolve(value)))
      .catch(error => (isCanceled ? reject(new Error('Canceled')) : reject(error)));
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      isCanceled = true;
    },
  };
}

/**
 * Run tasks in parallel with concurrency limit
 *
 * @param tasks - Array of task functions
 * @param limit - Maximum concurrent tasks
 * @returns Promise with all results
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(e => e === p),
        1
      );
    }
  }

  await Promise.all(executing);

  return results;
}

/**
 * Deep clone an object (for simple objects, not classes)
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }

  if (obj instanceof Object) {
    const clonedObj = {} as any;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }

    return clonedObj;
  }

  return obj;
}

/**
 * Get memory usage information (browser)
 *
 * @returns Memory info object or null
 */
export function getMemoryInfo(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  if (typeof window === 'undefined') return null;

  const performance = (window as any).performance;

  if (performance && performance.memory) {
    return {
      usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
      totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
      jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576), // MB
    };
  }

  return null;
}

/**
 * Log memory usage to console
 */
export function logMemoryUsage(): void {
  const memInfo = getMemoryInfo();

  if (memInfo) {
    console.log(
      `Memory: ${memInfo.usedJSHeapSize}MB / ${memInfo.totalJSHeapSize}MB (limit: ${memInfo.jsHeapSizeLimit}MB)`
    );
  } else {
    console.log('Memory info not available');
  }
}
