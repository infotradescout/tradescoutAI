import type { Request, Response } from "express";
import { isAuthenticated, isSuperAdmin, requireAdmin, isAdmin } from "../auth";
import { storage } from "../storage";
import { withAdvisoryLock } from "../utils/advisoryLocks";
import { runHomeScoutIngestionJob } from "../services/homeScoutIngestionJob";
import { db, pool } from "../db";
import {
  affiliateAccounts,
  counties as countiesTable,
  states as statesTable,
  users,
  type AffiliateAccount,
  type AffiliateReferral,
  type AffiliatePayout,
} from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import adminToolDiscoveryRouter from "./admin-tool-discovery";
import { refreshCountyMetrics } from "../services/geographicMetrics";
import { getCountyCoverageSummary } from "../services/geographicCoverage";
import { emailService } from "../services/emailService";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";
import { getAdminAuditLog, logAdminAction } from "../services/adminAuditLogService";
import { spawn } from "child_process";
import {
  businesses,
  businessSeedRuns,
  businessSeedRunLogs,
  businessSuggestions,
} from "../../shared/schema";
import { and } from "drizzle-orm";

/**
 * Admin OS routes: health and high-level telemetry endpoints.
 *
 * URLs and behavior are preserved exactly from the legacy routes.ts
 * implementation; only the registration location has changed.
 */
export function mountAdminRoutes(app: any) {
  // ---------------------------------------------------------------------------
  // Tool Discovery Admin (super_admin only)
  // ---------------------------------------------------------------------------
  app.use("/api/admin", adminToolDiscoveryRouter);

  // ---------------------------------------------------------------------------
  // Super Admin OS Health
  // ---------------------------------------------------------------------------
  // Super admin health check / OS gate
  app.get(
    "/api/admin/health",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
        const user = userId ? await storage.getUser(userId) : null;

        const rawRole = (user as any)?.role ?? null;
        const primaryRole =
          typeof rawRole === "string"
            ? (() => {
                const token = rawRole.trim().toLowerCase();
                if (token === "owner" || token === "head_admin") return "super_admin";
                return token;
              })()
            : rawRole;
        const isSuperAdminRole = primaryRole === "super_admin";

        res.json({
          ok: true,
          userId,
          role: primaryRole,
          rawRole,
          isSuperAdmin: isSuperAdminRole,
        });
      } catch (error: any) {
        console.error("Error in /api/admin/health:", error);
        res.status(500).json({ message: "Failed to resolve admin health" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Email diagnostics (admin-only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/email/diagnostics",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      res.json(emailService.getDiagnostics());
    }
  );

  // ---------------------------------------------------------------------------
  // Admin audit log (super admin only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/audit-log",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const limitRaw = Number(req.query.limit ?? 100);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
        const log = await getAdminAuditLog(limit);
        res.json({ log, count: log.length });
      } catch (error: any) {
        console.error("Error fetching admin audit log:", error);
        res.status(500).json({ message: "Failed to fetch admin audit log" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Business directory ops (unclaimed seeding + suggestions queue)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/business-directory/suggestions",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const statusRaw = String(req.query.status ?? "open")
          .trim()
          .toLowerCase();
        const status =
          statusRaw === "resolved" || statusRaw === "rejected" || statusRaw === "open"
            ? statusRaw
            : "open";
        const kindRaw = String(req.query.kind ?? "")
          .trim()
          .toLowerCase();
        const kind = kindRaw === "removal" || kindRaw === "edit" ? kindRaw : null;
        const limitRaw = Number(req.query.limit ?? 100);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

        const where = [eq(businessSuggestions.status, status as any)];
        if (kind) where.push(eq(businessSuggestions.kind, kind as any));

        const rows = await db
          .select({
            id: businessSuggestions.id,
            businessId: businessSuggestions.businessId,
            kind: businessSuggestions.kind,
            status: businessSuggestions.status,
            payload: businessSuggestions.payload,
            createdByUserId: businessSuggestions.createdByUserId,
            createdAt: businessSuggestions.createdAt,
            updatedAt: businessSuggestions.updatedAt,
            businessName: businesses.name,
            businessSlug: businesses.slug,
          })
          .from(businessSuggestions)
          .innerJoin(businesses, eq(businesses.id, businessSuggestions.businessId))
          .where(and(...where))
          .orderBy(desc(businessSuggestions.createdAt))
          .limit(limit);

        res.json({ items: rows, status, kind, limit });
      } catch (error: any) {
        console.error("Error listing business suggestions:", error);
        res.status(500).json({ message: "Failed to list suggestions" });
      }
    }
  );

  app.post(
    "/api/admin/business-directory/suggestions/:id/status",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const suggestionId = String(req.params.id || "").trim();
        if (!suggestionId) return res.status(400).json({ message: "Invalid suggestion id" });

        const statusRaw = String((req.body as any)?.status ?? "")
          .trim()
          .toLowerCase();
        const nextStatus = statusRaw === "resolved" || statusRaw === "rejected" ? statusRaw : null;
        if (!nextStatus)
          return res.status(400).json({ message: "status must be resolved|rejected" });

        const updated = await db
          .update(businessSuggestions)
          .set({ status: nextStatus as any, updatedAt: new Date() } as any)
          .where(eq(businessSuggestions.id, suggestionId))
          .returning({ id: businessSuggestions.id, status: businessSuggestions.status });

        if (!updated.length) return res.status(404).json({ message: "Suggestion not found" });

        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
        if (userId) {
          await logAdminAction({
            type: "business_suggestion_status_updated",
            adminId: String(userId),
            suggestionId,
            status: nextStatus,
          });
        }

        res.json({ ok: true, suggestion: updated[0] });
      } catch (error: any) {
        console.error("Error updating suggestion status:", error);
        res.status(500).json({ message: "Failed to update suggestion" });
      }
    }
  );

  app.get(
    "/api/admin/business-seeding/runs",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const limitRaw = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

        const rows = await db
          .select({
            id: businessSeedRuns.id,
            source: businessSeedRuns.source,
            locationText: businessSeedRuns.locationText,
            countyFips: businessSeedRuns.countyFips,
            stateCode: businessSeedRuns.stateCode,
            terms: businessSeedRuns.terms,
            requestedByUserId: businessSeedRuns.requestedByUserId,
            status: businessSeedRuns.status,
            insertedCount: businessSeedRuns.insertedCount,
            duplicateCount: businessSeedRuns.duplicateCount,
            errorCount: businessSeedRuns.errorCount,
            errorMessage: businessSeedRuns.errorMessage,
            startedAt: businessSeedRuns.startedAt,
            finishedAt: businessSeedRuns.finishedAt,
            updatedAt: businessSeedRuns.updatedAt,
          })
          .from(businessSeedRuns)
          .orderBy(desc(businessSeedRuns.startedAt))
          .limit(limit);

        res.json({ items: rows, limit });
      } catch (error: any) {
        console.error("Error listing business seed runs:", error);
        res.status(500).json({ message: "Failed to list seed runs" });
      }
    }
  );

  app.get(
    "/api/admin/business-seeding/runs/:id/logs",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const seedRunId = String(req.params.id || "").trim();
        if (!seedRunId) return res.status(400).json({ message: "Invalid run id" });

        const limitRaw = Number(req.query.limit ?? 300);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, limitRaw)) : 300;

        const logs = await db
          .select({
            id: businessSeedRunLogs.id,
            level: businessSeedRunLogs.level,
            message: businessSeedRunLogs.message,
            createdAt: businessSeedRunLogs.createdAt,
          })
          .from(businessSeedRunLogs)
          .where(eq(businessSeedRunLogs.seedRunId, seedRunId))
          .orderBy(desc(businessSeedRunLogs.createdAt))
          .limit(limit);

        res.json({ seedRunId, items: logs, limit });
      } catch (error: any) {
        console.error("Error listing seed run logs:", error);
        res.status(500).json({ message: "Failed to list seed run logs" });
      }
    }
  );

  app.post(
    "/api/admin/business-seeding/places-textsearch/run",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;

        const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
        if (!apiKey) {
          return res
            .status(400)
            .json({ message: "GOOGLE_PLACES_API_KEY is not configured on the server" });
        }
        const dbUrl = String(process.env.DATABASE_URL || "").trim();
        if (!dbUrl) {
          return res.status(400).json({ message: "DATABASE_URL is not configured on the server" });
        }

        const body = (req.body ?? {}) as any;
        const locationText = typeof body.locationText === "string" ? body.locationText.trim() : "";
        const countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : "";
        const stateCode =
          typeof body.stateCode === "string" ? body.stateCode.trim().toUpperCase() : "";
        const termsRaw =
          typeof body.terms === "string"
            ? body.terms
            : Array.isArray(body.terms)
              ? body.terms.join(",")
              : "";
        const terms = String(termsRaw || "")
          .split(",")
          .map((t) => String(t || "").trim())
          .filter(Boolean)
          .slice(0, 25);
        const delayMsRaw = Number(body.delayMs ?? body.delay_ms ?? 1500);
        const delayMs = Number.isFinite(delayMsRaw)
          ? Math.max(250, Math.min(10_000, delayMsRaw))
          : 1500;

        if (!locationText) return res.status(400).json({ message: "locationText is required" });
        if (!/^\d{5}$/.test(countyFips))
          return res.status(400).json({ message: "countyFips must be a 5-digit FIPS" });
        if (!/^[A-Z]{2}$/.test(stateCode))
          return res.status(400).json({ message: "stateCode must be a 2-letter code" });
        if (terms.length === 0)
          return res.status(400).json({ message: "terms is required (comma-separated)" });

        const inserted = await db
          .insert(businessSeedRuns)
          .values({
            source: "google_places_new_textsearch",
            locationText,
            countyFips,
            stateCode,
            terms,
            requestedByUserId: userId ? String(userId) : null,
            status: "running" as any,
            startedAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .returning({ id: businessSeedRuns.id });

        const seedRunId = inserted[0]?.id as string;
        await db.insert(businessSeedRunLogs).values({
          seedRunId,
          level: "info",
          message: `Spawn requested by ${userId ? String(userId) : "unknown"} (delayMs=${delayMs})`,
        } as any);

        const repoRoot = process.cwd();
        const child = spawn(process.execPath, ["scripts/seed_businesses_places_new.mjs"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            DATABASE_URL: dbUrl,
            GOOGLE_PLACES_API_KEY: apiKey,
            SEED_LOCATION: locationText,
            SEED_TERMS: terms.join(","),
            SEED_COUNTY: countyFips,
            SEED_STATE: stateCode,
            SEED_DELAY_MS: String(delayMs),
            SEED_RUN_ID: seedRunId,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });

        let logLines = 0;
        const MAX_LOG_LINES = 200;
        const writeLog = async (level: string, message: string) => {
          if (logLines >= MAX_LOG_LINES) return;
          logLines += 1;
          await db.insert(businessSeedRunLogs).values({
            seedRunId,
            level: level.slice(0, 16),
            message: String(message || "").slice(0, 20_000),
          } as any);
        };

        child.stdout?.on("data", (buf) => {
          void writeLog("info", String(buf || ""));
        });
        child.stderr?.on("data", (buf) => {
          void writeLog("error", String(buf || ""));
        });

        child.on("error", (err) => {
          void writeLog(
            "error",
            `spawn error: ${err instanceof Error ? err.message : String(err)}`
          );
        });

        child.on("exit", (code) => {
          void writeLog("info", `exit code: ${code ?? "null"}`);
          if (typeof code === "number" && code !== 0) {
            void db.execute(sql`
              update business_seed_runs
              set status = case when status = 'running' then 'failed' else status end,
                  error_message = coalesce(error_message, ${`seed script exited with code ${code}`}),
                  finished_at = coalesce(finished_at, now()),
                  updated_at = now()
              where id = ${seedRunId}
            `);
          }
        });

        if (userId) {
          await logAdminAction({
            type: "business_seed_run_spawned",
            adminId: String(userId),
            seedRunId,
            source: "google_places_new_textsearch",
            locationText,
            countyFips,
            stateCode,
            terms,
            delayMs,
          });
        }

        res.status(202).json({ ok: true, seedRunId });
      } catch (error: any) {
        console.error("Error starting Places seeding job:", error);
        res.status(500).json({
          message: "Failed to start seeding job",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin locality heatmap (same behavior as legacy, with role checks)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/heatmap",
    isAuthenticated,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id;
        const user = await storage.getUser(userId);

        if (!user || !["moderator", "ops_admin", "super_admin"].includes(user.role || "")) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const timeframe = (req.query.timeframe as string) || "30d";
        const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;

        const heatmapData = await storage.getLocalityHeatmapData(days);

        res.json(heatmapData);
      } catch (error: any) {
        console.error("Error fetching heatmap data:", error);
        res.status(500).json({ message: "Failed to fetch heatmap data" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin county heatmap: metrics by county FIPS (super admin only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/heatmap/users-by-county",
    isAuthenticated,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        if (!process.env.ADMIN_COUNTY_HEATMAP_ENABLED) {
          return res.status(404).end();
        }

        const userId = (req.user as any)?.id;
        const user = await storage.getUser(userId);
        const role = user?.role || "";

        if (role !== "super_admin") {
          return res.status(403).json({
            reasonCode: "INSUFFICIENT_ROLE",
            message: "Admin-only analytics",
            metric: null,
          });
        }

        const timeframe = (req.query.timeframe as string) || "30d";
        const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
        const requestedMetric = (req.query.metric as string) || "users";

        // 1) Serve strictly from county_metrics for the requested key
        const metricRows = await storage.getCountyMetricsByKey(requestedMetric);
        let metric = requestedMetric;
        const byCounty: Record<string, number> = {};

        if (metricRows.length > 0) {
          for (const row of metricRows) {
            if (!row.countyFips) continue;
            const value = Number(row.metricValue || 0);
            if (!Number.isFinite(value)) continue;
            byCounty[row.countyFips] = value;
          }
        } else {
          // No stored values for this metric key. The client treats this as
          // "metric not populated yet" and renders a neutral map.
          metric = requestedMetric;
        }

        console.log(
          `[ADMIN_MAP] ${userId} viewed county metric=${metric} heatmap at ${new Date().toISOString()}`
        );

        res.json({
          updatedAt: new Date().toISOString(),
          metric,
          timeframe,
          days,
          byCounty,
        });
      } catch (error: any) {
        console.error("Error fetching county heatmap data:", error);
        res.status(500).json({ message: "Failed to fetch county heatmap data" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Seed states + counties from built-in dataset (super admin only)
  // Non-destructive: inserts missing rows, never deletes.
  // ---------------------------------------------------------------------------
  app.post(
    "/api/admin/geo/seed-counties",
    isAuthenticated,
    isSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        const { US_STATES_COUNTIES } = await import("@shared/states-counties");

        const existingStates = await db.select({ code: statesTable.code }).from(statesTable);
        const existingStateCodes = new Set(existingStates.map((s) => s.code));

        const missingStates = (US_STATES_COUNTIES as any[])
          .map((s) => ({
            code: String(s.code || "").toUpperCase(),
            name: String(s.name || "").trim(),
          }))
          .filter((s) => s.code && s.name && !existingStateCodes.has(s.code))
          .map((s) => ({ id: s.code, code: s.code, name: s.name }));

        if (missingStates.length > 0) {
          await db.insert(statesTable).values(missingStates).onConflictDoNothing();
        }

        const existingCounties = await db.select({ fips: countiesTable.fips }).from(countiesTable);
        const existingFips = new Set(existingCounties.map((c) => c.fips));

        const missingCounties: Array<{ fips: string; name: string; stateCode: string }> = [];
        for (const state of US_STATES_COUNTIES as any[]) {
          const stateCode = String(state.code || "").toUpperCase();
          const counties = Array.isArray(state.counties) ? state.counties : [];
          for (const county of counties) {
            const fips = String((county as any).fipsCode || (county as any).fips || "").trim();
            const name = String((county as any).name || "").trim();
            if (!/^\d{5}$/.test(fips)) continue;
            if (!name) continue;
            if (existingFips.has(fips)) continue;
            missingCounties.push({ fips, name, stateCode });
          }
        }

        let insertedCounties = 0;
        const batchSize = 500;
        for (let i = 0; i < missingCounties.length; i += batchSize) {
          const batch = missingCounties.slice(i, i + batchSize);
          await db.insert(countiesTable).values(batch).onConflictDoNothing();
          insertedCounties += batch.length;
        }

        // Return a quick sanity count.
        const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(countiesTable);
        const total = Number((countRow as any)?.n ?? 0);

        return res.json({
          ok: true,
          insertedStates: missingStates.length,
          insertedCounties,
          totalCounties: total,
        });
      } catch (error: any) {
        console.error("Error seeding counties:", error);
        return res.status(500).json({ message: "Failed to seed counties" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin county metrics refresh (super admin only)
  // ---------------------------------------------------------------------------
  const lastGeoMetricsRefreshByUser: Record<string, number> = {};

  app.post(
    "/api/admin/geo/metrics/refresh",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        if (!process.env.ADMIN_COUNTY_HEATMAP_ENABLED) {
          return res.status(404).end();
        }

        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const now = Date.now();
        const last = lastGeoMetricsRefreshByUser[userId] || 0;
        const minIntervalMs = 60_000; // simple in-memory rate limit: 1/min per user

        if (now - last < minIntervalMs) {
          return res.status(429).json({
            message: "Metrics refresh is rate-limited. Please wait a moment and try again.",
          });
        }

        lastGeoMetricsRefreshByUser[userId] = now;

        const startedAt = Date.now();
        const result = await refreshCountyMetrics();
        const durationMs = Date.now() - startedAt;

        console.log(
          `[ADMIN_GEO_METRICS_REFRESH] user=${userId} activeCounties=${result.activeCountyCount} metricsWritten=${result.metricsWritten} durationMs=${durationMs} at=${new Date().toISOString()}`
        );

        res.json({
          ok: true,
          activeCountyCount: result.activeCountyCount,
          metricsWritten: result.metricsWritten,
          durationMs,
        });
      } catch (error: any) {
        console.error("Error refreshing county metrics:", error);
        res.status(500).json({ message: "Failed to refresh county metrics" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin county coverage summary (super admin only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/geo/coverage",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        const startedAt = Date.now();
        const summary = await getCountyCoverageSummary();
        const durationMs = Date.now() - startedAt;

        console.log(
          `[ADMIN_GEO_COVERAGE] user=${userId || "unknown"} role=${role} durationMs=${durationMs} total=${summary.totalCounties} full=${summary.fullyCoveredCounties} partial=${summary.partiallyCoveredCounties} unassigned=${summary.unassignedCounties} at=${new Date().toISOString()}`
        );

        res.json({ ...summary, durationMs });
      } catch (error: any) {
        console.error("Error fetching county coverage summary:", error);
        const code = (error && (error.code || error.errno || error.name)) || "UNKNOWN";

        // Geo coverage must never surface as a raw 500. If the
        // underlying storage or schema is not ready, treat this as a
        // temporary unavailability so the Admin OS can show an honest
        // "coverage data unavailable" state instead of crashing.
        res.status(503).json({
          ok: false,
          reasonCode: "GEO_COVERAGE_UNAVAILABLE",
          message:
            "Geographic coverage data is temporarily unavailable. Please verify schema and try again.",
          errorCode: code,
        });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin county notes (super admin only)
  // ---------------------------------------------------------------------------
  const COUNTY_NOTE_CATEGORIES = [
    "affiliate",
    "employee",
    "partner",
    "operations",
    "risk",
    "general",
  ] as const;
  const COUNTY_ENTITY_TYPES = [
    "affiliate",
    "employee",
    "partner",
    "territory_manager",
    "vendor",
  ] as const;
  const COUNTY_ENTITY_STATUSES = ["active", "inactive", "pending"] as const;

  function isValidFips(fips: string): boolean {
    return /^\d{5}$/.test(fips);
  }

  app.get(
    "/api/admin/geo/counties/:fips/notes",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { fips } = req.params;

        if (!isValidFips(fips)) {
          return res.status(400).json({ message: "Invalid county FIPS" });
        }

        const notes = await storage.getCountyNotes(fips);
        res.json(notes);
      } catch (error: any) {
        console.error("Error fetching county notes:", error);
        res.status(500).json({ message: "Failed to fetch county notes" });
      }
    }
  );

  app.post(
    "/api/admin/geo/counties/:fips/notes",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { fips } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!isValidFips(fips)) {
          return res.status(400).json({ message: "Invalid county FIPS" });
        }

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const { category, content } = (req.body || {}) as { category?: string; content?: string };

        if (!content || typeof content !== "string" || !content.trim()) {
          return res.status(400).json({ message: "Content is required" });
        }

        const normalizedCategory = (category || "general").toLowerCase();
        if (!COUNTY_NOTE_CATEGORIES.includes(normalizedCategory as any)) {
          return res.status(400).json({ message: "Invalid category" });
        }

        const note = await storage.createCountyNote({
          countyFips: fips,
          authorUserId: userId,
          category: normalizedCategory as any,
          content: content.trim(),
        });

        console.log(
          `[ADMIN_COUNTY_NOTE] user=${userId} county=${fips} action=add role=${role} timestamp=${new Date().toISOString()} noteId=${note.id}`
        );

        res.status(201).json(note);
      } catch (error: any) {
        console.error("Error creating county note:", error);
        res.status(500).json({ message: "Failed to create county note" });
      }
    }
  );

  app.patch(
    "/api/admin/geo/notes/:noteId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { noteId } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const existing = await storage.getCountyNoteById(noteId);
        if (!existing) {
          return res.status(404).json({ message: "Note not found" });
        }

        if (existing.authorUserId !== userId && role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Only the author or super admin can edit this note" });
        }

        const { category, content } = (req.body || {}) as { category?: string; content?: string };
        const update: any = {};

        if (typeof content === "string") {
          const trimmed = content.trim();
          if (!trimmed) {
            return res.status(400).json({ message: "Content cannot be empty" });
          }
          update.content = trimmed;
        }

        if (typeof category === "string") {
          const normalizedCategory = category.toLowerCase();
          if (!COUNTY_NOTE_CATEGORIES.includes(normalizedCategory as any)) {
            return res.status(400).json({ message: "Invalid category" });
          }
          update.category = normalizedCategory;
        }

        const updated = await storage.updateCountyNote(noteId, update);

        console.log(
          `[ADMIN_COUNTY_NOTE] user=${userId} county=${existing.countyFips} action=edit role=${role} timestamp=${new Date().toISOString()} noteId=${noteId}`
        );

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating county note:", error);
        res.status(500).json({ message: "Failed to update county note" });
      }
    }
  );

  app.delete(
    "/api/admin/geo/notes/:noteId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { noteId } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const existing = await storage.getCountyNoteById(noteId);
        if (!existing) {
          return res.status(404).json({ message: "Note not found" });
        }

        if (existing.authorUserId !== userId && role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Only the author or super admin can delete this note" });
        }

        await storage.deleteCountyNote(noteId);

        console.log(
          `[ADMIN_COUNTY_NOTE] user=${userId} county=${existing.countyFips} action=delete role=${role} timestamp=${new Date().toISOString()} noteId=${noteId}`
        );

        res.status(204).end();
      } catch (error: any) {
        console.error("Error deleting county note:", error);
        res.status(500).json({ message: "Failed to delete county note" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin county entities (super admin only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/geo/counties/:fips/entities",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { fips } = req.params;

        if (!isValidFips(fips)) {
          return res.status(400).json({ message: "Invalid county FIPS" });
        }

        const entities = await storage.getCountyEntities(fips);
        res.json(entities);
      } catch (error: any) {
        console.error("Error fetching county entities:", error);
        res.status(500).json({ message: "Failed to fetch county entities" });
      }
    }
  );

  app.post(
    "/api/admin/geo/counties/:fips/entities",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { fips } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!isValidFips(fips)) {
          return res.status(400).json({ message: "Invalid county FIPS" });
        }

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const { entityType, entityId, label, status, metadata } = (req.body || {}) as {
          entityType?: string;
          entityId?: string | null;
          label?: string | null;
          status?: string;
          metadata?: unknown;
        };

        if (!entityType || typeof entityType !== "string") {
          return res.status(400).json({ message: "entityType is required" });
        }

        const normalizedType = entityType.toLowerCase();
        if (!COUNTY_ENTITY_TYPES.includes(normalizedType as any)) {
          return res.status(400).json({ message: "Invalid entityType" });
        }

        let normalizedStatus: (typeof COUNTY_ENTITY_STATUSES)[number] = "active";
        if (typeof status === "string") {
          const s = status.toLowerCase();
          if (!COUNTY_ENTITY_STATUSES.includes(s as any)) {
            return res.status(400).json({ message: "Invalid status" });
          }
          normalizedStatus = s as any;
        }

        const safeLabel = typeof label === "string" ? label.trim() : null;
        const safeEntityId = typeof entityId === "string" ? entityId.trim() : null;

        const entity = await storage.createCountyEntity({
          countyFips: fips,
          entityType: normalizedType as any,
          entityId: safeEntityId || null,
          label: safeLabel || null,
          status: normalizedStatus,
          metadata: metadata as any,
        });

        console.log(
          `[ADMIN_COUNTY_ENTITY] user=${userId} county=${fips} action=add type=${normalizedType} status=${normalizedStatus} role=${role} timestamp=${new Date().toISOString()} entityId=${entity.id}`
        );

        res.status(201).json(entity);
      } catch (error: any) {
        console.error("Error creating county entity:", error);
        res.status(500).json({ message: "Failed to create county entity" });
      }
    }
  );

  app.patch(
    "/api/admin/geo/entities/:entityId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { entityId } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const existing = await storage.getCountyEntityById(entityId);
        if (!existing) {
          return res.status(404).json({ message: "Entity not found" });
        }

        const {
          entityType,
          entityId: bodyEntityId,
          label,
          status,
          metadata,
        } = (req.body || {}) as {
          entityType?: string;
          entityId?: string | null;
          label?: string | null;
          status?: string;
          metadata?: unknown;
        };

        const update: any = {};

        if (typeof entityType === "string") {
          const normalizedType = entityType.toLowerCase();
          if (!COUNTY_ENTITY_TYPES.includes(normalizedType as any)) {
            return res.status(400).json({ message: "Invalid entityType" });
          }
          update.entityType = normalizedType;
        }

        if (typeof status === "string") {
          const s = status.toLowerCase();
          if (!COUNTY_ENTITY_STATUSES.includes(s as any)) {
            return res.status(400).json({ message: "Invalid status" });
          }
          update.status = s;
        }

        if (typeof label === "string") {
          update.label = label.trim();
        }

        if (typeof bodyEntityId === "string") {
          update.entityId = bodyEntityId.trim();
        }

        if (metadata !== undefined) {
          update.metadata = metadata as any;
        }

        const updated = await storage.updateCountyEntity(entityId, update);

        console.log(
          `[ADMIN_COUNTY_ENTITY] user=${userId} county=${existing.countyFips} action=edit role=${role} timestamp=${new Date().toISOString()} entityId=${entityId}`
        );

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating county entity:", error);
        res.status(500).json({ message: "Failed to update county entity" });
      }
    }
  );

  app.delete(
    "/api/admin/geo/entities/:entityId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { entityId } = req.params;
        const userId = (req.user as any)?.id;
        const role = (req.user as any)?.role || "";

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const existing = await storage.getCountyEntityById(entityId);
        if (!existing) {
          return res.status(404).json({ message: "Entity not found" });
        }

        await storage.deleteCountyEntity(entityId);

        console.log(
          `[ADMIN_COUNTY_ENTITY] user=${userId} county=${existing.countyFips} action=delete role=${role} timestamp=${new Date().toISOString()} entityId=${entityId}`
        );

        res.status(204).end();
      } catch (error: any) {
        console.error("Error deleting county entity:", error);
        res.status(500).json({ message: "Failed to delete county entity" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Feature Flags & Admin User Management
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/feature-flags",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const features = await storage.getFeatureFlags();
        res.json(features);
      } catch (error: any) {
        console.error("Error fetching feature flags:", error);
        res.status(500).json({ message: "Failed to fetch feature flags" });
      }
    }
  );

  app.post(
    "/api/admin/feature-flags",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const feature = await storage.createFeatureFlag(req.body);
        res.json(feature);
      } catch (error: any) {
        console.error("Error creating feature flag:", error);
        res.status(500).json({ message: "Failed to create feature flag" });
      }
    }
  );

  app.patch(
    "/api/admin/feature-flags/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const feature = await storage.updateFeatureFlag(id, req.body);
        res.json(feature);
      } catch (error: any) {
        console.error("Error updating feature flag:", error);
        res.status(500).json({ message: "Failed to update feature flag" });
      }
    }
  );

  // User Management API Routes
  app.get(
    "/api/admin/users",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allUsers = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            roles: users.roles,
            activeRole: users.activeRole,
            badges: users.badges,
            profileImageUrl: users.profileImageUrl,
            emailVerified: users.emailVerified,
            addressVerified: users.addressVerified,
            createdAt: users.createdAt,
            facebookId: users.facebookId,
            provider: users.provider,
          })
          .from(users)
          .orderBy(desc(users.createdAt));

        res.json(allUsers);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Admin stats endpoint
  app.get(
    "/api/admin/stats",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { count } = await import("drizzle-orm");
        const { communityPosts } = await import("../../shared/schema");

        // Get total user count
        const [totalUsersResult] = await db.select({ count: count() }).from(users);
        const totalUsers = totalUsersResult.count;

        // Get all role breakdowns (no filtering)
        const usersByRole = await db
          .select({
            role: users.role,
            count: count(),
          })
          .from(users)
          .groupBy(users.role);

        const roleMap: Record<string, number> = {};
        let knownRolesTotal = 0;
        const knownRoles = ["homeowner", "contractor", "handyman", "realtor"];
        const unknownRoleBreakdown: Record<string, number> = {};

        usersByRole.forEach((r: any) => {
          const role = r.role || "homeowner";
          roleMap[role] = r.count;

          if (knownRoles.includes(role)) {
            knownRolesTotal += r.count;
          } else {
            unknownRoleBreakdown[role] = r.count;
          }
        });

        const unknownRoleCount = totalUsers - knownRolesTotal;

        // Get community posts count
        const [totalPostsResult] = await db.select({ count: count() }).from(communityPosts);
        const totalPosts = totalPostsResult?.count || 0;

        // Back-compat metrics still consumed by older admin surfaces.
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const totalContractors = (roleMap.contractor || 0) + (roleMap.handyman || 0);
        const [newLeads, totalRecommendations] = await Promise.all([
          storage.getEventStats("lead_submitted", { from: weekAgo, to: today }),
          storage.getEventStats("recommendation_submitted"),
        ]);

        // Log admin stats access for audit
        console.log(
          `[ADMIN AUDIT] Stats accessed by userId=${(req.user as any)?.id} at ${new Date().toISOString()}`
        );

        res.json({
          totalUsers,
          totalContractors,
          newLeads,
          totalRecommendations,
          roleBreakdown: {
            homeowner: roleMap.homeowner || 0,
            contractor: roleMap.contractor || 0,
            handyman: roleMap.handyman || 0,
            realtor: roleMap.realtor || 0,
          },
          unknownRoleCount,
          unknownRoles: unknownRoleBreakdown,
          totalCommunityPosts: totalPosts,
        });
      } catch (error: any) {
        console.error("Error fetching admin stats:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
      }
    }
  );

  app.patch(
    "/api/admin/users/:userId/roles",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { roles, activeRole } = (req.body || {}) as any;

        if (!Array.isArray(roles) || roles.length === 0) {
          return res.status(400).json({ message: "Roles must be a non-empty array" });
        }

        if (!activeRole || !roles.includes(activeRole)) {
          return res.status(400).json({ message: "Active role must be one of the assigned roles" });
        }

        await db
          .update(users)
          .set({
            roles,
            activeRole,
            role: activeRole,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        res.json({ message: "User roles updated successfully" });
      } catch (error: any) {
        console.error("Error updating user roles:", error);
        res.status(500).json({ message: "Failed to update user roles" });
      }
    }
  );

  app.patch(
    "/api/admin/users/:userId/badges",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { badges } = (req.body || {}) as any;

        if (!Array.isArray(badges)) {
          return res.status(400).json({ message: "Badges must be an array" });
        }

        await db.update(users).set({ badges, updatedAt: new Date() }).where(eq(users.id, userId));

        res.json({ message: "Badges updated successfully", badges });
      } catch (error: any) {
        console.error("Error updating user badges:", error);
        res.status(500).json({ message: "Failed to update user badges" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin User Deletion (super admin only)
  // ---------------------------------------------------------------------------
  app.delete(
    "/api/admin/users/:userId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { userId } = req.params;
        const { reason } = (req.body ?? {}) as { reason?: string };
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = adminUserId ? await storage.getUser(adminUserId) : null;
        let normalizedReason = typeof reason === "string" ? reason.trim() : "";

        const adminRole = adminUser?.role || "";

        if (normalizedReason.length < 5) {
          if (adminRole === "super_admin") {
            normalizedReason = "unspecified (legacy)";
          } else {
            return res
              .status(400)
              .json({ message: "Deletion reason is required (min 5 characters)" });
          }
        }

        // Prevent self-deletion
        if (userId === adminUserId) {
          return res.status(400).json({ message: "Cannot delete your own account" });
        }

        // Check if target user exists
        const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Prevent deletion of other admins unless you're super_admin
        const targetRole = targetUser.role || "";
        const adminRoles = ["moderator", "ops_admin", "super_admin"];

        if (adminRoles.includes(targetRole) && adminRole !== "super_admin") {
          return res.status(403).json({
            message: "Only super_admin can delete admin accounts",
          });
        }

        // Perform deletion
        await storage.deleteUser(userId);

        await logAdminAction({
          type: "admin_user_delete",
          adminId: adminUserId,
          adminRole,
          targetUserId: userId,
          targetEmail: targetUser.email,
          targetRole,
          reason: normalizedReason,
        });

        console.log(
          `[ADMIN_USER_DELETE] admin=${adminUserId} role=${adminRole} targetUser=${userId} targetEmail=${targetUser.email} targetRole=${targetRole} reason=${normalizedReason} timestamp=${new Date().toISOString()}`
        );

        res.json({
          success: true,
          message: "User account deleted successfully",
        });
      } catch (error: any) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user account" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin Community Post Deletion (super admin only)
  // ---------------------------------------------------------------------------
  app.delete(
    "/api/admin/community/posts/:postId",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { postId } = req.params;
        const { reason } = (req.body ?? {}) as { reason?: string };
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = adminUserId ? await storage.getUser(adminUserId) : null;
        const adminRole = adminUser?.role || "";
        let normalizedReason = typeof reason === "string" ? reason.trim() : "";

        if (normalizedReason.length < 5) {
          if (adminRole === "super_admin") {
            normalizedReason = "unspecified (legacy)";
          } else {
            return res
              .status(400)
              .json({ message: "Deletion reason is required (min 5 characters)" });
          }
        }

        const { communityPosts } = await import("../../shared/schema");

        // Check if post exists
        const [post] = await db
          .select()
          .from(communityPosts)
          .where(eq(communityPosts.id, postId))
          .limit(1);

        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        // Delete the post
        await db.delete(communityPosts).where(eq(communityPosts.id, postId));

        await logAdminAction({
          type: "admin_community_post_delete",
          adminId: adminUserId,
          adminRole,
          targetPostId: postId,
          authorId: post.authorId,
          reason: normalizedReason,
        });

        console.log(
          `[ADMIN_POST_DELETE] admin=${adminUserId} role=${adminRole} postId=${postId} authorId=${post.authorId} reason=${normalizedReason} timestamp=${new Date().toISOString()}`
        );

        res.json({
          success: true,
          message: "Community post deleted successfully",
        });
      } catch (error: any) {
        console.error("Error deleting community post:", error);
        res.status(500).json({ message: "Failed to delete community post" });
      }
    }
  );

  app.post(
    "/api/admin/users/:userId/impersonate",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { userId } = req.params;
        const { reason } = (req.body ?? {}) as any;

        if (typeof reason !== "string" || reason.trim().length < 5) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 5 characters)" });
        }

        const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const originalUser = req.user as any;
        const adminId = originalUser?.id || originalUser?.claims?.sub;

        (req.session as any).originalUser = {
          id: adminId,
          role: originalUser?.role,
          email: originalUser?.email,
        };

        (req.session as any).impersonatingRole = targetUser.activeRole || targetUser.role;
        (req.session as any).impersonatedUserId = targetUser.id;
        (req.session as any).isImpersonating = true;

        await logAdminAction({
          type: "admin_impersonation_start_user",
          adminId,
          adminRole: originalUser?.role,
          targetUserId: targetUser.id,
          targetRole: targetUser.activeRole || targetUser.role,
          reason: String(reason).trim(),
        });

        res.json({
          message: "Impersonation active",
          isImpersonating: true,
          userId: targetUser.id,
          role: targetUser.activeRole || targetUser.role,
        });
      } catch (error: any) {
        console.error("Error impersonating user:", error);
        res.status(500).json({ message: "Failed to impersonate user" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin Affiliate Management (super_admin / admin only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/affiliates",
    isAuthenticated,
    isAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const rows = await db
          .select({
            id: affiliateAccounts.id,
            affiliateId: affiliateAccounts.affiliateId,
            status: affiliateAccounts.status,
            lifetimeEarned: affiliateAccounts.lifetimeEarned,
            available: affiliateAccounts.available,
            pending: affiliateAccounts.pending,
            referralCode: affiliateAccounts.referralCode,
            commissionRate: affiliateAccounts.commissionRate,
            createdAt: affiliateAccounts.createdAt,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(affiliateAccounts)
          .leftJoin(users, eq(affiliateAccounts.affiliateId, users.id))
          .orderBy(desc(affiliateAccounts.createdAt));

        const payload = rows.map((row) => ({
          id: row.id,
          affiliateId: row.affiliateId,
          email: row.email ?? undefined,
          name: `${row.firstName || ""} ${row.lastName || ""}`.trim() || undefined,
          status: row.status ?? undefined,
          lifetimeEarned: String(row.lifetimeEarned ?? "0"),
          available: String(row.available ?? "0"),
          pending: String(row.pending ?? "0"),
          referralCode: row.referralCode ?? undefined,
          commissionRate: row.commissionRate !== null ? String(row.commissionRate) : undefined,
          createdAt: (row.createdAt as Date | null)?.toISOString?.() || new Date().toISOString(),
        }));

        res.json(payload);
      } catch (error: any) {
        console.error("Error listing affiliates:", error);
        res.status(500).json({ message: "Failed to load affiliates" });
      }
    }
  );

  app.put(
    "/api/admin/affiliates/:id/commission-rate",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { commissionRate } = (req.body || {}) as any;

        if (commissionRate === undefined || commissionRate === null || commissionRate === "") {
          return res.status(400).json({ message: "commissionRate is required" });
        }

        const numeric = Number(commissionRate);
        if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 1) {
          return res.status(400).json({
            message: "commissionRate must be a decimal between 0 and 1 (e.g. 0.05 for 5%)",
          });
        }

        const [updated] = await db
          .update(affiliateAccounts)
          .set({ commissionRate: numeric.toString() })
          .where(eq(affiliateAccounts.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: "Affiliate program not found" });
        }

        res.json({
          id: updated.id,
          commissionRate: updated.commissionRate,
        });
      } catch (error: any) {
        console.error("Error updating affiliate commission rate:", error);
        res.status(500).json({ message: "Failed to update commission rate" });
      }
    }
  );

  app.get(
    "/api/admin/affiliates/:id/detail",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const affiliateId = req.params.id;
        const account = ([] as AffiliateAccount[]).find((a) => a.id === affiliateId);
        if (!account) return res.status(404).json({ message: "Affiliate not found" });

        const referrals = ([] as AffiliateReferral[]).filter((r) => r.affiliateId === affiliateId);
        const payouts = ([] as AffiliatePayout[]).filter((p) => p.affiliateId === affiliateId);

        res.json({ account, referrals, payouts });
      } catch (error: any) {
        console.error("Error loading affiliate detail:", error);
        res.status(500).json({ message: "Failed to load affiliate detail" });
      }
    }
  );

  app.post(
    "/api/admin/affiliates/:id/payout",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id: affiliateProgramId } = req.params as { id: string };
        const { amount, payoutMethod, note, status } = (req.body || {}) as {
          amount?: number | string;
          payoutMethod?: string;
          note?: string;
          status?: string;
        };

        const totalAmount = Number(amount ?? 0);
        if (!affiliateProgramId) {
          return res.status(400).json({ message: "Affiliate program id is required" });
        }
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          return res.status(400).json({ message: "Positive payout amount is required" });
        }

        const payout = await storage.createPayout({
          affiliateProgramId,
          totalAmount: totalAmount.toFixed(2),
          payoutMethod: payoutMethod || "manual",
          status: status || "pending",
          notes: note,
        });

        return res.status(201).json(payout);
      } catch (error: any) {
        console.error("Error creating admin payout:", error);
        res.status(500).json({ message: "Failed to create payout" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Site Settings, Prize Configurations, and Advertisements
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/site-settings",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { category } = req.query as any;
        const settings = await storage.getSiteSettings(category as string);
        res.json(settings);
      } catch (error: any) {
        console.error("Error fetching site settings:", error);
        res.status(500).json({ message: "Failed to fetch site settings" });
      }
    }
  );

  app.post(
    "/api/admin/site-settings",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const setting = await storage.createSiteSetting(req.body);
        res.json(setting);
      } catch (error: any) {
        console.error("Error creating site setting:", error);
        res.status(500).json({ message: "Failed to create site setting" });
      }
    }
  );

  app.put(
    "/api/admin/site-settings/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const setting = await storage.updateSiteSetting(req.params.id, req.body);
        res.json(setting);
      } catch (error: any) {
        console.error("Error updating site setting:", error);
        res.status(500).json({ message: "Failed to update site setting" });
      }
    }
  );

  app.delete(
    "/api/admin/site-settings/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteSiteSetting(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting site setting:", error);
        res.status(500).json({ message: "Failed to delete site setting" });
      }
    }
  );

  app.get(
    "/api/admin/prizes",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const prizes = await storage.getPrizeConfigurations();
        res.json(prizes);
      } catch (error: any) {
        console.error("Error fetching prizes:", error);
        res.status(500).json({ message: "Failed to fetch prizes" });
      }
    }
  );

  app.post(
    "/api/admin/prizes",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const prize = await storage.createPrizeConfiguration(req.body);
        res.json(prize);
      } catch (error: any) {
        console.error("Error creating prize:", error);
        res.status(500).json({ message: "Failed to create prize" });
      }
    }
  );

  app.put(
    "/api/admin/prizes/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const prize = await storage.updatePrizeConfiguration(req.params.id, req.body);
        res.json(prize);
      } catch (error: any) {
        console.error("Error updating prize:", error);
        res.status(500).json({ message: "Failed to update prize" });
      }
    }
  );

  app.delete(
    "/api/admin/prizes/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deletePrizeConfiguration(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting prize:", error);
        res.status(500).json({ message: "Failed to delete prize" });
      }
    }
  );

  app.get(
    "/api/admin/advertisements",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { placement } = req.query as any;
        const ads = await storage.getAdvertisements(placement as string);
        res.json(ads);
      } catch (error: any) {
        console.error("Error fetching advertisements:", error);
        res.status(500).json({ message: "Failed to fetch advertisements" });
      }
    }
  );

  app.post(
    "/api/admin/advertisements",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const ad = await storage.createAdvertisement(req.body);
        res.json(ad);
      } catch (error: any) {
        console.error("Error creating advertisement:", error);
        res.status(500).json({ message: "Failed to create advertisement" });
      }
    }
  );

  app.put(
    "/api/admin/advertisements/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const ad = await storage.updateAdvertisement(req.params.id, req.body);
        res.json(ad);
      } catch (error: any) {
        console.error("Error updating advertisement:", error);
        res.status(500).json({ message: "Failed to update advertisement" });
      }
    }
  );

  app.delete(
    "/api/admin/advertisements/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteAdvertisement(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting advertisement:", error);
        res.status(500).json({ message: "Failed to delete advertisement" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // HomeScout listing moderation (admin-only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/homescout/listings",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status =
          typeof (req.query as any)?.status === "string"
            ? String((req.query as any).status)
            : "pending_review";
        const limitRaw = (req.query as any)?.limit;
        const offsetRaw = (req.query as any)?.offset;

        const rows = await storage.listHomeScoutListings({
          status,
          limit: limitRaw != null ? Number(limitRaw) : 50,
          offset: offsetRaw != null ? Number(offsetRaw) : 0,
          orderBy: status === "active" ? "listedAt" : "createdAt",
        });

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching HomeScout listings (admin):", error);
        res.status(500).json({ message: "Failed to fetch HomeScout listings" });
      }
    }
  );

  app.post(
    "/api/admin/homescout/listings/:id/approve",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "listingId required" });

        const updated = await storage.approveHomeScoutListing({
          listingId,
          approvedByUserId: String(userId),
        });

        if (!updated) return res.status(404).json({ message: "Listing not found" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error approving HomeScout listing:", error);
        res.status(500).json({ message: "Failed to approve HomeScout listing" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // HomeScout listing reports (admin-only)
  // ---------------------------------------------------------------------------
  app.get(
    "/api/admin/homescout/reports",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status =
          typeof (req.query as any)?.status === "string"
            ? String((req.query as any).status)
            : "open";
        const limitRaw = (req.query as any)?.limit;
        const offsetRaw = (req.query as any)?.offset;

        const rows = await storage.listHomeScoutListingReports({
          status: status === "closed" ? "closed" : "open",
          limit: limitRaw != null ? Number(limitRaw) : 50,
          offset: offsetRaw != null ? Number(offsetRaw) : 0,
        });

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching HomeScout reports (admin):", error);
        res.status(500).json({ message: "Failed to fetch HomeScout reports" });
      }
    }
  );

  app.post(
    "/api/admin/homescout/reports/:id/close",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const reportId = String(req.params.id || "");
        if (!reportId) return res.status(400).json({ message: "reportId required" });

        const updated = await storage.closeHomeScoutListingReport({
          reportId,
          closedByUserId: String(userId),
        });

        if (!updated) return res.status(404).json({ message: "Report not found" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error closing HomeScout report:", error);
        res.status(500).json({ message: "Failed to close HomeScout report" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // HomeScout ingestion sources (admin-only)
  // ---------------------------------------------------------------------------

  app.get(
    "/api/admin/homescout/sources",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const enabledRaw = (req.query as any)?.enabled;
        const enabled = enabledRaw === "true" ? true : enabledRaw === "false" ? false : undefined;
        const limitRaw = (req.query as any)?.limit;
        const offsetRaw = (req.query as any)?.offset;

        const rows = await storage.listHomeScoutSources({
          enabled,
          limit: limitRaw != null ? Number(limitRaw) : 50,
          offset: offsetRaw != null ? Number(offsetRaw) : 0,
        });

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching HomeScout sources (admin):", error);
        res.status(500).json({ message: "Failed to fetch HomeScout sources" });
      }
    }
  );

  app.post(
    "/api/admin/homescout/sources",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const body: any = req.body ?? {};
        const sourceKey = typeof body.sourceKey === "string" ? body.sourceKey.trim() : "";
        const sourceType = typeof body.sourceType === "string" ? body.sourceType.trim() : "";
        const enabled = body.enabled == null ? true : Boolean(body.enabled);
        const config = body.config && typeof body.config === "object" ? body.config : {};

        if (!sourceKey || sourceKey.length < 2 || sourceKey.length > 64) {
          return res.status(400).json({ message: "sourceKey (2-64 chars) required" });
        }
        if (!sourceType || sourceType.length < 2 || sourceType.length > 32) {
          return res.status(400).json({ message: "sourceType (2-32 chars) required" });
        }

        const existing = await storage.getHomeScoutSourceByKey(sourceKey);
        if (existing) {
          return res.status(409).json({ message: "sourceKey already exists" });
        }

        const created = await storage.createHomeScoutSource({
          sourceKey,
          sourceType: sourceType as any,
          enabled,
          config,
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
        } as any);

        res.status(201).json(created);
      } catch (error: any) {
        console.error("Error creating HomeScout source (admin):", error);
        res.status(500).json({ message: "Failed to create HomeScout source" });
      }
    }
  );

  app.patch(
    "/api/admin/homescout/sources/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const sourceId = String(req.params.id || "");
        if (!sourceId) return res.status(400).json({ message: "sourceId required" });

        const source = await storage.getHomeScoutSourceById(sourceId);
        if (!source) return res.status(404).json({ message: "Source not found" });

        const body: any = req.body ?? {};
        const updates: any = {};
        if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
        if (body.config && typeof body.config === "object") updates.config = body.config;
        if (typeof body.sourceType === "string" && body.sourceType.trim()) {
          updates.sourceType = body.sourceType.trim();
        }

        const updated = await storage.updateHomeScoutSource(sourceId, updates);
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating HomeScout source (admin):", error);
        res.status(500).json({ message: "Failed to update HomeScout source" });
      }
    }
  );

  app.get(
    "/api/admin/homescout/sources/:id/runs",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const sourceId = String(req.params.id || "");
        if (!sourceId) return res.status(400).json({ message: "sourceId required" });
        const limitRaw = (req.query as any)?.limit;
        const offsetRaw = (req.query as any)?.offset;
        const rows = await storage.listHomeScoutIngestRuns({
          sourceId,
          limit: limitRaw != null ? Number(limitRaw) : 50,
          offset: offsetRaw != null ? Number(offsetRaw) : 0,
        });
        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching HomeScout ingest runs (admin):", error);
        res.status(500).json({ message: "Failed to fetch ingest runs" });
      }
    }
  );

  app.post(
    "/api/admin/homescout/sources/:id/run",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const sourceId = String(req.params.id || "");
        if (!sourceId) return res.status(400).json({ message: "sourceId required" });

        const ran = await withAdvisoryLock("job:homescout_ingestion", async () =>
          runHomeScoutIngestionJob({ sourceId })
        );
        if (ran === null) {
          return res.status(409).json({ message: "Ingestion already running" });
        }
        res.json(ran);
      } catch (error: any) {
        console.error("Error running HomeScout ingestion (admin):", error);
        res.status(500).json({ message: "Failed to run ingestion" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Trade Partner interest submissions (admin-only)
  // ---------------------------------------------------------------------------
  const parsePositiveInt = (
    value: unknown,
    fallback: number,
    opts?: { min?: number; max?: number }
  ): number => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    const finite = Number.isFinite(parsed) ? parsed : fallback;
    const min = opts?.min ?? 0;
    const max = opts?.max ?? Number.MAX_SAFE_INTEGER;
    return Math.min(max, Math.max(min, finite));
  };

  const normalizeCountySlug = (value: unknown): string | null => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (!/^[a-z0-9-]+$/.test(normalized) || normalized.length > 80) return null;
    return normalized;
  };

  const normalizeSearchTerm = (value: unknown): string => {
    const normalized = String(value ?? "").trim();
    if (!normalized) return "";
    return normalized.slice(0, 120);
  };

  const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  app.get(
    "/api/admin/tradepartner-interest",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTradePartnerTables();

        const limit = parsePositiveInt((req.query as any)?.limit, 100, { min: 1, max: 500 });
        const offset = parsePositiveInt((req.query as any)?.offset, 0, { min: 0, max: 50_000 });
        const countySlug = normalizeCountySlug((req.query as any)?.countySlug);
        const search = normalizeSearchTerm((req.query as any)?.q);

        if ((req.query as any)?.countySlug && !countySlug) {
          return res.status(400).json({ message: "Invalid county slug filter" });
        }

        const whereParts: string[] = [];
        const whereValues: any[] = [];

        if (countySlug) {
          whereValues.push(countySlug);
          whereParts.push(`s.county_slug = $${whereValues.length}`);
        }

        if (search) {
          whereValues.push(`%${search}%`);
          const idx = whereValues.length;
          whereParts.push(
            `(s.business_name ILIKE $${idx}
              OR s.service_category ILIKE $${idx}
              OR s.contact_name ILIKE $${idx}
              OR s.email ILIKE $${idx})`
          );
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

        const countQuery = `
          SELECT COUNT(*)::bigint AS total
          FROM tradepartner_interest_submissions s
          ${whereSql}
        `;

        const listQuery = `
          SELECT
            s.id,
            s.county_slug,
            p.county_name,
            p.state_code,
            s.business_name,
            s.service_category,
            s.contact_name,
            s.email,
            s.phone,
            s.message,
            s.acknowledges_exclusivity,
            s.acknowledges_term,
            s.user_agent,
            s.ip_address,
            s.created_at
          FROM tradepartner_interest_submissions s
          LEFT JOIN tradepartner_county_pages p ON p.county_slug = s.county_slug
          ${whereSql}
          ORDER BY s.created_at DESC
          LIMIT $${whereValues.length + 1}
          OFFSET $${whereValues.length + 2}
        `;

        const [countResult, listResult] = await Promise.all([
          pool.query(countQuery, whereValues),
          pool.query(listQuery, [...whereValues, limit, offset]),
        ]);

        const total = Number.parseInt(String(countResult.rows[0]?.total || "0"), 10) || 0;
        const items = listResult.rows.map((row) => ({
          id: row.id,
          countySlug: row.county_slug,
          countyName: row.county_name || null,
          stateCode: row.state_code || null,
          businessName: row.business_name,
          serviceCategory: row.service_category,
          contactName: row.contact_name,
          email: row.email,
          phone: row.phone || null,
          message: row.message || null,
          acknowledgesExclusivity: Boolean(row.acknowledges_exclusivity),
          acknowledgesTerm: Boolean(row.acknowledges_term),
          userAgent: row.user_agent || null,
          ipAddress: row.ip_address || null,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : new Date(row.created_at).toISOString(),
        }));

        return res.json({
          items,
          total,
          limit,
          offset,
          hasMore: offset + items.length < total,
        });
      } catch (error: any) {
        console.error("Error fetching tradepartner interest submissions:", error);
        return res.status(500).json({ message: "Failed to load submissions" });
      }
    }
  );

  app.get(
    "/api/admin/tradepartner-interest/export.csv",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTradePartnerTables();

        const countySlug = normalizeCountySlug((req.query as any)?.countySlug);
        const search = normalizeSearchTerm((req.query as any)?.q);
        const maxRows = parsePositiveInt((req.query as any)?.maxRows, 5000, {
          min: 1,
          max: 20_000,
        });

        if ((req.query as any)?.countySlug && !countySlug) {
          return res.status(400).json({ message: "Invalid county slug filter" });
        }

        const whereParts: string[] = [];
        const whereValues: any[] = [];

        if (countySlug) {
          whereValues.push(countySlug);
          whereParts.push(`s.county_slug = $${whereValues.length}`);
        }

        if (search) {
          whereValues.push(`%${search}%`);
          const idx = whereValues.length;
          whereParts.push(
            `(s.business_name ILIKE $${idx}
              OR s.service_category ILIKE $${idx}
              OR s.contact_name ILIKE $${idx}
              OR s.email ILIKE $${idx})`
          );
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
        const query = `
          SELECT
            s.id,
            s.county_slug,
            p.county_name,
            p.state_code,
            s.business_name,
            s.service_category,
            s.contact_name,
            s.email,
            s.phone,
            s.message,
            s.acknowledges_exclusivity,
            s.acknowledges_term,
            s.ip_address,
            s.user_agent,
            s.created_at
          FROM tradepartner_interest_submissions s
          LEFT JOIN tradepartner_county_pages p ON p.county_slug = s.county_slug
          ${whereSql}
          ORDER BY s.created_at DESC
          LIMIT $${whereValues.length + 1}
        `;

        const result = await pool.query(query, [...whereValues, maxRows]);
        const header = [
          "id",
          "county_slug",
          "county_name",
          "state_code",
          "business_name",
          "service_category",
          "contact_name",
          "email",
          "phone",
          "message",
          "acknowledges_exclusivity",
          "acknowledges_term",
          "ip_address",
          "user_agent",
          "created_at",
        ];

        const lines = [header.join(",")];
        for (const row of result.rows) {
          const createdAt =
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : new Date(row.created_at).toISOString();
          const values = [
            row.id,
            row.county_slug,
            row.county_name,
            row.state_code,
            row.business_name,
            row.service_category,
            row.contact_name,
            row.email,
            row.phone,
            row.message,
            row.acknowledges_exclusivity,
            row.acknowledges_term,
            row.ip_address,
            row.user_agent,
            createdAt,
          ];
          lines.push(values.map(csvEscape).join(","));
        }

        const fileDate = new Date().toISOString().slice(0, 10);
        const csv = `\uFEFF${lines.join("\n")}`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="tradepartner-interest-${fileDate}.csv"`
        );
        return res.status(200).send(csv);
      } catch (error: any) {
        console.error("Error exporting tradepartner interest submissions:", error);
        return res.status(500).json({ message: "Failed to export submissions" });
      }
    }
  );
}
