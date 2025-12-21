/**
 * Centralized Error Handling Middleware
 * 
 * Provides consistent error handling, logging, and response formatting
 * across all API routes to eliminate duplicate error handling patterns.
 */

import { NextResponse } from 'next/server';
import { ApiRequest } from './security.middleware';

// Error types for categorization
export type ErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR' 
  | 'AUTHORIZATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'API_KEY_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'GENERATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED';

// Structured error interface
export interface ApiError {
  type: ErrorType;
  message: string;
  status: number;
  code?: string;
  details?: any;
  fallbackRequired?: boolean;
  retryable?: boolean;
}

// Known error patterns and their mappings
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  type: ErrorType;
  status: number;
  message: string;
  retryable: boolean;
}> = [
  // AI Service Errors
  {
    pattern: /rate.?limit|too.?many.?requests/i,
    type: 'RATE_LIMIT_ERROR',
    status: 429,
    message: 'API rate limit exceeded. Please try again later.',
    retryable: true
  },
  {
    pattern: /api.?key|unauthorized|authentication/i,
    type: 'API_KEY_ERROR',
    status: 503,
    message: 'AI service authentication failed. Please contact support.',
    retryable: false
  },
  {
    pattern: /timeout|timed.?out/i,
    type: 'TIMEOUT_ERROR',
    status: 408,
    message: 'Request timed out. Please try again.',
    retryable: true
  },
  {
    pattern: /network|fetch|connection/i,
    type: 'NETWORK_ERROR',
    status: 503,
    message: 'Network connection failed. Please check your internet and try again.',
    retryable: true
  },
  
  // Database Errors
  {
    pattern: /database|db|dexie|indexeddb/i,
    type: 'DATABASE_ERROR',
    status: 500,
    message: 'Database operation failed. Please try again.',
    retryable: true
  },
  
  // Validation Errors
  {
    pattern: /validation|invalid.?input|malformed/i,
    type: 'VALIDATION_ERROR',
    status: 400,
    message: 'Invalid input provided.',
    retryable: false
  },
  
  // Service Errors
  {
    pattern: /service.?unavailable|temporarily.?unavailable/i,
    type: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'Service temporarily unavailable. Please try again later.',
    retryable: true
  }
];

/**
 * Categorize error based on message and context
 */
function categorizeError(error: any, context?: string): ApiError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Check against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        type: pattern.type,
        message: pattern.message,
        status: pattern.status,
        retryable: pattern.retryable,
        details: process.env.NODE_ENV === 'development' ? { 
          originalMessage: errorMessage,
          stack: errorStack,
          context 
        } : undefined
      };
    }
  }
  
  // Default categorization
  return {
    type: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    status: 500,
    retryable: true,
    details: process.env.NODE_ENV === 'development' ? { 
      originalMessage: errorMessage,
      stack: errorStack,
      context 
    } : undefined
  };
}

/**
 * Format error response consistently
 */
function formatErrorResponse(apiError: ApiError): NextResponse {
  const response = {
    error: apiError.message,
    errorType: apiError.type,
    ...(apiError.code && { code: apiError.code }),
    ...(apiError.fallbackRequired && { fallbackRequired: apiError.fallbackRequired }),
    ...(apiError.retryable && { retryable: apiError.retryable }),
    ...(apiError.details && { details: apiError.details })
  };
  
  return NextResponse.json(response, { status: apiError.status });
}

/**
 * Log error securely (without exposing sensitive data)
 */
function logError(error: any, context: string, request?: ApiRequest): void {
  const errorId = Math.random().toString(36).substr(2, 9);
  const timestamp = new Date().toISOString();
  
  console.error(`❌ [${errorId}] Error in ${context} at ${timestamp}`);
  console.error(`❌ [${errorId}] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
  console.error(`❌ [${errorId}] Error message:`, error instanceof Error ? error.message : String(error));
  
  if (request) {
    console.error(`❌ [${errorId}] Request URL:`, request.url);
    console.error(`❌ [${errorId}] Request method:`, request.method);
    console.error(`❌ [${errorId}] Client IP:`, request.clientIP || 'unknown');
  }
  
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
    console.error(`❌ [${errorId}] Stack trace:`, error.stack);
  }
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to external logging service
    // await sendToLoggingService({ errorId, error, context, request });
  }
}

/**
 * Main error handling wrapper
 */
export function withErrorHandling(
  handler: (req: ApiRequest) => Promise<NextResponse>,
  context: string = 'API'
) {
  return async (request: ApiRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      // Log the error securely
      logError(error, context, request);
      
      // Categorize and format the error
      const apiError = categorizeError(error, context);
      
      // Return formatted error response
      return formatErrorResponse(apiError);
    }
  };
}

/**
 * Database operation error handler
 */
export function handleDatabaseError(error: any, operation: string): ApiError {
  logError(error, `Database.${operation}`);
  
  return {
    type: 'DATABASE_ERROR',
    message: 'Database operation failed. Please try again.',
    status: 500,
    retryable: true,
    details: process.env.NODE_ENV === 'development' ? {
      operation,
      originalMessage: error instanceof Error ? error.message : String(error)
    } : undefined
  };
}

/**
 * Validation error handler
 */
export function handleValidationError(issues: any[], context: string = 'Input'): ApiError {
  logError({ message: 'Validation failed', issues }, `Validation.${context}`);
  
  return {
    type: 'VALIDATION_ERROR',
    message: 'Invalid input provided.',
    status: 400,
    retryable: false,
    details: process.env.NODE_ENV === 'development' ? { issues } : undefined
  };
}

/**
 * AI service error handler
 */
export function handleAIServiceError(error: any, service: string = 'OpenAI'): ApiError {
  logError(error, `AI.${service}`);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for specific AI service errors
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      type: 'RATE_LIMIT_ERROR',
      message: 'AI service rate limit exceeded. Please try again later.',
      status: 429,
      retryable: true,
      fallbackRequired: true
    };
  }
  
  if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
    return {
      type: 'API_KEY_ERROR',
      message: 'AI service authentication failed. Please contact support.',
      status: 503,
      retryable: false,
      fallbackRequired: true
    };
  }
  
  return {
    type: 'AI_SERVICE_ERROR',
    message: 'AI service temporarily unavailable. Please try again later.',
    status: 503,
    retryable: true,
    fallbackRequired: true
  };
}

/**
 * Timeout error handler
 */
export function handleTimeoutError(timeoutMs: number, operation: string): ApiError {
  logError({ message: `Operation timed out after ${timeoutMs}ms` }, `Timeout.${operation}`);
  
  return {
    type: 'TIMEOUT_ERROR',
    message: 'Request timed out. Please try again with a shorter message.',
    status: 408,
    retryable: true
  };
}

/**
 * Create standardized error responses for common scenarios
 */
export const ErrorResponses = {
  methodNotAllowed: (allowedMethods: string[] = []): NextResponse => 
    formatErrorResponse({
      type: 'METHOD_NOT_ALLOWED',
      message: `Method not allowed. ${allowedMethods.length > 0 ? `Allowed: ${allowedMethods.join(', ')}` : ''}`,
      status: 405,
      retryable: false
    }),
  
  notFound: (resource: string = 'Resource'): NextResponse =>
    formatErrorResponse({
      type: 'NOT_FOUND',
      message: `${resource} not found.`,
      status: 404,
      retryable: false
    }),
  
  unauthorized: (): NextResponse =>
    formatErrorResponse({
      type: 'AUTHENTICATION_ERROR',
      message: 'Authentication required.',
      status: 401,
      retryable: false
    }),
  
  forbidden: (): NextResponse =>
    formatErrorResponse({
      type: 'AUTHORIZATION_ERROR',
      message: 'Access denied.',
      status: 403,
      retryable: false
    }),
  
  badRequest: (message: string = 'Invalid request'): NextResponse =>
    formatErrorResponse({
      type: 'VALIDATION_ERROR',
      message,
      status: 400,
      retryable: false
    }),
  
  serviceUnavailable: (service: string = 'Service', fallbackRequired: boolean = false): NextResponse =>
    formatErrorResponse({
      type: 'SERVICE_UNAVAILABLE',
      message: `${service} temporarily unavailable. Please try again later.`,
      status: 503,
      retryable: true,
      fallbackRequired
    })
};

export default withErrorHandling;
