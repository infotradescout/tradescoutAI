import type { PoolClient } from "@neondatabase/serverless";
import { pool } from "../db";

let schedulerLeaderClient: PoolClient | null = null;

function schedulerLockId(): number {
  const parsed = Number.parseInt(process.env.SCHEDULER_LEADER_LOCK_ID || "72418031", 10);
  return Number.isFinite(parsed) ? parsed : 72418031;
}

export async function acquireSchedulerLeadership(): Promise<boolean> {
  if (schedulerLeaderClient) return true;

  const client = await pool.connect();
  try {
    const lockId = schedulerLockId();
    const result = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [lockId]
    );
    const locked = result.rows?.[0]?.locked === true;

    if (!locked) {
      client.release();
      return false;
    }

    schedulerLeaderClient = client;
    return true;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function releaseSchedulerLeadership(): Promise<void> {
  if (!schedulerLeaderClient) return;

  const client = schedulerLeaderClient;
  schedulerLeaderClient = null;

  try {
    const lockId = schedulerLockId();
    await client.query("select pg_advisory_unlock($1)", [lockId]);
  } catch {
    // Best-effort unlock; connection close also releases advisory lock.
  } finally {
    client.release();
  }
}
