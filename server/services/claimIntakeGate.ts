/**
 * Claim Intake Gate – Phase 3a
 *
 * Single service boundary that normalizes + validates + writes claim events.
 * No UI exposure. No reads exposed. Warning-only rate discipline.
 *
 * GOVERNANCE:
 * - Intake(raw) normalizes input, prevalidates fields, checks rate, writes via service
 * - IntakeBatch() processes multiple sequentially (predictable, safe for dark period)
 * - Dark telemetry only (logs, no metrics endpoints)
 * - Field-only validation precheck + full validation in write service
 */

import { logger } from '../logger.js';
import {
  ClaimSource,
  ClaimType,
  WriteClaimEventRequest,
  WriteClaimEventResult,
  isValidClaimSource,
  isValidClaimType,
} from './claimEventSchema.js';
import { writeClaimEvent } from './claimEventService.js';
import { ClaimEventValidator } from './claimEventValidator.js';
import { ClaimIntakeRateLimiter, RateLimitSignal } from './claimIntakeRateLimiter.js';

export type IntakeChannel = 'signup' | 'direct_claim' | 'import' | 'admin';

/**
 * Raw claim input (may have invalid types, missing/extra fields)
 * Gate will normalize and validate
 */
export interface ClaimIntakeRaw {
  userId: string;
  countyFips: string;
  claimType: string; // raw input, will be normalized to ClaimType
  source: string; // raw input, will be normalized to ClaimSource
  claimTimestamp?: Date;
  metadata?: unknown;
  channel?: IntakeChannel;
  requestId?: string;
}

/**
 * Result of a single intake operation
 */
export interface ClaimIntakeResult {
  ok: boolean;
  write?: WriteClaimEventResult;
  warnings: string[];
  rateSignals: RateLimitSignal[];
  validationErrors?: string[];
  validationWarnings?: string[];
  normalized?: {
    userId: string;
    countyFips: string;
    claimType: ClaimType;
    source: ClaimSource;
    claimTimestamp: Date;
    metadata?: unknown;
  };
}

/**
 * Result of a batch intake operation
 */
export interface ClaimIntakeBatchResult {
  okCount: number;
  failCount: number;
  duplicateCount: number;
  results: ClaimIntakeResult[];
  batchWarnings: string[];
}

export interface ClaimIntakeGateDeps {
  validator: ClaimEventValidator;
  limiter: ClaimIntakeRateLimiter;
  logger?: {
    info: (msg: string, obj?: any) => void;
    warn: (msg: string, obj?: any) => void;
    error: (msg: string, obj?: any) => void;
  };
}

const defaultLogger = {
  info: (msg: string, obj?: any) => logger.info(msg, obj),
  warn: (msg: string, obj?: any) => logger.warn(msg, obj),
  error: (msg: string, obj?: any) => logger.error(msg, obj),
};

/**
 * ClaimIntakeGate
 * Single entrypoint for all claim intake flows (signup, direct, import, admin).
 * Normalizes, validates, rate-checks, writes, and logs dark telemetry.
 */
export class ClaimIntakeGate {
  private validator: ClaimEventValidator;
  private limiter: ClaimIntakeRateLimiter;
  private logger: ClaimIntakeGateDeps['logger'];

  constructor(deps: ClaimIntakeGateDeps) {
    this.validator = deps.validator;
    this.limiter = deps.limiter;
    this.logger = deps.logger ?? defaultLogger;
  }

  /**
   * Intake a single raw claim event.
   * Flow:
   * 1. Normalize claimType/source
   * 2. Rate-discipline check (warn-only)
   * 3. Field-only validation precheck
   * 4. Write via service (full validation + persistence)
   * 5. Dark telemetry logging
   */
  public async intake(raw: ClaimIntakeRaw): Promise<ClaimIntakeResult> {
    const warnings: string[] = [];
    const now = new Date();

    // Step 1: Normalize claimType/source
    if (!isValidClaimType(raw.claimType)) {
      return {
        ok: false,
        warnings,
        rateSignals: [],
        validationErrors: [`Invalid claimType: ${raw.claimType}`],
      };
    }
    if (!isValidClaimSource(raw.source)) {
      return {
        ok: false,
        warnings,
        rateSignals: [],
        validationErrors: [`Invalid source: ${raw.source}`],
      };
    }

    const normalized = {
      userId: raw.userId,
      countyFips: raw.countyFips,
      claimType: raw.claimType as ClaimType,
      source: raw.source as ClaimSource,
      claimTimestamp: raw.claimTimestamp ?? now,
      metadata: raw.metadata,
    };

    // Step 2: Rate discipline signals (warn-only)
    const rateSignals = this.limiter.recordAndCheck({
      userId: normalized.userId,
      countyFips: normalized.countyFips,
    });

    const exceeded = rateSignals.filter((s) => s.willExceed);
    if (exceeded.length > 0) {
      warnings.push(
        `Rate limit signals exceeded (${exceeded.map((e) => e.ruleName).join(', ')}). Phase 3a is warn-only.`,
      );
      this.logger.warn('claim_intake_rate_warning', {
        channel: raw.channel ?? 'unknown',
        requestId: raw.requestId ?? null,
        userId: normalized.userId,
        countyFips: normalized.countyFips,
        exceeded,
      });
    }

    // Step 3: Field-only validation precheck (no DB reads)
    const precheck = this.validator.validateFieldsOnly({
      userId: normalized.userId,
      countyFips: normalized.countyFips,
      claimType: normalized.claimType,
      source: normalized.source,
      claimTimestamp: normalized.claimTimestamp,
      metadata: normalized.metadata,
    });

    if (!precheck.ok) {
      this.logger.warn('claim_intake_field_validation_failed', {
        channel: raw.channel ?? 'unknown',
        requestId: raw.requestId ?? null,
        userId: normalized.userId,
        countyFips: normalized.countyFips,
        errors: precheck.errors,
        warnings: precheck.warnings,
      });

      return {
        ok: false,
        warnings,
        rateSignals,
        validationErrors: precheck.errors,
        validationWarnings: precheck.warnings,
        normalized,
      };
    }

    if (precheck.warnings.length > 0) {
      warnings.push(...precheck.warnings.map((w) => `Validation warning: ${w}`));
    }

    // Step 4: Write via service (full validation + persistence)
    const writeReq: WriteClaimEventRequest = {
      userId: normalized.userId,
      claimType: normalized.claimType,
      countyFips: normalized.countyFips,
      countyName: '', // Will be resolved by service
      source: normalized.source,
      claimTimestamp: normalized.claimTimestamp,
      metadata: normalized.metadata,
    };

    const write = await writeClaimEvent(writeReq);

    // Step 5: Dark telemetry (no UI; logs only)
    if (write.success) {
      const tag = write.isDuplicate ? 'claim_intake_duplicate' : 'claim_intake_written';
      this.logger.info(tag, {
        channel: raw.channel ?? 'unknown',
        requestId: raw.requestId ?? null,
        userId: normalized.userId,
        countyFips: normalized.countyFips,
        claimType: normalized.claimType,
        source: normalized.source,
        claimId: write.claimId ?? null,
        isDuplicate: !!write.isDuplicate,
        reason: write.reason ?? null,
      });
    } else {
      this.logger.warn('claim_intake_write_failed', {
        channel: raw.channel ?? 'unknown',
        requestId: raw.requestId ?? null,
        userId: normalized.userId,
        countyFips: normalized.countyFips,
        claimType: normalized.claimType,
        source: normalized.source,
        reason: write.reason ?? 'unknown',
        error: write.error ?? null,
      });
    }

    return {
      ok: write.success,
      write,
      warnings,
      rateSignals,
      normalized,
    };
  }

  /**
   * Batch intake.
   * Phase 3a: Sequential by default (predictable + easy to reason about).
   * Parallelize later once dark telemetry shows safe patterns.
   */
  public async intakeBatch(rawItems: ClaimIntakeRaw[]): Promise<ClaimIntakeBatchResult> {
    const results: ClaimIntakeResult[] = [];
    const batchWarnings: string[] = [];

    let okCount = 0;
    let failCount = 0;
    let duplicateCount = 0;

    for (const raw of rawItems) {
      const res = await this.intake(raw);
      results.push(res);

      if (res.ok) {
        okCount++;
        if (res.write?.isDuplicate) duplicateCount++;
      } else {
        failCount++;
      }
    }

    // batch-level dark telemetry
    if (rawItems.length >= 100) {
      batchWarnings.push(
        'Large batch processed. Phase 3a is sequential; consider controlled concurrency only after dark telemetry is stable.',
      );
    }

    this.logger.info('claim_intake_batch_complete', {
      size: rawItems.length,
      okCount,
      failCount,
      duplicateCount,
    });

    return { okCount, failCount, duplicateCount, results, batchWarnings };
  }
}

// Optional singleton wiring (mirrors your DI patterns)
let _claimIntakeGate: ClaimIntakeGate | null = null;

export function setClaimIntakeGate(gate: ClaimIntakeGate): void {
  _claimIntakeGate = gate;
}

export function getClaimIntakeGate(): ClaimIntakeGate {
  if (!_claimIntakeGate) {
    throw new Error('ClaimIntakeGate not initialized. Call setClaimIntakeGate() during server boot.');
  }
  return _claimIntakeGate;
}

/**
 * Helper to initialize gate from validator + rate limiter.
 * Call this during server boot after basic DI setup.
 */
export function initClaimIntakeGate(deps: {
  validator: ClaimEventValidator;
  logger?: ClaimIntakeGateDeps['logger'];
}): ClaimIntakeGate {
  const limiter = new ClaimIntakeRateLimiter();
  const gate = new ClaimIntakeGate({
    validator: deps.validator,
    limiter,
    logger: deps.logger,
  });
  setClaimIntakeGate(gate);
  return gate;
}
