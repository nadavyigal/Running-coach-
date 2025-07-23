import { NextResponse } from 'next/server';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: Record<string, unknown>) {
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

export class NetworkError extends Error implements ApiError {
  statusCode = 503;
  code = 'NETWORK_ERROR';
  
  constructor(message = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class OfflineError extends Error implements ApiError {
  statusCode = 503;
  code = 'OFFLINE_ERROR';
  
  constructor(message = 'Application is offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export class AIServiceError extends Error implements ApiError {
  statusCode = 502;
  code = 'AI_SERVICE_ERROR';
  
  constructor(message = 'AI service is temporarily unavailable') {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Error response formatter
export function formatErrorResponse(error: ApiError | Error): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

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

  const response: Record<string, unknown> = {
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

// Validation helpers
export function validateRequired(data: Record<string, unknown>, fields: string[]): void {
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

export function validateEnum(value: unknown, enumValues: string[], fieldName: string): void {
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

export function sanitizeUserData(data: unknown): unknown {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeUserData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeUserData(value);
    }
    return sanitized;
  }
  
  return data;
}

// Request logging for debugging
export function logRequest(req: Request, additionalInfo?: Record<string, unknown>): void {
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

// Client-side error handling utilities

export interface ClientErrorInfo {
  error: Error
  errorType: 'network' | 'database' | 'ai_service' | 'validation' | 'offline' | 'unknown'
  userMessage: string
  canRetry: boolean
  suggestedAction?: string
  fallbackOptions?: string[]
}

/**
 * Analyze error and provide user-friendly information
 */
export function analyzeError(error: Error): ClientErrorInfo {
  // Network errors
  if (isNetworkErrorClient(error)) {
    return {
      error,
      errorType: 'network',
      userMessage: 'Connection failed. Please check your internet connection.',
      canRetry: true,
      suggestedAction: 'Check your network connection and try again',
      fallbackOptions: ['Try again later', 'Check network settings']
    }
  }

  // Offline errors
  if (isOfflineError(error) || !navigator.onLine) {
    return {
      error,
      errorType: 'offline',
      userMessage: 'You appear to be offline. Some features may not be available.',
      canRetry: false,
      suggestedAction: 'Connect to the internet to continue',
      fallbackOptions: ['Work offline with limited features', 'Try again when online']
    }
  }

  // AI service errors
  if (isAIServiceError(error)) {
    return {
      error,
      errorType: 'ai_service',
      userMessage: 'AI service is temporarily unavailable.',
      canRetry: true,
      suggestedAction: 'Continue with guided form setup',
      fallbackOptions: ['Use guided form', 'Try AI chat later']
    }
  }

  // Database errors
  if (isDatabaseError(error)) {
    return {
      error,
      errorType: 'database',
      userMessage: 'Unable to save your data right now.',
      canRetry: true,
      suggestedAction: 'Your progress will be saved when connection is restored',
      fallbackOptions: ['Continue anyway', 'Try again']
    }
  }

  // Validation errors
  if (isValidationError(error)) {
    return {
      error,
      errorType: 'validation',
      userMessage: getValidationErrorMessage(error),
      canRetry: false,
      suggestedAction: 'Please correct the highlighted fields',
      fallbackOptions: ['Review your input']
    }
  }

  // Default unknown error
  return {
    error,
    errorType: 'unknown',
    userMessage: 'Something went wrong. Please try again.',
    canRetry: true,
    suggestedAction: 'Try again or contact support if the problem persists',
    fallbackOptions: ['Try again', 'Contact support']
  }
}

/**
 * Check if error is a network error (client-side)
 */
function isNetworkErrorClient(error: Error): boolean {
  const networkIndicators = [
    'fetch',
    'network',
    'connection',
    'timeout',
    'failed to fetch',
    'network request failed',
    'load failed',
    'net::',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED'
  ]
  
  return networkIndicators.some(indicator => 
    error.message.toLowerCase().includes(indicator.toLowerCase()) ||
    error.name.toLowerCase().includes(indicator.toLowerCase())
  )
}

/**
 * Check if error is an offline error
 */
function isOfflineError(error: Error): boolean {
  return error instanceof OfflineError ||
         error.message.toLowerCase().includes('offline') ||
         error.message.toLowerCase().includes('no network')
}

/**
 * Check if error is an AI service error
 */
function isAIServiceError(error: Error): boolean {
  return error instanceof AIServiceError ||
         error.message.toLowerCase().includes('ai service') ||
         error.message.toLowerCase().includes('openai') ||
         error.message.toLowerCase().includes('model') ||
         error.message.includes('503')
}

/**
 * Check if error is a database error
 */
function isDatabaseError(error: Error): boolean {
  return error instanceof DatabaseError ||
         error.message.toLowerCase().includes('database') ||
         error.message.toLowerCase().includes('storage') ||
         error.message.toLowerCase().includes('indexeddb')
}

/**
 * Check if error is a validation error
 */
function isValidationError(error: Error): boolean {
  return error instanceof ValidationError ||
         error.message.toLowerCase().includes('validation') ||
         error.message.toLowerCase().includes('invalid') ||
         error.message.toLowerCase().includes('required')
}

/**
 * Get user-friendly validation error message
 */
function getValidationErrorMessage(error: Error): string {
  if (error.message.includes('age')) {
    return 'Please enter a valid age between 10 and 100.'
  }
  if (error.message.includes('goal')) {
    return 'Please select a running goal to continue.'
  }
  if (error.message.includes('experience')) {
    return 'Please select your running experience level.'
  }
  if (error.message.includes('consent')) {
    return 'Please accept the required terms to continue.'
  }
  if (error.message.includes('time')) {
    return 'Please select at least one preferred running time.'
  }
  
  return error.message || 'Please check your input and try again.'
}

/**
 * Network status detection
 */
export class NetworkStatusMonitor {
  private listeners: Array<(isOnline: boolean) => void> = []
  private isOnline: boolean = true

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      
      window.addEventListener('online', this.handleOnline.bind(this))
      window.addEventListener('offline', this.handleOffline.bind(this))
    }
  }

  private handleOnline() {
    this.isOnline = true
    this.notifyListeners(true)
  }

  private handleOffline() {
    this.isOnline = false
    this.notifyListeners(false)
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline))
  }

  public onStatusChange(callback: (isOnline: boolean) => void) {
    this.listeners.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  public getStatus(): boolean {
    return this.isOnline
  }

  public async checkConnectivity(): Promise<boolean> {
    if (!this.isOnline) {
      return false
    }

    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Global network status monitor
export const networkStatus = new NetworkStatusMonitor()

/**
 * Storage fallback for offline mode
 */
export class OfflineStorage {
  private readonly STORAGE_KEY = 'offline_data'
  
  public saveData(key: string, data: unknown): void {
    try {
      const offlineData = this.getStorageData()
      offlineData[key] = {
        data,
        timestamp: Date.now(),
        synced: false
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(offlineData))
    } catch (error) {
      console.warn('Failed to save offline data:', error)
    }
  }

  public getData(key: string): unknown | null {
    try {
      const offlineData = this.getStorageData()
      const item = offlineData[key]
      return item ? item.data : null
    } catch (error) {
      console.warn('Failed to get offline data:', error)
      return null
    }
  }

  public markSynced(key: string): void {
    try {
      const offlineData = this.getStorageData()
      if (offlineData[key]) {
        offlineData[key].synced = true
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(offlineData))
      }
    } catch (error) {
      console.warn('Failed to mark data as synced:', error)
    }
  }

  public getUnsyncedData(): Record<string, unknown> {
    try {
      const offlineData = this.getStorageData()
      const unsynced: Record<string, unknown> = {}
      
      Object.entries(offlineData).forEach(([key, item]) => {
        if (!item.synced) {
          unsynced[key] = item.data
        }
      })
      
      return unsynced
    } catch (error) {
      console.warn('Failed to get unsynced data:', error)
      return {}
    }
  }

  private getStorageData(): Record<string, {data: unknown, timestamp: number, synced: boolean}> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }
}

// Global offline storage
export const offlineStorage = new OfflineStorage()

/**
 * Error recovery suggestions based on error type
 */
export function getRecoveryActions(errorInfo: ClientErrorInfo): Array<{
  label: string
  action: () => void
  primary?: boolean
}> {
  const actions: Array<{label: string, action: () => void, primary?: boolean}> = []

  switch (errorInfo.errorType) {
    case 'network':
      actions.push(
        { label: 'Try Again', action: () => window.location.reload(), primary: true },
        { label: 'Check Connection', action: () => alert('Please check your internet connection') }
      )
      break

    case 'offline':
      actions.push(
        { label: 'Continue Offline', action: () => {}, primary: true },
        { label: 'Refresh When Online', action: () => window.location.reload() }
      )
      break

    case 'ai_service':
      actions.push(
        { label: 'Use Guided Form', action: () => {}, primary: true },
        { label: 'Try AI Later', action: () => {} }
      )
      break

    case 'database':
      actions.push(
        { label: 'Continue', action: () => {}, primary: true },
        { label: 'Try Again', action: () => window.location.reload() }
      )
      break

    case 'validation':
      actions.push(
        { label: 'Fix Errors', action: () => {}, primary: true }
      )
      break

    default:
      actions.push(
        { label: 'Try Again', action: () => window.location.reload(), primary: true },
        { label: 'Report Issue', action: () => {} }
      )
  }

  return actions
}