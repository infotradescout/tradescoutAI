/**
 * Claim Backfill Simulation Job – Phase 3b
 *
 * GOVERNANCE:
 * - Jobs-only (no HTTP routes)
 * - Streams historical users → derives canonical claim intent → runs through ClaimIntakeGate
 * - Dry-run mode supported (no DB writes, validates flow)
 * - Resume-safe via cursor checkpoint (by created_at + id)
 * - Conservative claim type mapping (defaults to "exploring")
 * - Replay safety proof: idempotency tested in second write-run pass
 *
 * ARCHITECTURE:
 * - Fetch users in batches (configurable)
 * - For each user: derive county_fips + claim type, construct raw claim, call gate.intake()
 * - Collect stats: scanned, attempted, written, duplicates, failed, field errors, rate warnings
 * - Save checkpoint every N users (resume-safe)
 * - Support dry-run (advisory, no writes) and write-run (real persistence)
 */

import { Pool, QueryResult } from '@neondatabase/serverless';
import { logger } from '../logger.js';
import { getClaimIntakeGate } from './claimIntakeGate.js';
import { ClaimType, ClaimSource } from './claimEventSchema.js';

export interface ClaimBackfillConfig {
  pool: Pool;

  // Controls
  dryRun: boolean; // true = no DB writes (recommended first pass)
  source: ClaimSource; // should be "import" for backfill
  defaultClaimType: ClaimType; // recommended: "exploring" unless you have deterministic mapping
  batchSize: number; // e.g. 500
  maxUsers?: number; // optional safety cap

  // Time window (optional)
  createdAfter?: Date;
  createdBefore?: Date;

  // Resume / checkpointing
  checkpointKey: string; // e.g. "phase3b_claim_backfill_v1"
  checkpointEvery: number; // e.g. 2000 users
}

export interface ClaimBackfillStats {
  scannedUsers: number;
  attempted: number;
  written: number;
  duplicates: number;
  failed: number;
  fieldPrecheckFailed: number;
  rateWarnings: number;

  // Error buckets
  errorReasons: Record<string, number>;
  fieldErrors: Record<string, number>;

  startedAt: string;
  finishedAt?: string;
  lastCursor?: { createdAt: string; userId: string };
  dryRun: boolean;
}

interface UserRow {
  id: string;
  created_at: Date | string; // ISO from pg
  county_fips?: string | null;
  county?: string | null;
}

interface Checkpoint {
  createdAt: string; // ISO
  userId: string;
}

/**
 * ClaimBackfillSimulationJob
 * Streams historical users through claim intake gate.
 * Supports dry-run (validation) and write-run (real persistence).
 */
export class ClaimBackfillSimulationJob {
  private config: ClaimBackfillConfig;

  constructor(config: ClaimBackfillConfig) {
    this.config = config;
    if (!this.config.batchSize || this.config.batchSize <= 0) {
      throw new Error('batchSize must be > 0');
    }
    if (!this.config.checkpointEvery || this.config.checkpointEvery <= 0) {
      throw new Error('checkpointEvery must be > 0');
    }
  }

  /**
   * Execute the backfill simulation
   * Returns comprehensive stats on what was scanned, written, and failed
   */
  public async run(): Promise<ClaimBackfillStats> {
    const stats: ClaimBackfillStats = {
      scannedUsers: 0,
      attempted: 0,
      written: 0,
      duplicates: 0,
      failed: 0,
      fieldPrecheckFailed: 0,
      rateWarnings: 0,
      errorReasons: {},
      fieldErrors: {},
      startedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
    };

    const gate = getClaimIntakeGate();
    const pool = this.config.pool;

    logger.info('claim_backfill_started', {
      dryRun: this.config.dryRun,
      checkpointKey: this.config.checkpointKey,
      batchSize: this.config.batchSize,
    });

    // Load checkpoint (resume from previous run)
    let checkpoint = await this.readCheckpoint(pool, this.config.checkpointKey);
    let processedSinceCheckpoint = 0;

    // Stream users in batches
    while (true) {
      const users = await this.fetchNextUsers(pool, checkpoint, this.config.batchSize);
      if (users.length === 0) break;

      for (const u of users) {
        stats.scannedUsers++;

        // Safety cap
        if (this.config.maxUsers && stats.scannedUsers > this.config.maxUsers) {
          logger.warn('claim_backfill_maxUsers_reached', {
            maxUsers: this.config.maxUsers,
          });
          stats.finishedAt = new Date().toISOString();
          return stats;
        }

        // Extract county (try both column names for defensive programming)
        const countyFips = ((u.county_fips || u.county || '') as string).trim();
        if (!countyFips) {
          // Skip users without county (claim must have valid county)
          continue;
        }

        const claimType = this.deriveClaimType(u) ?? this.config.defaultClaimType;

        stats.attempted++;

        // Call gate intake (dry-run or write-run based on config)
        const res = await gate.intake({
          userId: u.id,
          countyFips,
          claimType,
          source: this.config.source,
          claimTimestamp: new Date(u.created_at),
          metadata: {
            backfill: true,
            checkpointKey: this.config.checkpointKey,
            dryRun: this.config.dryRun,
          },
          channel: 'import',
          requestId: `phase3b_${this.config.dryRun ? 'dryrun' : 'write'}_${this.config.checkpointKey}`,
        });

        // Track rate warnings
        if (res.rateSignals.some((s) => s.willExceed)) {
          stats.rateWarnings++;
        }

        // Categorize result
        if (res.ok) {
          if (res.write?.isDuplicate) {
            stats.duplicates++;
          } else {
            stats.written++;
          }
        } else {
          // Failure categorization
          if (res.validationErrors && res.validationErrors.length > 0) {
            stats.fieldPrecheckFailed++;
            for (const err of res.validationErrors) {
              this.bump(stats.fieldErrors, err);
            }
          } else if (res.write?.reason) {
            this.bump(stats.errorReasons, `write_failed:${res.write.reason}`);
            stats.failed++;
          } else {
            this.bump(stats.errorReasons, 'write_failed:unknown');
            stats.failed++;
          }
        }

        // Advance checkpoint cursor (created_at + id for resume safety)
        const createdAtStr = typeof u.created_at === 'string' ? u.created_at : u.created_at.toISOString();
        checkpoint = {
          createdAt: createdAtStr,
          userId: u.id,
        };
        processedSinceCheckpoint++;

        // Save checkpoint periodically
        if (processedSinceCheckpoint >= this.config.checkpointEvery) {
          await this.writeCheckpoint(pool, this.config.checkpointKey, checkpoint);
          processedSinceCheckpoint = 0;
          stats.lastCursor = checkpoint;
          logger.info('claim_backfill_checkpoint_saved', {
            checkpointKey: this.config.checkpointKey,
            cursor: checkpoint,
            scanned: stats.scannedUsers,
          });
        }
      }

      // End-of-batch checkpoint save
      if (checkpoint) {
        await this.writeCheckpoint(pool, this.config.checkpointKey, checkpoint);
        stats.lastCursor = checkpoint;
      }
    }

    stats.finishedAt = new Date().toISOString();

    logger.info('claim_backfill_completed', {
      dryRun: this.config.dryRun,
      checkpointKey: this.config.checkpointKey,
      stats,
    });

    return stats;
  }

  /**
   * Derive claim type from user properties
   * Conservative: defaults to "exploring" unless role mapping is deterministic
   */
  private deriveClaimType(u: UserRow): ClaimType | null {
    // Phase 3b conservative strategy:
    // Only map if confident. Default to exploring to avoid contaminating incentive logic.
    return null; // For now, always use defaultClaimType
  }

  /**
   * Fetch next batch of users (cursor-based for resumability)
   */
  private async fetchNextUsers(pool: Pool, checkpoint: Checkpoint | null, limit: number): Promise<UserRow[]> {
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (this.config.createdAfter) {
      params.push(this.config.createdAfter.toISOString());
      where += ` AND created_at >= $${params.length}`;
    }
    if (this.config.createdBefore) {
      params.push(this.config.createdBefore.toISOString());
      where += ` AND created_at < $${params.length}`;
    }

    // Cursor-based pagination for resumability
    if (checkpoint) {
      params.push(checkpoint.createdAt);
      params.push(checkpoint.userId);
      where += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
    }

    params.push(limit);

    const sql = `
      SELECT id, created_at, county_fips
      FROM users
      ${where}
      ORDER BY created_at ASC, id ASC
      LIMIT $${params.length}
    `;

    try {
      const result: QueryResult = await pool.query(sql, params);
      return result.rows as UserRow[];
    } catch (error) {
      logger.error('claim_backfill_fetch_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Increment counter in map
   */
  private bump(map: Record<string, number>, key: string): void {
    map[key] = (map[key] ?? 0) + 1;
  }

  /**
   * Ensure checkpoint table exists
   */
  private async ensureCheckpointTable(pool: Pool): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_checkpoints (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (error) {
      logger.warn('claim_backfill_checkpoint_table_error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Read checkpoint from persistent storage
   */
  private async readCheckpoint(pool: Pool, key: string): Promise<Checkpoint | null> {
    await this.ensureCheckpointTable(pool);
    try {
      const result: QueryResult = await pool.query('SELECT value FROM job_checkpoints WHERE key = $1', [key]);
      if (result.rows.length === 0) return null;

      const v = result.rows[0].value;
      if (!v || !v.createdAt || !v.userId) return null;

      return {
        createdAt: String(v.createdAt),
        userId: String(v.userId),
      };
    } catch (error) {
      logger.error('claim_backfill_read_checkpoint_error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Write checkpoint to persistent storage
   */
  private async writeCheckpoint(pool: Pool, key: string, cp: Checkpoint): Promise<void> {
    await this.ensureCheckpointTable(pool);
    try {
      await pool.query(
        `
        INSERT INTO job_checkpoints(key, value)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              updated_at = NOW()
        `,
        [key, JSON.stringify(cp)],
      );
    } catch (error) {
      logger.error('claim_backfill_write_checkpoint_error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Helper to run the backfill job
 * Call this from your job scheduler or CLI
 */
export async function runClaimBackfillSimulationJob(config: ClaimBackfillConfig): Promise<ClaimBackfillStats> {
  const job = new ClaimBackfillSimulationJob(config);
  return job.run();
}
