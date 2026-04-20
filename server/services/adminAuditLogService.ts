import { desc } from "drizzle-orm";
import { adminAuditLog } from "../../shared/schema";

/**
 * In-memory fallback store used when the DB is unavailable (e.g. unit tests
 * without a real Postgres connection). The DB path is always attempted first.
 */
const _memoryLog: Record<string, any>[] = [];

// Lazily resolved DB reference — avoids crashing when DB is not configured (e.g. unit tests)
let _db: any = null;
let _dbResolved = false;

function getDb(): any {
  if (_dbResolved) return _db;
  _dbResolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../db") as { db?: unknown };
    _db = mod.db ?? null;
  } catch {
    _db = null;
  }
  return _db;
}

/**
 * Log an admin action.
 * Writes to the persistent admin_audit_log table when a DB connection is
 * available; falls back to an in-memory store for test environments.
 *
 * Accepts both `type`/`action` and `adminId`/`actorId` aliases for
 * backward compatibility with all existing callers.
 */
export async function logAdminAction(event: {
  type?: string;
  action?: string;
  adminId?: string;
  actorId?: string;
  targetUserId?: string;
  targetId?: string;
  [key: string]: any;
}): Promise<void> {
  // Resolve canonical field names from aliases
  const resolvedType = event.type || event.action || "unknown";
  const resolvedAdminId = event.adminId || event.actorId || null;
  const resolvedTargetUserId = event.targetUserId || event.targetId || null;

  // The full event is stored in metadata so getAdminAuditLog can flatten it back
  const entry: Record<string, any> = {
    ...event,
    type: resolvedType,
    adminId: resolvedAdminId,
    targetUserId: resolvedTargetUserId,
    timestamp: new Date().toISOString(),
  };

  const db = getDb();
  if (db) {
    try {
      await db.insert(adminAuditLog).values({
        type: resolvedType,
        adminId: resolvedAdminId,
        targetUserId: resolvedTargetUserId,
        metadata: entry,
      });
      return;
    } catch (error) {
      console.error("[AdminAuditLog] DB insert failed, falling back to memory:", error);
    }
  }

  // In-memory fallback (test environments / no DB)
  _memoryLog.push(entry);
}

/**
 * Retrieve the most recent admin audit log entries.
 * Metadata fields are flattened into the returned object for backward
 * compatibility with callers that access fields like `entry.action`, etc.
 */
export async function getAdminAuditLog(limit = 100): Promise<Record<string, any>[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit);

      if (rows.length > 0) {
        return rows.map((row: any) => ({
          ...((row.metadata as Record<string, any>) ?? {}),
          id: row.id,
          type: row.type,
          adminId: row.adminId,
          targetUserId: row.targetUserId,
          createdAt: row.createdAt,
        }));
      }
    } catch (error) {
      console.error("[AdminAuditLog] DB query failed, falling back to memory:", error);
    }
  }

  // In-memory fallback
  return [..._memoryLog].reverse().slice(0, limit);
}

/**
 * Clear all audit log entries (test/dev use only).
 */
export async function clearAdminAuditLog(): Promise<void> {
  // Always clear the in-memory store
  _memoryLog.length = 0;

  const db = getDb();
  if (db) {
    try {
      await db.delete(adminAuditLog);
    } catch (error) {
      console.error("[AdminAuditLog] Failed to clear DB audit log:", error);
    }
  }
}
