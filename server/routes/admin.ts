import type { Request, Response } from "express";
import { isAuthenticated, isSuperAdmin, requireAdmin, isAdmin } from "../auth";
import { storage } from "../storage";
import { withAdvisoryLock } from "../utils/advisoryLocks";
import { runHomeScoutIngestionJob } from "../services/homeScoutIngestionJob";
import { db, pool } from "../db";
import {
  getPartnerCountyObservationSnapshots,
  runPartnerCountyObservationSnapshotJob,
} from "../services/partnerCountyObservationSnapshotService";
import {
  getPartnerIntelligenceBriefHistory,
  getPartnerIntelligenceBriefSnapshot,
  runPartnerIntelligenceBriefSnapshotJob,
} from "../services/partnerIntelligenceBriefSnapshotService";
import { runSeoDirectoryScopeSnapshotJob } from "../services/seoDirectoryScopeSnapshotJob";
import {
  affiliateAccounts,
  counties as countiesTable,
  events,
  states as statesTable,
  users,
  type AffiliateAccount,
  type AffiliateReferral,
  type AffiliatePayout,
} from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import adminToolDiscoveryRouter from "./admin-tool-discovery";
import adminDiscoveryObservatoryRouter from "./admin-discovery-observatory";
import { refreshCountyMetrics } from "../services/geographicMetrics";
import { getCountyCoverageSummary } from "../services/geographicCoverage";
import { validateRadarEntityMetadata } from "../services/opportunityRadarSourceGuards";
import { emailService } from "../services/emailService";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";
import { getAdminAuditLog, logAdminAction } from "../services/adminAuditLogService";
import {
  actorHasPrivilegedCapability,
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
} from "../utils/privilegedActions";
import { spawn } from "child_process";
import {
  businesses,
  businessSeedRuns,
  businessSeedRunLogs,
  businessSuggestions,
} from "../../shared/schema";
import { and } from "drizzle-orm";
import { resolveRuntimeEntrypoint } from "../runtimeEntrypoints";

function parseIsoDateParam(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const isoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!isoUtcPattern.test(raw)) return new Date("invalid");
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date("invalid") : parsed;
}

const PENSACOLA_COUNTY_FIPS = "12033";

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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
  app.use("/api/admin/discovery-observatory", adminDiscoveryObservatoryRouter);

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
        const action = String(req.query.action ?? "").trim();
        const actorId = String(req.query.actorId ?? "").trim();
        const sort =
          String(req.query.sort ?? "desc")
            .trim()
            .toLowerCase() === "asc"
            ? "asc"
            : "desc";
        const from = parseIsoDateParam(req.query.from);
        const to = parseIsoDateParam(req.query.to);

        if (from && Number.isNaN(from.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid from timestamp. Use strict ISO UTC format." });
        }
        if (to && Number.isNaN(to.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid to timestamp. Use strict ISO UTC format." });
        }

        const log = await getAdminAuditLog({
          limit,
          action: action || undefined,
          actorId: actorId || undefined,
          from: from || undefined,
          to: to || undefined,
          sort,
        });
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
    "/api/admin/business-directory/pensacola-liquidity/summary",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const [supplyResult, tradeResult, claimStateResult, recentSeedResult, suggestionResult] =
          await Promise.all([
            pool.query(
              `
              SELECT
                COUNT(DISTINCT b.id)::int AS candidate_count,
                COUNT(DISTINCT b.id) FILTER (
                  WHERE b.status = 'active'
                    AND b.claim_status = 'claimed'
                    AND (
                      u.verification_status = 'approved'
                      OR COALESCE(u.verified_badge, false) = true
                    )
                )::int AS verified_active_count,
                COUNT(DISTINCT b.id) FILTER (WHERE b.claim_status = 'claimed')::int AS claimed_count,
                COUNT(DISTINCT b.id) FILTER (WHERE b.claim_status = 'unclaimed')::int AS unclaimed_count
              FROM businesses b
              INNER JOIN business_counties bc ON bc.business_id = b.id
              INNER JOIN counties c ON c.id = bc.county_id
              LEFT JOIN users u ON u.id = b.owner_user_id
              WHERE c.fips = $1
                AND b.status <> 'suspended'
                AND COALESCE(b.public_discovery_enabled, true) = true
            `,
              [PENSACOLA_COUNTY_FIPS]
            ),
            pool.query(
              `
              SELECT
                COALESCE(NULLIF(b.profile_data->>'category', ''), b.type, 'uncategorized') AS trade_category,
                COUNT(DISTINCT b.id)::int AS candidate_count,
                COUNT(DISTINCT b.id) FILTER (
                  WHERE b.status = 'active'
                    AND b.claim_status = 'claimed'
                    AND (
                      u.verification_status = 'approved'
                      OR COALESCE(u.verified_badge, false) = true
                    )
                )::int AS verified_active_count
              FROM businesses b
              INNER JOIN business_counties bc ON bc.business_id = b.id
              INNER JOIN counties c ON c.id = bc.county_id
              LEFT JOIN users u ON u.id = b.owner_user_id
              WHERE c.fips = $1
                AND b.status <> 'suspended'
                AND COALESCE(b.public_discovery_enabled, true) = true
              GROUP BY 1
              ORDER BY verified_active_count DESC, candidate_count DESC, trade_category ASC
              LIMIT 25
            `,
              [PENSACOLA_COUNTY_FIPS]
            ),
            pool.query(
              `
              SELECT
                b.claim_status AS claim_status,
                b.status AS business_status,
                COUNT(DISTINCT b.id)::int AS total
              FROM businesses b
              INNER JOIN business_counties bc ON bc.business_id = b.id
              INNER JOIN counties c ON c.id = bc.county_id
              WHERE c.fips = $1
                AND b.status <> 'suspended'
                AND COALESCE(b.public_discovery_enabled, true) = true
              GROUP BY 1, 2
              ORDER BY total DESC, claim_status ASC, business_status ASC
            `,
              [PENSACOLA_COUNTY_FIPS]
            ),
            pool.query(
              `
              SELECT
                COUNT(*)::int AS total_runs,
                COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded_runs,
                COALESCE(SUM(inserted_count), 0)::int AS inserted_count,
                COALESCE(SUM(duplicate_count), 0)::int AS duplicate_count,
                COALESCE(SUM(error_count), 0)::int AS error_count
              FROM business_seed_runs
              WHERE county_fips = $1
                AND state_code = 'FL'
                AND started_at >= now() - interval '30 days'
            `,
              [PENSACOLA_COUNTY_FIPS]
            ),
            pool.query(
              `
              SELECT
                bs.status AS suggestion_status,
                COUNT(*)::int AS total
              FROM business_suggestions bs
              INNER JOIN businesses b ON b.id = bs.business_id
              INNER JOIN business_counties bc ON bc.business_id = b.id
              INNER JOIN counties c ON c.id = bc.county_id
              WHERE c.fips = $1
              GROUP BY 1
              ORDER BY total DESC, suggestion_status ASC
            `,
              [PENSACOLA_COUNTY_FIPS]
            ),
          ]);

        const supply = (supplyResult.rows?.[0] as any) || {};
        const seed = (recentSeedResult.rows?.[0] as any) || {};

        return res.json({
          county: {
            countyFips: PENSACOLA_COUNTY_FIPS,
            label: "Pensacola / Escambia County",
            stateCode: "FL",
          },
          supply: {
            candidateCount: toInt(supply.candidate_count),
            verifiedActiveCount: toInt(supply.verified_active_count),
            claimedCount: toInt(supply.claimed_count),
            unclaimedCount: toInt(supply.unclaimed_count),
            verifiedActiveSource:
              "Derived from existing businesses joined to Escambia County where status=active, claim_status=claimed, and owner verification is approved or verified badge is true.",
          },
          tradeCategoryCounts: (tradeResult.rows || []).map((row: any) => ({
            tradeCategory: String(row.trade_category || "uncategorized"),
            candidateCount: toInt(row.candidate_count),
            verifiedActiveCount: toInt(row.verified_active_count),
          })),
          claimStateCounts: (claimStateResult.rows || []).map((row: any) => ({
            claimStatus: String(row.claim_status || "unknown"),
            businessStatus: String(row.business_status || "unknown"),
            total: toInt(row.total),
          })),
          recentSeeding: {
            windowDays: 30,
            totalRuns: toInt(seed.total_runs),
            succeededRuns: toInt(seed.succeeded_runs),
            insertedCount: toInt(seed.inserted_count),
            duplicateCount: toInt(seed.duplicate_count),
            errorCount: toInt(seed.error_count),
          },
          suggestionCounts: (suggestionResult.rows || []).map((row: any) => ({
            status: String(row.suggestion_status || "unknown"),
            total: toInt(row.total),
          })),
          outreachStatus: {
            contacted: {
              supported: false,
              count: 0,
              reason:
                "No safe existing outreach event source is wired for provider contacted status.",
            },
            interested: {
              supported: false,
              count: 0,
              reason:
                "No safe existing outreach event source is wired for provider interested status.",
            },
          },
          blockers: {
            contactGate: { supported: false, count: 0 },
            paidRankingInfluence: { supported: false, count: 0 },
            fakeStatus: { supported: false, count: 0 },
          },
        });
      } catch (error: any) {
        console.error("Error fetching Pensacola liquidity supply summary:", error);
        res.status(500).json({ message: "Failed to fetch Pensacola liquidity supply summary" });
      }
    }
  );

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
        const seedEntrypoint = resolveRuntimeEntrypoint(
          "seed-businesses-places-new.mjs",
          "scripts/seed_businesses_places_new.mjs",
          repoRoot
        );
        const child = spawn(process.execPath, [seedEntrypoint], {
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
        const radarMetadataValidation = validateRadarEntityMetadata(metadata);
        if (!radarMetadataValidation.ok) {
          return res.status(400).json({
            message: "County entity metadata is not eligible for Opportunity Radar exposure",
            errors: radarMetadataValidation.errors,
          });
        }

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
          const radarMetadataValidation = validateRadarEntityMetadata(metadata);
          if (!radarMetadataValidation.ok) {
            return res.status(400).json({
              message: "County entity metadata is not eligible for Opportunity Radar exposure",
              errors: radarMetadataValidation.errors,
            });
          }
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

  app.get(
    "/api/admin/geo/counties/:fips/folder",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { fips } = req.params;
        if (!isValidFips(fips)) {
          return res.status(400).json({ message: "Invalid county FIPS" });
        }

        await ensureTradePartnerTables();

        const county = await storage.getCountyByFips(fips);
        if (!county) {
          return res.status(404).json({ message: "County not found" });
        }

        const countyName = String((county as any).name || "").trim();
        const stateCode = String((county as any).stateCode || "")
          .trim()
          .toUpperCase();
        const countyNameSlug = countyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .replace(/-+/g, "-");
        const stateSuffix = stateCode.toLowerCase();
        const slugCandidates = new Set<string>();

        if (countyNameSlug && stateSuffix) {
          slugCandidates.add(`${countyNameSlug}-${stateSuffix}`);
          slugCandidates.add(`${countyNameSlug}-county-${stateSuffix}`);
          slugCandidates.add(`${countyNameSlug}-parish-${stateSuffix}`);
          slugCandidates.add(`${countyNameSlug}-borough-${stateSuffix}`);
          slugCandidates.add(`${countyNameSlug}-city-${stateSuffix}`);
          slugCandidates.add(`${countyNameSlug}-census-area-${stateSuffix}`);
        }

        const countySlugRows = await pool.query(
          `
          SELECT county_slug
          FROM tradepartner_county_pages
          WHERE UPPER(state_code) = $1
            AND (
              LOWER(county_name) = LOWER($2)
              OR LOWER(county_name) = LOWER($2 || ' County')
              OR LOWER(county_name) = LOWER($2 || ' Parish')
              OR LOWER(county_name) = LOWER($2 || ' Borough')
            )
        `,
          [stateCode, countyName]
        );
        for (const row of countySlugRows.rows) {
          const slug = String((row as any).county_slug || "")
            .trim()
            .toLowerCase();
          if (slug) slugCandidates.add(slug);
        }

        const countySlugs = Array.from(slugCandidates);
        const notes = await storage.getCountyNotes(fips);
        const entities = await storage.getCountyEntities(fips);

        const [meetingsResult, rsvpResult, interestResult] = await Promise.all([
          countySlugs.length
            ? pool.query(
                `
                SELECT
                  partner_slug,
                  meeting_id,
                  county_slug,
                  county_label,
                  meeting_date,
                  date_label,
                  time_label,
                  start_datetime,
                  meeting_city,
                  address_line1,
                  address_line2,
                  event_label,
                  is_active
                FROM tradepartner_campaign_meetings
                WHERE county_slug = ANY($1::text[])
                ORDER BY meeting_date ASC, sort_order ASC, start_datetime ASC NULLS LAST
              `,
                [countySlugs]
              )
            : Promise.resolve({ rows: [] as any[] }),
          countySlugs.length
            ? pool.query(
                `
                SELECT
                  id,
                  partner_slug,
                  county_slug,
                  county_label,
                  event_label,
                  meeting_id,
                  meeting_date,
                  time_label,
                  start_datetime,
                  business_name,
                  contact_name,
                  contact_email,
                  contact_phone,
                  attendee_count,
                  lunch_attendees,
                  notes,
                  submitted_by_user_id,
                  attendance_status,
                  attendance_notes,
                  checked_in_at,
                  checked_in_by_user_id,
                  created_at,
                  updated_at
                FROM tradepartner_rsvp_submissions
                WHERE county_slug = ANY($1::text[])
                ORDER BY created_at DESC
                LIMIT 500
              `,
                [countySlugs]
              )
            : Promise.resolve({ rows: [] as any[] }),
          countySlugs.length
            ? pool.query(
                `
                SELECT
                  id,
                  county_slug,
                  business_name,
                  service_category,
                  contact_name,
                  email,
                  phone,
                  message,
                  created_at
                FROM tradepartner_interest_submissions
                WHERE county_slug = ANY($1::text[])
                ORDER BY created_at DESC
                LIMIT 300
              `,
                [countySlugs]
              )
            : Promise.resolve({ rows: [] as any[] }),
        ]);

        return res.json({
          county: {
            fips,
            countyName,
            stateCode,
            countySlugs,
          },
          counts: {
            notes: notes.length,
            entities: entities.length,
            meetings: meetingsResult.rows.length,
            rsvps: rsvpResult.rows.length,
            interestSubmissions: interestResult.rows.length,
          },
          notes,
          entities,
          meetings: meetingsResult.rows.map((row: any) => ({
            partnerSlug: row.partner_slug,
            meetingId: row.meeting_id,
            countySlug: row.county_slug,
            countyLabel: row.county_label,
            meetingDate: row.meeting_date,
            dateLabel: row.date_label,
            timeLabel: row.time_label,
            startDateTime: row.start_datetime,
            meetingCity: row.meeting_city,
            addressLine1: row.address_line1,
            addressLine2: row.address_line2,
            eventLabel: row.event_label,
            isActive: Boolean(row.is_active),
          })),
          rsvps: rsvpResult.rows.map((row: any) => ({
            id: row.id,
            partnerSlug: row.partner_slug,
            countySlug: row.county_slug,
            countyLabel: row.county_label,
            eventLabel: row.event_label,
            meetingId: row.meeting_id,
            meetingDate: row.meeting_date,
            timeLabel: row.time_label,
            startDateTime: row.start_datetime,
            businessName: row.business_name,
            contactName: row.contact_name,
            contactEmail: row.contact_email,
            contactPhone: row.contact_phone,
            attendeeCount: row.attendee_count,
            lunchAttendees: row.lunch_attendees,
            notes: row.notes,
            submittedByUserId: row.submitted_by_user_id,
            attendanceStatus: row.attendance_status,
            attendanceNotes: row.attendance_notes,
            checkedInAt: row.checked_in_at,
            checkedInByUserId: row.checked_in_by_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
          interestSubmissions: interestResult.rows.map((row: any) => ({
            id: row.id,
            countySlug: row.county_slug,
            businessName: row.business_name,
            serviceCategory: row.service_category,
            contactName: row.contact_name,
            email: row.email,
            phone: row.phone,
            message: row.message,
            createdAt: row.created_at,
          })),
        });
      } catch (error: any) {
        console.error("Error loading county folder:", error);
        return res.status(500).json({ message: "Failed to load county folder" });
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
            preferences: users.preferences,
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

  app.get(
    "/api/admin/activity/daily-users",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const daysRaw = Number(req.query.days ?? 30);
        const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(90, daysRaw)) : 30;
        const userLimitRaw = Number(req.query.userLimit ?? 20);
        const userLimit = Number.isFinite(userLimitRaw)
          ? Math.max(5, Math.min(100, userLimitRaw))
          : 20;

        const timezoneRaw = String(req.query.timezone || "America/Chicago").trim();
        const timezone = timezoneRaw.length > 0 ? timezoneRaw : "America/Chicago";

        const dailyRows = await db.execute(sql<{
          day_key: string;
          active_users: number;
          event_count: number;
        }>`
          SELECT
            to_char(date_trunc('day', e.created_at AT TIME ZONE ${timezone}), 'YYYY-MM-DD') AS day_key,
            COUNT(DISTINCT e.user_id)::int AS active_users,
            COUNT(*)::int AS event_count
          FROM events e
          WHERE e.user_id IS NOT NULL
            AND e.created_at >= now() - (${days}::int * interval '1 day')
          GROUP BY 1
          ORDER BY 1 DESC
        `);

        const todayRows = await db.execute(sql<{
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          profile_image_url: string | null;
          last_event_at: string;
          event_count: number;
        }>`
          WITH today_activity AS (
            SELECT
              e.user_id::text AS user_id,
              MAX(e.created_at) AS last_event_at,
              COUNT(*)::int AS event_count
            FROM events e
            WHERE e.user_id IS NOT NULL
              AND date_trunc('day', e.created_at AT TIME ZONE ${timezone}) =
                  date_trunc('day', now() AT TIME ZONE ${timezone})
            GROUP BY e.user_id
          )
          SELECT
            ta.user_id AS id,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_image_url,
            ta.last_event_at::text AS last_event_at,
            ta.event_count
          FROM today_activity ta
          LEFT JOIN users u ON u.id = ta.user_id
          ORDER BY ta.last_event_at DESC
          LIMIT ${userLimit}
        `);

        const topActiveRows = await db.execute(sql<{
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          profile_image_url: string | null;
          active_days: number;
          total_events: number;
          last_event_at: string;
        }>`
          WITH windowed AS (
            SELECT
              e.user_id::text AS user_id,
              COUNT(DISTINCT date_trunc('day', e.created_at AT TIME ZONE ${timezone}))::int AS active_days,
              COUNT(*)::int AS total_events,
              MAX(e.created_at) AS last_event_at
            FROM events e
            WHERE e.user_id IS NOT NULL
              AND e.created_at >= now() - (${days}::int * interval '1 day')
            GROUP BY e.user_id
          )
          SELECT
            w.user_id AS id,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_image_url,
            w.active_days,
            w.total_events,
            w.last_event_at::text AS last_event_at
          FROM windowed w
          LEFT JOIN users u ON u.id = w.user_id
          ORDER BY w.active_days DESC, w.last_event_at DESC
          LIMIT ${userLimit}
        `);

        const rowMap = new Map<string, { activeUsers: number; events: number }>();
        for (const row of (dailyRows.rows || []) as any[]) {
          const day = String(row.day_key || "");
          if (!day) continue;
          rowMap.set(day, {
            activeUsers: Number(row.active_users || 0),
            events: Number(row.event_count || 0),
          });
        }

        const now = new Date();
        const daySeries: Array<{ day: string; activeUsers: number; events: number }> = [];
        for (let i = 0; i < days; i += 1) {
          const cursor = new Date(now);
          cursor.setUTCDate(now.getUTCDate() - i);
          const key = cursor.toISOString().slice(0, 10);
          const bucket = rowMap.get(key) || { activeUsers: 0, events: 0 };
          daySeries.push({
            day: key,
            activeUsers: bucket.activeUsers,
            events: bucket.events,
          });
        }

        const trailing7 = daySeries.slice(0, 7);
        const trailing30 = daySeries.slice(0, Math.min(30, daySeries.length));
        const trailing7DayAverage =
          trailing7.reduce((sum, item) => sum + item.activeUsers, 0) /
          Math.max(1, trailing7.length);
        const trailing30DayAverage =
          trailing30.reduce((sum, item) => sum + item.activeUsers, 0) /
          Math.max(1, trailing30.length);

        const today = daySeries[0] || {
          day: new Date().toISOString().slice(0, 10),
          activeUsers: 0,
          events: 0,
        };

        res.json({
          timezone,
          days,
          series: daySeries,
          trailing7DayAverage: Number(trailing7DayAverage.toFixed(2)),
          trailing30DayAverage: Number(trailing30DayAverage.toFixed(2)),
          today: {
            day: today.day,
            activeUsers: today.activeUsers,
            events: today.events,
            users: (todayRows.rows || []).map((row: any) => ({
              id: String(row.id || ""),
              email: row.email ? String(row.email) : "",
              firstName: row.first_name ? String(row.first_name) : "",
              lastName: row.last_name ? String(row.last_name) : "",
              profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : null,
              lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
              eventCount: Number(row.event_count || 0),
            })),
          },
          topActiveUsers: (topActiveRows.rows || []).map((row: any) => ({
            id: String(row.id || ""),
            email: row.email ? String(row.email) : "",
            firstName: row.first_name ? String(row.first_name) : "",
            lastName: row.last_name ? String(row.last_name) : "",
            profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : null,
            activeDays: Number(row.active_days || 0),
            totalEvents: Number(row.total_events || 0),
            lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching admin daily user activity:", error);
        res.status(500).json({ message: "Failed to fetch daily user activity" });
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

        // Build role breakdown from effective community roles (activeRole + roles + role),
        // and exclude archived/import-placeholder accounts from distribution stats.
        const userRoleRows = await db
          .select({
            role: users.role,
            activeRole: users.activeRole,
            roles: users.roles,
            email: users.email,
            preferences: users.preferences,
          })
          .from(users);

        const normalizeRoleToken = (value: unknown): string => {
          const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
          if (!raw) return "";
          if (raw === "owner" || raw === "head_admin") return "super_admin";
          return raw;
        };

        const isArchivedPlaceholderEmail = (email: unknown): boolean => {
          const normalized = String(email || "")
            .trim()
            .toLowerCase();
          return (
            normalized.startsWith("archived+") && normalized.endsWith("@thetradescout.invalid")
          );
        };

        const isImportTaggedAccount = (prefs: unknown): boolean => {
          const record =
            prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>) : {};
          const joined = [
            record.importSource,
            record.sourceTag,
            record.createdBy,
            record.archivedReason,
            record.accountOrigin,
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return (
            joined.includes("import") ||
            joined.includes("admin_import_cleanup") ||
            record.isImportedBusiness === true
          );
        };

        const isBusinessIntentAccount = (prefs: unknown): boolean => {
          const record =
            prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>) : {};
          const directIntent = String(record.userIntent || "")
            .trim()
            .toLowerCase();
          const provisional =
            record.provisional && typeof record.provisional === "object"
              ? (record.provisional as Record<string, unknown>)
              : {};
          const provisionalIntent = String(provisional.userIntent || "")
            .trim()
            .toLowerCase();
          const accountType = String(record.accountType || provisional.accountType || "")
            .trim()
            .toLowerCase();
          return (
            directIntent === "business" ||
            provisionalIntent === "business" ||
            accountType === "business" ||
            record.isBusiness === true
          );
        };

        const roleMap: Record<"homeowner" | "contractor" | "handyman" | "realtor", number> = {
          homeowner: 0,
          contractor: 0,
          handyman: 0,
          realtor: 0,
        };
        const unknownRoleBreakdown: Record<string, number> = {};
        let includedUsers = 0;

        for (const row of userRoleRows as any[]) {
          if (isArchivedPlaceholderEmail(row.email)) continue;
          if (isImportTaggedAccount(row.preferences)) continue;

          const roleTokens = new Set<string>();
          const addRole = (value: unknown) => {
            const token = normalizeRoleToken(value);
            if (!token) return;
            roleTokens.add(token);
          };
          addRole(row.role);
          addRole(row.activeRole);
          if (Array.isArray(row.roles)) {
            for (const token of row.roles) addRole(token);
          }

          if (roleTokens.size === 0) continue;
          includedUsers += 1;

          const isHandyman = roleTokens.has("handyman") || roleTokens.has("helper");
          const isRealtor = roleTokens.has("realtor");
          const isContractor =
            roleTokens.has("contractor") ||
            roleTokens.has("contractor_user") ||
            roleTokens.has("service_provider") ||
            roleTokens.has("maintenance_contractor") ||
            roleTokens.has("specialty_tradesperson") ||
            roleTokens.has("accelerator_member");
          const isAdminLike =
            roleTokens.has("super_admin") ||
            roleTokens.has("ops_admin") ||
            roleTokens.has("moderator");
          const isBusinessIntent = isBusinessIntentAccount(row.preferences);
          const isHomeowner =
            roleTokens.has("homeowner") ||
            roleTokens.has("renter") ||
            roleTokens.has("landlord") ||
            roleTokens.has("hoa_member");

          if (isHandyman) roleMap.handyman += 1;
          if (isRealtor) roleMap.realtor += 1;
          if (isContractor) roleMap.contractor += 1;

          const isHomeownerOnly =
            isHomeowner &&
            !isContractor &&
            !isHandyman &&
            !isRealtor &&
            !isAdminLike &&
            !isBusinessIntent;
          if (isHomeownerOnly) {
            roleMap.homeowner += 1;
          }

          if (!isHomeownerOnly && !isContractor && !isHandyman && !isRealtor) {
            const fallbackToken =
              normalizeRoleToken(row.activeRole) || normalizeRoleToken(row.role) || "unknown";
            unknownRoleBreakdown[fallbackToken] = (unknownRoleBreakdown[fallbackToken] || 0) + 1;
          }
        }

        const knownRolesTotal =
          roleMap.homeowner + roleMap.contractor + roleMap.handyman + roleMap.realtor;
        const unknownRoleCount = Math.max(0, includedUsers - knownRolesTotal);

        // Get community posts count
        const [totalPostsResult] = await db.select({ count: count() }).from(communityPosts);
        const totalPosts = totalPostsResult?.count || 0;

        // Back-compat metrics still consumed by older admin surfaces.
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const totalContractors = roleMap.contractor + roleMap.handyman;
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
            homeowner: roleMap.homeowner,
            contractor: roleMap.contractor,
            handyman: roleMap.handyman,
            realtor: roleMap.realtor,
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
        const actorId = normalizeImmutableTargetId(
          (req as any)?.user?.id || (req as any)?.user?.claims?.sub
        );
        const actor = actorId ? await storage.getUser(actorId) : null;
        const actorContext = resolvePrivilegedActor(actor || (req as any)?.user);
        const targetUserId = normalizeImmutableTargetId((req.params as any)?.userId);
        const { roles, activeRole } = (req.body || {}) as any;
        const reason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        if (!actorId) {
          return res.status(401).json({ message: "Actor not found" });
        }
        if (!targetUserId) {
          return res.status(400).json({ message: "userId is required" });
        }
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
        }

        const targetUser = await storage.getUser(targetUserId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

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
          .where(eq(users.id, targetUserId));

        await auditPrivilegedAction({
          action: "admin_user_roles_update",
          route: "/api/admin/users/:userId/roles",
          operationType: "update_user_roles",
          actorId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "user",
          targetId: targetUserId,
          resolutionSource: "route_param:user_id",
          reason,
          outcome: "completed",
          details: {
            targetEmail: targetUser.email || null,
            roleCount: roles.length,
            activeRole,
          },
        });

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
        const actorId = normalizeImmutableTargetId(
          (req as any)?.user?.id || (req as any)?.user?.claims?.sub
        );
        const actor = actorId ? await storage.getUser(actorId) : null;
        const actorContext = resolvePrivilegedActor(actor || (req as any)?.user);
        const targetUserId = normalizeImmutableTargetId((req.params as any)?.userId);
        const { badges } = (req.body || {}) as any;
        const reason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        if (!actorId) {
          return res.status(401).json({ message: "Actor not found" });
        }
        if (!targetUserId) {
          return res.status(400).json({ message: "userId is required" });
        }
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
        }

        const targetUser = await storage.getUser(targetUserId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (!Array.isArray(badges)) {
          return res.status(400).json({ message: "Badges must be an array" });
        }

        await db
          .update(users)
          .set({ badges, updatedAt: new Date() })
          .where(eq(users.id, targetUserId));

        await auditPrivilegedAction({
          action: "admin_user_badges_update",
          route: "/api/admin/users/:userId/badges",
          operationType: "update_user_badges",
          actorId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "user",
          targetId: targetUserId,
          resolutionSource: "route_param:user_id",
          reason,
          outcome: "completed",
          details: {
            targetEmail: targetUser.email || null,
            badgeCount: badges.length,
          },
        });

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
        const targetUserId = normalizeImmutableTargetId((req.params as any)?.userId);
        const adminUserId = normalizeImmutableTargetId(
          (req.user as any)?.id || (req.user as any)?.claims?.sub
        );
        const adminUser = adminUserId ? await storage.getUser(adminUserId) : null;
        const actorContext = resolvePrivilegedActor(adminUser || req.user);
        const normalizedReason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        const adminRole = adminUser?.role || "";

        if (!targetUserId) {
          return res.status(400).json({ message: "userId is required" });
        }
        if (!normalizedReason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
        }

        // Prevent self-deletion
        if (targetUserId === adminUserId) {
          return res.status(400).json({ message: "Cannot delete your own account" });
        }

        // Check if target user exists
        const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
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
        await storage.deleteUser(targetUserId);

        await auditPrivilegedAction({
          action: "admin_user_delete",
          route: "/api/admin/users/:userId",
          operationType: "delete_user",
          actorId: adminUserId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "user",
          targetId: targetUserId,
          resolutionSource: "route_param:user_id",
          reason: normalizedReason,
          outcome: "completed",
          details: {
            targetEmail: targetUser.email,
            targetRole,
          },
        });

        await logAdminAction({
          type: "admin_user_delete",
          adminId: adminUserId ?? undefined,
          adminRole,
          targetUserId,
          targetEmail: targetUser.email,
          targetRole,
          reason: normalizedReason,
        });

        console.log(
          `[ADMIN_USER_DELETE] admin=${adminUserId} role=${adminRole} targetUser=${targetUserId} targetEmail=${targetUser.email} targetRole=${targetRole} reason=${normalizedReason} timestamp=${new Date().toISOString()}`
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
        const postId = normalizeImmutableTargetId((req.params as any)?.postId);
        const adminUserId = normalizeImmutableTargetId(
          (req.user as any)?.id || (req.user as any)?.claims?.sub
        );
        const adminUser = adminUserId ? await storage.getUser(adminUserId) : null;
        const actorContext = resolvePrivilegedActor(adminUser || req.user);
        const adminRole = adminUser?.role || "";
        const normalizedReason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        if (!postId) {
          return res.status(400).json({ message: "postId is required" });
        }
        if (!normalizedReason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
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

        await auditPrivilegedAction({
          action: "admin_community_post_delete",
          route: "/api/admin/community/posts/:postId",
          operationType: "delete_community_post",
          actorId: adminUserId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "community_post",
          targetId: postId,
          resolutionSource: "route_param:post_id",
          reason: normalizedReason,
          outcome: "completed",
          details: {
            authorId: post.authorId,
          },
        });

        await logAdminAction({
          type: "admin_community_post_delete",
          adminId: adminUserId ?? undefined,
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
        const actor = resolvePrivilegedActor(req.user);
        const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);

        if (!reason) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 12 characters)" });
        }

        const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (!actorHasPrivilegedCapability(req.user, ["ops_admin", "super_admin"])) {
          await auditPrivilegedAction({
            action: "admin_impersonation_start_user",
            route: "/api/admin/users/:userId/impersonate",
            operationType: "impersonation_start",
            actorId: actor.actorId,
            actorRole: actor.actorRole,
            actorRoles: actor.actorRoles,
            targetType: "user",
            targetId: targetUser.id,
            resolutionSource: "route_param:user_id",
            reason,
            outcome: "denied",
            details: { message: "insufficient_privileged_capability" },
          });
          return res.status(403).json({ message: "Ops admin or super admin access required" });
        }

        const originalUser = req.user as any;
        const adminId = actor.actorId;

        (req.session as any).originalUser = {
          id: adminId,
          role: originalUser?.role,
          email: originalUser?.email,
        };

        (req.session as any).impersonatingRole = targetUser.activeRole || targetUser.role;
        (req.session as any).impersonatedUserId = targetUser.id;
        (req.session as any).isImpersonating = true;

        await auditPrivilegedAction({
          action: "admin_impersonation_start_user",
          route: "/api/admin/users/:userId/impersonate",
          operationType: "impersonation_start",
          actorId: adminId,
          actorRole: actor.actorRole,
          actorRoles: actor.actorRoles,
          targetType: "user",
          targetId: targetUser.id,
          resolutionSource: "route_param:user_id",
          reason,
          outcome: "started",
          details: { targetRole: targetUser.activeRole || targetUser.role },
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
        const actorId = normalizeImmutableTargetId(
          (req as any)?.user?.id || (req as any)?.user?.claims?.sub
        );
        const actor = actorId ? await storage.getUser(actorId) : null;
        const actorContext = resolvePrivilegedActor(actor || (req as any)?.user);
        const targetId = normalizeImmutableTargetId((req.params as any)?.id);
        const { commissionRate } = (req.body || {}) as any;
        const reason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        if (!actorId) {
          return res.status(401).json({ message: "Actor not found" });
        }
        if (!targetId) {
          return res.status(400).json({ message: "Affiliate program id is required" });
        }
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
        }

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
          .where(eq(affiliateAccounts.id, targetId))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: "Affiliate program not found" });
        }

        await auditPrivilegedAction({
          action: "admin_affiliate_commission_rate_update",
          route: "/api/admin/affiliates/:id/commission-rate",
          operationType: "update_affiliate_commission_rate",
          actorId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "affiliate_program",
          targetId,
          resolutionSource: "route_param:id",
          reason,
          outcome: "completed",
          details: {
            commissionRate: updated.commissionRate,
          },
        });

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
        const actorId = normalizeImmutableTargetId(
          (req as any)?.user?.id || (req as any)?.user?.claims?.sub
        );
        const actor = actorId ? await storage.getUser(actorId) : null;
        const actorContext = resolvePrivilegedActor(actor || (req as any)?.user);
        const affiliateProgramId = normalizeImmutableTargetId((req.params as any)?.id);
        const { amount, payoutMethod, note, status } = (req.body || {}) as {
          amount?: number | string;
          payoutMethod?: string;
          note?: string;
          status?: string;
        };
        const reason = normalizePrivilegedReason(
          (req.body as any)?.reason ?? (req.body as any)?.adminSafety?.reason,
          12
        );

        const totalAmount = Number(amount ?? 0);
        if (!actorId) {
          return res.status(401).json({ message: "Actor not found" });
        }
        if (!affiliateProgramId) {
          return res.status(400).json({ message: "Affiliate program id is required" });
        }
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
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

        await auditPrivilegedAction({
          action: "admin_affiliate_payout_create",
          route: "/api/admin/affiliates/:id/payout",
          operationType: "create_affiliate_payout",
          actorId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "affiliate_program",
          targetId: affiliateProgramId,
          resolutionSource: "route_param:id",
          reason,
          outcome: "completed",
          details: {
            amount: totalAmount.toFixed(2),
            payoutMethod: payoutMethod || "manual",
            status: status || "pending",
          },
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
        const actor = resolvePrivilegedActor(req.user);
        const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "listingId required" });
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 characters)" });
        }

        const updated = await storage.approveHomeScoutListing({
          listingId,
          approvedByUserId: String(userId),
        });

        if (!updated) return res.status(404).json({ message: "Listing not found" });

        await auditPrivilegedAction({
          action: "admin_homescout_listing_approve",
          route: "/api/admin/homescout/listings/:id/approve",
          operationType: "homescout_listing_approve",
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          actorRoles: actor.actorRoles,
          targetType: "homescout_listing",
          targetId: listingId,
          resolutionSource: "route_param:listing_id",
          reason,
          outcome: "completed",
        });
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

  const normalizePartnerSlug = (value: unknown): string | null => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (!/^[a-z0-9-]+$/.test(normalized) || normalized.length > 120) return null;
    return normalized;
  };

  const RSVP_ATTENDANCE_STATUSES = ["pending", "showed_up", "no_show", "cancelled"] as const;
  type RsvpAttendanceStatus = (typeof RSVP_ATTENDANCE_STATUSES)[number];
  const normalizeRsvpAttendanceStatus = (value: unknown): RsvpAttendanceStatus | null => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    return RSVP_ATTENDANCE_STATUSES.includes(normalized as RsvpAttendanceStatus)
      ? (normalized as RsvpAttendanceStatus)
      : null;
  };

  const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const htmlEscape = (value: unknown): string =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizePartnerObservationWindow = (value: unknown): "1h" | "24h" | "7d" | "30d" => {
    const normalized = String(value ?? "24h")
      .trim()
      .toLowerCase();
    if (
      normalized === "1h" ||
      normalized === "24h" ||
      normalized === "7d" ||
      normalized === "30d"
    ) {
      return normalized;
    }
    return "24h";
  };

  const normalizeStateCode = (value: unknown): string => {
    const normalized = String(value ?? "")
      .trim()
      .toUpperCase();
    if (!normalized || normalized === "ALL") return "";
    return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
  };

  const normalizeSurface = (value: unknown): string => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!normalized || normalized === "all") return "";
    return normalized.slice(0, 80);
  };

  app.post(
    "/api/admin/cumulus-intelligence/refresh",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const startedAt = Date.now();
        const result = await withAdvisoryLock("job:cumulus_intelligence_refresh", async () => {
          const countySnapshots = await runPartnerCountyObservationSnapshotJob();
          const briefSnapshots = await runPartnerIntelligenceBriefSnapshotJob();
          return {
            countySnapshots,
            briefSnapshots,
            durationMs: Date.now() - startedAt,
          };
        });

        if (result === null) {
          return res.status(409).json({ message: "Cumulus intelligence refresh already running" });
        }

        return res.json({
          ok: true,
          ...result,
        });
      } catch (error: any) {
        console.error("Error refreshing Cumulus intelligence:", error);
        return res.status(500).json({ message: "Failed to refresh Cumulus intelligence" });
      }
    }
  );

  app.post(
    "/api/admin/seo-directory-scope/refresh",
    isAuthenticated,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const startedAt = Date.now();
        const result = await withAdvisoryLock("job:seo_directory_scope_snapshot", async () => {
          const snapshot = await runSeoDirectoryScopeSnapshotJob();
          return {
            snapshot,
            durationMs: Date.now() - startedAt,
          };
        });

        if (result === null) {
          return res.status(409).json({ message: "SEO directory scope refresh already running" });
        }

        return res.json({
          ok: true,
          ...result,
        });
      } catch (error: any) {
        console.error("Error refreshing SEO directory scope snapshot:", error);
        return res.status(500).json({ message: "Failed to refresh SEO directory scope snapshot" });
      }
    }
  );

  app.get(
    "/api/admin/cumulus-intelligence/briefing",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const window = normalizePartnerObservationWindow((req.query as any)?.window);
        const stateCode = normalizeStateCode((req.query as any)?.stateCode);
        const surface = normalizeSurface((req.query as any)?.surface);
        const limit = parsePositiveInt((req.query as any)?.limit, 100, { min: 25, max: 500 });

        const brief = await getPartnerIntelligenceBriefSnapshot({
          partnerSlug: "cumulus-media",
          window,
          stateCode: stateCode || undefined,
          surface: surface || undefined,
          limit,
        });

        const topCountiesHtml = (brief.topCounties || [])
          .map(
            (county) => `
              <li>
                <strong>#${county.rank} ${htmlEscape(county.countyName)}, ${htmlEscape(county.stateCode)}</strong>
                <span> | ${county.requestCount} requests | ${htmlEscape(county.dominantSurface.replace(/_/g, " "))} | ${htmlEscape(county.trend)} ${county.changePct}%</span>
              </li>
            `
          )
          .join("");
        const topStatesHtml = (brief.topStates || [])
          .map(
            (state) => `
              <li>
                <strong>#${state.rank} ${htmlEscape(state.stateCode)}</strong>
                <span> | ${state.requestCount} requests across ${state.countyCount} counties | ${htmlEscape(state.dominantSurface.replace(/_/g, " "))} | ${htmlEscape(state.trend)} ${state.changePct}%</span>
              </li>
            `
          )
          .join("");

        const topFindingsHtml = (brief.lisa.topFindings || [])
          .map(
            (item) => `
              <li>
                <strong>${htmlEscape(item.headline)}</strong>
                <div>${htmlEscape(item.narrative)}</div>
              </li>
            `
          )
          .join("");

        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cumulus Intelligence Brief | TradeScout Admin</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0b0f16; color: #f5f7fb; margin: 0; padding: 32px; }
      main { max-width: 980px; margin: 0 auto; }
      h1, h2 { margin: 0 0 12px; }
      .meta { color: #a7b0c0; font-size: 14px; margin-bottom: 24px; }
      .card { background: #111826; border: 1px solid #273044; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      ul { margin: 12px 0 0; padding-left: 20px; }
      li { margin-bottom: 10px; }
      @media print {
        body { background: #fff; color: #111; padding: 0; }
        .card { border-color: #ddd; background: #fff; break-inside: avoid; }
        .meta { color: #555; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>TradeScout x Cumulus Intelligence Brief</h1>
      <div class="meta">
        Generated ${htmlEscape(new Date(brief.generatedAt).toLocaleString())} |
        Window ${htmlEscape(brief.filters.window)} |
        ${htmlEscape(brief.filters.stateCode || "All states")} |
        ${htmlEscape(brief.filters.surface || "All surfaces")}
      </div>

      <section class="card">
        <h2>Executive Summary</h2>
        <p>${htmlEscape(brief.executiveSummary)}</p>
        <p>${htmlEscape(brief.activationSummary)}</p>
        <p>${htmlEscape(brief.summary?.deltaSummary || "No prior brief available yet for delta comparison.")}</p>
      </section>

      <section class="card">
        <h2>LISA Summary</h2>
        <div class="grid">
          <div><strong>Truth Now</strong><div>${htmlEscape(brief.lisa.truthNow)}</div></div>
          <div><strong>Data Production</strong><div>${htmlEscape(brief.lisa.dataProductionSummary)}</div></div>
          <div><strong>LLM Optimization</strong><div>${htmlEscape(brief.lisa.llmOptimizationSummary)}</div></div>
        </div>
      </section>

      <section class="card">
        <h2>Top Counties</h2>
        <ul>${topCountiesHtml || "<li>No counties available for the current filter set.</li>"}</ul>
      </section>

      <section class="card">
        <h2>Top States</h2>
        <ul>${topStatesHtml || "<li>No states available for the current filter set.</li>"}</ul>
      </section>

      <section class="card">
        <h2>Top Findings</h2>
        <ul>${topFindingsHtml || "<li>No LISA findings available.</li>"}</ul>
      </section>
    </main>
  </body>
</html>`;

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);
      } catch (error: any) {
        console.error("Error rendering Cumulus intelligence briefing page:", error);
        return res
          .status(500)
          .json({ message: "Failed to render Cumulus intelligence briefing page" });
      }
    }
  );

  app.get(
    "/api/admin/cumulus-intelligence/brief-history",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const window = normalizePartnerObservationWindow((req.query as any)?.window);
        const stateCode = normalizeStateCode((req.query as any)?.stateCode);
        const surface = normalizeSurface((req.query as any)?.surface);
        const limit = parsePositiveInt((req.query as any)?.limit, 8, { min: 1, max: 25 });

        const history = await getPartnerIntelligenceBriefHistory({
          partnerSlug: "cumulus-media",
          window,
          stateCode: stateCode || undefined,
          surface: surface || undefined,
          limit,
        });

        return res.json({
          partnerSlug: "cumulus-media",
          window,
          stateCode: stateCode || null,
          surface: surface || null,
          history,
        });
      } catch (error: any) {
        console.error("Error loading Cumulus intelligence brief history:", error);
        return res
          .status(500)
          .json({ message: "Failed to load Cumulus intelligence brief history" });
      }
    }
  );

  app.get(
    "/api/admin/cumulus-intelligence/brief",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const window = normalizePartnerObservationWindow((req.query as any)?.window);
        const stateCode = normalizeStateCode((req.query as any)?.stateCode);
        const surface = normalizeSurface((req.query as any)?.surface);
        const limit = parsePositiveInt((req.query as any)?.limit, 100, { min: 25, max: 500 });

        const brief = await getPartnerIntelligenceBriefSnapshot({
          partnerSlug: "cumulus-media",
          window,
          stateCode: stateCode || undefined,
          surface: surface || undefined,
          limit,
        });

        return res.json(brief);
      } catch (error: any) {
        console.error("Error building Cumulus intelligence brief:", error);
        return res.status(500).json({ message: "Failed to build Cumulus intelligence brief" });
      }
    }
  );

  app.get(
    "/api/admin/cumulus-intelligence/export.csv",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const window = normalizePartnerObservationWindow((req.query as any)?.window);
        const stateCode = normalizeStateCode((req.query as any)?.stateCode);
        const surface = normalizeSurface((req.query as any)?.surface);
        const limit = parsePositiveInt((req.query as any)?.limit, 100, { min: 25, max: 500 });

        const snapshot = await getPartnerCountyObservationSnapshots({
          partnerSlug: "cumulus-media",
          window,
          stateCode: stateCode || undefined,
          surface: surface || undefined,
          limit,
        });

        const rows = snapshot.counties ?? [];
        const header = [
          "partner_slug",
          "window",
          "generated_at",
          "county_fips",
          "county_name",
          "state_code",
          "request_count",
          "ok_rate_pct",
          "trend",
          "change_pct",
          "dominant_surface",
          "surface_mix",
        ];

        const lines = [header.join(",")];
        for (const row of rows) {
          const values = [
            "cumulus-media",
            window,
            snapshot.generatedAt,
            row.countyFips,
            row.countyName,
            row.stateCode,
            row.requestCount,
            row.okRatePct,
            row.trend,
            row.changePct,
            row.dominantSurface,
            row.surfaceMix
              .map((entry) => `${entry.surface}:${entry.requestCount}:${entry.sharePct}%`)
              .join(" | "),
          ];
          lines.push(values.map(csvEscape).join(","));
        }

        const fileDate = new Date().toISOString().slice(0, 10);
        const suffixParts = [
          "cumulus-intelligence",
          window,
          stateCode ? stateCode.toLowerCase() : "all-states",
          surface || "all-surfaces",
          fileDate,
        ];
        const csv = `\uFEFF${lines.join("\n")}`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${suffixParts.join("-")}.csv"`);
        return res.status(200).send(csv);
      } catch (error: any) {
        console.error("Error exporting Cumulus county intelligence:", error);
        return res.status(500).json({ message: "Failed to export Cumulus intelligence" });
      }
    }
  );

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

  app.get(
    "/api/admin/tradepartner-rsvps",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTradePartnerTables();

        const limit = parsePositiveInt((req.query as any)?.limit, 100, { min: 1, max: 500 });
        const offset = parsePositiveInt((req.query as any)?.offset, 0, { min: 0, max: 50_000 });
        const countySlug = normalizeCountySlug((req.query as any)?.countySlug);
        const partnerSlug = normalizePartnerSlug((req.query as any)?.partnerSlug);
        const attendanceStatus = normalizeRsvpAttendanceStatus((req.query as any)?.status);
        const search = normalizeSearchTerm((req.query as any)?.q);

        if ((req.query as any)?.countySlug && !countySlug) {
          return res.status(400).json({ message: "Invalid county slug filter" });
        }
        if ((req.query as any)?.partnerSlug && !partnerSlug) {
          return res.status(400).json({ message: "Invalid partner slug filter" });
        }
        if ((req.query as any)?.status && !attendanceStatus) {
          return res.status(400).json({ message: "Invalid attendance status filter" });
        }

        const whereParts: string[] = [];
        const whereValues: any[] = [];

        if (countySlug) {
          whereValues.push(countySlug);
          whereParts.push(`r.county_slug = $${whereValues.length}`);
        }
        if (partnerSlug) {
          whereValues.push(partnerSlug);
          whereParts.push(`r.partner_slug = $${whereValues.length}`);
        }
        if (attendanceStatus) {
          whereValues.push(attendanceStatus);
          whereParts.push(`r.attendance_status = $${whereValues.length}`);
        }
        if (search) {
          whereValues.push(`%${search}%`);
          const idx = whereValues.length;
          whereParts.push(
            `(r.business_name ILIKE $${idx}
              OR r.contact_name ILIKE $${idx}
              OR r.contact_email ILIKE $${idx}
              OR COALESCE(r.contact_phone, '') ILIKE $${idx}
              OR COALESCE(r.event_label, '') ILIKE $${idx})`
          );
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

        const countQuery = `
          SELECT COUNT(*)::bigint AS total
          FROM tradepartner_rsvp_submissions r
          ${whereSql}
        `;

        const listQuery = `
          SELECT
            r.id,
            r.partner_slug,
            r.county_slug,
            r.county_label,
            r.event_label,
            r.meeting_id,
            r.meeting_date,
            r.time_label,
            r.start_datetime,
            r.business_name,
            r.contact_name,
            r.contact_email,
            r.contact_phone,
            r.attendee_count,
            r.lunch_attendees,
            r.notes,
            r.submitted_by_user_id,
            r.attendance_status,
            r.attendance_notes,
            r.checked_in_at,
            r.checked_in_by_user_id,
            r.created_at,
            r.updated_at
          FROM tradepartner_rsvp_submissions r
          ${whereSql}
          ORDER BY r.created_at DESC
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
          partnerSlug: row.partner_slug,
          countySlug: row.county_slug,
          countyLabel: row.county_label,
          eventLabel: row.event_label,
          meetingId: row.meeting_id || null,
          meetingDate:
            row.meeting_date instanceof Date
              ? row.meeting_date.toISOString().slice(0, 10)
              : row.meeting_date || null,
          timeLabel: row.time_label || null,
          startDateTime:
            row.start_datetime instanceof Date
              ? row.start_datetime.toISOString()
              : row.start_datetime
                ? new Date(row.start_datetime).toISOString()
                : null,
          businessName: row.business_name,
          contactName: row.contact_name,
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone || null,
          attendeeCount: Number(row.attendee_count || 0),
          lunchAttendees: Number(row.lunch_attendees || 0),
          notes: row.notes || null,
          submittedByUserId: row.submitted_by_user_id || null,
          attendanceStatus: row.attendance_status || "pending",
          attendanceNotes: row.attendance_notes || null,
          checkedInAt:
            row.checked_in_at instanceof Date
              ? row.checked_in_at.toISOString()
              : row.checked_in_at
                ? new Date(row.checked_in_at).toISOString()
                : null,
          checkedInByUserId: row.checked_in_by_user_id || null,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : new Date(row.created_at).toISOString(),
          updatedAt:
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : row.updated_at
                ? new Date(row.updated_at).toISOString()
                : null,
        }));

        return res.json({
          items,
          total,
          limit,
          offset,
          hasMore: offset + items.length < total,
        });
      } catch (error: any) {
        console.error("Error fetching tradepartner RSVPs:", error);
        return res.status(500).json({ message: "Failed to load RSVPs" });
      }
    }
  );

  app.patch(
    "/api/admin/tradepartner-rsvps/:id/attendance",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        await ensureTradePartnerTables();

        const id = String(req.params.id || "").trim();
        if (!/^\d+$/.test(id)) {
          return res.status(400).json({ message: "Invalid RSVP id" });
        }

        const userId = String((req.user as any)?.id || "").trim();
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const status = normalizeRsvpAttendanceStatus((req.body as any)?.status);
        if (!status) {
          return res.status(400).json({ message: "Invalid attendance status" });
        }
        const attendanceNotesRaw = (req.body as any)?.attendanceNotes;
        const attendanceNotes =
          typeof attendanceNotesRaw === "string" ? attendanceNotesRaw.trim().slice(0, 4000) : "";

        const updateResult = await pool.query(
          `
          UPDATE tradepartner_rsvp_submissions
          SET
            attendance_status = $2,
            attendance_notes = CASE WHEN $3 = '' THEN NULL ELSE $3 END,
            checked_in_at = CASE
              WHEN $2 = 'showed_up' THEN COALESCE(checked_in_at, NOW())
              ELSE NULL
            END,
            checked_in_by_user_id = CASE
              WHEN $2 = 'showed_up' THEN $4
              ELSE NULL
            END,
            updated_at = NOW()
          WHERE id = $1::bigint
          RETURNING
            id,
            attendance_status,
            attendance_notes,
            checked_in_at,
            checked_in_by_user_id,
            updated_at
        `,
          [id, status, attendanceNotes, userId]
        );

        if (!updateResult.rows.length) {
          return res.status(404).json({ message: "RSVP not found" });
        }

        return res.json({
          ok: true,
          item: {
            id: updateResult.rows[0].id,
            attendanceStatus: updateResult.rows[0].attendance_status,
            attendanceNotes: updateResult.rows[0].attendance_notes || null,
            checkedInAt:
              updateResult.rows[0].checked_in_at instanceof Date
                ? updateResult.rows[0].checked_in_at.toISOString()
                : updateResult.rows[0].checked_in_at
                  ? new Date(updateResult.rows[0].checked_in_at).toISOString()
                  : null,
            checkedInByUserId: updateResult.rows[0].checked_in_by_user_id || null,
            updatedAt:
              updateResult.rows[0].updated_at instanceof Date
                ? updateResult.rows[0].updated_at.toISOString()
                : new Date(updateResult.rows[0].updated_at).toISOString(),
          },
        });
      } catch (error: any) {
        console.error("Error updating RSVP attendance:", error);
        return res.status(500).json({ message: "Failed to update RSVP attendance" });
      }
    }
  );

  app.get(
    "/api/admin/tradepartner-rsvps/export.csv",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTradePartnerTables();

        const countySlug = normalizeCountySlug((req.query as any)?.countySlug);
        const partnerSlug = normalizePartnerSlug((req.query as any)?.partnerSlug);
        const attendanceStatus = normalizeRsvpAttendanceStatus((req.query as any)?.status);
        const search = normalizeSearchTerm((req.query as any)?.q);
        const maxRows = parsePositiveInt((req.query as any)?.maxRows, 5000, {
          min: 1,
          max: 20_000,
        });

        if ((req.query as any)?.countySlug && !countySlug) {
          return res.status(400).json({ message: "Invalid county slug filter" });
        }
        if ((req.query as any)?.partnerSlug && !partnerSlug) {
          return res.status(400).json({ message: "Invalid partner slug filter" });
        }
        if ((req.query as any)?.status && !attendanceStatus) {
          return res.status(400).json({ message: "Invalid attendance status filter" });
        }

        const whereParts: string[] = [];
        const whereValues: any[] = [];

        if (countySlug) {
          whereValues.push(countySlug);
          whereParts.push(`r.county_slug = $${whereValues.length}`);
        }
        if (partnerSlug) {
          whereValues.push(partnerSlug);
          whereParts.push(`r.partner_slug = $${whereValues.length}`);
        }
        if (attendanceStatus) {
          whereValues.push(attendanceStatus);
          whereParts.push(`r.attendance_status = $${whereValues.length}`);
        }
        if (search) {
          whereValues.push(`%${search}%`);
          const idx = whereValues.length;
          whereParts.push(
            `(r.business_name ILIKE $${idx}
              OR r.contact_name ILIKE $${idx}
              OR r.contact_email ILIKE $${idx}
              OR COALESCE(r.contact_phone, '') ILIKE $${idx}
              OR COALESCE(r.event_label, '') ILIKE $${idx})`
          );
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
        const query = `
          SELECT
            r.id,
            r.partner_slug,
            r.county_slug,
            r.county_label,
            r.event_label,
            r.meeting_id,
            r.meeting_date,
            r.time_label,
            r.start_datetime,
            r.business_name,
            r.contact_name,
            r.contact_email,
            r.contact_phone,
            r.attendee_count,
            r.lunch_attendees,
            r.notes,
            r.submitted_by_user_id,
            r.attendance_status,
            r.attendance_notes,
            r.checked_in_at,
            r.checked_in_by_user_id,
            r.created_at,
            r.updated_at
          FROM tradepartner_rsvp_submissions r
          ${whereSql}
          ORDER BY r.created_at DESC
          LIMIT $${whereValues.length + 1}
        `;

        const result = await pool.query(query, [...whereValues, maxRows]);
        const header = [
          "id",
          "partner_slug",
          "county_slug",
          "county_label",
          "event_label",
          "meeting_id",
          "meeting_date",
          "time_label",
          "start_datetime",
          "business_name",
          "contact_name",
          "contact_email",
          "contact_phone",
          "attendee_count",
          "lunch_attendees",
          "notes",
          "submitted_by_user_id",
          "attendance_status",
          "attendance_notes",
          "checked_in_at",
          "checked_in_by_user_id",
          "created_at",
          "updated_at",
        ];

        const lines = [header.join(",")];
        for (const row of result.rows) {
          const createdAt =
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : new Date(row.created_at).toISOString();
          const updatedAt =
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : row.updated_at
                ? new Date(row.updated_at).toISOString()
                : "";
          const checkedInAt =
            row.checked_in_at instanceof Date
              ? row.checked_in_at.toISOString()
              : row.checked_in_at
                ? new Date(row.checked_in_at).toISOString()
                : "";
          const values = [
            row.id,
            row.partner_slug,
            row.county_slug,
            row.county_label,
            row.event_label,
            row.meeting_id,
            row.meeting_date,
            row.time_label,
            row.start_datetime,
            row.business_name,
            row.contact_name,
            row.contact_email,
            row.contact_phone,
            row.attendee_count,
            row.lunch_attendees,
            row.notes,
            row.submitted_by_user_id,
            row.attendance_status,
            row.attendance_notes,
            checkedInAt,
            row.checked_in_by_user_id,
            createdAt,
            updatedAt,
          ];
          lines.push(values.map(csvEscape).join(","));
        }

        const fileDate = new Date().toISOString().slice(0, 10);
        const csv = `\uFEFF${lines.join("\n")}`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="tradepartner-rsvps-${fileDate}.csv"`
        );
        return res.status(200).send(csv);
      } catch (error: any) {
        console.error("Error exporting tradepartner RSVPs:", error);
        return res.status(500).json({ message: "Failed to export RSVPs" });
      }
    }
  );
}
