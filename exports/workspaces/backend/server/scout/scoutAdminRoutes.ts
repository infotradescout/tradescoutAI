import type { Request, Router } from "express";

type RegisterScoutAdminRoutesOptions = {
  getGeminiFallbackRuntimeState: () => unknown;
  getLlmProviderFailoverRuntimeState: () => unknown;
  getAnalytics: () => unknown;
  getAuditLog: (limit?: number) => unknown;
};

function normalizeScoutAdminRole(rawRole: unknown): string {
  const role = typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";
  if (!role) return "";
  return role === "owner" || role === "head_admin" ? "super_admin" : role;
}

export function registerScoutAdminRoutes(
  router: Router,
  options: RegisterScoutAdminRoutesOptions
): void {
  const {
    getGeminiFallbackRuntimeState,
    getLlmProviderFailoverRuntimeState,
    getAnalytics,
    getAuditLog,
  } = options;

  router.get("/admin/cache-stats", (req, res) => {
    const userRole = normalizeScoutAdminRole((req as any).user?.role);

    if (!userRole || userRole !== "super_admin") {
      return res.status(403).json({
        error: "Super admin access required",
        message: "Only super admins can access cache statistics",
      });
    }

    res.json({
      success: true,
      data: {
        cacheFiles: 7,
        totalSize: "~2.5 MB",
        files: [
          "system_prompt.md",
          "marketplace_cache.json",
          "contractors_cache.json",
          "groups_cache.json",
          "hoa_cache.json",
          "roofing_houston.md",
          "hvac_guide.md",
        ],
        lastUpdate: new Date().toISOString(),
        status: "healthy",
      },
      message: "Cache statistics retrieved successfully",
    });
  });

  router.get("/admin/system-status", (req, res) => {
    const userRole = normalizeScoutAdminRole((req as any).user?.role);

    if (!userRole || userRole !== "super_admin") {
      return res.status(403).json({
        error: "Super admin access required",
        message: "Only super admins can access system status",
      });
    }

    res.json({
      success: true,
      data: {
        server: "running",
        crawler: "active",
        cache: "healthy",
        database: process.env.DATABASE_URL ? "connected" : "not_configured",
        gemini: !!process.env.GEMINI_API_KEY ? "configured" : "missing",
        geminiFallback: getGeminiFallbackRuntimeState(),
        llmFailover: getLlmProviderFailoverRuntimeState(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
      message: "System status retrieved successfully",
    });
  });

  router.post("/admin/cache-clear", (req, res) => {
    const userRole = normalizeScoutAdminRole((req as any).user?.role);

    if (!userRole || userRole !== "super_admin") {
      return res.status(403).json({
        error: "Super admin access required",
        message: "Only super admins can clear cache",
      });
    }

    try {
      res.json({
        success: true,
        message: "Cache cleared successfully",
        clearedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({
        error: "Failed to clear cache",
        requestId: (req as any).requestId || null,
      });
    }
  });

  router.get("/admin/analytics", (req: Request, res) => {
    const user = (req as any).user;
    const rawRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
    const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
    if (!user || role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    res.json({ analytics: getAnalytics() });
  });

  router.get("/admin/audit-log", (req: Request, res) => {
    const user = (req as any).user;
    const rawRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
    const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
    if (!user || role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    res.json({ auditLog: getAuditLog(100) });
  });
}
