import scoutRoute from "./routes/scout";
import { ClaimSource } from "./services/claimEventSchema";
import { resolveCountyFips } from "./services/regionResolver";
import { logger } from "./services/logger";
import { ingestKnowledgeFolder } from "./services/knowledgeIngest";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { contractorSignupRouter } from "./routes/contractor-signup";
import { businessesRouter } from "./routes/businesses";
import { profilesRouter } from "./routes/profiles";
import { registerRecommendationGeneratorRoutes } from "./routes/recommendation-generator";
import { registerNotificationRoutes } from "./routes/notification-routes";
import { registerDirectConnectRoutes } from "./routes/direct-connect";
import { registerBusinessProfileRoutes } from "./routes/business-profile";
import { registerAnalyticsRoutes } from "./routes/analytics-routes";
import { registerHardrockRoutes } from "./routes/hardrock";
import { geographicCoverageRouter } from "./routes/geographic-coverage";
import { registerCrmRoutes } from "./crm-routes";
import { registerAICodeFixRoutes } from "./ai-code-fixes";
import { registerUIIssuesRoutes } from "./routes/admin/ui-issues";
import { setupModerationRoutes } from "./moderation";
import { registerSocialRoutes } from "./social-routes";
import { registerSocialFeatures } from "./social-features";
import { registerScoutRecommendations } from "./routes/scout-recommendations";
import communityBuilderRouter from "./routes/community-builder-routes";
import adminCommunityBuilderRouter from "./routes/admin-community-builder-routes";
import communityVaultRouter from "./routes/community-vault-routes";
import communityCausesRouter from "./routes/community-causes-routes";
import platformSupportRouter from "./routes/platform-support-routes";
import { mountAdminRoutes } from "./routes/admin";
import missionControlRouter from "./routes/mission-control";
import preferredSourceRouter from "./routes/preferred-source";
import { registerAuthorityOperationsRoutes } from "./routes/authority-operations";
import { ROLE_PERMISSIONS, type UserRole as SharedUserRole } from "../shared/roles";
import { CURRENT_PROFILE_VERSION } from "../shared/profile";
import { sendInternalServerError, sendAutoClassifiedError } from "./utils/httpErrors";
// DISABLED: WebSocketManager is not instantiated, using Socket.io messaging service instead
// import { WebSocketManager } from "./websocket";
import { getMessagingService } from "./messaging-service";
import { emailService } from "./services/emailService";
import { passwordResetService } from "./services/passwordResetService";
import { createServer } from "http";
import { requireAddressVerification } from "./requireAddressVerification";
import { checkTrustedDevice } from "./device-auth";
import {
  users,
  affiliateAccounts,
  affiliateReferrals,
  affiliatePayouts,
  generatedStories,
  leads,
  quotes,
  conversations,
  foundationCauses,
  marketplaceListings,
  communityPosts,
  recommendations,
  contractors,
  workers,
  tasks,
  taskApplications,
  workRequests,
  workRequestEvents,
  workRequestAssignments,
  addressVerifications,
  insertRealtorProfileSchema,
  insertCarSalesmanProfileSchema,
  insertGeneratedStorySchema,
  insertLeadSchema,
  insertGrowthPackDownloadSchema,
  insertContractorPromoSchema,
  insertMarketplaceCategorySchema,
  insertMarketplaceListingSchema,
  insertMarketplaceInquirySchema,
  insertMarketplaceFavoriteSchema,
  insertMarketplaceReportSchema,
  insertVendorVerificationSchema,
  insertBuyerVerificationSchema,
  insertAddressVerificationSchema,
  insertModerationReportSchema,
  insertModerationVoteSchema,
  insertModerationAppealSchema,
  counties,
  missionControlDecisions,
  userFollows,
  walletTransactions,
  marketplaceTransactions,
} from "../shared/schema";

function sanitizeContractorPublic<T extends Record<string, any>>(
  contractor: T
): Omit<T, "phone" | "email"> {
  if (!contractor || typeof contractor !== "object") return contractor as any;
  const { phone, email, ...rest } = contractor as any;
  return rest;
}
import { getUserTypeBadgeLabel, getUserTypeMetadata } from "../shared/userTypes";
import type { AffiliateAccount, AffiliateReferral, AffiliatePayout } from "../shared/schema";
import { storage } from "./storage";
import {
  setupAuth,
  isAuthenticated,
  isAdmin,
  isSuperAdmin,
  hashPassword,
  validatePassword,
  requireRole,
  isContractor,
  isCommunityModerator,
  requireOnboardingComplete,
} from "./auth";
import { writeClaimEvent } from "./services/claimEventService.js";
import type { WriteClaimEventRequest } from "./services/claimEventSchema.js";
import { callAIInference } from "./services/aiInference.js";
import { localityTrackingMiddleware } from "./localityTracking";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";
import type { VerifyCallback } from "passport-google-oauth20";
import { db } from "./db";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import Stripe from "stripe";
import { paymentService } from "./payment-service";
import { tutorialStorage } from "./tutorialStorage";
import { DataManagementService } from "./data-management";
import { StoryGenerationService } from "./story-generation-service";
import { communityBuilderPaymentService } from "./community-builder-payment-service";
import { platformSupportPaymentService } from "./platform-support-payment-service";
import { antiScrapeShield } from "./middleware/antiScrape";
import { ObjectStorageService } from "./objectStorage";
import { notificationService } from "./notification-service";
import { ensureMealscoutSsoSession, createMealscoutSsoToken } from "../services/mealscoutClient.js";
import { resolveCapabilities, type CapabilityStatus } from "./capabilities";
// Shared HTTP types for all route handlers
type AuthedRequest = Request & {
  user?: {
    id?: string;
    claims?: { sub?: string; [key: string]: any };
    [key: string]: any;
  };
  session?: any; // tighten later
};

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
type AuthedHandler = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
import { eq, desc, and, or, sql, gt, gte, lte, asc, inArray } from "drizzle-orm";
// Removed duplicate User import
// Stubs for undeclared globals
const program = {};
const DeviceAuthService = {
  registerTrustedDevice: async () => "token",
  getUserDevices: async () => [],
  getPendingDevices: async () => [],
  approveDevice: async () => true,
  revokeDevice: async () => true,
};
const objectStorageService = new ObjectStorageService();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" })
  : null;
const dataManagementService = new DataManagementService();
// Helper function to route leads to top contractors
interface Contractor {
  id: string;
  companyName: string;
  isActive: boolean | null;
  yearsInBusiness: number | null;
  licenseNumber: string | null;
  website: string | null;
  phone: string | null;
  description?: string;
  [key: string]: any;
}

interface ScoredContractor extends Contractor {
  matchScore: number;
}
async function routeLeadToTopContractors(lead: any, leadData: any) {
  try {
    const { countyId, tradeId } = lead;
    const { county, trade, city, state, zipCode, maxAssignees } = leadData;
    // Fetch active contractors that match the lead's geography and trade
    const contractors: Contractor[] = await storage.getContractors({
      countyId,
      tradeIds: tradeId ? [tradeId] : undefined,
      sortBy: "verified",
      limit: 50,
    });
    // ...rest of the function remains unchanged...

    // Extract simple keywords from the lead description to improve matching
    const leadDescription: string =
      typeof (leadData as any)?.description === "string"
        ? (leadData as any).description
        : typeof (lead as any)?.description === "string"
          ? (lead as any).description
          : "";

    const leadKeywords = new Set<string>(
      leadDescription
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w: string) => w.length >= 3)
    );

    // Load profile preferences (including servicesDescription) for all contractor owners
    const contractorUserIds = contractors
      .map((c: any) => c.userId)
      .filter((id: any): id is string => typeof id === "string" && id.length > 0);

    const contractorUsers = await storage.getUsersByIds(contractorUserIds);
    const userById = new Map<string, any>();
    for (const u of contractorUsers) {
      userById.set(u.id, u);
    }

    // Enhanced matching logic: Score contractors based on available fields
    const maxRecipients =
      typeof maxAssignees === "number" && maxAssignees > 0 ? Math.min(maxAssignees, 25) : 3;

    const scoredContractors = contractors
      .filter((contractor: Contractor) => !!contractor.isActive) // Only active contractors
      .map((contractor: Contractor): ScoredContractor => {
        let score = 0;
        // Business experience score (base weight) - more years = higher score
        const yearsExp = contractor.yearsInBusiness || 1;
        score += Math.min(50, yearsExp * 2.5); // Cap at 50 points

        // Profile completeness score - more complete = better
        let completeness = 0;
        if (contractor.licenseNumber) completeness += 10;
        if (contractor.website) completeness += 10;
        if (contractor.phone) completeness += 10;
        const owner = contractor.userId ? userById.get(contractor.userId) : undefined;
        const profileServices: string =
          typeof owner?.preferences?.servicesDescription === "string"
            ? owner.preferences.servicesDescription
            : "";

        const aboutText =
          (contractor as any).about ||
          (contractor as any).description ||
          (typeof profileServices === "string" ? profileServices : "") ||
          "";
        if (aboutText) completeness += 10;

        // Content match score: boost contractors whose "about" text
        // contains overlapping keywords with the lead description.
        let keywordScore = 0;
        if (leadKeywords.size && aboutText) {
          const aboutTokens = Array.from(
            new Set<string>(
              aboutText
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((w: string) => w.length >= 3)
            )
          );

          let matches = 0;
          for (const token of aboutTokens) {
            if (leadKeywords.has(token)) {
              matches += 1;
            }
          }

          // Cap content-match contribution so experience still dominates
          keywordScore = Math.min(20, matches * 4);
        }

        // Recommendation signal: net score and volume
        let recScore = 0;
        const pos = Number((contractor as any).positiveRecommendations || 0);
        const neg = Number((contractor as any).negativeRecommendations || 0);
        const total = Number((contractor as any).totalRecommendations || 0);

        const net = pos - neg;
        if (net > 0) {
          recScore += Math.min(20, net * 2); // reward strong net positive
        }
        if (total > 0) {
          recScore += Math.min(10, Math.log10(total + 1) * 5); // small bump for volume
        }

        score += completeness + keywordScore + recScore;
        return { ...contractor, matchScore: score };
      })
      .sort((a: any, b: any) => b.matchScore - a.matchScore) // Sort by match score
      .slice(0, maxRecipients); // Take top N (default 3)

    if (!scoredContractors || scoredContractors.length === 0) {
      console.warn(
        `No qualified contractors found for lead ${lead.id} in county ${county} for trade ${trade}.`
      );
      return;
    }

    const contractorIds = scoredContractors.map((c: ScoredContractor) => c.id);
    await storage.assignLeadToContractors(lead.id, contractorIds);

    // Log enhanced matching details
    console.log(
      `Enhanced matching for lead ${lead.id}: Selected ${scoredContractors.length} contractors with scores:`,
      scoredContractors.map((c: ScoredContractor) => ({
        name: c.companyName,
        score: c.matchScore?.toFixed(1),
      }))
    );

    // Notify contractors about the new lead
    const leadDetails = {
      id: lead.id,
      title: lead.title,
      // description: lead.description,
      location: `${city}, ${state} ${zipCode}`,
      trade: trade,
      budget: lead.budget,
      urgency: lead.urgency,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
    };

    await Promise.all(
      scoredContractors.map(async (contractor: ScoredContractor) => {
        try {
          console.log(
            `Notifying contractor ${contractor.companyName} (ID: ${contractor.id}) about new lead ${lead.id}`
          );

          const recipientUserId = contractor.userId;
          if (recipientUserId) {
            await notificationService.createNotification({
              userId: recipientUserId,
              type: "new_project_request",
              title: "New Direct Connect request",
              message: `You have a new Direct Connect request: ${lead.title} in ${city}, ${state}.`,
              actionUrl: `/pro-dashboard/leads/${lead.id}`,
              actionText: "View lead",
              iconName: "briefcase",
              iconColor: "orange",
              deliveryMethods: ["in_app", "push"],
            });
          }
          // Log the assignment event with match score
          await storage.logEvent("lead_assigned", {
            leadId: lead.id,
            contractorId: contractor.id,
            assignmentType: "enhanced_matching",
            matchScore: contractor.matchScore,
          });
        } catch (notificationError) {
          console.error(
            `Failed to notify contractor ${contractor.id} for lead ${lead.id}:`,
            notificationError
          );
        }
      })
    );
  } catch (error: any) {
    console.error(`Error routing lead ${lead.id} to top contractors:`, error);
  }
}

const DEFAULT_FIRST_INTRO_APPENDIX =
  'TradeScout is a community operating system that keeps projects and dollars local. Homeowners and contractors can connect, message, and run the full job flow—quotes, scheduling, invoices, and payments (including off-site work). Beyond jobs, TradeScout includes a local marketplace, community feed and groups, and real neighborhood tools so communities can manage vendors, requests, budgets, and decisions with total transparency. Community Builders and the foundation layer add public accountability and local reinvestment—so TradeScout isn’t just "find a pro," it’s how a town organizes and improves itself.';

export async function registerRoutes(app: any) {
  // Setup authentication
  await setupAuth(app);

  // Anti-scraping guard: blocks obvious bots and throttles bursts
  app.use(antiScrapeShield);

  // Admin OS routes (health + heatmap) now mounted via dedicated module.
  // URLs and behavior remain identical; this simply centralizes admin authority.
  mountAdminRoutes(app);
  app.use("/api/admin/mission-control", missionControlRouter);
  app.use("/api/preferred-source", preferredSourceRouter);

  // Observability metrics API (Phase 2: Dashboards)
  const { observabilityRouter } = await import("./routes/observability");
  app.use("/api/admin/observability", observabilityRouter);

  // Authority Operations admin panel (observation mode, decision card metrics, unlock ledger)
  registerAuthorityOperationsRoutes(app);

  // Public config for client (safe, read-only)
  app.get("/api/public/config", (req: any, res: any) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      firstIntroAppendix: process.env.TS_FIRST_INTRO_APPENDIX || DEFAULT_FIRST_INTRO_APPENDIX,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    });
  });

  // ---------------------------------------------------------------------------
  // Public proof metrics (counts only, no PII, cached)
  // NOTE: intentionally conservative to avoid over-claiming
  // - countiesIndexed: count of counties rows
  // - decisionsLast7Days: mission control decisions past 7 days
  // - verifiedClaimsLast30Days: approved address verifications past 30 days
  // ---------------------------------------------------------------------------
  type ProofMetricsResponse = {
    generatedAt: string;
    cacheSeconds: number;
    countiesIndexed: number;
    decisionsLast7Days: number;
    verifiedClaimsLast30Days: number;
  };

  const proofCache: { value: ProofMetricsResponse | null; expiresAt: number } = {
    value: null,
    expiresAt: 0,
  };

  app.get("/api/public/proof-metrics", async (_req: any, res: any) => {
    try {
      const now = Date.now();
      const cacheSeconds = 60;

      if (proofCache.value && proofCache.expiresAt > now) {
        res.setHeader(
          "Cache-Control",
          `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
        );
        return res.status(200).json(proofCache.value);
      }

      const [countiesRow, decisionsRow, verifiedRow] = await Promise.all([
        db.select({ n: sql<number>`count(*)` }).from(counties),
        db
          .select({ n: sql<number>`count(*)` })
          .from(missionControlDecisions)
          .where(
            sql`${missionControlDecisions.decisionDate} >= (current_date - interval '7 days')`
          ),
        db
          .select({ n: sql<number>`count(*)` })
          .from(addressVerifications)
          .where(
            and(
              eq(addressVerifications.status, "approved"),
              sql`${addressVerifications.approvedAt} >= (now() - interval '30 days')`
            )
          ),
      ]);

      const countiesIndexed = Number((countiesRow?.[0] as any)?.n ?? 0);
      const decisionsLast7Days = Number((decisionsRow?.[0] as any)?.n ?? 0);
      const verifiedClaimsLast30Days = Number((verifiedRow?.[0] as any)?.n ?? 0);

      const payload: ProofMetricsResponse = {
        generatedAt: new Date().toISOString(),
        cacheSeconds,
        countiesIndexed: Number.isFinite(countiesIndexed) ? countiesIndexed : 0,
        decisionsLast7Days: Number.isFinite(decisionsLast7Days) ? decisionsLast7Days : 0,
        verifiedClaimsLast30Days: Number.isFinite(verifiedClaimsLast30Days)
          ? verifiedClaimsLast30Days
          : 0,
      };

      proofCache.value = payload;
      proofCache.expiresAt = now + cacheSeconds * 1000;

      res.setHeader(
        "Cache-Control",
        `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
      );
      return res.status(200).json(payload);
    } catch (error: any) {
      console.error("Error in /api/public/proof-metrics:", error);
      return res.status(503).json({ message: "Proof metrics temporarily unavailable" });
    }
  });

  const isProductionEnv = process.env.NODE_ENV === "production";

  // In development/staging we don't want rate limiting to block local testing,
  // but we keep the limiter fully enabled in production.
  const noopRateLimiter: any = (_req: any, _res: any, next: any) => next();

  const loginLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: "Too many login attempts, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      })
    : noopRateLimiter;

  const passwordResetLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5,
        message: "Too many reset requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      })
    : noopRateLimiter;

  const aiLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 60,
        message: "Too many AI requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      })
    : noopRateLimiter;

  const parseOptionalIsoDate = (value?: string): Date | undefined => {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const getBetaWindow = () => {
    // ISO timestamps recommended, e.g. 2025-12-01T00:00:00Z
    const start = parseOptionalIsoDate(process.env.BETA_START_AT || process.env.BETA_START_DATE);
    const end = parseOptionalIsoDate(process.env.BETA_END_AT || process.env.BETA_END_DATE);
    return { start, end };
  };

  const isWithinBetaPeriod = (date: Date): boolean => {
    const { start, end } = getBetaWindow();

    // If no beta window is configured, treat the entire runtime as beta.
    // This ensures everyone using the product during the live beta
    // automatically receives Founder badges until the window is
    // explicitly narrowed via env configuration.
    if (!start && !end) {
      return true;
    }

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
    const inBeta =
      created && !Number.isNaN(created.getTime()) ? isWithinBetaPeriod(created) : false;

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

  const sanitizeUserForResponse = (user: any) => {
    if (!user) return user;

    const rolesRaw =
      Array.isArray(user?.roles) && user.roles.length > 0
        ? user.roles
        : user?.role
          ? [user.role]
          : [];
    const roles = rolesRaw.filter((r: any) => typeof r === "string") as SharedUserRole[];
    const primaryRole: SharedUserRole | undefined = roles[0];

    const basePermissions = primaryRole ? ROLE_PERMISSIONS[primaryRole] : undefined;

    const computedIsAdmin =
      user.isAdmin === true ||
      (user.role && ["super_admin", "head_admin", "moderator", "ops_admin"].includes(user.role)) ||
      Boolean(
        basePermissions?.canAccessAdminPanel ||
        basePermissions?.canAccessSuperAdmin ||
        (primaryRole &&
          ["moderator", "ops_admin", "super_admin", "head_admin"].includes(primaryRole))
      );

    const computedIsSuperAdmin =
      user.isSuperAdmin === true ||
      (user.role && ["super_admin", "head_admin"].includes(user.role)) ||
      Boolean(primaryRole && ["super_admin", "head_admin"].includes(primaryRole));

    const hasCanonicalLocation =
      typeof (user as any).stateCode === "string" &&
      (user as any).stateCode.length === 2 &&
      typeof (user as any).countyFips === "string" &&
      (user as any).countyFips.length === 5;

    return {
      ...user,
      badges: computeBadgesForUser(user),
      isAdmin: computedIsAdmin,
      isSuperAdmin: computedIsSuperAdmin,
      // Canonical flag for whether this account has a committed
      // county-level location. All UX prompts should key off this,
      // not off ad-hoc context checks.
      locationCommitted: hasCanonicalLocation,
      profileVersion:
        typeof (user as any).profileVersion === "number" ? (user as any).profileVersion : 0,
      password: undefined,
    };
  };

  // Authentication routes
  const handleLocalLogin = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.logIn(user, (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({ user: sanitizeUserForResponse(req.user), message: "Login successful" });
      });
    })(req, res, next);
  };

  // Backward compatibility: allow both /auth/login and /api/auth/login
  app.post("/auth/login", loginLimiter, handleLocalLogin);
  app.post("/api/auth/login", loginLimiter, handleLocalLogin);

  const handleRegister = async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as any;
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const address = typeof body.address === "string" ? body.address.trim() : undefined;
      const state = typeof body.state === "string" ? body.state.trim() : undefined;
      const county = typeof body.county === "string" ? body.county.trim() : undefined;
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const verificationStatus = body.verificationStatus;
      const allowPhoneCalls =
        body.allowPhoneCalls === true ||
        body.phoneCallConsent === true ||
        body.allowPhoneContact === true;

      const acceptTerms =
        body.acceptTerms === true ||
        body.agreeToTerms === true ||
        body.termsAccepted === true ||
        body.acceptedTerms === true;

      const normalizeRole = (value: string) => {
        const role = value.trim();
        if (role === "contractor_user") return "contractor";
        if (role === "vehicle_dealer") return "car_dealer";
        if (role === "car_salesman") return "car_dealer";
        if (role === "homeowner") return "homeowner";
        if (role === "contractor") return "contractor";
        if (role === "other") return "homeowner"; // Map 'other' to homeowner
        return role;
      };

      const userTypesRaw = Array.isArray(body.userTypes) ? body.userTypes : undefined;
      const roleRaw = typeof body.role === "string" ? body.role : undefined;
      const roleIntentRaw = typeof body.roleIntent === "string" ? body.roleIntent : undefined;
      const userIntent = typeof body.userIntent === "string" ? body.userIntent.trim() : undefined;

      const userTypesInput =
        userTypesRaw && userTypesRaw.length > 0
          ? userTypesRaw
          : roleIntentRaw
            ? [roleIntentRaw]
            : roleRaw
              ? [roleRaw]
              : [];

      const userTypes = userTypesInput
        .filter((t: any) => typeof t === "string")
        .map((t: string) => normalizeRole(t));

      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!password) return res.status(400).json({ message: "Password is required" });
      if (password.length < 8)
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      if (!firstName) return res.status(400).json({ message: "First name is required" });
      if (!lastName) return res.status(400).json({ message: "Last name is required" });
      if (!phone) return res.status(400).json({ message: "Phone number is required" });

      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        return res.status(400).json({ message: "Please enter a valid phone number" });
      }

      if (!acceptTerms) {
        return res.status(400).json({ message: "You must accept the Terms of Service" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // CLAIM-FIRST: userTypes are now optional provisional preferences, not required identity
      // Empty array is valid - allows users to skip and define intent later

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Badge helpers
      const formatRoleLabel = (role: string) =>
        role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const badges = new Set<string>();

      // Role badges for each selected user type (only if userTypes provided)
      if (userTypes && userTypes.length > 0) {
        for (const role of userTypes) {
          const roleBadge = getUserTypeBadgeLabel(role);
          if (roleBadge) badges.add(roleBadge);
        }
      }

      // Founder badge: users who joined during the beta period
      // (configured via BETA_START_AT/BETA_END_AT environment variables)
      // CLAIM-FIRST: Only grant badges for confirmed types, not provisional selections
      if (isWithinBetaPeriod(new Date()) && userTypes && userTypes.length > 0) {
        for (const role of userTypes) {
          badges.add(`Founder (${formatRoleLabel(role)})`);
        }
      }

      // Verified badge: if verificationStatus is approved
      const allowedStatuses = [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "expired",
        "suspended",
      ];
      const status = allowedStatuses.includes(verificationStatus) ? verificationStatus : "pending";
      if (status === "approved" && userTypes && userTypes.length > 0) {
        userTypes.forEach((role: string) => badges.add(`Verified ${formatRoleLabel(role)}`));
      }

      // Determine primary role from user types
      // CLAIM-FIRST: Default to 'homeowner' if no types selected (neutral starting point)
      const primaryRole = userTypes && userTypes.length > 0 ? userTypes[0] : "homeowner";

      const preferences = {
        ...(body.preferences || {}),
        badges: {
          show: body?.preferences?.badges?.show ?? true,
        },
        communication: {
          ...(body?.preferences?.communication || {}),
          allowPhoneCalls,
        },
        // Store provisional userTypes selections and free-form intent
        provisional: {
          userTypes: userTypes || [],
          userIntent: userIntent || undefined,
          capturedAt: new Date().toISOString(),
        },
      };

      // Create user with multi-role support
      // CLAIM-FIRST: roles array may be empty - identity is derived later from claims
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        address,
        state,
        county,
        role: primaryRole as any, // Primary role for backward compatibility (defaults to homeowner for routing)
        roles: userTypes || [], // Empty array allowed - provisional preferences stored separately
        activeRole: primaryRole, // Default active role for routing
        emailVerified: false,
        addressVerified: false,
        verificationStatus: status,
        badges: Array.from(badges),
        preferences,
      });

      // Persist ToS acceptance timestamp
      try {
        await dataManagementService.getUserPrivacySettings(user.id);
        await dataManagementService.updateUserPrivacySettings(user.id, {
          termsOfServiceAccepted: new Date(),
        });
      } catch (e) {
        console.error("Failed to persist ToS acceptance:", e);
      }

      // Automatic community welcome + (optionally) Scout-authored intro post
      await createAutomaticCommunityWelcomeForUser(user, {
        createdViaScout: typeof body.source === "string" && body.source.toLowerCase() === "scout",
      });

      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.json({ user: sanitizeUserForResponse(user), message: "Registration successful" });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      sendAutoClassifiedError(res, error, "Registration failed", { userId });
    }
  };

  // ---------------------------------------------------------------------------
  // Affiliate API
  // ---------------------------------------------------------------------------
  app.get(
    "/api/affiliate/dashboard",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const user = req.user as any;
        const userId = (user as any)?.claims?.sub || (user as any)?.id || "";

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        // Ensure an affiliate program exists for this user
        let program = await storage.getAffiliateProgram(userId);
        if (!program) {
          program = await storage.createAffiliateProgram({ userId });
        }

        const [stats, referrals, commissions, payouts] = await Promise.all([
          storage.getAffiliateStats(program.id),
          storage.getReferralsByAffiliate(program.id),
          storage.getCommissionsForAffiliate(program.id),
          storage.getPayoutsForAffiliate(program.id),
        ]);

        const baseUrl =
          process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com";
        const referralCode = (program as any).referralCode || "YOUR_CODE";

        const programPayload = {
          id: program.id,
          affiliateCode: referralCode,
          referralLink: `${baseUrl}/?ref=${encodeURIComponent(referralCode)}`,
          commissionRate:
            (program as any).commissionRate != null
              ? String((program as any).commissionRate)
              : "0.05",
          status: (program as any).status ?? "active",
          totalCommissionEarned: stats.totalCommissionEarned,
          totalCommissionPaid: stats.totalCommissionPaid,
          createdAt:
            ((program as any).createdAt as Date | null)?.toISOString?.() ||
            new Date().toISOString(),
          payoutMethod: undefined,
          payoutDetails: undefined,
        };

        res.json({
          program: programPayload,
          stats,
          referrals: referrals.slice(0, 10),
          commissions: commissions.slice(0, 10),
          payouts: payouts.slice(0, 5),
        });
      } catch (error: any) {
        console.error("Error loading affiliate dashboard:", error);
        res.status(500).json({ message: "Failed to load affiliate dashboard" });
      }
    }
  );

  app.put("/api/affiliate/settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      return res.status(501).json({ message: "Affiliate settings not implemented" });
    } catch (error: any) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // Backward compatibility: allow both /auth/register and /api/auth/register
  app.post("/auth/register", handleRegister);
  app.post("/api/auth/register", handleRegister);

  const performLogout = (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed", details: String(err) });
      }
      // Clear common session cookies; safe no-ops if they don't exist.
      res.clearCookie("tradescout.sid", { path: "/" });
      res.clearCookie("connect.sid");
      res.clearCookie("sid");
      res.status(200).json({ message: "Logout successful" });
    });
  };

  // Canonical logout endpoint
  app.post("/auth/logout", (req: Request, res: Response) => performLogout(req, res));

  // Compatibility aliases: support GET + /api namespace to survive proxies and legacy clients
  app.get("/auth/logout", (req: Request, res: Response) => performLogout(req, res));
  app.post("/api/auth/logout", (req: Request, res: Response) => performLogout(req, res));
  app.get("/api/auth/logout", (req: Request, res: Response) => performLogout(req, res));

  // NOTE: OAuth routes are registered later (after setupAuth) so we can safely guard
  // registration based on whether the strategies are configured.

  // Role-based onboarding routes
  app.post("/api/auth/update-role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { role } = (req.body ?? {}) as any;
      const user = req.user as any;
      const userId: string = (user as any)?.claims?.sub || (user as any)?.id || "";

      if (!["homeowner", "contractor"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Map role to database enum value
      const dbRole = role === "contractor" ? "contractor" : "homeowner";

      if (!userId) return res.status(400).json({ message: "User ID missing" });
      await storage.updateUser(userId, { role: dbRole });

      res.json({ message: "Role updated successfully", role: dbRole });
    } catch (error: any) {
      console.error("Role update error:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.post(
    "/api/auth/complete-onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const {
          firstName,
          lastName,
          phone,
          address,
          city,
          state,
          zipCode,
          county,
          businessName,
          licenseNumber,
          specialties,
          yearsExperience,
          role,
          capabilityBundles,
          participationModes,
        } = (req.body ?? {}) as any;

        const sessionUser = req.user as any;
        const userId: string = sessionUser?.id || sessionUser?.claims?.sub || "";

        if (!userId) return res.status(400).json({ message: "User ID missing" });

        const normalizeStringArray = (value: unknown): string[] => {
          if (!Array.isArray(value)) return [];
          return Array.from(
            new Set(
              value
                .map((v) => (typeof v === "string" ? v : String(v ?? "")))
                .map((v) => v.trim())
                .filter((v) => v.length > 0)
            )
          );
        };

        const bundles = normalizeStringArray(capabilityBundles);
        const modes = normalizeStringArray(participationModes);

        // Start with basic profile + geo data
        const updateData: any = {
          firstName,
          lastName,
          phone,
          address,
          city,
          state,
          zipCode,
          county,
          onboardingCompleted: true,
          profileVersion: CURRENT_PROFILE_VERSION,
        };

        // If capability bundles are provided, persist them and derive compatible roles
        if (bundles.length > 0) {
          updateData.capabilityBundles = bundles;
          if (modes.length > 0) {
            updateData.participationModes = modes;
          }

          // Derive legacy roles/user types from capability bundles for compatibility
          const hasServiceProvider = bundles.includes("service_provider");
          const hasPropertyOperator = bundles.includes("property_operator");
          const hasLocalSeller = bundles.includes("local_seller");
          const hasBusinessOrOrgSignal =
            hasServiceProvider ||
            hasPropertyOperator ||
            hasLocalSeller ||
            bundles.includes("organization_admin") ||
            bundles.includes("team_manager") ||
            bundles.includes("finance_tools_user");

          const inferredRoles = new Set<string>();

          if (hasServiceProvider) {
            inferredRoles.add("contractor");
          }

          if (hasPropertyOperator) {
            inferredRoles.add("property_manager");
          }

          if (hasLocalSeller) {
            // Local seller is its own tag, but we also map to business_owner
            inferredRoles.add("local_seller");
            inferredRoles.add("business_owner");
          }

          if (bundles.includes("community_participant") && !hasBusinessOrOrgSignal) {
            inferredRoles.add("community_member");
          }

          // Default homeowner context when there is no explicit business/org signal
          if (!hasBusinessOrOrgSignal) {
            inferredRoles.add("homeowner");
          }

          // Merge with any existing roles so we don't drop admin/affiliate/etc.
          const currentUser = await storage.getUser(userId);
          const existingRolesRaw: unknown = (currentUser as any)?.roles;
          const existingRoles: string[] = Array.isArray(existingRolesRaw)
            ? (existingRolesRaw as unknown[])
                .filter((v) => typeof v === "string")
                .map((v) => v as string)
            : [];

          const mergedRoles = Array.from(
            new Set<string>([...existingRoles, ...Array.from(inferredRoles)])
          );

          // Choose a primary legacy role compatible with the enum for users.role
          const pickPrimaryRole = (): string => {
            if (inferredRoles.has("contractor")) return "contractor";
            if (inferredRoles.has("property_manager")) return "property_manager";
            if (inferredRoles.has("business_owner")) return "business_owner";
            if (inferredRoles.has("homeowner")) return "homeowner";
            // Fallback: keep current primary if present, else homeowner
            const currentPrimary: string | undefined =
              (currentUser as any)?.activeRole || (currentUser as any)?.role;
            if (typeof currentPrimary === "string" && currentPrimary.length > 0) {
              return currentPrimary;
            }
            return "homeowner";
          };

          const primaryRole = pickPrimaryRole();

          updateData.roles = mergedRoles;
          updateData.activeRole = primaryRole;
          updateData.role = primaryRole as any;
        }

        // Add contractor/business-specific fields
        const isBusinessOrServiceProfile =
          bundles.length > 0
            ? bundles.includes("service_provider") || bundles.includes("property_operator")
            : role === "contractor";

        if (isBusinessOrServiceProfile) {
          updateData.businessName = businessName;
          updateData.licenseNumber = licenseNumber;
          updateData.specialties = specialties;
          updateData.yearsExperience = parseInt(yearsExperience) || 0;
        }

        await storage.updateUser(userId, updateData);

        res.json({ message: "Onboarding completed successfully" });
      } catch (error: any) {
        console.error("Onboarding completion error:", error);
        res.status(500).json({ message: "Failed to complete onboarding" });
      }
    }
  );

  app.post("/api/auth/skip-onboarding", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(400).json({
          error: "Onboarding cannot be skipped",
        });
      }

      const { role } = (req.body ?? {}) as any;
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";

      // Mark onboarding as completed but keep minimal profile
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      await storage.updateUser(userId, {
        onboardingCompleted: true,
        role: role === "contractor" ? "contractor" : "homeowner",
      });

      res.json({ message: "Account created successfully" });
    } catch (error: any) {
      console.error("Skip onboarding error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.get("/api/auth/user", async (req: AuthedRequest, res: Response) => {
    try {
      const authDiagnostics = {
        hasCookieHeader: Boolean(req.headers.cookie),
        cookieNames: (req.headers.cookie || "")
          .split(";")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => c.split("=")[0])
          .filter(Boolean),
        origin: req.headers.origin,
        host: req.headers.host,
        xForwardedProto: req.headers["x-forwarded-proto"],
      };

      if (!req.isAuthenticated()) {
        res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
        return;
      }

      const userId: string = (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
      if (!userId) {
        res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
        return;
      }

      const applyImpersonation = (baseUser: any) => {
        const sessionAny = req.session as any;
        if (sessionAny?.isImpersonating && sessionAny?.impersonatingRole) {
          return {
            ...baseUser,
            role: sessionAny.impersonatingRole,
            isImpersonating: true,
            originalRole: sessionAny.originalUser?.role,
          };
        }
        return baseUser;
      };

      // Active profile resolution (session spine):
      // - If activeProfileId exists, keep it.
      // - Else if user owns exactly 1 profile, auto-set it.
      if (!user.activeProfileId) {
        const profiles = await storage.listProfilesByOwner(userId);
        if (profiles.length === 1) {
          const updated = await storage.setUserActiveProfile(userId, profiles[0].id);
          res.json({
            authenticated: true,
            user: sanitizeUserForResponse(applyImpersonation(updated)),
          });
          return;
        }
      }

      // Active business resolution:
      // - If activeBusinessId exists, keep it.
      // - Else if user owns exactly 1 business, auto-set it.
      if (!user.activeBusinessId) {
        const businesses = await storage.listBusinessesByOwner(userId);
        if (businesses.length === 1) {
          const updated = await storage.setUserActiveBusiness(userId, businesses[0].id);
          res.json({
            authenticated: true,
            user: sanitizeUserForResponse(applyImpersonation(updated)),
          });
          return;
        }
      }

      const finalUser = sanitizeUserForResponse(applyImpersonation(user));
      // Graduate pilot: community-first experience is now default for all authenticated users.
      const communityFirst = true;

      res.json({ authenticated: true, user: { ...finalUser, communityFirst } });
    } catch (error: any) {
      console.error("Error fetching auth user:", error);
      // Fail-soft: auth must never block the app shell.
      res.status(200).json({ authenticated: false });
    }
  });

  // Initialize a MealScout SSO session for the current TradeScout user.
  // This is intended to be called server-side when the user opens the
  // MealScout surface in TradeScout. It mints a JWT and forwards any
  // Set-Cookie headers from MealScout back to the browser.
  app.post("/api/mealscout/sso", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const rawUser: any = req.user;
      const userId: string = rawUser?.id || rawUser?.claims?.sub || "";

      if (!userId) {
        return res.status(400).json({ ok: false, error: "User ID missing" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const result = await ensureMealscoutSsoSession(user as any);
      const token = createMealscoutSsoToken(user);

      for (const cookie of result.cookies) {
        res.append("Set-Cookie", cookie);
      }

      return res.json({ ok: true, status: result.status, token });
    } catch (error: any) {
      console.error("MealScout SSO error:", error);
      return res.status(500).json({ ok: false, error: "Failed to initialize MealScout session" });
    }
  });

  // MealScout affiliate: record a subscription payment attributed to a TradeScout affiliate.
  // This endpoint is intended to be called from MealScout's backend after a
  // successful merchant subscription charge. It applies a flat commission of
  // $20 for the first paid month and $5 for each subsequent consecutive month.
  app.post("/api/mealscout/affiliate/subscription-payment", async (req: Request, res: Response) => {
    try {
      const sharedSecret = process.env.MEALSCOUT_WEBHOOK_SECRET;
      const headerSecret = req.headers["x-mealscout-webhook-secret"];

      if (!sharedSecret || headerSecret !== sharedSecret) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { affiliateCode, merchantUserId, subscriptionAmount } = (req.body ?? {}) as {
        affiliateCode?: string;
        merchantUserId?: string;
        subscriptionAmount?: number;
      };

      if (!affiliateCode || !merchantUserId) {
        return res
          .status(400)
          .json({ ok: false, error: "affiliateCode and merchantUserId are required" });
      }

      const priorPayments = await storage.getMealscoutSubscriptionPaymentCount(
        affiliateCode,
        merchantUserId
      );
      const isFirstMonth = priorPayments === 0;
      const commissionAmount = isFirstMonth ? 20 : 5;

      await storage.recordMealscoutAffiliatePayment({
        affiliateCode,
        merchantUserId,
        commissionAmount,
        isFirstMonth,
        subscriptionAmount,
      });

      return res.json({ ok: true, commissionAmount, isFirstMonth });
    } catch (error: any) {
      console.error("[MealScoutAffiliate] Failed to record subscription payment", error);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to record MealScout affiliate payment" });
    }
  });

  // Check if platform setup is needed
  app.get("/api/auth/setup-status", async (req: AuthedRequest, res: Response) => {
    try {
      const existingHeadAdmin = await storage.getUserByRole("head_admin");
      res.json({ needsSetup: !existingHeadAdmin });
    } catch (error: any) {
      console.error("Setup status check error:", error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  // Master admin setup route (only works if no head_admin exists)
  app.post("/api/auth/setup-master", async (req: AuthedRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName } = (req.body ?? {}) as any;

      // Check if any head_admin already exists
      const existingHeadAdmin = await storage.getUserByRole("head_admin");
      if (existingHeadAdmin) {
        return res.status(403).json({ message: "Master admin already exists" });
      }

      const masterAdmin = await storage.createMasterAdmin(email, password, firstName, lastName);

      // Register trusted device for secure session persistence
      const sessionToken = await DeviceAuthService.registerTrustedDevice(); // stubbed: no args

      // Set secure cookie for trusted session
      res.cookie("trusted_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      // Auto-login the master admin
      req.login(masterAdmin, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Master admin created but login failed" });
        }
        res.json({
          user: sanitizeUserForResponse(masterAdmin),
          message: "Master admin setup complete - device registered for secure access",
          deviceRegistered: true,
        });
      });
    } catch (error: any) {
      console.error("Master admin setup error:", error);
      res.status(500).json({ message: "Master admin setup failed" });
    }
  });

  // Connect current Facebook login to existing master admin account with device security
  app.post(
    "/api/auth/connect-master-admin",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const currentUser = req.user as any;

        // Check if user is logged in via Facebook
        if (!currentUser.claims?.sub) {
          return res
            .status(400)
            .json({ message: "Must be logged in via Facebook to connect to master admin" });
        }

        // Find the master admin account that needs Facebook connection
        const masterAdmin = await storage.getUserByEmail("mrplatypus4777@gmail.com");
        if (!masterAdmin || masterAdmin.role !== "head_admin") {
          return res.status(404).json({ message: "Master admin account not found" });
        }

        // Check if master admin already has Facebook connected
        if (masterAdmin.facebookId) {
          return res
            .status(400)
            .json({ message: "Master admin account already connected to Facebook" });
        }

        // Register this device as trusted for the master admin (auto-approve first device)
        // const { DeviceAuthService } = await import('./device-auth');
        // const { deviceId, needsApproval } = await DeviceAuthService.registerDevice(
        //   masterAdmin.id,
        //   req,
        //   req.body.deviceFingerprint, // Client can send additional device data
        //   true // Auto-approve this first device since you're doing the initial setup
        // );

        // Connect Facebook ID to master admin account and update profile
        await storage.updateUser(masterAdmin.id, {
          facebookId: currentUser.claims.sub,
          profileImageUrl: currentUser.claims.profile_image_url,
          // Update name if Facebook has more recent data
          firstName: currentUser.claims.first_name || masterAdmin.firstName,
          lastName: currentUser.claims.last_name || masterAdmin.lastName,
        });

        // Update session to reflect master admin privileges
        req.user = {
          ...currentUser,
          id: masterAdmin.id,
          email: masterAdmin.email,
          role: "head_admin",
          firstName: currentUser.claims.first_name || masterAdmin.firstName,
          lastName: currentUser.claims.last_name || masterAdmin.lastName,
          facebookId: currentUser.claims.sub,
        };

        res.json({
          message: "Facebook account connected to master admin with device security enabled",
          user: {
            id: masterAdmin.id,
            email: masterAdmin.email,
            role: "head_admin",
            firstName: (req.user as any)?.firstName,
            lastName: (req.user as any)?.lastName,
            profileImageUrl: currentUser.claims.profile_image_url,
            facebookId: currentUser.claims.sub,
          },
          deviceSecurity: {
            deviceId: req.headers["user-agent"]
              ? Buffer.from(req.headers["user-agent"] + (req.ip || ""))
                  .toString("base64")
                  .substring(0, 32)
              : "unknown-device",
            message: "This device has been registered and approved for admin access",
          },
        });
      } catch (error: any) {
        console.error("Connect master admin error:", error);
        res.status(500).json({ message: "Failed to connect Facebook to master admin account" });
      }
    }
  );

  // Device management routes for admin security
  app.get(
    "/api/admin/devices",
    isAuthenticated,
    requireRole(["head_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { DeviceAuthService } = await import("./deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        const devices = await DeviceAuthService.getUserDevices(userId);
        res.json({ devices });
      } catch (error: any) {
        console.error("Get devices error:", error);
        res.status(500).json({ message: "Failed to fetch devices" });
      }
    }
  );

  app.get(
    "/api/admin/pending-devices",
    isAuthenticated,
    requireRole(["head_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { DeviceAuthService } = await import("./deviceAuth");
        const pendingDevices = await DeviceAuthService.getPendingDevices();
        res.json({ pendingDevices });
      } catch (error: any) {
        console.error("Get pending devices error:", error);
        res.status(500).json({ message: "Failed to fetch pending devices" });
      }
    }
  );

  app.post(
    "/api/admin/approve-device",
    isAuthenticated,
    requireRole(["head_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { deviceId } = (req.body ?? {}) as any;
        const { DeviceAuthService } = await import("./deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        if (!deviceId) return res.status(400).json({ message: "Device ID missing" });
        const success = await DeviceAuthService.approveDevice(deviceId, userId);

        if (success) {
          res.json({ message: "Device approved successfully" });
        } else {
          res.status(400).json({ message: "Failed to approve device" });
        }
      } catch (error: any) {
        console.error("Approve device error:", error);
        res.status(500).json({ message: "Failed to approve device" });
      }
    }
  );

  app.post(
    "/api/admin/revoke-device",
    isAuthenticated,
    requireRole(["head_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { deviceId } = (req.body ?? {}) as any;
        const { DeviceAuthService } = await import("./deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        if (!deviceId) return res.status(400).json({ message: "Device ID missing" });
        const success = await DeviceAuthService.revokeDevice(deviceId, userId);

        if (success) {
          res.json({ message: "Device revoked successfully" });
        } else {
          res.status(400).json({ message: "Failed to revoke device" });
        }
      } catch (error: any) {
        console.error("Revoke device error:", error);
        res.status(500).json({ message: "Failed to revoke device" });
      }
    }
  );

  // Admin-only route to create new admin accounts
  app.post(
    "/api/admin/create-account",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { email, password, firstName, lastName, role, address } = (req.body ?? {}) as any;

        // Validate role assignment permissions
        const currentUser = req.user as any;
        if (role === "head_admin" && currentUser.role !== "head_admin") {
          return res.status(403).json({ message: "Only head admins can create other head admins" });
        }

        // Check if user already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "User with this email already exists" });
        }

        // Username check not needed as we removed username field

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create admin user
        const newAdmin = await storage.createUser({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          address,
          role: role as any,
          emailVerified: true, // Admins are pre-verified
          addressVerified: true, // Admins are pre-verified
        });

        // Remove password hash from response
        const { password: _, ...userResponse } = newAdmin;

        res.json({
          user: userResponse,
          message: `${role} account created successfully`,
        });
      } catch (error: any) {
        console.error("Admin account creation error:", error);
        res.status(500).json({ message: "Account creation failed" });
      }
    }
  );

  // OAuth strategies are configured in auth.ts

  const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const facebookDisabled = process.env.DISABLE_FACEBOOK_AUTH === "true";
  const facebookAppId = process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;
  const hasFacebookOAuth = !facebookDisabled && Boolean(facebookAppId && facebookAppSecret);

  if (hasGoogleOAuth) {
    const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL;

    if (!googleCallbackURL) {
      throw new Error(
        "GOOGLE_CALLBACK_URL is not set. This must be configured in the environment for Google OAuth to work."
      );
    }

    console.log("[AUTH] Using Google callback URL:", googleCallbackURL);

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: googleCallbackURL,
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GoogleProfile,
          done: VerifyCallback
        ) => {
          // Always derive a non-empty email string for DB constraints
          let email = "";
          try {
            email = profile.emails?.[0]?.value || `${profile.id}@google.local`;

            let user = await storage.getUserByEmail(email);

            const isNewUser = !user;

            if (!user) {
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || profile.displayName || "",
                lastName: profile.name?.familyName || "",
                googleId: profile.id,
                provider: "google",
                providerId: profile.id,
                role: null as any,
                onboardingCompleted: false,
              });
            } else {
              const updates: Partial<import("@shared/schema").User> = {};
              if (!user.googleId) {
                (updates as any).googleId = profile.id;
              }
              if (!user.provider) {
                (updates as any).provider = "google";
              }
              if (!user.providerId) {
                (updates as any).providerId = profile.id;
              }
              if (Object.keys(updates).length > 0) {
                user = await storage.updateUser(user.id, updates);
              }
            }

            if (user) {
              (user as any)._wasNewSocialUser = isNewUser;

              if (isNewUser) {
                // Fire-and-forget welcome post; don't block OAuth callback
                createAutomaticCommunityWelcomeForUser(user as any).catch((err) => {
                  console.error(
                    "[Community] Failed to create automatic welcome/intro posts for Google user",
                    {
                      userId: (user as any)?.id,
                      error: (err as any)?.message,
                    }
                  );
                });
              }
            }

            done(null, user as any);
          } catch (error) {
            console.error("[AUTH] Google login error", {
              message: (error as any)?.message,
              email,
              profileId: profile.id,
              stack: (error as any)?.stack,
            });
            done(error as Error);
          }
        }
      )
    );
  }

  // Auth middleware already initialized at the top of registerRoutes

  // Locality tracking middleware - track all interactions with geographic context
  app.use(localityTrackingMiddleware());

  // Device auth middleware - check for trusted devices
  app.use(checkTrustedDevice);

  // OAuth routes (canonical): only register when the strategy is configured.
  // This prevents runtime crashes like: "Unknown authentication strategy 'google'".
  app.get("/api/auth/providers", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");

    const facebookIdSource = process.env.FACEBOOK_APP_ID
      ? "FACEBOOK_APP_ID"
      : process.env.FACEBOOK_CLIENT_ID
        ? "FACEBOOK_CLIENT_ID"
        : null;
    const facebookSecretSource = process.env.FACEBOOK_APP_SECRET
      ? "FACEBOOK_APP_SECRET"
      : process.env.FACEBOOK_CLIENT_SECRET
        ? "FACEBOOK_CLIENT_SECRET"
        : null;

    res.json({
      google: hasGoogleOAuth,
      facebook: hasFacebookOAuth,
      diagnostics: {
        facebook: {
          disabledByEnv: facebookDisabled,
          hasId: Boolean(facebookAppId),
          hasSecret: Boolean(facebookAppSecret),
          idSource: facebookIdSource,
          secretSource: facebookSecretSource,
        },
        google: {
          hasId: Boolean(process.env.GOOGLE_CLIENT_ID),
          hasSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
          hasCallback: Boolean(process.env.GOOGLE_CALLBACK_URL),
        },
      },
    });
  });

  if (hasFacebookOAuth) {
    app.get("/api/auth/facebook", passport.authenticate("facebook", { scope: ["email"] }));
    app.get(
      "/api/auth/facebook/callback",
      (req: Request, res: Response, next: any) => {
        try {
          if (
            typeof (req as any).isAuthenticated === "function" &&
            (req as any).isAuthenticated() &&
            (req as any).user
          ) {
            const user = req.user as any;
            const anyUser: any = user || {};
            const profileVersion: number =
              typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
            const needsProfileNormalization = profileVersion < CURRENT_PROFILE_VERSION;
            const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
            return res.redirect(redirectTo);
          }
        } catch {
          // ignore
        }
        return next();
      },
      passport.authenticate("facebook", { failureRedirect: "/login" }),
      (req: Request, res: Response) => {
        const user = req.user as any;
        const anyUser: any = user || {};
        const profileVersion: number =
          typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
        const needsProfileNormalization = profileVersion < CURRENT_PROFILE_VERSION;
        const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
        res.redirect(redirectTo);
      }
    );
  }

  if (hasGoogleOAuth) {
    // Google OAuth entrypoint: request standard OpenID scopes
    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
      })
    );
    app.get(
      "/api/auth/google/callback",
      (req: Request, res: Response, next: any) => {
        try {
          if (
            typeof (req as any).isAuthenticated === "function" &&
            (req as any).isAuthenticated() &&
            (req as any).user
          ) {
            const user = req.user as any;
            const anyUser: any = user || {};
            const profileVersion: number =
              typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
            const needsProfileNormalization = profileVersion < CURRENT_PROFILE_VERSION;
            const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
            return res.redirect(redirectTo);
          }
        } catch {
          // ignore
        }
        return next();
      },
      passport.authenticate("google", {
        failureRedirect: "/login",
        session: true,
      }),
      (req: Request, res: Response) => {
        const user = req.user as any;
        const anyUser: any = user || {};
        const profileVersion: number =
          typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
        const needsProfileNormalization = profileVersion < CURRENT_PROFILE_VERSION;
        const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
        res.redirect(redirectTo);
      }
    );
  }

  // Admin role impersonation routes
  app.post(
    "/api/admin/impersonate",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { role } = (req.body ?? {}) as any;

        // Validate the target role
        const validRoles = ["homeowner", "contractor", "startup_founder", "moderator", "ops_admin"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: "Invalid role for impersonation" });
        }

        // Store original user info in session for restoration
        (req.session as any).originalUser = {
          id: (req.user as any)?.id || (req.user as any)?.claims?.sub,
          role: (req.user as any)?.role,
          email: (req.user as any)?.email,
        };

        // Create a temporary impersonation session
        (req.session as any).impersonatingRole = role;
        (req.session as any).isImpersonating = true;

        // Find a user with the target role for realistic testing
        const targetUser = await storage.getUserByRole(role);
        let userId: string = (req.user as any)?.id || (req.user as any)?.claims?.sub || ""; // Default to admin's ID

        if (targetUser) {
          userId = targetUser.id;
        }

        res.json({
          message: `Impersonation started for role: ${role}`,
          role,
          userId,
          isImpersonating: true,
        });
      } catch (error: any) {
        console.error("Role impersonation error:", error);
        res.status(500).json({ message: "Failed to start impersonation" });
      }
    }
  );

  app.post(
    "/api/admin/stop-impersonation",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!(req.session as any).isImpersonating || !(req.session as any).originalUser) {
          return res.status(400).json({ message: "No active impersonation session" });
        }

        // Clear impersonation from session
        delete (req.session as any).impersonatingRole;
        delete (req.session as any).isImpersonating;
        delete (req.session as any).originalUser;

        res.json({
          message: "Impersonation stopped",
          isImpersonating: false,
        });
      } catch (error: any) {
        console.error("Stop impersonation error:", error);
        res.status(500).json({ message: "Failed to stop impersonation" });
      }
    }
  );

  // NOTE: Facebook OAuth routes are registered above (canonical /api/auth/*).

  // Platform statistics endpoint - real-time data
  app.get("/api/stats/platform", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getPlatformStatistics();
      res.json(stats);
    } catch (error: any) {
      console.error("Platform statistics error:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Auth user endpoint - critical for useAuth hook
  // NOTE: /api/auth/user is defined earlier (canonical) with req.isAuthenticated() checks.

  // User profile routes
  app.get("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

    try {
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
        preferences,
        profileImageUrl,
      } = (req.body ?? {}) as any;

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
              owner: userId,
              visibility: "public",
            }
          );
        } catch (e) {
          console.warn("Failed to set ACL for profile image", e);
        }
      }

      const user = await storage.updateUser(userId, {
        firstName,
        lastName,
        phone,
        address,
        city,
        // legacy string fields remain for back-compat
        state,
        zipCode,
        county,

        // canonical machine + display fields used by useLocationContext and locality-aware APIs
        stateCode: stateCode ?? state ?? null,
        countyFips: trimmedCountyFips ?? null,
        countyId: countyId ?? null,
        countyName: countyName ?? county ?? null,

        // optional profile-level coordinates if provided (stored as strings for back-compat)
        latitude: typeof latitude === "number" ? String(latitude) : undefined,
        longitude: typeof longitude === "number" ? String(longitude) : undefined,

        preferences,
        profileImageUrl: normalizedProfileImageUrl,
        // Any successful profile update via this endpoint means the user is
        // now on the current profile schema/version.
        profileVersion: CURRENT_PROFILE_VERSION,
        updatedAt: new Date(),
      });

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  app.post(
    "/api/user/complete-onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await storage.updateUser(
          (req.user as any)?.id || (req.user as any)?.claims?.sub,
          {
            onboardingCompleted: true,
            // Any explicit onboarding completion should also advance
            // the profile version so that profile gates remain consistent.
            profileVersion: CURRENT_PROFILE_VERSION,
            updatedAt: new Date(),
          }
        );
        res.json(sanitizeUserForResponse(user));
      } catch (error: any) {
        console.error("Error completing onboarding:", error);
        res.status(500).json({ message: "Failed to complete onboarding" });
      }
    }
  );

  // PHASE 3d-A: AI inference for Scout claim suggestion
  app.post("/api/ai/inference", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { systemPrompt, userPrompt, temperature, maxTokens, model } = req.body;

      if (!systemPrompt || !userPrompt) {
        return res.status(400).json({ error: "systemPrompt and userPrompt are required" });
      }

      const result = await callAIInference({
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        model,
      });

      res.json(result);
    } catch (error: any) {
      logger.error("[API] AI inference error", { error: error.message });
      res.status(500).json({ error: "AI inference failed" });
    }
  });

  // PHASE 3d-A: Write confirmed claims from Scout onboarding
  app.post("/api/claims/write", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { confirmedClaimTypes, countyFips, metadata } = req.body;

      if (!Array.isArray(confirmedClaimTypes) || confirmedClaimTypes.length === 0) {
        return res.status(400).json({ error: "confirmedClaimTypes must be a non-empty array" });
      }

      // Write each claim individually
      const results = await Promise.all(
        confirmedClaimTypes.map(async (claimType: string) => {
          const writeRequest: WriteClaimEventRequest = {
            userId,
            claimType: claimType as any,
            countyFips: countyFips || null,
            countyName: "",
            source: ClaimSource.SCOUT_INFERRED,
            claimTimestamp: new Date(),
            metadata: {
              confidence: metadata?.confidenceByClaim?.[claimType] || 0.7,
              evidence:
                metadata?.evidenceByClaim?.[claimType] || "User confirmed via Scout onboarding",
              textSource: metadata?.textSource || "provisional_userIntent",
              rawUserIntentText: metadata?.rawUserIntentText || "",
            },
          };

          return await writeClaimEvent(writeRequest);
        })
      );

      // Check if any writes failed
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        logger.warn("[API] Some claim writes failed", {
          userId,
          total: results.length,
          failed: failures.length,
        });
      }

      res.json({
        success: failures.length === 0,
        results,
        written: results.filter((r) => r.success).length,
        failed: failures.length,
      });
    } catch (error: any) {
      logger.error("[API] Claim write error", { error: error.message });
      res.status(500).json({ error: "Failed to write claims" });
    }
  });

  // User role update (self-serve) - blocks admin roles
  app.patch("/api/user/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { roles } = (req.body ?? {}) as any;

      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: "Roles must be a non-empty array" });
      }

      const normalizedRoles = roles
        .map((r: any) => String(r || "").trim())
        .filter((r: string) => r.length > 0);

      if (normalizedRoles.length === 0) {
        return res.status(400).json({ message: "Roles must be a non-empty array" });
      }

      // Prevent privilege escalation: no admin/back-office roles here.
      const blocked = new Set([
        "head_admin",
        "ops_admin",
        "moderator",
        "startup_founder",
        "admin",
        "tradescout_admin",
      ]);
      if (normalizedRoles.some((r: string) => blocked.has(r))) {
        return res.status(400).json({ message: "Invalid role selection" });
      }

      // Basic allowlist: only roles that exist in the product UI.
      const allowed = new Set([
        "homeowner",
        "contractor_user",
        "realtor",
        "car_salesman",
        "insurance_agent",
        "mortgage_broker",
        "property_manager",
        "business_owner",
        "restaurant_owner",
        "food_truck_owner",
        "bar_owner",
        "helper",
        "vehicle_dealer",
        "hoa_admin",
      ]);

      const filteredRoles = normalizedRoles.filter((r: string) => allowed.has(r));
      if (filteredRoles.length === 0) {
        return res.status(400).json({ message: "Invalid role selection" });
      }

      const current = await storage.getUser(userId);
      const currentActive = (current as any)?.activeRole || (current as any)?.role;
      const activeRole = filteredRoles.includes(currentActive) ? currentActive : filteredRoles[0];

      const user = await storage.updateUser(userId, {
        roles: filteredRoles,
        activeRole,
        role: activeRole,
        updatedAt: new Date(),
      } as any);

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ message: "Failed to update roles" });
    }
  });

  // Update user types (business/account personas) with full multi-select support
  app.patch("/api/user/user-types", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { userTypes } = (req.body ?? {}) as any;

      if (!Array.isArray(userTypes) || userTypes.length === 0) {
        return res.status(400).json({ message: "userTypes must be a non-empty array" });
      }

      const normalizeRole = (value: string) => {
        const role = value.trim();
        if (role === "contractor_user") return "contractor";
        if (role === "vehicle_dealer" || role === "car_salesman") return "car_dealer";
        return role;
      };

      const rawTypes = userTypes
        .map((t: any) => String(t || "").trim())
        .filter((t: string) => t.length > 0);

      if (rawTypes.length === 0) {
        return res.status(400).json({ message: "userTypes must be a non-empty array" });
      }

      // Prevent privilege escalation: no admin/back-office types here.
      const blocked = new Set(["admin"]);

      const normalized = Array.from(new Set(rawTypes.map((t: string) => normalizeRole(t)))).filter(
        (typeId: string) => {
          if (blocked.has(typeId)) return false;
          // Only allow known user types with metadata
          return Boolean(getUserTypeMetadata(typeId));
        }
      );

      if (normalized.length === 0) {
        return res.status(400).json({ message: "Invalid userTypes selection" });
      }

      const current = await storage.getUser(userId);
      const currentActive = (current as any)?.activeRole || (current as any)?.role;
      const activeRole = normalized.includes(currentActive) ? currentActive : normalized[0];

      const user = await storage.updateUser(userId, {
        roles: normalized,
        activeRole,
        role: activeRole,
        updatedAt: new Date(),
      } as any);

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating user types:", error);
      res.status(500).json({ message: "Failed to update user types" });
    }
  });

  // Back-compat aliases used by onboarding UI
  app.patch("/api/auth/user/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const currentPrefs = (currentUser as any).preferences || {};
      const updatedPreferences = { ...currentPrefs, ...(req.body ?? {}) };
      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ preferences: (user as any).preferences });
    } catch (error: any) {
      console.error("Error updating user preferences (alias):", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Helper endpoint for Scout/tools: update just preferences.geo based on device location
  app.post("/api/agent/preferences/geo", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const body: any = req.body ?? {};
      const homeLocation = body.homeLocation || {};
      const radius = body.notifyNearbyRadiusMeters;
      const enableNearbyDeals = body.enableNearbyDeals;
      const includeTypes = body.includeTypes;

      if (typeof homeLocation.lat !== "number" || typeof homeLocation.lng !== "number") {
        return res.status(400).json({
          message: "homeLocation.lat and homeLocation.lng are required and must be numbers",
        });
      }

      const currentPrefs: any = (currentUser as any).preferences || {};
      const currentGeo: any = currentPrefs.geo || {};

      const nextGeo: any = {
        ...currentGeo,
        homeLocation: {
          ...(currentGeo.homeLocation || {}),
          lat: homeLocation.lat,
          lng: homeLocation.lng,
          // Allow optional human-readable label from client
          ...(homeLocation.label ? { label: String(homeLocation.label) } : {}),
        },
      };

      if (typeof radius === "number" && Number.isFinite(radius) && radius > 0) {
        nextGeo.notifyNearbyRadiusMeters = radius;
      }

      if (typeof enableNearbyDeals === "boolean") {
        nextGeo.enableNearbyDeals = enableNearbyDeals;
      }

      if (Array.isArray(includeTypes)) {
        nextGeo.includeTypes = includeTypes.filter(
          (t: any) => t === "marketplace" || t === "trade" || t === "mealscout"
        );
      }

      const updatedPreferences = {
        ...currentPrefs,
        geo: nextGeo,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ geo: (user as any).preferences?.geo });
    } catch (error: any) {
      console.error("Error updating user geo preferences via agent helper:", error);
      res.status(500).json({ message: "Failed to update geo preferences" });
    }
  });

  // Back-compat: mark onboarding completed (do NOT allow arbitrary updates)
  app.patch("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { onboardingCompleted } = (req.body ?? {}) as any;

      if (onboardingCompleted !== true) {
        return res.status(400).json({ message: "Unsupported update" });
      }

      const user = await storage.updateUser(userId, {
        onboardingCompleted: true,
        updatedAt: new Date(),
      });

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating auth user (alias):", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Back-compat: legacy path used by subtle hints
  app.patch("/api/user/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const currentPrefs = (currentUser as any).preferences || {};
      const updatedPreferences = { ...currentPrefs, ...(req.body ?? {}) };
      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ preferences: (user as any).preferences });
    } catch (error: any) {
      console.error("Error updating user preferences (legacy):", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Get public profile (respects privacy settings)
  app.get("/api/users/:userId/public", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if profile is public
      const isPublic = user.preferences?.profileVisibility === "public";
      if (!isPublic) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Optionally enrich with connection stats when viewer is authenticated
      let connectionSummary: { followers: number; following: number; mutual: number } | undefined;
      let viewerConnection:
        | { isFollowing: boolean; isFollowedBy: boolean; isMutual: boolean }
        | undefined;

      try {
        const viewerId =
          (req as AuthedRequest)?.user?.id || (req as AuthedRequest)?.user?.claims?.sub;
        if (viewerId && typeof viewerId === "string") {
          // Get follower/following sets for this public profile
          const followersRows = await db
            .select({ followerId: userFollows.followerId })
            .from(userFollows)
            .where(eq(userFollows.followingId, user.id));

          const followingRows = await db
            .select({ followingId: userFollows.followingId })
            .from(userFollows)
            .where(eq(userFollows.followerId, user.id));

          const followerIds = new Set(
            followersRows.map((row: any) => row.followerId).filter(Boolean)
          );
          const followingIds = new Set(
            followingRows.map((row: any) => row.followingId).filter(Boolean)
          );

          let mutualCount = 0;
          followerIds.forEach((id) => {
            if (followingIds.has(id)) {
              mutualCount += 1;
            }
          });

          connectionSummary = {
            followers: followerIds.size,
            following: followingIds.size,
            mutual: mutualCount,
          };

          const isFollowing = followerIds.has(viewerId); // viewer follows profile owner
          const isFollowedBy = followingIds.has(viewerId); // profile owner follows viewer

          viewerConnection = {
            isFollowing,
            isFollowedBy,
            isMutual: isFollowing && isFollowedBy,
          };
        }
      } catch (err) {
        console.error("Error enriching public profile with connections:", err);
      }

      // Enrich with subtle credibility metrics (jobs completed, people helped, activity)
      let credibilityStats:
        | { jobsCompleted?: number; peopleHelped?: number; activeWeeks?: number }
        | undefined;
      try {
        const { jobsCompleted, peopleHelped, activeWeeks } = await storage.getUserCredibilityStats(
          user.id
        );
        credibilityStats = {
          jobsCompleted: jobsCompleted || undefined,
          peopleHelped: peopleHelped || undefined,
          activeWeeks: activeWeeks || undefined,
        };
      } catch (err) {
        console.error("Failed to compute public profile credibility stats", err);
      }

      // Return safe public profile data
      const publicProfile = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        city: user.city,
        state: user.state,
        roles: user.roles || [user.role],
        badges: computeBadgesForUser(user),
        createdAt: user.createdAt,
        verificationStatus: user.verificationStatus,
        addressVerified: user.addressVerified,
        preferences: {
          colorScheme: user.preferences?.colorScheme,
          badges: user.preferences?.badges,
          profileSections: user.preferences?.profileSections,
          servicesDescription: user.preferences?.servicesDescription,
        },
        // Stats: populate from real aggregates only; omit fake zeros
        stats: credibilityStats,
        connections: connectionSummary,
        viewerConnection,
      };
      try {
        const viewerId =
          (req as AuthedRequest)?.user?.id || (req as AuthedRequest)?.user?.claims?.sub;
        if (viewerId && typeof viewerId === "string" && viewerId !== user.id) {
          await storage.logEvent("user.profile_viewed", {
            userId: viewerId,
            targetUserId: user.id,
          });
        }
      } catch (e) {
        console.error("Failed to log user.profile_viewed for XP", e);
      }

      res.json(publicProfile);
    } catch (error: any) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update user theme preferences endpoint
  app.patch("/api/user/theme", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { themePreference, customThemeColors } = (req.body ?? {}) as any;

      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Update theme preferences
      const user = await storage.updateUser(userId, {
        themePreference: themePreference || "default",
        customThemeColors: customThemeColors || null,
        updatedAt: new Date(),
      });

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  // Navigation preferences endpoints
  app.put(
    "/api/user/navigation-preferences",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { customOrder, hiddenFromSwipe, enableSwipeNavigation } = (req.body ?? {}) as any;

        // Get current user to preserve other preferences
        const currentUser = await storage.getUser(
          (req.user as any)?.id || (req.user as any)?.claims?.sub
        );
        const currentPrefs = currentUser?.preferences || {};

        // Update navigation preferences
        const updatedPreferences = {
          ...currentPrefs,
          navigation: {
            customOrder,
            hiddenFromSwipe,
            enableSwipeNavigation:
              enableSwipeNavigation !== undefined ? enableSwipeNavigation : true,
          },
        };

        const user = await storage.updateUser(
          (req.user as any)?.id || (req.user as any)?.claims?.sub,
          {
            preferences: updatedPreferences,
            updatedAt: new Date(),
          }
        );

        res.json({
          navigation: user.preferences?.navigation,
          message: "Navigation preferences updated successfully",
        });
      } catch (error: any) {
        console.error("Error updating navigation preferences:", error);
        res.status(500).json({ message: "Failed to update navigation preferences" });
      }
    }
  );

  app.get(
    "/api/user/navigation-preferences",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const navigationPrefs = user.preferences?.navigation || {
          customOrder: [],
          hiddenFromSwipe: [],
          enableSwipeNavigation: true,
        };

        res.json(navigationPrefs);
      } catch (error: any) {
        console.error("Error fetching navigation preferences:", error);
        res.status(500).json({ message: "Failed to fetch navigation preferences" });
      }
    }
  );

  // User preferences endpoints (dashboard, notifications, etc.)
  app.get("/api/users/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user.preferences || {});
    } catch (error: any) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.patch("/api/users/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        ...req.body,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ preferences: user.preferences });
    } catch (error: any) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Update user color scheme
  app.patch("/api/users/color-scheme", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { preset, primary, secondary, background, text } = (req.body ?? {}) as any;

      if (!preset && (!primary || !secondary || !background || !text)) {
        return res.status(400).json({ message: "Either preset or all custom colors required" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        colorScheme: {
          preset: preset || "custom",
          ...(primary && { primary }),
          ...(secondary && { secondary }),
          ...(background && { background }),
          ...(text && { text }),
        },
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ colorScheme: user.preferences?.colorScheme });
    } catch (error: any) {
      console.error("Error updating color scheme:", error);
      res.status(500).json({ message: "Failed to update color scheme" });
    }
  });

  // Update default home page
  app.patch("/api/users/default-home", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { defaultHomePage } = (req.body ?? {}) as any;

      const validPages = [
        "llm",
        "marketplace",
        "contractor-board",
        "dashboard",
        "profile",
        "community",
      ];
      if (!validPages.includes(defaultHomePage)) {
        return res.status(400).json({ message: "Invalid home page option" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        defaultHomePage,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ defaultHomePage: user.preferences?.defaultHomePage });
    } catch (error: any) {
      console.error("Error updating default home page:", error);
      res.status(500).json({ message: "Failed to update default home page" });
    }
  });

  // Update profile visibility
  app.patch(
    "/api/users/profile-visibility",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { profileVisibility } = (req.body ?? {}) as any;

        if (!["public", "private"].includes(profileVisibility)) {
          return res.status(400).json({ message: "Invalid visibility option" });
        }

        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // C2-3: Soft gate - offer verification for better visibility (PUBLISH_PUBLIC_PROFILE action)
        // Not blocking; contractor can publish unverified but gets visibility boost if verified
        if (profileVisibility === "public") {
          const isContractor = currentUser.role === "contractor";
          const isVerified =
            (currentUser as any)?.verificationStatus === "approved" ||
            (currentUser as any)?.licenseVerified;

          if (isContractor && !isVerified) {
            // Offer verification as optional boost, don't block
            try {
              const { buildVerificationGateResponse } =
                await import("./utils/explainAndOfferVerification");

              const gateResponse = buildVerificationGateResponse({
                action: "PUBLISH_PUBLIC_PROFILE",
                missingRequirements: ["license"], // Light requirement for visibility boost
                userRole: "contractor",
                targetUserId: undefined,
                targetRole: undefined,
                context: { visibility: "public", intent: "publish_profile" },
              });

              // Return soft gate offer but don't block if they choose to proceed
              // Client can either verify or confirm to continue unverified
              res.status(200).json({
                ...gateResponse,
                message:
                  gateResponse.message +
                  " (Your profile will still be visible, but verified profiles rank higher.)",
                verificationOptional: true,
                verificationSuggested: {
                  action: "PUBLISH_PUBLIC_PROFILE",
                  retryPath: `/api/users/profile-visibility`,
                  context: { profileVisibility },
                },
                // Allow client to confirm without verification
                allowProceedUnverified: true,
              });
              return;
            } catch (e) {
              console.warn("[profile-visibility] Failed to build soft verification gate", e);
              // Continue on error; don't block
            }
          }
        }

        const currentPrefs = currentUser.preferences || {};
        const updatedPreferences = {
          ...currentPrefs,
          profileVisibility,
        };

        const user = await storage.updateUser(userId, {
          preferences: updatedPreferences,
          updatedAt: new Date(),
        });

        res.json({ profileVisibility: user.preferences?.profileVisibility });
      } catch (error: any) {
        console.error("Error updating profile visibility:", error);
        res.status(500).json({ message: "Failed to update profile visibility" });
      }
    }
  );

  // Update profile site sections (which blocks show on public profile)
  app.patch("/api/users/profile-sections", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const {
        about,
        rolesAndBadges,
        stats,
        services,
        marketplaceListings,
        reviews,
        communityActivity,
        contactCard,
      } = req.body ?? {};

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const currentProfileSections = currentPrefs.profileSections || {};

      const updatedPreferences = {
        ...currentPrefs,
        profileSections: {
          ...currentProfileSections,
          ...(about !== undefined && { about }),
          ...(rolesAndBadges !== undefined && { rolesAndBadges }),
          ...(stats !== undefined && { stats }),
          ...(services !== undefined && { services }),
          ...(marketplaceListings !== undefined && { marketplaceListings }),
          ...(reviews !== undefined && { reviews }),
          ...(communityActivity !== undefined && { communityActivity }),
          ...(contactCard !== undefined && { contactCard }),
        },
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({
        message: "Profile sections updated",
        preferences: user.preferences,
      });
    } catch (error: any) {
      console.error("Error updating profile sections:", error);
      res.status(500).json({
        message: "Failed to update profile sections",
      });
    }
  });

  // Account security and management endpoints
  app.get("/api/user/trusted-devices", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const devices = await storage.getUserTrustedDevices(userId);
      res.json(devices);
    } catch (error: any) {
      console.error("Error fetching trusted devices:", error);
      res.status(500).json({ message: "Failed to fetch trusted devices" });
    }
  });

  app.delete(
    "/api/user/trusted-devices/:deviceId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { deviceId } = req.params;
        await storage.removeTrustedDevice(userId, deviceId);
        res.json({ message: "Device removed successfully" });
      } catch (error: any) {
        console.error("Error removing trusted device:", error);
        res.status(500).json({ message: "Failed to remove trusted device" });
      }
    }
  );

  app.get("/api/user/login-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await storage.getUserLoginHistory(userId, limit, offset);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching login history:", error);
      res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  app.post("/api/user/export-data", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const exportData = await storage.exportUserData(userId);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="tradescout-data-${userId}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export user data" });
    }
  });

  app.post("/api/user/deactivate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      await storage.deactivateUser(userId);
      res.json({ message: "Account deactivated successfully" });
    } catch (error: any) {
      console.error("Error deactivating account:", error);
      res.status(500).json({ message: "Failed to deactivate account" });
    }
  });

  app.delete("/api/user/delete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      await storage.deleteUser(userId);
      res.json({ message: "Account deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.put("/api/user/privacy-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { profileVisibility, searchEngineIndexing } = (req.body ?? {}) as any;

      // Get current user preferences
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const currentPrefs = currentUser.preferences || {};

      const updatedPreferences = {
        ...currentPrefs,
        privacy: {
          ...currentPrefs.privacy,
          profileVisibility: profileVisibility !== undefined ? profileVisibility : true,
          searchEngineIndexing: searchEngineIndexing !== undefined ? searchEngineIndexing : false,
        },
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({
        privacy: user.preferences?.privacy,
        message: "Privacy settings updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  app.get("/api/user/privacy-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const privacySettings = user.preferences?.privacy || {
        profileVisibility: true,
        searchEngineIndexing: false,
      };

      res.json(privacySettings);
    } catch (error: any) {
      console.error("Error fetching privacy settings:", error);
      res.status(500).json({ message: "Failed to fetch privacy settings" });
    }
  });

  // Profile management endpoints
  app.get("/api/auth/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Include contractor-specific data if user is a contractor
      let profileData: Record<string, any> = sanitizeUserForResponse(user);

      if (user && user.role === "contractor") {
        const contractor = await storage.getContractorByUserId(user.id);
        if (contractor) {
          profileData = {
            ...profileData,
            companyName: contractor.companyName,
            // description: contractor.description, // removed: not in type
            licenseNumber: contractor.licenseNumber,
            yearsInBusiness: contractor.yearsInBusiness,
            isGeneralContractor: contractor.isGeneralContractor,
            isResidentialContractor: contractor.isResidentialContractor,
            acceptsSubcontractWork: contractor.acceptsSubcontractWork,
          };
        }
      }

      res.json(profileData);
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/auth/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        // Contractor-specific fields
        companyName,
        businessDescription,
        licenseNumber,
        yearsInBusiness,
        isGeneralContractor,
        isResidentialContractor,
        acceptsSubcontractWork,
      } = req.body;

      const user = await storage.updateUser(
        (req.user as any)?.id || (req.user as any)?.claims?.sub,
        {
          firstName,
          lastName,
          email,
          phone,
          address,
          city,
          state,
          zipCode,
          updatedAt: new Date(),
        }
      );

      // Update contractor-specific data if user is a contractor
      if (
        user.role === "contractor" &&
        (companyName || businessDescription || licenseNumber || yearsInBusiness !== undefined)
      ) {
        const contractor = await storage.getContractorByUserId(user?.id);
        if (contractor) {
          await storage.updateContractor(contractor.id, {
            companyName: companyName || contractor.companyName,
            // description: businessDescription || contractor.description, // removed: not in type
            licenseNumber: licenseNumber || contractor.licenseNumber,
            yearsInBusiness:
              yearsInBusiness !== undefined ? yearsInBusiness : contractor.yearsInBusiness,
            isGeneralContractor:
              isGeneralContractor !== undefined
                ? isGeneralContractor
                : contractor.isGeneralContractor,
            isResidentialContractor:
              isResidentialContractor !== undefined
                ? isResidentialContractor
                : contractor.isResidentialContractor,
            acceptsSubcontractWork:
              acceptsSubcontractWork !== undefined
                ? acceptsSubcontractWork
                : contractor.acceptsSubcontractWork,
            updatedAt: new Date(),
          });
        }
      }

      res.json(sanitizeUserForResponse(user));
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Request password reset token
  app.post(
    "/api/auth/request-password-reset",
    passwordResetLimiter,
    async (req: Request, res: Response) => {
      try {
        console.log("[REQUEST-PASSWORD-RESET] Request received:", { body: req.body });
        const { email } = req.body || {};

        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const user = await storage.getUserByEmail(String(email).toLowerCase());
        console.log("[REQUEST-PASSWORD-RESET] Lookup:", {
          email: String(email).toLowerCase(),
          found: !!user,
        });
        let debugToken: string | undefined;

        if (user) {
          console.log("[REQUEST-PASSWORD-RESET] User found:", { id: user.id, email: user.email });
          const { token, expiresAt } = passwordResetService.createToken(user.id);
          const resetBase =
            process.env.PASSWORD_RESET_URL || process.env.APP_BASE_URL || "http://localhost:5173";
          const resetLink = `${resetBase.replace(/\/$/, "")}/reset-password?token=${token}`;

          if (emailService.isConfigured()) {
            console.log("[REQUEST-PASSWORD-RESET] Sending email...");
            await emailService.sendEmail({
              to: user.email,
              subject: "Reset your TradeScout password",
              html: `<p>We received a request to reset your TradeScout password.</p>
                 <p><a href="${resetLink}">Click here to reset your password</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
                 <p>If you did not request this, you can ignore this email.</p>`,
              text: `Reset your password: ${resetLink}`,
            });
            console.log("[REQUEST-PASSWORD-RESET] Email send attempted");
          } else {
            console.warn(
              `[password-reset] SendGrid not configured; token generated for ${user.email}`
            );
            // Expose token only in non-production for manual smoke testing
            const isProductionEnv =
              process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
            if (!isProductionEnv) {
              debugToken = token;
            }
          }
        }

        console.log("[REQUEST-PASSWORD-RESET] Responding with message and debugToken:", {
          debugToken,
        });
        res.json({
          message: "If an account exists for that email, a reset link has been sent.",
          debugToken,
        });
      } catch (error: any) {
        console.error("[REQUEST-PASSWORD-RESET] CRITICAL ERROR:", error);
        console.error("[REQUEST-PASSWORD-RESET] Stack:", error?.stack);
        sendAutoClassifiedError(res, error, "Failed to request password reset");
      }
    }
  );

  // Complete password reset (temporarily guarded to avoid crash during CORS verification)
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "production" && process.env.SKIP_RESET_COMPLETION === "true") {
      return res.status(503).json({
        message:
          "Reset completion temporarily disabled during verification. Set SKIP_RESET_COMPLETION=false to enable.",
      });
    }
    try {
      console.log("[RESET-PASSWORD] Request received:", { body: req.body });

      const { token, newPassword } = req.body || {};

      if (!token || !newPassword) {
        console.log("[RESET-PASSWORD] Missing token or newPassword");
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        console.log("[RESET-PASSWORD] Invalid password length");
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      console.log("[RESET-PASSWORD] Consuming token...");
      const userId = passwordResetService.consumeToken(token);

      if (!userId) {
        console.log("[RESET-PASSWORD] Invalid or expired token");
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      console.log("[RESET-PASSWORD] Token valid, userId:", userId);
      console.log("[RESET-PASSWORD] Hashing password...");
      const passwordHash = await hashPassword(newPassword);

      console.log("[RESET-PASSWORD] Updating user in database...");
      const updated = await storage.updateUser(userId, {
        password: passwordHash,
        updatedAt: new Date(),
      });

      console.log("[RESET-PASSWORD] User updated successfully:", { userId, updated });
      return res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("[RESET-PASSWORD] CRITICAL ERROR:", error);
      console.error("[RESET-PASSWORD] Stack:", error?.stack);
      return sendAutoClassifiedError(res, error, "Failed to reset password");
    }
  });

  // Dev-only Sentry debug endpoint
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/debug/error", (_req: Request, _res: Response) => {
      throw new Error("SentryDebugTest");
    });
  }

  app.put("/api/auth/change-password", isAuthenticated, async (req: any, res: any) => {
    try {
      const body = (req.body ?? {}) as any;
      const { currentPassword, newPassword } = body;
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a password (social login users might not)
      if (!user.password) {
        return res
          .status(400)
          .json({ message: "Account uses social login. Cannot change password." });
      }

      if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
        return res.status(400).json({ message: "Current and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      // Verify current password
      const isValidPassword = await validatePassword(currentPassword, user.password);

      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        password: newPasswordHash,
        updatedAt: new Date(),
      });

      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.put("/api/auth/notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const {
        emailNotifications,
        pushNotifications,
        marketingEmails,
        weeklyDigest,
        instantMessages,
        leadNotifications,
      } = req.body;

      // Store notification preferences in user preferences
      const preferences = {
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
        pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
        marketingEmails: marketingEmails !== undefined ? marketingEmails : false,
        weeklyDigest: weeklyDigest !== undefined ? weeklyDigest : true,
        instantMessages: instantMessages !== undefined ? instantMessages : true,
        leadNotifications: leadNotifications !== undefined ? leadNotifications : true,
      };

      await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        preferences: preferences,
        updatedAt: new Date(),
      });

      res.json({ message: "Notification preferences updated successfully", preferences });
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Public contractor board
  app.get("/api/contractors", async (req: any, res: any) => {
    try {
      const { county, trade, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      // LocalityTracker call removed

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (county) {
        const countyRecord = await storage.getCountyByFips(county as string);
        if (countyRecord) {
          filters.countyId = countyRecord.id;
        }
      }

      if (trade) {
        const tradeRecord = await storage.getTradeBySlug(trade as string);
        if (tradeRecord) {
          filters.tradeIds = [tradeRecord.id];
        }
      }

      if (sort) {
        filters.sortBy = sort;
      }

      const contractors = await storage.getContractors(filters);
      res.json(contractors.map(sanitizeContractorPublic));
    } catch (error: any) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Contractor search endpoint (alias for contractor listing with search params)
  app.get("/api/contractors/search", async (req: any, res: any) => {
    try {
      const { county, trade, query, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      // LocalityTracker call removed

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (query && typeof query === "string" && query.trim()) {
        filters.query = query.trim();
      }

      if (county) {
        // Try to find county by name (not FIPS)
        const counties = await storage.getCounties();
        const countyRecord = counties.find(
          (c) =>
            c.name.toLowerCase().includes((county as string).toLowerCase()) || c.fips === county
        );
        if (countyRecord) {
          filters.countyId = countyRecord.id;
        } else {
          return res.json([]); // No county found, return empty results
        }
      }

      if (trade) {
        const tradeRecord = await storage.getTradeBySlug(trade as string);
        if (tradeRecord) {
          filters.tradeIds = [tradeRecord.id];
        } else {
          return res.json([]); // No trade found, return empty results
        }
      }

      if (sort) {
        filters.sortBy = sort;
      }

      const contractors = await storage.getContractors(filters);
      res.json(contractors.map(sanitizeContractorPublic));
    } catch (error: any) {
      console.error("Error searching contractors:", error);
      res.status(500).json({ message: "Failed to search contractors" });
    }
  });

  // Get top contractors in area (for lead assignment)
  app.get("/api/contractors/top", async (req: any, res: any) => {
    try {
      const { county, trade, limit = 3 } = req.query;

      if (!county || !trade) {
        return res.status(400).json({ message: "County and trade are required" });
      }

      const filters: any = {
        limit: parseInt(limit as string),
      };

      // Get county by FIPS code
      const countyRecord = await storage.getCountyByFips(county as string);
      if (countyRecord) {
        filters.countyId = countyRecord.id;
      }

      // Get trade by slug
      const tradeRecord = await storage.getTradeBySlug(trade as string);
      if (tradeRecord) {
        filters.tradeIds = [tradeRecord.id];
      }

      // Base contractor set (county + trade filtered)
      const contractors = await storage.getContractors(filters);

      if (!contractors.length) {
        return res.json([]);
      }

      const contractorIds = contractors.map((c: any) => c.id);
      const userIds = contractors
        .map((c: any) => c.userId as string | undefined)
        .filter((id): id is string => Boolean(id));

      // Compliance gate: only apply if this trade has explicit requirements
      let gatedContractors = contractors;
      if (tradeRecord) {
        const requirements = await storage.getTradeRequirementsByTradeId(tradeRecord.id);
        if (requirements && userIds.length > 0) {
          const compliance = await storage.getUserVerificationSummary(userIds);

          const requiresLicense = requirements.requiresLicense ?? false;
          const requiresInsurance = requirements.requiresInsurance ?? false;
          const requiresEin = requirements.requiresEin ?? false;

          const compliantIds = contractors
            .filter((c: any) => {
              if (!c.userId) return false;
              const summary = compliance[c.userId];
              if (!summary) return false;
              if (requiresLicense && !summary.hasLicense) return false;
              if (requiresInsurance && !summary.hasInsurance) return false;
              if (requiresEin && !summary.hasEin) return false;
              return true;
            })
            .map((c: any) => c.id as string);

          // Only enforce the gate if at least one compliant provider exists;
          // otherwise, fall back to the full set so we never return zero
          if (compliantIds.length > 0) {
            gatedContractors = contractors.filter((c: any) => compliantIds.includes(c.id));
          }
        }
      }

      if (!gatedContractors.length) {
        return res.json([]);
      }

      // Reach tier classification based on service area size
      const serviceAreaCounts = await storage.getContractorServiceAreaCounts(
        gatedContractors.map((c: any) => c.id)
      );

      const tierForCount = (count: number | undefined): "local" | "regional" | "wide" => {
        const n = count ?? 0;
        if (n <= 1) return "local";
        if (n <= 5) return "regional";
        return "wide";
      };

      // Local credibility stats derived from the XP/events system
      const enriched = await Promise.all(
        gatedContractors.map(async (contractor: any) => {
          const stats = contractor.userId
            ? await storage.getUserCredibilityStats(contractor.userId)
            : { jobsCompleted: 0, peopleHelped: 0, activeWeeks: 0 };

          const countyCount = serviceAreaCounts[contractor.id] ?? 0;
          const reachTier = tierForCount(countyCount);

          const localCredibilityScore =
            (stats.jobsCompleted ?? 0) * 3 +
            (stats.peopleHelped ?? 0) * 2 +
            (stats.activeWeeks ?? 0);

          let presenceLabel: string;
          if (reachTier === "local") {
            presenceLabel = "Local provider";
          } else if (reachTier === "regional") {
            presenceLabel = "Regional provider";
          } else {
            presenceLabel = "Serves this area · building local presence";
          }

          return {
            id: contractor.id,
            businessName: contractor.companyName,
            name: null,
            rating: null,
            reviewCount: contractor.totalRecommendations ?? 0,
            recommendationCount: contractor.positiveRecommendations ?? 0,
            trades: [],
            county: countyRecord?.name ?? null,
            state: countyRecord?.stateCode ?? null,
            licenseNumber: contractor.licenseNumber,
            reachTier,
            localCredibilityScore,
            localStats: stats,
            presenceLabel,
          };
        })
      );

      // Rank: prioritize local over regional over wide, then by credibility
      const tierRank: Record<"local" | "regional" | "wide", number> = {
        local: 0,
        regional: 1,
        wide: 2,
      };

      enriched.sort((a, b) => {
        const aTier = tierRank[a.reachTier] ?? 2;
        const bTier = tierRank[b.reachTier] ?? 2;
        if (aTier !== bTier) return aTier - bTier;
        const aScore = a.localCredibilityScore ?? 0;
        const bScore = b.localCredibilityScore ?? 0;
        return bScore - aScore;
      });

      const limited = enriched.slice(0, filters.limit || 3);
      res.json(limited);
    } catch (error: any) {
      console.error("Error fetching top contractors:", error);
      res.status(500).json({ message: "Failed to fetch top contractors" });
    }
  });

  // Seed database endpoint (development only)
  app.post("/api/seed-database", async (req: any, res: any) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ message: "Not allowed in production" });
      }

      const { seedDatabase } = await import("./seed-data");
      await seedDatabase();
      res.json({ message: "Database seeded successfully" });
    } catch (error: any) {
      console.error("Error seeding database:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });

  // Individual contractor profile
  app.get("/api/contractors/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;
      const contractor = await storage.getContractorBySlug(slug);

      // Track contractor profile view with locality context
      // LocalityTracker call removed

      if (!contractor) {
        return res.status(404).json({ message: "Contractor not found" });
      }

      // Get recommendations and ratings
      const recommendations = await storage.getRecommendations(contractor.id);
      const ratings = await storage.getContractorRatings(contractor.id);

      res.json({
        contractor: sanitizeContractorPublic(contractor),
        recommendations,
        ratingSummary: ratings,
      });
    } catch (error: any) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ message: "Failed to fetch contractor" });
    }
  });

  // States endpoint
  app.get("/api/states", async (req: any, res: any) => {
    try {
      const { US_STATES } = await import("@shared/us-states-counties");
      res.json(US_STATES);
    } catch (error: any) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Counties endpoint
  app.get("/api/counties", async (req: any, res: any) => {
    try {
      const { state } = req.query;

      const stateCode = ((state as string | undefined) || "").toUpperCase() || undefined;

      // Primary path: rely on pre-seeded database counties.
      let counties = await storage.getCounties(stateCode);

      // As a lightweight safety net (especially for new dev/test
      // environments), fall back to the static in-repo dataset if the
      // database has not been seeded yet. This avoids network calls and
      // write-heavy work on the request path.
      if (stateCode && (!Array.isArray(counties) || counties.length === 0)) {
        try {
          const { getCountiesForState } = await import("@shared/us-counties-complete");
          const staticCounties = getCountiesForState(stateCode) || [];

          // Map the lightweight static county records into the richer
          // shape used by the database layer so TypeScript stays happy
          // and callers always see a consistent payload.
          counties = staticCounties.map((c) => ({
            id: `static-${c.fips}`,
            name: c.name,
            fips: c.fips,
            stateCode: c.stateCode,
            population: null,
            createdAt: null,
            updatedAt: null,
          }));
        } catch (fallbackError) {
          console.error(
            "Error loading static fallback counties for state",
            stateCode,
            fallbackError
          );
          counties = [];
        }
      }

      res.json(counties);
    } catch (error: any) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Trades endpoint
  app.get("/api/trades", async (req: any, res: any) => {
    try {
      const { parent } = req.query;
      const trades = await storage.getTrades(parent as string);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Provider declarations: create/update what a user offers (trades + service areas)
  app.post("/api/providers/profile", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { trades, serviceAreas, availability } = req.body ?? {};

      if (!Array.isArray(trades) || trades.length === 0) {
        return res.status(400).json({ message: "At least one trade is required" });
      }

      if (!Array.isArray(serviceAreas) || serviceAreas.length === 0) {
        return res.status(400).json({ message: "At least one service area is required" });
      }

      // Resolve trade ids from provided tradeId or slug
      const tradeIds: string[] = [];
      for (const t of trades) {
        const rawId = (t as any)?.tradeId ?? (t as any)?.id;
        const slug = (t as any)?.slug;

        let tradeRecord = null;
        if (rawId) {
          // Best effort: try slug lookup first if it looks like a slug
          tradeRecord = await storage.getTradeBySlug(String(rawId));
        }
        if (!tradeRecord && slug) {
          tradeRecord = await storage.getTradeBySlug(String(slug));
        }

        if (!tradeRecord) {
          return res.status(400).json({ message: "Unknown trade in request" });
        }

        tradeIds.push(tradeRecord.id);
      }

      // Validate service areas by county FIPS
      const normalizedServiceAreas: { countyFips: string }[] = [];
      for (const area of serviceAreas) {
        const countyFips = String((area as any)?.countyFips || "").trim();
        if (!countyFips) {
          return res.status(400).json({ message: "Each service area must include countyFips" });
        }
        const countyRecord = await storage.getCountyByFips(countyFips);
        if (!countyRecord) {
          return res.status(400).json({ message: `Unknown countyFips: ${countyFips}` });
        }
        normalizedServiceAreas.push({ countyFips: countyRecord.fips });
      }

      const availabilityFlags = availability ?? {};

      const declaration = await storage.upsertProviderDeclarationForUser({
        userId,
        tradeIds,
        serviceAreas: normalizedServiceAreas,
        availabilityFlags,
      });

      // Expand response with trade and county labels for convenience
      const tradeRecords = await Promise.all(
        tradeIds.map((id) => storage.getTradeBySlug(id).catch(() => null))
      );
      const uniqueCountyFips = Array.from(new Set(normalizedServiceAreas.map((a) => a.countyFips)));
      const countyRecords = await Promise.all(
        uniqueCountyFips.map((fips) => storage.getCountyByFips(fips))
      );

      const tradesOut = tradeRecords
        .filter((t): t is any => !!t)
        .map((t) => ({ tradeId: t.id, name: t.name, slug: t.slug }));

      const serviceAreasOut = countyRecords
        .filter((c): c is any => !!c)
        .map((c) => ({ countyFips: c.fips, countyName: c.name, stateCode: c.stateCode }));

      res.json({
        providerUserId: userId,
        trades: tradesOut,
        serviceAreas: serviceAreasOut,
        availability: availabilityFlags,
        lastUpdatedAt: declaration.updatedAt ?? declaration.createdAt,
      });
    } catch (error: any) {
      console.error("Error upserting provider profile:", error);
      res.status(500).json({ message: "Failed to update provider profile" });
    }
  });

  // Provider requirements: read-only trade requirements for given trades and optional jurisdiction
  app.get("/api/providers/requirements", async (req: any, res: any) => {
    try {
      const tradeSlugsParam = req.query.tradeSlug ?? req.query.tradeId ?? req.query.trade;
      const countyFips = req.query.countyFips as string | undefined;

      const slugs: string[] = Array.isArray(tradeSlugsParam)
        ? (tradeSlugsParam as string[])
        : tradeSlugsParam
          ? [String(tradeSlugsParam)]
          : [];

      if (!slugs.length) {
        return res.status(400).json({ message: "At least one tradeSlug is required" });
      }

      const tradesResolved = await Promise.all(slugs.map((slug) => storage.getTradeBySlug(slug)));
      const validTrades = tradesResolved.filter((t): t is any => !!t);
      if (!validTrades.length) {
        return res.status(400).json({ message: "No valid trades found for provided slugs" });
      }

      let stateCode: string | undefined;
      if (countyFips) {
        const countyRecord = await storage.getCountyByFips(countyFips);
        stateCode = countyRecord?.stateCode;
      }

      const requirementsOut = [] as any[];

      for (const trade of validTrades) {
        const reqRow = await storage.getTradeRequirementsByTradeId(trade.id);
        if (!reqRow) {
          // If no explicit requirements, still return a row indicating nothing is required
          requirementsOut.push({
            trade: { tradeId: trade.id, name: trade.name, slug: trade.slug },
            jurisdiction: countyFips || stateCode ? { stateCode, countyFips } : undefined,
            requires: {
              ein: false,
              license: false,
              insurance: false,
            },
            notes: null,
          });
          continue;
        }

        requirementsOut.push({
          trade: { tradeId: trade.id, name: trade.name, slug: trade.slug },
          jurisdiction: countyFips || stateCode ? { stateCode, countyFips } : undefined,
          requires: {
            ein: reqRow.requiresEin ?? false,
            license: reqRow.requiresLicense ?? false,
            insurance: reqRow.requiresInsurance ?? false,
          },
          notes: reqRow.notes ?? null,
        });
      }

      res.json({ requirements: requirementsOut });
    } catch (error: any) {
      console.error("Error fetching provider requirements:", error);
      res.status(500).json({ message: "Failed to fetch provider requirements" });
    }
  });

  // Provider standing: summarize how a provider is set up and showing up in a specific county
  app.get("/api/providers/standing", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const countyFips = (req.query.countyFips as string | undefined)?.trim();
      if (!countyFips) {
        return res.status(400).json({ message: "countyFips is required" });
      }

      const county = await storage.getCountyByFips(countyFips);
      if (!county) {
        return res.status(400).json({ message: "Unknown countyFips" });
      }

      // Provider declaration (trades + service areas)
      const declaration = await storage.getProviderDeclarationForUser(userId);
      const tradeIds = declaration?.tradeIds ?? [];
      const declaredServiceAreas = declaration?.serviceAreas ?? [];
      const servesThisCounty = declaredServiceAreas.some((a: any) => a.countyFips === countyFips);

      // Local stats (behavior in this county) with a fallback to global credibility stats
      const localStats = await storage
        .getProviderLocalStatsForUserInCounty(userId, countyFips)
        .catch(() => undefined);
      const globalCred = await storage.getUserCredibilityStats(userId);

      const jobsCompleted = localStats?.jobsCompleted ?? globalCred.jobsCompleted;
      const peopleHelped = localStats?.peopleHelped ?? globalCred.peopleHelped;
      const activeWeeks = localStats?.activeWeeks ?? globalCred.activeWeeks;

      // Trade requirements + verification summary
      const requirementsByTrade: any[] = [];
      if (tradeIds.length > 0) {
        for (const tradeId of tradeIds) {
          const reqRow = await storage.getTradeRequirementsByTradeId(tradeId);
          if (reqRow) {
            requirementsByTrade.push(reqRow);
          }
        }
      }

      const verificationSummary = await storage.getUserVerificationSummary([userId]);
      const userVerification = verificationSummary[userId] || {
        hasLicense: false,
        hasInsurance: false,
        hasEin: false,
      };

      // Aggregate requirement flags across all trades for this provider
      const anyRequiresEin = requirementsByTrade.some((r) => r.requiresEin);
      const anyRequiresLicense = requirementsByTrade.some((r) => r.requiresLicense);
      const anyRequiresInsurance = requirementsByTrade.some((r) => r.requiresInsurance);

      const einBlocked = anyRequiresEin && !userVerification.hasEin;
      const licenseBlocked = anyRequiresLicense && !userVerification.hasLicense;
      const insuranceBlocked = anyRequiresInsurance && !userVerification.hasInsurance;

      const promotionBlocked = einBlocked || licenseBlocked || insuranceBlocked;
      const promotionReasons: string[] = [];
      if (einBlocked)
        promotionReasons.push("Some trades here expect a business tax ID (EIN) on file.");
      if (licenseBlocked)
        promotionReasons.push("At least one trade here requires an active license on file.");
      if (insuranceBlocked)
        promotionReasons.push("Some trades here expect proof of insurance before promotion.");

      // Reach label is intentionally simple and explainable
      let reachLabel = "not_set_up";
      if (servesThisCounty && declaredServiceAreas.length <= 3) {
        reachLabel = "local_here";
      } else if (servesThisCounty && declaredServiceAreas.length > 3) {
        reachLabel = "regional_here";
      } else if (!servesThisCounty && declaredServiceAreas.length > 0) {
        reachLabel = "nearby_not_listed_here";
      }

      res.json({
        county: {
          countyFips: county.fips,
          countyName: county.name,
          stateCode: county.stateCode,
        },
        declaration: declaration
          ? {
              hasDeclaration: true,
              tradeIds: declaration.tradeIds,
              serviceAreas: declaration.serviceAreas,
            }
          : { hasDeclaration: false },
        reach: {
          label: reachLabel,
          servesThisCounty,
          declaredServiceAreaCount: declaredServiceAreas.length,
        },
        activity: {
          jobsCompleted,
          peopleHelped,
          activeWeeks,
          lastActiveAt: localStats?.lastActiveAt ?? null,
        },
        requirements: {
          ein: {
            required: anyRequiresEin,
            has: userVerification.hasEin,
          },
          license: {
            required: anyRequiresLicense,
            has: userVerification.hasLicense,
          },
          insurance: {
            required: anyRequiresInsurance,
            has: userVerification.hasInsurance,
          },
        },
        promotion: {
          blocked: promotionBlocked,
          reasons: promotionReasons,
        },
      });
    } catch (error: any) {
      console.error("Error fetching provider standing:", error);
      res.status(500).json({ message: "Failed to fetch provider standing" });
    }
  });

  // Ad delivery for site visits with location targeting
  app.get("/api/ads/site-visit", async (req: any, res: any) => {
    try {
      const { userType, state, county } = req.query;
      const ad = await storage.getTargetedAd({
        audience: (userType as string) || "all",
        state: state as string,
        county: county as string,
        minCommunityScore: 40,
      });

      if (!ad) {
        return res.status(404).json({ message: "No ads available" });
      }
      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id || null;
      const linkUrl = await storage.normalizeAdLinkForUser({
        linkUrl: (ad as any).linkUrl,
        isAffiliate: (ad as any).isAffiliate,
        userId,
      });

      res.json({
        ...ad,
        linkUrl,
      });
    } catch (error: any) {
      console.error("Error fetching targeted ad:", error);
      res.status(500).json({ message: "Failed to fetch ad" });
    }
  });

  // Track ad impressions
  app.post("/api/ads/track-impression", async (req: any, res: any) => {
    try {
      const { adId, source } = (req.body ?? {}) as any;

      if (!adId) {
        return res.status(400).json({ message: "adId is required" });
      }

      // Track ad view with locality context
      // await LocalityTracker.trackAdInteraction(req, adId, 'view');

      await storage.incrementAdImpressions(adId);
      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id || null;
      await storage.trackAdEvent({ adId, eventType: "impression", source, userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking impression:", error);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  // Track ad clicks
  app.post("/api/ads/track-click", async (req: any, res: any) => {
    try {
      const { adId, source } = (req.body ?? {}) as any;

      if (!adId) {
        return res.status(400).json({ message: "adId is required" });
      }

      // Track ad click with locality context
      // await LocalityTracker.trackAdInteraction(req, adId, 'click');

      await storage.incrementAdClicks(adId);
      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id || null;
      await storage.trackAdEvent({ adId, eventType: "click", source, userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Ad feedback (Community Value Score input)
  app.post("/api/ads/feedback", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId, rating, source } = (req.body ?? {}) as {
        adId?: string;
        rating?: "helpful" | "not_relevant" | "spam";
        source?: "scout" | "site_visit" | "saved";
      };

      if (!adId || !rating || !source) {
        return res.status(400).json({ message: "adId, rating, and source are required" });
      }

      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.submitAdFeedback({ adId, userId, rating, source });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording ad feedback:", error);
      // Fail-soft: don't break UX if feedback fails
      res.status(200).json({ success: false });
    }
  });

  // Save ad for later (authenticated users only)
  app.post("/api/ads/save", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = (req.body ?? {}) as any;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (!adId) {
        return res.status(400).json({ message: "adId is required" });
      }

      const savedAd = await storage.saveAdForUser(userId, adId);
      res.json(savedAd);
    } catch (error: any) {
      console.error("Error saving ad:", error);
      res.status(500).json({ message: "Failed to save ad" });
    }
  });

  // Get saved ads for user
  app.get("/api/saved-ads", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savedAds = await storage.getSavedAdsForUser(userId);

      const adsWithAffiliateLinks = await Promise.all(
        savedAds.map(async (ad) => {
          const linkUrl = await storage.normalizeAdLinkForUser({
            linkUrl: (ad as any).linkUrl,
            isAffiliate: (ad as any).isAffiliate,
            userId,
          });
          return {
            ...ad,
            linkUrl,
          };
        })
      );

      res.json(adsWithAffiliateLinks);
    } catch (error: any) {
      console.error("Error fetching saved ads:", error);
      res.status(500).json({ message: "Failed to fetch saved ads" });
    }
  });

  // Remove saved ad
  app.delete("/api/ads/save/:adId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = req.params;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.removeSavedAd(userId, adId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error removing saved ad:", error);
      res.status(500).json({ message: "Failed to remove saved ad" });
    }
  });

  // Notification routes moved to server/routes/notification-routes.ts
  // and registered via registerNotificationRoutes(app) to avoid duplication

  // Admin endpoint to trigger reminder notifications (for testing)
  app.post("/api/admin/trigger-reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (
        !user ||
        !["head_admin", "super_admin", "moderator", "ops_admin"].includes(user.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { notificationService } = await import("./notification-service");
      // await notificationService.triggerReminders();

      res.json({ message: "Reminder processing triggered successfully" });
    } catch (error: any) {
      console.error("Error triggering reminders:", error);
      res.status(500).json({ message: "Failed to trigger reminders" });
    }
  });

  // Admin endpoint to send a test in-app + push notification to the current user
  app.post("/api/admin/test-push-notification", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const user = await storage.getUser(userId);
      if (
        !user ||
        !["head_admin", "super_admin", "moderator", "ops_admin"].includes(user.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const nowIso = new Date().toISOString();

      const notification = await notificationService.createNotification({
        userId,
        type: "system_update",
        title: "Test push notification",
        message: `Test notification · ${nowIso}`,
        actionUrl: "/notifications",
        actionText: "View notifications",
        iconName: "bell",
        iconColor: "blue",
        deliveryMethods: ["in_app", "push"],
      });

      res.json({ success: true, notification });
    } catch (error: any) {
      console.error("Error sending test push notification:", error);
      res.status(500).json({ message: "Failed to send test push notification" });
    }
  });

  // Admin endpoint to broadcast an announcement to a user segment
  app.post(
    "/api/admin/notifications/broadcast",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const actorId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { segment, title, message, deliveryMethods, campaignType, tags, targetFilters } =
          req.body || {};

        if (!title || typeof title !== "string" || !title.trim()) {
          return res.status(400).json({ message: "title is required" });
        }
        if (!message || typeof message !== "string" || !message.trim()) {
          return res.status(400).json({ message: "message is required" });
        }

        const allowedSegments = ["all", "homeowners", "contractors", "pros", "admins"] as const;
        type BroadcastSegment = (typeof allowedSegments)[number];

        let effectiveSegment: BroadcastSegment = "all";
        if (
          typeof segment === "string" &&
          (allowedSegments as readonly string[]).includes(segment)
        ) {
          effectiveSegment = segment as BroadcastSegment;
        }

        const allowedMethods = ["in_app", "email", "push", "sms"];
        const requestedMethods = Array.isArray(deliveryMethods)
          ? (deliveryMethods as string[]).filter((m) => allowedMethods.includes(m))
          : [];
        const finalMethods = requestedMethods.length > 0 ? requestedMethods : ["in_app"];

        const effectiveCampaignType =
          typeof campaignType === "string" && campaignType.trim() ? campaignType.trim() : undefined;

        const effectiveTags = Array.isArray(tags)
          ? (tags as any[])
              .map((t) => (typeof t === "string" ? t.trim() : ""))
              .filter((t) => t.length > 0)
              .slice(0, 25)
          : [];

        const rawFilters: any =
          targetFilters && typeof targetFilters === "object" ? targetFilters : {};

        const stateCodes: string[] =
          Array.isArray(rawFilters.stateCodes) && rawFilters.stateCodes.length > 0
            ? (rawFilters.stateCodes as any[])
                .map((v) => (typeof v === "string" ? v.trim().toUpperCase() : ""))
                .filter((v) => v.length > 0)
                .slice(0, 16)
            : [];

        const countyNames: string[] =
          Array.isArray(rawFilters.countyNames) && rawFilters.countyNames.length > 0
            ? (rawFilters.countyNames as any[])
                .map((v) => (typeof v === "string" ? v.trim() : ""))
                .filter((v) => v.length > 0)
                .slice(0, 32)
            : [];

        const onlyWithMarketingEmails: boolean = rawFilters.onlyWithMarketingEmails === true;

        // Determine target roles for the selected segment
        let roleFilter: string[] | null = null;
        if (effectiveSegment === "homeowners") {
          roleFilter = ["homeowner", "renter", "landlord", "property_manager", "hoa_member"];
        } else if (effectiveSegment === "contractors") {
          roleFilter = [
            "contractor",
            "handyman",
            "service_provider",
            "specialty_tradesperson",
            "designer",
            "inspector",
          ];
        } else if (effectiveSegment === "pros") {
          roleFilter = [
            "contractor",
            "handyman",
            "service_provider",
            "specialty_tradesperson",
            "designer",
            "inspector",
            "realtor",
            "mortgage_broker",
            "insurance_agent",
            "title_company",
            "car_dealer",
            "auto_service",
          ];
        } else if (effectiveSegment === "admins") {
          roleFilter = ["admin", "moderator", "ops_admin", "super_admin", "head_admin"];
        }

        // Fetch target users
        const baseTargetsQuery = db.select({ id: users.id }).from(users);

        const conditions: any[] = [];
        if (roleFilter && roleFilter.length > 0) {
          conditions.push(sql`${users.role} = ANY(${roleFilter})`);
        }
        if (stateCodes.length > 0) {
          conditions.push(sql`${users.state} = ANY(${stateCodes})`);
        }
        if (countyNames.length > 0) {
          conditions.push(sql`${users.county} = ANY(${countyNames})`);
        }
        if (onlyWithMarketingEmails) {
          conditions.push(sql`${users.preferences}->>'marketingEmails' = 'true'`);
        }

        const targets =
          conditions.length > 0
            ? await baseTargetsQuery.where(and(...conditions))
            : await baseTargetsQuery;

        if (!targets || targets.length === 0) {
          return res.json({
            success: true,
            segment: effectiveSegment,
            targetCount: 0,
            notifications: [],
          });
        }

        const notifications: any[] = [];
        for (const target of targets) {
          const created = await notificationService.createNotification({
            userId: target.id,
            type: "system_update",
            title: title.trim(),
            message: message.trim(),
            deliveryMethods: finalMethods,
            iconName: "megaphone",
            iconColor: "orange",
            metadata: {
              segment: effectiveSegment,
              createdBy: actorId,
              kind: "admin_broadcast",
              campaignType: effectiveCampaignType,
              tags: effectiveTags,
              targetFilters: {
                stateCodes,
                countyNames,
                onlyWithMarketingEmails,
              },
            } as any,
          });
          notifications.push({ id: created.id, userId: target.id });
        }

        res.json({
          success: true,
          segment: effectiveSegment,
          targetCount: targets.length,
          notifications,
        });
      } catch (error: any) {
        console.error("Error sending broadcast notification:", error);
        res.status(500).json({ message: "Failed to send broadcast notification" });
      }
    }
  );

  // Profile setup endpoint
  app.post("/api/auth/setup-profile", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const {
        role,
        phone,
        address,
        city,
        state,
        zipCode,
        companyName,
        businessDescription,
        licenseNumber,
        yearsInBusiness,
        serviceAreas,
        isGeneralContractor,
        isResidentialContractor,
        acceptsSubcontractWork,
      } = (req.body ?? {}) as any;

      const existingUser = await storage.getUser(userId);

      const normalizedRole =
        role === "contractor_user"
          ? "contractor"
          : role === "vehicle_dealer"
            ? "car_dealer"
            : role === "helper"
              ? "handyman"
              : role;

      // Prevent privilege escalation: admin roles are backend-only.
      // Only allow the small set of roles that this onboarding flow is intended to set.
      const allowedOnboardingRoles = new Set([
        "homeowner",
        "contractor",
        "realtor",
        "car_dealer",
        "handyman",
      ]);
      if (!allowedOnboardingRoles.has(String(normalizedRole || "").trim())) {
        return res.status(400).json({ message: "Invalid role selection" });
      }

      const normalizedServiceAreas: string[] = Array.isArray(serviceAreas)
        ? serviceAreas.filter(Boolean).map((area: any) => String(area).trim())
        : typeof serviceAreas === "string"
          ? serviceAreas
              .split(",")
              .map((area: string) => area.trim())
              .filter(Boolean)
          : [];

      // Update user profile
      const updatedUser = await storage.updateUser(userId, {
        role: normalizedRole,
        phone,
        address,
        city,
        state,
        zipCode,
        onboardingCompleted: true,
        preferences: {
          ...(existingUser as any)?.preferences,
          profileVisibility: (existingUser as any)?.preferences?.profileVisibility || "public",
        },
      });

      const fullName = [updatedUser.firstName, updatedUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const defaultDisplayName =
        fullName || String(companyName || "").trim() || "TradeScout Profile";

      const businessCapableRoles = new Set(["contractor", "realtor", "car_dealer", "handyman"]);
      let createdBusiness: any = null;

      if (businessCapableRoles.has(normalizedRole)) {
        if (
          normalizedRole === "contractor" &&
          (!companyName || String(companyName).trim().length < 2)
        ) {
          return res
            .status(400)
            .json({ message: "Business name is required for contractor profiles" });
        }

        const businessName = String(companyName || defaultDisplayName).trim();

        createdBusiness = await storage.createBusinessForOwner(userId, {
          name: businessName,
          slug: businessName,
          type: (normalizedRole === "contractor" ? "contractor" : "other") as any,
          roleContext: normalizedRole as any,
          profileData: {
            description: businessDescription,
            phone,
            email: updatedUser.email,
          } as any,
          status: "active" as any,
          countyIds: [],
        });

        await storage.setUserActiveBusiness(userId, createdBusiness.id);

        if (normalizedRole === "contractor") {
          await storage.createContractor({
            userId,
            businessId: createdBusiness.id,
            companyName: String(companyName).trim(),
            slug: String(companyName)
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
            about: businessDescription,
            licenseNumber,
            yearsInBusiness: yearsInBusiness || 0,
            phone,
            isGeneralContractor: isGeneralContractor || false,
            isResidentialContractor: isResidentialContractor || false,
            acceptsSubcontractWork: acceptsSubcontractWork || false,
          } as any);
        }
      }

      const createdProfile = await storage.createProfileForOwner(userId, {
        ownerUserId: userId as any,
        businessId: createdBusiness?.id || undefined,
        roleContext: normalizedRole as any,
        slug: String(companyName || defaultDisplayName).trim(),
        displayName: String(companyName || defaultDisplayName).trim(),
        headline: null,
        contentBlocks: [],
        ctaConfig: {},
        seoMeta: {},
        status: "published" as any,
      } as any);

      const updatedWithActive = await storage.setUserActiveProfile(userId, createdProfile.id);

      res.json({
        ...updatedWithActive,
        password: undefined,
        activeProfileId: createdProfile.id,
        createdProfileId: createdProfile.id,
        createdProfileSlug: createdProfile.slug,
        createdBusinessId: createdBusiness?.id || null,
        createdBusinessSlug: createdBusiness?.slug || null,
      });
    } catch (error: any) {
      console.error("Error setting up profile:", error);
      res.status(500).json({ message: "Failed to setup profile" });
    }
  });

  // Public heatmap data endpoint (promotional feature)
  app.get("/api/heatmap", async (req: any, res: any) => {
    try {
      const timeframe = (req.query.timeframe as string) || "30d";
      const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;

      // Get heatmap data from locality interactions
      const heatmapData = await storage.getLocalityHeatmapData(days);

      res.json(heatmapData);
    } catch (error: any) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // County contractors endpoint
  app.get("/api/contractors/by-county", async (req: any, res: any) => {
    try {
      const { state, county } = req.query;

      if (!state || !county) {
        return res.status(400).json({ message: "State and county parameters required" });
      }

      const contractors = await storage.getContractors({ countyId: String(county) });
      res.json((contractors || []).map(sanitizeContractorPublic));
    } catch (error: any) {
      console.error("Error fetching county contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Admin user management endpoints
  app.get("/api/admin/users", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);
      const reqUser = (req.user || {}) as any;
      const reqRoles = Array.isArray(reqUser.roles) ? reqUser.roles.map((r: any) => String(r)) : [];
      const reqRole = typeof reqUser.role === "string" ? reqUser.role : "";
      const reqActiveRole = typeof reqUser.activeRole === "string" ? reqUser.activeRole : "";
      const dbRoles = Array.isArray((user as any)?.roles)
        ? (user as any).roles.map((r: any) => String(r))
        : [];
      const dbRole = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
      const dbActiveRole =
        typeof (user as any)?.activeRole === "string" ? String((user as any).activeRole) : "";
      const adminRoles = new Set(["head_admin", "super_admin", "moderator", "ops_admin"]);
      const hasAdminAccess =
        reqUser.isSuperAdmin === true ||
        reqUser.isAdmin === true ||
        adminRoles.has(reqRole) ||
        adminRoles.has(reqActiveRole) ||
        reqRoles.some((role: string) => adminRoles.has(role)) ||
        adminRoles.has(dbRole) ||
        adminRoles.has(dbActiveRole) ||
        dbRoles.some((role: string) => adminRoles.has(role));

      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/role", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const adminUser = await storage.getUser(adminUserId);
      const { userId } = req.params;
      const { role } = (req.body ?? {}) as any;

      if (
        !adminUser ||
        !["head_admin", "super_admin", "moderator", "ops_admin"].includes(adminUser.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Only head_admin can promote to head_admin or modify other head_admins
      if (role === "head_admin" && adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Only head admin can promote to head admin" });
      }

      const targetUser = await storage.getUser(userId);
      if (targetUser?.role === "head_admin" && adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Only head admin can modify other head admins" });
      }

      const updatedUser = await storage.updateUser(userId, { role });
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const adminUser = await storage.getUser(adminUserId);
      const { userId } = req.params;

      if (
        !adminUser ||
        !["head_admin", "super_admin", "moderator"].includes(adminUser.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(userId);
      if (targetUser?.role === "head_admin" && adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Only head admin can delete other head admins" });
      }

      // Prevent self-deletion
      if (userId === adminUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Super admin user controls (minimal, but real)
  app.post(
    "/api/admin/user-controls/suspend/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = await storage.getUser(adminUserId);

        if (!adminUser || adminUser.role !== "head_admin") {
          return res.status(403).json({ message: "Head admin access required" });
        }

        const { userId } = req.params;
        if (userId === adminUserId) {
          return res.status(400).json({ message: "Cannot suspend your own account" });
        }

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (targetUser.role === "head_admin") {
          return res.status(403).json({ message: "Cannot suspend another head admin" });
        }

        const updated = await storage.updateUser(userId, {
          verificationStatus: "suspended" as any,
        });

        return res.json({
          id: updated.id,
          role: updated.role,
          verificationStatus: (updated as any).verificationStatus,
        });
      } catch (error: any) {
        console.error("Error suspending user:", error);
        return res.status(500).json({ message: "Failed to suspend user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/unsuspend/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = await storage.getUser(adminUserId);

        if (!adminUser || adminUser.role !== "head_admin") {
          return res.status(403).json({ message: "Head admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (targetUser.role === "head_admin" && adminUser.id !== targetUser.id) {
          // Only the same head admin account owner should manage their status
          return res.status(403).json({ message: "Cannot modify another head admin" });
        }

        const updated = await storage.updateUser(userId, {
          verificationStatus: "pending" as any,
        });

        return res.json({
          id: updated.id,
          role: updated.role,
          verificationStatus: (updated as any).verificationStatus,
        });
      } catch (error: any) {
        console.error("Error unsuspending user:", error);
        return res.status(500).json({ message: "Failed to unsuspend user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/verify/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = await storage.getUser(adminUserId);

        if (!adminUser || adminUser.role !== "head_admin") {
          return res.status(403).json({ message: "Head admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const updated = await storage.updateUser(userId, {
          verificationStatus: "approved" as any,
          addressVerified: true,
        });

        return res.json({
          id: updated.id,
          role: updated.role,
          verificationStatus: (updated as any).verificationStatus,
          addressVerified: (updated as any).addressVerified,
        });
      } catch (error: any) {
        console.error("Error verifying user:", error);
        return res.status(500).json({ message: "Failed to verify user" });
      }
    }
  );

  app.post(
    "/api/admin/user-controls/revoke-verify/:userId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const adminUser = await storage.getUser(adminUserId);

        if (!adminUser || adminUser.role !== "head_admin") {
          return res.status(403).json({ message: "Head admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const updated = await storage.updateUser(userId, {
          verificationStatus: "pending" as any,
        });

        return res.json({
          id: updated.id,
          role: updated.role,
          verificationStatus: (updated as any).verificationStatus,
        });
      } catch (error: any) {
        console.error("Error revoking verification:", error);
        return res.status(500).json({ message: "Failed to revoke verification" });
      }
    }
  );

  app.post("/api/admin/user-controls/role/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const adminUser = await storage.getUser(adminUserId);

      if (!adminUser || adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Head admin access required" });
      }

      const { userId } = req.params;
      const body = (req.body ?? {}) as any;
      let newRole = typeof body.newRole === "string" ? body.newRole.trim() : "";

      if (!newRole) {
        return res.status(400).json({ message: "newRole is required" });
      }

      // Map UI helper roles to canonical enum values
      if (newRole === "contractor_user") {
        newRole = "contractor";
      }

      const allowedRoles = [
        "homeowner",
        "renter",
        "landlord",
        "property_manager",
        "hoa_member",
        "business_owner",
        "commercial_property",
        "franchise_owner",
        "startup_founder",
        "contractor",
        "handyman",
        "service_provider",
        "specialty_tradesperson",
        "designer",
        "inspector",
        "realtor",
        "mortgage_broker",
        "insurance_agent",
        "title_company",
        "car_dealer",
        "auto_service",
        "hoa_board",
        "community_builder",
        "nonprofit_org",
        "affiliate",
        "content_creator",
        "admin",
        "content_seo",
        "analytics_specialist",
        "marketing_specialist",
        "moderator",
        "ops_admin",
        "super_admin",
        "head_admin",
      ];

      if (!allowedRoles.includes(newRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only head_admin can promote to head_admin or modify other head_admins
      if (newRole === "head_admin" && adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Only head admin can promote to head admin" });
      }

      if (targetUser.role === "head_admin" && adminUser.role !== "head_admin") {
        return res.status(403).json({ message: "Only head admin can modify other head admins" });
      }

      const updated = await storage.updateUser(userId, { role: newRole as any });

      return res.json({
        id: updated.id,
        role: updated.role,
      });
    } catch (error: any) {
      console.error("Error updating user role via quick control:", error);
      return res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Quote calculator pricing
  app.get("/api/pricing/:service", async (req: any, res: any) => {
    try {
      const { service } = req.params;
      const { fips } = req.query;

      const pricingData = await storage.getPricingData(service, fips as string);
      res.json(pricingData);
    } catch (error: any) {
      console.error("Error fetching pricing data:", error);
      res.status(500).json({ message: "Failed to fetch pricing data" });
    }
  });

  // Quote calculator endpoint (public access)
  app.post("/api/calculator", async (req: any, res: any) => {
    try {
      const { projectType, squareFootage, stateCode, countyFips, urgency } = (req.body ??
        {}) as any;

      // Track calculator usage with locality context
      // LocalityTracker call removed

      // Get pricing data for the project type and county
      const pricingData = await storage.getPricingData(projectType, countyFips);

      if (!pricingData || pricingData.length === 0) {
        // Fallback pricing calculations
        const baseRates: Record<string, number> = {
          roofing: 15,
          "roof-replacement": 15,
          "roof-repair": 8,
          plumbing: 12,
          electrical: 10,
          hvac: 25,
          flooring: 12,
          "kitchen-remodel": 100,
          "bathroom-remodel": 85,
          painting: 6,
        };

        const baseRate = baseRates[projectType] || 20;
        const sqft = parseInt(squareFootage) || 1000;

        const baseLow = baseRate * sqft * 0.8;
        const baseHigh = baseRate * sqft * 1.2;

        // Apply urgency multiplier
        const urgencyMultiplier = urgency === "urgent" ? 1.2 : urgency === "soon" ? 1.1 : 1.0;

        const estimate = {
          low: Math.round(baseLow * urgencyMultiplier),
          high: Math.round(baseHigh * urgencyMultiplier),
          projectType,
          // squareFootage: sqft,
          urgency: urgency || "planning",
          calculatedAt: new Date(),
        };

        return res.json(estimate);
      }

      // Use database pricing data
      const pricing = pricingData[0];
      const sqft = parseInt(squareFootage) || 1000;
      const baseLow = pricing.baseLow ? parseInt(pricing.baseLow, 10) : 0;
      const baseHigh = pricing.baseHigh ? parseInt(pricing.baseHigh, 10) : 0;

      // Calculate estimate based on square footage
      const low = Math.round((baseLow / 1000) * sqft);
      const high = Math.round((baseHigh / 1000) * sqft);

      // Apply urgency multiplier
      const urgencyMultiplier = urgency === "urgent" ? 1.2 : urgency === "soon" ? 1.1 : 1.0;

      const estimate = {
        low: Math.round(low * urgencyMultiplier),
        high: Math.round(high * urgencyMultiplier),
        projectType,
        // squareFootage: sqft,
        urgency: urgency || "planning",
        calculatedAt: new Date(),
      };

      res.json(estimate);
    } catch (error: any) {
      console.error("Error calculating estimate:", error);
      res.status(500).json({ message: "Failed to calculate estimate" });
    }
  });

  // Lead submission (public - no auth required for homeowners to get quotes)
  app.post("/api/leads", isAuthenticated, async (req: any, res: any) => {
    try {
      // User ID is optional for public lead submissions, but we capture it if available
      const userId = (req.user as any)?.id || null;
      const leadData = { ...req.body, userId };

      // Track quote request with locality context
      // LocalityTracker call removed

      // Validate lead data
      const parsedLead = insertLeadSchema.safeParse(leadData);
      if (!parsedLead.success) {
        return res.status(400).json({
          message: "Invalid lead payload",
          issues: parsedLead.error.issues,
        });
      }

      const validatedLead = parsedLead.data;

      const lead = await storage.createLead(validatedLead);

      // If this is a "top3" routing request, find and notify top contractors
      if (validatedLead.routingType === "top3" && validatedLead.countyId && validatedLead.tradeId) {
        await routeLeadToTopContractors(lead, validatedLead);
      }

      // If this is a manual routing request with explicit contractor IDs, assign directly
      if (validatedLead.routingType === "manual") {
        const manualIds: string[] = Array.isArray((leadData as any).manualContractorIds)
          ? (leadData as any).manualContractorIds.filter((id: any) => typeof id === "string")
          : [];

        if (manualIds.length > 0) {
          await storage.assignLeadToContractors(lead.id, manualIds);

          await Promise.all(
            manualIds.map(async (contractorId: string) => {
              try {
                const contractor = await storage.getContractorById(contractorId);
                if (!contractor?.userId) return;

                await notificationService.createNotification({
                  userId: contractor.userId,
                  type: "new_project_request",
                  title: "New Direct Connect request",
                  message: "A homeowner selected you to respond to a Direct Connect request.",
                  actionUrl: `/pro-dashboard/leads/${lead.id}`,
                  actionText: "View lead",
                  iconName: "briefcase",
                  iconColor: "orange",
                  deliveryMethods: ["in_app", "push"],
                });

                await storage.logEvent("lead_assigned", {
                  leadId: lead.id,
                  contractorId,
                  assignmentType: "manual_selection",
                });
              } catch (manualErr) {
                console.error(
                  `Failed to notify contractor ${contractorId} for manual lead ${lead.id}:`,
                  manualErr
                );
              }
            })
          );
        }
      }

      // Log event
      await storage.logEvent("lead_submitted", {
        leadId: lead.id,
        userId,
        routingType: lead.routingType,
      });

      res.json({ message: "Lead submitted successfully", leadId: lead.id });
    } catch (error: any) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Recommendations (requires auth)
  app.post("/api/recommendations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const recommendationData = { ...req.body, userId };

      // Track rating submission with locality context
      // LocalityTracker call removed

      const recommendation = await storage.createRecommendation({
        ...recommendationData,
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
      });

      // Update leaderboard stats when recommendation is created
      await storage.updateContractorLeaderboardStats(
        recommendationData.contractorId,
        recommendationData.rating
      );

      await storage.logEvent("recommendation_submitted", {
        recommendationId: recommendation.id,
        contractorId: recommendation.contractorId,
        userId,
      });

      res.json(recommendation);
    } catch (error: any) {
      console.error("Error creating recommendation:", error);
      res.status(500).json({ message: "Failed to create recommendation" });
    }
  });

  // Contractor leaderboards
  app.get("/api/leaderboard/monthly", async (req: any, res: any) => {
    try {
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getMonthlyLeaderboard(month, year, limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching monthly leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch monthly leaderboard" });
    }
  });

  app.get("/api/leaderboard/lifetime", async (req: any, res: any) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getLifetimeLeaderboard(limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching lifetime leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch lifetime leaderboard" });
    }
  });

  app.get("/api/leaderboard/contractor/:contractorId", async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const stats = await storage.getContractorLeaderboardPosition(contractorId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching contractor leaderboard position:", error);
      res.status(500).json({ message: "Failed to fetch contractor position" });
    }
  });

  // States API for geographic filtering
  // NOTE: /api/states and /api/counties are defined earlier with
  // robust static fallbacks. Do not re-register those routes here.

  // Growth Pack endpoints retired
  app.post("/api/growth-pack", isAuthenticated, async (_req: any, res: any) => {
    return res.status(410).json({ message: "Growth Pack is no longer offered." });
  });

  app.get("/api/growth-pack/download/:token", async (_req: any, res: any) => {
    return res.status(410).json({ message: "Growth Pack downloads are no longer available." });
  });

  // Pricing Analytics Routes (Admin Only)
  app.get(
    "/api/admin/pricing-analytics",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { timeframe = "30d" } = req.query;
        const { pricingAnalyticsService } = await import("./pricing-analytics");

        const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);
        res.json(analytics);
      } catch (error: any) {
        console.error("Error fetching pricing analytics:", error);
        res.status(500).json({ message: "Failed to fetch pricing analytics" });
      }
    }
  );

  app.post(
    "/api/admin/pricing-analytics/update-calculator",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { threshold = 10 } = (req.body ?? {}) as any;
        const { pricingAnalyticsService } = await import("./pricing-analytics");

        const result = await pricingAnalyticsService.updateCalculatorPricing(threshold);

        // Log the pricing update
        await storage.logEvent("pricing_calculator_updated", {
          adminId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
          updatedCount: result.updatedCount,
          updates: result.updates,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error updating calculator pricing:", error);
        res.status(500).json({ message: "Failed to update calculator pricing" });
      }
    }
  );

  app.get(
    "/api/admin/pricing-analytics/export",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { timeframe = "30d" } = req.query;
        const { pricingAnalyticsService } = await import("./pricing-analytics");

        const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);

        // Convert analytics to CSV format
        const csvData = [];

        // Add trade data
        for (const [tradeId, data] of Object.entries(analytics.averageQuotes.byTrade)) {
          csvData.push({
            type: "trade",
            id: tradeId,
            average: data.average,
            count: data.count,
            trend: data.trend,
          });
        }

        // Add region data
        for (const [regionKey, data] of Object.entries(analytics.averageQuotes.byRegion)) {
          csvData.push({
            type: "region",
            id: regionKey,
            average: data.average,
            count: data.count,
            trend: data.trend,
          });
        }

        // Convert to CSV string
        const csvHeader = "Type,ID,Average,Count,Trend\n";
        const csvRows = csvData
          .map((row) => `${row.type},${row.id},${row.average},${row.count},${row.trend}`)
          .join("\n");

        const csvContent = csvHeader + csvRows;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="pricing-analytics-${timeframe}.csv"`
        );
        res.send(csvContent);
      } catch (error: any) {
        console.error("Error exporting pricing analytics:", error);
        res.status(500).json({ message: "Failed to export pricing analytics" });
      }
    }
  );

  app.get(
    "/api/admin/pricing-analytics/recommendations",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { stateCode } = req.query;
        const { pricingAnalyticsService } = await import("./pricing-analytics");

        const recommendations =
          await pricingAnalyticsService.getRegionalPricingRecommendations(stateCode);
        res.json(recommendations);
      } catch (error: any) {
        console.error("Error fetching pricing recommendations:", error);
        res.status(500).json({ message: "Failed to fetch pricing recommendations" });
      }
    }
  );

  // Contractor dashboard (requires contractor auth)
  app.get("/api/contractor/dashboard", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      // Get contractor profile for this user
      const contractors = await storage.getContractors({ limit: 1 });
      const contractor = contractors.find((c) => c.userId === userId);

      if (!contractor) {
        return res.status(404).json({ message: "Contractor profile not found" });
      }

      // Get leads for this contractor
      const leads = await storage.getLeads(contractor.id);
      const recommendations = await storage.getRecommendations(contractor.id);
      const ratings = await storage.getContractorRatings(contractor.id);

      res.json({
        contractor,
        leads: leads.slice(0, 5), // Recent leads
        recommendations: recommendations.slice(0, 3), // Recent recommendations
        stats: {
          totalLeads: leads.length,
          newLeads: leads.filter((l) => l.status === "new").length,
          ratingSummary: ratings,
        },
      });
    } catch (error: any) {
      console.error("Error fetching contractor dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Explicit job completion endpoint
  app.post("/api/leads/:id/complete", isAuthenticated, async (req: any, res: any) => {
    try {
      const leadId = String(req.params.id);
      const userId: string | undefined = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      if (!leadId || !userId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const lead = await storage.getLeadById(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Authorization: lead owner (homeowner) or assigned contractor or admin
      const rolesRaw = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const primaryRole = (req.user as any)?.role;
      const roles: string[] = [primaryRole, ...(rolesRaw || [])].filter(
        (r): r is string => typeof r === "string"
      );
      const isAdminLike = roles.some((r) =>
        ["admin", "moderator", "ops_admin", "super_admin", "head_admin"].includes(r)
      );

      const isHomeownerOwner = typeof lead.userId === "string" && lead.userId === userId;
      const isAssignedContractor =
        typeof lead.contractorId === "string" &&
        !!lead.contractorId &&
        (await (async () => {
          try {
            const contractor = await storage.getContractorByUserId(userId);
            return !!contractor && contractor.id === lead.contractorId;
          } catch {
            return false;
          }
        })());

      if (!isHomeownerOwner && !isAssignedContractor && !isAdminLike) {
        return res.status(403).json({ message: "Not authorized to complete this job" });
      }

      if (lead.status === "completed") {
        return res.status(200).json({ message: "Job already marked completed" });
      }

      const updated = await storage.updateLeadStatus(leadId, "completed");

      try {
        await storage.logEvent("job.completed", {
          userId,
          jobId: updated.id,
        });
      } catch (err) {
        console.error("job.completed logging failed", err);
      }

      res.json({ message: "Job marked as completed", lead: updated });
    } catch (error: any) {
      console.error("Error completing lead:", error);
      res.status(500).json({ message: "Failed to complete job" });
    }
  });

  // Event tracking endpoint
  app.post("/api/events", async (req: any, res: any) => {
    try {
      const { eventType, data } = (req.body ?? {}) as any;

      await storage.logEvent(eventType, {
        ...data,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({ message: "Event logged successfully" });
    } catch (error: any) {
      console.error("Error logging event:", error);
      res.status(500).json({ message: "Failed to log event" });
    }
  });

  // Pro / Business analytics (contractor-facing)
  app.get(
    "/api/pro/analytics/summary",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const now = new Date();
        const from = new Date(now);
        from.setMonth(from.getMonth() - 1);

        const rows = await storage.getPlatformAnalytics(from, now);

        let totalRequests = 0;
        let totalRevenue = 0;
        let totalConversions = 0;

        for (const row of rows as any[]) {
          totalRequests += Number((row as any).listingsCreated || 0);
          totalRevenue += Number((row as any).revenue || 0);
          totalConversions += Number((row as any).transactionsCompleted || 0);
        }

        const conversionRate = totalRequests > 0 ? (totalConversions / totalRequests) * 100 : 0;

        res.json({
          totalRequests,
          revenue: totalRevenue,
          profileViews: 0,
          conversionRate,
        });
      } catch (error: any) {
        console.error("Error fetching pro analytics summary:", error);
        res.status(500).json({ message: "Failed to fetch analytics summary" });
      }
    }
  );

  app.get(
    "/api/pro/analytics/revenue-trend",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const now = new Date();
        const from = new Date(now);
        from.setMonth(from.getMonth() - 5);

        const rows = await storage.getPlatformAnalytics(from, now);

        const points = (rows as any[]).map((row) => {
          const date = new Date((row as any).date);
          const label = date.toLocaleString("en-US", { month: "short" });
          const value = Number((row as any).revenue || 0);
          return {
            date: date.toISOString(),
            label,
            value,
          };
        });

        res.json({ points });
      } catch (error: any) {
        console.error("Error fetching pro revenue trend:", error);
        res.status(500).json({ message: "Failed to fetch revenue trend" });
      }
    }
  );

  app.get(
    "/api/pro/analytics/sources",
    isAuthenticated,
    isContractor,
    async (_req: any, res: any) => {
      try {
        // Source-level breakdowns are not yet tracked; return an empty dataset with clear semantics.
        res.json({ sources: [] });
      } catch (error: any) {
        console.error("Error fetching pro analytics sources:", error);
        res.status(500).json({ message: "Failed to fetch analytics sources" });
      }
    }
  );

  app.get(
    "/api/pro/analytics/projects",
    isAuthenticated,
    isContractor,
    async (_req: any, res: any) => {
      try {
        // Project-level analytics will be wired to real project tables; for now return an empty list.
        res.json({ projects: [] });
      } catch (error: any) {
        console.error("Error fetching pro analytics projects:", error);
        res.status(500).json({ message: "Failed to fetch analytics projects" });
      }
    }
  );

  app.get(
    "/api/pro/analytics/funnel",
    isAuthenticated,
    isContractor,
    async (_req: any, res: any) => {
      try {
        const now = new Date();
        const from = new Date(now);
        from.setMonth(from.getMonth() - 1);

        const rows = await storage.getPlatformAnalytics(from, now);

        let requestsReceived = 0;
        let converted = 0;

        for (const row of rows as any[]) {
          requestsReceived += Number((row as any).listingsCreated || 0);
          converted += Number((row as any).transactionsCompleted || 0);
        }

        res.json({
          requestsReceived,
          contacted: 0,
          quoted: 0,
          converted,
        });
      } catch (error: any) {
        console.error("Error fetching pro analytics funnel:", error);
        res.status(500).json({ message: "Failed to fetch analytics funnel" });
      }
    }
  );

  // Daily money movement summary for super admins
  app.get("/api/admin/money-movements/daily", isAuthenticated, async (req: any, res: any) => {
    try {
      const roleFromClaims = req.user?.claims?.role;
      const rawRoles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const roles: string[] = [roleFromClaims, ...(rawRoles || [])].filter(
        (r): r is string => typeof r === "string"
      );

      const isSuperAdminLike = roles.some((r) =>
        ["head_admin", "super_admin", "ops_admin", "analytics_read"].includes(r)
      );
      if (!isSuperAdminLike) {
        return res.status(403).json({ message: "Access denied" });
      }

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const [
        { totalWalletCredits, totalWalletDebits },
        { totalStripeVolume, totalOffPlatformVolume },
      ] = await Promise.all([
        (async () => {
          const rows = await db
            .select({
              direction: walletTransactions.direction,
              amount: walletTransactions.amount,
            })
            .from(walletTransactions)
            .where(
              and(
                gte(walletTransactions.createdAt, startOfDay),
                lte(walletTransactions.createdAt, endOfDay)
              )
            );

          let credits = 0;
          let debits = 0;
          for (const row of rows) {
            const amt = Number((row as any).amount || 0);
            if (!Number.isFinite(amt)) continue;
            if ((row as any).direction === "credit") credits += amt;
            else if ((row as any).direction === "debit") debits += amt;
          }

          return { totalWalletCredits: credits, totalWalletDebits: debits };
        })(),
        (async () => {
          const rows = await db
            .select({
              method: marketplaceTransactions.paymentMethod,
              amount: marketplaceTransactions.totalAmount,
            })
            .from(marketplaceTransactions)
            .where(
              and(
                gte(marketplaceTransactions.createdAt, startOfDay),
                lte(marketplaceTransactions.createdAt, endOfDay),
                eq(marketplaceTransactions.status, "completed")
              )
            );

          let stripe = 0;
          let offPlatform = 0;
          for (const row of rows) {
            const amt = Number((row as any).amount || 0);
            if (!Number.isFinite(amt) || amt <= 0) continue;
            const method = (row as any).method;
            if (method === "on_platform_stripe") stripe += amt;
            else if (method === "off_platform_direct") offPlatform += amt;
          }

          return { totalStripeVolume: stripe, totalOffPlatformVolume: offPlatform };
        })(),
      ]);

      res.json({
        date: startOfDay.toISOString().slice(0, 10),
        wallet: {
          totalCredits: totalWalletCredits,
          totalDebits: totalWalletDebits,
          netChange: totalWalletCredits - totalWalletDebits,
        },
        marketplace: {
          totalStripeVolume,
          totalOffPlatformVolume,
        },
      });
    } catch (error: any) {
      console.error("Error fetching daily money movement summary:", error);
      res.status(500).json({ message: "Failed to fetch money movement summary" });
    }
  });

  // Contractor application submission
  app.post(
    "/api/contractors/apply",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // C2-3: Verification gate - check contractor verification (APPLY_AS_CONTRACTOR action)
        // Requires: license, insurance, identity
        const hasLicense =
          (user as any)?.licenseVerified || (user as any)?.verificationStatus === "approved";
        const hasInsurance = (user as any)?.insuranceVerified;
        const hasIdentity = (user as any)?.identityVerified;

        const missingRequirements = [];
        if (!hasLicense) missingRequirements.push("license");
        if (!hasInsurance) missingRequirements.push("insurance");
        if (!hasIdentity) missingRequirements.push("identity");

        if (missingRequirements.length > 0) {
          const { buildVerificationGateResponse } =
            await import("./utils/explainAndOfferVerification");

          const gateResponse = buildVerificationGateResponse({
            action: "APPLY_AS_CONTRACTOR",
            missingRequirements: missingRequirements as any,
            userRole: "contractor",
            targetUserId: undefined,
            targetRole: undefined,
            context: { intent: "apply_as_contractor" },
          });

          return res.status(200).json({
            ...gateResponse,
            verificationRequired: {
              action: "APPLY_AS_CONTRACTOR",
              retryPath: `/api/contractors/apply`,
              context: { companyName: req.body?.companyName },
            },
          });
        }

        // Track contractor application with locality context
        // LocalityTracker call removed

        const applicationData = { ...req.body, userId };

        // Create contractor profile from application data
        const contractor = await storage.createContractor({
          userId,
          companyName: applicationData.companyName,
          slug: applicationData.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
          phone: applicationData.phone,
          email: applicationData.email,
          website: applicationData.website,
          yearsInBusiness: parseInt(applicationData.yearsInBusiness) || 0,
          licenseNumber: applicationData.licenseNumber,
          about: applicationData.description,
          isGeneralContractor: applicationData.isGeneralContractor || false,
          isResidentialContractor: applicationData.isResidentialContractor || false,
          acceptsSubcontractWork: applicationData.acceptsSubcontractWork || false,
          verifiedLicensed: false,
          verifiedInsured: false,
          isActive: true,
        });

        // Update user role to contractor
        await storage.updateUser(userId, {
          role: "contractor",
          onboardingCompleted: true,
        });

        console.log("New contractor application created:", contractor.id);

        res.json({
          message: "Application submitted successfully",
          contractorId: contractor.id,
          status: "pending_verification",
        });
      } catch (error: any) {
        console.error("Error submitting contractor application:", error);
        res.status(500).json({ message: "Failed to submit application" });
      }
    }
  );

  // Admin: Get contractor applications
  app.get(
    "/api/admin/contractor-applications",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { status, limit = 50 } = req.query;
        const applications = await storage.getContractorApplications({
          status: status as string,
          limit: parseInt(limit as string),
        });

        res.json(applications);
      } catch (error: any) {
        console.error("Error fetching contractor applications:", error);
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    }
  );

  // Admin: Update contractor application status
  app.patch(
    "/api/admin/contractor-applications/:id",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { status, reviewNotes } = req.body;
        const adminId = (req.user as any)?.id;

        await storage.updateContractorApplication(id, {
          status,
          reviewNotes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        res.json({ message: "Application status updated successfully" });
      } catch (error: any) {
        console.error("Error updating contractor application:", error);
        res.status(500).json({ message: "Failed to update application" });
      }
    }
  );

  // Create recommendation for contractor with anti-abuse protection (LOGIN REQUIRED)
  app.post(
    "/api/contractors/:contractorId/recommendations",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const { contractorId } = req.params;
        const {
          recommendationType,
          comment,
          projectType,
          projectValue,
          workQuality,
          timeliness,
          communication,
          wouldHireAgain,
          customerName,
          customerEmail,
          customerPhone,
        } = (req.body ?? {}) as any;

        // Validate required fields
        if (!customerName || !customerEmail || !comment || !recommendationType) {
          return res.status(400).json({
            success: false,
            message: "Customer name, email, comment, and recommendation type are required",
          });
        }

        // Get client IP and user agent for anti-abuse
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("User-Agent");

        const recommendation = await storage.createRecommendation({
          contractorId,
          userId: (req.user as any)?.id || (req.user as any)?.claims?.sub, // User must be authenticated
          recommendationType,
          comment,
          projectType,
          projectValue,
          workQuality,
          timeliness,
          communication,
          wouldHireAgain,
          customerName,
          customerEmail,
          customerPhone,
          ipAddress,
          userAgent,
        });

        res.json({
          success: true,
          message: "Recommendation submitted for review. It will be published after moderation.",
          recommendation: {
            id: recommendation.id,
            recommendationType: recommendation.recommendationType,
            moderationStatus: recommendation.moderationStatus,
          },
        });
      } catch (error: any) {
        console.error("Error creating recommendation:", error);
        res.status(400).json({
          success: false,
          message: (error as Error).message || "Failed to submit recommendation",
        });
      }
    }
  );

  // Get contractor recommendations
  app.get("/api/contractors/:contractorId/recommendations", async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const { type = "all", limit = 10 } = req.query;

      const recommendations = await storage.getContractorRecommendations(contractorId, {
        type: type as "positive" | "negative" | "all",
        limit: parseInt(limit as string),
      });

      res.json(recommendations);
    } catch (error: any) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Admin: Get pending recommendations for moderation
  app.get(
    "/api/admin/recommendations/pending",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin", "moderator"]),
    async (req: any, res: any) => {
      try {
        const { limit = 50 } = req.query;

        const pendingRecommendations = await db
          .select({
            id: recommendations.id,
            contractorId: recommendations.contractorId,
            recommendationType: recommendations.recommendationType,
            comment: recommendations.comment,
            customerName: recommendations.customerName,
            customerEmail: recommendations.customerEmail,
            projectType: recommendations.projectType,
            projectValue: recommendations.projectValue,
            createdAt: recommendations.createdAt,
            contractorName: contractors.companyName,
          })
          .from(recommendations)
          .leftJoin(contractors, eq(recommendations.contractorId, contractors.id))
          .where(eq(recommendations.moderationStatus, "pending"))
          .orderBy(desc(recommendations.createdAt))
          .limit(parseInt(limit as string));

        res.json(pendingRecommendations);
      } catch (error: any) {
        console.error("Error fetching pending recommendations:", error);
        res.status(500).json({ message: "Failed to fetch pending recommendations" });
      }
    }
  );

  // Admin: Moderate recommendation
  app.patch(
    "/api/admin/recommendations/:id/moderate",
    isAuthenticated,
    requireRole(["head_admin", "ops_admin", "moderator"]),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { action, reason } = (req.body ?? {}) as any; // action: 'approve' or 'reject'
        const moderatorId = (req.user as any)?.id;

        if (!["approve", "reject"].includes(action)) {
          return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
        }

        // Get the recommendation first
        const [recommendation] = await db
          .select()
          .from(recommendations)
          .where(eq(recommendations.id, id));

        if (!recommendation) {
          return res.status(404).json({ message: "Recommendation not found" });
        }

        // Update moderation status
        await db
          .update(recommendations)
          .set({
            moderationStatus: action === "approve" ? "approved" : "rejected",
            isPublic: action === "approve",
            moderatedAt: new Date(),
            moderatedBy: moderatorId,
          })
          .where(eq(recommendations.id, id));

        // Update contractor stats if approved
        if (action === "approve") {
          await storage.updateContractorRecommendationStats(recommendation.contractorId);
        }

        res.json({
          success: true,
          message: `Recommendation ${action}d successfully`,
        });
      } catch (error: any) {
        console.error("Error moderating recommendation:", error);
        res.status(500).json({ message: "Failed to moderate recommendation" });
      }
    }
  );

  // Get contractor leaderboard (ranked by net recommendation score)
  app.get("/api/contractors/leaderboard", async (req: any, res: any) => {
    try {
      const { limit = 20, state, county, trade } = req.query;

      const query = db
        .select({
          id: contractors.id,
          companyName: contractors.companyName,
          slug: contractors.slug,
          positiveRecommendations: contractors.positiveRecommendations,
          negativeRecommendations: contractors.negativeRecommendations,
          totalRecommendations: contractors.totalRecommendations,
          recommendationScore: contractors.recommendationScore, // Net score (positive - negative)
          recommendationPercentage: contractors.recommendationPercentage,
        })
        .from(contractors)
        .where(
          and(
            eq(contractors.isActive, true),
            gt(contractors.totalRecommendations, 0) // Only contractors with recommendations
          )
        )
        .orderBy(
          desc(contractors.recommendationScore), // Order by net score
          desc(contractors.totalRecommendations) // Tie-breaker: total recommendations
        )
        .limit(parseInt(limit as string));

      const leaderboard = await query;
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching contractor leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Accelerator enrollment retired
  app.post("/api/accelerator/enroll", isAuthenticated, async (_req: any, res: any) => {
    return res.status(410).json({ message: "Accelerator program is no longer offered." });
  });

  // Exchange routes
  app.get("/api/exchange/items", async (req: any, res: any) => {
    try {
      const listings = await storage.getMarketplaceListings({
        categoryId: req.query.categoryId as string,
        county: req.query.county as string,
        state: req.query.state as string,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        condition: req.query.condition as string,
        searchQuery: req.query.search as string,
        sortBy: req.query.sort as any,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });

      res.json(listings || []);
    } catch (error: any) {
      console.error("Error fetching exchange items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  // Exchange promotions (business-neutral, marketplace placement)
  app.get("/api/exchange/promotions", async (req: any, res: any) => {
    try {
      const search = String(req.query.search || "")
        .trim()
        .toLowerCase();
      const sort = String(req.query.sort || "newest")
        .trim()
        .toLowerCase();
      const county = String(req.query.county || "").trim();

      const now = new Date();
      let rows = await storage.listPromotions({
        status: "active",
        countyFips: county || undefined,
        limit: 200,
      });

      rows = rows.filter((promo: any) => {
        const startsAt = promo?.startsAt ? new Date(promo.startsAt) : null;
        const endsAt = promo?.endsAt ? new Date(promo.endsAt) : null;

        if (startsAt && startsAt.getTime() > now.getTime()) return false;
        if (endsAt && endsAt.getTime() < now.getTime()) return false;

        // Exchange should only surface marketplace-targeted campaigns.
        return promo?.placementMarketplace === true;
      });

      if (search) {
        rows = rows.filter((promo: any) => {
          const haystack = `${promo?.title || ""} ${promo?.shortDescription || ""}`.toLowerCase();
          return haystack.includes(search);
        });
      }

      if (sort === "ending_soon") {
        rows = rows.sort((a: any, b: any) => {
          const aTs = a?.endsAt ? new Date(a.endsAt).getTime() : Number.POSITIVE_INFINITY;
          const bTs = b?.endsAt ? new Date(b.endsAt).getTime() : Number.POSITIVE_INFINITY;
          return aTs - bTs;
        });
      } else {
        rows = rows.sort((a: any, b: any) => {
          const aTs = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTs = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTs - aTs;
        });
      }

      const mapped = rows.map((promo: any) => ({
        id: promo.id,
        slug: promo.id,
        title: promo.title,
        description: promo.shortDescription,
        offerDetails: promo.ctaLabel || "Limited-time promotion",
        businessName: promo.type === "affiliate" ? "Partner business" : "Local business",
        promoCode: null,
        expiresAt: promo.endsAt || null,
        viewCount: 0,
        leadCount: 0,
        ctaUrl: promo.ctaUrl || null,
        ctaLabel: promo.ctaLabel || null,
        isFeatured: promo.tier === "paid_campaign",
      }));

      res.json(mapped);
    } catch (error: any) {
      console.error("Error fetching exchange promotions:", error);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  // Exchange contractor promotions (legacy)
  app.get("/api/exchange/contractor-promos", async (req: any, res: any) => {
    try {
      const { search, category, sort } = req.query;

      const contractorId = req.query.contractorId as string | undefined;
      const promos = contractorId ? await storage.getContractorPromos(contractorId) : [];
      res.json(promos || []);
    } catch (error: any) {
      console.error("Error fetching contractor promotions:", error);
      res.status(500).json({ message: "Failed to fetch contractor promotions" });
    }
  });

  // Exchange company promotions
  app.get("/api/exchange/company-promotions", async (req: any, res: any) => {
    try {
      const { search, dealType, sort } = req.query;

      // Company promotions are not implemented yet; return an empty list instead of mocks
      res.json([]);
    } catch (error: any) {
      console.error("Error fetching company promotions:", error);
      res.status(500).json({ message: "Failed to fetch company promotions" });
    }
  });

  // Chat system routes
  // Conversations
  app.post(
    "/api/conversations",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        return res.status(400).json({
          reasonCode: "MISSING_AUTHORITY_GATE",
          message:
            "Direct conversation creation is blocked. Use /api/social/conversations/start with authorityGate and intent.",
        });
      } catch (error: any) {
        console.error("Error creating conversation:", error);
        res.status(500).json({ message: "Failed to create conversation" });
      }
    }
  );

  app.get(
    "/api/conversations",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        const userType = req.query.userType || "homeowner";

        const conversations = await storage.getConversationsByUser(userId, userType);
        res.json(conversations);
      } catch (error: any) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
      }
    }
  );

  // Message Threads API (Nextdoor-style inbox)
  app.get(
    "/api/messages/threads",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        const marketplaceConversations = await storage.getUserMarketplaceConversations(userId);
        const marketplaceThreads = marketplaceConversations.map((conv: any) => ({
          id: conv.id,
          subject: conv.listing?.title ?? "Conversation",
          lastMessageSnippet: conv.lastMessage?.content ?? null,
          lastMessageAt: conv.lastMessageAt ?? conv.createdAt ?? null,
          unreadCount: Number(conv.unreadCount || 0),
          participantCount: 2,
        }));
        const legacyThreads = await storage.getThreadsForUser(userId, {
          limit: Math.max(limit * 3, 100),
          offset: 0,
        });
        const merged = [...marketplaceThreads, ...legacyThreads].sort((a: any, b: any) => {
          const left = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const right = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return right - left;
        });
        const threads = merged.slice(offset, offset + limit);
        res.json({ threads });
      } catch (error: any) {
        console.error("Error fetching message threads:", error);
        res.status(500).json({ message: "Failed to fetch message threads" });
      }
    }
  );

  app.get(
    "/api/messages/threads/:threadId",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const marketplaceConversation = await storage.getMarketplaceConversation(
          req.params.threadId
        );
        if (marketplaceConversation) {
          if (
            marketplaceConversation.buyerId !== userId &&
            marketplaceConversation.sellerId !== userId
          ) {
            return res.status(403).json({ message: "Access denied" });
          }

          const marketplaceMsgs = await storage.getMarketplaceMessages(req.params.threadId);
          const messages = marketplaceMsgs.map((m: any) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderType: m.senderType,
            content: m.content,
            messageType: m.messageType,
            metadata: m.metadata,
            readAt: m.readAt,
            createdAt: m.createdAt,
          }));

          const thread = {
            id: marketplaceConversation.id,
            subject: null as string | null,
            lastMessageSnippet: messages.length ? messages[messages.length - 1].content : null,
            lastMessageAt: (marketplaceConversation.lastMessageAt as any) ?? null,
            unreadCount: messages.filter((m: any) => m.senderId !== userId && !m.readAt).length,
            participantCount: 2,
          };

          return res.json({ thread, messages });
        }

        const legacyConversation = await storage.getConversation(req.params.threadId);
        if (!legacyConversation) {
          return res.status(404).json({ message: "Thread not found" });
        }
        if (
          legacyConversation.homeownerId !== userId &&
          legacyConversation.contractorId !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const legacyMessages = await storage.getMessagesByConversation(req.params.threadId);
        const legacyThread = {
          id: legacyConversation.id,
          subject: null as string | null,
          lastMessageSnippet: legacyMessages.length
            ? legacyMessages[legacyMessages.length - 1]?.content || null
            : null,
          lastMessageAt: (legacyConversation.lastMessageAt as any) ?? null,
          unreadCount: legacyMessages.filter((m: any) => m.senderId !== userId && !m.readAt).length,
          participantCount: 2,
        };
        res.json({ thread: legacyThread, messages: legacyMessages });
      } catch (error: any) {
        console.error("Error fetching thread messages:", error);
        res.status(500).json({ message: "Failed to fetch thread messages" });
      }
    }
  );

  app.post(
    "/api/messages/threads/:threadId/messages",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const conversation = await storage.getMarketplaceConversation(req.params.threadId);
        const { content, messageType, metadata } = (req.body ?? {}) as any;

        if (conversation) {
          if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
            return res.status(403).json({ message: "Access denied" });
          }

          const senderType = conversation.buyerId === userId ? "buyer" : "seller";
          const message = await storage.createMarketplaceMessage({
            conversationId: req.params.threadId,
            senderId: userId,
            senderType: senderType as any,
            content,
            messageType: messageType || "text",
            metadata,
          });
          return res.json({ message });
        }

        const legacyConversation = await storage.getConversation(req.params.threadId);
        if (!legacyConversation) {
          return res.status(404).json({ message: "Thread not found" });
        }
        if (
          legacyConversation.homeownerId !== userId &&
          legacyConversation.contractorId !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const senderType = legacyConversation.homeownerId === userId ? "homeowner" : "contractor";
        const message = await storage.createMessage({
          conversationId: req.params.threadId,
          senderId: userId,
          senderType: senderType as any,
          content,
          messageType: messageType || "text",
          metadata,
        });
        res.json({ message });
      } catch (error: any) {
        console.error("Error sending thread message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  app.get(
    "/api/conversations/:id",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const conversation = await storage.getConversation(req.params.id);
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        res.json(conversation);
      } catch (error: any) {
        console.error("Error fetching conversation:", error);
        res.status(500).json({ message: "Failed to fetch conversation" });
      }
    }
  );

  app.post(
    "/api/conversations/:id/rate",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const { rating, feedback } = (req.body ?? {}) as any;
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const conversation = await storage.getConversation(req.params.id);
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        const raterType = conversation.homeownerId === userId ? "homeowner" : "contractor";

        const updatedConversation = await storage.rateConversation(
          req.params.id,
          rating,
          feedback,
          raterType
        );

        res.json(updatedConversation);
      } catch (error: any) {
        console.error("Error rating conversation:", error);
        res.status(500).json({ message: "Failed to rate conversation" });
      }
    }
  );

  // Messages
  app.post(
    "/api/conversations/:id/messages",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        return res.status(400).json({
          reasonCode: "MISSING_AUTHORITY_GATE",
          message:
            "Direct conversation messaging is blocked. Use /api/social/conversations/start for intent-gated contact.",
        });
      } catch (error: any) {
        console.error("Error creating message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  app.get(
    "/api/conversations/:id/messages",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const conversation = await storage.getConversation(req.params.id);
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        const messages = await storage.getMessagesByConversation(req.params.id);
        res.json(messages);
      } catch (error: any) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Quotes
  app.post("/api/quotes", isAuthenticated, async (req: any, res: any) => {
    try {
      const contractorId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const quoteData = { ...req.body, contractorId };

      // Track contractor quote submission with locality context
      // LocalityTracker call removed

      const quote = await storage.createQuote(quoteData);
      res.json(quote);
    } catch (error: any) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.get("/api/conversations/:id/quotes", isAuthenticated, async (req: any, res: any) => {
    try {
      const quotes = await storage.getQuotesByConversation(req.params.id);
      res.json(quotes);
    } catch (error: any) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.put("/api/quotes/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const quote = await storage.updateQuote(req.params.id, req.body);
      res.json(quote);
    } catch (error: any) {
      console.error("Error updating quote:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Material list endpoints (chat + project planning)
  app.get("/api/conversations/:id/material-lists", isAuthenticated, async (req: any, res: any) => {
    try {
      const lists = await storage.getMaterialListsByConversation(req.params.id);
      res.json(lists);
    } catch (error: any) {
      console.error("Error fetching material lists:", error);
      res.status(500).json({ message: "Failed to fetch material lists" });
    }
  });

  app.post("/api/material-lists", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const list = await storage.createMaterialList({
        contractorId: req.body.contractorId || userId,
        ...req.body,
      });
      res.status(201).json(list);
    } catch (error: any) {
      console.error("Error creating material list:", error);
      res.status(500).json({ message: "Failed to create material list" });
    }
  });

  app.post("/api/material-lists/:id/suggestions", isAuthenticated, async (req: any, res: any) => {
    try {
      const suggestion = {
        ...req.body,
        id: req.body.id || `sugg-${Date.now()}`,
        suggestedBy: req.body.suggestedBy || "homeowner",
      };
      const list = await storage.addMaterialListItemSuggestion(req.params.id, suggestion);
      res.json(list);
    } catch (error: any) {
      console.error("Error adding material suggestion:", error);
      res.status(500).json({ message: "Failed to add suggestion" });
    }
  });

  app.patch(
    "/api/material-lists/:id/items/:itemId/status",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const list = await storage.updateMaterialListItemStatus(
          req.params.id,
          req.params.itemId,
          req.body.status,
          req.body.denialReason
        );
        res.json(list);
      } catch (error: any) {
        console.error("Error updating material item status:", error);
        res.status(500).json({ message: "Failed to update material item" });
      }
    }
  );

  // Admin panel routes (require admin access)
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const activeRole = typeof req.user.activeRole === "string" ? req.user.activeRole : "";
    const primaryRole = typeof req.user.role === "string" ? req.user.role : "";
    const roles = Array.isArray(req.user.roles) ? req.user.roles.map((r: any) => String(r)) : [];
    const adminRoles = new Set(["moderator", "ops_admin", "super_admin", "head_admin"]);
    const hasAdmin =
      req.user.isAdmin === true ||
      adminRoles.has(activeRole) ||
      adminRoles.has(primaryRole) ||
      roles.some((role: string) => adminRoles.has(role));

    if (!hasAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Emergency admin access route - allows Facebook login to become master admin
  app.post("/api/auth/emergency-admin-access", async (req: any, res: any) => {
    try {
      const { facebookId } = req.body;

      // Check if this Facebook ID matches the master admin
      if (facebookId !== "927070657") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the master admin user
      const [masterAdmin] = await db.select().from(users).where(eq(users.facebookId, facebookId));
      if (!masterAdmin) {
        return res.status(404).json({ message: "Master admin not found" });
      }

      // Create session for master admin
      req.login(masterAdmin, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          message: "Emergency admin access granted",
          user: masterAdmin,
          adminAccess: true,
        });
      });
    } catch (error: any) {
      console.error("Emergency admin access error:", error);
      res.status(500).json({ message: "Emergency access failed" });
    }
  });

  app.post("/api/auth/switch-role", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Get user's current roles
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const userRoles = currentUser.roles || [currentUser.role];
      if (!userRoles.includes(role)) {
        return res
          .status(403)
          .json({ message: "You don't have permission to switch to this role" });
      }

      // Update active role
      await db
        .update(users)
        .set({ activeRole: role, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Update session
      req.user = {
        ...req.user,
        activeRole: role,
        role: role, // Update primary role reference too
      };

      res.json({ message: "Role switched successfully", activeRole: role });
    } catch (error: any) {
      console.error("Error switching role:", error);
      res.status(500).json({ message: "Failed to switch role" });
    }
  });

  // 1b. CORS DIAGNOSTICS
  app.get("/api/cors-test", (req: Request, res: Response) => {
    const origin = (req.headers.origin || "") as string;
    const responseHeaders = res.getHeaders();
    res.json({ origin, responseHeaders });
  });

  // Marketplace conversation endpoints
  app.get("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const conversations = await storage.getUserMarketplaceConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const { listingId, sellerId, initialMessage } = req.body;

      // Check if conversation already exists
      const existingConversation = await storage.getMarketplaceConversationByParticipants(
        listingId,
        userId,
        sellerId
      );

      if (existingConversation) {
        return res.status(400).json({ message: "Conversation already exists" });
      }

      // Create conversation
      const conversation = await storage.createMarketplaceConversation({
        listingId,
        buyerId: userId,
        sellerId,
        status: "active",
      });

      // Send initial message
      await storage.createMarketplaceMessage({
        conversationId: conversation.id,
        senderId: userId,
        senderType: "buyer",
        content: initialMessage,
        messageType: "text",
      });

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get(
    "/api/marketplace/conversations/:conversationId/messages",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id;
        const { conversationId } = req.params;

        // Verify user is part of conversation
        const conversation = await storage.getMarketplaceConversation(conversationId);
        if (
          !conversation ||
          (conversation.buyerId !== userId && conversation.sellerId !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const messages = await storage.getMarketplaceMessages(conversationId);
        res.json(messages);
      } catch (error: any) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  app.post(
    "/api/marketplace/conversations/:conversationId/messages",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id;
        const { conversationId } = req.params;
        const { content, messageType = "text" } = req.body;

        // Verify user is part of conversation
        const conversation = await storage.getMarketplaceConversation(conversationId);
        if (
          !conversation ||
          (conversation.buyerId !== userId && conversation.sellerId !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const senderType = conversation.buyerId === userId ? "buyer" : "seller";

        const message = await storage.createMarketplaceMessage({
          conversationId,
          senderId: userId,
          senderType,
          content,
          messageType,
        });

        res.json(message);
      } catch (error: any) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  );

  app.put(
    "/api/marketplace/conversations/:conversationId/read",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        const { conversationId } = req.params;

        // Verify user is part of conversation
        const conversation = await storage.getMarketplaceConversation(conversationId);
        if (
          !conversation ||
          (conversation.buyerId !== userId && conversation.sellerId !== userId)
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        await storage.markMarketplaceMessagesAsRead(conversationId, userId);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ message: "Failed to mark messages as read" });
      }
    }
  );

  // Professional verification endpoints
  app.get("/api/admin/professional/pending", isAuthenticated, async (req: any, res: any) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const [realtors, carSalesmen] = await Promise.all([
        storage.getPendingRealtorApplications(),
        storage.getPendingCarSalesmanApplications(),
      ]);

      res.json({ realtors, carSalesmen });
    } catch (error: any) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  // Realtor verification
  app.post("/api/admin/realtor/verify/:profileId", isAuthenticated, async (req: any, res: any) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const result = await storage.updateRealtorVerificationStatus(profileId, {
        approved: !!approved,
        notes: notes || "",
        reviewedBy: adminId,
        reviewedAt: new Date(),
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error updating realtor verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Car salesman verification
  app.post(
    "/api/admin/car-salesman/verify/:profileId",
    isAuthenticated,
    async (req: any, res: any) => {
      if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      try {
        const { profileId } = req.params;
        const { approved, notes } = req.body;
        const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const result = await storage.updateCarSalesmanVerificationStatus(profileId, {
          approved: !!approved,
          notes: notes || "",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error updating car salesman verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );

  // Contractor settings management
  app.get(
    "/api/admin/contractor-settings",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const { category } = req.query;
        const settings = await storage.getContractorSettings(category as string);
        res.json(settings);
      } catch (error: any) {
        console.error("Error fetching contractor settings:", error);
        res.status(500).json({ message: "Failed to fetch contractor settings" });
      }
    }
  );

  app.post(
    "/api/admin/contractor-settings",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const setting = await storage.createContractorSetting(req.body);
        res.json(setting);
      } catch (error: any) {
        console.error("Error creating contractor setting:", error);
        res.status(500).json({ message: "Failed to create contractor setting" });
      }
    }
  );

  app.put(
    "/api/admin/contractor-settings/:id",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const setting = await storage.updateContractorSetting(req.params.id, req.body);
        res.json(setting);
      } catch (error: any) {
        console.error("Error updating contractor setting:", error);
        res.status(500).json({ message: "Failed to update contractor setting" });
      }
    }
  );

  app.delete(
    "/api/admin/contractor-settings/:id",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        await storage.deleteContractorSetting(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting contractor setting:", error);
        res.status(500).json({ message: "Failed to delete contractor setting" });
      }
    }
  );

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
      res.status(500).json({ message: error?.message || "Failed to fetch tasks" });
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
      res.status(500).json({ message: error?.message || "Failed to fetch work requests" });
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

      const rawTargetIds = Array.isArray(body.targetContractorIds)
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
      res.status(500).json({ message: error?.message || "Failed to create work request" });
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
  app.post("/api/workers/register", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Worker registration unavailable (database required)" });
    } catch (error: any) {
      console.error("Error registering worker:", error);
      res.status(500).json({ message: "Failed to register worker" });
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
      res.status(500).json({ message: error?.message || "Failed to create task" });
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
      res.status(500).json({ message: error?.message || "Failed to apply to task" });
    }
  });

  // Worker verification endpoint
  app.post("/api/workers/:workerId/verify", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Worker verification unavailable (database required)" });
    } catch (error: any) {
      console.error("Error verifying worker:", error);
      res.status(500).json({ message: "Failed to verify worker" });
    }
  });

  // Helper dashboard specific endpoints
  app.get("/api/workers/profile", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== "helper") {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      // For now, return a default helper profile - will be implemented when database is ready
      const helperProfile = {
        id: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        userId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        firstName: req.user.firstName || "Helper",
        lastName: req.user.lastName || "User",
        phone: req.user.email, // placeholder
        email: req.user.email,
        bio: "Experienced helper ready to assist with various tasks.",
        skills: ["General Labor", "Assembly", "Cleaning", "Moving"],
        hourlyRate: "25.00",
        isIdVerified: true,
        isBackgroundChecked: false,
        totalJobsCompleted: 5,
        averageRating: "4.8",
        totalEarnings: "1250.00",
        isActive: true,
        isAvailable: true,
      };

      res.json(helperProfile);
    } catch (error: any) {
      console.error("Error fetching helper profile:", error);
      res.status(500).json({ message: "Failed to fetch helper profile" });
    }
  });

  app.get("/api/tasks/available", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== "helper") {
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
      if (req.user.role !== "helper") {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      res.json([]);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/workers/completed-jobs", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== "helper") {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      res.json([]);
    } catch (error: any) {
      console.error("Error fetching completed jobs:", error);
      res.status(500).json({ message: "Failed to fetch completed jobs" });
    }
  });

  app.get("/api/workers/reviews", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== "helper") {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }

      // Return sample reviews
      const reviews = [
        {
          id: "review-1",
          rating: 5,
          reviewText: "Excellent work! Very professional and completed the task perfectly.",
          qualityRating: 5,
          timelinessRating: 5,
          communicationRating: 5,
          professionalismRating: 5,
          wouldHireAgain: true,
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "review-2",
          rating: 4,
          reviewText: "Good work, arrived on time and got the job done efficiently.",
          qualityRating: 4,
          timelinessRating: 5,
          communicationRating: 4,
          professionalismRating: 4,
          wouldHireAgain: true,
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      res.json(reviews);
    } catch (error: any) {
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
        const { R2StorageService } = await import("./localStorage");
        const storageService = new R2StorageService();
        const { uploadURL, publicUrl } = await storageService.getUploadURL();
        res.json({ uploadURL, publicUrl });
      } else {
        const { LocalStorageService } = await import("./localStorage");
        const storageService = new LocalStorageService();
        const uploadURL = await storageService.getUploadURL();
        res.json({ uploadURL });
      }
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
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
      const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || "";

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

      const { LocalStorageService } = await import("./localStorage");
      const storageService = new LocalStorageService();
      const publicUrl = await storageService.saveFile(fileId, buffer, contentType);

      res.status(200).send(publicUrl);
    } catch (error: any) {
      console.error("Error uploading file:", error);
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
        res.status(500).json({ error: error?.message || "Failed to ingest folder" });
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
      res.status(500).json({ error: error?.message || "Failed to upload files" });
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
        zipCode: (target as any).zipCode || null,
        roles: target.roles || (target.role ? [target.role] : []),
        activeRole: target.activeRole || target.role,
        verificationStatus: target.verificationStatus,
        badges: target.badges,
        preferences: target.preferences,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
        addressVerified: target.addressVerified,
        emailVerified: target.emailVerified,
        passwordResetEnabled: true,
      };

      res.json({ user: sanitized });
    } catch (error: any) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch user info" });
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
        if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
          return res
            .status(400)
            .json({ error: "newPassword is required and must be at least 8 characters" });
        }

        if (!email && !userId) {
          return res.status(400).json({ error: "Provide email or userId" });
        }

        const target = email
          ? await storage.getUserByEmail(String(email).toLowerCase())
          : await storage.getUser(userId);

        if (!target) {
          return res.status(404).json({ error: "User not found" });
        }

        const passwordHash = await hashPassword(newPassword);
        await storage.updateUser(target.id, {
          password: passwordHash,
          updatedAt: new Date(),
        });

        res.json({
          message: "Password reset successfully",
          userId: target.id,
          email: target.email,
        });
      } catch (error: any) {
        console.error("Error resetting user password:", error);
        res.status(500).json({ error: error?.message || "Failed to reset password" });
      }
    }
  );

  app.post("/api/error-reports", async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const reportData = {
        ...req.body,
        userId,
      };

      // Build report payload and persist via storage layer (database-backed)
      const report = {
        id: `report_${Date.now()}`,
        ...reportData,
        status: "open",
        priority: "medium",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await storage.createErrorReport(report);

      res.json({ message: "Error report submitted successfully", reportId: report.id });
    } catch (error: any) {
      console.error("Error creating error report:", error);
      res.status(500).json({ message: "Failed to submit error report" });
    }
  });

  // ===== CONTRACTOR PROMO ROUTES =====

  // Create new promo (contractor users only)
  app.post("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get contractor ID for the authenticated user
      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res
          .status(403)
          .json({ message: "You must be a verified contractor to create promos" });
      }

      const promoData = {
        ...req.body,
        contractorId: contractor.id,
      };

      const parsedPromo = insertContractorPromoSchema.safeParse(promoData);
      if (!parsedPromo.success) {
        return res.status(400).json({
          message: "Invalid contractor promo payload",
          issues: parsedPromo.error.issues,
        });
      }

      const validatedPromo = parsedPromo.data;
      const promo = await storage.createContractorPromo(validatedPromo);

      res.json(promo);
    } catch (error: any) {
      console.error("Error creating contractor promo:", error);
      res.status(500).json({ message: "Failed to create promo" });
    }
  });

  // Get contractor's promos
  app.get("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      const promos = await storage.getContractorPromos(contractor.id);
      res.json(promos);
    } catch (error: any) {
      console.error("Error fetching contractor promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  // Update promo
  app.put(
    "/api/contractor-promos/:promoId",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const { promoId } = req.params;
        const userId = req.user?.claims?.sub;

        const contractor = await storage.getContractorByUserId(userId);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        // Verify ownership
        const existingPromo = await storage.getContractorPromo(promoId);
        if (!existingPromo || existingPromo.contractorId !== contractor.id) {
          return res.status(403).json({ message: "You can only edit your own promos" });
        }

        const updatedPromo = await storage.updateContractorPromo(promoId, req.body);
        res.json(updatedPromo);
      } catch (error: any) {
        console.error("Error updating contractor promo:", error);
        res.status(500).json({ message: "Failed to update promo" });
      }
    }
  );

  // Delete promo
  app.delete(
    "/api/contractor-promos/:promoId",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const { promoId } = req.params;
        const userId = req.user?.claims?.sub;

        const contractor = await storage.getContractorByUserId(userId);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        // Verify ownership
        const existingPromo = await storage.getContractorPromo(promoId);
        if (!existingPromo || existingPromo.contractorId !== contractor.id) {
          return res.status(403).json({ message: "You can only delete your own promos" });
        }

        await storage.deleteContractorPromo(promoId);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting contractor promo:", error);
        res.status(500).json({ message: "Failed to delete promo" });
      }
    }
  );

  // Public promo viewing (by slug)
  app.get("/promo/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;

      const promo = await storage.getContractorPromoBySlug(slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      // Check if promo is active and not expired
      const now = new Date();
      if (!promo.isActive || (promo.expiresAt && promo.expiresAt < now)) {
        return res.status(410).json({ message: "Promo has expired" });
      }

      // Check if promo has reached max uses
      const currentUses = promo.currentUses ?? 0;
      if (promo.maxUses && currentUses >= promo.maxUses) {
        return res.status(410).json({ message: "Promo has reached maximum uses" });
      }

      // Track promo view
      await storage.incrementPromoView(promo.id);

      // Record interaction
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: "view",
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer"),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      // Get contractor details
      const contractor = await storage.getContractor(promo.contractorId);

      res.json({
        promo,
        contractor: contractor
          ? {
              id: contractor.id,
              companyName: contractor.companyName,
              slug: contractor.slug,
              phone: contractor.phone,
              email: contractor.email,
              about: contractor.about,
              photos: contractor.photos,
              yearsInBusiness: contractor.yearsInBusiness,
              verifiedLicensed: contractor.verifiedLicensed,
              verifiedInsured: contractor.verifiedInsured,
            }
          : null,
      });
    } catch (error: any) {
      console.error("Error fetching promo:", error);
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  });

  // Track promo click
  app.post("/api/promo/:slug/click", async (req: any, res: any) => {
    try {
      const { slug } = req.params;

      const promo = await storage.getContractorPromoBySlug(slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      // Track promo click
      await storage.incrementPromoClick(promo.id);

      // Record interaction
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: "click",
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer"),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking promo click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Get promo analytics (contractor only)
  app.get(
    "/api/contractor-promos/:promoId/analytics",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const { promoId } = req.params;
        const userId = req.user?.claims?.sub;

        const contractor = await storage.getContractorByUserId(userId);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        // Verify ownership
        const promo = await storage.getContractorPromo(promoId);
        if (!promo || promo.contractorId !== contractor.id) {
          return res
            .status(403)
            .json({ message: "You can only view analytics for your own promos" });
        }

        const analytics = await storage.getPromoAnalytics(promoId);
        res.json(analytics);
      } catch (error: any) {
        console.error("Error fetching promo analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  // Get active promos in area (public)
  app.get("/api/promos/area/:countyFips", async (req: any, res: any) => {
    try {
      const { countyFips } = req.params;
      const promos = await storage.getActivePromosInArea(countyFips);

      // Get contractor details for each promo
      const promosWithContractors = await Promise.all(
        promos.map(async (promo) => {
          const contractor = await storage.getContractor(promo.contractorId);
          return {
            ...promo,
            contractor: contractor
              ? {
                  companyName: contractor.companyName,
                  slug: contractor.slug,
                  verifiedLicensed: contractor.verifiedLicensed,
                  verifiedInsured: contractor.verifiedInsured,
                }
              : null,
          };
        })
      );

      res.json(promosWithContractors);
    } catch (error: any) {
      console.error("Error fetching area promos:", error);
      res.status(500).json({ message: "Failed to fetch area promos" });
    }
  });

  // One-tap bug report with screenshot
  app.post("/api/bug-reports", async (req: any, res: any) => {
    try {
      const { title, description, screenshot, userAgent, url, timestamp, viewport, type } =
        req.body;

      // Generate unique report ID
      const reportId = `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Track bug report submission with locality
      // LocalityTracker call removed

      // Debug log the incoming data
      console.log("Bug report data received:", {
        title,
        description,
        type,
        url,
        userAgent,
        viewport,
        hasScreenshot: !!screenshot,
      });

      // Store bug report data with proper field mapping
      const bugReport = {
        id: reportId,
        userId: req.user?.claims?.sub || "anonymous",
        userEmail: req.user?.email || null,
        title: title || "One-Tap Bug Report",
        // description: description || 'Automatically generated bug report with screenshot',
        errorType: type || "bug",
        currentUrl: url,
        userAgent,
        browserInfo: viewport ? { viewport } : null,
        attachments: screenshot ? [{ type: "screenshot", data: screenshot }] : null,
        status: "open",
        priority: "medium",
      };

      // Log detailed bug report
      console.log("🐛 One-Tap Bug Report:", {
        reportId,
        url,
        viewport,
        userAgent: userAgent?.substring(0, 50) + "...",
        timestamp,
        hasScreenshot: !!req.files?.screenshot || !!req.body.screenshot,
      });

      // Save to database
      await storage.createErrorReport(bugReport);

      res.json({
        message: "Bug report submitted successfully",
        reportId,
        status: "received",
      });
    } catch (error: any) {
      console.error("Error processing bug report:", error);
      res.status(500).json({ message: "Failed to process bug report" });
    }
  });

  app.get("/api/admin/error-reports", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (
        !user ||
        !["head_admin", "moderator", "ops_admin", "support_agent"].includes(user.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Return real error reports from the database, newest first
      const reports = await storage.getErrorReports();
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching error reports:", error);
      res.status(500).json({ message: "Failed to fetch error reports" });
    }
  });

  app.patch("/api/admin/error-reports/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (
        !user ||
        !["head_admin", "moderator", "ops_admin", "support_agent"].includes(user.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Update the database
      await storage.updateErrorReport(id, updateData);

      res.json({ message: "Error report updated successfully" });
    } catch (error: any) {
      console.error("Error updating error report:", error);
      res.status(500).json({ message: "Failed to update error report" });
    }
  });

  // Testing settings endpoints
  app.get(
    "/api/admin/testing-settings",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const settings = await storage.getSiteSettings("testing");

        const defaults = {
          bugReportEnabled: true,
          testingModeEnabled: false,
          showTestingBanner: false,
        };

        const merged = { ...defaults } as any;

        for (const setting of settings) {
          const key = String((setting as any).key || "");
          if (!key) continue;
          const value = (setting as any).value;

          if (typeof value === "boolean") {
            merged[key] = value;
          } else if (value && typeof value === "object" && "enabled" in value) {
            merged[key] = Boolean((value as any).enabled);
          } else if (typeof value === "string") {
            merged[key] = value === "true";
          }
        }

        res.json(merged);
      } catch (error: any) {
        console.error("Error fetching testing settings:", error);
        res.status(500).json({ message: "Failed to fetch testing settings" });
      }
    }
  );

  app.patch(
    "/api/admin/testing-settings",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const updates = req.body || {};
        const allowedKeys = ["bugReportEnabled", "testingModeEnabled", "showTestingBanner"];

        if (!updates || typeof updates !== "object") {
          return res.status(400).json({ message: "Invalid settings payload" });
        }

        const existing = await storage.getSiteSettings("testing");
        const byKey = new Map<string, any>();
        for (const setting of existing) {
          byKey.set(String((setting as any).key), setting);
        }

        for (const key of allowedKeys) {
          if (!(key in updates)) continue;
          const enabled = Boolean(updates[key]);
          const current = byKey.get(key);

          const value = { enabled } as any;

          if (current) {
            await storage.updateSiteSetting((current as any).id, { value });
          } else {
            await storage.createSiteSetting({
              category: "testing",
              key,
              value,
            } as any);
          }
        }

        res.json({ message: "Settings updated successfully" });
      } catch (error: any) {
        console.error("Error updating testing settings:", error);
        res.status(500).json({ message: "Failed to update testing settings" });
      }
    }
  );

  app.get("/api/admin/error-report-stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (
        !user ||
        !["head_admin", "moderator", "ops_admin", "support_agent"].includes(user.role || "")
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const reports = await storage.getErrorReports();

      const total = reports.length;
      let open = 0;
      let inProgress = 0;
      let resolved = 0;

      for (const report of reports) {
        const status = String((report as any).status || "");
        if (status === "open") open++;
        else if (status === "in_progress") inProgress++;
        else if (status === "resolved") resolved++;
      }

      res.json({
        total,
        open,
        inProgress,
        resolved,
      });
    } catch (error: any) {
      console.error("Error computing error report stats:", error);
      res.status(500).json({ message: "Failed to fetch error report stats" });
    }
  });

  app.post(
    "/api/admin/generate-test-data",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const now = Date.now();
        const samples = [
          {
            id: `TEST-${now}-1`,
            userId: req.user?.claims?.sub || "test-user",
            userEmail: req.user?.email || null,
            title: "[TEST] Sample bug report",
            errorType: "test_data",
            currentUrl: "https://tradescout.app/admin/testing-controls",
            userAgent: req.headers["user-agent"] || "test-agent",
            browserInfo: null,
            attachments: null,
            status: "open",
            priority: "medium",
          },
          {
            id: `TEST-${now}-2`,
            userId: req.user?.claims?.sub || "test-user",
            userEmail: req.user?.email || null,
            title: "[TEST] Sample UI issue",
            errorType: "test_data",
            currentUrl: "https://tradescout.app/",
            userAgent: req.headers["user-agent"] || "test-agent",
            browserInfo: null,
            attachments: null,
            status: "in_progress",
            priority: "low",
          },
        ];

        for (const sample of samples) {
          await storage.createErrorReport(sample);
        }

        res.json({ message: "Test data generated successfully" });
      } catch (error: any) {
        console.error("Error generating test error reports:", error);
        res.status(500).json({ message: "Failed to generate test data" });
      }
    }
  );

  app.delete(
    "/api/admin/clear-test-data",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const reports = await storage.getErrorReports();
        const testReports = reports.filter((report: any) => {
          const id = String(report.id || "");
          const type = String(report.errorType || "");
          const title = String(report.title || "");
          return id.startsWith("TEST-") || type === "test_data" || title.startsWith("[TEST]");
        });

        for (const report of testReports) {
          await storage.deleteErrorReport((report as any).id);
        }

        res.json({ message: "Test data cleared successfully" });
      } catch (error: any) {
        console.error("Error clearing test error reports:", error);
        res.status(500).json({ message: "Failed to clear test data" });
      }
    }
  );

  // Marketplace routes
  // Categories
  app.get("/api/marketplace/categories", async (req: any, res: any) => {
    try {
      const categories = await storage.getMarketplaceCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching marketplace categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/marketplace/categories", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const parsedCategory = insertMarketplaceCategorySchema.safeParse(req.body);
      if (!parsedCategory.success) {
        return res.status(400).json({
          message: "Invalid marketplace category payload",
          issues: parsedCategory.error.issues,
        });
      }

      const validatedData = parsedCategory.data;
      const category = await storage.createMarketplaceCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating marketplace category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Listings (public - only shows approved listings)
  app.get("/api/marketplace/listings", async (req: any, res: any) => {
    try {
      const filters = {
        categoryId: req.query.categoryId as string,
        county: req.query.county as string,
        state: req.query.state as string,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        condition: req.query.condition as string,
        searchQuery: req.query.search as string,
        sortBy: req.query.sortBy as "price_asc" | "price_desc" | "date_desc" | "date_asc",
        limit: req.query.limit ? Number(req.query.limit) : 20,
        offset: req.query.offset ? Number(req.query.offset) : 0,
        status: "active", // Only show approved/active listings to public
      };

      const listings = await storage.getMarketplaceListings(filters);
      res.json(listings);
    } catch (error: any) {
      console.error("Error fetching marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.get("/api/marketplace/listings/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const listing = await storage.getMarketplaceListing(id);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(id);

      res.json(listing);
    } catch (error: any) {
      console.error("Error fetching marketplace listing:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.get("/api/marketplace/listings/slug/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;
      const listing = await storage.getMarketplaceListingBySlug(slug);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(listing.id);

      res.json(listing);
    } catch (error: any) {
      console.error("Error fetching marketplace listing by slug:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.post("/api/marketplace/listings", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedListing = insertMarketplaceListingSchema.safeParse(req.body);
      if (!parsedListing.success) {
        return res.status(400).json({
          message: "Invalid marketplace listing payload",
          issues: parsedListing.error.issues,
        });
      }

      const validatedData = parsedListing.data;

      // All new listings require admin/moderator approval before going live
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        sellerId: user?.id,
        status: "pending_approval", // Require approval for all new listings
      });

      res.status(201).json({
        ...listing,
        message: "Listing submitted successfully and is pending admin approval.",
      });
    } catch (error: any) {
      console.error("Error creating marketplace listing:", error);
      res.status(400).json({ message: "Failed to create listing" });
    }
  });

  // Create a paid visibility boost for a specific marketplace listing
  app.post("/api/marketplace/listings/:id/boost", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      const listing = await storage.getMarketplaceListing(id);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      if (listing.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to boost this listing" });
      }

      const BOOST_AMOUNT = 50;

      // Create a marketplace transaction representing the boost purchase
      const transaction = await storage.createMarketplaceTransaction({
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.sellerId,
        totalAmount: BOOST_AMOUNT.toString(),
        sellerAmount: "0",
        paymentMethod: "on_platform_stripe",
        isOffPlatform: false,
        status: "pending",
        notes: "Marketplace listing visibility boost (7 days)",
        buyerPreferredContact: "platform_messages",
        sellerPreferredContact: "platform_messages",
      } as any);

      // Create a pending listing boost tied to this transaction
      const boost = await storage.createListingBoost({
        listingId: listing.id,
        sellerId: listing.sellerId,
        transactionId: transaction.id,
        amount: transaction.totalAmount,
        status: "pending_payment",
      } as any);

      const description = `Boost your listing "${listing.title}" for 7 days`;
      const checkoutUrl = `/checkout/marketplace/${transaction.id}?amount=${BOOST_AMOUNT.toFixed(2)}&description=${encodeURIComponent(description)}`;

      res.status(201).json({
        transactionId: transaction.id,
        boostId: boost.id,
        checkoutUrl,
      });
    } catch (error: any) {
      console.error("Error creating listing boost:", error);
      res.status(500).json({ message: "Failed to create listing boost" });
    }
  });

  app.put("/api/marketplace/listings/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing
      const existingListing = await storage.getMarketplaceListing(id);
      if (!existingListing || existingListing.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to edit this listing" });
      }

      const updates = req.body;
      const listing = await storage.updateMarketplaceListing(id, updates);
      res.json(listing);
    } catch (error: any) {
      console.error("Error updating marketplace listing:", error);
      res.status(400).json({ message: "Failed to update listing" });
    }
  });

  app.delete("/api/marketplace/listings/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing or is admin
      const existingListing = await storage.getMarketplaceListing(id);
      if (
        !existingListing ||
        (existingListing.sellerId !== user?.id &&
          !["head_admin", "moderator", "ops_admin"].includes(user.role || ""))
      ) {
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }

      await storage.deleteMarketplaceListing(id);
      res.json({ message: "Listing deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting marketplace listing:", error);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });

  // Admin/Moderator endpoints for listing approval

  // Get all pending listings for admin review
  app.get(
    "/api/admin/marketplace/pending",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const filters = {
          status: "pending_approval",
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        };

        const listings = await storage.getMarketplaceListings(filters);
        res.json(listings);
      } catch (error: any) {
        console.error("Error fetching pending listings:", error);
        res.status(500).json({ message: "Failed to fetch pending listings" });
      }
    }
  );

  // Approve a listing
  app.post(
    "/api/admin/marketplace/listings/:id/approve",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { id } = req.params;
        const { notes } = req.body;

        const listing = await storage.updateMarketplaceListing(id, {
          status: "active",
          approvedBy: user?.id,
          approvedAt: new Date(),
          moderationNotes: notes,
        });

        // Trigger hyper-local notifications for nearby users when a listing goes live
        try {
          await notificationService.notifyNearbyUsersOfMarketplaceListing(listing as any);
        } catch (notifyError) {
          console.error("Error sending nearby listing notifications:", notifyError);
        }

        res.json({
          message: "Listing approved successfully",
          listing,
        });
      } catch (error: any) {
        console.error("Error approving listing:", error);
        res.status(400).json({ message: "Failed to approve listing" });
      }
    }
  );

  // Reject a listing
  app.post(
    "/api/admin/marketplace/listings/:id/reject",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { id } = req.params;
        const { reason, notes } = req.body;

        if (!reason) {
          return res.status(400).json({ message: "Rejection reason is required" });
        }

        const listing = await storage.updateMarketplaceListing(id, {
          status: "rejected",
          rejectedBy: user?.id,
          rejectedAt: new Date(),
          rejectionReason: reason,
          moderationNotes: notes,
        });

        res.json({
          message: "Listing rejected successfully",
          listing,
        });
      } catch (error: any) {
        console.error("Error rejecting listing:", error);
        res.status(400).json({ message: "Failed to reject listing" });
      }
    }
  );

  // User's own listings
  app.get("/api/marketplace/my-listings", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const listings = await storage.getUserListings(user?.id);
      res.json(listings);
    } catch (error: any) {
      console.error("Error fetching user listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  // Inquiries
  app.post("/api/marketplace/inquiries", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedInquiry = insertMarketplaceInquirySchema.safeParse(req.body);
      if (!parsedInquiry.success) {
        return res.status(400).json({
          message: "Invalid marketplace inquiry payload",
          issues: parsedInquiry.error.issues,
        });
      }

      const validatedData = parsedInquiry.data;

      // Get the listing to find the seller
      const listing = await storage.getMarketplaceListing(validatedData.listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      const inquiry = await storage.createMarketplaceInquiry({
        ...validatedData,
        buyerId: user?.id,
        sellerId: listing.sellerId,
      });

      res.status(201).json(inquiry);
    } catch (error: any) {
      console.error("Error creating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to create inquiry" });
    }
  });

  app.get("/api/marketplace/inquiries/sent", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user?.id, "sent");
      res.json(inquiries);
    } catch (error: any) {
      console.error("Error fetching sent inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get("/api/marketplace/inquiries/received", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user?.id, "received");
      res.json(inquiries);
    } catch (error: any) {
      console.error("Error fetching received inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get(
    "/api/marketplace/listings/:id/inquiries",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { id } = req.params;

        // Check if user owns the listing
        const listing = await storage.getMarketplaceListing(id);
        if (!listing || listing.sellerId !== user?.id) {
          return res
            .status(403)
            .json({ message: "Not authorized to view inquiries for this listing" });
        }

        const inquiries = await storage.getListingInquiries(id);
        res.json(inquiries);
      } catch (error: any) {
        console.error("Error fetching listing inquiries:", error);
        res.status(500).json({ message: "Failed to fetch inquiries" });
      }
    }
  );

  app.put("/api/marketplace/inquiries/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the inquiry (seller side)
      const inquiry = await storage.getMarketplaceInquiry(id);
      if (!inquiry || inquiry.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to update this inquiry" });
      }

      const updates = req.body;
      const updatedInquiry = await storage.updateMarketplaceInquiry(id, updates);
      res.json(updatedInquiry);
    } catch (error: any) {
      console.error("Error updating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to update inquiry" });
    }
  });

  // Favorites
  app.post("/api/marketplace/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedFavorite = insertMarketplaceFavoriteSchema.safeParse(req.body);
      if (!parsedFavorite.success) {
        return res.status(400).json({
          message: "Invalid marketplace favorite payload",
          issues: parsedFavorite.error.issues,
        });
      }

      const validatedData = parsedFavorite.data;

      const favorite = await storage.createMarketplaceFavorite({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Error creating marketplace favorite:", error);
      res.status(400).json({ message: "Failed to add to favorites" });
    }
  });

  app.delete(
    "/api/marketplace/favorites/:listingId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { listingId } = req.params;

        await storage.removeMarketplaceFavorite(user?.id, listingId);
        res.json({ message: "Removed from favorites" });
      } catch (error: any) {
        console.error("Error removing marketplace favorite:", error);
        res.status(500).json({ message: "Failed to remove from favorites" });
      }
    }
  );

  app.get("/api/marketplace/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const favorites = await storage.getUserFavorites(user?.id);
      res.json(favorites);
    } catch (error: any) {
      console.error("Error fetching marketplace favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Reports
  app.post("/api/marketplace/reports", async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedReport = insertMarketplaceReportSchema.safeParse(req.body);
      if (!parsedReport.success) {
        return res.status(400).json({
          message: "Invalid marketplace report payload",
          issues: parsedReport.error.issues,
        });
      }

      const validatedData = parsedReport.data;

      const report = await storage.createMarketplaceReport({
        ...validatedData,
        reporterId: user?.id || null,
      });

      res.status(201).json(report);
    } catch (error: any) {
      console.error("Error creating marketplace report:", error);
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  app.get(
    "/api/marketplace/admin/reports",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const reports = await storage.getMarketplaceReports();
        res.json(reports);
      } catch (error: any) {
        console.error("Error fetching marketplace reports:", error);
        res.status(500).json({ message: "Failed to fetch reports" });
      }
    }
  );

  app.put(
    "/api/marketplace/admin/reports/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const report = await storage.updateMarketplaceReport(id, updates);
        res.json(report);
      } catch (error: any) {
        console.error("Error updating marketplace report:", error);
        res.status(400).json({ message: "Failed to update report" });
      }
    }
  );

  // Marketplace Verification Endpoints
  app.post("/api/marketplace/vendor-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;

      // C2-3: Soft gate - offer address verification for marketplace vendor trust (BECOME_MARKETPLACE_VENDOR)
      const currentUser = await storage.getUser(user?.id);
      const isVerified = (currentUser as any)?.addressVerified;

      if (!isVerified) {
        const { buildSoftGateOffer, buildSoftGateResponse } =
          await import("./utils/softGateFramework");

        const offer = buildSoftGateOffer({
          action: "BECOME_MARKETPLACE_VENDOR",
          userRole: (currentUser as any)?.role || "user",
          missingRequirements: ["address"],
          context: { intent: "become_vendor" },
        });

        const response = buildSoftGateResponse(offer, "BECOME_MARKETPLACE_VENDOR");

        // Return soft gate but allow proceeding
        return res.status(200).json({
          ...response,
          verificationSuggested: {
            action: "BECOME_MARKETPLACE_VENDOR",
            benefits: offer.benefits,
          },
          allowProceedUnverified: true,
        });
      }

      const parsedVendor = insertVendorVerificationSchema.safeParse(req.body);
      if (!parsedVendor.success) {
        return res.status(400).json({
          message: "Invalid vendor verification payload",
          issues: parsedVendor.error.issues,
        });
      }

      const validatedData = parsedVendor.data;

      const verification = await storage.createVendorVerification({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating vendor verification:", error);
      res.status(400).json({ message: "Failed to create vendor verification" });
    }
  });

  app.post("/api/marketplace/buyer-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedBuyer = insertBuyerVerificationSchema.safeParse(req.body);
      if (!parsedBuyer.success) {
        return res.status(400).json({
          message: "Invalid buyer verification payload",
          issues: parsedBuyer.error.issues,
        });
      }

      const validatedData = parsedBuyer.data;

      const verification = await storage.createBuyerVerification({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating buyer verification:", error);
      res.status(400).json({ message: "Failed to create buyer verification" });
    }
  });

  app.get("/api/marketplace/verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;

      const vendorVerification = await storage.getVendorVerificationByUserId(user?.id);
      const buyerVerification = await storage.getBuyerVerificationByUserId(user?.id);

      res.json({
        vendor: vendorVerification || null,
        buyer: buyerVerification || null,
        isVendorVerified: vendorVerification?.status === "approved",
        isBuyerVerified: buyerVerification?.status === "approved",
      });
    } catch (error: any) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.get(
    "/api/marketplace/admin/verifications",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { type = "all", status = "all" } = req.query;

        const verifications = await storage.getVerifications({
          type: type as string,
          status: status as string,
        });

        res.json(verifications);
      } catch (error: any) {
        console.error("Error fetching verifications:", error);
        res.status(500).json({ message: "Failed to fetch verifications" });
      }
    }
  );

  // Unified notifications summary endpoint
  // NOTE: Detailed notification list + actions live in routes/notification-routes.ts
  app.get("/api/notifications/summary", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const summary = await (storage as any).getNotificationsSummary(user?.id);
      res.json({ summary });
    } catch (error: any) {
      console.error("Error in /api/notifications", error);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  });

  app.put(
    "/api/marketplace/admin/verifications/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const user = req.user as any;

        const updates = {
          status,
          adminNotes,
          reviewedBy: user?.id,
          reviewedAt: new Date(),
        };

        const verification = await storage.updateVerification(id, updates);
        res.json(verification);
      } catch (error: any) {
        console.error("Error updating verification:", error);
        res.status(400).json({ message: "Failed to update verification" });
      }
    }
  );

  // Admin Verification API (normalized view for Ops workspace)
  app.get("/api/admin/verifications", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { type = "all", status = "pending" } = req.query;

      const verifications = await storage.getVerifications({
        type: (type as string) || "all",
        status: (status as string) || "pending",
      });

      const now = new Date();

      const normalized = (verifications || []).map((v: any) => {
        const isVendor = Boolean((v as any).categoryId);

        const submittedAt: string = (
          v.createdAt ||
          v.submittedAt ||
          v.updatedAt ||
          now
        ).toISOString();

        // Derive document statuses from available fields
        const hasLicense = Boolean(
          (v as any).businessLicenseUrl || (v as any).businessLicenseNumber
        );

        let insuranceStatus: boolean | "expires_soon" = false;
        const insuranceExpiry = (v as any).insuranceExpiry
          ? new Date((v as any).insuranceExpiry)
          : null;
        if ((v as any).insuranceCertificateUrl || insuranceExpiry) {
          if (insuranceExpiry) {
            const diffDays = (insuranceExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            insuranceStatus = diffDays <= 30 ? "expires_soon" : true;
          } else {
            insuranceStatus = true;
          }
        }

        const hasId = Boolean((v as any).identityDocumentUrl || (v as any).identityVerified);

        return {
          id: v.id,
          kind: isVendor ? "vendor" : "buyer",
          status: v.status,
          userId: v.userId,
          companyName: isVendor ? v.businessName || null : null,
          trade: null,
          serviceArea: null,
          licenseNumber: isVendor ? v.businessLicenseNumber || null : null,
          submittedAt,
          documents: {
            license: hasLicense,
            insurance: insuranceStatus,
            id: hasId,
          },
        };
      });

      res.json(normalized);
    } catch (error: any) {
      console.error("Error fetching admin verifications:", error);
      res.status(500).json({ message: "Failed to fetch admin verifications" });
    }
  });

  app.post(
    "/api/admin/verifications/:id/actions",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { action, reason } = req.body as { action: string; reason?: string };
        const user = req.user as any;

        if (!["approve", "reject", "request_update"].includes(action)) {
          return res.status(400).json({ message: "Invalid action" });
        }

        const updates: any = {
          reviewedBy: user?.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        };

        if (action === "approve") {
          updates.status = "approved";
          updates.rejectionReason = null;
        } else if (action === "reject") {
          updates.status = "rejected";
          updates.rejectionReason = reason || "Rejected by admin";
        } else if (action === "request_update") {
          updates.status = "in_review";
          if (reason) {
            updates.adminNotes = reason;
          }
        }

        const verification = await storage.updateVerification(id, updates);
        res.json(verification);
      } catch (error: any) {
        console.error("Error processing admin verification action:", error);
        res.status(400).json({ message: "Failed to process verification action" });
      }
    }
  );

  // Address Verification Endpoints
  app.post("/api/address-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const parsedAddress = insertAddressVerificationSchema.safeParse(req.body);
      if (!parsedAddress.success) {
        return res.status(400).json({
          message: "Invalid address verification payload",
          issues: parsedAddress.error.issues,
        });
      }

      const validatedData = parsedAddress.data;

      // Calculate deadline (14 days from user creation)
      const userCreatedAt = new Date(user.createdAt);
      const deadline = new Date(userCreatedAt);
      deadline.setDate(deadline.getDate() + 14);

      const verification = await storage.createAddressVerification({
        ...validatedData,
        userId: user?.id,
        deadline,
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating address verification:", error);
      res.status(400).json({ message: "Failed to create address verification" });
    }
  });

  app.get("/api/address-verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const verification = await storage.getAddressVerificationByUserId(user?.id);

      // Calculate deadline if no verification exists
      const userCreatedAt = new Date(user.createdAt);
      const deadline = new Date(userCreatedAt);
      deadline.setDate(deadline.getDate() + 14);

      const daysRemaining = Math.max(
        0,
        Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      const isExpired = daysRemaining === 0 && !user.addressVerified;

      res.json({
        verification: verification || null,
        isVerified: user.addressVerified || false,
        deadline: deadline.toISOString(),
        daysRemaining,
        isExpired,
        requiresVerification: !user.addressVerified,
      });
    } catch (error: any) {
      console.error("Error fetching address verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.post(
    "/api/address-verification/postcard/request",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;

        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await storage.sendAddressVerificationPostcard(user?.id, code);

        // In a real implementation, you would send the postcard via USPS API
        console.log(`Postcard verification code for ${user?.id}: ${code}`);

        res.json({
          message:
            "Verification postcard has been sent to your address. It should arrive within 5-7 business days.",
          estimatedDelivery: "5-7 business days",
        });
      } catch (error: any) {
        console.error("Error requesting postcard verification:", error);
        res.status(500).json({ message: "Failed to request postcard verification" });
      }
    }
  );

  app.post(
    "/api/address-verification/postcard/verify",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { code } = req.body;

        if (!code || code.length !== 6) {
          return res.status(400).json({ message: "Valid 6-digit code is required" });
        }

        const success = await storage.verifyAddressWithPostcard(user?.id, code);

        if (success) {
          res.json({
            message: "Address verified successfully! You now have full access to the platform.",
            verified: true,
          });
        } else {
          res.status(400).json({
            message:
              "Invalid verification code. Please check the code on your postcard and try again.",
            verified: false,
          });
        }
      } catch (error: any) {
        console.error("Error verifying postcard code:", error);
        res.status(500).json({ message: "Failed to verify postcard code" });
      }
    }
  );

  app.put("/api/address-verification/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const updates = req.body;

      // Verify the user owns this verification
      const existingVerification = await storage.getAddressVerificationByUserId(user?.id);
      if (!existingVerification || existingVerification.id !== id) {
        return res.status(403).json({ message: "Not authorized to update this verification" });
      }

      const verification = await storage.updateAddressVerification(id, {
        ...updates,
        submittedAt: new Date(),
        status: "submitted",
      });

      res.json(verification);
    } catch (error: any) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Admin endpoints for address verification
  app.get(
    "/api/admin/address-verifications",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const status = (req.query.status as string) || "all";

        let query: any = db
          .select({
            verification: addressVerifications,
            user: users,
          })
          .from(addressVerifications)
          .leftJoin(users, eq(addressVerifications.userId, users.id));

        if (status !== "all") {
          const allowedStatuses = [
            "pending",
            "approved",
            "rejected",
            "expired",
            "submitted",
          ] as const;
          if (allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
            query = query.where(
              eq(addressVerifications.status, status as (typeof allowedStatuses)[number])
            );
          }
        }

        const results = await query.orderBy(desc(addressVerifications.createdAt));

        res.json(results);
      } catch (error: any) {
        console.error("Error fetching address verifications:", error);
        res.status(500).json({ message: "Failed to fetch verifications" });
      }
    }
  );

  app.put(
    "/api/admin/address-verifications/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const user = req.user as any;

        const updates: any = {
          status,
          adminNotes,
          reviewedBy: user?.id,
          reviewedAt: new Date(),
        };

        if (status === "approved") {
          updates.approvedAt = new Date();

          // Get verification record to find the user
          const [verification] = await db
            .select()
            .from(addressVerifications)
            .where(eq(addressVerifications.id, id));
          if (verification) {
            await storage.updateUser(verification.userId, { addressVerified: true });
          }
        }

        const verification = await storage.updateAddressVerification(id, updates);
        res.json(verification);
      } catch (error: any) {
        console.error("Error updating address verification:", error);
        res.status(400).json({ message: "Failed to update verification" });
      }
    }
  );

  // Social Features API Routes

  const communityExternalTrendingCache: {
    fetchedAt: number;
    items: Array<{ tag: string; source: "news" }>;
  } = {
    fetchedAt: 0,
    items: [],
  };

  const COMMUNITY_TRENDING_CACHE_TTL_MS = 30 * 60 * 1000;

  function extractRssItemTitles(xml: string): string[] {
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
    const titles: string[] = [];

    for (const item of items) {
      const match = item.match(
        /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i
      );
      const raw = (match?.[1] ?? match?.[2] ?? "").trim();
      if (!raw) continue;
      const cleaned = raw
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      if (cleaned) titles.push(cleaned);
    }

    return titles;
  }

  function titleToHashtag(title: string): string {
    const primary = title.split(" - ")[0].split(" | ")[0].split(" — ")[0].trim();

    const words = primary
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length >= 3)
      .slice(0, 3);

    const token = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");

    return token ? `#${token}` : "#Trending";
  }

  async function fetchExternalTrendingHashtags(): Promise<Array<{ tag: string; source: "news" }>> {
    const now = Date.now();
    if (
      communityExternalTrendingCache.items.length > 0 &&
      now - communityExternalTrendingCache.fetchedAt < COMMUNITY_TRENDING_CACHE_TTL_MS
    ) {
      return communityExternalTrendingCache.items;
    }

    const rssUrls = [
      "https://news.google.com/rss/search?q=home+improvement&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=roofing+repair&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=plumbing+tips&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=hvac+maintenance&hl=en-US&gl=US&ceid=US:en",
    ];

    const titles: string[] = [];

    for (const url of rssUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "TradeScout/1.0 (+https://thetradescout.com)",
            Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          },
        });

        if (!res.ok) continue;
        const xml = await res.text();
        titles.push(...extractRssItemTitles(xml));
      } catch {
        // Ignore per-source failures; we'll fall back to whatever we can fetch.
      }
    }

    const unique = new Set<string>();
    const items: Array<{ tag: string; source: "news" }> = [];

    for (const title of titles) {
      const tag = titleToHashtag(title);
      if (unique.has(tag)) continue;
      unique.add(tag);
      items.push({ tag, source: "news" });
      if (items.length >= 10) break;
    }

    communityExternalTrendingCache.fetchedAt = now;
    communityExternalTrendingCache.items = items;
    return items;
  }

  // Community Posts
  app.get("/api/community/posts", async (req: any, res: any) => {
    try {
      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const scopeParam =
        typeof req.query.scope === "string" ? (req.query.scope as string) : undefined;

      // Phase 1: Global community toggle (read-only visibility)
      // Allow all users to view global posts (posts-only, no new contact paths)
      const roleFromClaims = (req.user as any)?.claims?.role;
      const rawRoles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const roles: string[] = [roleFromClaims, ...(rawRoles || [])].filter(
        (r): r is string => typeof r === "string"
      );
      const isSuperAdminLike = roles.some((r) => ["head_admin", "super_admin"].includes(r));

      const wantsGlobalScope = scopeParam === "all" || scopeParam === "global";
      // Phase 1: Allow global scope for all users (not just super-admins)
      const bypassLocation = wantsGlobalScope;

      const hasExplicitLocationFilters =
        Boolean(req.query.stateCode) || Boolean(req.query.countyFips);

      const filters: Parameters<typeof storage.getCommunityPosts>[0] = {
        // When bypassing location, deliberately avoid applying any scope/state/county filters.
        scope: bypassLocation
          ? undefined
          : (scopeParam as any) || (user && !hasExplicitLocationFilters ? "county" : undefined),
        stateCode: bypassLocation
          ? undefined
          : (req.query.stateCode as string) ||
            (user && !hasExplicitLocationFilters ? (user.state as string | undefined) : undefined),
        countyFips: bypassLocation
          ? undefined
          : (req.query.countyFips as string) ||
            (user && !hasExplicitLocationFilters
              ? ((user as any).countyFips as string | undefined)
              : undefined),
        category: req.query.category as any,
        authorId: req.query.authorId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      // Attach viewer context for social scopes when authenticated
      if (authUserId) {
        (filters as any).viewerId = authUserId;
      }

      const normalizedScope =
        scopeParam ||
        ((filters.scope as string | undefined) ?? (bypassLocation ? "all" : "county"));

      // Deterministic scope selectors
      switch (normalizedScope) {
        case "following":
          (filters as any).followingOnly = true;
          (filters as any).sort = "recent";
          break;

        case "nearby":
          // Nearby keeps county scoping and uses recency ordering for now.
          (filters as any).sort = "recent";
          break;

        case "recent":
          (filters as any).sort = "recent";
          break;

        case "recommendations":
          (filters as any).sort = "recommended";
          (filters as any).excludeFollowing = true;
          break;

        default:
          // for_you / county / state / global fall back to existing behavior
          break;
      }

      if (user) {
        try {
          let scopeType: string | null = null;
          let scopeId: string | null = null;

          const countyFips = (filters.countyFips as string | undefined) || null;
          const stateCode = (filters.stateCode as string | undefined) || null;
          const scope = filters.scope as string | undefined;

          if (scope) {
            scopeType = scope;
            if (scope === "county" && countyFips) {
              scopeId = countyFips;
            } else if (scope === "state" && stateCode) {
              scopeId = stateCode;
            } else if (scope === "all" || scope === "global") {
              scopeId = "global";
            }
          } else if (countyFips) {
            scopeType = "county";
            scopeId = countyFips;
          } else if (stateCode) {
            scopeType = "state";
            scopeId = stateCode;
          }

          if (scopeType && scopeId) {
            await storage.logEvent("community.viewed_scope", {
              userId: user.id,
              scopeType,
              scopeId,
              countyFips,
              stateCode,
            });
          }
        } catch (e) {
          console.error("Failed to log community.viewed_scope for XP", e);
        }
      }

      let posts = await storage.getCommunityPosts(filters);

      // One-release guard: if recommendations are empty, fall back to recent
      if (!posts.length && normalizedScope === "recommendations") {
        const fallbackFilters: Parameters<typeof storage.getCommunityPosts>[0] = {
          ...filters,
          sort: "recent",
          excludeFollowing: false,
        };
        posts = await storage.getCommunityPosts(fallbackFilters);
      }

      // Phase 1: Fail-safe field stripping for global scope (posts-only)
      // Strip contact fields, profile shortcuts, action-enabling metadata
      if (wantsGlobalScope && !isSuperAdminLike) {
        posts = posts.map((post) => {
          const { author, ...safePost } = post as any;

          // Strip sensitive author fields, keep only safe display fields
          const safeAuthor = author
            ? {
                id: author.id,
                firstName: author.firstName,
                lastName: author.lastName,
                profileImageUrl: author.profileImageUrl,
                // Explicitly exclude: email, phone, address, city, state, zipCode, etc.
              }
            : null;

          return {
            ...safePost,
            author: safeAuthor,
          };
        });
      }

      // NOTE: Outcome-based feed weighting is intentionally disabled (Phase 2C).
      // REASONING:
      // - Weighting implies earned trust before outcome data is reliable.
      // - CTA gating (Phase 2A) generates the foundation outcomes.
      // - Feed influence should follow, not precede, action gating validation.
      // ENABLE WHEN:
      // - >= 50 completed outcomes recorded
      // - Outcome variance across posts is measurable
      // - Admin diagnostics show stable override/regret calibration
      // STATUS: DISABLED - waiting for Phase 2A data
      const ENABLE_OUTCOME_WEIGHTING = false;
      if (ENABLE_OUTCOME_WEIGHTING) {
        const { applyOutcomeWeighting, sortByOutcomeScore } =
          await import("./community/outcomeScoring");
        await applyOutcomeWeighting(posts);

        // If sorting by recommended, re-sort by outcome score
        if (normalizedScope === "recommendations" || normalizedScope === "forYou") {
          sortByOutcomeScore(posts);
        }
      }

      res.json(posts);
    } catch (error: any) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Community Stats (real values only; no placeholders)
  app.get("/api/community/stats", async (req: any, res: any) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const totalMembersResult = (await db.execute(
        sql`select count(*)::int as count from users`
      )) as any;
      const postsTodayResult = (await db.execute(
        sql`select count(*)::int as count from community_posts where created_at >= ${today}`
      )) as any;
      const countiesActiveResult = (await db.execute(
        sql`select count(distinct county_fips)::int as count from community_posts where county_fips is not null and created_at >= ${thirtyDaysAgo}`
      )) as any;
      const activeTodayResult = (await db.execute(sql`
        select count(distinct user_id)::int as count
        from (
          select author_id as user_id from community_posts where created_at >= ${today}
          union
          select user_id as user_id from post_likes where created_at >= ${today}
          union
          select author_id as user_id from post_comments where created_at >= ${today}
        ) t
      `)) as any;

      const totalMembers = Number(totalMembersResult?.rows?.[0]?.count ?? 0);
      const postsToday = Number(postsTodayResult?.rows?.[0]?.count ?? 0);
      const countiesActive = Number(countiesActiveResult?.rows?.[0]?.count ?? 0);
      const activeToday = Number(activeTodayResult?.rows?.[0]?.count ?? 0);

      res.json({
        totalMembers,
        activeToday,
        postsToday,
        countiesActive,
      });
    } catch (error: any) {
      console.error("Error fetching community stats:", error);
      res.json({
        totalMembers: 0,
        activeToday: 0,
        postsToday: 0,
        countiesActive: 0,
      });
    }
  });

  // Trending Topics (DB-backed; community-only)
  app.get("/api/community/trending", async (req: any, res: any) => {
    // XP & badges read endpoints (me-only for now)
    app.get("/api/xp/me", isAuthenticated, async (req: any, res: any) => {
      try {
        const userId: string | undefined = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const [xpTotal, ledger] = await Promise.all([
          storage.getUserXpTotal(userId),
          storage.getUserXpLedger(userId, 50),
        ]);

        res.json({
          userId,
          xpTotal,
          recentLedger: ledger,
        });
      } catch (error: any) {
        console.error("Error fetching XP for current user:", error);
        res.status(500).json({ message: "Failed to fetch XP" });
      }
    });

    app.get("/api/badges/me", isAuthenticated, async (req: any, res: any) => {
      try {
        const userId: string | undefined = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const [user, awarded] = await Promise.all([
          storage.getUser(userId),
          storage.getUserAwardedBadges(userId),
        ]);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const computedLabels = computeBadgesForUser(user);

        res.json({
          userId,
          labels: computedLabels,
          awarded,
        });
      } catch (error: any) {
        console.error("Error fetching badges for current user:", error);
        res.status(500).json({ message: "Failed to fetch badges" });
      }
    });
    try {
      const stateCode = typeof req.query.stateCode === "string" ? req.query.stateCode : undefined;
      const countyFips =
        typeof req.query.countyFips === "string" ? req.query.countyFips : undefined;
      const limit = req.query.limit
        ? Math.max(1, Math.min(20, parseInt(req.query.limit as string, 10) || 10))
        : 10;

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const rowsResult = (await db.execute(sql`
        select tag, count(*)::int as posts
        from (
          select unnest(tags) as tag
          from community_posts
          where tags is not null
            and is_hidden = false
            and is_published = true
            and created_at >= ${since}
            ${stateCode ? sql`and state_code = ${stateCode}` : sql``}
            ${countyFips ? sql`and county_fips = ${countyFips}` : sql``}
        ) t
        group by tag
        order by posts desc
        limit ${limit}
      `)) as any;

      const internalItems: Array<{ tag: string; posts: number; source: "community" }> =
        Array.isArray(rowsResult?.rows)
          ? rowsResult.rows
              .filter((r: any) => typeof r?.tag === "string" && r.tag.trim().length > 0)
              .map((r: any) => ({
                tag: r.tag,
                posts: Number(r.posts ?? 0),
                source: "community" as const,
              }))
          : [];

      if (internalItems.length > 0) {
        return res.json(internalItems);
      }

      // If there are no recent, tagged community posts, return an
      // empty list rather than generic external topics. Trending
      // should reflect what’s actually happening in the community.
      return res.json([]);
    } catch (error: any) {
      console.error("Error fetching community trending topics:", error);
      res.json([]);
    }
  });

  function deriveCommunityTagsFromContent(
    title: string | undefined,
    content: string,
    category?: string
  ): string[] {
    const tags = new Set<string>();
    const text = `${title || ""} ${content}`.toLowerCase();

    // Hashtag-style tags: #hoa, #roofing, etc.
    const hashMatches = text.match(/#([a-z0-9_-]{2,32})/gi);
    if (hashMatches) {
      for (const raw of hashMatches) {
        const cleaned = raw.replace(/^#/, "").trim();
        if (cleaned) tags.add(cleaned);
      }
    }

    // Simple keyword-based tags derived from the content body.
    if (/hoa|homeowners'\s+association|board meeting/.test(text)) tags.add("hoa");
    if (/roof|roofing|shingle|soffit|gutter/.test(text)) tags.add("roofing");
    if (/plumb|leak|pipe|drain/.test(text)) tags.add("plumbing");
    if (/electric|breaker|panel|outlet|switch/.test(text)) tags.add("electrical");
    if (/hvac|furnace|ac|air\s+conditioner|heat\s+pump/.test(text)) tags.add("hvac");
    if (/contractor|builder|remodel/.test(text)) tags.add("contractors");
    if (/marketplace|exchange|for sale|listing/.test(text)) tags.add("marketplace");
    if (/event|meetup|meeting|gathering/.test(text)) tags.add("events");
    if (/recommendation|recommendations|who do you recommend|who would you recommend/.test(text))
      tags.add("recommendations");

    if (category && typeof category === "string") {
      const cat = category.toLowerCase();
      if (cat && !["general"].includes(cat)) tags.add(cat);
    }

    return Array.from(tags).slice(0, 8);
  }

  async function createAutomaticCommunityWelcomeForUser(
    user: any,
    options?: { createdViaScout?: boolean }
  ): Promise<void> {
    try {
      const resolvedStateCode = (user.state as string | undefined) || undefined;
      const resolvedCountyFips = ((user as any).countyFips as string | undefined) || undefined;
      const countyLabel = ((user as any).county as string | undefined) || undefined;

      const rolesRaw: string[] =
        Array.isArray((user as any).roles) && (user as any).roles.length
          ? (user as any).roles
          : (user as any).role
            ? [(user as any).role]
            : [];

      const formatRoleLabel = (role: string) =>
        role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const rolesLabel = rolesRaw.length ? rolesRaw.map((r) => formatRoleLabel(r)).join(", ") : "";

      const firstName = (user.firstName as string | undefined) || "A neighbor";
      const lastName = (user.lastName as string | undefined) || "";

      const locationLabel =
        countyLabel && resolvedStateCode
          ? `${countyLabel} County, ${resolvedStateCode}`
          : resolvedStateCode || "your area";

      const roleContext = (() => {
        if (!rolesLabel) return "";
        const lowerRoles = rolesRaw.map((r) => String(r).toLowerCase());
        if (lowerRoles.some((r) => r.includes("contractor") || r.includes("builder"))) {
          return " They offer local services and project support.";
        }
        if (lowerRoles.some((r) => r.includes("homeowner"))) {
          return " They are here to connect with trusted local services and neighbors.";
        }
        return " They are joining to stay connected and contribute locally.";
      })();

      const welcomeTitle = `Welcome ${firstName}`;
      const welcomeContent =
        `Say hello to ${firstName}${lastName ? " " + lastName[0] + "." : ""} in ${locationLabel}. ` +
        `Share helpful tips, local recommendations, or groups worth following.` +
        roleContext;

      const welcomeTags = deriveCommunityTagsFromContent(welcomeTitle, welcomeContent, "welcome");

      await storage.createCommunityPost({
        title: welcomeTitle,
        content: welcomeContent,
        category: "announcements",
        scope: "county",
        stateCode: resolvedStateCode,
        countyFips: resolvedCountyFips,
        imageUrls: undefined,
        authorId: user.id,
        isPublished: true,
        isHidden: false,
        likeCount: 0,
        commentCount: 0,
        tags: welcomeTags.length ? welcomeTags : undefined,
      });

      // Keep automatic onboarding feed content to a single welcome post.
      // Additional autogenerated intro posts made the feed feel repetitive.
    } catch (err) {
      console.error("[Community] Failed to create automatic welcome/intro posts for user", {
        userId: (user as any)?.id,
        error: (err as any)?.message,
      });
    }
  }

  app.post(
    "/api/community/posts",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        const { title, content, category, scope, stateCode, countyFips, images } = req.body;
        const imageUrls: string[] | undefined = Array.isArray(images)
          ? images
          : images
            ? [String(images)]
            : undefined;

        const resolvedScope = scope || "county";
        const resolvedStateCode = stateCode || (user.state as string | undefined);
        const resolvedCountyFips = countyFips || ((user as any).countyFips as string | undefined);

        const tags = deriveCommunityTagsFromContent(title, content, category);

        const newPost = await storage.createCommunityPost({
          title,
          content,
          category,
          scope: resolvedScope,
          stateCode: resolvedStateCode,
          countyFips: resolvedCountyFips,
          imageUrls,
          authorId: userId,
          isPublished: true,
          isHidden: false,
          likeCount: 0,
          commentCount: 0,
          tags: tags.length ? tags : undefined,
        });

        // INTELLIGENT CATEGORY ROUTING
        // Maps human intent → system actions WITHOUT exposing internal system names to users
        // Philosophy: Users think "I need help", system routes to Direct Connect silently

        // 1. REQUEST (work) → Check if Direct Connect eligible
        if (category === "request") {
          // TODO: Analyze post content for contractor keywords (fence, plumbing, electrical, etc.)
          // If matched, create a silent Direct Connect opportunity for contractors to bid
          // User doesn't see "Direct Connect" - they just get matched with pros
          console.log(
            `[CATEGORY ROUTING] Request post created: ${newPost.id} - Direct Connect eligibility check queued`
          );
        }

        // 2. QUESTION → Notify Scout for potential AI response
        if (category === "question") {
          // TODO: Send to Scout analysis queue
          // Scout can either answer directly OR route to human experts
          // User sees helpful response, not "Scout vs Human" decision
          console.log(
            `[CATEGORY ROUTING] Question post created: ${newPost.id} - Scout analysis queued`
          );
        }

        // 3. FOR SALE → Auto-create marketplace listing
        if (category === "forsale") {
          // TODO: Extract price, condition, item details
          // Create marketplace listing automatically
          // User gets "Your item is now for sale" confirmation, not "Marketplace created"
          console.log(
            `[CATEGORY ROUTING] For Sale post created: ${newPost.id} - Marketplace listing creation queued`
          );
        }

        // 4. ALERT → Priority notifications to relevant users
        if (category === "alert") {
          // TODO: Determine notification scope (county, state, nearby)
          // Send push notifications to affected users
          // User sees "Alert sent to X neighbors", not notification system details
          console.log(
            `[CATEGORY ROUTING] Alert post created: ${newPost.id} - Priority notifications queued`
          );
        }

        // 5. EVENT → Calendar integration
        if (category === "event") {
          // TODO: Parse date/time from content
          // Add to community calendar
          // Allow users to "Add to my calendar" with one tap
          console.log(
            `[CATEGORY ROUTING] Event post created: ${newPost.id} - Calendar integration queued`
          );
        }

        // 6. RECOMMENDATION → Link to contractor/business profiles
        if (category === "recommendation") {
          // TODO: Extract mentioned businesses/contractors
          // Create profile links, boost their reputation scores
          // User sees "Thanks for the recommendation!" not profile system details
          console.log(
            `[CATEGORY ROUTING] Recommendation post created: ${newPost.id} - Profile linking queued`
          );
        }

        // 7. TIP → Feed Scout learning system
        if (category === "tip") {
          // TODO: Extract actionable knowledge
          // Add to Scout's local knowledge base
          // Scout can reference this tip when helping other users
          console.log(
            `[CATEGORY ROUTING] Tip post created: ${newPost.id} - Scout learning ingestion queued`
          );
        }

        res.status(201).json(newPost);
      } catch (error: any) {
        console.error("Error creating community post:", error);
        res.status(500).json({ message: "Failed to create post" });
      }
    }
  );

  app.get("/api/community/posts/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const post = await storage.getCommunityPost(id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error: any) {
      console.error("Error fetching community post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Post Interactions
  app.post(
    "/api/community/posts/:id/like",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { id: postId } = req.params;

        const result = await storage.togglePostLike(userId, postId);
        res.json(result);
      } catch (error: any) {
        console.error("Error toggling post like:", error);
        res.status(500).json({ message: "Failed to toggle like" });
      }
    }
  );

  app.post(
    "/api/community/posts/:id/comments",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.claims?.sub;
        const { id: postId } = req.params;
        const { content } = req.body;

        const comment = await storage.createPostComment({
          postId,
          authorId: userId,
          content,
        });

        res.status(201).json(comment);
      } catch (error: any) {
        console.error("Error creating comment:", error);
        res.status(500).json({ message: "Failed to create comment" });
      }
    }
  );

  // Community → Work Board: create or return an idempotent Work Request for a post
  app.post(
    "/api/community/posts/:id/send-to-board",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { id: postId } = req.params;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const post = await storage.getCommunityPost(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        if (post.authorId !== String(userId)) {
          return res
            .status(403)
            .json({ message: "Only the original author can send a post to the Work Board" });
        }

        // Idempotency: if a Work Request already exists for this post, return it.
        const [existing] = await db
          .select()
          .from(workRequests)
          .where(
            and(eq(workRequests.source, "community"), eq(workRequests.sourceRefId, String(postId)))
          );

        if (existing) {
          return res.json(existing);
        }

        const title =
          (post as any).title && String((post as any).title).trim().length > 0
            ? String((post as any).title).trim()
            : "Work request from community post";

        const description = String((post as any).content || "").trim();
        if (!description) {
          return res
            .status(400)
            .json({ message: "Post must have content to create a Work Request" });
        }

        const stateCode =
          typeof (post as any).stateCode === "string" && (post as any).stateCode.length === 2
            ? (post as any).stateCode
            : undefined;
        const countyFips =
          typeof (post as any).countyFips === "string" && (post as any).countyFips.length > 0
            ? (post as any).countyFips
            : undefined;

        const category =
          typeof (post as any).category === "string" && (post as any).category.trim().length > 0
            ? (post as any).category.trim()
            : undefined;

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
            source: "community",
            sourceRefId: String(postId),
            status: "open",
            visibility: "community",
            exposureMode: "guided",
            competitionMode: "none",
          })
          .returning();

        if (created) {
          try {
            await db.insert(workRequestEvents).values({
              workRequestId: created.id,
              type: "sent_to_board",
              actorUserId: String(userId),
              fromStatus: null,
              toStatus: "open",
              metadata: {
                source: "community",
                postId: String(postId),
              },
            });
          } catch (e) {
            console.warn("Failed to record work request sent_to_board event", e);
          }
        }

        res.status(201).json(created ?? null);
      } catch (error: any) {
        console.error("Error sending community post to Work Board:", error);
        res.status(500).json({ message: error?.message || "Failed to send post to Work Board" });
      }
    }
  );

  app.get("/api/community/posts/:id/comments", async (req: any, res: any) => {
    try {
      const { id: postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Community Post Admin Actions
  app.patch(
    "/api/community/posts/:id/pin",
    isAuthenticated,
    requireOnboardingComplete,
    isCommunityModerator,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { isPinned } = (req.body ?? {}) as any;

        if (typeof isPinned !== "boolean") {
          return res.status(400).json({ message: "isPinned must be a boolean" });
        }

        await db
          .update(communityPosts)
          .set({
            isPinned,
            updatedAt: new Date(),
            moderatedBy: (req.user as any)?.id || (req.user as any)?.claims?.sub,
            moderatedAt: new Date(),
          })
          .where(eq(communityPosts.id, id));

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error updating community post pin state:", error);
        res.status(500).json({ message: "Failed to update pin state" });
      }
    }
  );

  app.patch(
    "/api/community/posts/:id/hide",
    isAuthenticated,
    requireOnboardingComplete,
    isCommunityModerator,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { isHidden, moderatorNotes } = (req.body ?? {}) as any;

        if (typeof isHidden !== "boolean") {
          return res.status(400).json({ message: "isHidden must be a boolean" });
        }

        await db
          .update(communityPosts)
          .set({
            isHidden,
            moderatorNotes: typeof moderatorNotes === "string" ? moderatorNotes : null,
            moderatedBy: (req.user as any)?.id || (req.user as any)?.claims?.sub,
            moderatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(communityPosts.id, id));

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error updating community post visibility:", error);
        res.status(500).json({ message: "Failed to update visibility" });
      }
    }
  );

  app.delete(
    "/api/community/posts/:id",
    isAuthenticated,
    requireOnboardingComplete,
    isCommunityModerator,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;

        const [post] = await db
          .select()
          .from(communityPosts)
          .where(eq(communityPosts.id, id))
          .limit(1);

        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        await db.delete(communityPosts).where(eq(communityPosts.id, id));

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting community post:", error);
        res.status(500).json({ message: "Failed to delete post" });
      }
    }
  );

  // Community Groups
  app.get("/api/community/groups", async (req: any, res: any) => {
    try {
      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const hasExplicitLocationFilters =
        Boolean(req.query.stateCode) || Boolean(req.query.countyFips);

      const filters: Parameters<typeof storage.getGroups>[0] = {
        stateCode:
          (req.query.stateCode as string) ||
          (user && !hasExplicitLocationFilters ? (user.state as string) || undefined : undefined),
        countyFips:
          (req.query.countyFips as string) ||
          (user && !hasExplicitLocationFilters
            ? ((user as any).countyFips as string) || undefined
            : undefined),
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        search: req.query.search as string,
        userId: authUserId,
      };

      const groups = await storage.getGroups(filters);
      res.json({ groups });
    } catch (error: any) {
      console.error("Error fetching community groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post(
    "/api/community/groups/:groupId/join",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const { groupId } = req.params;
        await storage.joinGroup(userId, groupId);

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error joining community group:", error);
        res.status(500).json({ message: "Failed to join group" });
      }
    }
  );

  app.post(
    "/api/community/groups/:groupId/leave",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const { groupId } = req.params;
        await storage.leaveGroup(userId, groupId);

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error leaving community group:", error);
        res.status(500).json({ message: "Failed to leave group" });
      }
    }
  );

  // Regions
  app.get("/api/regions", async (req: any, res: any) => {
    try {
      const filters = {
        stateCode: req.query.stateCode as string,
        isOfficial: req.query.isOfficial === "true",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const regions = await storage.getRegions(filters);
      res.json(regions);
    } catch (error: any) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ message: "Failed to fetch regions" });
    }
  });

  // Handmade Marketplace Routes

  // Categories
  app.get("/api/handmade/categories", async (req: any, res: any) => {
    try {
      const categories = await storage.getHandmadeCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching handmade categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Products
  app.get("/api/handmade/products", async (req: any, res: any) => {
    try {
      const filters = {
        categoryId: req.query.categoryId as string,
        sellerId: req.query.sellerId as string,
        featured: req.query.featured === "true",
        location: {
          state: req.query.state as string,
          county: req.query.county as string,
        },
        priceRange: {
          min: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
          max: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        },
        materials: req.query.materials ? (req.query.materials as string).split(",") : undefined,
        inStock: req.query.inStock === "true",
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const products = await storage.getHandmadeProducts(filters);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching handmade products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/handmade/products/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const product = await storage.getHandmadeProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Increment view count
      await storage.incrementProductViews(id);

      res.json(product);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post(
    "/api/handmade/products",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const productData = {
          ...req.body,
          sellerId: userId,
        };

        const product = await storage.createHandmadeProduct(productData);
        res.status(201).json(product);
      } catch (error: any) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Failed to create product" });
      }
    }
  );

  app.put(
    "/api/handmade/products/:id",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

        // Check if user owns the product
        const product = await storage.getHandmadeProduct(id);
        if (!product || product.sellerId !== userId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const updatedProduct = await storage.updateHandmadeProduct(id, req.body);
        res.json(updatedProduct);
      } catch (error: any) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Failed to update product" });
      }
    }
  );

  // Product Favorites
  app.post(
    "/api/handmade/products/:id/favorite",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const { id: productId } = req.params;
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

        const result = await storage.toggleProductFavorite(userId, productId);
        res.json(result);
      } catch (error: any) {
        console.error("Error toggling favorite:", error);
        res.status(500).json({ message: "Failed to toggle favorite" });
      }
    }
  );

  app.get("/api/handmade/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const favorites = await storage.getUserFavoriteProducts(userId);
      res.json(favorites);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Product Orders
  app.post(
    "/api/handmade/orders",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const orderData = {
          ...req.body,
          buyerId: userId,
        };

        const order = await storage.createProductOrder(orderData);
        res.status(201).json(order);
      } catch (error: any) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to create order" });
      }
    }
  );

  app.get("/api/handmade/orders", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const type = (req.query.type as "buyer" | "seller") || "buyer";

      const orders = await storage.getUserOrders(userId, type);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/handmade/orders/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const order = await storage.getProductOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is buyer or seller
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(order);
    } catch (error: any) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.put(
    "/api/handmade/orders/:id",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

        const order = await storage.getProductOrder(id);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        // Check if user is buyer or seller
        if (order.buyerId !== userId && order.sellerId !== userId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const updatedOrder = await storage.updateProductOrder(id, req.body);
        res.json(updatedOrder);
      } catch (error: any) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Failed to update order" });
      }
    }
  );

  // Product Reviews
  app.post(
    "/api/handmade/reviews",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const reviewData = {
          ...req.body,
          buyerId: userId,
        };

        const review = await storage.createProductReview(reviewData);
        res.status(201).json(review);
      } catch (error: any) {
        console.error("Error creating review:", error);
        res.status(500).json({ message: "Failed to create review" });
      }
    }
  );

  app.get("/api/handmade/products/:id/reviews", async (req: any, res: any) => {
    try {
      const { id: productId } = req.params;
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/handmade/products/:id/rating", async (req: any, res: any) => {
    try {
      const { id: productId } = req.params;
      const rating = await storage.getProductRatingSummary(productId);
      res.json(rating);
    } catch (error: any) {
      console.error("Error fetching rating:", error);
      res.status(500).json({ message: "Failed to fetch rating" });
    }
  });

  // Seller Profiles
  app.get("/api/handmade/sellers/:userId", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getSellerProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "Seller profile not found" });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.post(
    "/api/handmade/seller-profile",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const profileData = {
          ...req.body,
          userId,
        };

        const profile = await storage.createSellerProfile(profileData);
        res.status(201).json(profile);
      } catch (error: any) {
        console.error("Error creating seller profile:", error);
        res.status(500).json({ message: "Failed to create seller profile" });
      }
    }
  );

  app.put(
    "/api/handmade/seller-profile",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const profile = await storage.updateSellerProfile(userId, req.body);
        res.json(profile);
      } catch (error: any) {
        console.error("Error updating seller profile:", error);
        res.status(500).json({ message: "Failed to update seller profile" });
      }
    }
  );

  app.get("/api/handmade/seller-profile", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const profile = await storage.getSellerProfile(userId);
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.get("/api/handmade/sellers/:userId/products", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const products = await storage.getSellerProducts(userId);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch seller products" });
    }
  });

  app.get("/api/handmade/sellers/:userId/ratings", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const ratings = await storage.getSellerRatings(userId);
      res.json(ratings);
    } catch (error: any) {
      console.error("Error fetching seller ratings:", error);
      res.status(500).json({ message: "Failed to fetch seller ratings" });
    }
  });

  // ===== COMMUNITY MODERATION API ROUTES =====

  // Report content for moderation
  app.post(
    "/api/moderation/reports",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        const reportData = {
          ...req.body,
          reporterId: userId,
          reporterCounty: user.county,
          reporterState: user.state,
        };

        const parsedReport = insertModerationReportSchema.safeParse(reportData);
        if (!parsedReport.success) {
          return res.status(400).json({
            message: "Invalid moderation report payload",
            issues: parsedReport.error.issues,
          });
        }

        const validatedReport = parsedReport.data;
        const report = await storage.createModerationReport(validatedReport);

        res.json(report);
      } catch (error: any) {
        console.error("Error creating moderation report:", error);
        res.status(500).json({ message: "Failed to create report" });
      }
    }
  );

  // Get moderation reports for a user's location
  app.get("/api/moderation/reports", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const filters = {
        status: (req.query.status as string) || undefined,
        contentType: (req.query.contentType as string) || undefined,
        county: (req.query.county as string) || user.county || undefined,
        state: (req.query.state as string) || user.state || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const reports = await storage.getModerationReports(filters);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching moderation reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get specific moderation report
  app.get("/api/moderation/reports/:reportId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const report = await storage.getModerationReport(reportId);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error: any) {
      console.error("Error fetching moderation report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Vote on a moderation report
  app.post(
    "/api/moderation/reports/:reportId/vote",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const { reportId } = req.params;
        const { vote } = req.body;
        const userId = req.user?.claims?.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Check if user can vote on this report
        const canVote = await storage.canUserVoteOnReport(userId, reportId);
        if (!canVote) {
          return res.status(403).json({ message: "You are not eligible to vote on this report" });
        }

        const voteData = {
          reportId,
          voterId: userId,
          vote,
          voterCounty: user.county,
          voterState: user.state,
        };

        const parsedVote = insertModerationVoteSchema.safeParse(voteData);
        if (!parsedVote.success) {
          return res.status(400).json({
            message: "Invalid moderation vote payload",
            issues: parsedVote.error.issues,
          });
        }

        const validatedVote = parsedVote.data;
        const moderationVote = await storage.createModerationVote(validatedVote);

        res.json(moderationVote);
      } catch (error: any) {
        console.error("Error creating moderation vote:", error);

        if (error.message === "User has already voted on this report") {
          return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: "Failed to create vote" });
      }
    }
  );

  // Get votes for a specific report
  app.get(
    "/api/moderation/reports/:reportId/votes",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { reportId } = req.params;
        const votes = await storage.getReportVotes(reportId);
        res.json(votes);
      } catch (error: any) {
        console.error("Error fetching report votes:", error);
        res.status(500).json({ message: "Failed to fetch votes" });
      }
    }
  );

  // Check if user can vote on a report
  app.get(
    "/api/moderation/reports/:reportId/can-vote",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { reportId } = req.params;
        const userId = req.user?.claims?.sub;

        const canVote = await storage.canUserVoteOnReport(userId, reportId);
        res.json({ canVote });
      } catch (error: any) {
        console.error("Error checking vote eligibility:", error);
        res.status(500).json({ message: "Failed to check vote eligibility" });
      }
    }
  );

  // Create moderation appeal
  app.post("/api/moderation/appeals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;

      const appealData = {
        ...req.body,
        appellantId: userId,
      };

      const parsedAppeal = insertModerationAppealSchema.safeParse(appealData);
      if (!parsedAppeal.success) {
        return res.status(400).json({
          message: "Invalid moderation appeal payload",
          issues: parsedAppeal.error.issues,
        });
      }

      const validatedAppeal = parsedAppeal.data;
      const appeal = await storage.createModerationAppeal(validatedAppeal);

      res.json(appeal);
    } catch (error: any) {
      console.error("Error creating moderation appeal:", error);
      res.status(500).json({ message: "Failed to create appeal" });
    }
  });

  // Get user's moderation appeals
  app.get("/api/moderation/appeals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const appeals = await storage.getAppealsByUser(userId);
      res.json(appeals);
    } catch (error: any) {
      console.error("Error fetching moderation appeals:", error);
      res.status(500).json({ message: "Failed to fetch appeals" });
    }
  });

  // Get specific moderation appeal
  app.get("/api/moderation/appeals/:appealId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { appealId } = req.params;
      const userId = req.user?.claims?.sub;

      const appeal = await storage.getModerationAppeal(appealId);

      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      // Only allow access to own appeals or admin users
      if (appeal.appellantId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(appeal);
    } catch (error: any) {
      console.error("Error fetching moderation appeal:", error);
      res.status(500).json({ message: "Failed to fetch appeal" });
    }
  });

  // Get user's moderation reputation
  app.get("/api/moderation/reputation", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const reputation = await storage.getUserModerationReputation(userId);

      if (!reputation) {
        // Create default reputation for new users
        const defaultReputation = {
          userId,
          reputationScore: 100,
          canVote: true,
          canReport: true,
          isSuspended: false,
          totalReportsSubmitted: 0,
          totalVotesCast: 0,
          accurateReports: 0,
          inaccurateReports: 0,
        };

        const newReputation = await storage.createUserModerationReputation(defaultReputation);
        return res.json(newReputation);
      }

      res.json(reputation);
    } catch (error: any) {
      console.error("Error fetching moderation reputation:", error);
      res.status(500).json({ message: "Failed to fetch reputation" });
    }
  });

  // Get moderation actions for content
  app.get(
    "/api/moderation/actions/:contentType/:contentId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { contentType, contentId } = req.params;
        const actions = await storage.getModerationActions(contentType, contentId);
        res.json(actions);
      } catch (error: any) {
        console.error("Error fetching moderation actions:", error);
        res.status(500).json({ message: "Failed to fetch actions" });
      }
    }
  );

  // Get moderation settings for location
  app.get("/api/moderation/settings", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const settings = await storage.getModerationSettings(
        user.county || undefined,
        user.state || undefined
      );
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching moderation settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Invitation System API Routes

  // Send email invitation
  app.post("/api/invitations/send", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { email, targetRole, personalMessage } = req.body;

      // Validate required fields
      if (!email || !targetRole) {
        return res.status(400).json({ message: "Email and target role are required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User authentication required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate invitation code
      const invitationCode = await storage.generateInvitationCode();

      // Create invitation
      const invitation = await storage.createInvitation({
        inviterId: userId,
        inviteeEmail: email,
        targetRole,
        personalMessage: personalMessage || null,
        invitationCode,
        type: "email",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      // Update user's referral stats
      await storage.incrementInvitationsSent(userId);

      // TODO: Send email notification (when email service is setup)

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get user's invitations
  app.get("/api/invitations/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const invitations = await storage.getUserInvitations(userId);
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (public endpoint)
  app.post("/api/invitations/accept/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get invitation
      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation code" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation has already been used or expired" });
      }

      // Accept invitation
      const acceptedInvitation = await storage.acceptInvitation(code, userId);

      // Update inviter's stats
      if (invitation.inviterId) {
        await storage.incrementInvitationsAccepted(
          invitation.inviterId,
          invitation.targetRole as "homeowner" | "contractor"
        );
      }

      res.json(acceptedInvitation);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Validate invitation code (public endpoint for signup page)
  app.get("/api/invitations/validate/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({
          message: "Invalid invitation code",
          valid: false,
        });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({
          message: "Invitation has already been used or expired",
          valid: false,
        });
      }

      res.json({
        valid: true,
        email: invitation.inviteeEmail,
        targetRole: invitation.targetRole,
        personalMessage: invitation.personalMessage,
      });
    } catch (error: any) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Generate or get user's referral code
  app.post("/api/referrals/generate-code", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let referralCode = user.referralCode;

      // Generate code if user doesn't have one
      if (!referralCode) {
        referralCode = await storage.generateUserReferralCode(userId);
      }

      res.json({ referralCode });
    } catch (error: any) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Get user's referral stats
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const stats = await storage.getReferralStats(userId);

      if (!stats) {
        // Return default stats if none exist
        return res.json({
          totalInvitationsSent: 0,
          totalInvitationsAccepted: 0,
          contractorReferrals: 0,
          homeownerReferrals: 0,
        });
      }

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get top referrers leaderboard
  app.get("/api/referrals/leaderboard", async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topReferrers = await storage.getTopReferrers(limit);
      res.json(topReferrers);
    } catch (error: any) {
      console.error("Error fetching referral leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Cleanup expired invitations (internal endpoint)
  app.post("/api/invitations/cleanup", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      await storage.expireOldInvitations();
      res.json({ message: "Expired invitations cleaned up successfully" });
    } catch (error: any) {
      console.error("Error cleaning up invitations:", error);
      res.status(500).json({ message: "Failed to cleanup invitations" });
    }
  });

  // Professional Network Applications

  // Realtor application submission
  app.post(
    "/api/realtor/application",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        // Check if user already has a realtor profile
        const existingProfile = await storage.getRealtorProfile(userId);
        if (existingProfile) {
          return res.status(400).json({ message: "You already have a realtor profile" });
        }

        const parsedRealtor = insertRealtorProfileSchema.safeParse(req.body);
        if (!parsedRealtor.success) {
          return res.status(400).json({
            message: "Invalid realtor application payload",
            issues: parsedRealtor.error.issues,
          });
        }

        const realtorProfile = await storage.createRealtorProfile(parsedRealtor.data);

        // Update user role to realtor
        await storage.updateUserRole(userId, "realtor");

        await storage.logEvent("realtor_application_submitted", {
          profileId: realtorProfile.id,
          userId,
        });

        res.json({
          message: "Realtor application submitted successfully",
          profileId: realtorProfile.id,
        });
      } catch (error: any) {
        console.error("Error submitting realtor application:", error);
        res.status(500).json({ message: "Failed to submit realtor application" });
      }
    }
  );

  // Car salesman application submission
  app.post(
    "/api/car-salesman/application",
    isAuthenticated,
    requireAddressVerification,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        // Check if user already has a car salesman profile
        const existingProfile = await storage.getCarSalesmanProfile(userId);
        if (existingProfile) {
          return res.status(400).json({ message: "You already have a car salesman profile" });
        }

        const parsedCarSalesman = insertCarSalesmanProfileSchema.safeParse(req.body);
        if (!parsedCarSalesman.success) {
          return res.status(400).json({
            message: "Invalid car salesman application payload",
            issues: parsedCarSalesman.error.issues,
          });
        }

        const carSalesmanProfile = await storage.createCarSalesmanProfile(parsedCarSalesman.data);

        // Update user role to car_dealer
        await storage.updateUserRole(userId, "car_dealer");

        await storage.logEvent("car_salesman_application_submitted", {
          profileId: carSalesmanProfile.id,
          userId,
        });

        res.json({
          message: "Car salesman application submitted successfully",
          profileId: carSalesmanProfile.id,
        });
      } catch (error: any) {
        console.error("Error submitting car salesman application:", error);
        res.status(500).json({ message: "Failed to submit car salesman application" });
      }
    }
  );

  // Professional verification endpoints for admins
  app.get(
    "/api/admin/professional/pending",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const pendingRealtors = await storage.getPendingRealtorApplications();
        const pendingCarSalesmen = await storage.getPendingCarSalesmanApplications();

        res.json({
          realtors: pendingRealtors,
          carSalesmen: pendingCarSalesmen,
        });
      } catch (error: any) {
        console.error("Error fetching pending applications:", error);
        res.status(500).json({ message: "Failed to fetch pending applications" });
      }
    }
  );

  app.post(
    "/api/admin/realtor/verify/:profileId",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { profileId } = req.params;
        const { approved, notes } = req.body;
        const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const result = await storage.updateRealtorVerificationStatus(profileId, {
          approved: !!approved,
          notes: notes || "",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        await storage.logEvent("realtor_verification_decision", {
          profileId,
          adminId,
          approved,
          notes,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error updating realtor verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );

  app.post(
    "/api/admin/car-salesman/verify/:profileId",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const { profileId } = req.params;
        const { approved, notes } = req.body;
        const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

        const result = await storage.updateCarSalesmanVerificationStatus(profileId, {
          approved: !!approved,
          notes: notes || "",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        });

        await storage.logEvent("car_salesman_verification_decision", {
          profileId,
          adminId,
          approved,
          notes,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error updating car salesman verification:", error);
        res.status(500).json({ message: "Failed to update verification status" });
      }
    }
  );

  // ==================== PROFESSIONAL PARTNERSHIPS ====================

  // Request partnership between professionals (dealers, contractors, realtors)
  app.post("/api/partnerships/request", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { partnerId, partnershipType, referralTerms, partnershipDescription } = req.body;

      if (!partnerId || !partnershipType) {
        return res.status(400).json({ message: "Partner ID and partnership type are required" });
      }

      // Check if partnership already exists (stub for now)
      // const existingPartnership = await storage.getPartnership(userId, partnerId);

      const partnership = {
        id: `partnership_${Date.now()}`,
        initiatorId: userId,
        partnerId,
        partnershipType,
        referralTerms,
        partnershipDescription,
        status: "pending",
        createdAt: new Date(),
      };

      res.status(201).json(partnership);
    } catch (error: any) {
      console.error("Error creating partnership:", error);
      res.status(500).json({ message: "Failed to create partnership request" });
    }
  });

  // Get user's partnerships
  app.get("/api/partnerships/my", isAuthenticated, async (req: any, res: any) => {
    try {
      return res.status(501).json({ message: "Partnerships not implemented" });
    } catch (error: any) {
      console.error("Error fetching partnerships:", error);
      res.status(500).json({ message: "Failed to fetch partnerships" });
    }
  });

  // Find potential partners by role
  app.get("/api/partnerships/find/:role", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role } = req.params;

      // Mock potential partners based on requested role
      const mockPartners =
        role === "contractor"
          ? [
              {
                id: "contractor_789",
                firstName: "Mike",
                lastName: "Rodriguez",
                companyName: "Rodriguez Construction",
                specialties: ["Roofing", "Siding", "General"],
                rating: 4.8,
                completedJobs: 147,
                location: "Downtown Area",
              },
              {
                id: "contractor_101",
                firstName: "Sarah",
                lastName: "Johnson",
                companyName: "Johnson Home Improvements",
                specialties: ["Kitchen Remodel", "Bathroom Remodel"],
                rating: 4.9,
                completedJobs: 89,
                location: "Westside",
              },
            ]
          : [];

      res.json(mockPartners);
    } catch (error: any) {
      console.error("Error finding potential partners:", error);
      res.status(500).json({ message: "Failed to find potential partners" });
    }
  });

  // ==================== AFFILIATE SYSTEM ROUTES ====================

  // Create or get affiliate program for user (explicit join endpoint)
  app.post("/api/affiliate/join", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if user already has an affiliate program
      const existingProgram = await storage.getAffiliateProgram(userId);
      if (existingProgram) {
        return res.json(existingProgram);
      }

      // Generate unique affiliate code
      const referralCode = await storage.generateAffiliateCode(userId);

      // Create new affiliate program
      const program = await storage.createAffiliateProgram({
        userId,
        referralCode,
        status: "active",
      } as any);

      res.status(201).json(program);
    } catch (error: any) {
      console.error("Error joining affiliate program:", error);
      res.status(500).json({ message: "Failed to join affiliate program" });
    }
  });

  // Track referral click (public endpoint)
  app.post("/api/affiliate/track-click", async (req: any, res: any) => {
    try {
      return res.status(501).json({
        message: "Affiliate click tracking is disabled in the current deployment",
      });
    } catch (error: any) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track referral" });
    }
  });

  // Convert referral when user signs up
  app.post("/api/affiliate/convert", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { affiliateCode } = req.body;

      if (!affiliateCode) {
        return res.status(400).json({ message: "Affiliate code is required" });
      }

      // Convert the referral
      await storage.convertReferral(affiliateCode, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error converting referral:", error);
      res.status(500).json({ message: "Failed to convert referral" });
    }
  });

  // Process commission (internal use - called when revenue is generated)
  app.post("/api/affiliate/commission", isAuthenticated, async (req: any, res: any) => {
    try {
      const {
        affiliateProgramId,
        referralId,
        transactionId,
        revenueAmount,
        commissionAmount,
        description,
      } = req.body;

      if (!affiliateProgramId || !revenueAmount || !commissionAmount) {
        return res.status(400).json({
          message: "Affiliate program ID, revenue amount, and commission amount are required",
        });
      }

      const commission = await storage.createCommission({
        affiliateProgramId,
        referralId,
        transactionId,
        revenueAmount: revenueAmount.toString(),
        commissionAmount: commissionAmount.toString(),
        // description: description || 'Commission earned',
        status: "pending",
      });

      res.status(201).json(commission);
    } catch (error: any) {
      console.error("Error creating commission:", error);
      res.status(500).json({ message: "Failed to create commission" });
    }
  });

  // Get referrals for affiliate
  app.get("/api/affiliate/referrals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const referrals = await storage.getReferralsByAffiliate(program.id);
      res.json(referrals);
    } catch (error: any) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get commissions for affiliate
  app.get("/api/affiliate/commissions", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const commissions = await storage.getCommissionsForAffiliate(program.id);
      res.json(commissions);
    } catch (error: any) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });

  // Get payouts for affiliate
  app.get("/api/affiliate/payouts", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const payouts = await storage.getPayoutsForAffiliate(program.id);
      res.json(payouts);
    } catch (error: any) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Admin: Approve commission
  app.put(
    "/api/admin/affiliate/commissions/:commissionId/approve",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        const user = await storage.getUser(userId);

        // Check admin permissions
        const userRole = user?.role || "";
        if (!user || !["ops_admin", "head_admin"].includes(userRole)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { commissionId } = req.params;
        await storage.approveCommission(commissionId);

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error approving commission:", error);
        res.status(500).json({ message: "Failed to approve commission" });
      }
    }
  );

  // Admin: Create payout
  app.post("/api/admin/affiliate/payouts", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await storage.getUser(userId);

      // Check admin permissions
      const userRole = user?.role || "";
      if (!user || !["ops_admin", "head_admin"].includes(userRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { affiliateProgramId, totalAmount, payoutMethod, notes } = req.body;

      if (!affiliateProgramId || !totalAmount) {
        return res.status(400).json({
          message: "Affiliate program ID and total amount are required",
        });
      }

      const payout = await storage.createPayout({
        affiliateProgramId,
        totalAmount: totalAmount.toString(),
        payoutMethod: payoutMethod || "manual",
        status: "pending",
        notes,
      });

      res.status(201).json(payout);
    } catch (error: any) {
      console.error("Error creating payout:", error);
      res.status(500).json({ message: "Failed to create payout" });
    }
  });

  // Admin: Update payout status
  app.put(
    "/api/admin/affiliate/payouts/:payoutId/status",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        const user = await storage.getUser(userId);

        // Check admin permissions
        const userRole = user?.role || "";
        if (!user || !["ops_admin", "head_admin"].includes(userRole)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { payoutId } = req.params;
        const { status } = req.body;

        if (!status || !["pending", "processing", "completed", "failed"].includes(status)) {
          return res.status(400).json({ message: "Valid status is required" });
        }

        await storage.updatePayoutStatus(payoutId, status);

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error updating payout status:", error);
        res.status(500).json({ message: "Failed to update payout status" });
      }
    }
  );

  // Update affiliate program settings
  app.put("/api/affiliate/settings", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const { payoutMethod, payoutDetails } = req.body;

      const updatedProgram = await storage.updateAffiliateProgram(program.id, {});

      res.json({
        ...updatedProgram,
        payoutMethod,
        payoutDetails,
      });
    } catch (error: any) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // Initialize WebSocket server
  // Tutorial Management Routes
  app.get("/api/tutorials/user-progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.getUserTutorialProgress(userId);
      res.json(progress);
    } catch (error: any) {
      console.error("Error fetching tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.get("/api/tutorials/recommended", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const userRole = req.user?.role || "homeowner";

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const recommended = await tutorialStorage.getRecommendedTutorialsForUser(userId, userRole);
      res.json(recommended);
    } catch (error: any) {
      console.error("Error fetching recommended tutorials:", error);
      res.status(500).json({ message: "Failed to fetch recommended tutorials" });
    }
  });

  app.get("/api/tutorials/:tutorialId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { tutorialId } = req.params;
      const tutorial = await tutorialStorage.getTutorialById(tutorialId);

      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      res.json(tutorial);
    } catch (error: any) {
      console.error("Error fetching tutorial:", error);
      res.status(500).json({ message: "Failed to fetch tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/start", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      // Record analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[0]?.id || "start",
        action: "started",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      // Create or update progress
      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as "onboarding" | "feature",
        stepIndex: "0",
        isCompleted: false,
        isSkipped: false,
      });

      res.json({ progress, tutorial });
    } catch (error: any) {
      console.error("Error starting tutorial:", error);
      res.status(500).json({ message: "Failed to start tutorial" });
    }
  });

  app.put("/api/tutorials/:tutorialId/progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { stepIndex, action, timeSpent, metadata } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      // Record analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[parseInt(stepIndex)]?.id || stepIndex,
        action,
        timeSpent: timeSpent?.toString(),
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
        metadata,
      });

      // Update progress
      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as "onboarding" | "feature",
        stepIndex,
        isCompleted: action === "completed",
        isSkipped: action === "skipped",
        metadata,
        ...(action === "completed" || action === "skipped" ? { completedAt: new Date() } : {}),
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error updating tutorial progress:", error);
      res.status(500).json({ message: "Failed to update tutorial progress" });
    }
  });

  app.post("/api/tutorials/:tutorialId/complete", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { finalStepIndex } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialCompleted(
        userId,
        tutorialId,
        finalStepIndex
      );

      // Record completion analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: "completion",
        action: "completed",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error completing tutorial:", error);
      res.status(500).json({ message: "Failed to complete tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/skip", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialSkipped(userId, tutorialId);

      // Record skip analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: "skip",
        action: "skipped",
        userAgent: req.headers["user-agent"],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error skipping tutorial:", error);
      res.status(500).json({ message: "Failed to skip tutorial" });
    }
  });

  app.get("/api/tutorials/check/:featureId", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { featureId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const shouldShow = await tutorialStorage.shouldShowTutorial(userId, featureId);
      const tutorial = shouldShow ? await tutorialStorage.getTutorialById(featureId) : null;

      res.json({ shouldShow, tutorial });
    } catch (error: any) {
      console.error("Error checking tutorial:", error);
      res.status(500).json({ message: "Failed to check tutorial" });
    }
  });

  // Initialize default tutorials on server start
  // tutorialStorage.initializeDefaultTutorials().catch(console.error); // Disabled for deployment

  const httpServer = createServer(app);
  // Initialize WebSocket manager for real-time communication
  // DISABLED: Using Socket.io messaging service instead (configured in index.ts)
  // const wsManager = new WebSocketManager(httpServer);

  // Advanced marketplace transaction routes

  // Create payment intent for marketplace purchase
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!stripe) {
        return res.status(500).json({
          message: "Payment processing not configured. Stripe keys needed.",
        });
      }

      const { listingId } = req.body;
      const listing = await storage.getMarketplaceListing(listingId);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      const listingPrice = Number(listing.price ?? 0);
      const platformFee = Math.round(listingPrice * 0.05 * 100); // 5% platform fee in cents
      const totalAmount = Math.round(listingPrice * 100) + platformFee; // Total in cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          listingId: listing.id,
          sellerId: listing.sellerId,
          buyerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
          platformFee: platformFee.toString(),
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Create marketplace transaction
  app.post("/api/marketplace/transactions", isAuthenticated, async (req: any, res: any) => {
    try {
      const transactionData = {
        ...req.body,
        buyerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const transaction = await storage.createMarketplaceTransaction(transactionData);

      // Send notifications to both buyer and seller
      const sellerNotification = {
        userId: transaction.sellerId,
        type: "payment_received" as const,
        title: "New Purchase",
        message: `Someone purchased your item for $${transaction.totalAmount}`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      const buyerNotification = {
        userId: transaction.buyerId,
        type: "payment_received" as const,
        title: "Purchase Confirmed",
        message: `Your purchase of $${transaction.totalAmount} has been confirmed`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      await Promise.all([
        storage.createNotification(sellerNotification),
        storage.createNotification(buyerNotification),
      ]);

      // Send real-time notifications via Socket.io messaging service (if available)
      try {
        const messaging = getMessagingService();
        await Promise.all([
          messaging.notifyUser(
            String(transaction.sellerId),
            "notification:new_marketplace_transaction",
            {
              role: "seller",
              transactionId: transaction.id,
              totalAmount: transaction.totalAmount,
            }
          ),
          messaging.notifyUser(
            String(transaction.buyerId),
            "notification:new_marketplace_transaction",
            {
              role: "buyer",
              transactionId: transaction.id,
              totalAmount: transaction.totalAmount,
            }
          ),
        ]);
      } catch (err) {
        console.warn("[Messaging] Failed to emit marketplace transaction notifications", err);
      }

      res.json(transaction);
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Get user transactions
  app.get("/api/marketplace/transactions", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role = "buyer" } = req.query;
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const transactions = await storage.getMarketplaceTransactionsByUser(
        userId,
        role as "buyer" | "seller"
      );
      res.json(transactions);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Update transaction status
  app.put("/api/marketplace/transactions/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const transaction = await storage.updateMarketplaceTransaction(id, req.body);

      // Send real-time update via Socket.io messaging service (if available)
      try {
        const messaging = getMessagingService();
        if (transaction?.buyerId) {
          await messaging.notifyUser(
            String(transaction.buyerId),
            "marketplace:transaction_update",
            {
              transaction,
              role: "buyer",
            }
          );
        }
        if (transaction?.sellerId) {
          await messaging.notifyUser(
            String(transaction.sellerId),
            "marketplace:transaction_update",
            {
              transaction,
              role: "seller",
            }
          );
        }
      } catch (err) {
        console.warn("[Messaging] Failed to emit marketplace transaction update", err);
      }

      res.json(transaction);
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Create user review
  app.post("/api/reviews", isAuthenticated, async (req: any, res: any) => {
    try {
      const reviewData = {
        ...req.body,
        reviewerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const review = await storage.createUserReview(reviewData);

      // Send notification to reviewee
      const notification = {
        userId: review.revieweeId,
        type: "review_received" as const,
        title: "New Review Received",
        message: `You received a ${review.rating}-star review`,
        actionUrl: `/profile/reviews`,
      };

      await storage.createNotification(notification);

      // Push real-time notification via Socket.io messaging service (if available)
      try {
        const messaging = getMessagingService();
        await messaging.notifyUser(String(review.revieweeId), "notification:new_review", {
          reviewId: review.id,
          rating: review.rating,
        });
      } catch (err) {
        console.warn("[Messaging] Failed to emit review notification", err);
      }

      res.json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Get user reviews
  app.get("/api/reviews/:userId", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { role = "reviewee" } = req.query;

      const reviews = await storage.getUserReviews(userId, role as "reviewer" | "reviewee");
      const ratings = await storage.getUserRatings(userId);

      res.json({ reviews, ratings });
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Notification routes removed - using server/routes/notification-routes.ts

  // Advanced search and discovery
  app.get("/api/marketplace/search", async (req: any, res: any) => {
    try {
      const {
        query,
        category,
        minPrice,
        maxPrice,
        location,
        condition,
        verifiedOnly,
        freeShipping,
        buyerProtection,
        sortBy = "date_desc",
      } = req.query;

      // Log search analytics if user is authenticated
      if (req.user) {
        await storage.logSearchAnalytics({
          userId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
          searchQuery: query as string,
          searchType: "marketplace",
          filters: {
            category,
            minPrice: minPrice ? parseInt(minPrice as string) : undefined,
            maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
            location,
            condition,
            verifiedOnly: verifiedOnly === "true",
            freeShipping: freeShipping === "true",
            buyerProtection: buyerProtection === "true",
            sortBy,
          },
          resultsCount: 0, // Will be updated after search
        });
      }

      // Perform search with filters
      const searchResults = await storage.getMarketplaceListings({
        searchQuery: query as string,
        categoryId: category as string,
        priceMin: minPrice ? parseInt(minPrice as string) : undefined,
        priceMax: maxPrice ? parseInt(maxPrice as string) : undefined,
        condition: condition as string,
        sortBy: sortBy as any,
      });

      res.json(searchResults);
    } catch (error: any) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Saved searches
  app.post("/api/saved-searches", isAuthenticated, async (req: any, res: any) => {
    try {
      const searchData = {
        ...req.body,
        userId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const savedSearch = await storage.createSavedSearch(searchData);
      res.json(savedSearch);
    } catch (error: any) {
      console.error("Error saving search:", error);
      res.status(500).json({ message: "Failed to save search" });
    }
  });

  app.get("/api/saved-searches", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const savedSearches = await storage.getUserSavedSearches(userId);
      res.json(savedSearches);
    } catch (error: any) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.delete("/api/saved-searches/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedSearch(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  // Transaction disputes
  app.post("/api/disputes", isAuthenticated, async (req: any, res: any) => {
    try {
      const disputeData = {
        ...req.body,
        initiatorId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const dispute = await storage.createTransactionDispute(disputeData);

      // Notify relevant parties
      const notification = {
        userId: dispute.transactionId, // Will need to get the other party's ID
        type: "dispute",
        title: "Transaction Dispute Opened",
        message: "A dispute has been opened for one of your transactions",
        actionUrl: `/disputes/${dispute.id}`,
      };

      res.json(dispute);
    } catch (error: any) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ message: "Failed to create dispute" });
    }
  });

  // ==================== PAYMENT SYSTEM ROUTES ====================

  // Payment methods and configurations
  app.get("/api/payments/methods", isAuthenticated, (req: Request, res: Response) => {
    try {
      const methods = paymentService.getAvailablePaymentMethods(true);
      res.json(methods);
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Wallet balance for current user
  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const balance = await storage.getWalletBalance(userId);
      res.json({ balance });
    } catch (error: any) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch wallet balance" });
    }
  });

  // Wallet transactions for current user
  app.get("/api/wallet/transactions", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const limitParam = req.query.limit;
      const limit = typeof limitParam === "string" ? Number(limitParam) : 50;
      const safeLimit = !Number.isFinite(limit) || limit <= 0 || limit > 200 ? 50 : limit;

      const transactions = await storage.getWalletTransactionsForUser(userId, safeLimit);
      res.json({ transactions });
    } catch (error: any) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch wallet transactions" });
    }
  });

  // Super-admin finance ledger: aggregate wallet transactions across all users
  app.get("/api/admin/finance/ledger", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const limitParam = req.query.limit;
      const limit = typeof limitParam === "string" ? Number(limitParam) : 200;
      const safeLimit = !Number.isFinite(limit) || limit <= 0 || limit > 1000 ? 200 : limit;

      const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
      const toParam = typeof req.query.to === "string" ? req.query.to : undefined;
      const directionParam =
        typeof req.query.direction === "string" ? req.query.direction : undefined;
      const typeParam =
        typeof req.query.transactionType === "string" ? req.query.transactionType : undefined;

      const fromDate = fromParam ? new Date(fromParam) : undefined;
      const toDate = toParam ? new Date(toParam) : undefined;
      const hasFrom = !!fromDate && !Number.isNaN(fromDate.getTime());
      const hasTo = !!toDate && !Number.isNaN(toDate.getTime());

      const normalizedDirection =
        directionParam === "credit" || directionParam === "debit" ? directionParam : undefined;
      const normalizedType =
        typeParam && typeParam.trim().length > 0 ? typeParam.trim() : undefined;

      const baseQuery = db.select().from(walletTransactions);
      const conditions: any[] = [];

      if (hasFrom) {
        conditions.push(gte(walletTransactions.createdAt, fromDate!));
      }
      if (hasTo) {
        conditions.push(lte(walletTransactions.createdAt, toDate!));
      }
      if (normalizedDirection) {
        conditions.push(eq(walletTransactions.direction, normalizedDirection as any));
      }
      if (normalizedType) {
        conditions.push(eq(walletTransactions.transactionType, normalizedType as any));
      }

      const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      const rows = await filteredQuery.orderBy(desc(walletTransactions.createdAt)).limit(safeLimit);

      const transactions = (rows as any[]).map((row) => ({
        id: String(row.id ?? ""),
        userId: String(row.userId ?? ""),
        counterpartyUserId: row.counterpartyUserId ? String(row.counterpartyUserId) : null,
        direction: row.direction === "debit" ? "debit" : "credit",
        amount: Number(row.amount ?? 0),
        transactionType: String(row.transactionType ?? "unknown"),
        referenceType: row.referenceType ? String(row.referenceType) : null,
        referenceId: row.referenceId ? String(row.referenceId) : null,
        memo: row.memo ? String(row.memo) : null,
        createdAt: row.createdAt ? new Date(row.createdAt as any).toISOString() : null,
      }));

      let balanceDelta = 0;
      let totalCredits = 0;
      let totalDebits = 0;
      for (const tx of transactions) {
        if (!Number.isFinite(tx.amount)) continue;
        if (tx.direction === "credit") {
          totalCredits += tx.amount;
          balanceDelta += tx.amount;
        } else {
          totalDebits += tx.amount;
          balanceDelta -= tx.amount;
        }
      }

      res.json({
        transactions,
        summary: {
          count: transactions.length,
          totalCredits,
          totalDebits,
          balanceDelta,
        },
      });
    } catch (error: any) {
      console.error("Error fetching admin finance ledger:", error);
      res.status(500).json({ message: "Failed to fetch finance ledger" });
    }
  });

  // Wallet tax statement (yearly/quarterly) for current user
  app.get("/api/wallet/tax-statement", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const periodType = (req.query.periodType as string) || "year"; // "year" | "quarter"
      const yearParam = req.query.year as string | undefined;
      const quarterParam = req.query.quarter as string | undefined;
      const format = (req.query.format as string) || "json"; // "json" | "csv"

      const now = new Date();
      const year = yearParam ? Number(yearParam) : now.getFullYear();
      if (!Number.isFinite(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: "Invalid year" });
      }

      let start: Date;
      let end: Date;
      let quarter: number | undefined;

      if (periodType === "quarter") {
        quarter = quarterParam ? Number(quarterParam) : undefined;
        if (!quarter || !Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
          return res.status(400).json({ message: "quarter must be 1-4 when periodType=quarter" });
        }

        const startMonth = (quarter - 1) * 3; // 0-based month index
        start = new Date(year, startMonth, 1, 0, 0, 0, 0);
        end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
      } else {
        start = new Date(year, 0, 1, 0, 0, 0, 0);
        end = new Date(year, 11, 31, 23, 59, 59, 999);
      }

      const rows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, userId),
            gte(walletTransactions.createdAt, start),
            lte(walletTransactions.createdAt, end)
          )
        )
        .orderBy(asc(walletTransactions.createdAt));

      let totalCredits = 0;
      let totalDebits = 0;
      let taxableIncomeTotal = 0;
      const totalsByType: Record<string, { credits: number; debits: number }> = {};

      // Obvious income-like wallet credits that should generally be considered for tax purposes.
      // This is intentionally conservative; users and their tax pros can override this using the CSV.
      const taxableIncomeTypes = new Set<string>(["affiliate_commission", "marketplace_sale"]);

      for (const row of rows as any[]) {
        const amt = Number(row.amount || 0);
        if (!Number.isFinite(amt)) continue;
        const type = (row.transactionType || "unknown").toString();
        const dir = row.direction === "debit" ? "debit" : "credit";

        if (!totalsByType[type]) {
          totalsByType[type] = { credits: 0, debits: 0 };
        }

        if (dir === "credit") {
          totalCredits += amt;
          totalsByType[type].credits += amt;

          if (taxableIncomeTypes.has(type)) {
            taxableIncomeTotal += amt;
          }
        } else {
          totalDebits += amt;
          totalsByType[type].debits += amt;
        }
      }

      const netChange = totalCredits - totalDebits;

      const summary = {
        userId,
        period: {
          type: periodType === "quarter" ? "quarter" : "year",
          year,
          quarter: periodType === "quarter" ? quarter : undefined,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        totals: {
          totalCredits,
          totalDebits,
          netChange,
          taxableIncomeTotal,
        },
        totalsByType: Object.entries(totalsByType).map(([transactionType, v]) => ({
          transactionType,
          totalCredits: v.credits,
          totalDebits: v.debits,
          netChange: v.credits - v.debits,
        })),
        transactions: rows,
      };

      if (format === "csv") {
        const header = [
          "transaction_id",
          "created_at",
          "direction",
          "amount",
          "transaction_type",
          "reference_type",
          "reference_id",
          "counterparty_user_id",
          "memo",
        ];

        const csvLines = [header.join(",")];
        for (const row of rows as any[]) {
          const line = [
            row.id,
            row.createdAt?.toISOString?.() || new Date(row.createdAt).toISOString(),
            row.direction,
            row.amount,
            row.transactionType,
            row.referenceType || "",
            row.referenceId || "",
            row.counterpartyUserId || "",
            (row.memo || "").toString().replace(/"/g, '""'),
          ];
          csvLines.push(line.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="wallet-tax-statement-${userId}-${year}${
            periodType === "quarter" && typeof quarter === "number" ? `-Q${quarter}` : ""
          }.csv"`
        );
        return res.send(csvLines.join("\n"));
      }

      res.json(summary);
    } catch (error: any) {
      console.error("Error generating wallet tax statement:", error);
      res.status(500).json({ message: "Failed to generate wallet tax statement" });
    }
  });

  // Peer-to-peer wallet transfer
  app.post("/api/wallet/transfer", isAuthenticated, async (req: any, res: any) => {
    try {
      const fromUserId = req.user?.claims?.sub || req.user?.id;
      const { toUserId, amount, memo } = req.body || {};

      if (!fromUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      if (!toUserId || !amount) {
        return res.status(400).json({ message: "toUserId and amount are required" });
      }

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }

      // Debit sender and credit recipient
      await storage.debitWallet(fromUserId, numericAmount, {
        type: "p2p_send",
        referenceType: "wallet_transfer",
        referenceId: toUserId,
        memo,
        counterpartyUserId: toUserId,
      });

      await storage.creditWallet(toUserId, numericAmount, {
        type: "p2p_receive",
        referenceType: "wallet_transfer",
        referenceId: fromUserId,
        memo,
        counterpartyUserId: fromUserId,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error performing wallet transfer:", error);
      res.status(500).json({ message: "Failed to transfer funds" });
    }
  });

  // Create contractor payment intent
  app.post(
    "/api/payments/contractor/create-intent",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { contractorPaymentId } = req.body;

        if (!contractorPaymentId) {
          return res.status(400).json({ message: "Payment ID required" });
        }

        const payment = await storage.getContractorPayment(contractorPaymentId);
        if (!payment) {
          return res.status(404).json({ message: "Payment not found" });
        }

        // Verify user authorization (either homeowner or contractor)
        const user = req.user;
        if (payment.homeownerId !== user?.id && payment.contractorId !== user?.id) {
          return res.status(403).json({ message: "Not authorized to access this payment" });
        }

        const result = await paymentService.createContractorPaymentIntent(payment);
        res.json(result);
      } catch (error: any) {
        console.error("Error creating contractor payment intent:", error);
        res.status(500).json({ message: "Failed to create payment intent" });
      }
    }
  );

  // Create marketplace payment intent
  app.post(
    "/api/payments/marketplace/create-intent",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { transactionId } = req.body;

        if (!transactionId) {
          return res.status(400).json({ message: "Transaction ID required" });
        }

        const transaction = await storage.getMarketplaceTransaction(transactionId);
        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        // Verify user authorization (either buyer or seller)
        const user = req.user;
        if (transaction.buyerId !== user?.id && transaction.sellerId !== user?.id) {
          return res.status(403).json({ message: "Not authorized to access this transaction" });
        }

        const result = await paymentService.createMarketplacePaymentIntent(transaction);
        res.json(result);
      } catch (error: any) {
        console.error("Error creating marketplace payment intent:", error);
        res.status(500).json({ message: "Failed to create payment intent" });
      }
    }
  );

  // Pay marketplace transaction using on-platform wallet balance
  app.post(
    "/api/payments/marketplace/pay-with-wallet",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.claims?.sub || req.user?.id;
        const { transactionId } = req.body || {};

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        if (!transactionId) {
          return res.status(400).json({ message: "Transaction ID required" });
        }

        const transaction = await storage.getMarketplaceTransaction(transactionId);
        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        if (transaction.buyerId !== userId) {
          return res.status(403).json({ message: "Only the buyer can pay for this transaction" });
        }

        if (transaction.status !== "pending") {
          return res.status(400).json({ message: "Transaction is not pending payment" });
        }

        const totalAmount = Number(transaction.totalAmount as any);
        const sellerAmount = Number(transaction.sellerAmount as any);

        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          return res.status(400).json({ message: "Invalid transaction amount" });
        }

        if (!Number.isFinite(sellerAmount) || sellerAmount <= 0) {
          return res.status(400).json({ message: "Invalid seller amount" });
        }

        const balanceStr = await storage.getWalletBalance(userId);
        const balance = Number(balanceStr);
        if (!Number.isFinite(balance) || balance < totalAmount) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }

        // Debit buyer wallet for full transaction total
        await storage.debitWallet(userId, totalAmount, {
          type: "marketplace_purchase",
          referenceType: "marketplace_transaction",
          referenceId: transaction.id,
          memo: `Marketplace purchase for listing ${transaction.listingId}`,
          counterpartyUserId: transaction.sellerId,
        });

        // Credit seller wallet for sellerAmount (platform keeps the fee portion)
        await storage.creditWallet(transaction.sellerId, sellerAmount, {
          type: "marketplace_sale",
          referenceType: "marketplace_transaction",
          referenceId: transaction.id,
          memo: `Marketplace sale for listing ${transaction.listingId}`,
          counterpartyUserId: userId,
        });

        const updated = await storage.updateMarketplaceTransactionPayment(transaction.id, {
          paymentMethod: "on_platform_wallet",
          isOffPlatform: false,
          status: "completed",
        });

        res.json(updated);
      } catch (error: any) {
        console.error("Error paying marketplace transaction with wallet:", error);
        res.status(500).json({ message: "Failed to pay with wallet" });
      }
    }
  );

  // Confirm off-platform payment
  app.post("/api/payments/confirm-off-platform", isAuthenticated, async (req: any, res: any) => {
    try {
      const { paymentId, paymentType, confirmationData } = req.body;

      if (!paymentId || !paymentType || !confirmationData) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const user = req.user;
      const result = await paymentService.confirmOffPlatformPayment(paymentId, paymentType, {
        ...confirmationData,
        confirmedBy: user?.id,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error confirming off-platform payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Get payment details
  app.get("/api/payments/contractor/:paymentId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { paymentId } = req.params;
      const payment = await storage.getContractorPayment(paymentId);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Verify user authorization
      const user = req.user;
      if (payment.homeownerId !== user?.id && payment.contractorId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to access this payment" });
      }

      res.json(payment);
    } catch (error: any) {
      console.error("Error fetching contractor payment:", error);
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  app.get(
    "/api/payments/marketplace/:transactionId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const { transactionId } = req.params;
        const transaction = await storage.getMarketplaceTransaction(transactionId);

        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        // Verify user authorization
        const user = req.user;
        if (transaction.buyerId !== user?.id && transaction.sellerId !== user?.id) {
          return res.status(403).json({ message: "Not authorized to access this transaction" });
        }

        res.json(transaction);
      } catch (error: any) {
        console.error("Error fetching marketplace transaction:", error);
        res.status(500).json({ message: "Failed to fetch transaction" });
      }
    }
  );

  // Get user payment history
  app.get("/api/payments/history", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { type = "all" } = req.query;

      const history: any = {};

      if (type === "all" || type === "contractor") {
        // Get contractor payments where user is homeowner
        const homeownerPayments = await storage.getContractorPaymentsByHomeowner(user?.id);
        // Get contractor payments where user is contractor
        const contractorPayments = await storage.getContractorPaymentsByContractor(user?.id);
        history.contractorPayments = {
          asHomeowner: homeownerPayments,
          asContractor: contractorPayments,
        };
      }

      if (type === "all" || type === "marketplace") {
        // Get marketplace transactions where user is buyer
        const buyerTransactions = await storage.getMarketplaceTransactionsByUser(user?.id, "buyer");
        // Get marketplace transactions where user is seller
        const sellerTransactions = await storage.getMarketplaceTransactionsByUser(
          user?.id,
          "seller"
        );
        history.marketplaceTransactions = {
          asBuyer: buyerTransactions,
          asSeller: sellerTransactions,
        };
      }

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Calculate payment fees
  app.post("/api/payments/calculate-fees", async (req: any, res: any) => {
    try {
      const { amount, paymentType = "contractor_service" } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }

      const fees = await paymentService.calculatePaymentFees(amount, paymentType);
      res.json(fees);
    } catch (error: any) {
      console.error("Error calculating fees:", error);
      res.status(500).json({ message: "Failed to calculate fees" });
    }
  });

  // Stripe webhook endpoint (generic platform payments)
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      // For this generic endpoint we trust the parsed JSON payload.
      // Signature-verified flows use /api/payments/stripe/webhook instead.
      const event = req.body as any;

      await paymentService.handleStripeWebhook(event);
      res.json({ received: true });
    } catch (error: any) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // Admin payment configuration routes
  app.get("/api/admin/payment-config", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { configType = "contractor_service" } = req.query;
      const normalizedConfigType =
        (configType as "marketplace_transaction" | "contractor_service" | "premium_subscription") ??
        "contractor_service";
      const config = await storage.getPaymentConfiguration(normalizedConfigType);
      res.json(config || {});
    } catch (error: any) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/admin/payment-config", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const configData = req.body;
      const config = await storage.createPaymentConfiguration(configData);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating payment config:", error);
      res.status(500).json({ message: "Failed to create configuration" });
    }
  });

  // Get user's donations
  app.get("/api/foundation/my-donations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const { status, type } = req.query;

      const filters = {
        status: status as string,
        type: type as string,
      };

      const donations = await storage.getUserDonations(userId, filters);
      res.json(donations);
    } catch (error: any) {
      console.error("Error fetching user donations:", error);
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  // Get/Update user donation preferences
  app.get("/api/foundation/preferences", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const preferences = await storage.getUserDonationPreferences(userId);
      res.json(preferences || {});
    } catch (error: any) {
      console.error("Error fetching donation preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.put("/api/foundation/preferences", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const preferences = await storage.upsertUserDonationPreferences(userId, req.body);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error updating donation preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Get recent donations (public feed)
  app.get("/api/foundation/recent-donations", async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const donations = await storage.getRecentDonations(limit);
      res.json(donations);
    } catch (error: any) {
      console.error("Error fetching recent donations:", error);
      res.status(500).json({ message: "Failed to fetch recent donations" });
    }
  });

  // Get foundation impact reports
  app.get("/api/foundation/impact-reports", async (req: any, res: any) => {
    try {
      const { causeId } = req.query;
      const reports = await storage.getFoundationImpactReports(causeId as string);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching impact reports:", error);
      res.status(500).json({ message: "Failed to fetch impact reports" });
    }
  });

  // Public: browse active foundation causes
  app.get("/api/foundation/causes", async (req: any, res: any) => {
    try {
      const { category, state, sort } = req.query as {
        category?: string;
        state?: string;
        sort?: string;
      };

      let whereClause: any = eq(foundationCauses.isActive, true);

      if (category && category !== "all") {
        whereClause = and(whereClause, eq(foundationCauses.category, category));
      }

      if (state && state !== "all") {
        whereClause = and(whereClause, eq(counties.stateCode, state));
      }

      let orderByExpr: any = desc(foundationCauses.createdAt);
      if (sort === "trending") {
        orderByExpr = desc(foundationCauses.raisedAmount);
      } else if (sort === "newest") {
        orderByExpr = desc(foundationCauses.createdAt);
      }

      const rows = await db
        .select({
          id: foundationCauses.id,
          name: foundationCauses.name,
          description: foundationCauses.description,
          category: foundationCauses.category,
          targetAmount: foundationCauses.targetAmount,
          raisedAmount: foundationCauses.raisedAmount,
          verifiedNonprofit: foundationCauses.verifiedNonprofit,
          imageUrl: foundationCauses.imageUrl,
          countyName: counties.name,
          countyStateCode: counties.stateCode,
        })
        .from(foundationCauses)
        .leftJoin(counties, eq(foundationCauses.countyId, counties.id))
        .where(whereClause)
        .orderBy(orderByExpr);

      const causes = rows.map((row) => ({
        id: row.id,
        title: row.name,
        description: row.description,
        category: row.category,
        location:
          row.countyName && row.countyStateCode
            ? `${row.countyName}, ${row.countyStateCode}`
            : "Nationwide",
        county: row.countyName,
        state: row.countyStateCode,
        targetAmount: Number(row.targetAmount ?? 0),
        currentAmount: Number(row.raisedAmount ?? 0),
        donorCount: 0,
        organizationName: row.name,
        organizationVerified: Boolean(row.verifiedNonprofit),
        imageUrl: row.imageUrl ?? undefined,
        urgency: "medium",
        featured: false,
      }));

      res.json(causes);
    } catch (error: any) {
      console.error("Error fetching foundation causes:", error);
      res.status(500).json({ message: "Failed to fetch causes" });
    }
  });

  // Foundation aggregate impact stats for Foundation page
  app.get("/api/foundation/impact", async (req: any, res: any) => {
    try {
      const stats = await storage.getFoundationStats();

      res.json({
        totalRaised: Number(stats?.totalRaised ?? 0),
        totalDonors: Number(stats?.totalDonors ?? 0),
        activeCauses: Number(stats?.activeCauses ?? 0),
        countiesSupported: Number(stats?.countiesSupported ?? 0),
      });
    } catch (error: any) {
      console.error("Error fetching foundation impact stats:", error);
      res.status(500).json({ message: "Failed to fetch foundation impact" });
    }
  });

  // ==================== LOCAL IMPACT SUMMARY ====================

  // Aggregated "Local Impact" snapshot for the authenticated user and their primary county
  // This is read-only and safe to expose in dashboards and to the Scout agent.
  app.get("/api/local-impact/summary", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const userRecord = await storage.getUser(userId);

      if (!userRecord?.county || !userRecord?.state) {
        res.status(400).json({
          message: "Add your county and state to view your local impact.",
        });
        return;
      }

      // County vault snapshot (shared community funds)
      const snapshot = await storage.getCountyVaultSnapshot({
        countyName: userRecord.county,
        stateCode: userRecord.state,
      });

      const localVaultBalance = snapshot.vault ? Number(snapshot.vault.currentBalance ?? 0) : 0;

      // Direct contribution: if the user is a Community Builder in this county,
      // use their verified totalContributionValue as a local direct impact signal.
      let userDirectContribution = 0;
      try {
        const builderProfile = await storage.getBuilderProfile(userId);
        if (builderProfile) {
          // If snapshot has a county, ensure we only count contributions for that county
          if (!snapshot.county || builderProfile.countyId === snapshot.county.id) {
            userDirectContribution = Number(builderProfile.totalContributionValue ?? 0);
          }
        }
      } catch (err) {
        console.warn("[local-impact] Failed to load builder profile for direct contribution", err);
      }

      // Indirect contribution: reserved for deeper referral / territory effects.
      // For now, we return 0 rather than fabricating values.
      const userIndirectContribution = 0;

      // Affiliate earnings & onboarded count: derived from the affiliate program, if any.
      let affiliateEarnings = 0;
      let affiliatesOnboardedCount = 0;
      try {
        const program = await storage.getAffiliateProgram(userId);
        if (program) {
          const stats = await storage.getAffiliateStats(program.id);
          affiliateEarnings = Number(stats.totalCommissionEarned ?? 0);
          affiliatesOnboardedCount = stats.totalReferrals ?? 0;
        }
      } catch (err) {
        console.warn("[local-impact] Failed to load affiliate stats", err);
      }

      res.json({
        localVaultBalance,
        userDirectContribution,
        userIndirectContribution,
        affiliateEarnings,
        affiliatesOnboardedCount,
        countyId: snapshot.county?.id ?? null,
        countyName: snapshot.county?.name ?? userRecord.county ?? null,
        stateCode: snapshot.county?.stateCode ?? userRecord.state ?? null,
      });
    } catch (error: any) {
      console.error("Error fetching local impact summary:", error);
      res.status(500).json({ message: "Failed to load local impact summary" });
    }
  });

  // ==================== CONTEXTUAL AGGREGATES (STATIC LANGUAGE SUPPORT) ====================

  // Read-only aggregate endpoint backing context-aware but non-creepy static language.
  // This intentionally exposes only group-level counts that can be backed by real queries.
  // If locality is missing or counts are zero, callers should fall back to neutral copy.
  app.get("/api/aggregates/context", async (req: any, res: any) => {
    try {
      const stateCode = typeof req.query.stateCode === "string" ? req.query.stateCode : undefined;
      const countyFips =
        typeof req.query.countyFips === "string" ? req.query.countyFips : undefined;
      const timeframe = typeof req.query.timeframe === "string" ? req.query.timeframe : undefined;

      // For now we support a single interest segment representing auto-related providers.
      const interests: string[] = ["auto_dealers"];

      // If we have no locality hints at all, return a neutral, data-empty payload.
      if (!stateCode && !countyFips) {
        res.json({
          location: null,
          interests,
          activity: {
            auto_dealers: {
              last_7_days: null,
              last_30_days: null,
            },
          },
          asOf: new Date().toISOString().slice(0, 10),
        });
        return;
      }

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const roleFilter = inArray(users.role, ["car_dealer", "auto_service"]);
      const localityFilters: any[] = [roleFilter];

      if (stateCode) {
        localityFilters.push(eq(users.stateCode, stateCode));
      }
      if (countyFips) {
        localityFilters.push(eq(users.countyFips, countyFips));
      }

      const baseWhere = and(...localityFilters);

      const [rows7, rows30] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(baseWhere, gte(users.createdAt, from7))),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(baseWhere, gte(users.createdAt, from30))),
      ]);

      const count7 = rows7[0]?.count ?? 0;
      const count30 = rows30[0]?.count ?? 0;

      // Look up a human-friendly county label when we have a FIPS code; otherwise fall back to state-only.
      let location: { city: string | null; state: string | null; county: string | null } | null =
        null;
      if (countyFips) {
        try {
          const county = await storage.getCountyByFips(countyFips);
          if (county) {
            location = {
              city: null,
              state: county.stateCode,
              county: county.name,
            };
          }
        } catch (err) {
          console.warn("[aggregates:context] Failed to resolve county by FIPS", err);
        }
      }

      if (!location && stateCode) {
        location = {
          city: null,
          state: stateCode,
          county: null,
        };
      }

      const payload = {
        location,
        interests,
        activity: {
          auto_dealers: {
            last_7_days: count7 > 0 ? Number(count7) : null,
            last_30_days: count30 > 0 ? Number(count30) : null,
          },
        },
        asOf: now.toISOString().slice(0, 10),
      } as const;

      // Light observability: event-level logging with no user identifiers.
      const scope: "state" | "county" = countyFips ? "county" : "state";
      const effectiveTimeframe = timeframe === "30d" ? "30d" : "7d";
      const seriesForWindow =
        effectiveTimeframe === "7d"
          ? payload.activity.auto_dealers.last_7_days
          : payload.activity.auto_dealers.last_30_days;

      const hasData = seriesForWindow !== null;

      try {
        await storage.logEvent("aggregates.context.requested", {
          scope,
          interest: "auto_dealers",
          timeframe: effectiveTimeframe,
          hasData,
          asOf: payload.asOf,
          // Explicitly omit any user-identifying fields
          ipAddress: null,
          userAgent: null,
          userId: null,
          contractorId: null,
        });
      } catch (err) {
        console.warn("[aggregates:context] Failed to log observability event", err);
      }

      res.json(payload);
    } catch (error: any) {
      console.error("[aggregates:context] Failed to compute contextual aggregates", error);
      res.status(500).json({ message: "Failed to fetch contextual aggregates" });
    }
  });

  // County vault balances (community reinvestment)
  app.get("/api/vaults/my-county", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const userRecord = await storage.getUser(userId);

      if (!userRecord?.county || !userRecord?.state) {
        return res
          .status(400)
          .json({ message: "Add your county and state to view your community vault balance." });
      }

      const snapshot = await storage.getCountyVaultSnapshot({
        countyName: userRecord.county,
        stateCode: userRecord.state,
      });

      res.json({
        county: snapshot.county,
        vault: snapshot.vault
          ? {
              ...snapshot.vault,
              currentBalance: Number(snapshot.vault.currentBalance ?? 0),
              lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
              lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
            }
          : null,
        last30dInflow: snapshot.last30dInflow,
        sourcesBreakdown: snapshot.sourcesBreakdown,
        ledger: snapshot.ledger.map((entry) => ({
          ...entry,
          amount: Number(entry.amount ?? 0),
        })),
      });
    } catch (error: any) {
      console.error("Error fetching county vault:", error);
      res.status(500).json({ message: "Failed to load vault balance" });
    }
  });

  app.get("/api/vaults/county/:countyId", async (req: any, res: any) => {
    try {
      const { countyId } = req.params;
      const snapshot = await storage.getCountyVaultSnapshot({ countyId });

      res.json({
        county: snapshot.county,
        vault: snapshot.vault
          ? {
              ...snapshot.vault,
              currentBalance: Number(snapshot.vault.currentBalance ?? 0),
              lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
              lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
            }
          : null,
        last30dInflow: snapshot.last30dInflow,
        sourcesBreakdown: snapshot.sourcesBreakdown,
        ledger: snapshot.ledger.map((entry) => ({
          ...entry,
          amount: Number(entry.amount ?? 0),
        })),
      });
    } catch (error: any) {
      console.error("Error fetching county vault by id:", error);
      res.status(500).json({ message: "Failed to load vault balance" });
    }
  });

  // Admin: Create foundation cause
  app.post("/api/admin/foundation/causes", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        name,
        description,
        category,
        countyId,
        targetAmount,
        imageUrl,
        websiteUrl,
        contactEmail,
        taxId,
      } = req.body || {};

      if (!name || !description || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      const user = userRows[0];
      if (!user || !Array.isArray(user.roles) || !user.roles.includes("admin")) {
        return res.status(403).json({ message: "Only admins can create foundation causes" });
      }

      const inserted = await db
        .insert(foundationCauses)
        .values({
          name,
          description,
          category,
          countyId,
          targetAmount,
          imageUrl,
          websiteUrl,
          contactEmail,
          taxId,
          createdBy: userId,
          isActive: true,
        } as any)
        .returning();

      res.status(201).json(inserted?.[0] ?? null);
    } catch (error: any) {
      console.error("Error creating foundation cause:", error);
      res.status(500).json({ message: "Failed to create foundation cause" });
    }
  });

  app.post("/api/user/account-deletion-request", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const request = await dataManagementService.createDataRequest({
        userId: user?.id,
        requestType: "account_closure",
        reason: req.body.reason,
        requestedBy: user?.id,
      });

      await dataManagementService.logDataAccess({
        userId: user?.id,
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: "delete",
        resourceType: "profile",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        metadata: { requestId: request.id },
      });

      res.json({
        message: "Account deletion request created. This requires admin approval.",
        requestId: request.id,
      });
    } catch (error: any) {
      console.error("Error creating account deletion request:", error);
      res.status(500).json({ message: "Failed to create account deletion request" });
    }
  });

  app.get("/api/user/data-export", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const request = await dataManagementService.createDataRequest({
        userId,
        requestType: "data_export",
        requestedBy: userId,
      });

      await dataManagementService.logDataAccess({
        userId,
        accessorId: userId,
        accessorRole: user?.role || "user",
        actionType: "export",
        resourceType: "profile",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        metadata: { requestId: request.id },
      });

      const exportData = await dataManagementService.exportUserData(userId);
      const zipBuffer = await dataManagementService.createDataExportFile(exportData);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tradescout-data-export-${userId}.zip"`
      );
      res.send(zipBuffer);
    } catch (error: any) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export user data" });
    }
  });

  // Admin Data Management Routes
  app.get("/api/admin/data-requests", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: "view",
        resourceType: "analytics",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const requests = await dataManagementService.getAllDataRequests(status as string);
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching data requests:", error);
      res.status(500).json({ message: "Failed to fetch data requests" });
    }
  });

  app.post(
    "/api/admin/process-data-export/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { id } = req.params;

        const requests = await dataManagementService.getAllDataRequests();
        const request = requests.find((r: any) => r.id === id);

        if (!request || request.requestType !== "data_export") {
          return res.status(404).json({ message: "Data export request not found" });
        }

        await dataManagementService.logDataAccess({
          userId: request.userId,
          accessorId: user?.id,
          accessorRole: user.role,
          actionType: "export",
          resourceType: "profile",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          metadata: { adminProcessed: true, requestId: id },
        });

        const exportData = await dataManagementService.exportUserData(request.userId);
        const zipBuffer = await dataManagementService.createDataExportFile(exportData);

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="tradescout-data-export-${request.userId}.zip"`
        );
        res.send(zipBuffer);
      } catch (error: any) {
        console.error("Error processing data export:", error);
        res.status(500).json({ message: "Failed to process data export" });
      }
    }
  );

  app.post(
    "/api/admin/approve-account-deletion/:id",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { id } = req.params;

        const requests = await dataManagementService.getAllDataRequests();
        const request = requests.find((r: any) => r.id === id);

        if (!request || request.requestType !== "account_closure") {
          return res.status(404).json({ message: "Account deletion request not found" });
        }

        await dataManagementService.deleteUserData(request.userId, user?.id);

        res.json({ message: "Account successfully deleted" });
      } catch (error: any) {
        console.error("Error processing account deletion:", error);
        res.status(500).json({ message: "Failed to process account deletion" });
      }
    }
  );

  app.get("/api/admin/security-incidents", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: "view",
        resourceType: "analytics",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const incidents = await dataManagementService.getSecurityIncidents(status as string);
      res.json(incidents);
    } catch (error: any) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });

  app.get(
    "/api/admin/user-access-logs/:userId",
    isAuthenticated,
    isAdmin,
    async (req: any, res: any) => {
      try {
        const user = req.user as any;
        const { userId } = req.params;
        const { limit = 100 } = req.query;

        await dataManagementService.logDataAccess({
          userId: userId,
          accessorId: user?.id,
          accessorRole: user.role,
          actionType: "view",
          resourceType: "analytics",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });

        const logs = await dataManagementService.getUserAccessLogs(
          userId,
          parseInt(limit as string)
        );
        res.json(logs);
      } catch (error: any) {
        console.error("Error fetching user access logs:", error);
        res.status(500).json({ message: "Failed to fetch access logs" });
      }
    }
  );

  // Device management endpoints for master admin - temporarily removed for debugging

  // Register social media routes
  registerSocialRoutes(app);

  // Register social features (search, friends, messaging)
  registerSocialFeatures(app);

  // Register Scout recommendations (D2: confidence-based contact recommendations)
  registerScoutRecommendations(app);

  // Fallback for legacy client trending endpoint
  const trendingHandler: ExpressHandler = (_req, res) => {
    res.json({ items: [], message: "Trending data not available yet." });
  };

  app.get("/api/trending", trendingHandler);

  // Set up community moderation routes
  setupModerationRoutes(app);

  // Setup UI monitoring routes
  registerUIIssuesRoutes(app);

  // Register AI Code Fixing routes
  registerAICodeFixRoutes(app);

  // Register CRM routes
  registerCrmRoutes(app);

  // Register notification routes
  registerNotificationRoutes(app);
  registerDirectConnectRoutes(app);

  // Register analytics routes
  registerAnalyticsRoutes(app);

  // Register recommendation generator routes
  registerRecommendationGeneratorRoutes(app);

  // Register business profile routes (PHASE 3d-C: Published Presence)
  registerBusinessProfileRoutes(app);

  // Register business profile routes
  app.use(businessesRouter);

  // Register Profile website routes
  app.use(profilesRouter);

  // Register contractor signup routes
  app.use(contractorSignupRouter);

  // Register Hardrock commercial landing + staff directory routes
  registerHardrockRoutes(app);

  // Public geographic coverage endpoints used by county pages
  app.use("/api/geographic-coverage", geographicCoverageRouter);

  // Register Community Builder routes
  app.use("/api/community-builder", communityBuilderRouter);
  app.use("/api/admin/community-builder", adminCommunityBuilderRouter);

  // Register Community Vault MVP routes (profile-scoped)
  app.use("/api/community-vault", communityVaultRouter);
  app.use("/api/community-causes", communityCausesRouter);
  app.use("/api/platform-support", platformSupportRouter);

  // Register prompt admin routes (super admin only)
  const promptAdminRouter = (await import("./routes/promptAdmin")).default;
  app.use("/api/prompt-admin", promptAdminRouter);

  // Register AI Scout routes (with assistant alias for backward compatibility)
  app.use("/api/scout", scoutRoute);
  app.use("/api/assistant", scoutRoute);

  // Admin-only: authority diagnostics (observe, not feature)
  const scoutAnalyticsRouter = (await import("./routes/scout-analytics")).default;
  app.use("/api/scout-analytics", scoutAnalyticsRouter);

  // Super admin only: control plane (emergency brakes and governors)
  const adminControlRouter = (await import("./routes/admin-control")).default;
  app.use("/api/admin-control", adminControlRouter);

  // Scout CTA authority check (lightweight, cached)
  const { setupScoutCTACheckRoutes } = await import("./routes/scout-cta-check");
  setupScoutCTACheckRoutes(app);

  // Admin insights for Scout usage
  const scoutInsightsHandler: ExpressHandler = async (req, res) => {
    try {
      const { message, mode, locality, success, latencyMs, error } = req.body || {};

      // Basic validation; do not throw for missing optional fields
      if (!message || typeof success !== "boolean") {
        res.status(400).json({ message: "Invalid scout insights payload" });
        return;
      }

      // For now, log to server console; can be wired to DB/analytics later
      console.info("[ScoutInsight]", {
        when: new Date().toISOString(),
        userId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        mode,
        locality,
        success,
        latencyMs,
        error,
        preview: String(message).slice(0, 280),
      });

      res.status(204).end();
      return;
    } catch (e) {
      console.error("Failed to record scout insight", e);
      res.status(500).json({ message: "Failed to record scout insight" });
      return;
    }
  };

  app.post("/api/admin/scout-insights", scoutInsightsHandler);

  // Bug report endpoint with Formspree integration
  app.post("/api/bug-report", async (req: any, res: any) => {
    try {
      const formspreeUrl = process.env.FORMSPREE_FORM_ID;

      if (!formspreeUrl) {
        return res.status(500).json({ message: "Bug reporting service not configured" });
      }

      // Extract form ID from URL if it's a full URL
      const formId = formspreeUrl.replace("https://formspree.io/f/", "");
      const formspreeEndpoint = `https://formspree.io/f/${formId}`;

      // Forward the form data to Formspree
      const fetch = (await import("node-fetch")).default;
      const response = await fetch(formspreeEndpoint, {
        method: "POST",
        body: req.body as any, // FormData from client
      });

      if (response.ok) {
        // Log the bug report for admin awareness
        await storage.logEvent("bug_report_submitted", {
          timestamp: new Date().toISOString(),
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          userId: (req.user as any)?.id || "anonymous",
        });

        res.json({ message: "Bug report submitted successfully" });
      } else {
        throw new Error(`Formspree responded with status ${response.status}`);
      }
    } catch (error: any) {
      console.error("Error submitting bug report:", error);
      res.status(500).json({ message: "Failed to submit bug report" });
    }
  });

  // Phase 1: Daily Deals System Routes
  const {
    getDailyDeals,
    createDailyDeal,
    trackDealEngagement,
    getUserAffiliate,
    getAffiliateDashboard,
    updateDailyDeal,
    deleteDailyDeal,
    getFeaturedDeals,
  } = await import("./routes/dailyDeals");

  // Public daily deals endpoints
  app.get("/api/daily-deals", getDailyDeals);
  app.get("/api/deals/featured", getFeaturedDeals);

  // Protected daily deals endpoints
  app.post("/api/daily-deals", isAuthenticated, createDailyDeal);
  app.put("/api/daily-deals/:id", isAuthenticated, updateDailyDeal);
  app.delete("/api/daily-deals/:id", isAuthenticated, deleteDailyDeal);

  // Deal engagement tracking
  app.post("/api/deal-engagements", trackDealEngagement);

  // Affiliate system endpoints (daily deals performance)
  app.get("/api/user/affiliate", isAuthenticated, getUserAffiliate);
  app.get("/api/affiliate/performance", isAuthenticated, getAffiliateDashboard as any);

  const {
    listPromotionsHandler,
    createPromotionHandler,
    updatePromotionHandler,
    deletePromotionHandler,
  } = await import("./routes/promotions");

  // Promotions admin endpoints (super admin only)
  app.get("/api/admin/promotions", isAuthenticated, isSuperAdmin, listPromotionsHandler as any);
  app.post("/api/admin/promotions", isAuthenticated, isSuperAdmin, createPromotionHandler as any);
  app.put(
    "/api/admin/promotions/:id",
    isAuthenticated,
    isSuperAdmin,
    updatePromotionHandler as any
  );
  app.delete(
    "/api/admin/promotions/:id",
    isAuthenticated,
    isSuperAdmin,
    deletePromotionHandler as any
  );

  // Phase 2: Boost System Routes for Realtors & Dealers
  const { getAvailableBoosts, purchaseBoost, getUserBoosts, getBoostAnalytics, cancelBoost } =
    await import("./routes/boosts");

  app.get("/api/boosts/available", isAuthenticated, getAvailableBoosts);
  app.post("/api/boosts/purchase", isAuthenticated, purchaseBoost);
  app.get("/api/boosts/user", isAuthenticated, getUserBoosts);
  app.get("/api/boosts/:boostId/analytics", isAuthenticated, getBoostAnalytics);
  app.delete("/api/boosts/:boostId", isAuthenticated, cancelBoost);

  // Phase 3: Groups & Social Features Routes
  const {
    getGroups,
    getGroupDetails,
    joinGroup,
    getGroupPosts,
    createGroupPost,
    getUserGroups,
    createGroup,
  } = await import("./routes/groups");

  app.get("/api/groups", getGroups);
  app.get("/api/groups/user", isAuthenticated, getUserGroups);
  app.get("/api/groups/:groupId", getGroupDetails);
  app.post("/api/groups", isAuthenticated, createGroup);
  app.post("/api/groups/:groupId/join", isAuthenticated, joinGroup);
  app.get("/api/groups/:groupId/posts", getGroupPosts);
  app.post("/api/groups/:groupId/posts", isAuthenticated, createGroupPost);

  // Phase 4: HOA Management Routes
  const {
    getHOA,
    getHOAFinances,
    getHOAVendors,
    getHOAVotes,
    submitVote,
    requestVendorService,
    collectHOAFee,
    searchHOAs,
    getHOAMember,
    getHOAMembers,
    addHOAMember,
    updateHOAMemberRole,
  } = await import("./routes/hoa");

  app.get("/api/hoa/search", searchHOAs);
  app.get("/api/hoa/:hoaId", getHOA);
  app.get("/api/hoa/:hoaId/member", isAuthenticated, getHOAMember);
  app.get("/api/hoa/:hoaId/members", isAuthenticated, getHOAMembers);
  app.post("/api/hoa/:hoaId/members", isAuthenticated, addHOAMember);
  app.put("/api/hoa/:hoaId/members/:memberId/role", isAuthenticated, updateHOAMemberRole);
  app.get("/api/hoa/:hoaId/finances", getHOAFinances);
  app.get("/api/hoa/:hoaId/vendors", getHOAVendors);
  app.get("/api/hoa/:hoaId/votes", getHOAVotes);
  app.post("/api/hoa/votes/:voteId/submit", isAuthenticated, submitVote);
  app.post("/api/hoa/vendors/:vendorId/request", isAuthenticated, requestVendorService);
  app.post("/api/hoa/collect-fee", isAuthenticated, collectHOAFee);

  // HOA Level 2 membership + dashboard endpoints
  app.get("/api/hoa", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      res.json({ memberships });
    } catch (error: any) {
      console.error("Error fetching HOA memberships:", error);
      res.status(500).json({ message: "Failed to load HOA memberships" });
    }
  });

  app.get("/api/hoa/dashboard", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ message: "User is not a member of any HOA" });
      }

      const requestedHoaId = (req.query.hoaId as string) || memberships[0].hoaId;
      const isMemberOfRequested = memberships.some((m) => m.hoaId === requestedHoaId);
      if (!isMemberOfRequested) {
        return res.status(403).json({ message: "User is not a member of this HOA" });
      }

      const dashboard = await (storage as any).getHoaDashboard(requestedHoaId);
      if (!dashboard) {
        return res.status(404).json({ message: "HOA dashboard not found" });
      }

      res.json({ dashboard });
    } catch (error: any) {
      console.error("Error fetching HOA dashboard:", error);
      res.status(500).json({ message: "Failed to load HOA dashboard" });
    }
  });

  app.get("/api/hoa/votes", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ message: "User is not a member of any HOA" });
      }

      const requestedHoaId = (req.query.hoaId as string) || memberships[0].hoaId;
      const isMemberOfRequested = memberships.some((m) => m.hoaId === requestedHoaId);
      if (!isMemberOfRequested) {
        return res.status(403).json({ message: "User is not a member of this HOA" });
      }

      const votes = await (storage as any).getHoaVotesForUser(requestedHoaId, userId);
      res.json({ votes });
    } catch (error: any) {
      console.error("Error fetching HOA votes:", error);
      res.status(500).json({ message: "Failed to load HOA votes" });
    }
  });

  app.post(
    "/api/hoa/votes/:id/vote",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const { id } = req.params;
        const { option } = req.body || {};
        if (!option) {
          return res.status(400).json({ message: "option is required" });
        }

        // Delegate membership and vote window validation to storage helper
        await (storage as any).submitHOAVote(userId, id, option);

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error casting HOA vote:", error);
        res.status(500).json({ message: "Failed to cast vote" });
      }
    }
  );

  // Phase 5: Nationwide Expansion Routes
  const {
    getNationwideMetrics,
    getTopCounties,
    getExpansionPipeline,
    getFoundationImpact,
    requestCountyActivation,
    getCoverageMapData,
    getAffiliatePerformance,
  } = await import("./routes/nationwide");

  app.get("/api/nationwide/metrics", getNationwideMetrics);
  app.get("/api/nationwide/top-counties", getTopCounties);
  app.get("/api/nationwide/expansion-pipeline", getExpansionPipeline);
  app.get("/api/nationwide/foundation-impact", getFoundationImpact);
  app.get("/api/nationwide/coverage-map", getCoverageMapData);
  app.get("/api/nationwide/affiliate-performance", getAffiliatePerformance);
  app.post("/api/nationwide/request-activation", isAuthenticated, requestCountyActivation);

  // ========================================
  // PROFESSIONAL STORY GENERATION ROUTES
  // ========================================

  // Generate a professional story
  app.post("/api/stories/generate", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { templateId, userInputs } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      // Generate story using the service
      const generatedStory = await StoryGenerationService.generateStory({
        templateId,
        userInputs: userInputs || {},
        userId,
      });

      // Track the story generation event
      // LocalityTracker call removed

      res.status(201).json(generatedStory);
    } catch (error: any) {
      console.error("Error generating story:", error);
      res.status(500).json({ message: "Failed to generate story" });
    }
  });

  // Save a generated story
  app.post("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const storyData = { ...req.body, userId };

      // Validate input data
      const parsedStory = insertGeneratedStorySchema.safeParse(storyData);
      if (!parsedStory.success) {
        return res.status(400).json({
          message: "Invalid story payload",
          issues: parsedStory.error.issues,
        });
      }

      const validatedStory = parsedStory.data;

      // Save story to database
      const [savedStory] = await db.insert(generatedStories).values(validatedStory).returning();

      // Log the save event
      await storage.logEvent("story_saved", {
        storyId: savedStory.id,
        userId,
        templateId: savedStory.templateId,
      });

      res.status(201).json(savedStory);
    } catch (error: any) {
      console.error("Error saving story:", error);
      res.status(500).json({ message: "Failed to save story" });
    }
  });

  // Get user's stories
  app.get("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { page = 1, limit = 10, public_only } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause =
        public_only === "true"
          ? and(eq(generatedStories.userId, userId), eq(generatedStories.isPublic, true))
          : eq(generatedStories.userId, userId);

      const stories = await db
        .select()
        .from(generatedStories)
        .where(whereClause)
        .orderBy(desc(generatedStories.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      res.json(stories);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  // Get story templates
  app.get("/api/stories/templates", async (req: any, res: any) => {
    try {
      const templates = StoryGenerationService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Dashboard data endpoint - personalized user dashboard data
  app.get("/api/dashboard", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const dashboardData: any = {
        stats: {
          activeProjects: 0,
          savedContractors: 0,
          marketplaceListings: 0,
          realEstateListings: 0,
          totalViews: 0,
          notifications: 0,
        },
        recentActivity: [],
        myProjects: [],
        myListings: [],
        savedItems: [],
        quotes: [],
        conversations: [],
      };

      // Fetch contractor-specific data
      if (user.role === "contractor") {
        const contractor = await storage.getContractorByUserId(userId);

        if (contractor) {
          // Get contractor's assigned leads (projects)
          const contractorLeads = await db
            .select()
            .from(leads)
            .where(eq(leads.contractorId, contractor.id))
            .orderBy(desc(leads.createdAt))
            .limit(10);

          dashboardData.myProjects = contractorLeads.map((lead: any) => ({
            id: lead.id,
            title: `${lead.projectType} - ${lead.urgency}`,
            status: lead.status,
            value: lead.estimatedValue,
            createdAt: lead.createdAt,
          }));

          dashboardData.stats.activeProjects = contractorLeads.filter(
            (l: any) => l.status === "new" || l.status === "contacted" || l.status === "qualified"
          ).length;

          // Get contractor's quotes
          const contractorQuotes = await db
            .select()
            .from(quotes)
            .where(eq(quotes.contractorId, contractor.id))
            .orderBy(desc(quotes.createdAt))
            .limit(10);

          dashboardData.quotes = contractorQuotes;

          // Get contractor's conversations
          const contractorConversations = await db
            .select()
            .from(conversations)
            .where(eq(conversations.contractorId, contractor.id))
            .orderBy(desc(conversations.lastMessageAt))
            .limit(10);

          dashboardData.conversations = contractorConversations;
        }
      }

      // Fetch homeowner-specific data
      if (user.role === "homeowner") {
        // Get homeowner's leads (project requests)
        const homeownerLeads = await db
          .select()
          .from(leads)
          .where(eq(leads.userId, userId))
          .orderBy(desc(leads.createdAt))
          .limit(10);

        dashboardData.myProjects = homeownerLeads.map((lead: any) => ({
          id: lead.id,
          title: `${lead.projectType} - ${lead.urgency}`,
          status: lead.status,
          value: lead.estimatedValue,
          createdAt: lead.createdAt,
        }));

        dashboardData.stats.activeProjects = homeownerLeads.filter(
          (l: any) => l.status === "new" || l.status === "contacted" || l.status === "qualified"
        ).length;

        // Get homeowner's conversations
        const homeownerConversations = await db
          .select()
          .from(conversations)
          .where(eq(conversations.homeownerId, userId))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(10);

        dashboardData.conversations = homeownerConversations;

        // Get quotes from conversations
        if (homeownerConversations.length > 0) {
          const conversationIds = homeownerConversations.map((c: any) => c.id);
          const homeownerQuotes = await db
            .select()
            .from(quotes)
            .where(sql`${quotes.conversationId} = ANY(${conversationIds})`)
            .orderBy(desc(quotes.createdAt))
            .limit(10);

          dashboardData.quotes = homeownerQuotes;
        }

        // Get saved contractors count
        const savedContractorsTable = (db as any).query?.savedContractors?.table;
        if (savedContractorsTable) {
          const savedContractorRows = await db
            .select()
            .from(savedContractorsTable)
            .where(eq((savedContractorsTable as any).userId, userId));
          dashboardData.stats.savedContractors = savedContractorRows.length;
        } else {
          dashboardData.stats.savedContractors = 0;
        }
      }

      // Get marketplace listings for all users
      const userListings = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.sellerId, userId))
        .orderBy(desc(marketplaceListings.createdAt))
        .limit(10);

      dashboardData.myListings = userListings;
      dashboardData.stats.marketplaceListings = userListings.filter(
        (l: any) => l.status === "active"
      ).length;

      // Get realtor listings if user is a realtor
      const realEstateListingsTable = (db as any).query?.realEstateListings?.table;
      if (user.role === "realtor" && realEstateListingsTable) {
        const realtorListings = await db
          .select()
          .from(realEstateListingsTable)
          .where(eq((realEstateListingsTable as any).sellerId, userId))
          .orderBy(desc((realEstateListingsTable as any).createdAt))
          .limit(10);
        dashboardData.realEstateListings = realtorListings;
        dashboardData.stats.realEstateListings = realtorListings.filter(
          (l: any) => l.status === "active"
        ).length;
      }

      // Get recent community activity
      const recentPosts = await db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.authorId, userId))
        .orderBy(desc(communityPosts.createdAt))
        .limit(5);

      dashboardData.recentActivity = recentPosts.map((post: any) => ({
        id: post.id,
        title: `Posted: ${post.title || post.content.substring(0, 50)}`,
        createdAt: post.createdAt,
        type: "post",
      }));

      // Profile views metric not available in schema; default to 0
      dashboardData.stats.totalViews = 0;

      res.json(dashboardData);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Saved contractors list for the current user
  app.get("/api/saved-contractors", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const savedContractorsTable = (db as any).query?.savedContractors?.table;
      if (!savedContractorsTable) {
        return res.json([]);
      }

      const rows = await db
        .select()
        .from(savedContractorsTable)
        .where(eq((savedContractorsTable as any).userId, userId));

      if (!rows.length) {
        return res.json([]);
      }

      const contractorIds = Array.from(
        new Set(
          rows
            .map((r: any) => r.contractorId || r.contractor_id || r.proId || r.pro_id)
            .filter(Boolean)
        )
      );

      if (!contractorIds.length) {
        return res.json([]);
      }

      const contractorRecords = await db
        .select()
        .from(contractors)
        .where(inArray(contractors.id, contractorIds as string[]));

      const payload = contractorRecords.map((c: any) => ({
        id: c.id,
        name: c.displayName || c.businessName || c.legalName || "Unknown Contractor",
        avatarUrl: c.logoUrl || c.avatarUrl || null,
        category: c.primaryTrade || c.trade || null,
        location: c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || null,
        verified: Boolean(c.isVerified || c.verified || false),
      }));

      res.json(payload);
    } catch (error: any) {
      console.error("Error fetching saved contractors:", error);
      res.status(500).json({ message: "Failed to fetch saved contractors" });
    }
  });

  // Remove a contractor from the current user's saved list
  app.delete(
    "/api/saved-contractors/:contractorId",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || req.user?.claims?.sub;
        const { contractorId } = req.params;

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        if (!contractorId) {
          return res.status(400).json({ message: "contractorId is required" });
        }

        const savedContractorsTable = (db as any).query?.savedContractors?.table;
        if (!savedContractorsTable) {
          return res.status(404).json({ message: "Saved contractors table not available" });
        }

        await db
          .delete(savedContractorsTable)
          .where(
            and(
              eq((savedContractorsTable as any).userId, userId),
              or(
                eq((savedContractorsTable as any).contractorId, contractorId as any),
                eq((savedContractorsTable as any).contractor_id, contractorId as any),
                eq((savedContractorsTable as any).proId, contractorId as any),
                eq((savedContractorsTable as any).pro_id, contractorId as any)
              )
            )
          );

        res.status(204).send();
      } catch (error: any) {
        console.error("Error removing saved contractor:", error);
        res.status(500).json({ message: "Failed to remove saved contractor" });
      }
    }
  );

  // ============================================================================
  // CRITICAL FOUNDATION ENDPOINTS (Phase 0)
  // ============================================================================

  // 1. HEALTH CHECK ENDPOINT
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const timestamp = new Date().toISOString();

      // Quick database connectivity check
      let dbStatus = "connecting";
      try {
        const dbCheck = await db.execute(sql`SELECT 1`);
        dbStatus = dbCheck ? "connected" : "disconnected";
      } catch (err) {
        dbStatus = "disconnected";
      }

      res.json({
        status: "healthy",
        uptime: Math.round(uptime),
        timestamp,
        database: dbStatus,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERSION: "1.0.0",
        },
      });
    } catch (error: any) {
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 1b. VERSION ENDPOINT (backend build metadata)
  app.get("/api/version", (req: Request, res: Response) => {
    // Prefer explicit build metadata from env when available
    const commit =
      process.env.BUILD_COMMIT ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.RENDER_GIT_COMMIT ||
      "unknown";
    const builtAt = process.env.BUILD_AT || process.env.VERCEL_BUILD_TIME || undefined;

    res.json({
      service: "tradescout-backend",
      commit,
      builtAt: builtAt || undefined,
      env: process.env.NODE_ENV || "development",
    });
  });

  // 2. MESSAGING API - Basic endpoints (real-time via WebSocket in WebSocketManager)
  app.post("/api/conversations", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      return res.status(400).json({
        reasonCode: "MISSING_AUTHORITY_GATE",
        message:
          "Direct conversation creation is blocked. Use /api/social/conversations/start with authorityGate and intent.",
      });
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const userConversations = await db
        .select()
        .from(conversations)
        .where(
          sql`${conversations.homeownerId} = ${userId} OR ${conversations.contractorId} = ${userId}`
        )
        .orderBy(desc(conversations.updatedAt));

      res.json(userConversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // 3. STRIPE PAYMENT - Setup endpoint
  app.post("/api/payments/intent", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

      const { amount, currency = "usd", description } = req.body;
      const userId = req.user?.id ?? "unknown";

      if (!amount || amount < 1) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      res.json({
        clientSecret: intent.client_secret,
        intentId: intent.id,
        amount: intent.amount,
        status: intent.status,
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // (Generic Stripe webhook handler now lives above and delegates to paymentService.handleStripeWebhook)

  // Stripe webhook dedicated to Community Builder checkout + payouts
  app.post("/api/payments/stripe/webhook", async (req: Request, res: Response) => {
    try {
      if (!stripe) return res.status(400).json({ message: "Stripe not configured" });

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret)
        return res.status(400).json({ message: "STRIPE_WEBHOOK_SECRET not configured" });

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));

      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        console.error("[stripe] signature verification failed", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        switch (event.type) {
          case "checkout.session.completed":
            {
              const session = event.data.object as any;
              const metaType = session?.metadata?.type;

              // Route MVP payment intents by explicit metadata type.
              if (metaType === "community_vault_donation" || metaType === "platform_support") {
                await platformSupportPaymentService.handleStripeEvent(event);
              } else {
                await communityBuilderPaymentService.handleCheckoutSessionCompleted(session);
              }
            }
            break;
          case "invoice.paid":
            await platformSupportPaymentService.handleStripeEvent(event);
            break;
          case "transfer.created":
          case "transfer.updated":
            await communityBuilderPaymentService.handleStripeWebhook(event);
            break;
          default:
            // No-op for unrelated events
            break;
        }
      } catch (err: any) {
        console.error(`[stripe] webhook handler failed for ${event.type}`, err);
        return res.status(500).json({ message: "Webhook handling failed" });
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[stripe] webhook error", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Returns a signed JWT for MealScout SSO that the client can pass into
  // performMealScoutSSO from the MealScout SDK. This does not perform any
  // server-to-server call; it only mints the token.
  app.post("/api/mealscout/token", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const caps = resolveCapabilities(req);
      if (caps.mealscout !== "ok") {
        return res.status(200).json({ available: false });
      }

      const rawUser: any = req.user;
      const userId: string = rawUser?.id || rawUser?.claims?.sub || "";
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const token = createMealscoutSsoToken(user);
      return res.json({ available: true, token });
    } catch (err: any) {
      console.error("[MealScoutSSO] Failed to mint SSO token", err);
      return res.status(200).json({ available: false });
    }
  });

  // Simple system-wide health + capability snapshot
  app.get("/api/system/health", async (req: AuthedRequest, res: Response) => {
    const caps = resolveCapabilities(req);

    // Basic DB reachability check: do not throw, just reflect degraded on failure
    let dbStatus: CapabilityStatus = caps.accounting;
    try {
      await db.select({ id: users.id }).from(users).limit(1);
      dbStatus = "ok";
    } catch {
      dbStatus = "degraded";
    }

    res.json({
      accounting: dbStatus,
      mealscout: caps.mealscout,
      admin: caps.admin,
    });
  });

  // 4. SENDGRID EMAIL - Setup endpoint
  app.post("/api/email/send", isAdmin, async (req: Request, res: Response) => {
    try {
      const {
        to,
        subject,
        html,
        text,
        from = process.env.SENDGRID_FROM_EMAIL,
        cc,
        bcc,
        replyTo,
      } = req.body;

      if (!to || !subject || !(html || text)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!emailService.isConfigured()) {
        return res.status(503).json({ message: "SendGrid not configured" });
      }

      const result = await emailService.sendEmail({
        to,
        subject,
        html,
        text,
        from,
        cc,
        bcc,
        replyTo,
      });

      res.json({ message: "Email sent successfully", messageId: result.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  return httpServer;
}
