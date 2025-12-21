import { NextResponse } from 'next/server';
import {
  type ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ExternalServiceError,
  RateLimitError,
  DatabaseError,
} from './errorHandling';

/**
 * Server-only error response formatter.
 * Uses NextResponse and is kept separate so that client bundles
 * can depend on `errorHandling` without pulling in `next/server`.
 */
export function formatErrorResponse(error: ApiError | Error): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError ||
    error instanceof ConflictError ||
    error instanceof ExternalServiceError ||
    error instanceof RateLimitError ||
    error instanceof DatabaseError
  ) {
    statusCode = error.statusCode!;
    code = error.code!;
    message = error.message;
    details = (error as ApiError).details;
  } else {
    // Log unexpected errors
    // eslint-disable-next-line no-console
    console.error('Unexpected error:', error);
  }

  const response: Record<string, unknown> = {
    success: false,
    error: message,
    code,
  };

  // Include details in development or for client-safe errors
  if (details && (isDevelopment || statusCode < 500)) {
    response.details = details;
  }

  // Include stack trace in development
  if (isDevelopment && error instanceof Error && error.stack) {
    response.stack = error.stack;
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Server-only API error handler decorator.
 */
export function withErrorHandling<T extends unknown[], R>(
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

