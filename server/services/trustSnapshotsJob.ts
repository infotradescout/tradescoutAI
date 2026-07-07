/**
 * Nightly Trust Snapshot Job
 *
 * Purpose:
 * - Precompute Trust/CVS snapshots (read-only for UI)
 * - Store a per-user, per-county snapshot for contact gating and audit
 *
 * Notes:
 * - This is a baseline heuristic until full CVS calculation is wired.
 * - Never computed in UI; job-only per platform law.
 */

import { pool } from "../db";
import { buildTrustSnapshotsInsertSql } from "./trustSnapshotsScoringSql.mjs";

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
