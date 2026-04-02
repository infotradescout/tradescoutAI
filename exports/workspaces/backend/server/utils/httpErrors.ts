/**
 * Centralized HTTP Error Handling Utility
 * Phase 4: HTTP 500→4xx Semantics Cleanup
 * 
 * Purpose: Ensure 500s are reserved exclusively for server faults.
 * All client/guard/validation outcomes must return appropriate 4xx.
 */

import { Response } from 'express';

// Error severity levels for logging
export enum ErrorSeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// Error categories mapped to HTTP status codes
export enum HttpStatus {
  // 4xx Client Errors (log at INFO/WARN - no pager)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  
  // 5xx Server Errors (log at ERROR/CRITICAL - paging candidates)
  INTERNAL_SERVER_ERROR = 500,
}

interface ErrorResponse {
  message: string;
  error?: string;
  details?: any;
  timestamp?: string;
}

interface ErrorLogEntry {
  type: string;
  severity: ErrorSeverity;
  statusCode: number;
  message: string;
  userId?: number;
  path?: string;
  details?: any;
  timestamp: string;
}

/**
 * Map HTTP status code to appropriate log severity
 */
function getLogSeverity(statusCode: number): ErrorSeverity {
  if (statusCode >= 500) {
    return ErrorSeverity.CRITICAL;
  }
  if (statusCode === 429 || statusCode === 409) {
    return ErrorSeverity.WARN;
  }
  return ErrorSeverity.INFO;
}

/**
 * Log error with appropriate severity and structure
 */
function logError(entry: ErrorLogEntry): void {
  const logLine = JSON.stringify(entry);
  
  switch (entry.severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.ERROR:
      console.error(logLine);
      break;
    case ErrorSeverity.WARN:
      console.warn(logLine);
      break;
    case ErrorSeverity.INFO:
    default:
      console.log(logLine);
      break;
  }
}

/**
 * Send error response with consistent format and logging
 */
export function sendError(
  res: Response,
  statusCode: HttpStatus,
  message: string,
  options?: {
    error?: string;
    details?: any;
    userId?: number;
    path?: string;
  }
): void {
  const severity = getLogSeverity(statusCode);
  
  // Log with structured format
  logError({
    type: 'http.error',
    severity,
    statusCode,
    message,
    userId: options?.userId,
    path: options?.path || res.req?.path,
    details: options?.details,
    timestamp: new Date().toISOString(),
  });
  
  // Send response
  const response: ErrorResponse = {
    message,
    ...(options?.error && { error: options.error }),
    ...(options?.details && { details: options.details }),
  };
  
  res.status(statusCode).json(response);
}

/**
 * 400 - Bad Request
 * Missing required fields, invalid payload shape, malformed JSON
 */
export function sendBadRequest(res: Response, message: string = 'Bad request', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.BAD_REQUEST, message, options);
}

/**
 * 401 - Unauthorized
 * Missing/expired auth, invalid token/session
 */
export function sendUnauthorized(res: Response, message: string = 'Unauthorized', options?: { error?: string; details?: any }): void {
  sendError(res, HttpStatus.UNAUTHORIZED, message, options);
}

/**
 * 403 - Forbidden
 * Authenticated but not allowed (admin-only endpoints accessed by non-admin)
 */
export function sendForbidden(res: Response, message: string = 'Forbidden', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.FORBIDDEN, message, options);
}

/**
 * 404 - Not Found
 * Non-existent resource IDs, unknown routes (API-level)
 */
export function sendNotFound(res: Response, message: string = 'Not found', options?: { error?: string; details?: any }): void {
  sendError(res, HttpStatus.NOT_FOUND, message, options);
}

/**
 * 409 - Conflict
 * Duplicate submissions, idempotency violations (safe retries)
 */
export function sendConflict(res: Response, message: string = 'Conflict', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.CONFLICT, message, options);
}

/**
 * 422 - Unprocessable Entity
 * Semantically invalid but well-formed requests, failed domain validation
 */
export function sendUnprocessableEntity(res: Response, message: string = 'Unprocessable entity', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.UNPROCESSABLE_ENTITY, message, options);
}

/**
 * 429 - Too Many Requests
 * Rate limits, bot protection triggers
 */
export function sendTooManyRequests(res: Response, message: string = 'Too many requests', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.TOO_MANY_REQUESTS, message, options);
}

/**
 * 500 - Internal Server Error (STRICT)
 * Unhandled exceptions, invariant violations, DB failures, external dependency failures
 * 
 * WARNING: Only use for TRUE server faults. Client/validation errors are 4xx.
 */
export function sendInternalServerError(res: Response, message: string = 'Internal server error', options?: { error?: string; details?: any; userId?: number }): void {
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, message, options);
}

/**
 * Auto-classify error based on error object/message
 * Fallback for try/catch blocks where error type is known
 */
export function sendAutoClassifiedError(
  res: Response,
  error: any,
  fallbackMessage: string = 'An error occurred',
  options?: { userId?: number; path?: string }
): void {
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack;
  
  // Classification heuristics
  if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    sendNotFound(res, fallbackMessage, { error: errorMessage, details: errorStack, ...options });
  } else if (errorMessage.includes('unauthorized') || errorMessage.includes('not authenticated')) {
    sendUnauthorized(res, fallbackMessage, { error: errorMessage, ...options });
  } else if (errorMessage.includes('forbidden') || errorMessage.includes('not allowed')) {
    sendForbidden(res, fallbackMessage, { error: errorMessage, ...options });
  } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
    sendConflict(res, fallbackMessage, { error: errorMessage, ...options });
  } else if (errorMessage.includes('invalid') || errorMessage.includes('validation failed')) {
    sendUnprocessableEntity(res, fallbackMessage, { error: errorMessage, ...options });
  } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    sendTooManyRequests(res, fallbackMessage, { error: errorMessage, ...options });
  } else {
    // Default to 500 for unknown errors (true server faults)
    sendInternalServerError(res, fallbackMessage, { error: errorMessage, details: errorStack, ...options });
  }
}
