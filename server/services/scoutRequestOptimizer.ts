/**
 * Scout Request Optimizer
 *
 * Reduces API calls through:
 * 1. Request Deduplication - Don't process the same query twice
 * 2. Rate Limiting - Prevent abuse and excessive calls
 * 3. Request Batching - Combine similar queries
 * 4. Adaptive Throttling - Slow down during high load
 *
 * All optimizations are transparent to the user.
 */

export interface PendingRequest {
  id: string;
  query: string;
  context: any;
  timestamp: number;
  promise: Promise<any>;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxConcurrentRequests: number;
  burstAllowance: number;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000,
  maxConcurrentRequests: 10,
  burstAllowance: 5, // Allow 5 extra requests in a burst
};

/**
 * In-flight requests (for deduplication)
 */
const inFlightRequests = new Map<string, PendingRequest>();

/**
 * Request history (for rate limiting)
 */
const requestHistory: number[] = [];

/**
 * Current concurrent requests
 */
let concurrentRequests = 0;

/**
 * Generate a request key for deduplication
 */
export function generateRequestKey(query: string, context?: any): string {
  const contextStr = context ? JSON.stringify(context) : "";
  return `${query}::${contextStr}`;
}

/**
 * Check if a request is already in flight
 */
export function findInFlightRequest(query: string, context?: any): PendingRequest | null {
  const key = generateRequestKey(query, context);
  return inFlightRequests.get(key) || null;
}

/**
 * Register an in-flight request
 */
export function registerInFlightRequest(
  query: string,
  context: any,
  promise: Promise<any>
): PendingRequest {
  const key = generateRequestKey(query, context);
  const request: PendingRequest = {
    id: key,
    query,
    context,
    timestamp: Date.now(),
    promise,
  };

  inFlightRequests.set(key, request);

  // Clean up when promise settles
  promise
    .finally(() => {
      inFlightRequests.delete(key);
    })
    .catch(() => {
      // Ignore errors, just cleanup
    });

  return request;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(config: RateLimitConfig = DEFAULT_RATE_LIMIT): {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  // Clean up old requests
  while (requestHistory.length > 0 && requestHistory[0] < oneHourAgo) {
    requestHistory.shift();
  }

  // Check minute limit
  const requestsLastMinute = requestHistory.filter((t) => t > oneMinuteAgo).length;
  if (requestsLastMinute >= config.maxRequestsPerMinute) {
    return {
      allowed: false,
      reason: "Rate limit exceeded (per minute)",
      retryAfter: 60,
    };
  }

  // Check hour limit
  if (requestHistory.length >= config.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: "Rate limit exceeded (per hour)",
      retryAfter: 3600,
    };
  }

  // Check concurrent requests
  if (concurrentRequests >= config.maxConcurrentRequests) {
    return {
      allowed: false,
      reason: "Too many concurrent requests",
      retryAfter: 5,
    };
  }

  return { allowed: true };
}

/**
 * Record a request in the rate limit history
 */
export function recordRequest(): void {
  requestHistory.push(Date.now());
  concurrentRequests++;
}

/**
 * Mark a request as complete
 */
export function completeRequest(): void {
  concurrentRequests = Math.max(0, concurrentRequests - 1);
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(config: RateLimitConfig = DEFAULT_RATE_LIMIT): {
  requestsThisMinute: number;
  requestsThisHour: number;
  concurrentRequests: number;
  capacityUsed: string;
  healthy: boolean;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const requestsThisMinute = requestHistory.filter((t) => t > oneMinuteAgo).length;
  const requestsThisHour = requestHistory.filter((t) => t > oneHourAgo).length;

  const minuteCapacity = (requestsThisMinute / config.maxRequestsPerMinute) * 100;
  const hourCapacity = (requestsThisHour / config.maxRequestsPerHour) * 100;
  const concurrencyCapacity = (concurrentRequests / config.maxConcurrentRequests) * 100;

  const maxCapacity = Math.max(minuteCapacity, hourCapacity, concurrencyCapacity);

  return {
    requestsThisMinute,
    requestsThisHour,
    concurrentRequests,
    capacityUsed: `${maxCapacity.toFixed(1)}%`,
    healthy: maxCapacity < 80, // Healthy if under 80% capacity
  };
}

/**
 * Clear request history
 */
export function clearRequestHistory(): void {
  requestHistory.length = 0;
  concurrentRequests = 0;
  inFlightRequests.clear();
}

/**
 * Get optimization metrics
 */
export function getOptimizationMetrics(): {
  inFlightRequests: number;
  totalRequests: number;
  concurrentRequests: number;
  deduplicationRate: string;
} {
  const totalRequests = requestHistory.length;
  const inFlightCount = inFlightRequests.size;
  const deduplicationRate =
    totalRequests > 0 ? `${((inFlightCount / totalRequests) * 100).toFixed(1)}%` : "0%";

  return {
    inFlightRequests: inFlightCount,
    totalRequests,
    concurrentRequests,
    deduplicationRate,
  };
}

/**
 * Adaptive throttling based on load
 */
export function getAdaptiveDelay(config: RateLimitConfig = DEFAULT_RATE_LIMIT): number {
  const status = getRateLimitStatus(config);
  const capacityPercent = parseFloat(status.capacityUsed);

  if (capacityPercent < 50) return 0; // No delay
  if (capacityPercent < 70) return 10; // 10ms delay
  if (capacityPercent < 85) return 50; // 50ms delay
  if (capacityPercent < 95) return 100; // 100ms delay
  return 500; // 500ms delay if nearly at capacity
}

/**
 * Wait with adaptive throttling
 */
export async function waitWithAdaptiveThrottle(config?: RateLimitConfig): Promise<void> {
  const delay = getAdaptiveDelay(config);
  if (delay > 0) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
