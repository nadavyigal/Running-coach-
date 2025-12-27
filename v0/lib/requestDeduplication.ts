/**
 * Request Deduplication Utility
 *
 * Prevents duplicate API calls during rapid re-renders by caching in-flight requests.
 * This helps prevent API loops and reduces unnecessary load on the backend.
 *
 * Usage:
 * ```typescript
 * const data = await RequestDeduplicator.deduplicate(
 *   'recovery-recommendations-1-2024-01-15',
 *   5000, // 5 second TTL
 *   () => fetch('/api/recovery/recommendations?userId=1&date=2024-01-15')
 * );
 * ```
 */

class RequestDeduplicator {
  private static pending = new Map<string, Promise<any>>();
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Deduplicate a request by key
   *
   * @param key - Unique identifier for the request (e.g., 'user-1-recovery-2024-01-15')
   * @param ttl - Time to live in milliseconds for the cached promise
   * @param operation - The async operation to execute if not already pending
   * @returns The result of the operation
   */
  static async deduplicate<T>(
    key: string,
    ttl: number,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }

    // If request is already pending, return existing promise
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Execute and cache promise
    const promise = operation()
      .then((result) => {
        // Cache the result
        this.cache.set(key, { data: result, timestamp: Date.now() });
        return result;
      })
      .catch((error) => {
        // Don't cache errors
        throw error;
      })
      .finally(() => {
        // Clean up pending after completion
        this.pending.delete(key);
      });

    this.pending.set(key, promise);

    // Clear from pending after TTL
    setTimeout(() => {
      this.pending.delete(key);
    }, ttl);

    return promise;
  }

  /**
   * Manually clear a cached request
   *
   * @param key - The key to clear
   */
  static clear(key: string): void {
    this.pending.delete(key);
    this.cache.delete(key);
  }

  /**
   * Clear all cached requests
   */
  static clearAll(): void {
    this.pending.clear();
    this.cache.clear();
  }

  /**
   * Get cache statistics (useful for debugging)
   */
  static getStats(): { pendingCount: number; cachedCount: number } {
    return {
      pendingCount: this.pending.size,
      cachedCount: this.cache.size,
    };
  }
}

/**
 * Helper function to generate cache keys for common API patterns
 */
export const CacheKeys = {
  recoveryRecommendations: (userId: number, date: string) =>
    `recovery-recommendations-${userId}-${date}`,

  goalRecommendations: (userId: number, includeExpired: boolean = false) =>
    `goal-recommendations-${userId}-${includeExpired}`,

  personalizationContext: (userId: number) =>
    `personalization-context-${userId}`,

  subscriptionStatus: (userId: number) =>
    `subscription-status-${userId}`,
};

/**
 * Default TTL values for different types of requests (in milliseconds)
 */
export const CacheTTL = {
  SHORT: 5000,        // 5 seconds - for frequently changing data
  MEDIUM: 30000,      // 30 seconds - for moderately stable data
  LONG: 300000,       // 5 minutes - for stable data
  VERY_LONG: 3600000, // 1 hour - for very stable data
};

export default RequestDeduplicator;
