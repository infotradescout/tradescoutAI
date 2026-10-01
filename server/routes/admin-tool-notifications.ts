import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { isAuthenticated } from "../auth";

import {
  loadAdminQueueSnapshot,
  projectAdminQueueSnapshot,
  type AdminQueueSnapshot,
} from "../services/adminQueueSummary";

const router = Router();

router.use(isAuthenticated);

const NOTIFICATION_COUNTS_CACHE_TTL_MS = 30_000;
let notificationCountsCache: { snapshot: AdminQueueSnapshot; expiresAt: number } | null = null;
let notificationCountsInFlight: Promise<AdminQueueSnapshot> | null = null;
function normalizeAdminRole(value: unknown): string {
  const role = String(value ?? "")
    .trim()
    .toLowerCase();
  return role === "owner" || role === "head_admin" ? "super_admin" : role;
}

async function getNotificationCountsCached(): Promise<AdminQueueSnapshot> {
  if (notificationCountsCache && notificationCountsCache.expiresAt > Date.now()) {
    return notificationCountsCache.snapshot;
  }
  if (notificationCountsInFlight) return notificationCountsInFlight;
  notificationCountsInFlight = loadAdminQueueSnapshot((sql) => pool.query(sql))
    .then((snapshot) => {
      notificationCountsCache = {
        snapshot,
        expiresAt: Date.now() + NOTIFICATION_COUNTS_CACHE_TTL_MS,
      };
      return snapshot;
    })
    .finally(() => {
      notificationCountsInFlight = null;
    });
  return notificationCountsInFlight;
}

router.get("/", async (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie");
  res.vary("Authorization");
  try {
    const req = _req as any;
    const role = String(req?.user?.activeRole || req?.user?.role || "")
      .trim()
      .toLowerCase();
    const roles = Array.isArray(req?.user?.roles)
      ? req.user.roles
          .map((value: unknown) =>
            String(value || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : [];
    const isAdminLike =
      req?.user?.isAdmin === true ||
      role === "super_admin" ||
      role === "ops_admin" ||
      role === "moderator" ||
      roles.some((value: string) =>
        ["super_admin", "ops_admin", "moderator", "staff", "support_agent"].includes(value)
      );

    if (!isAdminLike) {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Authentication binds the persisted actor to req.user before this handler.
    // Use its primary role, like /api/admin/health; session arrays do not broaden the summary.
    const actorId = req?.user?.id || req?.user?.claims?.sub || null;
    const effectiveRole = normalizeAdminRole(req?.user?.role);
    const adminRoles = ["super_admin", "ops_admin", "moderator"];
    const queueScopeAvailable = Boolean(actorId && adminRoles.includes(effectiveRole));
    const queueSummary = queueScopeAvailable
      ? projectAdminQueueSnapshot(await getNotificationCountsCached(), effectiveRole)
      : {
          message: "Admin queue scope unavailable",
          updatedAt: null,
          countsAvailable: false,
          partiallyAvailable: false,
          totalUnread: null,
          byTool: {},
          counts: {},
        };
    const noQueueSourceAvailable = Object.values(queueSummary.byTool).every(
      (count) => count === null
    );
    return res.status(noQueueSourceAvailable ? 503 : 200).json({
      ...queueSummary,
      queueScopeAvailable,
      degraded: !queueSummary.countsAvailable,
    });
  } catch (error) {
    console.error("[admin-tool-notifications] failed:", error);
    // Preserve an explicit unavailable state when the summary cannot be read.
    return res.status(503).json({
      degraded: true,
      message: "Failed to load admin tool notifications",
      countsAvailable: false,
      totalUnread: null,
      byTool: {},
      counts: {},
      updatedAt: new Date().toISOString(),
    });
  }
});

export default router;
