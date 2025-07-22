import { NextResponse } from 'next/server';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends Error implements ApiError {
  statusCode = 502;
  code = 'EXTERNAL_SERVICE_ERROR';
  
  constructor(service: string, message?: string) {
    super(message || `${service} service is unavailable`);
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends Error implements ApiError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  
  constructor(resetTime?: Date) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.details = { resetTime };
  }
}

export class DatabaseError extends Error implements ApiError {
  statusCode = 500;
  code = 'DATABASE_ERROR';
  
  constructor(operation: string, originalError?: Error) {
    super(`Database ${operation} failed`);
    this.name = 'DatabaseError';
    this.details = { originalError: originalError?.message };
  }
}

// Error response formatter
export function formatErrorResponse(error: ApiError | Error): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (error instanceof ValidationError || 
      error instanceof NotFoundError || 
      error instanceof UnauthorizedError ||
      error instanceof ConflictError ||
      error instanceof ExternalServiceError ||
      error instanceof RateLimitError ||
      error instanceof DatabaseError) {
    statusCode = error.statusCode!;
    code = error.code!;
    message = error.message;
    details = error.details;
  } else {
    // Log unexpected errors
    console.error('Unexpected error:', error);
  }

  const response: any = {
    success: false,
    error: message,
    code
  };

  // Include details in development or for client-safe errors
  if (details && (isDevelopment || statusCode < 500)) {
    response.details = details;
  }

  // Include stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return NextResponse.json(response, { status: statusCode });
}

// API error handler decorator
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return formatErrorResponse(error as ApiError);
    }
  };
}

// Validation helpers
export function validateRequired(data: any, fields: string[]): void {
  const missing = fields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}

export function validateEnum(value: any, enumValues: string[], fieldName: string): void {
  if (!enumValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be one of: ${enumValues.join(', ')}`,
      { validValues: enumValues, received: value }
    );
  }
}

export function validateRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new ValidationError(
      `${fieldName} must be between ${min} and ${max}`,
      { min, max, received: value }
    );
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }
}

// Database operation wrapper with error handling
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      // Check for common database errors
      if (error.message.includes('UNIQUE constraint')) {
        throw new ConflictError('Resource already exists');
      }
      if (error.message.includes('FOREIGN KEY constraint')) {
        throw new ValidationError('Invalid reference to related resource');
      }
      if (error.message.includes('NOT NULL constraint')) {
        throw new ValidationError('Required field cannot be empty');
      }
    }
    
    throw new DatabaseError(operationName, error as Error);
  }
}

// External service call wrapper
export async function safeExternalCall<T>(
  call: () => Promise<T>,
  serviceName: string,
  retries = 3,
  retryDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof Response && error.status >= 400 && error.status < 500) {
        throw new ExternalServiceError(serviceName, `${serviceName} returned ${error.status}: ${error.statusText}`);
      }
      
      // Don't retry on the last attempt
      if (attempt === retries) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  throw new ExternalServiceError(serviceName, lastError?.message);
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): void {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    // Reset or initialize
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return;
  }

  if (current.count >= maxRequests) {
    throw new RateLimitError(new Date(current.resetTime));
  }

  current.count++;
  rateLimitMap.set(key, current);
}

// Cleanup old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Cleanup every minute

// User input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}

export function sanitizeUserData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeUserData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeUserData(value);
    }
    return sanitized;
  }
  
  return data;
}

// Request logging for debugging
export function logRequest(req: Request, additionalInfo?: any): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
      ...additionalInfo
    });
  }
}

// Health check utilities
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, {
    status: 'up' | 'down';
    responseTime?: number;
    error?: string;
  }>;
  timestamp: string;
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};
  let overallStatus: HealthCheckResult['status'] = 'healthy';

  // Database check
  try {
    const start = Date.now();
    await import('@/lib/db').then(({ db }) => db.users.limit(1).toArray());
    checks.database = {
      status: 'up',
      responseTime: Date.now() - start
    };
  } catch (error) {
    checks.database = {
      status: 'down',
      error: (error as Error).message
    };
    overallStatus = 'unhealthy';
  }

  // External services check (if needed)
  // Add more health checks as needed

  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString()
  };
}