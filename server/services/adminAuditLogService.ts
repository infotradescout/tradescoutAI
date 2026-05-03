import { desc } from "drizzle-orm";
import { adminAuditLog } from "../../shared/schema";

/**
 * In-memory fallback store used when the DB is unavailable (e.g. unit tests
 * without a real Postgres connection). The DB path is always attempted first.
 */
const _memoryLog: Record<string, any>[] = [];
const mirrorAuditMemory =
  process.env.NODE_ENV === "test" || process.env.RUN_INTEGRATION_TESTS === "true";

// Lazily resolved DB reference — avoids crashing when DB is not configured (e.g. unit tests).
// Uses a shared Promise so concurrent callers don't trigger multiple resolution attempts.
// Dynamic import() is required here because db.ts contains a top-level await, which
// esbuild (ESM format) forbids inside synchronous require() calls.
let _dbPromise: Promise<any> | null = null;

async function getDb(): Promise<any> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    try {
      const mod = await import("../db.js");
      const candidate = (mod as any).db ?? null;
      if (!candidate) return null;
      // db.ts exports a throwing Proxy when no DB URL is configured.
      // Probe a harmless property to detect the Proxy before returning.
      try {
        void candidate.select;
      } catch {
        return null;
      }
      return candidate;
    } catch {
      return null;
    }
  })();
  return _dbPromise;
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
  const targetType = String(event.targetType || "").toLowerCase();
  const targetIdIsUser =
    !targetType ||
    targetType === "user" ||
    targetType === "target_user" ||
    targetType.endsWith("_user");
  const resolvedTargetUserId = event.targetUserId || (targetIdIsUser ? event.targetId : null);

  // The full event is stored in metadata so getAdminAuditLog can flatten it back
  const entry: Record<string, any> = {
    ...event,
    type: resolvedType,
    adminId: resolvedAdminId,
    targetUserId: resolvedTargetUserId,
    timestamp: new Date().toISOString(),
  };

  const db = await getDb();
  if (db) {
    try {
      await db.insert(adminAuditLog).values({
        type: resolvedType,
        adminId: resolvedAdminId,
        targetUserId: resolvedTargetUserId,
        metadata: entry,
      });
      if (mirrorAuditMemory) {
        _memoryLog.push(entry);
      }
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
  const memoryRows = [..._memoryLog].reverse();
  const db = await getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit);

      const dbRows = rows.map((row: any) => ({
        ...((row.metadata as Record<string, any>) ?? {}),
        id: row.id,
        type: row.type,
        adminId: row.adminId,
        targetUserId: row.targetUserId,
        createdAt: row.createdAt,
      }));

      if (mirrorAuditMemory && memoryRows.length > 0) {
        return [...memoryRows, ...dbRows].slice(0, limit);
      }

      if (rows.length > 0) {
        return dbRows;
      }
    } catch (error) {
      console.error("[AdminAuditLog] DB query failed, falling back to memory:", error);
    }
  }

  // In-memory fallback
  return memoryRows.slice(0, limit);
}

/**
 * Clear all audit log entries (test/dev use only).
 */
export async function clearAdminAuditLog(): Promise<void> {
  // Always clear the in-memory store
  _memoryLog.length = 0;

  const db = await getDb();
  if (db) {
    try {
      await db.delete(adminAuditLog);
    } catch (error) {
      console.error("[AdminAuditLog] Failed to clear DB audit log:", error);
    }
  }
}
