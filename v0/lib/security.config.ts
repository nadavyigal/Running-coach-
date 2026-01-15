export const securityConfig = {
  // Content Security Policy
  csp: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    'img-src': ["'self'", "data:", "https:", "blob:"],
    'connect-src': ["'self'", "https://api.openai.com", "https://api.posthog.com"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'font-src': ["'self'", "data:", "https://fonts.gstatic.com"],
    'media-src': ["'self'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
  },
  
  // Security headers
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-DNS-Prefetch-Control': 'on',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // API route security
  apiSecurity: {
    // Chat API rate limiting
    chatRateLimit: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute
    },
    
    // General API rate limiting
    generalRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 requests per 15 minutes
    },
    
    // Request size limits
    requestSizeLimit: '1mb',
    
    // CORS settings
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },
  
  // Input validation
  validation: {
    // Maximum lengths for various inputs
    maxLengths: {
      chatMessage: 1000,
      userName: 50,
      planName: 100,
      workoutName: 100,
      notes: 500,
    },
    
    // Sanitization rules
    sanitization: {
      stripHtml: true,
      trimWhitespace: true,
      normalizeUnicode: true,
    },
  },
  
  // Session security
  session: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Environment-specific settings
  environment: {
    development: {
      logLevel: 'debug',
      enableCSP: false, // Disable CSP in development for easier debugging
    },
    
    production: {
      logLevel: 'error',
      enableCSP: true,
      enableHSTS: true,
    },
  },
};

// Helper function to generate CSP string
export function generateCSPString(): string {
  const { csp } = securityConfig;
  return Object.entries(csp)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

// Helper function to validate request size
export function validateRequestSize(contentLength: number): boolean {
  const maxSize = 1024 * 1024; // 1MB
  return contentLength <= maxSize;
}

// Helper function to sanitize input
export function sanitizeInput(input: string, maxLength?: number): string {
  let sanitized = input;
  
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Normalize unicode
  sanitized = sanitized.normalize('NFC');
  
  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

// Helper function to validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to check for suspicious patterns
export function detectSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\(/i,
    /setTimeout\(/i,
    /setInterval\(/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

// Rate limiting implementation
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  async check(identifier: string, config = securityConfig.rateLimit): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowMs;
    const maxRequests = config.max;
    
    const existing = this.requests.get(identifier);
    
    if (!existing || now > existing.resetTime) {
      // New window or expired window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset: new Date(now + windowMs),
      };
    }
    
    if (existing.count >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: new Date(existing.resetTime),
      };
    }
    
    existing.count++;
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - existing.count,
      reset: new Date(existing.resetTime),
    };
  }
  
  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  // Reset rate limit state (useful for tests)
  reset() {
    this.requests.clear();
  }
}

export const rateLimiter = new RateLimiter();

// Clean up expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    rateLimiter.cleanup();
  }, 5 * 60 * 1000);
}

// Enhanced input sanitization utilities
export const advancedSanitization = {
  // Remove potentially dangerous HTML tags and scripts
  secureHtml: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/data:text\/html/gi, '');
  },
  
  // Sanitize for database queries
  sqlSafe: (input: string): string => {
    return input
      .replace(/['";]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/union\s+select/gi, '')
      .replace(/drop\s+table/gi, '')
      .replace(/delete\s+from/gi, '');
  },
  
  // Sanitize file names
  fileName: (input: string): string => {
    return input
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\.\./g, '')
      .replace(/^\./, '')
      .trim();
  },
};

// File validation utilities
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }
  
  // Check for suspicious file names
  if (detectSuspiciousPatterns(file.name)) {
    return {
      valid: false,
      error: 'File name contains suspicious patterns',
    };
  }
  
  return { valid: true };
};

// Content Security Policy violation handler
export const handleCSPViolation = (violation: Record<string, unknown>) => {
  const report = {
    violationType: 'csp-violation',
    documentUri: violation['document-uri'],
    blockedUri: violation['blocked-uri'],
    violatedDirective: violation['violated-directive'],
    originalPolicy: violation['original-policy'],
    disposition: violation.disposition,
    timestamp: new Date().toISOString(),
  };
  
  // Log the violation
  console.warn('CSP Violation:', report);
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to security monitoring service
    fetch('/api/security/csp-violation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(err => console.error('Failed to report CSP violation:', err));
  }
};

export default securityConfig;
