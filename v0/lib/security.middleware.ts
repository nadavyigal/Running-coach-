import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, securityConfig, sanitizeInput, detectSuspiciousPatterns } from './security.config';
import { performanceMonitor } from './performance.monitoring';
import { securityMonitor } from './security.monitoring';

export interface SecurityMiddlewareOptions {
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  requireAuth?: boolean;
  validateInput?: boolean;
  logRequests?: boolean;
  enablePerformanceTracking?: boolean;
}

export interface ApiRequest extends NextRequest {
  startTime?: number;
  clientIP?: string;
  rateLimitResult?: {
    success: boolean;
    limit: number;
    remaining: number;
    reset: Date;
  };
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  // Check various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to a default IP for development
  return '127.0.0.1';
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    return cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token');
  });
}

// Validate request size
function validateRequestSize(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const maxSize = 1024 * 1024; // 1MB
    return size <= maxSize;
  }
  return true;
}

// Check for suspicious user agents
function checkUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /curl/i,
    /wget/i,
    /bot/i,
    /crawler/i,
    /scraper/i,
    /python/i,
    /requests/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(userAgent));
}

// Main security middleware
export function withSecurity(
  handler: (req: ApiRequest) => Promise<NextResponse>,
  options: SecurityMiddlewareOptions = {}
) {
  return async (request: Request): Promise<NextResponse> => {
    // Convert Request to NextRequest/ApiRequest for internal use
    const apiRequest = request as unknown as ApiRequest;
    const startTime = Date.now();
    apiRequest.startTime = startTime;
    
    try {
      // Get client IP
      const clientIP = getClientIP(apiRequest);
      apiRequest.clientIP = clientIP;

      // Log request if enabled
      if (options.logRequests !== false) {
        console.log(`${apiRequest.method} ${apiRequest.url} from ${clientIP}`);
      }

      // Validate request size
      if (!validateRequestSize(apiRequest)) {
        securityMonitor.trackSecurityEvent({
          type: 'oversized_request',
          severity: 'warning',
          message: 'Request size exceeds limit',
          data: {
            url: request.url,
            contentLength: request.headers.get('content-length'),
            ip: clientIP,
          },
        });
        
        return NextResponse.json(
          { error: 'Request too large' },
          { status: 413 }
        );
      }
      
      // Check user agent for suspicious patterns
      const userAgent = request.headers.get('user-agent') || '';
      if (checkUserAgent(userAgent)) {
        securityMonitor.trackSecurityEvent({
          type: 'suspicious_user_agent',
          severity: 'warning',
          message: 'Suspicious user agent detected',
          data: {
            userAgent,
            ip: clientIP,
            url: request.url,
          },
        });
      }
      
      // Rate limiting
      const rateLimitConfig = options.rateLimit || securityConfig.rateLimit;
      const rateLimitResult = await rateLimiter.check(clientIP, rateLimitConfig);
      request.rateLimitResult = rateLimitResult;
      
      if (!rateLimitResult.success) {
        securityMonitor.trackSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'warning',
          message: 'Rate limit exceeded',
          data: {
            ip: clientIP,
            url: request.url,
            limit: rateLimitResult.limit,
            resetTime: rateLimitResult.reset,
          },
        });
        
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
            },
          }
        );
      }
      
      // Input validation for POST/PUT requests
      if (options.validateInput !== false && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const body = await request.clone().text();
          if (body) {
            // Check for suspicious patterns in request body
            if (detectSuspiciousPatterns(body)) {
              securityMonitor.trackSecurityEvent({
                type: 'malicious_input',
                severity: 'critical',
                message: 'Malicious input detected in request body',
                data: {
                  ip: clientIP,
                  url: request.url,
                  suspiciousContent: body.substring(0, 200),
                },
              });
              
              return NextResponse.json(
                { error: 'Invalid input detected' },
                { status: 400 }
              );
            }
          }
        } catch (error) {
          console.warn('Failed to validate request body:', error);
        }
      }
      
      // Call the actual handler
      const response = await handler(request);
      
      // Track performance if enabled
      if (options.enablePerformanceTracking !== false) {
        const endTime = Date.now();
        const success = response.status < 400;
        
        performanceMonitor.trackApiCall(
          request.url,
          startTime,
          endTime,
          success
        );
      }
      
      // Add security headers to response
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'origin-when-cross-origin',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
      };
      
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
      
    } catch (error) {
      // Track security event for unexpected errors
      securityMonitor.trackSecurityEvent({
        type: 'api_error',
        severity: 'warning',
        message: 'Unexpected API error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: request.url,
          ip: request.clientIP,
        },
      });
      
      console.error('Security middleware error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Specific middleware for chat API
export function withChatSecurity(
  handler: (req: ApiRequest) => Promise<NextResponse>
) {
  return withSecurity(handler, {
    rateLimit: securityConfig.apiSecurity.chatRateLimit,
    validateInput: true,
    logRequests: true,
    enablePerformanceTracking: true,
  });
}

// Specific middleware for general API routes
export function withApiSecurity(
  handler: (req: ApiRequest) => Promise<NextResponse>
) {
  return withSecurity(handler, {
    rateLimit: securityConfig.apiSecurity.generalRateLimit,
    validateInput: true,
    logRequests: true,
    enablePerformanceTracking: true,
  });
}

// Middleware for authentication-required routes
export function withAuthSecurity(
  handler: (req: ApiRequest) => Promise<NextResponse>
) {
  return withSecurity(async (request: ApiRequest) => {
    // Check for authentication token/session
    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session');
    const supabaseAuthCookie = hasSupabaseAuthCookie(request);
    
    if (!authHeader && !sessionCookie && !supabaseAuthCookie) {
      securityMonitor.trackSecurityEvent({
        type: 'unauthorized_access_attempt',
        severity: 'warning',
        message: 'Unauthorized access attempt',
        data: {
          url: request.url,
          ip: request.clientIP,
          userAgent: request.headers.get('user-agent'),
        },
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return handler(request);
  }, {
    requireAuth: true,
    validateInput: true,
    logRequests: true,
    enablePerformanceTracking: true,
  });
}

// Input validation middleware
export async function validateAndSanitizeInput(
  request: Request | NextRequest,
  maxLength: number = securityConfig.validation.maxLengths.chatMessage
): Promise<{ valid: boolean; sanitized?: any; error?: string }> {
  try {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return { valid: true, sanitized: null };
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      
      // Recursively sanitize object properties
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          const sanitized = sanitizeInput(obj, maxLength);
          
          // Check for suspicious patterns
          if (detectSuspiciousPatterns(sanitized)) {
            throw new Error('Suspicious content detected');
          }
          
          return sanitized;
        } else if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        } else if (obj && typeof obj === 'object') {
          const sanitizedObj: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitizedObj[key] = sanitizeObject(value);
          }
          return sanitizedObj;
        }
        return obj;
      };
      
      const sanitized = sanitizeObject(body);
      return { valid: true, sanitized };
      
    } else if (contentType.includes('text/')) {
      const text = await request.text();
      const sanitized = sanitizeInput(text, maxLength);
      
      if (detectSuspiciousPatterns(sanitized)) {
        return { valid: false, error: 'Suspicious content detected' };
      }
      
      return { valid: true, sanitized };
    }

    return { valid: true, sanitized: null };

  } catch (error) {
    return {
      valid: false,
      sanitized: null,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}

// CORS middleware
export function withCORS(
  handler: (req: ApiRequest) => Promise<NextResponse>
) {
  return async (request: ApiRequest): Promise<NextResponse> => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': securityConfig.apiSecurity.cors.origin.includes(request.headers.get('origin') || '') 
            ? request.headers.get('origin') || '*' 
            : 'null',
          'Access-Control-Allow-Methods': securityConfig.apiSecurity.cors.methods.join(', '),
          'Access-Control-Allow-Headers': securityConfig.apiSecurity.cors.allowedHeaders.join(', '),
          'Access-Control-Allow-Credentials': securityConfig.apiSecurity.cors.credentials.toString(),
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }
    
    const response = await handler(request);
    
    // Add CORS headers to response
    response.headers.set(
      'Access-Control-Allow-Origin',
      securityConfig.apiSecurity.cors.origin.includes(request.headers.get('origin') || '')
        ? request.headers.get('origin') || '*'
        : 'null'
    );
    response.headers.set('Access-Control-Allow-Credentials', securityConfig.apiSecurity.cors.credentials.toString());
    
    return response;
  };
}

// Create API monitoring endpoints
export async function createMonitoringEndpoints() {
  return {
    // Performance metrics endpoint
    '/api/monitoring/metrics': withApiSecurity(async (request: ApiRequest) => {
      if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      }
      
      const metrics = await request.json();
      console.log('Performance metric received:', metrics);
      
      // In production, send to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Send metrics to external monitoring service
        // await sendToMonitoringService(metrics);
      }
      
      return NextResponse.json({ success: true });
    }),
    
    // Performance alerts endpoint
    '/api/monitoring/performance-alert': withApiSecurity(async (request: ApiRequest) => {
      if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      }
      
      const alert = await request.json();
      console.warn('Performance alert received:', alert);
      
      // In production, send alert to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // await sendAlertToMonitoringService(alert);
      }
      
      return NextResponse.json({ success: true });
    }),
    
    // Security events endpoint
    '/api/security/event': withApiSecurity(async (request: ApiRequest) => {
      if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      }
      
      const event = await request.json();
      console.log('Security event received:', event);
      
      // In production, send to security monitoring service
      if (process.env.NODE_ENV === 'production') {
        // await sendToSecurityService(event);
      }
      
      return NextResponse.json({ success: true });
    }),
    
    // Security alerts endpoint
    '/api/security/alert': withApiSecurity(async (request: ApiRequest) => {
      if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      }
      
      const alert = await request.json();
      console.warn('Security alert received:', alert);
      
      // In production, send alert to security team
      if (process.env.NODE_ENV === 'production') {
        // await sendSecurityAlert(alert);
      }
      
      return NextResponse.json({ success: true });
    }),
    
    // CSP violation endpoint
    '/api/security/csp-violation': withApiSecurity(async (request: ApiRequest) => {
      if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
      }
      
      const violation = await request.json();
      console.warn('CSP violation received:', violation);
      
      // In production, send to security monitoring service
      if (process.env.NODE_ENV === 'production') {
        // await reportCSPViolation(violation);
      }
      
      return NextResponse.json({ success: true });
    }),
  };
}

export default withSecurity;
