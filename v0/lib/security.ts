/**
 * Security utilities for input sanitization and validation
 * Used to prevent XSS, prompt injection, and other security vulnerabilities
 */

// Lazy load DOMPurify to avoid build-time issues with isomorphic-dompurify
let DOMPurifyInstance: typeof import('isomorphic-dompurify').default | null = null;

async function getDOMPurify() {
  if (!DOMPurifyInstance) {
    const module = await import('isomorphic-dompurify');
    DOMPurifyInstance = module.default;
  }
  return DOMPurifyInstance;
}

/**
 * Sanitizes user input for use in AI prompts to prevent prompt injection attacks
 * Removes potentially dangerous characters and limits length
 */
export function sanitizeForPrompt(input: string, maxLength: number = 500): string {
  if (!input) return '';

  return input
    // Remove potential command injection characters
    .replace(/[<>{}[\]]/g, '')
    // Remove newlines that could break prompt structure
    .replace(/\n{3,}/g, '\n\n')
    // Limit length to prevent excessive token usage
    .substring(0, maxLength)
    .trim();
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Allows only safe HTML tags and attributes
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (!html) return '';

  const DOMPurify = await getDOMPurify();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
  });
}

/**
 * Sanitizes user chat messages for storage and display
 * Removes HTML but preserves text content
 */
export async function sanitizeChatMessage(message: string, maxLength: number = 2000): Promise<string> {
  if (!message) return '';

  // First remove any HTML tags
  const DOMPurify = await getDOMPurify();
  const textOnly = DOMPurify.sanitize(message, { ALLOWED_TAGS: [] });

  // Then limit length and trim
  return textOnly.substring(0, maxLength).trim();
}

/**
 * Validates and sanitizes a distance string
 * Returns sanitized distance or null if invalid
 */
export function sanitizeDistance(distance: string | undefined): string | null {
  if (!distance) return null;

  // Remove non-numeric and non-decimal characters
  const cleaned = distance.replace(/[^\d.]/g, '');

  // Validate it's a reasonable number
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0 || num > 500) {
    return null;
  }

  return cleaned;
}

/**
 * Validates and sanitizes a time duration string (HH:MM:SS format)
 * Returns sanitized time or null if invalid
 */
export function sanitizeTimeDuration(time: string | undefined): string | null {
  if (!time) return null;

  // Remove non-numeric and non-colon characters
  const cleaned = time.replace(/[^\d:]/g, '');

  // Validate format (H:MM:SS, HH:MM:SS, MM:SS, etc.)
  const timePattern = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;
  if (!timePattern.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Sanitizes user name input
 */
export function sanitizeName(name: string | undefined, maxLength: number = 100): string {
  if (!name) return '';

  return name
    // Remove special characters that could be used for injection
    .replace(/[<>{}[\]()]/g, '')
    // Allow letters, numbers, spaces, hyphens, apostrophes
    .replace(/[^a-zA-Z0-9\s\-']/g, '')
    .substring(0, maxLength)
    .trim();
}

/**
 * Rate limiting utilities
 */

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Simple in-memory rate limiter (for development)
 * For production, use Redis-based rate limiting
 */
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: Date }> = new Map();

  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = new Date();
    const record = this.requests.get(key);

    // Clean up old entries periodically
    if (this.requests.size > 10000) {
      this.cleanup();
    }

    if (!record || record.resetAt < now) {
      // First request or window expired
      const resetAt = new Date(now.getTime() + config.windowMs);
      this.requests.set(key, { count: 1, resetAt });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    if (record.count >= config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
      };
    }

    // Increment and allow
    record.count++;
    this.requests.set(key, record);

    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetAt: record.resetAt,
    };
  }

  private cleanup() {
    const now = new Date();
    for (const [key, record] of this.requests.entries()) {
      if (record.resetAt < now) {
        this.requests.delete(key);
      }
    }
  }

  reset(key: string) {
    this.requests.delete(key);
  }
}

// Singleton instance
export const rateLimiter = new InMemoryRateLimiter();

/**
 * Creates a rate limit key from request information
 */
export function createRateLimitKey(userId: string | null, ip?: string): string {
  // Use both userId and IP for better security
  const userPart = userId || 'anonymous';
  const ipPart = ip || 'unknown';
  return `${userPart}:${ipPart}`;
}
