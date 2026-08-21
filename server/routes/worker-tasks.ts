/* eslint-disable @typescript-eslint/no-explicit-any -- Extracted legacy worker/task/admin utility routes preserve dynamic request handling. */
import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { ROLE_PERMISSIONS, type UserRole as SharedUserRole } from "@shared/roles";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { getUserTypeMetadata } from "@shared/userTypes";
import {
  businesses,
  businessCounties,
  contractors,
  counties,
  profiles,
  tasks,
  taskApplications,
  trades,
  users,
  workers,
  workerReviews,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { isAdmin, isAuthenticated, hashPassword } from "../auth";
import { db, pool } from "../db";
import { storage } from "../storage";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";
import { ingestKnowledgeFolder } from "../services/knowledgeIngest";
import { ObjectStorageService } from "../objectStorage";
import { emailService } from "../services/emailService";
import { passwordResetService } from "../services/passwordResetService";
import { emailVerificationService } from "../services/emailVerificationService";
import {
  getComputedProviderEligibilitiesForUser,
  getEligibilityDecisionForCounty,
} from "../providerEligibility";
import {
  collectAuthorityRoles,
  getPrivilegedAliasEmails,
  isAdminTierRole,
  normalizeAuthorityRole,
} from "../utils/authorityPolicy";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
  suppliedEmailMatchesTarget,
} from "../utils/privilegedActions";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";

const objectStorageService = new ObjectStorageService();
const ADMIN_WRITE_CONFIRM_PHRASE = "I UNDERSTAND THIS EDIT IS AUDITED";
const BLOCKED_SELF_ASSIGN_ROLES = new Set<string>([
  "admin",
  "moderator",
  "ops_admin",
  "super_admin",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
]);

const dedupeStrings = (values: string[]) =>
  Array.from(new Set(values.map((v) => String(v || "").trim()).filter((v) => v.length > 0)));

const getGeneralSetting = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const settings = await storage.getSiteSettings("general");
    const match = settings.find((setting) => setting.key === key && setting.isActive !== false);
    if (match && typeof (match as any).value !== "undefined") {
      return (match as any).value as T;
    }
  } catch (error) {
    console.warn("[settings] Failed to load site setting", { key, error });
  }
  return fallback;
};

const getPublicBaseUrlFromRequest = (req: Request): string => {
  const envBase =
    process.env.PUBLIC_WEB_URL || process.env.APP_URL || process.env.APP_BASE_URL || "";
  if (envBase) return envBase;

  const protoHeader = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const hostHeader = String(req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = protoHeader || req.protocol || "https";
  const host = hostHeader;
  if (!host) return "https://www.thetradescout.com";
  return `${proto}://${host}`;
};

const parseOptionalIsoDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getBetaWindow = () => {
  const start = parseOptionalIsoDate(process.env.BETA_START_AT || process.env.BETA_START_DATE);
  const end = parseOptionalIsoDate(process.env.BETA_END_AT || process.env.BETA_END_DATE);
  return { start, end };
};

const isWithinBetaPeriod = (date: Date): boolean => {
  const { start, end } = getBetaWindow();
  if (!start && !end) return true;
  if (!start) return false;
  const t = date.getTime();
  if (t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
};

const isFounderBadgeLabel = (label: string) => /^Founder\b/i.test(label);

const formatFounderRoleLabel = (role: string) =>
  role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const computeBadgesForUser = (user: any): string[] => {
  const list = Array.isArray(user?.badges)
    ? (user.badges.filter((b: any) => typeof b === "string") as string[])
    : [];
  const created = user?.createdAt ? new Date(user.createdAt as any) : undefined;
  const inBeta = created && !Number.isNaN(created.getTime()) ? isWithinBetaPeriod(created) : false;

  if (!inBeta) {
    return list.filter((b) => !isFounderBadgeLabel(b));
  }

  const rolesRaw =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles
      : user?.role
        ? [user.role]
        : [];
  const roles = rolesRaw.filter((r: any) => typeof r === "string") as string[];
  const merged = new Set(list);
  for (const role of roles) {
    merged.add(`Founder (${formatFounderRoleLabel(role)})`);
  }
  return Array.from(merged);
};

// Missing profile photos stay missing so avatar components can render the
// compact TradeScout mark. The social-share preview is not a member photo.
const CANONICAL_DEFAULT_PROFILE_IMAGE_URL = "";
const PLATFORM_DEFAULT_PROFILE_IMAGE_PATHS = new Set<string>([
  "/tradescout-logo.png",
  "/tradescout-logo.jpg",
  "/tradescout-brand.png",
  "/tradescout-social-preview.png",
  "/logo.png",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
]);

const normalizeProfileImageUrl = (candidate: unknown): string => {
  if (typeof candidate !== "string" || !candidate.trim()) {
    return CANONICAL_DEFAULT_PROFILE_IMAGE_URL;
  }

  const trimmed = candidate.trim();
  if (trimmed.startsWith("data:")) return trimmed;

  try {
    const parsed = new URL(trimmed, "https://www.thetradescout.com");
    if (PLATFORM_DEFAULT_PROFILE_IMAGE_PATHS.has(parsed.pathname.toLowerCase())) {
      return CANONICAL_DEFAULT_PROFILE_IMAGE_URL;
    }
  } catch {
    // Fall through to string return
  }

  return trimmed;
};

const sanitizeUserForResponse = (user: any) => {
  if (!user) return user;
  const authorityRoles = collectAuthorityRoles(user);
  const roles = authorityRoles.filter((r: string): r is SharedUserRole => Boolean(r));
  const normalizedPrimaryRole = normalizeAuthorityRole(user?.role);
  const normalizedActiveRole = normalizeAuthorityRole(user?.activeRole);
  const primaryRole: SharedUserRole | undefined =
    (normalizedPrimaryRole as SharedUserRole) || roles[0];

  const basePermissions = primaryRole ? ROLE_PERMISSIONS[primaryRole] : undefined;

  const computedIsAdmin =
    user.isAdmin === true ||
    isAdminTierRole(normalizedPrimaryRole) ||
    isAdminTierRole(normalizedActiveRole) ||
    Boolean(
      basePermissions?.canAccessAdminPanel ||
      basePermissions?.canAccessSuperAdmin ||
      roles.some((role) => isAdminTierRole(role))
    );

  const computedIsSuperAdmin =
    user.isSuperAdmin === true ||
    normalizedPrimaryRole === "super_admin" ||
    normalizedActiveRole === "super_admin" ||
    roles.some((role) => role === "super_admin");

  const adminAliasEmails = getPrivilegedAliasEmails();
  const normalizedEmail = String(user?.email || "")
    .trim()
    .toLowerCase();
  const isAdminAliasEmail = normalizedEmail.length > 0 && adminAliasEmails.has(normalizedEmail);

  const canonicalStateCodeRaw =
    (user as any).stateCode ?? (user as any).state_code ?? (user as any).state ?? null;
  const canonicalCountyFipsRaw =
    (user as any).countyFips ??
    (user as any).county_fips ??
    (typeof (user as any).county === "string" && /^\d{5}$/.test((user as any).county)
      ? (user as any).county
      : null);

  const canonicalStateCode =
    typeof canonicalStateCodeRaw === "string" ? canonicalStateCodeRaw.trim().toUpperCase() : "";
  const canonicalCountyFips =
    typeof canonicalCountyFipsRaw === "string" ? canonicalCountyFipsRaw.trim() : "";

  const hasCanonicalLocation =
    canonicalStateCode.length === 2 && /^\d{5}$/.test(canonicalCountyFips);

  const rawThemePreference = typeof user?.themePreference === "string" ? user.themePreference : "";
  const normalizedThemePreference = rawThemePreference.startsWith("profile-")
    ? "default"
    : rawThemePreference;

  return {
    ...user,
    role: normalizedPrimaryRole || user?.role,
    activeRole: normalizedActiveRole || user?.activeRole,
    roles,
    badges: computeBadgesForUser(user),
    isAdmin: computedIsAdmin || isAdminAliasEmail,
    isSuperAdmin: computedIsSuperAdmin || isAdminAliasEmail,
    themePreference: normalizedThemePreference || user?.themePreference,
    stateCode: hasCanonicalLocation ? canonicalStateCode : (user as any).stateCode,
    countyFips: hasCanonicalLocation ? canonicalCountyFips : (user as any).countyFips,
    locationCommitted: hasCanonicalLocation,
    profileImageUrl: normalizeProfileImageUrl((user as any)?.profileImageUrl),
    profileVersion:
      typeof (user as any).profileVersion === "number" ? (user as any).profileVersion : 0,
    licenseVerified:
      (user as any)?.trustSnapshot?.licenseStatus === "verified" ||
      (user as any)?.licenseVerified === true ||
      (user as any)?.license_verified === true,
    insuranceVerified:
      (user as any)?.trustSnapshot?.insuranceStatus === "verified" ||
      (user as any)?.insuranceVerified === true ||
      (user as any)?.insurance_verified === true,
    trustSnapshot: (user as any)?.trustSnapshot ?? undefined,
    password: undefined,
  };
};

const normalizeAdminRoleToken = (role: unknown): string => {
  const raw = String(role || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
};

const hasRole = (user: any, role: string): boolean => {
  const target = normalizeAdminRoleToken(role);
  if (!target) return false;
  const roles = [
    normalizeAdminRoleToken(user?.role),
    normalizeAdminRoleToken(user?.activeRole),
    ...(Array.isArray(user?.roles)
      ? user.roles.map((value: unknown) => normalizeAdminRoleToken(value))
      : []),
  ].filter(Boolean);
  return new Set(roles).has(target);
};

const isSuperAdminUser = (user: any): boolean => hasRole(user, "super_admin");

const isProtectedAdminUser = (user: any): boolean => {
  if (!user) return false;
  for (const role of ["moderator", "ops_admin", "super_admin"]) {
    if (hasRole(user, role)) return true;
  }
  return false;
};

const validateAdminWriteSafety = (
  body: any,
  headers: Record<string, unknown>,
  opts?: { forceStrict?: boolean }
): { ok: boolean; message?: string } => {
  const adminSafety =
    body && typeof body.adminSafety === "object" && body.adminSafety ? body.adminSafety : {};
  const configuredSafetyKey = String(process.env.ADMIN_SAFETY_KEY || "").trim();
  const providedSafetyKey = String(
    adminSafety.safetyKey || headers["x-admin-safety-key"] || ""
  ).trim();

  if (configuredSafetyKey && providedSafetyKey !== configuredSafetyKey) {
    return { ok: false, message: "Admin safety key validation failed" };
  }

  const strictRequired = opts?.forceStrict === true || process.env.ADMIN_HARDENED_WRITES === "true";
  if (!strictRequired) {
    return { ok: true };
  }

  const reason = String(adminSafety.reason || "").trim();
  if (reason.length < 12) {
    return { ok: false, message: "adminSafety.reason is required (min 12 chars)" };
  }

  const confirmPhrase = String(adminSafety.confirmPhrase || "").trim();
  if (confirmPhrase !== ADMIN_WRITE_CONFIRM_PHRASE) {
    return {
      ok: false,
      message: `adminSafety.confirmPhrase must be exactly: ${ADMIN_WRITE_CONFIRM_PHRASE}`,
    };
  }

  return { ok: true };
};

const noopRateLimiter: any = (_req: any, _res: any, next: any) => next();
const limiterStore = (prefix: string) =>
  createPostgresRateLimitStore({
    pool,
    prefix: `rl:${prefix}`,
    cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
  });
const aiLimiter =
  process.env.NODE_ENV === "production"
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 60,
        message: "Too many AI requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        store: limiterStore("ai"),
      })
    : noopRateLimiter;

export function registerWorkerTasksRoutes(app: Express): void {
  // Worker marketplace endpoints
  app.get("/api/workers", async (req: any, res: any) => {
    try {
      const limitRaw = typeof req.query?.limit === "string" ? req.query.limit : "";
      const limit = Number(limitRaw);

      let query = db.select().from(workers).where(eq(workers.isActive, true));

      if (Number.isFinite(limit) && limit > 0) {
        query = (query as any).limit(Math.min(limit, 100));
      }

      const rows = await query;

      const normalized = rows.map((w: any) => ({
        ...w,
        hourlyRate: w.hourlyRate != null ? String(w.hourlyRate) : null,
        totalEarnings: w.totalEarnings != null ? String(w.totalEarnings) : "0",
        averageRating: w.averageRating != null ? Number(w.averageRating) : null,
      }));

      res.json(normalized);
    } catch (error: any) {
      console.error("Error fetching workers:", error);
      res.status(500).json({ message: "Failed to fetch workers" });
    }
  });

  // Public helper profile by worker id
  app.get("/api/workers/:workerId/public", async (req: any, res: any) => {
    try {
      const workerId = String(req.params.workerId || "").trim();
      if (!workerId) return res.status(400).json({ message: "workerId is required" });
      const [worker] = await db
        .select()
        .from(workers)
        .where(and(eq(workers.id, workerId), eq(workers.isActive, true)))
        .limit(1);
      if (!worker) return res.status(404).json({ message: "Helper not found" });
      // Strip PII — only expose public fields
      const {
        phone: _phone,
        email: _email,
        verificationDocuments: _docs,
        totalEarnings: _earnings,
        userId: _userId,
        ...publicFields
      } = worker as any;
      res.json({
        ...publicFields,
        hourlyRate: worker.hourlyRate != null ? String(worker.hourlyRate) : null,
        averageRating: worker.averageRating != null ? Number(worker.averageRating) : null,
      });
    } catch (error: any) {
      console.error("Error fetching public worker profile:", error);
      res.status(500).json({ message: "Failed to fetch helper profile" });
    }
  });

  app.get("/api/tasks", async (req: any, res: any) => {
    try {
      const categoryIdRaw = typeof req.query?.category === "string" ? req.query.category : "";
      const locationRaw = typeof req.query?.location === "string" ? req.query.location : "";

      const categoryId = categoryIdRaw.trim();
      const location = locationRaw.trim();

      const filters: any[] = [];
      if (categoryId) filters.push(eq(tasks.categoryId, categoryId));

      if (location) {
        const like = `%${location}%`;
        filters.push(
          or(
            sql`${tasks.city} ILIKE ${like}`,
            sql`${tasks.address} ILIKE ${like}`,
            eq(tasks.zipCode, location)
          )
        );
      }

      const whereClause = filters.length
        ? filters.length === 1
          ? filters[0]
          : and(...filters)
        : undefined;

      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      let viewerLat: number | undefined;
      let viewerLng: number | undefined;

      if (authUserId) {
        try {
          const viewer = await storage.getUser(authUserId as string);
          const lat = (viewer as any)?.latitude;
          const lng = (viewer as any)?.longitude;

          if (lat != null && lng != null) {
            const latNum = Number(lat);
            const lngNum = Number(lng);
            if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
              viewerLat = latNum;
              viewerLng = lngNum;
            }
          }

          if ((!viewerLat || !viewerLng) && (viewer as any)?.preferences?.geo?.homeLocation) {
            const home = (viewer as any).preferences.geo.homeLocation;
            if (typeof home.lat === "number" && typeof home.lng === "number") {
              viewerLat = home.lat;
              viewerLng = home.lng;
            }
          }
        } catch (e) {
          console.warn(
            "Failed to load viewer for tasks radius filter; falling back to non-radius listing",
            e
          );
        }
      }

      const radiusMilesRaw =
        typeof req.query?.radiusMiles === "string" ? Number(req.query.radiusMiles) : NaN;
      const radiusMiles =
        Number.isFinite(radiusMilesRaw) && radiusMilesRaw > 0 ? radiusMilesRaw : 50;
      const radiusMeters = radiusMiles * 1609.34;

      const baseQuery = db
        .select({ task: tasks, poster: users })
        .from(tasks)
        .leftJoin(users, eq(tasks.posterId, users.id));

      const rows = whereClause
        ? await baseQuery.where(whereClause).orderBy(desc(tasks.createdAt)).limit(100)
        : await baseQuery.orderBy(desc(tasks.createdAt)).limit(100);

      const haversineDistanceMeters = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
      ): number => {
        const toRad = (value: number) => (value * Math.PI) / 180;
        const R = 6371e3; // Earth radius in meters

        const phi1 = toRad(lat1);
        const phi2 = toRad(lat2);
        const dPhi = toRad(lat2 - lat1);
        const dLambda = toRad(lon2 - lon1);

        const a =
          Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
      };

      const filtered =
        viewerLat != null && viewerLng != null
          ? rows.filter(({ poster }) => {
              if (!poster) return false;
              const pLat = (poster as any)?.latitude;
              const pLng = (poster as any)?.longitude;
              if (pLat == null || pLng == null) return false;
              const pLatNum = Number(pLat);
              const pLngNum = Number(pLng);
              if (!Number.isFinite(pLatNum) || !Number.isFinite(pLngNum)) return false;

              const distance = haversineDistanceMeters(
                viewerLat as number,
                viewerLng as number,
                pLatNum,
                pLngNum
              );
              return distance <= radiusMeters;
            })
          : rows;

      const normalized = filtered.map(({ task, poster }) => {
        let posterName = "Neighbor";
        if (poster) {
          const first = ((poster as any).firstName || "").toString().trim();
          const last = ((poster as any).lastName || "").toString().trim();
          const lastInitial = last ? `${last[0]}.` : "";
          const combined = [first, lastInitial].filter(Boolean).join(" ");
          if (combined) posterName = combined;
        }

        return {
          ...task,
          posterName,
        };
      });

      res.json(normalized);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch tasks", requestId: (req as any).requestId || null });
    }
  });

  // Work Requests - canonical work hub for requesters
  app.get("/api/work-requests", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const statusRaw = typeof req.query?.status === "string" ? req.query.status : "";
      const status = statusRaw.trim();

      const filters: any[] = [eq(workRequests.createdByUserId, String(userId))];
      if (status) {
        filters.push(eq(workRequests.status, status));
      }

      const whereClause = filters.length === 1 ? filters[0] : and(...filters);

      const rows = await db
        .select()
        .from(workRequests)
        .where(whereClause)
        .orderBy(desc(workRequests.createdAt));

      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching work requests:", error);
      res.status(500).json({
        message: "Failed to fetch work requests",
        requestId: (req as any).requestId || null,
      });
    }
  });

  app.post("/api/work-requests", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const body = req.body ?? {};
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const category = typeof body.category === "string" ? body.category.trim() : undefined;

      const budgetMinNumber = body.budgetMin != null ? Number(body.budgetMin) : NaN;
      const budgetMaxNumber = body.budgetMax != null ? Number(body.budgetMax) : NaN;

      if (!title || !description) {
        return res.status(400).json({ message: "title and description are required" });
      }

      const rawTargetIds = Array.isArray(body.targetProviderIds)
        ? body.targetProviderIds
        : typeof body.targetProviderIds === "string"
          ? [body.targetProviderIds]
          : Array.isArray(body.targetContractorIds)
            ? body.targetContractorIds
            : typeof body.targetContractorIds === "string"
              ? [body.targetContractorIds]
              : [];

      const targetContractorIds = rawTargetIds
        .map((id: any) => (typeof id === "string" ? id.trim() : String(id)))
        .filter((id: string) => id.length > 0);

      let budgetMin: string | undefined;
      let budgetMax: string | undefined;
      if (Number.isFinite(budgetMinNumber) && budgetMinNumber > 0) {
        budgetMin = String(budgetMinNumber);
      }
      if (Number.isFinite(budgetMaxNumber) && budgetMaxNumber > 0) {
        budgetMax = String(budgetMaxNumber);
      }

      // Use canonical location from the user where available
      let countyFips: string | undefined;
      let stateCode: string | undefined;
      try {
        const viewer = await storage.getUser(String(userId));
        if (viewer) {
          const vState = (viewer as any).stateCode || (viewer as any).state_code;
          const vCounty = (viewer as any).countyFips || (viewer as any).county_fips;
          if (typeof vState === "string" && vState.length === 2) stateCode = vState;
          if (typeof vCounty === "string" && vCounty.length > 0) countyFips = vCounty;
        }
      } catch (e) {
        console.warn(
          "Failed to load user for work request location; continuing without canonical geo",
          e
        );
      }

      const [created] = await db
        .insert(workRequests)
        .values({
          createdByUserId: String(userId),
          title,
          description,
          category,
          countyFips,
          stateCode,
          scope: "community",
          source: "tasks",
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
          budgetMin,
          budgetMax,
        })
        .returning();

      if (created) {
        try {
          await db.insert(workRequestEvents).values({
            workRequestId: created.id,
            type: "created",
            actorUserId: String(userId),
            metadata: { source: "tasks" },
          });
        } catch (e) {
          console.warn("Failed to record work request created event", e);
        }

        if (targetContractorIds.length > 0) {
          try {
            const invitedContractors = await db
              .select({ id: contractors.id, userId: contractors.userId })
              .from(contractors)
              .where(inArray(contractors.id, targetContractorIds));

            if (invitedContractors.length > 0) {
              await db.insert(workRequestAssignments).values(
                invitedContractors.map((c) => ({
                  workRequestId: created.id,
                  contractorId: c.id,
                  status: "invited" as const,
                }))
              );

              await db.insert(workRequestEvents).values(
                invitedContractors.map((c) => ({
                  workRequestId: created.id,
                  type: "provider_invited" as const,
                  actorUserId: String(userId),
                  metadata: {
                    contractorId: c.id,
                    contractorUserId: c.userId ?? null,
                    source: "tasks",
                  },
                }))
              );
            }
          } catch (e) {
            console.warn("Failed to record work request assignments for invited providers", e);
          }
        }
      }

      res.status(201).json(created ?? null);
    } catch (error: any) {
      console.error("Error creating work request:", error);
      res.status(500).json({
        message: "Failed to create work request",
        requestId: (req as any).requestId || null,
      });
    }
  });

  app.get("/api/task-categories", async (req: any, res: any) => {
    try {
      const { TASK_CATEGORIES } = await import("@shared/task-categories");
      res.json(TASK_CATEGORIES);
    } catch (error: any) {
      console.error("Error fetching task categories:", error);
      res.status(500).json({ message: "Failed to fetch task categories" });
    }
  });

  // Worker registration endpoint
  app.post("/api/workers/register", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const body = req.body || {};
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!firstName || !lastName || !phone || !email) {
        return res
          .status(400)
          .json({ message: "firstName, lastName, phone, and email are required" });
      }

      const skills = Array.isArray(body.skills)
        ? body.skills
            .filter((skill: unknown) => typeof skill === "string" && skill.trim().length > 0)
            .map((skill: string) => skill.trim())
        : undefined;

      const hourlyRateRaw = body.hourlyRate;
      const hourlyRateNumber =
        hourlyRateRaw !== undefined && hourlyRateRaw !== null && hourlyRateRaw !== ""
          ? Number(hourlyRateRaw)
          : undefined;
      if (
        hourlyRateNumber !== undefined &&
        (!Number.isFinite(hourlyRateNumber) || hourlyRateNumber < 0)
      ) {
        return res.status(400).json({ message: "hourlyRate must be a valid non-negative number" });
      }

      const maxTravelDistanceRaw = body.maxTravelDistance;
      const maxTravelDistanceNumber =
        maxTravelDistanceRaw !== undefined &&
        maxTravelDistanceRaw !== null &&
        maxTravelDistanceRaw !== ""
          ? Number(maxTravelDistanceRaw)
          : undefined;
      if (
        maxTravelDistanceNumber !== undefined &&
        (!Number.isFinite(maxTravelDistanceNumber) || maxTravelDistanceNumber < 0)
      ) {
        return res
          .status(400)
          .json({ message: "maxTravelDistance must be a valid non-negative number" });
      }

      const availableHours =
        body.availableHours &&
        typeof body.availableHours === "object" &&
        !Array.isArray(body.availableHours)
          ? body.availableHours
          : undefined;

      const upsertPayload: any = {
        firstName,
        lastName,
        phone,
        email,
        profileImageUrl:
          typeof body.profileImageUrl === "string" && body.profileImageUrl.trim().length > 0
            ? body.profileImageUrl.trim()
            : undefined,
        bio: typeof body.bio === "string" ? body.bio.trim() : undefined,
        skills,
        hourlyRate:
          hourlyRateNumber !== undefined ? Number(hourlyRateNumber).toFixed(2) : undefined,
        availableHours,
        transportationMethod:
          typeof body.transportationMethod === "string"
            ? body.transportationMethod.trim()
            : undefined,
        maxTravelDistance:
          maxTravelDistanceNumber !== undefined ? Math.round(maxTravelDistanceNumber) : undefined,
        isAvailable: typeof body.isAvailable === "boolean" ? body.isAvailable : undefined,
        updatedAt: new Date(),
      };

      const [existingWorker] = await db
        .select()
        .from(workers)
        .where(eq(workers.userId, userId))
        .limit(1);

      if (existingWorker) {
        const [updatedWorker] = await db
          .update(workers)
          .set(upsertPayload)
          .where(eq(workers.id, existingWorker.id))
          .returning();
        return res.json(updatedWorker ?? existingWorker);
      }

      const [createdWorker] = await db
        .insert(workers)
        .values({
          userId,
          ...upsertPayload,
        })
        .returning();

      return res.status(201).json(createdWorker);
    } catch (error: any) {
      console.error("Error registering worker:", error);
      res.status(500).json({
        message: "Failed to register worker",
        requestId: (req as any).requestId || null,
      });
    }
  });

  // Task posting endpoint
  app.post("/api/tasks", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const body = req.body || {};

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : undefined;

      const taskType = typeof body.taskType === "string" ? body.taskType : "one_time";
      const payType = typeof body.payType === "string" ? body.payType : "fixed";
      const schedulingType = typeof body.schedulingType === "string" ? body.schedulingType : "asap";

      const payAmountNumber = Number(body.payAmount);
      if (!title || !description) {
        return res.status(400).json({ message: "title and description are required" });
      }
      if (!Number.isFinite(payAmountNumber) || payAmountNumber <= 0) {
        return res.status(400).json({ message: "payAmount must be a positive number" });
      }

      const posterType = req.user?.role === "contractor" ? "contractor" : "homeowner";
      const requiredSkills = Array.isArray(body.requiredSkills)
        ? body.requiredSkills
            .filter((s: any) => typeof s === "string" && s.trim())
            .map((s: string) => s.trim())
        : undefined;

      const created = await db
        .insert(tasks)
        .values({
          posterId: String(userId),
          posterType,
          title,
          description,
          categoryId,
          taskType,
          payType,
          payAmount: String(payAmountNumber),
          schedulingType,
          estimatedHours:
            body.estimatedHours !== undefined &&
            body.estimatedHours !== null &&
            body.estimatedHours !== ""
              ? String(Number(body.estimatedHours))
              : undefined,
          requiredSkills,
          address: typeof body.address === "string" ? body.address : undefined,
          city: typeof body.city === "string" ? body.city : undefined,
          stateCode: typeof body.stateCode === "string" ? body.stateCode : undefined,
          zipCode: typeof body.zipCode === "string" ? body.zipCode : undefined,
          countyFips: typeof body.countyFips === "string" ? body.countyFips : undefined,
          status: "open",
        })
        .returning();

      res.status(201).json(created?.[0] ?? null);
    } catch (error: any) {
      console.error("Error creating task:", error);
      res
        .status(500)
        .json({ message: "Failed to create task", requestId: (req as any).requestId || null });
    }
  });

  // Task application endpoint
  app.post("/api/tasks/:taskId/apply", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const taskId = String(req.params.taskId || "").trim();
      if (!taskId) return res.status(400).json({ message: "taskId is required" });

      const body = req.body || {};
      const message = typeof body.message === "string" ? body.message.trim() : undefined;

      const inserted = await db
        .insert(taskApplications)
        .values({
          taskId,
          workerId: String(userId),
          message: message || undefined,
          status: "pending",
        })
        .returning();

      res.status(201).json(inserted?.[0] ?? null);
    } catch (error: any) {
      console.error("Error applying to task:", error);
      res
        .status(500)
        .json({ message: "Failed to apply to task", requestId: (req as any).requestId || null });
    }
  });

  const hasHelperDashboardAccess = (user: any): boolean => {
    const roleCandidates = [
      user?.role,
      user?.activeRole,
      ...(Array.isArray(user?.roles) ? user.roles : []),
    ]
      .map((role) =>
        String(role || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

    return roleCandidates.some((role) => role === "helper" || role === "handyman");
  };

  // Worker verification endpoint
  app.post(
    "/api/workers/:workerId/verify",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const workerId = String(req.params.workerId || "").trim();
        if (!workerId) {
          return res.status(400).json({ message: "workerId is required" });
        }

        const body = req.body || {};
        const requestedStatus =
          typeof body.verificationStatus === "string" ? body.verificationStatus.trim() : "approved";
        const allowedStatuses = new Set(["pending", "in_review", "approved", "rejected"]);
        if (!allowedStatuses.has(requestedStatus)) {
          return res.status(400).json({
            message: "verificationStatus must be one of: pending, in_review, approved, rejected",
          });
        }

        const [updatedWorker] = await db
          .update(workers)
          .set({
            verificationStatus: requestedStatus as
              | "pending"
              | "in_review"
              | "approved"
              | "rejected",
            isIdVerified:
              typeof body.isIdVerified === "boolean"
                ? body.isIdVerified
                : requestedStatus === "approved",
            isBackgroundChecked:
              typeof body.isBackgroundChecked === "boolean" ? body.isBackgroundChecked : undefined,
            verificationDocuments:
              body.verificationDocuments &&
              typeof body.verificationDocuments === "object" &&
              !Array.isArray(body.verificationDocuments)
                ? body.verificationDocuments
                : undefined,
            verifiedAt: requestedStatus === "approved" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(workers.id, workerId))
          .returning();

        if (!updatedWorker) {
          return res.status(404).json({ message: "Worker not found" });
        }

        return res.json(updatedWorker);
      } catch (error: any) {
        console.error("Error verifying worker:", error);
        res.status(500).json({
          message: "Failed to verify worker",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Helper dashboard specific endpoints
  app.get("/api/workers/profile", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!hasHelperDashboardAccess(req.user)) {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [workerProfile] = await db
        .select()
        .from(workers)
        .where(eq(workers.userId, userId))
        .limit(1);
      if (!workerProfile) {
        return res.status(404).json({ message: "worker profile not found" });
      }

      res.json(workerProfile);
    } catch (error: any) {
      console.error("Error fetching helper profile:", error);
      res.status(500).json({ message: "Failed to fetch helper profile" });
    }
  });

  app.patch("/api/workers/profile/availability", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const isAvailable = req.body?.isAvailable;
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({ message: "isAvailable must be a boolean" });
      }
      const [updated] = await db
        .update(workers)
        .set({ isAvailable, updatedAt: new Date() })
        .where(eq(workers.userId, userId))
        .returning();
      if (!updated) return res.status(404).json({ message: "Worker profile not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating worker availability:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  app.get("/api/tasks/available", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!hasHelperDashboardAccess(req.user)) {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      if ((db as any).select && (tasks as any)) {
        const availableTasks = await db.select().from(tasks).limit(100);
        res.json(availableTasks || []);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("Error fetching available tasks:", error);
      res.status(500).json({ message: "Failed to fetch available tasks" });
    }
  });

  app.get("/api/workers/applications", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!hasHelperDashboardAccess(req.user)) {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const applications = await db
        .select({
          application: taskApplications,
          task: tasks,
        })
        .from(taskApplications)
        .leftJoin(tasks, eq(taskApplications.taskId, tasks.id))
        .where(eq(taskApplications.workerId, userId))
        .orderBy(desc(taskApplications.createdAt));

      res.json(applications);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/workers/completed-jobs", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!hasHelperDashboardAccess(req.user)) {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const completedJobs = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.assignedWorkerId, userId), eq(tasks.status, "completed")))
        .orderBy(desc(tasks.completedAt), desc(tasks.updatedAt), desc(tasks.createdAt));

      res.json(completedJobs);
    } catch (error: any) {
      console.error("Error fetching completed jobs:", error);
      res.status(500).json({ message: "Failed to fetch completed jobs" });
    }
  });

  app.get("/api/workers/reviews", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!hasHelperDashboardAccess(req.user)) {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [workerProfile] = await db
        .select()
        .from(workers)
        .where(eq(workers.userId, userId))
        .limit(1);
      if (!workerProfile) {
        return res.status(404).json({ message: "worker profile not found" });
      }

      const reviews = await db
        .select()
        .from(workerReviews)
        .where(and(eq(workerReviews.workerId, workerProfile.id), eq(workerReviews.isPublic, true)))
        .orderBy(desc(workerReviews.createdAt));

      res.json(reviews);
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.status(501).json({
          message: "Worker reviews are not available until worker_reviews is migrated.",
        });
      }
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Error reporting endpoints
  // Object Storage Routes for File Uploads
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res: any) => {
    try {
      const useR2 = process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID;

      if (useR2) {
        const { R2StorageService } = await import("../localStorage");
        const storageService = new R2StorageService();
        const { uploadURL, publicUrl } = await storageService.getUploadURL();
        res.json({ uploadURL, publicUrl });
      } else {
        const { LocalStorageService } = await import("../localStorage");
        const storageService = new LocalStorageService();
        const uploadURL = await storageService.getUploadURL();
        res.json({ uploadURL });
      }
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Private object uploads: returns { uploadURL, objectKey } (no public URL).
  // Used for account-only storage (e.g., private home vault documents).
  app.post("/api/objects/upload-private", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const useR2 = process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID;

      if (useR2) {
        const { R2StorageService } = await import("../localStorage");
        const storageService = new R2StorageService();
        const { uploadURL, objectKey } = await storageService.getPrivateUploadURL(userId);
        return res.json({ uploadURL, objectKey });
      }

      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const { uploadURL, objectKey } = await storageService.getPrivateUploadURL();
      return res.json({ uploadURL, objectKey });
    } catch (error: any) {
      console.error("Error getting private upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Legacy/utility AI endpoint: server-side Gemini call (never expose API keys to clients).
  app.post("/api/ai/gemini", isAuthenticated, aiLimiter, async (req: any, res: any) => {
    try {
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
      if (!prompt.trim()) {
        return res.status(400).json({ error: "prompt is required" });
      }
      if (prompt.length > 8000) {
        return res.status(400).json({ error: "prompt too long" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const { text } = await generateGeminiTextWithFallback(genAI, prompt);

      return res.json({ text });
    } catch (error: any) {
      console.error("Error in /api/ai/gemini:", error);
      return res.status(500).json({ error: "AI request failed" });
    }
  });

  const isSafeUploadId = (value: unknown): value is string => {
    if (typeof value !== "string") return false;
    // We generate IDs as UUIDs; enforce that here to prevent traversal/overwrite.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  };

  const isPathUnder = (parent: string, candidate: string): boolean => {
    const parentPath = path.resolve(parent);
    const candidatePath = path.resolve(candidate);
    const withSep = parentPath.endsWith(path.sep) ? parentPath : parentPath + path.sep;
    return candidatePath === parentPath || candidatePath.startsWith(withSep);
  };

  // Handle actual file upload (LocalStorageService fallback only).
  app.put("/api/objects/upload/:fileId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { fileId } = req.params;
      if (!isSafeUploadId(fileId)) {
        return res.status(400).json({ error: "Invalid fileId" });
      }

      // If R2 is configured, uploads should go directly to the signed URL returned by POST /api/objects/upload.
      const useR2 = process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID;
      if (useR2) {
        return res
          .status(400)
          .json({ error: "Direct uploads are enabled; use the signed uploadURL" });
      }

      const contentType = req.headers["content-type"] || "application/octet-stream";

      const maxBytes = Number.parseInt(process.env.MAX_UPLOAD_BYTES || "", 10);
      const limitBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 20 * 1024 * 1024; // 20MB default

      const contentLengthHeader = req.headers["content-length"];
      const contentLength =
        typeof contentLengthHeader === "string"
          ? Number.parseInt(contentLengthHeader, 10)
          : undefined;
      if (
        typeof contentLength === "number" &&
        Number.isFinite(contentLength) &&
        contentLength > limitBytes
      ) {
        return res.status(413).json({ error: "Upload too large" });
      }

      // Collect buffer from request with a hard size cap.
      const chunks: Buffer[] = [];
      let received = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buf.length;
        if (received > limitBytes) {
          try {
            req.destroy();
          } catch {
            // ignore
          }
          return res.status(413).json({ error: "Upload too large" });
        }
        chunks.push(buf);
      }
      const buffer = Buffer.concat(chunks);

      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const publicUrl = await storageService.saveFile(fileId, buffer, contentType);

      res.status(200).send(publicUrl);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Handle actual private file upload (LocalStorageService fallback only).
  app.put("/api/objects/upload-private/:fileId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { fileId } = req.params;
      if (!isSafeUploadId(fileId)) {
        return res.status(400).json({ error: "Invalid fileId" });
      }

      // If R2 is configured, uploads should go directly to the signed URL returned by POST /api/objects/upload-private.
      const useR2 = process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID;
      if (useR2) {
        return res
          .status(400)
          .json({ error: "Direct uploads are enabled; use the signed uploadURL" });
      }

      const contentType = req.headers["content-type"] || "application/octet-stream";

      const maxBytes = Number.parseInt(process.env.MAX_UPLOAD_BYTES || "", 10);
      const limitBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 20 * 1024 * 1024; // 20MB default

      const contentLengthHeader = req.headers["content-length"];
      const contentLength =
        typeof contentLengthHeader === "string"
          ? Number.parseInt(contentLengthHeader, 10)
          : undefined;
      if (
        typeof contentLength === "number" &&
        Number.isFinite(contentLength) &&
        contentLength > limitBytes
      ) {
        return res.status(413).json({ error: "Upload too large" });
      }

      const chunks: Buffer[] = [];
      let received = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buf.length;
        if (received > limitBytes) {
          try {
            req.destroy();
          } catch {
            // ignore
          }
          return res.status(413).json({ error: "Upload too large" });
        }
        chunks.push(buf);
      }
      const buffer = Buffer.concat(chunks);

      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const objectKey = await storageService.savePrivateFile(fileId, buffer, String(contentType));

      res.status(200).send(objectKey);
    } catch (error: any) {
      console.error("Error uploading private file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Admin: ingest a folder of knowledge files into the manual cache
  app.post(
    "/api/admin/knowledge/ingest-folder",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { folderPath } = req.body || {};
        if (!folderPath || typeof folderPath !== "string") {
          return res.status(400).json({ error: "folderPath is required" });
        }

        // Prevent ingesting arbitrary server directories.
        const allowedRoots = [
          path.join(__dirname, "uploads"),
          path.join(__dirname, "cache", "manual", "bulk_uploads"),
        ];
        const resolvedFolder = path.resolve(folderPath);
        const allowed = allowedRoots.some((root) => isPathUnder(root, resolvedFolder));
        if (!allowed) {
          return res
            .status(403)
            .json({ error: "folderPath must be under an approved ingest root" });
        }

        const summary = ingestKnowledgeFolder(folderPath);
        res.json({ message: "Knowledge folder ingested", summary });
      } catch (error: any) {
        console.error("Error ingesting knowledge folder:", error);
        res
          .status(500)
          .json({ error: "Failed to ingest folder", requestId: (req as any).requestId || null });
      }
    }
  );

  // Admin: direct file upload (text/images/etc), then ingest and sort
  app.post("/api/admin/knowledge/upload", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const multer = (await import("multer")).default;
      const uploadDir = path.join(__dirname, "uploads", `batch_${Date.now()}`);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const maxBytes = Number.parseInt(process.env.MAX_KNOWLEDGE_UPLOAD_BYTES || "", 10);
      const limitBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 25 * 1024 * 1024; // 25MB per file

      const upload = multer({
        dest: uploadDir,
        limits: {
          files: 50,
          fileSize: limitBytes,
        },
      }).array("files", 50);

      upload(req, res, (err: any) => {
        if (err) {
          console.error("Upload error:", err);
          return res.status(500).json({ error: "Upload failed" });
        }

        // Multer already wrote files; ingest the temp directory
        const summary = ingestKnowledgeFolder(uploadDir);
        res.json({ message: "Files uploaded and ingested", summary });
      });
    } catch (error: any) {
      console.error("Error uploading knowledge files:", error);
      res
        .status(500)
        .json({ error: "Failed to upload files", requestId: (req as any).requestId || null });
    }
  });

  // Admin: get user info (expanded for full visibility to platform admins)
  app.post("/api/admin/users/info", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { email, userId } = req.body || {};
      if (!email && !userId) {
        return res.status(400).json({ error: "Provide email or userId" });
      }

      const target = email
        ? await storage.getUserByEmail(String(email).toLowerCase())
        : await storage.getUser(userId);

      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return expanded profile details but never include password hashes
      const sanitized = {
        id: target.id,
        email: target.email,
        phone: (target as any).phone || null,
        firstName: (target as any).firstName || null,
        lastName: (target as any).lastName || null,
        city: (target as any).city || null,
        county: (target as any).county || null,
        state: (target as any).state || null,
        stateCode: (target as any).stateCode || null,
        zipCode: (target as any).zipCode || null,
        countyFips: (target as any).countyFips || null,
        countyName: (target as any).countyName || null,
        roles: target.roles || (target.role ? [target.role] : []),
        activeRole: target.activeRole || target.role,
        verificationStatus: target.verificationStatus,
        badges: target.badges,
        preferences: target.preferences,
        profileImageUrl: (target as any).profileImageUrl || null,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
        addressVerified: target.addressVerified,
        emailVerified: target.emailVerified,
        passwordResetEnabled: true,
      };

      res.json({ user: sanitized });
    } catch (error: any) {
      console.error("Error fetching user info:", error);
      res.status(500).json({
        error: "Failed to fetch user info",
        requestId: (req as any).requestId || null,
      });
    }
  });

  // Admin: reset user password directly
  app.post(
    "/api/admin/users/reset-password",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { email, userId, newPassword } = req.body || {};
        const reason = normalizePrivilegedReason(req.body?.reason, 12);
        const targetUserId = normalizeImmutableTargetId(userId);
        const targetEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
          return res
            .status(400)
            .json({ error: "newPassword is required and must be at least 8 characters" });
        }
        if (!reason) {
          return res
            .status(400)
            .json({ error: "reason is required and must be at least 12 characters" });
        }

        if (!targetUserId) {
          await auditPrivilegedAction({
            action: "admin_user_reset_password",
            route: "/api/admin/users/reset-password",
            operationType: "reset_user_password",
            actorId: normalizeImmutableTargetId(
              (req.user as any)?.id || (req.user as any)?.claims?.sub
            ),
            actorRole: resolvePrivilegedActor(req.user).actorRole,
            actorRoles: resolvePrivilegedActor(req.user).actorRoles,
            targetType: "user",
            targetId: null,
            resolutionSource: targetEmail ? "target_email_only" : "missing_target_user_id",
            reason,
            outcome: "denied",
            lookupInput: { targetEmail: targetEmail || null },
          });
          return res.status(400).json({
            error: "userId is required. email may be supplied only as lookup metadata.",
          });
        }

        const target = await storage.getUser(targetUserId);

        if (!target) {
          return res.status(404).json({ error: "User not found" });
        }
        if (!suppliedEmailMatchesTarget(targetEmail, target)) {
          await auditPrivilegedAction({
            action: "admin_user_reset_password",
            route: "/api/admin/users/reset-password",
            operationType: "reset_user_password",
            actorId: normalizeImmutableTargetId(
              (req.user as any)?.id || (req.user as any)?.claims?.sub
            ),
            actorRole: resolvePrivilegedActor(req.user).actorRole,
            actorRoles: resolvePrivilegedActor(req.user).actorRoles,
            targetType: "user",
            targetId: target.id,
            resolutionSource: "param:userId",
            reason,
            outcome: "denied",
            lookupInput: { targetEmail },
            details: { mismatch: "target_email_does_not_match_target_user_id" },
          });
          return res.status(409).json({ error: "email does not match userId" });
        }

        const actorId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const actor = await storage.getUser(actorId);
        if (!actor) {
          return res.status(401).json({ error: "Actor not found" });
        }

        const targetProtected = isProtectedAdminUser(target);
        if (targetProtected && !isSuperAdminUser(actor)) {
          return res.status(403).json({
            error: "Only super admins can reset passwords for protected admin users",
          });
        }

        const safety = validateAdminWriteSafety(req.body ?? {}, req.headers as any, {
          forceStrict: targetProtected,
        });
        if (!safety.ok) {
          return res.status(403).json({ error: safety.message });
        }

        const passwordHash = await hashPassword(newPassword);
        await storage.updateUser(target.id, {
          password: passwordHash,
          updatedAt: new Date(),
        });

        await auditPrivilegedAction({
          action: "admin_user_reset_password",
          route: "/api/admin/users/reset-password",
          operationType: "reset_user_password",
          actorId: normalizeImmutableTargetId(actorId),
          actorRole: resolvePrivilegedActor(actor).actorRole,
          actorRoles: resolvePrivilegedActor(actor).actorRoles,
          targetType: "user",
          targetId: target.id,
          resolutionSource: "param:userId",
          reason,
          outcome: "completed",
          lookupInput: { targetEmail: targetEmail || null },
          details: { protectedTarget: targetProtected },
        });

        res.json({
          message: "Password reset successfully",
          userId: target.id,
          email: target.email,
        });
      } catch (error: any) {
        console.error("Error resetting user password:", error);
        res.status(500).json({
          error: "Failed to reset password",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Admin: update a user's public profile fields (admin-targeted version of /api/user/profile)
  app.put(
    "/api/admin/users/:userId/profile",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const targetUserId = String((req.params as any)?.userId || "").trim();
        const reason = normalizePrivilegedReason((req.body as any)?.reason, 12);
        if (!targetUserId) return res.status(400).json({ message: "userId is required" });
        if (!reason) {
          return res.status(400).json({ message: "reason is required (min 12 chars)" });
        }

        const existing = await storage.getUser(targetUserId);
        if (!existing) return res.status(404).json({ message: "User not found" });

        const actorId = String(
          (req as any)?.user?.id || (req as any)?.user?.claims?.sub || ""
        ).trim();
        const actor = await storage.getUser(actorId);
        if (!actor) {
          return res.status(401).json({ message: "Actor not found" });
        }

        const targetProtected = isProtectedAdminUser(existing);
        if (targetProtected && !isSuperAdminUser(actor)) {
          return res
            .status(403)
            .json({ message: "Only super admins can edit protected admin users" });
        }

        const safety = validateAdminWriteSafety(req.body ?? {}, (req as any).headers ?? {}, {
          forceStrict: targetProtected,
        });
        if (!safety.ok) {
          return res.status(403).json({ message: safety.message });
        }

        const body = (req.body ?? {}) as any;
        const {
          firstName,
          lastName,
          phone,
          address,
          city,
          state,
          stateCode,
          zipCode,
          county,
          countyName,
          countyFips,
          countyId,
          latitude,
          longitude,
          profileImageUrl,
          emailVerified,
          addressVerified,
          onboardingCompleted,
          verificationStatus,
          preferencesPatch,
        } = body;

        const trimmedCountyFips = typeof countyFips === "string" ? countyFips.trim() : countyFips;
        if (trimmedCountyFips && !/^\d{5}$/.test(trimmedCountyFips)) {
          return res.status(400).json({
            message: "Invalid countyFips; expected a 5-digit FIPS code.",
          });
        }

        let normalizedProfileImageUrl = profileImageUrl;
        if (profileImageUrl) {
          try {
            normalizedProfileImageUrl = await objectStorageService.trySetObjectEntityAclPolicy(
              profileImageUrl,
              {
                owner: targetUserId,
                visibility: "public",
              }
            );
          } catch (e) {
            console.warn("Failed to set ACL for profile image", e);
          }
        }

        const existingPreferences: any =
          existing &&
          typeof (existing as any).preferences === "object" &&
          (existing as any).preferences
            ? (existing as any).preferences
            : {};
        const patchPreferences: any =
          preferencesPatch && typeof preferencesPatch === "object" ? preferencesPatch : null;

        const updated = await storage.updateUser(targetUserId, {
          firstName,
          lastName,
          phone,
          address,
          city,
          state,
          zipCode,
          county,
          stateCode: stateCode ?? state ?? undefined,
          countyFips: trimmedCountyFips ?? undefined,
          countyId: countyId ?? undefined,
          countyName: countyName ?? county ?? undefined,
          latitude: typeof latitude === "number" ? String(latitude) : undefined,
          longitude: typeof longitude === "number" ? String(longitude) : undefined,
          profileImageUrl: normalizedProfileImageUrl,
          emailVerified: typeof emailVerified === "boolean" ? emailVerified : undefined,
          addressVerified: typeof addressVerified === "boolean" ? addressVerified : undefined,
          onboardingCompleted:
            typeof onboardingCompleted === "boolean" ? onboardingCompleted : undefined,
          profileVersion:
            onboardingCompleted === true
              ? CURRENT_PROFILE_VERSION
              : typeof existing.profileVersion === "number"
                ? existing.profileVersion
                : undefined,
          verificationStatus:
            verificationStatus === "pending" ||
            verificationStatus === "under_review" ||
            verificationStatus === "approved" ||
            verificationStatus === "rejected" ||
            verificationStatus === "expired" ||
            verificationStatus === "suspended"
              ? verificationStatus
              : undefined,
          preferences: patchPreferences
            ? { ...existingPreferences, ...patchPreferences }
            : undefined,
          updatedAt: new Date(),
        } as any);

        await auditPrivilegedAction({
          action: "admin_user_profile_update",
          route: "/api/admin/users/:userId/profile",
          operationType: "update_user_profile",
          actorId: normalizeImmutableTargetId(actorId),
          actorRole: resolvePrivilegedActor(actor).actorRole,
          actorRoles: resolvePrivilegedActor(actor).actorRoles,
          targetType: "user",
          targetId: targetUserId,
          resolutionSource: "route_param:user_id",
          reason,
          outcome: "completed",
          details: {
            protectedTarget: targetProtected,
            changedFields: [
              "firstName",
              "lastName",
              "phone",
              "address",
              "city",
              "state",
              "stateCode",
              "zipCode",
              "county",
              "countyName",
              "countyFips",
              "countyId",
              "latitude",
              "longitude",
              "profileImageUrl",
              "emailVerified",
              "addressVerified",
              "onboardingCompleted",
              "verificationStatus",
              patchPreferences ? "preferencesPatch" : null,
            ].filter(Boolean),
          },
        });

        return res.json({ user: sanitizeUserForResponse(updated) });
      } catch (error: any) {
        console.error("Error updating admin user profile:", error);
        return res.status(500).json({ message: "Failed to update user profile" });
      }
    }
  );

  const ADMIN_SUPPORT_CONFIRM_PHRASE = "I UNDERSTAND THIS EDIT IS AUDITED";
  const PROTECTED_ADMIN_ROLES = new Set(["moderator", "ops_admin", "super_admin"]);

  const normalizeRoleForProtection = (role: unknown): string => {
    const raw = String(role || "")
      .trim()
      .toLowerCase();
    if (!raw) return "";
    if (raw === "owner" || raw === "head_admin") return "super_admin";
    return raw;
  };

  const userHasProtectedAdminRole = (user: any): boolean => {
    if (!user) return false;
    const primaryRole = normalizeRoleForProtection(user.role);
    const activeRole = normalizeRoleForProtection(user.activeRole);
    const roleList = Array.isArray(user.roles)
      ? user.roles.map((r: unknown) => normalizeRoleForProtection(r))
      : [];
    const roles = new Set([primaryRole, activeRole, ...roleList].filter(Boolean));
    for (const role of roles) {
      if (PROTECTED_ADMIN_ROLES.has(role)) return true;
    }
    return false;
  };

  const userIsSuperAdmin = (user: any): boolean => {
    if (!user) return false;
    const primaryRole = normalizeRoleForProtection(user.role);
    const activeRole = normalizeRoleForProtection(user.activeRole);
    const roleList = Array.isArray(user.roles)
      ? user.roles.map((r: unknown) => normalizeRoleForProtection(r))
      : [];
    const roles = new Set([primaryRole, activeRole, ...roleList].filter(Boolean));
    return roles.has("super_admin");
  };

  const normalizeAdminTradeTagInput = (value: string): string =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  const toAdminTradeDisplayName = (value: string): string => {
    const cleaned = String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
    if (!cleaned) return "Custom Trade";
    return cleaned
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ")
      .slice(0, 120);
  };

  const resolveOrCreateTradeTagSlugs = async (
    rawTags: string[]
  ): Promise<{ slugs: string[]; created: string[] }> => {
    const normalizedInputs = Array.from(
      new Set(rawTags.map((tag) => normalizeAdminTradeTagInput(tag)).filter(Boolean))
    );

    const resolvedSlugs: string[] = [];
    const createdSlugs: string[] = [];

    for (const input of normalizedInputs) {
      const bySlug = await storage.getTradeBySlug(input);
      if (bySlug?.slug) {
        resolvedSlugs.push(String(bySlug.slug));
        continue;
      }

      const [byId] = await db.select().from(trades).where(eq(trades.id, input)).limit(1);
      if (byId?.slug) {
        resolvedSlugs.push(String(byId.slug));
        continue;
      }

      try {
        const created = await storage.createTrade({
          name: toAdminTradeDisplayName(input),
          slug: input,
        } as any);
        if (created?.slug) {
          const slug = String(created.slug);
          resolvedSlugs.push(slug);
          createdSlugs.push(slug);
        }
      } catch (error: any) {
        if (String(error?.code || "") === "23505") {
          const existing = await storage.getTradeBySlug(input);
          if (existing?.slug) {
            resolvedSlugs.push(String(existing.slug));
            continue;
          }
        }
        throw error;
      }
    }

    return {
      slugs: Array.from(new Set(resolvedSlugs)),
      created: Array.from(new Set(createdSlugs)),
    };
  };

  // Admin Support Edit: safeguarded "edit user for them" endpoint.
  // Requires immutable target resolution, explicit reason, and audited outcome.
  app.post(
    "/api/admin/users/support-edit",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const actorId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        if (!actorId) return res.status(401).json({ message: "Unauthorized" });

        const body = (req.body ?? {}) as any;
        const adminSafety =
          body.adminSafety && typeof body.adminSafety === "object" ? body.adminSafety : {};

        const reason = normalizePrivilegedReason(adminSafety.reason, 12);
        if (!reason || reason.length < 12) {
          return res.status(400).json({ message: "adminSafety.reason is required (min 12 chars)" });
        }

        const confirmPhrase = String(adminSafety.confirmPhrase || "").trim();
        if (confirmPhrase !== ADMIN_SUPPORT_CONFIRM_PHRASE) {
          return res.status(400).json({
            message: `adminSafety.confirmPhrase must be exactly: ${ADMIN_SUPPORT_CONFIRM_PHRASE}`,
          });
        }

        const configuredSafetyKey = String(process.env.ADMIN_SAFETY_KEY || "").trim();
        if (configuredSafetyKey) {
          const providedSafetyKey = String(
            adminSafety.safetyKey || req.headers["x-admin-safety-key"] || ""
          ).trim();
          if (!providedSafetyKey || providedSafetyKey !== configuredSafetyKey) {
            return res.status(403).json({ message: "Admin safety key validation failed" });
          }
        }

        const targetUserId = normalizeImmutableTargetId(body.targetUserId);
        const targetEmail = String(body.targetEmail || "")
          .trim()
          .toLowerCase();

        if (!targetUserId) {
          await auditPrivilegedAction({
            action: "admin_support_user_edit",
            route: "/api/admin/users/support-edit",
            operationType: "support_user_edit",
            actorId,
            actorRole: resolvePrivilegedActor(req.user).actorRole,
            actorRoles: resolvePrivilegedActor(req.user).actorRoles,
            targetType: "user",
            targetId: null,
            resolutionSource: targetEmail ? "target_email_only" : "missing_target_user_id",
            reason,
            outcome: "denied",
            lookupInput: { targetEmail: targetEmail || null },
          });
          return res.status(400).json({
            message:
              "targetUserId is required. targetEmail may be supplied only as lookup metadata.",
          });
        }

        const target = await storage.getUser(targetUserId);

        if (!target) {
          return res.status(404).json({ message: "Target user not found" });
        }
        if (!suppliedEmailMatchesTarget(targetEmail, target)) {
          await auditPrivilegedAction({
            action: "admin_support_user_edit",
            route: "/api/admin/users/support-edit",
            operationType: "support_user_edit",
            actorId,
            actorRole: resolvePrivilegedActor(req.user).actorRole,
            actorRoles: resolvePrivilegedActor(req.user).actorRoles,
            targetType: "user",
            targetId: target.id,
            resolutionSource: "target_user_id",
            reason,
            outcome: "denied",
            lookupInput: { targetEmail },
            details: { mismatch: "target_email_does_not_match_target_user_id" },
          });
          return res.status(409).json({ message: "targetEmail does not match targetUserId" });
        }
        const targetResolutionSource = "target_user_id";

        const actor = await storage.getUser(actorId);
        if (!actor) {
          return res.status(401).json({ message: "Actor not found" });
        }
        const actorContext = resolvePrivilegedActor(actor);

        const targetProtected = userHasProtectedAdminRole(target);
        if (targetProtected) {
          if (!userIsSuperAdmin(actor)) {
            return res
              .status(403)
              .json({ message: "Only super admins can edit protected admin users" });
          }
          if (adminSafety.allowPrivilegedTargetEdit !== true) {
            return res.status(400).json({
              message:
                "adminSafety.allowPrivilegedTargetEdit=true is required for protected targets",
            });
          }
        }

        const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
        const preferencesPatch =
          patch.preferencesPatch && typeof patch.preferencesPatch === "object"
            ? patch.preferencesPatch
            : {};

        const rawSupportTradeTags = Array.isArray(patch.tradeTags)
          ? patch.tradeTags
          : Array.isArray(preferencesPatch.tradeTags)
            ? preferencesPatch.tradeTags
            : typeof patch.tradeTags === "string"
              ? String(patch.tradeTags)
                  .split(",")
                  .map((v) => v.trim())
              : typeof preferencesPatch.tradeTags === "string"
                ? String(preferencesPatch.tradeTags)
                    .split(",")
                    .map((v) => v.trim())
                : [];
        const supportTradeTagsProvided =
          patch.tradeTags !== undefined || preferencesPatch.tradeTags !== undefined;
        const supportTradeTags: string[] = Array.from(
          new Set(
            rawSupportTradeTags
              .map((value: any) => String(value || "").trim())
              .filter((value: string) => value.length > 0)
          )
        );

        const allowedUserFields = [
          "firstName",
          "lastName",
          "phone",
          "address",
          "city",
          "state",
          "stateCode",
          "zipCode",
          "county",
          "countyName",
          "countyFips",
          "countyId",
          "latitude",
          "longitude",
          "profileImageUrl",
        ] as const;

        const allowedPreferenceFields = [
          "bio",
          "servicesDescription",
          "profileVisibility",
          "profileSections",
          "colorScheme",
          "tradeTags",
        ] as const;

        const changedUserKeys = allowedUserFields.filter((key) => patch[key] !== undefined);
        const changedPreferenceKeys = allowedPreferenceFields.filter(
          (key) => preferencesPatch[key] !== undefined
        );
        if (
          supportTradeTagsProvided &&
          !changedPreferenceKeys.includes("tradeTags" as (typeof allowedPreferenceFields)[number])
        ) {
          changedPreferenceKeys.push("tradeTags");
        }
        const totalChanged = changedUserKeys.length + changedPreferenceKeys.length;

        if (totalChanged === 0) {
          return res.status(400).json({ message: "No editable fields supplied in patch" });
        }

        if (totalChanged > 12) {
          return res.status(400).json({ message: "Too many fields in one operation (max 12)" });
        }

        if (patch.countyFips !== undefined) {
          const trimmed = String(patch.countyFips || "").trim();
          if (trimmed && !/^\d{5}$/.test(trimmed)) {
            return res
              .status(400)
              .json({ message: "Invalid countyFips; expected a 5-digit FIPS code." });
          }
          patch.countyFips = trimmed || undefined;
        }

        if (supportTradeTags.length > 40) {
          return res.status(400).json({ message: "tradeTags supports up to 40 entries" });
        }
        if (supportTradeTags.some((tag) => String(tag).length > 80)) {
          return res.status(400).json({ message: "Each trade tag must be 80 characters or fewer" });
        }

        const resolvedSupportTradeTags = supportTradeTagsProvided
          ? await resolveOrCreateTradeTagSlugs(supportTradeTags)
          : null;
        // Never treat tradeTags as direct user table patch field.
        delete (patch as any).tradeTags;

        const existingPreferences: any =
          target && typeof (target as any).preferences === "object" && (target as any).preferences
            ? (target as any).preferences
            : {};

        const safeUserPatch: Record<string, unknown> = { updatedAt: new Date() };
        for (const key of changedUserKeys) {
          const value = patch[key];
          if (key === "latitude" || key === "longitude") {
            safeUserPatch[key] =
              typeof value === "number"
                ? String(value)
                : typeof value === "string" && value.trim()
                  ? value.trim()
                  : undefined;
            continue;
          }
          safeUserPatch[key] = typeof value === "string" ? value.trim() || undefined : value;
        }

        if (changedPreferenceKeys.length > 0) {
          const safePrefs: Record<string, unknown> = {};
          for (const key of changedPreferenceKeys) {
            if (key === "tradeTags") {
              safePrefs[key] = resolvedSupportTradeTags?.slugs || [];
            } else {
              safePrefs[key] = preferencesPatch[key];
            }
          }
          safeUserPatch.preferences = { ...existingPreferences, ...safePrefs };
        }

        const updated = await storage.updateUser(target.id, safeUserPatch as any);

        if (resolvedSupportTradeTags) {
          const existingDeclaration = await storage.getProviderDeclarationForUser(target.id);
          const existingTradeIds = Array.isArray((existingDeclaration as any)?.tradeIds)
            ? ((existingDeclaration as any).tradeIds as string[]).filter(Boolean)
            : [];
          const mergedTradeIds =
            resolvedSupportTradeTags.slugs.length > 0
              ? Array.from(new Set([...existingTradeIds, ...resolvedSupportTradeTags.slugs]))
              : [];

          const existingAreasRaw = Array.isArray((existingDeclaration as any)?.serviceAreas)
            ? ((existingDeclaration as any).serviceAreas as Array<{ countyFips?: string }>)
            : [];
          const existingCountyFips = existingAreasRaw
            .map((area) => String(area?.countyFips || "").trim())
            .filter((v) => /^\d{5}$/.test(v));
          const patchCountyFips = String(patch.countyFips || "").trim();
          const mergedCountyFips = Array.from(
            new Set([
              ...existingCountyFips,
              ...(patchCountyFips && /^\d{5}$/.test(patchCountyFips) ? [patchCountyFips] : []),
            ])
          );

          const legalEligibilities = await getComputedProviderEligibilitiesForUser(target.id);
          const ineligibleCounties: Array<{
            countyFips: string;
            countyName: string;
            stateCode: string;
          }> = [];
          for (const county of mergedCountyFips) {
            const countyRecord = await storage.getCountyByFips(county);
            if (!countyRecord) continue;
            const legalDecision = getEligibilityDecisionForCounty(legalEligibilities, {
              fips: countyRecord.fips,
              stateCode: countyRecord.stateCode,
            });
            if (!legalDecision.eligible) {
              ineligibleCounties.push({
                countyFips: countyRecord.fips,
                countyName: countyRecord.name,
                stateCode: countyRecord.stateCode,
              });
            }
          }

          if (ineligibleCounties.length > 0) {
            return res.status(428).json({
              message: "Verified legal eligibility is required before assigning provider counties.",
              code: "ELIGIBILITY_REQUIRED",
              blockedServiceAreas: ineligibleCounties,
            });
          }

          await storage.upsertProviderDeclarationForUser({
            userId: target.id,
            tradeIds: mergedTradeIds,
            serviceAreas: mergedCountyFips.map((county) => ({ countyFips: county })),
            availabilityFlags:
              (existingDeclaration as any)?.availabilityFlags &&
              typeof (existingDeclaration as any).availabilityFlags === "object"
                ? ((existingDeclaration as any).availabilityFlags as any)
                : undefined,
          });
        }

        await auditPrivilegedAction({
          action: "admin_support_user_edit",
          route: "/api/admin/users/support-edit",
          operationType: "support_user_edit",
          actorId,
          actorRole: actorContext.actorRole,
          actorRoles: actorContext.actorRoles,
          targetType: "user",
          targetId: target.id,
          resolutionSource: targetResolutionSource,
          reason,
          outcome: "completed",
          lookupInput: { targetEmail: targetEmail || null },
          details: {
            protectedTarget: targetProtected,
            changedFields: [
              ...changedUserKeys,
              ...changedPreferenceKeys.map((k) => `preferences.${k}`),
            ],
          },
        });

        return res.json({
          ok: true,
          user: sanitizeUserForResponse(updated),
          protectedTarget: targetProtected,
        });
      } catch (error: any) {
        console.error("Error in admin support-edit:", error);
        return res.status(500).json({
          message: "Failed to edit user",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Admin: provision any user account (non-admin roles only)
  // - Creates user if missing
  // - Optionally sends a single "account setup" email (password set + verify email)
  app.post("/api/admin/users/provision", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const body = (req.body ?? {}) as any;
      const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
      if (!rawEmail) return res.status(400).json({ message: "email is required" });

      const email = rawEmail.toLowerCase();
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const city = typeof body.city === "string" ? body.city.trim() : "";
      const stateCodeRaw = typeof body.stateCode === "string" ? body.stateCode.trim() : "";
      const stateCode = stateCodeRaw ? stateCodeRaw.toUpperCase() : "";
      const countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : "";
      const role = typeof body.role === "string" ? body.role.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const sendEmail = body.sendEmail !== false;
      const hasActivationToggle = typeof body.sendActivationEmail === "boolean";
      const hasVerificationToggle = typeof body.sendVerificationEmail === "boolean";
      const sendActivationEmail = hasActivationToggle
        ? body.sendActivationEmail === true
        : sendEmail;
      const sendVerificationEmail = hasVerificationToggle
        ? body.sendVerificationEmail === true
        : sendEmail;

      const profileInput =
        body && typeof body.profile === "object" && body.profile ? (body.profile as any) : null;
      const legacyBusinessInput =
        body && typeof body.business === "object" && body.business ? (body.business as any) : null;
      const normalizeRoleTag = (value: string) => {
        const roleTag = String(value || "").trim();
        if (roleTag === "contractor_user") return "contractor";
        if (roleTag === "vehicle_dealer" || roleTag === "car_salesman") return "car_dealer";
        if (roleTag === "hoa_admin") return "hoa_board";
        if (roleTag === "helper") return "handyman";
        return roleTag;
      };
      const rawProvisionUserTypes = Array.isArray(body.userTypes)
        ? body.userTypes
        : Array.isArray(profileInput?.userTypes)
          ? profileInput.userTypes
          : [];
      const provisionUserTypes = Array.from(
        new Set(
          rawProvisionUserTypes
            .map((value: any) => normalizeRoleTag(String(value || "")))
            .filter((typeId: string) => {
              if (!typeId) return false;
              if (typeId === "admin" || BLOCKED_SELF_ASSIGN_ROLES.has(typeId)) return false;
              return Boolean(getUserTypeMetadata(typeId));
            })
        )
      );
      const rawBusinessTags = Array.isArray(body.businessTags)
        ? body.businessTags
        : Array.isArray(profileInput?.businessTags)
          ? profileInput.businessTags
          : [];
      const businessTags = Array.from(
        new Set(
          rawBusinessTags
            .map((value: any) => String(value || "").trim())
            .filter((value: string) => value.length > 0 && value.length <= 48)
        )
      );
      const rawProvisionTradeTags = Array.isArray(body.tradeTags)
        ? body.tradeTags
        : Array.isArray(profileInput?.tradeTags)
          ? profileInput.tradeTags
          : typeof body.tradeTags === "string"
            ? String(body.tradeTags)
                .split(",")
                .map((value) => value.trim())
            : typeof profileInput?.tradeTags === "string"
              ? String(profileInput.tradeTags)
                  .split(",")
                  .map((value) => value.trim())
              : [];
      const provisionTradeTags: string[] = Array.from(
        new Set(
          rawProvisionTradeTags
            .map((value: any) => String(value || "").trim())
            .filter((value: string) => value.length > 0)
        )
      );

      const legacyBusinessName =
        typeof legacyBusinessInput?.name === "string" ? legacyBusinessInput.name.trim() : "";
      const legacyBusinessPhone =
        typeof legacyBusinessInput?.phone === "string" ? legacyBusinessInput.phone.trim() : "";
      const legacyBusinessWebsite =
        typeof legacyBusinessInput?.website === "string" ? legacyBusinessInput.website.trim() : "";

      const createBusinessProfile = profileInput?.create === true || legacyBusinessName.length >= 2;
      const profileDisplayName =
        typeof profileInput?.displayName === "string"
          ? profileInput.displayName.trim()
          : legacyBusinessName;
      const profileRoleContext =
        typeof profileInput?.roleContext === "string" ? profileInput.roleContext.trim() : "";
      const profileHeadline =
        typeof profileInput?.headline === "string" ? profileInput.headline.trim() : "";
      const profileAbout = typeof profileInput?.about === "string" ? profileInput.about.trim() : "";
      const createBusinessRecord =
        profileInput?.createBusinessRecord === true || legacyBusinessName.length >= 2;
      const businessNameInput =
        typeof profileInput?.businessName === "string"
          ? profileInput.businessName.trim()
          : legacyBusinessName;
      const businessPhone =
        typeof profileInput?.businessPhone === "string"
          ? profileInput.businessPhone.trim()
          : legacyBusinessPhone;
      const businessWebsite =
        typeof profileInput?.businessWebsite === "string"
          ? profileInput.businessWebsite.trim()
          : legacyBusinessWebsite;
      const businessEmail =
        typeof profileInput?.businessEmail === "string" ? profileInput.businessEmail.trim() : "";
      const requestedProfileVisibilityRaw =
        typeof profileInput?.profileVisibility === "string"
          ? profileInput.profileVisibility.trim().toLowerCase()
          : typeof body.profileVisibility === "string"
            ? body.profileVisibility.trim().toLowerCase()
            : "";
      const requestedProfileVisibility: "public" | "private" | null = requestedProfileVisibilityRaw
        ? requestedProfileVisibilityRaw === "private"
          ? "private"
          : "public"
        : null;
      const requestedServicesDescription =
        typeof profileInput?.servicesDescription === "string"
          ? profileInput.servicesDescription.trim()
          : typeof body.servicesDescription === "string"
            ? body.servicesDescription.trim()
            : "";
      const rawProfileSections =
        profileInput && typeof profileInput?.profileSections === "object"
          ? profileInput.profileSections
          : body && typeof body.profileSections === "object"
            ? body.profileSections
            : null;
      const allowedProfileSectionKeys = new Set([
        "about",
        "rolesAndBadges",
        "stats",
        "services",
        "marketplaceListings",
        "reviews",
        "communityActivity",
        "contactCard",
      ]);
      const normalizedProfileSections: Record<string, boolean> = {};
      if (rawProfileSections && typeof rawProfileSections === "object") {
        for (const [key, value] of Object.entries(rawProfileSections)) {
          if (!allowedProfileSectionKeys.has(String(key))) continue;
          normalizedProfileSections[String(key)] = value !== false;
        }
      }

      const resolvedProvisionRole = (
        role || (createBusinessProfile ? "business_owner" : "")
      ).trim();

      if (profileRoleContext && (profileRoleContext.length < 2 || profileRoleContext.length > 64)) {
        return res.status(400).json({
          message: "profile.roleContext must be between 2 and 64 characters",
        });
      }

      if (profileHeadline && profileHeadline.length > 160) {
        return res.status(400).json({
          message: "profile.headline must be 160 characters or fewer",
        });
      }
      if (profileAbout && profileAbout.length > 5000) {
        return res.status(400).json({
          message: "profile.about must be 5000 characters or fewer",
        });
      }
      if (stateCode && stateCode.length !== 2) {
        return res.status(400).json({
          message: "stateCode must be 2 characters",
        });
      }
      if (countyFips && countyFips.length !== 5) {
        return res.status(400).json({
          message: "countyFips must be 5 characters",
        });
      }
      if (businessTags.length > 24) {
        return res.status(400).json({
          message: "businessTags supports up to 24 entries",
        });
      }
      if (requestedServicesDescription.length > 5000) {
        return res.status(400).json({
          message: "servicesDescription must be 5000 characters or fewer",
        });
      }
      if (provisionTradeTags.length > 40) {
        return res.status(400).json({
          message: "tradeTags supports up to 40 entries",
        });
      }
      if (provisionTradeTags.some((tag) => tag.length > 80)) {
        return res.status(400).json({
          message: "Each trade tag must be 80 characters or fewer",
        });
      }

      // Prevent accidental admin creation via this endpoint; use /api/admin/create-account instead.
      if (["moderator", "ops_admin", "super_admin"].includes(resolvedProvisionRole)) {
        return res.status(400).json({
          message:
            "Admin roles must be created via the dedicated admin creation flow (not user provisioning).",
        });
      }

      const resolvedProvisionTradeTags =
        provisionTradeTags.length > 0
          ? await resolveOrCreateTradeTagSlugs(provisionTradeTags)
          : { slugs: [], created: [] };

      let user = await storage.getUserByEmail(email);
      const created = !user;

      if (!user) {
        const passwordHash = password ? await hashPassword(password) : undefined;
        const initialPreferences: Record<string, unknown> = {};
        if (provisionUserTypes.length > 0) {
          initialPreferences.provisional = {
            userTypes: provisionUserTypes,
            capturedAt: new Date().toISOString(),
          };
        }
        if (requestedProfileVisibility) {
          initialPreferences.profileVisibility = requestedProfileVisibility;
        }
        if (requestedServicesDescription) {
          initialPreferences.servicesDescription = requestedServicesDescription;
        }
        if (Object.keys(normalizedProfileSections).length > 0) {
          initialPreferences.profileSections = normalizedProfileSections;
        }
        if (resolvedProvisionTradeTags.slugs.length > 0) {
          initialPreferences.tradeTags = resolvedProvisionTradeTags.slugs;
        }

        user = await storage.createUser({
          email,
          password: passwordHash,
          firstName,
          lastName,
          phone: phone || undefined,
          city: city || undefined,
          stateCode: stateCode || undefined,
          countyFips: countyFips || undefined,
          preferences: initialPreferences,
          role: (resolvedProvisionRole || null) as any,
          roles: resolvedProvisionRole ? [resolvedProvisionRole] : undefined,
          activeRole: resolvedProvisionRole || undefined,
          emailVerified: false,
          addressVerified: false,
        } as any);
      } else {
        const patch: any = {};
        if (firstName) patch.firstName = firstName;
        if (lastName) patch.lastName = lastName;
        if (phone) patch.phone = phone;
        if (city) patch.city = city;
        if (stateCode) patch.stateCode = stateCode;
        if (countyFips) patch.countyFips = countyFips;
        if (provisionUserTypes.length > 0) {
          const currentPreferences = ((user as any).preferences || {}) as Record<string, any>;
          const currentProvisional = (currentPreferences.provisional || {}) as Record<string, any>;
          const existingUserTypes = Array.isArray(currentProvisional.userTypes)
            ? currentProvisional.userTypes
            : [];
          patch.preferences = {
            ...currentPreferences,
            provisional: {
              ...currentProvisional,
              userTypes: dedupeStrings([...existingUserTypes, ...provisionUserTypes]),
              capturedAt: new Date().toISOString(),
            },
          };
        }
        if (requestedProfileVisibility) {
          const currentPreferences = (patch.preferences ||
            (user as any).preferences ||
            {} ||
            {}) as Record<string, any>;
          patch.preferences = {
            ...currentPreferences,
            profileVisibility: requestedProfileVisibility,
          };
        }
        if (requestedServicesDescription) {
          const currentPreferences = (patch.preferences ||
            (user as any).preferences ||
            {} ||
            {}) as Record<string, any>;
          patch.preferences = {
            ...currentPreferences,
            servicesDescription: requestedServicesDescription,
          };
        }
        if (Object.keys(normalizedProfileSections).length > 0) {
          const currentPreferences = (patch.preferences ||
            (user as any).preferences ||
            {} ||
            {}) as Record<string, any>;
          const existingSections =
            currentPreferences.profileSections &&
            typeof currentPreferences.profileSections === "object"
              ? currentPreferences.profileSections
              : {};
          patch.preferences = {
            ...currentPreferences,
            profileSections: {
              ...existingSections,
              ...normalizedProfileSections,
            },
          };
        }
        if (resolvedProvisionTradeTags.slugs.length > 0) {
          const currentPreferences = (patch.preferences ||
            (user as any).preferences ||
            {} ||
            {}) as Record<string, any>;
          const existingTradeTags = Array.isArray(currentPreferences.tradeTags)
            ? (currentPreferences.tradeTags as string[]).map((value) => String(value || ""))
            : [];
          patch.preferences = {
            ...currentPreferences,
            tradeTags: dedupeStrings([...existingTradeTags, ...resolvedProvisionTradeTags.slugs]),
          };
        }
        if (resolvedProvisionRole) {
          const currentRoles: string[] = Array.isArray((user as any).roles)
            ? ((user as any).roles as string[]).filter(Boolean)
            : [];
          const nextRoles = Array.from(new Set([...currentRoles, resolvedProvisionRole]));
          if (nextRoles.length !== currentRoles.length) {
            patch.roles = nextRoles;
          }
          if (!(user as any).role) {
            patch.role = resolvedProvisionRole;
          }
          if (!(user as any).activeRole) {
            patch.activeRole = resolvedProvisionRole;
          }
        }
        if (password) patch.password = await hashPassword(password);
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date();
          user = (await storage.updateUser(user.id, patch)) || user;
        }
      }

      if (resolvedProvisionTradeTags.slugs.length > 0) {
        const existingDeclaration = await storage.getProviderDeclarationForUser(user.id);
        const existingTradeIds = Array.isArray((existingDeclaration as any)?.tradeIds)
          ? ((existingDeclaration as any).tradeIds as string[]).filter(Boolean)
          : [];
        const mergedTradeIds = Array.from(
          new Set([...existingTradeIds, ...resolvedProvisionTradeTags.slugs])
        );

        const existingAreasRaw = Array.isArray((existingDeclaration as any)?.serviceAreas)
          ? ((existingDeclaration as any).serviceAreas as Array<{ countyFips?: string }>)
          : [];
        const existingCountyFips = existingAreasRaw
          .map((area) => String(area?.countyFips || "").trim())
          .filter((value) => /^\d{5}$/.test(value));
        const mergedCountyFips = Array.from(
          new Set([
            ...existingCountyFips,
            ...(countyFips && /^\d{5}$/.test(countyFips) ? [countyFips] : []),
          ])
        );

        const legalEligibilities = await getComputedProviderEligibilitiesForUser(user.id);
        const ineligibleCounties: Array<{
          countyFips: string;
          countyName: string;
          stateCode: string;
        }> = [];
        for (const county of mergedCountyFips) {
          const countyRecord = await storage.getCountyByFips(county);
          if (!countyRecord) continue;
          const legalDecision = getEligibilityDecisionForCounty(legalEligibilities, {
            fips: countyRecord.fips,
            stateCode: countyRecord.stateCode,
          });
          if (!legalDecision.eligible) {
            ineligibleCounties.push({
              countyFips: countyRecord.fips,
              countyName: countyRecord.name,
              stateCode: countyRecord.stateCode,
            });
          }
        }

        if (ineligibleCounties.length > 0) {
          return res.status(428).json({
            message: "Verified legal eligibility is required before assigning provider counties.",
            code: "ELIGIBILITY_REQUIRED",
            blockedServiceAreas: ineligibleCounties,
          });
        }

        await storage.upsertProviderDeclarationForUser({
          userId: user.id,
          tradeIds: mergedTradeIds,
          serviceAreas: mergedCountyFips.map((county) => ({ countyFips: county })),
          availabilityFlags:
            (existingDeclaration as any)?.availabilityFlags &&
            typeof (existingDeclaration as any).availabilityFlags === "object"
              ? ((existingDeclaration as any).availabilityFlags as any)
              : undefined,
        });
      }

      let provisionedProfile: any = null;
      let createdProfile = false;
      let provisionedBusiness: any = null;

      if (createBusinessProfile) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        const defaultDisplayName =
          profileDisplayName ||
          businessNameInput ||
          fullName ||
          String(user.email || "TradeScout Business").split("@")[0];

        const resolvedDisplayName = String(defaultDisplayName || "TradeScout Business").trim();
        if (resolvedDisplayName.length < 2) {
          return res.status(400).json({
            message: "profile.displayName must be at least 2 characters",
          });
        }

        const resolvedRoleContext = profileRoleContext || role || "business_owner";
        const existingProfiles = await storage.listProfilesByOwner(user.id);

        if (existingProfiles.length > 0) {
          provisionedProfile = existingProfiles[0];
        } else {
          if (createBusinessRecord) {
            const resolvedBusinessName = (businessNameInput || resolvedDisplayName).trim();
            if (resolvedBusinessName.length < 2) {
              return res.status(400).json({
                message: "profile.businessName must be at least 2 characters",
              });
            }

            provisionedBusiness = await storage.createBusinessForOwner(user.id, {
              name: resolvedBusinessName,
              slug: resolvedBusinessName,
              type: "other" as any,
              roleContext: resolvedRoleContext as any,
              profileData: {
                description: profileAbout || profileHeadline || undefined,
                phone: businessPhone || undefined,
                website: businessWebsite || undefined,
                email: businessEmail || user.email,
                city: city || undefined,
                stateCode: stateCode || undefined,
                services: businessTags.length > 0 ? businessTags : undefined,
                category: businessTags[0] || undefined,
              } as any,
              status: "active" as any,
              countyIds: [],
            });

            await storage.setUserActiveBusiness(user.id, provisionedBusiness.id);
          }

          provisionedProfile = await storage.createProfileForOwner(user.id, {
            businessId: provisionedBusiness?.id || undefined,
            roleContext: resolvedRoleContext as any,
            slug: resolvedDisplayName,
            displayName: resolvedDisplayName,
            headline: profileHeadline || null,
            contentBlocks: profileAbout
              ? [
                  {
                    type: "about",
                    data: { text: profileAbout },
                  },
                ]
              : [],
            ctaConfig: {},
            seoMeta: profileAbout
              ? {
                  description: profileAbout.slice(0, 300),
                }
              : {},
            status: "published" as any,
          } as any);

          createdProfile = true;
        }

        if (provisionedProfile?.id) {
          await storage.setUserActiveProfile(user.id, provisionedProfile.id);
        }
      }

      const emailVerificationRequired = await getGeneralSetting<boolean>(
        "email_verification_required",
        true
      );
      const publicBase = getPublicBaseUrlFromRequest(req as any).replace(/\/$/, "");

      const debug: any = {};
      let resetLink: string | null = null;
      let verifyLink: string | null = null;

      // Only include a set-password link if this account has no password set.
      if (!user.password) {
        const { token } = await passwordResetService.createToken(user.id);
        resetLink = `${publicBase}/reset-password?token=${token}`;
      }

      if (emailVerificationRequired && user.emailVerified !== true) {
        const verify = await emailVerificationService.createToken(user.id);
        verifyLink = `${publicBase}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
      }

      let emailSent = false;
      if (sendActivationEmail || sendVerificationEmail) {
        const canSend = emailService.isConfigured();
        if (canSend) {
          const parts: string[] = [];
          parts.push(`<p>Your TradeScout account is ready.</p>`);
          if (resetLink && sendActivationEmail) {
            parts.push(`<p><a href="${resetLink}">Set your password</a>.</p>`);
          }
          if (verifyLink && sendVerificationEmail) {
            parts.push(`<p><a href="${verifyLink}">Verify your email</a> (required).</p>`);
          }
          parts.push(`<p>If you did not request this, you can ignore this email.</p>`);

          await emailService.sendEmail({
            to: email,
            subject: "Set up your TradeScout account",
            html: parts.join("\n"),
            text: [
              resetLink && sendActivationEmail ? `Set password: ${resetLink}` : null,
              verifyLink && sendVerificationEmail ? `Verify email: ${verifyLink}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            purpose: "account_creation",
          });
          emailSent = true;
        } else if (process.env.NODE_ENV !== "production") {
          if (resetLink && sendActivationEmail) debug.activationLink = resetLink;
          if (verifyLink && sendVerificationEmail) debug.verifyLink = verifyLink;
        }
      }

      return res.json({
        ok: true,
        status: created ? "created" : "existing",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        emailSent,
        activationLinkIncluded: Boolean(resetLink && sendActivationEmail),
        verifyLinkIncluded: Boolean(verifyLink && sendVerificationEmail),
        profileProvisioned: Boolean(provisionedProfile),
        profileCreated: createdProfile,
        profileId: provisionedProfile?.id || null,
        profileSlug: provisionedProfile?.slug || null,
        businessId: provisionedBusiness?.id || null,
        businessSlug: provisionedBusiness?.slug || null,
        provisionUserTypes,
        businessTags,
        resolvedTradeTags: resolvedProvisionTradeTags.slugs,
        createdTradeTags: resolvedProvisionTradeTags.created,
        ...debug,
      });
    } catch (error: any) {
      console.error("Error provisioning user:", error);
      return res.status(500).json({
        message: "Failed to provision user",
        requestId: (req as any).requestId || null,
      });
    }
  });

  // Admin: attach or create a business + public profile site for an existing user.
  // This is the "manual setup for success" path when admins need full control over public presence.
  app.post(
    "/api/admin/users/public-presence/provision",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const body = (req.body ?? {}) as any;
        const targetUserIdInput = String(body.targetUserId || "")
          .trim()
          .toLowerCase();
        const targetEmailInput = String(body.targetEmail || "")
          .trim()
          .toLowerCase();
        const reason = normalizePrivilegedReason(body?.adminSafety?.reason, 12);
        const confirmPhrase = String(body?.adminSafety?.confirmPhrase || "").trim();
        const safetyKey = String(body?.adminSafety?.safetyKey || "").trim();

        if (!targetUserIdInput && !targetEmailInput) {
          return res.status(400).json({ message: "targetUserId or targetEmail is required" });
        }
        if (!reason) {
          return res.status(400).json({ message: "adminSafety.reason is required (min 12 chars)" });
        }
        if (confirmPhrase !== ADMIN_SUPPORT_CONFIRM_PHRASE) {
          return res.status(400).json({
            message: `adminSafety.confirmPhrase must be exactly: ${ADMIN_SUPPORT_CONFIRM_PHRASE}`,
          });
        }

        const safety = validateAdminWriteSafety(
          {
            adminSafety: {
              reason,
              confirmPhrase,
              safetyKey: safetyKey || undefined,
            },
          },
          req.headers as any
        );
        if (!safety.ok) {
          return res.status(403).json({ message: safety.message });
        }

        const actorId = String(req?.user?.id || req?.user?.claims?.sub || "").trim();
        const actor = actorId ? await storage.getUser(actorId) : null;
        if (!actor) return res.status(401).json({ message: "Unauthorized" });

        const targetUser = targetUserIdInput
          ? await storage.getUser(targetUserIdInput)
          : await storage.getUserByEmail(targetEmailInput);
        if (!targetUser) return res.status(404).json({ message: "Target user not found" });

        const targetProtected = isProtectedAdminUser(targetUser);
        if (targetProtected && !isSuperAdminUser(actor)) {
          return res
            .status(403)
            .json({ message: "Only super admins can edit protected admin users" });
        }

        const normalizeSlug = (value: string) =>
          String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 120);

        const ensureUniqueProfileSlug = async (baseRaw: string): Promise<string> => {
          const base = normalizeSlug(baseRaw) || `profile-${String(targetUser!.id).slice(0, 8)}`;
          let candidate = base;
          for (let i = 0; i < 50; i++) {
            const existing = await db
              .select({ id: profiles.id, ownerUserId: profiles.ownerUserId })
              .from(profiles)
              .where(eq(profiles.slug, candidate))
              .limit(1);
            if (!existing[0] || String(existing[0].ownerUserId || "") === String(targetUser!.id)) {
              return candidate;
            }
            candidate = `${base}-${i + 2}`;
          }
          return `${base}-${randomUUID().slice(0, 8)}`;
        };

        const presenceInput = body && typeof body === "object" ? (body.presence ?? {}) : {};
        const businessInput =
          presenceInput && typeof presenceInput.business === "object" ? presenceInput.business : {};
        const profileInput =
          presenceInput && typeof presenceInput.profile === "object" ? presenceInput.profile : {};
        const allowReassign = presenceInput?.allowReassign === true;
        const makeProfilePublic = presenceInput?.makeProfilePublic !== false;

        const businessIdInput = String(businessInput?.businessId || "").trim();
        const businessSlugInput = String(businessInput?.businessSlug || "").trim();
        const businessNameInput = String(businessInput?.name || "").trim();
        const businessPhoneInput = String(businessInput?.phone || "").trim();
        const businessEmailInput = String(businessInput?.email || "")
          .trim()
          .toLowerCase();
        const businessWebsiteInput = String(businessInput?.website || "").trim();
        const businessDescriptionInput = String(businessInput?.description || "").trim();
        const businessCategoryInput = String(businessInput?.category || "").trim();
        const businessCityInput = String(businessInput?.city || "").trim();
        const businessStateCodeInput = String(
          businessInput?.stateCode || targetUser.stateCode || ""
        )
          .trim()
          .toUpperCase();
        const businessZipInput = String(businessInput?.zipCode || "").trim();
        const businessAddressInput = String(businessInput?.address || "").trim();
        const businessRoleContextInput = String(
          businessInput?.roleContext || targetUser.activeRole || targetUser.role || "business_owner"
        ).trim();
        const businessTagsInput = Array.isArray(businessInput?.services)
          ? (businessInput.services as any[])
              .map((v) => String(v || "").trim())
              .filter((v) => v.length > 0)
              .slice(0, 40)
          : [];

        const countyFipsInput = String(
          businessInput?.countyFips || targetUser.countyFips || ""
        ).trim();
        if (countyFipsInput && !/^\d{5}$/.test(countyFipsInput)) {
          return res
            .status(400)
            .json({ message: "business.countyFips must be a 5-digit FIPS code" });
        }

        let countyIds: string[] = [];
        if (countyFipsInput) {
          const countyRow = await db
            .select({ id: counties.id })
            .from(counties)
            .where(eq(counties.fips, countyFipsInput))
            .limit(1);
          if (countyRow[0]?.id) countyIds = [String(countyRow[0].id)];
        }

        let provisionedBusiness: any = null;
        if (businessIdInput || businessSlugInput) {
          const existingBusiness = businessIdInput
            ? (
                await db
                  .select()
                  .from(businesses)
                  .where(eq(businesses.id, businessIdInput))
                  .limit(1)
              )[0]
            : (
                await db
                  .select()
                  .from(businesses)
                  .where(eq(businesses.slug, businessSlugInput))
                  .limit(1)
              )[0];

          if (!existingBusiness) {
            return res.status(404).json({ message: "Business not found for provided id/slug" });
          }

          const currentOwnerId = String(existingBusiness.ownerUserId || "").trim();
          if (currentOwnerId && currentOwnerId !== String(targetUser.id) && !allowReassign) {
            return res.status(409).json({
              message:
                "Business is owned by another user. Set allowReassign=true to transfer ownership.",
            });
          }

          const mergedProfileData = {
            ...((existingBusiness.profileData as any) || {}),
            ...(businessDescriptionInput ? { description: businessDescriptionInput } : {}),
            ...(businessCategoryInput ? { category: businessCategoryInput } : {}),
            ...(businessTagsInput.length > 0 ? { services: businessTagsInput } : {}),
            ...(businessWebsiteInput ? { website: businessWebsiteInput } : {}),
            ...(businessPhoneInput ? { phone: businessPhoneInput } : {}),
            ...(businessEmailInput ? { email: businessEmailInput } : {}),
            ...(businessAddressInput ? { address: businessAddressInput } : {}),
            ...(businessCityInput ? { city: businessCityInput } : {}),
            ...(businessStateCodeInput ? { stateCode: businessStateCodeInput } : {}),
            ...(businessZipInput ? { zipCode: businessZipInput } : {}),
          };

          const updatedRows = await db
            .update(businesses)
            .set({
              ownerUserId: targetUser.id,
              claimStatus: "claimed",
              status: "active",
              roleContext: businessRoleContextInput as any,
              name: businessNameInput || existingBusiness.name,
              profileData: mergedProfileData as any,
              updatedAt: new Date(),
            } as any)
            .where(eq(businesses.id, existingBusiness.id))
            .returning();

          provisionedBusiness = updatedRows[0] || existingBusiness;
          if (countyIds.length > 0) {
            await db
              .delete(businessCounties)
              .where(eq(businessCounties.businessId, provisionedBusiness.id));
            await db
              .insert(businessCounties)
              .values(
                countyIds.map((countyId) => ({ businessId: provisionedBusiness.id, countyId }))
              );
          }
        } else {
          const createName =
            businessNameInput ||
            profileInput?.displayName ||
            `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim();
          if (!createName || String(createName).trim().length < 2) {
            return res.status(400).json({
              message: "business.name (or profile.displayName) is required to create a business",
            });
          }

          provisionedBusiness = await storage.createBusinessForOwner(String(targetUser.id), {
            name: String(createName).trim(),
            slug: normalizeSlug(String(createName)),
            type: "other" as any,
            roleContext: businessRoleContextInput as any,
            profileData: {
              ...(businessDescriptionInput ? { description: businessDescriptionInput } : {}),
              ...(businessCategoryInput ? { category: businessCategoryInput } : {}),
              ...(businessTagsInput.length > 0 ? { services: businessTagsInput } : {}),
              ...(businessWebsiteInput ? { website: businessWebsiteInput } : {}),
              ...(businessPhoneInput ? { phone: businessPhoneInput } : {}),
              ...(businessEmailInput ? { email: businessEmailInput } : {}),
              ...(businessAddressInput ? { address: businessAddressInput } : {}),
              ...(businessCityInput ? { city: businessCityInput } : {}),
              ...(businessStateCodeInput ? { stateCode: businessStateCodeInput } : {}),
              ...(businessZipInput ? { zipCode: businessZipInput } : {}),
            } as any,
            status: "active" as any,
            publicDiscoveryEnabled: true,
            countyIds,
            sources: ["admin_provision"],
          } as any);
        }

        await storage.setUserActiveBusiness(String(targetUser.id), String(provisionedBusiness.id));

        const profileDisplayName = String(
          profileInput?.displayName || provisionedBusiness.name || "TradeScout Profile"
        ).trim();
        const profileHeadline = String(profileInput?.headline || "").trim();
        const profileAbout = String(profileInput?.about || businessDescriptionInput || "").trim();
        const seoTitleInput = String(profileInput?.seoTitle || "").trim();
        const seoDescriptionInput = String(profileInput?.seoDescription || "").trim();
        const ctaPrimaryLabel = String(profileInput?.ctaPrimaryLabel || "").trim();
        const ctaPrimaryKind = String(profileInput?.ctaPrimaryKind || "")
          .trim()
          .toLowerCase();
        const ctaPrimaryValue = String(profileInput?.ctaPrimaryValue || "").trim();

        const roleContext = String(
          profileInput?.roleContext ||
            businessRoleContextInput ||
            targetUser.activeRole ||
            targetUser.role
        ).trim();

        const contentBlocks: Array<{ type: string; data: Record<string, any> }> = [];
        if (profileAbout) {
          contentBlocks.push({ type: "about", data: { text: profileAbout } });
        }
        if (businessTagsInput.length > 0) {
          contentBlocks.push({ type: "services", data: { items: businessTagsInput } });
        }

        const ctaConfig: Record<string, any> = {};
        if (ctaPrimaryLabel && ctaPrimaryValue) {
          const kind =
            ctaPrimaryKind === "call" ||
            ctaPrimaryKind === "email" ||
            ctaPrimaryKind === "message" ||
            ctaPrimaryKind === "link"
              ? ctaPrimaryKind
              : "message";
          ctaConfig.primary = {
            label: ctaPrimaryLabel,
            kind,
            value: ctaPrimaryValue,
          };
        }

        const seoMeta: Record<string, any> = {};
        if (seoTitleInput) seoMeta.title = seoTitleInput;
        if (seoDescriptionInput) seoMeta.description = seoDescriptionInput;
        if (!seoMeta.description && profileAbout) seoMeta.description = profileAbout.slice(0, 300);

        const ownerProfiles = await storage.listProfilesByOwner(String(targetUser.id));
        const requestedProfileId = String(profileInput?.profileId || "").trim();
        let targetProfile =
          (requestedProfileId &&
            ownerProfiles.find((p: any) => String(p?.id) === requestedProfileId)) ||
          ownerProfiles.find(
            (p: any) => String(p?.id) === String((targetUser as any)?.activeProfileId || "")
          ) ||
          ownerProfiles[0];

        let profileCreated = false;
        if (!targetProfile) {
          const requestedSlugRaw = String(profileInput?.slug || profileDisplayName || "").trim();
          const safeSlug = await ensureUniqueProfileSlug(requestedSlugRaw);
          targetProfile = await storage.createProfileForOwner(String(targetUser.id), {
            businessId: String(provisionedBusiness.id),
            roleContext: roleContext as any,
            slug: safeSlug,
            displayName: profileDisplayName || provisionedBusiness.name || "TradeScout Profile",
            headline: profileHeadline || null,
            contentBlocks: contentBlocks as any,
            ctaConfig: ctaConfig as any,
            seoMeta: seoMeta as any,
            status: "published" as any,
          } as any);
          profileCreated = true;
        } else {
          const profileUpdates: Record<string, any> = {
            businessId: String(provisionedBusiness.id),
            roleContext: roleContext as any,
          };
          if (profileDisplayName) profileUpdates.displayName = profileDisplayName;
          if (profileHeadline) profileUpdates.headline = profileHeadline;
          if (contentBlocks.length > 0) profileUpdates.contentBlocks = contentBlocks;
          if (Object.keys(ctaConfig).length > 0) profileUpdates.ctaConfig = ctaConfig;
          if (Object.keys(seoMeta).length > 0) profileUpdates.seoMeta = seoMeta;
          if (String(targetProfile.status || "").toLowerCase() !== "published") {
            profileUpdates.status = "published";
          }
          targetProfile = await storage.updateProfileForOwner(
            String(targetUser.id),
            String(targetProfile.id),
            profileUpdates as any
          );
        }

        await storage.setUserActiveProfile(String(targetUser.id), String(targetProfile.id));

        const currentPreferences =
          targetUser.preferences && typeof targetUser.preferences === "object"
            ? (targetUser.preferences as Record<string, unknown>)
            : {};
        const nextPreferences: Record<string, unknown> = { ...currentPreferences };
        if (makeProfilePublic) nextPreferences.profileVisibility = "public";
        if (profileAbout) nextPreferences.servicesDescription = profileAbout;

        await storage.updateUser(String(targetUser.id), {
          businessSlug: String(provisionedBusiness.slug || "").trim() || null,
          preferences: nextPreferences as any,
          updatedAt: new Date(),
        } as any);

        await auditPrivilegedAction({
          action: "admin_user_public_presence_provision",
          route: "/api/admin/users/public-presence/provision",
          operationType: "provision_user_public_presence",
          actorId: normalizeImmutableTargetId(actorId),
          actorRole: resolvePrivilegedActor(actor).actorRole,
          actorRoles: resolvePrivilegedActor(actor).actorRoles,
          targetType: "user",
          targetId: String(targetUser.id),
          resolutionSource: targetUserIdInput ? "body:target_user_id" : "body:target_email",
          reason,
          outcome: "completed",
          details: {
            profileCreated,
            businessId: String(provisionedBusiness.id || ""),
            profileId: String(targetProfile.id || ""),
            allowReassign,
            makeProfilePublic,
            protectedTarget: targetProtected,
          },
        });

        return res.json({
          ok: true,
          message: "Public presence provisioned",
          user: {
            id: String(targetUser.id),
            email: String(targetUser.email || ""),
          },
          business: {
            id: String(provisionedBusiness.id || ""),
            slug: String(provisionedBusiness.slug || ""),
            name: String(provisionedBusiness.name || ""),
            url: `/business/${encodeURIComponent(String(provisionedBusiness.slug || ""))}`,
          },
          profile: {
            id: String(targetProfile.id || ""),
            slug: String(targetProfile.slug || ""),
            displayName: String(targetProfile.displayName || ""),
            created: profileCreated,
            url: `/u/${encodeURIComponent(String(targetProfile.slug || ""))}`,
          },
        });
      } catch (error: any) {
        console.error("Error provisioning admin public presence:", error);
        return res.status(500).json({
          message: "Failed to provision public presence",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
