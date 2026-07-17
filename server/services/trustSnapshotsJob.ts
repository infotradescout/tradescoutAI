/**
 * Nightly Trust Snapshot Job
 *
 * Purpose:
 * - Precompute Trust/CVS snapshots (read-only for UI)
 * - Store a per-user, per-county snapshot for contact gating and audit
 *
 * Notes:
 * - Verification establishes CVS 50; measured performance moves it thereafter.
 * - Never computed in UI; service/job-only per platform law.
 */

import { pool } from "../db";
import {
  buildTrustSnapshotsInsertSql,
  TRUST_SNAPSHOTS_VERSION,
} from "./trustSnapshotsScoringSql.mjs";

export { TRUST_SNAPSHOTS_VERSION };

interface JobResult {
  timestamp: Date;
  inserted: number;
  skipped: number;
}

export async function runTrustSnapshotsJob(): Promise<JobResult> {
  const startTime = new Date();

  const insertSql = buildTrustSnapshotsInsertSql({ forceOverwrite: false });

  const result = await pool.query(insertSql);
  const inserted = Number(result.rows?.[0]?.inserted_count ?? 0);
  const sourceCount = Number(result.rows?.[0]?.source_count ?? 0);

  return {
    timestamp: startTime,
    inserted,
    skipped: Math.max(0, sourceCount - inserted),
  };
}

/**
 * Recompute one user's canonical Trust/CVS snapshot immediately after an
 * audited verification change. The score still comes from the shared scoring
 * SQL used by the nightly job; this only narrows that job to one user.
 */
export async function runTrustSnapshotForUser(userId: string): Promise<JobResult> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId is required");

  const startTime = new Date();
  const insertSql = buildTrustSnapshotsInsertSql({
    forceOverwrite: true,
    filterByUserId: true,
  });
  const result: any = await pool.query(insertSql, [normalizedUserId]);
  const inserted = Number(result.rows?.[0]?.inserted_count ?? 0);
  const sourceCount = Number(result.rows?.[0]?.source_count ?? 0);

  return {
    timestamp: startTime,
    inserted,
    skipped: Math.max(0, sourceCount - inserted),
  };
}
