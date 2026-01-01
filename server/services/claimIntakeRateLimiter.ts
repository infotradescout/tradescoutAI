/**
 * Claim Intake Rate Limiter – Phase 3a
 *
 * In-memory, warning-only rate limiter for claim intake.
 * Phase 3a: No hard blocking. Tracks patterns to inform dark telemetry.
 *
 * GOVERNANCE:
 * - Sliding window with per-key buckets (user, county, global)
 * - All signals marked warnOnly=true (advisory during dark period)
 * - Memory bounded: old buckets pruned, large buckets compacted
 * - Stateless between requests (no persistence)
 * - Designed to keep intake flowing while capturing volume/velocity signals
 */

export type RateKeyType = 'user' | 'county' | 'global';

export interface RateLimitRule {
  keyType: RateKeyType;
  windowMs: number;
  maxEvents: number;
  warnOnly: boolean; // Phase 3a: always true
  name: string;
}

export interface RateLimitCheckInput {
  userId: string;
  countyFips: string;
  nowMs?: number;
}

export interface RateLimitSignal {
  ruleName: string;
  key: string;
  keyType: RateKeyType;
  windowMs: number;
  maxEvents: number;
  currentCount: number;
  willExceed: boolean;
  warnOnly: boolean;
}

interface Bucket {
  // monotonically increasing timestamps (ms) of events
  timestamps: number[];
  lastPrunedAt: number;
}

/**
 * ClaimIntakeRateLimiter
 * Tracks claim intake velocity across user/county/global dimensions.
 * Warning-only in Phase 3a; designed for observability during dark period.
 */
export class ClaimIntakeRateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private rules: RateLimitRule[];

  constructor(rules?: RateLimitRule[]) {
    this.rules = rules ?? [
      // Conservative defaults: warning-only, keeps data clean without disrupting flows
      {
        name: 'per_user_5min',
        keyType: 'user',
        windowMs: 5 * 60_000,
        maxEvents: 10,
        warnOnly: true,
      },
      {
        name: 'per_county_5min',
        keyType: 'county',
        windowMs: 5 * 60_000,
        maxEvents: 200,
        warnOnly: true,
      },
      {
        name: 'global_1min',
        keyType: 'global',
        windowMs: 60_000,
        maxEvents: 2_000,
        warnOnly: true,
      },
    ];
  }

  public setRules(rules: RateLimitRule[]): void {
    this.rules = rules;
  }

  /**
   * Record an event and check all rules
   * Returns signals for each rule (whether exceeded + advice)
   */
  public recordAndCheck(input: RateLimitCheckInput): RateLimitSignal[] {
    const now = input.nowMs ?? Date.now();
    const signals: RateLimitSignal[] = [];

    for (const rule of this.rules) {
      const key = this.buildKey(rule.keyType, input.userId, input.countyFips);
      const bucket = this.getOrCreateBucket(key);

      this.prune(bucket, rule.windowMs, now);
      // record timestamp
      bucket.timestamps.push(now);

      const currentCount = bucket.timestamps.length;
      const willExceed = currentCount > rule.maxEvents;

      signals.push({
        ruleName: rule.name,
        key,
        keyType: rule.keyType,
        windowMs: rule.windowMs,
        maxEvents: rule.maxEvents,
        currentCount,
        willExceed,
        warnOnly: rule.warnOnly,
      });

      // keep memory bounded
      this.compact(bucket);
    }

    // Optional: prune old buckets occasionally
    this.pruneDeadBuckets(now);

    return signals;
  }

  private buildKey(keyType: RateKeyType, userId: string, countyFips: string): string {
    if (keyType === 'global') return 'global';
    if (keyType === 'user') return `user:${userId}`;
    return `county:${countyFips}`;
  }

  private getOrCreateBucket(key: string): Bucket {
    const existing = this.buckets.get(key);
    if (existing) return existing;
    const created: Bucket = { timestamps: [], lastPrunedAt: 0 };
    this.buckets.set(key, created);
    return created;
  }

  /**
   * Remove timestamps outside the window
   * Avoid pruning too frequently for same bucket (lazy approach)
   */
  private prune(bucket: Bucket, windowMs: number, now: number): void {
    if (now - bucket.lastPrunedAt < Math.min(5_000, windowMs / 10)) return;
    const cutoff = now - windowMs;
    // timestamps are in order; shift until within window
    let i = 0;
    while (i < bucket.timestamps.length && bucket.timestamps[i] < cutoff) i++;
    if (i > 0) bucket.timestamps.splice(0, i);
    bucket.lastPrunedAt = now;
  }

  /**
   * If bucket grows large due to abuse, keep only most recent events
   * Protects against unbounded memory growth
   */
  private compact(bucket: Bucket): void {
    const MAX = 10_000;
    if (bucket.timestamps.length > MAX) {
      bucket.timestamps.splice(0, bucket.timestamps.length - MAX);
    }
  }

  /**
   * Remove buckets that have been empty for a while
   * Periodic cleanup for dead keys
   */
  private pruneDeadBuckets(now: number): void {
    const DEAD_MS = 30 * 60_000; // 30 minutes
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.timestamps.length === 0 && now - bucket.lastPrunedAt > DEAD_MS) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get current state for debugging/monitoring
   */
  public getState(): { bucketCount: number; totalTimestamps: number; rules: RateLimitRule[] } {
    let totalTimestamps = 0;
    for (const bucket of this.buckets.values()) {
      totalTimestamps += bucket.timestamps.length;
    }
    return {
      bucketCount: this.buckets.size,
      totalTimestamps,
      rules: this.rules,
    };
  }
}
