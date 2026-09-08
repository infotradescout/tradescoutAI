import { asc, desc } from "drizzle-orm";
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

type AdminAuditLogQueryObject = {
  limit?: number;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  sort?: "asc" | "desc";
};

export type AdminAuditLogQuery = number | AdminAuditLogQueryObject;

function normalizeQuery(query: AdminAuditLogQuery = 100): {
  limit: number;
  action: string;
  actorId: string;
  from: Date | null;
  to: Date | null;
  sort: "asc" | "desc";
} {
  const raw = typeof query === "number" ? { limit: query } : query;
  const limitRaw = Number(raw?.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
  const action = String(raw?.action ?? "").trim();
  const actorId = String(raw?.actorId ?? "").trim();
  const from = raw?.from instanceof Date && !Number.isNaN(raw.from.getTime()) ? raw.from : null;
  const to = raw?.to instanceof Date && !Number.isNaN(raw.to.getTime()) ? raw.to : null;
  const sort: "asc" | "desc" = raw?.sort === "asc" ? "asc" : "desc";
  return {
    limit,
    action,
    actorId,
    from,
    to,
    sort,
  };
}

function toTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function matchesQuery(
  entry: Record<string, any>,
  query: ReturnType<typeof normalizeQuery>
): boolean {
  if (query.action && String(entry.type || entry.action || "").trim() !== query.action)
    return false;

  if (query.actorId) {
    const actor = String(entry.adminId || entry.actorId || "").trim();
    if (actor !== query.actorId) return false;
  }

  const entryTime =
    toTimestamp(entry.createdAt) ??
    toTimestamp(entry.timestamp) ??
    toTimestamp(entry.updatedAt) ??
    null;

  if (query.from && entryTime !== null && entryTime < query.from.getTime()) return false;
  if (query.to && entryTime !== null && entryTime > query.to.getTime()) return false;

  return true;
}

function stableSort(rows: Record<string, any>[], sort: "asc" | "desc"): Record<string, any>[] {
  const direction = sort === "asc" ? 1 : -1;
  return [...rows]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aTime =
        toTimestamp(a.entry.createdAt) ??
        toTimestamp(a.entry.timestamp) ??
        toTimestamp(a.entry.updatedAt) ??
        0;
      const bTime =
        toTimestamp(b.entry.createdAt) ??
        toTimestamp(b.entry.timestamp) ??
        toTimestamp(b.entry.updatedAt) ??
        0;
      if (aTime !== bTime) return (aTime - bTime) * direction;
      return (a.index - b.index) * direction;
    })
    .map((item) => item.entry);
}

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
export async function logAdminAction(
  event: {
    type?: string;
    action?: string;
    adminId?: string;
    actorId?: string;
    targetUserId?: string;
    targetId?: string;
    [key: string]: any;
  },
  options: { database?: any } = {}
): Promise<void> {
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

  const db = options.database ?? (await getDb());
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
      // A caller-provided transaction is an atomicity boundary. Never fall back
      // outside that transaction or report a successful privileged mutation
      // without its durable audit record.
      if (options.database) throw error;
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
export async function getAdminAuditLog(
  query: AdminAuditLogQuery = 100
): Promise<Record<string, any>[]> {
  const normalized = normalizeQuery(query);
  const limit = normalized.limit;
  const memoryRows = stableSort([..._memoryLog], normalized.sort);
  const db = await getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(adminAuditLog)
        .orderBy(
          normalized.sort === "asc" ? asc(adminAuditLog.createdAt) : desc(adminAuditLog.createdAt)
        )
        .limit(limit);

      const dbRows = rows.map((row: any) => ({
        ...((row.metadata as Record<string, any>) ?? {}),
        id: row.id,
        type: row.type,
        action: (row.metadata as Record<string, any> | null | undefined)?.action ?? row.type,
        adminId: row.adminId,
        actorId: (row.metadata as Record<string, any> | null | undefined)?.actorId ?? row.adminId,
        targetUserId: row.targetUserId,
        createdAt: row.createdAt,
      }));

      if (mirrorAuditMemory && memoryRows.length > 0) {
        const merged = [...memoryRows, ...dbRows];
        return merged.filter((entry) => matchesQuery(entry, normalized)).slice(0, limit);
      }

      if (rows.length > 0) {
        return dbRows.filter((entry) => matchesQuery(entry, normalized)).slice(0, limit);
      }
    } catch (error) {
      console.error("[AdminAuditLog] DB query failed, falling back to memory:", error);
    }
  }

  // In-memory fallback
  return memoryRows.filter((entry) => matchesQuery(entry, normalized)).slice(0, limit);
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
