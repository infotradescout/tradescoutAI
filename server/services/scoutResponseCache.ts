/**
 * Scout Response Cache
 *
 * Intelligently caches Scout responses to reduce API calls and costs.
 * Users get instant answers for common questions without hitting OpenAI.
 *
 * Cache Strategy:
 * - Query normalization (ignore minor variations)
 * - Semantic similarity matching (similar questions get cached answers)
 * - TTL-based expiration (fresh data for time-sensitive queries)
 * - Selective caching (don't cache everything, only high-value queries)
 */

import crypto from "crypto";

export interface CachedResponse {
  query: string;
  queryHash: string;
  response: {
    message: string;
    sources: string[];
    sourceBreakdown: any;
    disclaimers: string[];
  };
  context?: {
    county?: string;
    state?: string;
    trade?: string;
  };
  createdAt: number;
  expiresAt: number;
  hits: number;
  cost?: {
    apiCallsSaved: number;
    estimatedSavings: number;
  };
}

export interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: string;
  totalSavings: number;
  entriesInCache: number;
}

/**
 * In-memory cache store
 * In production, this would be Redis or a database
 */
const cacheStore = new Map<string, CachedResponse>();

/**
 * Normalize a query for caching
 * Removes punctuation, extra spaces, converts to lowercase
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[?!.,;:]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

/**
 * Generate a hash of a normalized query
 */
export function hashQuery(query: string): string {
  const normalized = normalizeQuery(query);
  return crypto.createHash("md5").update(normalized).digest("hex");
}

/**
 * Calculate semantic similarity between two queries (0-1)
 * Simple implementation: shared words / total unique words
 */
export function calculateSimilarity(query1: string, query2: string): number {
  const words1 = new Set(normalizeQuery(query1).split(" "));
  const words2 = new Set(normalizeQuery(query2).split(" "));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Find a cached response for a query
 * Uses exact hash match first, then semantic similarity
 */
export function findCachedResponse(
  query: string,
  context?: { county?: string; state?: string; trade?: string }
): CachedResponse | null {
  const queryHash = hashQuery(query);

  // 1. Try exact match first
  const exactMatch = cacheStore.get(queryHash);
  if (exactMatch && !isCacheExpired(exactMatch)) {
    // Check context matches
    if (contextMatches(exactMatch.context, context)) {
      exactMatch.hits++;
      return exactMatch;
    }
  }

  // 2. Try semantic similarity (find similar questions)
  let bestMatch: CachedResponse | null = null;
  let bestSimilarity = 0.7; // Threshold: 70% similarity

  for (const cached of cacheStore.values()) {
    if (isCacheExpired(cached)) continue;
    if (!contextMatches(cached.context, context)) continue;

    const similarity = calculateSimilarity(query, cached.query);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = cached;
    }
  }

  if (bestMatch) {
    bestMatch.hits++;
    return bestMatch;
  }

  return null;
}

/**
 * Check if cache entry is expired
 */
export function isCacheExpired(cached: CachedResponse): boolean {
  return Date.now() > cached.expiresAt;
}

/**
 * Check if context matches (location, trade, etc.)
 */
export function contextMatches(
  cached?: { county?: string; state?: string; trade?: string },
  provided?: { county?: string; state?: string; trade?: string }
): boolean {
  if (!cached && !provided) return true;
  if (!cached || !provided) return false;

  // Context matches if all provided fields match cached fields
  if (provided.county && cached.county !== provided.county) return false;
  if (provided.state && cached.state !== provided.state) return false;
  if (provided.trade && cached.trade !== provided.trade) return false;

  return true;
}

/**
 * Cache a response
 */
export function cacheResponse(
  query: string,
  response: CachedResponse["response"],
  context?: CachedResponse["context"],
  ttlMinutes: number = 60
): CachedResponse {
  const queryHash = hashQuery(query);
  const now = Date.now();
  const expiresAt = now + ttlMinutes * 60 * 1000;

  const cached: CachedResponse = {
    query,
    queryHash,
    response,
    context,
    createdAt: now,
    expiresAt,
    hits: 1,
    cost: {
      apiCallsSaved: 0,
      estimatedSavings: 0,
    },
  };

  cacheStore.set(queryHash, cached);
  return cached;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): number {
  let cleared = 0;
  for (const [key, cached] of cacheStore.entries()) {
    if (isCacheExpired(cached)) {
      cacheStore.delete(key);
      cleared++;
    }
  }
  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  clearExpiredCache();

  const stats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: "0%",
    totalSavings: 0,
    entriesInCache: cacheStore.size,
  };

  for (const cached of cacheStore.values()) {
    stats.totalQueries += cached.hits;
    if (cached.hits > 1) {
      stats.cacheHits += cached.hits - 1; // First hit doesn't count as cache hit
    }
  }

  stats.cacheMisses = stats.totalQueries - stats.cacheHits;
  stats.hitRate = stats.totalQueries > 0 ? `${((stats.cacheHits / stats.totalQueries) * 100).toFixed(1)}%` : "0%";

  // Estimate savings: ~$0.01 per API call (rough average)
  stats.totalSavings = stats.cacheHits * 0.01;

  return stats;
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cacheStore.clear();
}

/**
 * Get cache size in bytes (rough estimate)
 */
export function getCacheSize(): number {
  let size = 0;
  for (const cached of cacheStore.values()) {
    size += JSON.stringify(cached).length;
  }
  return size;
}

/**
 * Get cache info for debugging
 */
export function getCacheInfo(): {
  entries: number;
  size: string;
  stats: CacheStats;
  topQueries: Array<{ query: string; hits: number; context: any }>;
} {
  clearExpiredCache();

  const stats = getCacheStats();
  const sizeBytes = getCacheSize();
  const sizeKb = (sizeBytes / 1024).toFixed(2);

  // Get top queries by hits
  const topQueries = Array.from(cacheStore.values())
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10)
    .map((c) => ({
      query: c.query,
      hits: c.hits,
      context: c.context,
    }));

  return {
    entries: cacheStore.size,
    size: `${sizeKb} KB`,
    stats,
    topQueries,
  };
}
