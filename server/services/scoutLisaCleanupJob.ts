import { pool } from "../db";
import { ensureScoutLisaFindingsTable } from "./scoutLisaPersistence";

export async function runScoutLisaCleanupJob(): Promise<{
  deletedCount: number;
}> {
  await ensureScoutLisaFindingsTable();

  const result = await pool.query(`
    DELETE FROM scout_lisa_findings
    WHERE (expires_at IS NOT NULL AND expires_at <= now())
       OR (truth_status <> 'current' AND generated_at < now() - interval '7 days')
    RETURNING id
  `);

  return {
    deletedCount: Array.isArray(result.rows) ? result.rows.length : 0,
  };
}
