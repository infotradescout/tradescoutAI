/**
 * Claim Event Service – Phase 3 Claim-First Intake
 *
 * RESPONSIBILITIES:
 * - Write-only operations (insert + soft invalidation)
 * - Idempotent claim inserts (ON CONFLICT DO NOTHING)
 * - Soft invalidation (UPDATE with reason, never delete)
 * - Feature flag control (CLAIM_WRITES_ENABLED)
 * - Comprehensive error handling and logging
 *
 * GOVERNANCE:
 * - No reads from claim_events (read layer comes in Phase 3+1)
 * - Claim writes can be disabled independently of metrics
 * - All writes are insert-only; updates only for soft invalidation
 * - Metadata is JSON; errors are detailed for ops/debugging
 *
 * SAFETY:
 * - Unique constraint prevents duplicates; ON CONFLICT returns existing
 * - Soft invalidation preserves audit trail (invalidated_at + reason)
 * - Timestamp immutable after insert
 * - Feature flag defaults to FALSE (ships dark)
 */

import { Pool, QueryResult } from '@neondatabase/serverless';

// Simple inline logger (avoids circular dependency)
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
};

import {
  ClaimEvent,
  WriteClaimEventRequest,
  WriteClaimEventResult,
  InvalidateClaimEventRequest,
  InvalidateClaimEventResult,
  generateIdempotencyKey,
  isValidClaimType,
  isValidClaimSource,
  isValidCountyFips,
} from './claimEventSchema.js';
import { validateClaimEventWrite, ValidationContext, formatValidationErrors } from './claimEventValidator.js';

let pool: Pool | null = null;

export function setClaimEventPool(dbPool: Pool): void {
  pool = dbPool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Claim event pool not initialized. Call setClaimEventPool() first.');
  }
  return pool;
}

function isClaimWritesEnabled(): boolean {
  const enabled = process.env.CLAIM_WRITES_ENABLED === 'true';
  if (!enabled) {
    logger.warn('Claim writes are disabled (CLAIM_WRITES_ENABLED=false). Claim event will not be written.');
  }
  return enabled;
}

async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const result = await getPool().query('SELECT id FROM users WHERE id = $1 LIMIT 1', [userId]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking user existence:', { userId, error });
    return false;
  }
}

async function getUserCreatedAt(userId: string): Promise<Date | null> {
  try {
    const result = await getPool().query('SELECT created_at FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (result.rows.length === 0) return null;
    return result.rows[0].created_at instanceof Date ? result.rows[0].created_at : new Date(result.rows[0].created_at);
  } catch (error) {
    logger.error('Error fetching user creation date:', { userId, error });
    return null;
  }
}

async function checkCountyExists(fips: string): Promise<boolean> {
  try {
    const result = await getPool().query('SELECT fips_code FROM counties WHERE fips_code = $1 LIMIT 1', [fips]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking county existence:', { fips, error });
    return false;
  }
}

async function getCountyName(fips: string): Promise<string | null> {
  try {
    const result = await getPool().query('SELECT county_name FROM counties WHERE fips_code = $1 LIMIT 1', [fips]);
    if (result.rows.length === 0) return null;
    return result.rows[0].county_name || null;
  } catch (error) {
    logger.error('Error fetching county name:', { fips, error });
    return null;
  }
}

async function getExistingClaimId(
  userId: string,
  claimType: string,
  countyFips: string,
  source: string,
): Promise<string | null> {
  try {
    const result = await getPool().query(
      'SELECT id FROM claim_events WHERE user_id = $1 AND claim_type = $2 AND county_fips = $3 AND source = $4 AND invalidated_at IS NULL LIMIT 1',
      [userId, claimType, countyFips, source],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].id || null;
  } catch (error) {
    logger.error('Error fetching existing claim:', { userId, claimType, countyFips, source, error });
    return null;
  }
}

/**
 * Write a single claim event
 * Returns success + claimId, or error details
 * Handles:
 * - Feature flag check (CLAIM_WRITES_ENABLED)
 * - Validation of all fields
 * - Idempotent insert (ON CONFLICT DO NOTHING)
 * - Duplicate detection (returns existing claim id)
 */
export async function writeClaimEvent(req: WriteClaimEventRequest): Promise<WriteClaimEventResult> {
  // Check if claim writes are enabled
  if (!isClaimWritesEnabled()) {
    logger.warn('Claim write attempted but disabled', {
      userId: req.userId,
      claimType: req.claimType,
      countyFips: req.countyFips,
    });
    return {
      success: false,
      error: 'Claim writes are currently disabled',
      reason: 'disabled',
    };
  }

  // Build validation context (check user + county existence + creation dates)
  const userExists = await checkUserExists(req.userId);
  const userCreatedAt = userExists ? await getUserCreatedAt(req.userId) : null;
  const countyExists = await checkCountyExists(req.countyFips);
  const countyName = countyExists ? (await getCountyName(req.countyFips)) || req.countyName : req.countyName;

  const context: ValidationContext = {
    userExists,
    userCreatedAt,
    countyExists,
    countyName,
  };

  // Validate claim event
  const validation = validateClaimEventWrite(req, context);
  if (!validation.valid) {
    const errorMsg = formatValidationErrors(validation.errors);
    logger.error('Claim validation failed', {
      userId: req.userId,
      claimType: req.claimType,
      countyFips: req.countyFips,
      errors: errorMsg,
    });
    return {
      success: false,
      error: errorMsg,
      reason: 'validation_error',
    };
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(req.userId, req.claimType, req.countyFips, req.source);

  // Attempt idempotent insert
  try {
    const result: QueryResult = await getPool().query(
      `
      INSERT INTO claim_events (
        id,
        user_id,
        claim_type,
        county_fips,
        county_name,
        source,
        claim_timestamp,
        idempotency_key,
        metadata,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW()
      )
      ON CONFLICT (user_id, claim_type, county_fips, source) DO NOTHING
      RETURNING id;
      `,
      [
        req.userId,
        req.claimType,
        req.countyFips,
        countyName,
        req.source,
        req.claimTimestamp,
        idempotencyKey,
        req.metadata ? JSON.stringify(req.metadata) : null,
      ],
    );

    // If ON CONFLICT happened (no rows returned), fetch existing claim
    if (result.rows.length === 0) {
      const existingClaimId = await getExistingClaimId(req.userId, req.claimType, req.countyFips, req.source);
      logger.info('Claim already exists (idempotent)', {
        userId: req.userId,
        claimType: req.claimType,
        countyFips: req.countyFips,
        source: req.source,
        claimId: existingClaimId,
      });
      return {
        success: true,
        claimId: existingClaimId || undefined,
        isDuplicate: true,
      };
    }

    const claimId = result.rows[0].id;
    logger.info('Claim event written', {
      claimId,
      userId: req.userId,
      claimType: req.claimType,
      countyFips: req.countyFips,
      source: req.source,
      timestamp: req.claimTimestamp,
    });

    return {
      success: true,
      claimId,
    };
  } catch (error) {
    logger.error('Error writing claim event', {
      userId: req.userId,
      claimType: req.claimType,
      countyFips: req.countyFips,
      error,
    });
    return {
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'unknown'}`,
      reason: 'internal_error',
    };
  }
}

/**
 * Invalidate a claim event (soft delete)
 * Prevents deletion; updates invalidated_at + reason
 * Preserves audit trail
 */
export async function invalidateClaimEvent(req: InvalidateClaimEventRequest): Promise<InvalidateClaimEventResult> {
  if (!isClaimWritesEnabled()) {
    logger.warn('Claim invalidation attempted but writes disabled', { claimId: req.claimId });
    return {
      success: false,
      error: 'Claim writes are currently disabled',
    };
  }

  if (!req.claimId || req.claimId.trim().length === 0) {
    return {
      success: false,
      error: 'Claim ID cannot be empty',
    };
  }

  if (!req.reason || req.reason.trim().length === 0) {
    return {
      success: false,
      error: 'Invalidation reason cannot be empty',
    };
  }

  try {
    const result: QueryResult = await getPool().query(
      `
      UPDATE claim_events
      SET invalidated_at = NOW(), invalidation_reason = $1
      WHERE id = $2 AND invalidated_at IS NULL
      RETURNING id;
      `,
      [req.reason, req.claimId],
    );

    if (result.rows.length === 0) {
      logger.warn('Claim not found or already invalidated', { claimId: req.claimId });
      return {
        success: false,
        error: 'Claim not found or already invalidated',
      };
    }

    logger.info('Claim invalidated', {
      claimId: req.claimId,
      reason: req.reason,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error invalidating claim event', {
      claimId: req.claimId,
      error,
    });
    return {
      success: false,
      error: `Internal server error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Fetch a claim event by ID (read-only, for validation purposes)
 * NOT exposed to UI/Scout; internal use only
 */
export async function fetchClaimEventById(claimId: string): Promise<ClaimEvent | null> {
  try {
    const result: QueryResult = await getPool().query('SELECT * FROM claim_events WHERE id = $1 LIMIT 1', [claimId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      claimType: row.claim_type,
      countyFips: row.county_fips,
      countyName: row.county_name,
      source: row.source,
      claimTimestamp: row.claim_timestamp instanceof Date ? row.claim_timestamp : new Date(row.claim_timestamp),
      idempotencyKey: row.idempotency_key,
      invalidatedAt: row.invalidated_at ? (row.invalidated_at instanceof Date ? row.invalidated_at : new Date(row.invalidated_at)) : null,
      invalidationReason: row.invalidation_reason || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    };
  } catch (error) {
    logger.error('Error fetching claim event', { claimId, error });
    return null;
  }
}

/**
 * Count active (non-invalidated) claims per county
 * FOR VALIDATION ONLY; not exposed to Scout
 */
export async function countActiveClaims(countyFips: string): Promise<number> {
  try {
    const result: QueryResult = await getPool().query(
      'SELECT COUNT(*) as count FROM claim_events WHERE county_fips = $1 AND invalidated_at IS NULL',
      [countyFips],
    );
    return parseInt(result.rows[0].count, 10) || 0;
  } catch (error) {
    logger.error('Error counting active claims', { countyFips, error });
    return 0;
  }
}
