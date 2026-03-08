/* eslint-disable @typescript-eslint/no-explicit-any -- Legacy route module ingests dynamic JSON across many endpoints; incremental hardening tracked separately. */
import scoutRoute from "./routes/scout";
import { ClaimSource, ClaimType } from "./services/claimEventSchema";
import { logger } from "./services/logger";
import { ingestKnowledgeFolder } from "./services/knowledgeIngest";
import express from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { generateGeminiTextWithFallback } from "./ai/geminiFallback";
import { detectImportDelimiter, parseDelimitedImport } from "./utils/adminBusinessImportParser";
import { parseXlsxImport } from "./utils/adminBusinessImportXlsx";
import { contractorSignupRouter } from "./routes/contractor-signup";
import { businessesRouter } from "./routes/businesses";
import { businessDirectoryPublicRouter } from "./routes/business-directory-public";
import { cityPublicRouter } from "./routes/city-public";
import { profilesRouter } from "./routes/profiles";
import { datasetsPublicRouter } from "./routes/datasets-public";
import { propertyProgramsRouter } from "./routes/property-programs";
import { homesRouter } from "./routes/homes";
import { vehiclesRouter } from "./routes/vehicles";
import { metalsRouter } from "./routes/metals";
import { registerRecommendationGeneratorRoutes } from "./routes/recommendation-generator";
import { registerNotificationRoutes } from "./routes/notification-routes";
import { registerDirectConnectRoutes } from "./routes/direct-connect";
import { registerEmploymentRoutes } from "./routes/employment";
import { registerIdentityVerificationRoutes } from "./routes/identity-verification";
import { registerObjectivesRoutes } from "./routes/objectives";
import { registerBusinessProfileRoutes } from "./routes/business-profile";
import { registerBusinessContactRoutes } from "./routes/business-contact";
import { registerAnalyticsRoutes } from "./routes/analytics-routes";
import { registerHardrockRoutes } from "./routes/hardrock";
import { registerCommercialDirectoryRoutes } from "./routes/commercial-directory";
import { registerScoutFittersRoutes } from "./routes/scoutfitters";
import { geographicCoverageRouter } from "./routes/geographic-coverage";
import { registerCrmRoutes } from "./crm-routes";
import { registerAICodeFixRoutes } from "./ai-code-fixes";
import { registerUIIssuesRoutes } from "./routes/admin/ui-issues";
import { setupModerationRoutes, setupAdminModerationRoutes } from "./moderation";
import { registerSocialRoutes } from "./social-routes";
import { registerSocialFeatures } from "./social-features";
import { registerScoutRecommendations } from "./routes/scout-recommendations";
import communityBuilderRouter from "./routes/community-builder-routes";
import adminCommunityBuilderRouter from "./routes/admin-community-builder-routes";
import communityVaultRouter from "./routes/community-vault-routes";
import communityCausesRouter from "./routes/community-causes-routes";
import platformSupportRouter from "./routes/platform-support-routes";
import legalNotaryRouter from "./routes/legal-notary-routes";
import { mountAdminRoutes } from "./routes/admin";
import missionControlRouter from "./routes/mission-control";
import preferredSourceRouter from "./routes/preferred-source";
import { registerAuthorityOperationsRoutes } from "./routes/authority-operations";
import tradePartnerLandingRouter from "./routes/tradepartner-landing";
import partnerInterestRouter from "./routes/partner-interest";
import { ROLE_PERMISSIONS, type UserRole as SharedUserRole } from "../shared/roles";
import { COMPREHENSIVE_TRADES } from "../shared/trades-data";
import { CURRENT_PROFILE_VERSION } from "../shared/profile";
import { sendAutoClassifiedError } from "./utils/httpErrors";
import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";
import { ensureSuperAdminConnectionForUser } from "./utils/superAdminConnection";
import {
  getComputedProviderEligibilitiesForUser,
  getEligibilityDecisionForCounty,
} from "./providerEligibility";
// DISABLED: WebSocketManager is not instantiated, using Socket.io messaging service instead
// import { WebSocketManager } from "./websocket";
import { getMessagingService } from "./messaging-service";
import { emailService } from "./services/emailService";
import { passwordResetService } from "./services/passwordResetService";
import { emailVerificationService } from "./services/emailVerificationService";
import { computeVerificationRequirements } from "./services/profileVerificationService";
import { logAdminAction } from "./services/adminAuditLogService";
import { createServer } from "http";
import { requireAddressVerification } from "./requireAddressVerification";
import { checkTrustedDevice } from "./device-auth";
import {
  addPropertyLifecycleEvent,
  requirePropertyProgramAccess,
} from "./services/propertyLifecycleService";
import {
  users,
  userRoleEnum,
  businesses,
  affiliateAccounts,
  affiliateReferrals,
  affiliateShareLinks,
  affiliateTrafficEvents,
  generatedStories,
  leads,
  quotes,
  conversations,
  foundationCauses,
  marketplaceListings,
  professionalPartnerships,
  countyNotes,
  builderContributions,
  builderReferrals,
  communityPosts,
  communityPostSaves,
  postComments,
  recommendations,
  contractors,
  contractorTrades,
  trades,
  workers,
  workerReviews,
  tasks,
  taskApplications,
  workRequests,
  workRequestEvents,
  workRequestAssignments,
  addressVerifications,
  listingImportStaging,
  insertRealtorProfileSchema,
  insertCarSalesmanProfileSchema,
  insertGeneratedStorySchema,
  insertLeadSchema,
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
  userProfiles,
  profiles,
  businessCounties,
  // Home Vault + Property Lifecycle OS (used by intent-gated home report sharing in messages)
  homeReportShares,
  userHomes,
  userHomeRecords,
  userHomeAppliances,
  userHomeDocuments,
  homeMaintenanceSchedules,
  homeProjects,
  homeProjectPlans,
  propertyPrograms,
  propertyHomefaxSnapshots,
} from "../shared/schema";

function sanitizeContractorPublic<T extends Record<string, any>>(
  contractor: T
): Omit<T, "phone" | "email"> {
  if (!contractor || typeof contractor !== "object") return contractor as any;
  const { phone, email, ...rest } = contractor as any;
  void phone;
  void email;
  return rest;
}
import { getUserTypeBadgeLabel, getUserTypeMetadata } from "../shared/userTypes";
import { storage } from "./storage";
import {
  setupAuth,
  isAuthenticated,
  isAdmin,
  isStaff,
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
import { db, pool } from "./db";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { createPostgresRateLimitStore } from "./utils/postgresRateLimitStore";
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
import { resolveCapabilities, type CapabilityStatus } from "./capabilities";
import {
  evaluateNotaryPaidRemoteGate,
  normalizeProfileBookingPrefs,
  toPublicProfileBookingPrefs,
} from "./services/profileBookingService";
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
import { eq, ne, desc, and, or, sql, gt, gte, lte, asc, inArray, isNull } from "drizzle-orm";
// Removed duplicate User import
// Stubs for undeclared globals
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

  // Best-effort fallback so links are not "localhost" in production when env isn't set.
  // Note: if your API is on a different domain than your frontend, set PUBLIC_WEB_URL.
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

type StaffShareableTemplate = {
  id: string;
  title: string;
  path: string;
  description: string;
  recommendedFor: string;
  useCase: string;
  funnelStage: "awareness" | "consideration" | "conversion" | "retention";
  requiresAuth: boolean;
};

const STAFF_SHAREABLE_LINK_TEMPLATES: StaffShareableTemplate[] = [
  {
    id: "landing-primary",
    title: "Landing Page (Primary)",
    path: "/landing",
    description: "Best first click for cold traffic and first-time visitors.",
    recommendedFor: "Video links, social posts, website bio links",
    useCase: "Introduce TradeScout quickly and route users into the right next step.",
    funnelStage: "awareness",
    requiresAuth: false,
  },
  {
    id: "setup-create",
    title: "Create Account",
    path: "/pre-scout-setup?mode=create",
    description: "Takes new users directly into account creation.",
    recommendedFor: "Warm traffic ready to join now",
    useCase: "Reduce friction when the CTA is clearly 'join today'.",
    funnelStage: "conversion",
    requiresAuth: false,
  },
  {
    id: "setup-signin",
    title: "Sign In",
    path: "/pre-scout-setup?mode=signin",
    description: "Direct sign-in path for existing members.",
    recommendedFor: "Email follow-ups, returning members",
    useCase: "Recover existing users who already have an account.",
    funnelStage: "retention",
    requiresAuth: false,
  },
  {
    id: "how-it-works",
    title: "How It Works",
    path: "/how-it-works",
    description: "Clear explanation page for the Trust-first workflow.",
    recommendedFor: "Prospects asking 'how is this different?'",
    useCase: "Educational midpoint before asking for signup.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "trust-model",
    title: "Trust Model",
    path: "/trust-model",
    description: "Detailed trust logic and why pay-to-play is blocked.",
    recommendedFor: "Skeptical prospects and partner conversations",
    useCase: "Build credibility before conversion.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-root",
    title: "Compare TradeScout",
    path: "/compare",
    description: "Top-level compare hub for TradeScout vs intermediary platforms.",
    recommendedFor: "Users searching for alternatives across categories",
    useCase: "Route category intent to the right compare spoke.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-angi",
    title: "Compare vs Angi",
    path: "/compare/angi",
    description: "Positioning page against Angi pain points.",
    recommendedFor: "Users who mention Angi",
    useCase: "Competitive replacement messaging.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-home-services",
    title: "Compare vs Home Services Platforms",
    path: "/compare/home-services",
    description: "Category compare page for contractor marketplaces and lead platforms.",
    recommendedFor: "Users comparing TradeScout to home-service intermediaries",
    useCase: "Category-level replacement messaging for home services.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-real-estate",
    title: "Compare vs Real Estate Platforms",
    path: "/compare/real-estate",
    description: "Category compare page for listing and real-estate discovery platforms.",
    recommendedFor: "Users comparing TradeScout to Zillow, Realtor.com, and similar portals",
    useCase: "Explain the operating-system difference in real-estate flows.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-community",
    title: "Compare vs Community Platforms",
    path: "/compare/community",
    description: "Category compare page for neighborhood feeds and community apps.",
    recommendedFor: "Users comparing TradeScout to Nextdoor or local social groups",
    useCase: "Explain community memory and authority-first interaction.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-local-business",
    title: "Compare vs Local Business Discovery",
    path: "/compare/local-business",
    description: "Category compare page for local directories and review surfaces.",
    recommendedFor: "Users comparing TradeScout to Yelp or business discovery platforms",
    useCase: "Explain why visibility is not the whole product.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-coordination",
    title: "Compare vs Coordination Tools",
    path: "/compare/coordination",
    description: "Category compare page for task, booking, and coordination platforms.",
    recommendedFor: "Users comparing TradeScout to gig boards or scheduling tools",
    useCase: "Explain why coordination alone is not a community operating system.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-lead-generation",
    title: "Compare vs Lead Generation",
    path: "/compare/lead-generation",
    description: "Category positioning page against lead-generation contractor platforms.",
    recommendedFor: "Users comparing TradeScout to lead marketplaces or directories",
    useCase: "Category-level replacement messaging before exact competitor pages.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "compare-homeadvisor",
    title: "Compare vs HomeAdvisor",
    path: "/compare/homeadvisor",
    description: "Positioning page against HomeAdvisor pain points.",
    recommendedFor: "Users who mention HomeAdvisor",
    useCase: "Competitive replacement messaging.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "pricing",
    title: "Pricing",
    path: "/pricing",
    description: "Transparent pricing page and platform economics.",
    recommendedFor: "Price-sensitive prospects",
    useCase: "Answer cost objections quickly.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "exchange",
    title: "Exchange",
    path: "/exchange",
    description: "Marketplace and offers experience.",
    recommendedFor: "Users looking for active opportunities",
    useCase: "Drive high-intent traffic into monetizable surfaces.",
    funnelStage: "conversion",
    requiresAuth: false,
  },
  {
    id: "direct-connect",
    title: "Direct Connect",
    path: "/direct-connect",
    description: "Intent-gated connection flow between residents and pros.",
    recommendedFor: "Users ready to request work",
    useCase: "Convert immediate project intent into qualified routing.",
    funnelStage: "conversion",
    requiresAuth: false,
  },
  {
    id: "contractors",
    title: "Contractor Directory",
    path: "/contractors",
    description: "Browse verified contractors by locality and trade.",
    recommendedFor: "Discovery-focused homeowners",
    useCase: "Directory discovery before direct request submission.",
    funnelStage: "consideration",
    requiresAuth: false,
  },
  {
    id: "county-directory",
    title: "County Directory",
    path: "/county-directory",
    description: "County-first entry point into local ecosystem pages.",
    recommendedFor: "Local campaigns and geo-targeted content",
    useCase: "Route users to county-specific discovery.",
    funnelStage: "awareness",
    requiresAuth: false,
  },
  {
    id: "community",
    title: "Community Feed",
    path: "/community",
    description: "Read-only global view, with local action remaining gated.",
    recommendedFor: "Community-minded prospects",
    useCase: "Show local signal density and social proof.",
    funnelStage: "awareness",
    requiresAuth: false,
  },
];

const STAFF_SHAREABLE_TRADE_TEMPLATES: StaffShareableTemplate[] = COMPREHENSIVE_TRADES.map(
  (trade) => ({
    id: `landing-trade-${trade.slug}`,
    title: `${trade.name} Landing Page`,
    path: `/landing/${trade.slug}`,
    description: `Hyper-specific landing page for ${trade.name.toLowerCase()} audiences.`,
    recommendedFor: `${trade.name} videos, posts, and trade-targeted campaigns`,
    useCase:
      "Send trade-specific traffic to matching language and CTA flow while preserving affiliate attribution.",
    funnelStage: "awareness" as const,
    requiresAuth: false,
  })
);

const STAFF_SHAREABLE_AUDIENCE_LANDING_TEMPLATES: Array<{
  key: string;
  label: string;
  recommendedFor: string;
}> = [
  { key: "contractor", label: "Contractors", recommendedFor: "Trade pro campaigns" },
  { key: "homeowner", label: "Homeowners", recommendedFor: "Residential buyer campaigns" },
  { key: "realtor", label: "Realtors", recommendedFor: "Real estate agent campaigns" },
  { key: "hoa", label: "HOA Teams", recommendedFor: "Board and manager campaigns" },
  {
    key: "property-manager",
    label: "Property Managers",
    recommendedFor: "Multi-property campaigns",
  },
  { key: "lender", label: "Lenders", recommendedFor: "Finance partner campaigns" },
  { key: "insurance-agent", label: "Insurance Agents", recommendedFor: "Claims-support campaigns" },
  { key: "supplier", label: "Suppliers", recommendedFor: "Vendor and supplier campaigns" },
  { key: "affiliate", label: "Affiliates", recommendedFor: "Creator and partner campaigns" },
];

const STAFF_SHAREABLE_AUDIENCE_TEMPLATES: StaffShareableTemplate[] =
  STAFF_SHAREABLE_AUDIENCE_LANDING_TEMPLATES.map((audience) => ({
    id: `landing-audience-${audience.key}`,
    title: `${audience.label} Landing Page`,
    path: `/landing/${audience.key}`,
    description: `Audience-specific landing page tuned for ${audience.label.toLowerCase()}.`,
    recommendedFor: audience.recommendedFor,
    useCase: "Message-match landing for role-specific campaigns.",
    funnelStage: "awareness",
    requiresAuth: false,
  }));

const STAFF_SHAREABLE_AUDIENCE_TRADE_TEMPLATES: StaffShareableTemplate[] =
  STAFF_SHAREABLE_AUDIENCE_LANDING_TEMPLATES.flatMap((audience) =>
    COMPREHENSIVE_TRADES.map((trade) => ({
      id: `landing-${audience.key}-${trade.slug}`,
      title: `${audience.label} • ${trade.name}`,
      path: `/landing/${audience.key}-${trade.slug}`,
      description: `${audience.label} landing page customized for ${trade.name.toLowerCase()} intent.`,
      recommendedFor: `${audience.recommendedFor}; ${trade.name} campaign videos and posts`,
      useCase: "Hyper-specific share link for role + trade intent with affiliate attribution.",
      funnelStage: "awareness" as const,
      requiresAuth: false,
    }))
  );

const sanitizeNextPath = (value: unknown): string => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!raw.startsWith("/")) return "";
  if (raw.startsWith("//")) return "";
  return raw;
};

const maybeSendEmailVerificationForUser = async (req: Request, user: any): Promise<void> => {
  try {
    const emailVerificationRequired = await getGeneralSetting<boolean>(
      "email_verification_required",
      true
    );
    if (!emailVerificationRequired) return;

    const userId = String(user?.id || user?.claims?.sub || "");
    const email = String(user?.email || "")
      .trim()
      .toLowerCase();
    if (!userId || !email) return;
    if (user?.emailVerified === true) return;

    const sessionAny = req.session as any;
    const key = `emailVerification:lastSentAt:${userId}`;
    const now = Date.now();
    const lastSentAt = Number(sessionAny?.[key] || 0);
    if (Number.isFinite(lastSentAt) && lastSentAt > 0 && now - lastSentAt < 10 * 60 * 1000) {
      return;
    }

    // Mark before sending to prevent rapid re-sends if the provider is slow/failing.
    sessionAny[key] = now;

    const { token, expiresAt } = emailVerificationService.createToken(userId);
    const verifyBase = getPublicBaseUrlFromRequest(req);
    const next = sanitizeNextPath((req.session as any)?.oauthNext) || "/pre-scout-setup";
    const verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${token}&next=${encodeURIComponent(next)}`;

    await emailService.sendEmail({
      to: email,
      subject: "Verify your TradeScout email",
      html: `<p><a href="${verifyLink}">Verify your email address</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>`,
      text: `Verify your TradeScout email: ${verifyLink}`,
      purpose: "email_verification",
    });
  } catch (error) {
    console.error("[email-verification] Maybe-send failed:", error);
  }
};
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
    const { county, trade, city, state, maxAssignees } = leadData;
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
  const buildRevision =
    process.env.RENDER_GIT_COMMIT ||
    process.env.SOURCE_VERSION ||
    process.env.GIT_COMMIT ||
    "unknown";

  // Setup authentication
  await setupAuth(app);

  // Emit build identity on every API response so production log/debug
  // can confirm which revision is actually serving traffic.
  app.use((req: any, res: any, next: any) => {
    if (typeof req?.path === "string" && req.path.startsWith("/api/")) {
      res.setHeader("X-TradeScout-Build", buildRevision);
    }
    next();
  });

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
      buildRevision,
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

  const limiterStore = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix: `rl:${prefix}`,
      // Best-effort cleanup; safe to run on multiple instances.
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
    });

  const loginLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: "Too many login attempts, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        store: limiterStore("login"),
      })
    : noopRateLimiter;

  const passwordResetLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5,
        message: "Too many reset requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        store: limiterStore("password_reset"),
      })
    : noopRateLimiter;

  const emailVerificationLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10,
        message: "Too many verification requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        store: limiterStore("email_verify"),
      })
    : noopRateLimiter;

  const aiLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 60,
        message: "Too many AI requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        store: limiterStore("ai"),
      })
    : noopRateLimiter;

  const rateLimitKey = (req: any) => {
    const userId = req?.user?.claims?.sub || req?.user?.id;
    if (userId) return `u:${userId}`;
    const email =
      typeof req?.body?.email === "string" ? String(req.body.email).trim().toLowerCase() : "";
    if (email) return `ip:${req.ip}|e:${email}`;
    return req.ip;
  };

  const registerLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5,
        message: "Too many registration attempts, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("register"),
      })
    : noopRateLimiter;

  const contractorSearchLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60,
        message: "Too many search requests, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("contractor_search"),
      })
    : noopRateLimiter;

  const marketplaceSearchLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60,
        message: "Too many search requests, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("marketplace_search"),
      })
    : noopRateLimiter;

  const homeScoutSearchLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60,
        message: "Too many HomeScout searches, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("homescout_search"),
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

    const normalizeRole = (role: unknown): string => {
      const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
      if (!raw) return "";
      return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
    };

    const rolesRaw = Array.from(
      new Set(
        [...(Array.isArray(user?.roles) ? user.roles : []), user?.role, user?.activeRole].filter(
          Boolean
        )
      )
    );
    const roles = rolesRaw
      .map((r: any) => normalizeRole(r))
      .filter((r: string): r is SharedUserRole => Boolean(r)) as SharedUserRole[];
    const primaryRole: SharedUserRole | undefined = roles[0];
    const normalizedPrimaryRole = normalizeRole(user?.role);
    const normalizedActiveRole = normalizeRole(user?.activeRole);

    const basePermissions = primaryRole ? ROLE_PERMISSIONS[primaryRole] : undefined;

    const computedIsAdmin =
      user.isAdmin === true ||
      ["super_admin", "moderator", "ops_admin"].includes(normalizedPrimaryRole) ||
      ["super_admin", "moderator", "ops_admin"].includes(normalizedActiveRole) ||
      Boolean(
        basePermissions?.canAccessAdminPanel ||
        basePermissions?.canAccessSuperAdmin ||
        roles.some((role) => ["moderator", "ops_admin", "super_admin"].includes(role))
      );

    const computedIsSuperAdmin =
      user.isSuperAdmin === true ||
      normalizedPrimaryRole === "super_admin" ||
      normalizedActiveRole === "super_admin" ||
      roles.some((role) => role === "super_admin");

    const adminAliasEmails = new Set<string>([
      String(process.env.MASTER_ADMIN_EMAIL || "")
        .trim()
        .toLowerCase(),
      ...String(process.env.SUPER_ADMIN_EMAIL_ALIASES || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
      "info.tradescout@gmail.com",
      "contact@thetradescout.com",
    ]);
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

    const rawThemePreference =
      typeof user?.themePreference === "string" ? user.themePreference : "";
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
      // Guard against legacy/synthetic theme IDs leaking into persisted preferences.
      // The app derives "profile-*" appearance from `preferences.colorScheme`, not from themePreference.
      themePreference: normalizedThemePreference || user?.themePreference,
      stateCode: hasCanonicalLocation ? canonicalStateCode : (user as any).stateCode,
      countyFips: hasCanonicalLocation ? canonicalCountyFips : (user as any).countyFips,
      // Canonical flag for whether this account has a committed
      // county-level location. All UX prompts should key off this,
      // not off ad-hoc context checks.
      locationCommitted: hasCanonicalLocation,
      profileVersion:
        typeof (user as any).profileVersion === "number" ? (user as any).profileVersion : 0,
      password: undefined,
    };
  };

  type UserRoleEnumValue = (typeof userRoleEnum.enumValues)[number];
  const USER_ROLE_ENUM_VALUES = new Set<string>(userRoleEnum.enumValues as readonly string[]);
  const BLOCKED_SELF_ASSIGN_ROLES = new Set<string>([
    // Never user-asserted; must be granted via admin workflows.
    "admin",
    "moderator",
    "ops_admin",
    "super_admin",
    // Internal/system roles (not selectable)
    "content_seo",
    "analytics_specialist",
    "marketing_specialist",
  ]);

  const PERSONA_TO_CANONICAL_ROUTING_ROLE: Record<string, UserRoleEnumValue> = {
    restaurant_owner: "business_owner",
    food_truck_owner: "business_owner",
    bar_owner: "business_owner",
    vehicle_dealer: "car_dealer",
    car_salesman: "car_dealer",
    contractor_user: "contractor",
    helper: "handyman",
    hoa_admin: "hoa_board",
  };

  const coerceToRoutingRoleEnum = (candidate: unknown): UserRoleEnumValue => {
    const raw = typeof candidate === "string" ? candidate.trim() : "";
    if (!raw) return "homeowner";

    const viaAlias = PERSONA_TO_CANONICAL_ROUTING_ROLE[raw];
    if (viaAlias) return viaAlias;

    if (USER_ROLE_ENUM_VALUES.has(raw) && !BLOCKED_SELF_ASSIGN_ROLES.has(raw)) {
      return raw as UserRoleEnumValue;
    }

    return "homeowner";
  };

  const dedupeStrings = (values: string[]) =>
    Array.from(new Set(values.map((v) => String(v || "").trim()).filter((v) => v.length > 0)));

  // Authentication routes
  const handleLocalLogin = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        const rawMessage = typeof info?.message === "string" ? info.message.trim() : "";
        const lowered = rawMessage.toLowerCase();
        let message = rawMessage || "Login failed";

        if (!message || lowered.includes("missing credentials")) {
          message = "Email and password are required";
        }

        const infoCode = typeof info?.code === "string" ? info.code.trim() : "";
        let code = infoCode;
        if (!code) {
          if (lowered.includes("no account") || lowered.includes("account not found")) {
            code = "AUTH_NO_ACCOUNT";
          } else if (
            lowered.includes("incorrect password") ||
            lowered.includes("invalid password")
          ) {
            code = "AUTH_INCORRECT_PASSWORD";
          } else if (lowered.includes("required")) {
            code = "AUTH_MISSING_FIELDS";
          } else if (lowered.includes("social login") || lowered.includes("google/facebook")) {
            code = "AUTH_SOCIAL_ONLY";
          } else {
            code = "AUTH_INVALID_CREDENTIALS";
          }
        }

        return res.status(401).json({
          message,
          code,
        });
      }
      req.logIn(user, (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        const completeLogin = () =>
          res.json({ user: sanitizeUserForResponse(req.user), message: "Login successful" });

        // Ensure session persistence before responding to avoid
        // immediate logged-out state on the next auth check request.
        if (req.session) {
          return req.session.save((saveErr: any) => {
            if (saveErr) return next(saveErr);
            return completeLogin();
          });
        }

        return completeLogin();
      });
    })(req, res, next);
  };

  // Backward compatibility: allow both /auth/login and /api/auth/login
  app.post("/auth/login", loginLimiter, handleLocalLogin);
  app.post("/api/auth/login", loginLimiter, handleLocalLogin);

  // New multi-profile registration handler (wizard flow)
  const handleRegisterMultiProfile = async (req: Request, res: Response) => {
    try {
      const registrationEnabled = await getGeneralSetting<boolean>("registration_enabled", true);
      if (!registrationEnabled) {
        return res.status(403).json({ message: "Registration is currently disabled" });
      }

      const emailVerificationRequired = await getGeneralSetting<boolean>(
        "email_verification_required",
        true
      );

      const body = (req.body || {}) as any;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const acceptTerms =
        body.acceptTerms === true ||
        body.agreeToTerms === true ||
        body.termsAccepted === true ||
        body.acceptedTerms === true;
      const profilesData = Array.isArray(body.profiles) ? body.profiles : [];

      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!password) return res.status(400).json({ message: "Password is required" });
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      if (!firstName) return res.status(400).json({ message: "First name is required" });
      if (!lastName) return res.status(400).json({ message: "Last name is required" });
      if (!phone) return res.status(400).json({ message: "Phone number is required" });
      if (phone.replace(/\D/g, "").length < 10) {
        return res.status(400).json({ message: "Please enter a valid phone number" });
      }
      if (!acceptTerms) {
        return res.status(400).json({ message: "You must accept the Terms of Service" });
      }
      if (profilesData.length === 0) {
        return res.status(400).json({ message: "Create at least one profile" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      type ProfileRole = "homeowner" | "business_owner" | "contractor";
      type UserIntent = "person" | "business";
      type BusinessType = "service_provider" | "seller";
      type SellerType = "physical" | "online" | "hybrid";
      type NormalizedProfile = {
        userIntent: UserIntent;
        businessType: BusinessType | null;
        serviceTags: string[];
        sellerTags: string[];
        sellerType: SellerType | null;
        role: ProfileRole;
        roles: ProfileRole[];
        verificationRequirements: Awaited<ReturnType<typeof computeVerificationRequirements>>;
      };

      const normalizeTag = (value: unknown): string | null => {
        if (typeof value !== "string") return null;
        const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
        if (!normalized || !/^[a-z0-9_-]{2,64}$/.test(normalized)) return null;
        return normalized;
      };

      const normalizeTagArray = (value: unknown, maxItems = 24): string[] => {
        if (!Array.isArray(value)) return [];
        const out: string[] = [];
        for (const item of value) {
          const normalized = normalizeTag(item);
          if (!normalized) continue;
          if (!out.includes(normalized)) out.push(normalized);
          if (out.length >= maxItems) break;
        }
        return out;
      };

      const normalizedProfiles: NormalizedProfile[] = [];
      for (const rawProfile of profilesData) {
        const input = (rawProfile || {}) as Record<string, unknown>;
        const rawIntent = typeof input.userIntent === "string" ? input.userIntent : "";
        const userIntent = rawIntent === "person" || rawIntent === "business" ? rawIntent : null;
        if (!userIntent) {
          return res.status(400).json({ message: "Invalid user intent" });
        }

        const rawBusinessType =
          typeof input.businessType === "string" ? input.businessType : undefined;
        const businessType: BusinessType | null =
          rawBusinessType === "service_provider" || rawBusinessType === "seller"
            ? rawBusinessType
            : null;

        if (userIntent === "business" && !businessType) {
          return res.status(400).json({ message: "Business type required for business profiles" });
        }

        const serviceTags = normalizeTagArray(input.serviceTags);
        const sellerTags = normalizeTagArray(input.sellerTags);

        if (
          userIntent === "business" &&
          businessType === "service_provider" &&
          serviceTags.length === 0
        ) {
          return res.status(400).json({ message: "Select at least one service type" });
        }
        if (userIntent === "business" && businessType === "seller" && sellerTags.length === 0) {
          return res.status(400).json({ message: "Select at least one seller type" });
        }

        const rawSellerType = typeof input.sellerType === "string" ? input.sellerType : "";
        const sellerType: SellerType | null =
          rawSellerType === "physical" || rawSellerType === "online" || rawSellerType === "hybrid"
            ? rawSellerType
            : null;

        const role: ProfileRole =
          userIntent === "person"
            ? "homeowner"
            : businessType === "service_provider"
              ? "contractor"
              : "business_owner";
        const roles: ProfileRole[] =
          role === "contractor" ? ["contractor", "business_owner"] : [role];

        const verificationRequirements = await computeVerificationRequirements(
          userIntent,
          businessType || undefined,
          serviceTags,
          sellerTags,
          undefined
        );

        normalizedProfiles.push({
          userIntent,
          businessType,
          serviceTags,
          sellerTags,
          sellerType: businessType === "seller" ? sellerType : null,
          role,
          roles,
          verificationRequirements,
        });
      }

      const firstProfileTemplate = normalizedProfiles[0];
      const hashedPassword = await hashPassword(password);

      const created = await db.transaction(async (tx: any) => {
        const [createdUser] = await tx
          .insert(users)
          .values({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: firstProfileTemplate.role,
            roles: firstProfileTemplate.roles,
            activeRole: firstProfileTemplate.role,
            profileVisibility: "private",
            verifiedBadge: false,
            trustScore: 10,
            emailVerified: emailVerificationRequired ? false : true,
            addressVerified: false,
            verificationStatus: "pending",
          })
          .returning();

        const createdProfiles: any[] = [];
        for (let i = 0; i < normalizedProfiles.length; i++) {
          const profileTemplate = normalizedProfiles[i];
          const [createdProfile] = await tx
            .insert(userProfiles)
            .values({
              userId: createdUser.id,
              userIntent: profileTemplate.userIntent,
              businessType: profileTemplate.businessType,
              serviceTags: profileTemplate.serviceTags,
              sellerTags: profileTemplate.sellerTags,
              sellerType: profileTemplate.sellerType,
              role: profileTemplate.role,
              roles: profileTemplate.roles,
              profileVisibility: "private",
              verifiedBadge: false,
              trustScore: 10,
              isPrimary: i === 0,
              verificationRequirements: profileTemplate.verificationRequirements,
              verificationStatus: "pending",
              email_verified: emailVerificationRequired ? false : true,
              address_verified: false,
            })
            .returning();

          createdProfiles.push(createdProfile);
        }

        const firstCreatedProfile = createdProfiles[0];
        const [updatedUser] = await tx
          .update(users)
          .set({
            role: firstCreatedProfile.role,
            roles: firstCreatedProfile.roles,
            activeRole: firstCreatedProfile.role,
            activeProfileId: firstCreatedProfile.id,
            updatedAt: new Date(),
          })
          .where(eq(users.id, createdUser.id))
          .returning();

        return {
          user: updatedUser || createdUser,
          profiles: createdProfiles,
        };
      });

      const firstProfile = created.profiles[0];
      let emailVerificationSent = false;
      let verificationToken: string | undefined;

      if (emailVerificationRequired) {
        const { token, expiresAt } = emailVerificationService.createToken(created.user.id);
        const verifyBase = getPublicBaseUrlFromRequest(req);
        const next = "/pre-scout-setup";
        const verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${token}&next=${encodeURIComponent(next)}`;

        try {
          await emailService.sendEmail({
            to: email,
            subject: "Verify your TradeScout email",
            html: `<p>Thanks for joining TradeScout.</p>
                 <p><a href="${verifyLink}">Verify your email address</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>`,
            text: `Verify your TradeScout email: ${verifyLink}`,
            purpose: "account_creation",
          });
          emailVerificationSent = true;
        } catch (error) {
          console.error("[email-verification] Failed to send verification email:", error);
        }

        if (!emailService.isConfigured() && process.env.NODE_ENV !== "production") {
          verificationToken = token;
        }
      }

      req.login(created.user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }

        return res.json({
          user: sanitizeUserForResponse(created.user),
          profiles: created.profiles.map((p) => ({
            id: p.id,
            role: p.role,
            userIntent: p.userIntent,
            businessType: p.businessType,
          })),
          activeProfileId: firstProfile.id,
          emailVerificationRequired,
          emailVerificationSent,
          ...(verificationToken ? { verificationToken } : {}),
        });
      });
    } catch (error: any) {
      console.error("Multi-profile registration error:", error);
      sendAutoClassifiedError(res, error, "Registration failed", {});
    }
  };

  const handleRegister = async (req: Request, res: Response) => {
    try {
      const registrationEnabled = await getGeneralSetting<boolean>("registration_enabled", true);
      if (!registrationEnabled) {
        return res.status(403).json({ message: "Registration is currently disabled" });
      }

      const emailVerificationRequired = await getGeneralSetting<boolean>(
        "email_verification_required",
        true
      );

      const body = (req.body || {}) as any;
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const address = typeof body.address === "string" ? body.address.trim() : undefined;
      const city = typeof body.city === "string" ? body.city.trim() : undefined;
      const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : undefined;

      // Legacy fields (still accepted for backwards compatibility)
      const state = typeof body.state === "string" ? body.state.trim() : undefined;
      const county = typeof body.county === "string" ? body.county.trim() : undefined;

      // Canonical location fields (preferred)
      const stateCode = typeof body.stateCode === "string" ? body.stateCode.trim() : state;
      const countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : undefined;
      const countyName = typeof body.countyName === "string" ? body.countyName.trim() : county;

      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const claimBusinessId =
        typeof body.claimBusinessId === "string" ? body.claimBusinessId.trim() : "";
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
        if (role === "helper") return "handyman";
        if (role === "hoa_admin") return "hoa_board";
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

      // Claim-first: claiming a business during signup implies business-owner context.
      if (claimBusinessId && !userTypes.includes("business_owner")) {
        userTypes.unshift("business_owner");
      }

      // Never allow public registration to self-assign admin/system roles.
      if (userTypes.some((r: string) => BLOCKED_SELF_ASSIGN_ROLES.has(r))) {
        return res.status(400).json({
          message: "Invalid role selection. Admin accounts must be created by an admin.",
        });
      }

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

      // Referral attribution (cookie-first) — best-effort, never blocks signup.
      const referralCodeFromCookie = getCookieValue(req, "ts_ref");

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

      // Verification is never user-asserted at registration time.
      // It must be granted by verification workflows (insurance/license/address, admin review, etc).
      const status = "pending";

      // Determine primary role from user types
      // CLAIM-FIRST: Default to 'homeowner' if no types selected (neutral starting point)
      const provisionalRoles = dedupeStrings(userTypes || []).filter(
        (r) => !BLOCKED_SELF_ASSIGN_ROLES.has(r)
      );

      const primaryRoleCandidate = provisionalRoles.length > 0 ? provisionalRoles[0] : "homeowner";
      const routingRole = coerceToRoutingRoleEnum(primaryRoleCandidate);

      // Keep the canonical routing role first to stabilize permission derivation,
      // while preserving any additional persona tags (even if not in the enum).
      const rolesForDb = dedupeStrings([routingRole, ...provisionalRoles]).filter(
        (r) => !BLOCKED_SELF_ASSIGN_ROLES.has(r)
      );

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
          userTypes: provisionalRoles || [],
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
        city,
        zipCode,
        // Legacy fields (back-compat)
        state,
        county,
        // Canonical machine-readable location fields
        stateCode: stateCode ?? state ?? null,
        countyFips: countyFips ?? null,
        countyName: countyName ?? county ?? null,
        role: routingRole as any, // Canonical routing role (enum-safe)
        roles: rolesForDb, // Canonical first; persona tags preserved after
        activeRole: primaryRoleCandidate, // Preserve the user's selected persona when possible
        emailVerified: emailVerificationRequired ? false : true,
        addressVerified: false,
        verificationStatus: status,
        badges: Array.from(badges),
        preferences,
      });
      let userForLogin: any = user;

      // Optional: claim an admin-imported business during signup (no contact/authority bypass).
      let claim: {
        status: "claimed" | "not_verified" | "not_found" | "already_claimed";
        businessId?: string;
      } | null = null;
      if (claimBusinessId) {
        try {
          const rows = await db
            .select({
              id: businesses.id,
              ownerUserId: businesses.ownerUserId,
              claimStatus: businesses.claimStatus,
              status: businesses.status,
              profileData: businesses.profileData,
            })
            .from(businesses)
            .where(eq(businesses.id, claimBusinessId))
            .limit(1);

          const biz = rows[0] as any;
          if (!biz || biz.status === "suspended") {
            claim = { status: "not_found" };
          } else if (biz.ownerUserId || biz.claimStatus !== "unclaimed") {
            claim = { status: "already_claimed", businessId: biz.id };
          } else {
            const normalizePhone = (value: unknown) => String(value || "").replace(/\D/g, "");
            const signupEmail = String(email || "")
              .trim()
              .toLowerCase();
            const signupPhone = normalizePhone(phone);
            const bizEmail = String(biz.profileData?.email || "")
              .trim()
              .toLowerCase();
            const bizPhone = normalizePhone(biz.profileData?.phone);

            const verifiedByEmail = Boolean(bizEmail) && bizEmail === signupEmail;
            const verifiedByPhone =
              Boolean(bizPhone) && bizPhone.length >= 10 && bizPhone === signupPhone;

            if (!verifiedByEmail && !verifiedByPhone) {
              claim = { status: "not_verified", businessId: biz.id };
            } else {
              await storage.claimUnclaimedBusinessForUser(biz.id, user.id);
              userForLogin = await storage.updateUser(user.id, {
                activeBusinessId: biz.id,
                role: "business_owner" as any,
                activeRole: "business_owner",
                roles: Array.from(new Set([...(userTypes || []), "business_owner"])),
              } as any);
              claim = { status: "claimed", businessId: biz.id };
            }
          }
        } catch {
          claim = { status: "not_verified", businessId: claimBusinessId };
        }
      }

      // Persist ToS acceptance timestamp
      try {
        await dataManagementService.getUserPrivacySettings(user.id);
        await dataManagementService.updateUserPrivacySettings(user.id, {
          termsOfServiceAccepted: new Date(),
        });
      } catch (e) {
        console.error("Failed to persist ToS acceptance:", e);
      }

      let emailVerificationSent = false;
      let verificationToken: string | undefined;
      if (emailVerificationRequired && !user.emailVerified) {
        const { token, expiresAt } = emailVerificationService.createToken(user.id);
        const verifyBase = getPublicBaseUrlFromRequest(req);
        const next = "/pre-scout-setup";
        const verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${token}&next=${encodeURIComponent(next)}`;

        try {
          await emailService.sendEmail({
            to: email,
            subject: "Verify your TradeScout email",
            html: `<p>Thanks for joining TradeScout.</p>
                 <p><a href="${verifyLink}">Verify your email address</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>`,
            text: `Verify your TradeScout email: ${verifyLink}`,
            purpose: "account_creation",
          });
          emailVerificationSent = true;
        } catch (error) {
          console.error("[email-verification] Failed to send verification email:", error);
        }

        if (!emailService.isConfigured() && process.env.NODE_ENV !== "production") {
          verificationToken = token;
        }
      }

      // Automatic community welcome + (optionally) Scout-authored intro post
      await createAutomaticCommunityWelcomeForUser(user, {
        createdViaScout: typeof body.source === "string" && body.source.toLowerCase() === "scout",
      });

      // Convert referral (associate the most recent click with this new user)
      if (referralCodeFromCookie) {
        try {
          await persistLifetimeReferralOwner({
            referredUserId: user.id,
            referralCode: referralCodeFromCookie,
            conversionSource: "signup",
            conversionType: "signup",
            destination: "/create-account",
          });
          await recordReferralClick({
            referralCode: referralCodeFromCookie,
            destination: "/create-account",
            source: "signup",
            conversionType: "signup",
          });
          await storage.convertReferral(referralCodeFromCookie, user.id);
        } catch (err) {
          console.error("[affiliate] Failed to convert referral on signup", err);
        }
      }

      // Auto-login after registration
      req.login(userForLogin, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.json({
          user: sanitizeUserForResponse(userForLogin),
          message: "Registration successful",
          emailVerificationRequired,
          emailVerificationSent,
          ...(verificationToken ? { verificationToken } : {}),
          ...(claim ? { claim } : {}),
        });
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

  // Staff/admin shareable links catalog with affiliate attribution baked in.
  app.get("/api/staff/shareable-links", isAuthenticated, isStaff, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) return res.status(401).json({ message: "User not authenticated" });

      let program = await storage.getAffiliateProgram(userId);
      if (!program) {
        program = await storage.createAffiliateProgram({ userId } as any);
      }

      let referralCode = String((program as any).referralCode || "").trim();
      if (!referralCode) {
        // Server-side repair for legacy rows: missing referralCode is not a client fault.
        referralCode = await storage.generateAffiliateCode(userId);
        try {
          await storage.updateAffiliateProgram(program.id, { referralCode } as any);
        } catch {
          // Best-effort: proceed with generated code even if persistence fails.
        }
      }

      const baseOrigin = getPublicBaseUrlFromRequest(req).replace(/\/$/, "");
      const links = [
        ...STAFF_SHAREABLE_LINK_TEMPLATES,
        ...STAFF_SHAREABLE_AUDIENCE_TEMPLATES,
        ...STAFF_SHAREABLE_TRADE_TEMPLATES,
        ...STAFF_SHAREABLE_AUDIENCE_TRADE_TEMPLATES,
      ].map((template) => {
        const clean = new URL(template.path, baseOrigin);
        const tracked = new URL(clean.toString());
        if (!tracked.searchParams.has("ref")) {
          tracked.searchParams.set("ref", referralCode);
        }

        return {
          ...template,
          cleanUrl: clean.toString(),
          affiliateUrl: tracked.toString(),
        };
      });

      const customLinks = await db
        .select()
        .from(affiliateShareLinks)
        .where(eq(affiliateShareLinks.affiliateId, program.id))
        .orderBy(desc(affiliateShareLinks.createdAt))
        .limit(30);

      res.json({
        referralCode,
        generatedAt: new Date().toISOString(),
        links,
        customLinks: (customLinks || []).map((row: any) => ({
          id: row.id,
          slug: row.friendlySlug,
          description: row.description || "Custom share link",
          destinationUrl: row.fullUrl,
          shortUrl: row.friendlySlug
            ? `${baseOrigin}/r/${encodeURIComponent(String(row.friendlySlug))}`
            : null,
          createdAt: row.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("Error loading staff shareable links:", error);
      res.status(500).json({ message: "Failed to load shareable links" });
    }
  });

  // Custom referral links (short /r/:slug routes)
  app.get("/api/affiliate/share-links", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) return res.status(401).json({ message: "User not authenticated" });

      let program = await storage.getAffiliateProgram(userId);
      if (!program) {
        program = await storage.createAffiliateProgram({ userId } as any);
      }

      const links = await db
        .select()
        .from(affiliateShareLinks)
        .where(eq(affiliateShareLinks.affiliateId, program.id))
        .orderBy(desc(affiliateShareLinks.createdAt))
        .limit(50);

      const baseUrl =
        process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com";

      res.json({
        links: (links || []).map((l: any) => ({
          id: l.id,
          slug: l.friendlySlug,
          description: l.description,
          destinationUrl: l.fullUrl,
          shortUrl: l.friendlySlug
            ? `${baseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(l.friendlySlug)}`
            : null,
          createdAt: l.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("Error listing affiliate share links:", error);
      res.status(500).json({ message: "Failed to list share links" });
    }
  });

  app.post("/api/affiliate/share-links", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) return res.status(401).json({ message: "User not authenticated" });

      const destination =
        typeof req.body?.destination === "string" ? req.body.destination.trim() : "";
      const slugInput = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
      const description =
        typeof req.body?.description === "string" ? req.body.description.trim() : "";

      if (!destination || !destination.startsWith("/")) {
        return res
          .status(400)
          .json({ message: "destination must be a relative path starting with '/'" });
      }

      const safeSlug = slugInput || `link-${Math.random().toString(36).slice(2, 8)}`;
      if (!/^[a-z0-9-]{3,64}$/i.test(safeSlug)) {
        return res
          .status(400)
          .json({ message: "slug must be 3-64 chars (letters, numbers, dash)" });
      }

      let program = await storage.getAffiliateProgram(userId);
      if (!program) {
        program = await storage.createAffiliateProgram({ userId } as any);
      }

      let referralCode = String((program as any).referralCode || "").trim();
      if (!referralCode) {
        // Server-side repair for legacy rows: missing referralCode is not a client fault.
        referralCode = await storage.generateAffiliateCode(userId);
        try {
          await storage.updateAffiliateProgram(program.id, { referralCode } as any);
        } catch {
          // Best-effort: if the update fails, still attempt to proceed with the generated code.
        }
      }

      const baseOrigin = getPublicBaseUrlFromRequest(req).replace(/\/$/, "");
      const full = new URL(destination, baseOrigin);
      if (!full.searchParams.has("ref")) {
        full.searchParams.set("ref", referralCode);
      }

      // Ensure unique slug
      const [existing] = await db
        .select({ id: affiliateShareLinks.id })
        .from(affiliateShareLinks)
        .where(eq(affiliateShareLinks.friendlySlug, safeSlug))
        .limit(1);
      if (existing?.id) {
        return res.status(409).json({ message: "Slug already in use" });
      }

      const [created] = await db
        .insert(affiliateShareLinks)
        .values({
          affiliateId: program.id,
          userId,
          fullUrl: full.toString(),
          friendlySlug: safeSlug,
          description: description || null,
        } as any)
        .returning();

      res.status(201).json({
        id: created.id,
        slug: created.friendlySlug,
        destinationUrl: created.fullUrl,
        shortUrl: `${baseOrigin}/r/${encodeURIComponent(String(created.friendlySlug || safeSlug))}`,
      });
    } catch (error: any) {
      console.error("Error creating affiliate share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  // Public redirect for a share link slug
  app.get("/r/:slug", async (req: any, res: any) => {
    try {
      const slug = typeof req.params?.slug === "string" ? req.params.slug.trim() : "";
      if (!slug) return res.redirect(302, "/");

      const [row] = await db
        .select({
          id: affiliateShareLinks.id,
          fullUrl: affiliateShareLinks.fullUrl,
          affiliateId: affiliateShareLinks.affiliateId,
          referralCode: affiliateAccounts.referralCode,
        })
        .from(affiliateShareLinks)
        .leftJoin(affiliateAccounts, eq(affiliateAccounts.id, affiliateShareLinks.affiliateId))
        .where(eq(affiliateShareLinks.friendlySlug, slug))
        .limit(1);

      if (!row?.id || !row.fullUrl) return res.redirect(302, "/");

      const referralCode = String((row as any).referralCode || "").trim();
      if (referralCode) {
        const existingRef = getCookieValue(req as any, "ts_ref");
        if (!existingRef) {
          setReferralCookie(res, referralCode);
        }
        await recordReferralClick({
          referralCode,
          destination: row.fullUrl,
          source: "share_link",
          conversionType: "click",
        }).catch(() => {});
      }

      // Record traffic event (non-blocking)
      try {
        const ipHeader = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) as
          | string
          | undefined;
        const ipAddress = ipHeader?.split(",")[0]?.trim() || req.ip || null;
        const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
        await db.insert(affiliateTrafficEvents).values({
          shareLinkId: row.id,
          ipAddress,
          userAgent,
          conversionSource: "share_link",
          conversionType: "click",
          conversionsCount: 1,
          computedConversion: false,
        } as any);
      } catch {
        // ignore
      }

      return res.redirect(302, row.fullUrl);
    } catch (error) {
      console.error("Error resolving share link slug:", error);
      return res.redirect(302, "/");
    }
  });

  app.put("/api/affiliate/settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const { payoutMethod, payoutDetails } = (req.body || {}) as {
        payoutMethod?: string;
        payoutDetails?: Record<string, unknown>;
      };
      const updatePayload: Record<string, unknown> = {};
      if (typeof payoutMethod === "string" && payoutMethod.trim()) {
        updatePayload.status = "active";
      }

      const updatedProgram = await storage.updateAffiliateProgram(program.id, updatePayload as any);

      return res.json({
        ...updatedProgram,
        payoutMethod: payoutMethod || null,
        payoutDetails: payoutDetails || null,
      });
    } catch (error: any) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // Backward compatibility: allow both /auth/register and /api/auth/register
  app.post("/auth/register", registerLimiter, handleRegister);
  app.post("/api/auth/register", registerLimiter, handleRegister);

  // New multi-profile registration endpoint (wizard flow)
  // POST /api/auth/register-multi accepts profiles array:
  // [{ userIntent, businessType?, serviceTags?, sellerTags?, sellerType? }]
  // Each verified profile grants discoverable + badge + trust gating (not feature gating)
  app.post("/api/auth/register-multi", registerLimiter, handleRegisterMultiProfile);

  app.post(
    "/api/auth/request-email-verification",
    emailVerificationLimiter,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as any;
        const email = typeof body.email === "string" ? body.email.trim() : "";
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.json({ message: "If an account exists, a verification link has been sent." });
        }

        if (user.emailVerified) {
          return res.json({ message: "Email already verified." });
        }

        const { token, expiresAt } = emailVerificationService.createToken(user.id);
        const verifyBase = getPublicBaseUrlFromRequest(req);
        const requestedNext = sanitizeNextPath((req.body as any)?.next);
        const next = requestedNext || "/pre-scout-setup";
        const verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${token}&next=${encodeURIComponent(next)}`;

        try {
          await emailService.sendEmail({
            to: email,
            subject: "Verify your TradeScout email",
            html: `<p><a href="${verifyLink}">Verify your email address</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>`,
            text: `Verify your TradeScout email: ${verifyLink}`,
            purpose: "email_verification",
          });
        } catch (error) {
          console.error("[email-verification] Failed to send verification email:", error);
        }

        const debug =
          !emailService.isConfigured() && process.env.NODE_ENV !== "production"
            ? { verificationToken: token }
            : {};

        return res.json({
          message: "If an account exists, a verification link has been sent.",
          ...debug,
        });
      } catch (error: any) {
        console.error("[email-verification] Request failed:", error);
        return sendAutoClassifiedError(res, error, "Failed to send verification email");
      }
    }
  );

  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as any;
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!token) return res.status(400).json({ message: "Token is required" });

      const userId = emailVerificationService.consumeToken(token);
      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      const updated = await storage.updateUser(userId, { emailVerified: true } as any);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        message: "Email verified successfully",
        email: (updated as any)?.email || null,
        userId: (updated as any)?.id || userId,
      });
    } catch (error: any) {
      console.error("[email-verification] Verification failed:", error);
      return sendAutoClassifiedError(res, error, "Failed to verify email");
    }
  });

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
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Vary", "Cookie, Origin");

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

      let user = await storage.getUser(userId);
      if (!user) {
        res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
        return;
      }

      const normalizeAdminRoleToken = (value: unknown): string => {
        const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
        if (!raw) return "";
        return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
      };

      const adminEmailAliases = Array.from(
        new Set(
          [
            String(process.env.MASTER_ADMIN_EMAIL || "")
              .trim()
              .toLowerCase(),
            ...String(process.env.SUPER_ADMIN_EMAIL_ALIASES || "")
              .split(",")
              .map((v) => v.trim().toLowerCase())
              .filter(Boolean),
            "info.tradescout@gmail.com",
            // Production fallback alias used for the canonical support/admin identity.
            "contact@thetradescout.com",
          ].filter(Boolean)
        )
      );

      const userEmail = String((user as any)?.email || "")
        .trim()
        .toLowerCase();
      const isAdminAliasEmail = userEmail.length > 0 && adminEmailAliases.includes(userEmail);
      if (isAdminAliasEmail) {
        const currentRoles = Array.from(
          new Set(
            [
              ...(Array.isArray((user as any)?.roles) ? ((user as any).roles as unknown[]) : []),
              (user as any)?.role,
              (user as any)?.activeRole,
            ]
              .map((role) => normalizeAdminRoleToken(role))
              .filter(Boolean)
          )
        );
        const alreadyAdminTier =
          (user as any)?.isSuperAdmin === true ||
          (user as any)?.isAdmin === true ||
          currentRoles.some((role) => ["super_admin", "ops_admin", "moderator"].includes(role));

        if (!alreadyAdminTier || !currentRoles.includes("super_admin")) {
          const nextRoles = Array.from(new Set([...currentRoles, "super_admin"]));
          try {
            user = await storage.updateUser(user.id, {
              role: "super_admin",
              activeRole: "super_admin",
              roles: nextRoles as any,
              isAdmin: true,
              isSuperAdmin: true,
            } as any);
          } catch (adminAliasRepairError) {
            console.error("[auth/user] Failed to reconcile super admin alias role", {
              userId,
              email: userEmail,
              error: adminAliasRepairError,
            });
          }
        }
      }

      const mergeSessionAuthority = (baseUser: any) => {
        const authUser = (req.user || {}) as any;
        if (!baseUser || !authUser) return baseUser;
        const authClaims =
          authUser?.claims && typeof authUser.claims === "object" ? authUser.claims : {};

        const claimsRolesRaw = Array.isArray((authClaims as any)?.roles)
          ? ((authClaims as any).roles as unknown[])
          : typeof (authClaims as any)?.roles === "string"
            ? [String((authClaims as any).roles)]
            : [];

        const mergedRoles = Array.from(
          new Set(
            [
              ...(Array.isArray(baseUser?.roles) ? baseUser.roles : []),
              ...(Array.isArray(authUser?.roles) ? authUser.roles : []),
              ...claimsRolesRaw,
              baseUser?.role,
              baseUser?.activeRole,
              authUser?.role,
              authUser?.activeRole,
              (authClaims as any)?.role,
              (authClaims as any)?.activeRole,
            ]
              .map((role) => normalizeAdminRoleToken(role))
              .filter(Boolean)
          )
        );

        const ADMIN_ROLE_SET = new Set(["super_admin", "ops_admin", "moderator"]);
        const findFirstAdminRole = (roles: string[]): string =>
          roles.find((role) => ADMIN_ROLE_SET.has(role)) || "";

        const baseUserRoles = Array.from(
          new Set(
            [
              ...(Array.isArray(baseUser?.roles) ? baseUser.roles : []),
              baseUser?.activeRole,
              baseUser?.role,
            ]
              .map((role) => normalizeAdminRoleToken(role))
              .filter(Boolean)
          )
        );
        const baseUserAdminRole = findFirstAdminRole(baseUserRoles);

        const resolvedRole =
          normalizeAdminRoleToken(baseUser?.activeRole) ||
          normalizeAdminRoleToken(baseUser?.role) ||
          normalizeAdminRoleToken(authUser?.activeRole) ||
          normalizeAdminRoleToken(authUser?.role) ||
          normalizeAdminRoleToken((authClaims as any)?.activeRole) ||
          normalizeAdminRoleToken((authClaims as any)?.role) ||
          mergedRoles[0] ||
          "";

        const hasAdminRole = mergedRoles.some((role) =>
          ["super_admin", "ops_admin", "moderator"].includes(role)
        );
        const hasSuperAdminRole = mergedRoles.includes("super_admin");

        // Data authority: if DB says this user is admin-tier, do not allow stale session role payloads
        // to downgrade admin surfaces in the app shell.
        const effectiveRole =
          baseUserAdminRole ||
          (hasAdminRole && !ADMIN_ROLE_SET.has(resolvedRole)
            ? findFirstAdminRole(mergedRoles)
            : "") ||
          resolvedRole;

        return {
          ...baseUser,
          role: effectiveRole || baseUser?.role,
          activeRole: effectiveRole || baseUser?.activeRole,
          roles: mergedRoles,
          isAdmin: baseUser?.isAdmin === true || authUser?.isAdmin === true || hasAdminRole,
          isSuperAdmin:
            baseUser?.isSuperAdmin === true || authUser?.isSuperAdmin === true || hasSuperAdminRole,
        };
      };

      // Resolve the current super admin support account for session-level support paths.
      // Do not create contact edges here; governed contact must remain gated.
      try {
        const sessionAny = req.session as any;
        const ensuredForUserId =
          typeof sessionAny?.superAdminConnectionEnsuredForUserId === "string"
            ? sessionAny.superAdminConnectionEnsuredForUserId
            : "";
        if (ensuredForUserId !== String(userId)) {
          await ensureSuperAdminConnectionForUser(String(userId));
          if (sessionAny) {
            sessionAny.superAdminConnectionEnsuredForUserId = String(userId);
          }
        }
      } catch (ensureError) {
        console.error("[auth/user] Failed to ensure super admin auto-connection", {
          userId,
          error: ensureError,
        });
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
      // Never let optional profile resolution break authenticated sessions.
      if (!user.activeProfileId) {
        try {
          const profiles = await storage.listProfilesByOwner(userId);
          if (profiles.length === 1) {
            const updated = await storage.setUserActiveProfile(userId, profiles[0].id);
            res.json({
              authenticated: true,
              user: sanitizeUserForResponse(mergeSessionAuthority(applyImpersonation(updated))),
            });
            return;
          }
        } catch (profileError) {
          console.warn("[auth/user] profile auto-resolution skipped:", profileError);
        }
      }

      // Active business resolution:
      // - If activeBusinessId exists, keep it.
      // - Else if user owns exactly 1 business, auto-set it.
      // Never let optional business resolution break authenticated sessions.
      if (!user.activeBusinessId) {
        try {
          const businesses = await storage.listBusinessesByOwner(userId);
          if (businesses.length === 1) {
            const updated = await storage.setUserActiveBusiness(userId, businesses[0].id);
            res.json({
              authenticated: true,
              user: sanitizeUserForResponse(mergeSessionAuthority(applyImpersonation(updated))),
            });
            return;
          }
        } catch (businessError) {
          console.warn("[auth/user] business auto-resolution skipped:", businessError);
        }
      }

      const finalUser = sanitizeUserForResponse(mergeSessionAuthority(applyImpersonation(user)));
      // Graduate pilot: community-first experience is now default for all authenticated users.
      const communityFirst = true;

      res.json({ authenticated: true, user: { ...finalUser, communityFirst } });
    } catch (error: any) {
      console.error("Error fetching auth user:", error);
      // Fail-soft: auth must never block the app shell.
      res.status(200).json({ authenticated: false });
    }
  });

  // Check if platform setup is needed
  app.get("/api/auth/setup-status", async (req: AuthedRequest, res: Response) => {
    try {
      const existingSuperAdmin = await storage.getUserByRole("super_admin");
      res.json({ needsSetup: !existingSuperAdmin });
    } catch (error: any) {
      console.error("Setup status check error:", error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  // Super admin setup route (only works if no super_admin exists)
  app.post("/api/auth/setup-master", async (req: AuthedRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName } = (req.body ?? {}) as any;
      const isProductionEnv =
        process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
      const requiredSetupToken = String(process.env.SETUP_MASTER_ADMIN_TOKEN || "").trim();
      const allowUnsafeDevSetup =
        !isProductionEnv && String(process.env.ALLOW_SETUP_MASTER_WITHOUT_TOKEN || "") === "true";

      const isLocalRequest = () => {
        const ip = String((req as any).ip || "")
          .trim()
          .toLowerCase();
        return (
          ip === "127.0.0.1" ||
          ip === "::1" ||
          ip.startsWith("::ffff:127.0.0.1") ||
          ip === "localhost"
        );
      };

      // Check if any super_admin already exists
      const existingSuperAdmin = await storage.getUserByRole("super_admin");
      if (existingSuperAdmin) {
        return res.status(403).json({ message: "Master admin already exists" });
      }

      // This endpoint is intentionally unauthenticated, but must be explicitly enabled via a token.
      // Without a token, this is a public takeover window.
      if (!requiredSetupToken) {
        if (allowUnsafeDevSetup && isLocalRequest()) {
          // Allow local-only setup for dev when explicitly requested.
        } else {
          return res.status(503).json({
            message:
              "Master admin setup is disabled. Set SETUP_MASTER_ADMIN_TOKEN (recommended) to enable initial setup.",
          });
        }
      } else {
        const providedSetupToken = String((req.body as any)?.setupToken || "").trim();
        if (!providedSetupToken || providedSetupToken !== requiredSetupToken) {
          return res.status(403).json({ message: "Invalid setup token" });
        }
      }

      const masterAdmin = await storage.createMasterAdmin(email, password, firstName, lastName);

      // Register trusted device for secure session persistence
      const sessionToken = await DeviceAuthService.registerTrustedDevice(); // stubbed: no args

      // Set secure cookie for trusted session
      res.cookie("trusted_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.APP_ENV === "production",
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
    requireRole(["super_admin"]),
    async (req: AuthedRequest, res: Response) => {
      try {
        const currentUser = req.user as any;

        // Check if user is logged in via Facebook
        if (!currentUser.claims?.sub) {
          return res
            .status(400)
            .json({ message: "Must be logged in via Facebook to connect to master admin" });
        }

        const userId: string = currentUser?.id || currentUser?.claims?.sub || "";
        if (!userId) {
          return res.status(400).json({ message: "User ID missing" });
        }

        const masterAdmin = await storage.getUser(userId);
        if (!masterAdmin || masterAdmin.role !== "super_admin") {
          return res.status(403).json({ message: "Admin access required" });
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
        const updatedAdmin = await storage.updateUser(masterAdmin.id, {
          facebookId: currentUser.claims.sub,
          profileImageUrl: currentUser.claims.profile_image_url,
          // Update name if Facebook has more recent data
          firstName: currentUser.claims.first_name || masterAdmin.firstName,
          lastName: currentUser.claims.last_name || masterAdmin.lastName,
        });

        req.login(updatedAdmin as any, (err: any) => {
          if (err) {
            console.error("Connect master admin: session refresh failed:", err);
            return res
              .status(500)
              .json({ message: "Facebook connected but session refresh failed" });
          }
          return res.json({
            message: "Facebook account connected to admin account",
            user: sanitizeUserForResponse(updatedAdmin),
          });
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
    requireRole(["super_admin"]),
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
    requireRole(["super_admin"]),
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
    requireRole(["super_admin"]),
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
    requireRole(["super_admin"]),
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
    requireRole(["super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { email, password, firstName, lastName, role, address } = (req.body ?? {}) as any;

        // Validate role assignment permissions
        const currentUser = req.user as any;
        const normalizedActorRole = normalizeAdminRoleToken(currentUser?.role);
        const requestedRole = normalizeAdminRoleToken(role);
        if (!requestedRole) {
          return res.status(400).json({ message: "role is required" });
        }
        if (requestedRole === "super_admin" && normalizedActorRole !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Only super admins can create other super admins" });
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
          role: requestedRole as any,
          emailVerified: true, // Admins are pre-verified
          addressVerified: true, // Admins are pre-verified
        });

        // Remove password hash from response
        const { password: passwordHash, ...userResponse } = newAdmin;
        void passwordHash;

        res.json({
          user: userResponse,
          message: `${requestedRole} account created successfully`,
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
    const canonicalWebOrigin = String(
      process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com"
    ).replace(/\/+$/, "");
    const defaultGoogleCallbackURL = `${canonicalWebOrigin}/api/auth/google/callback`;
    const configuredGoogleCallback = String(process.env.GOOGLE_CALLBACK_URL || "").trim();
    const googleCallbackURL =
      process.env.NODE_ENV === "production" &&
      /onrender\.com/i.test(configuredGoogleCallback) &&
      canonicalWebOrigin.startsWith("https://")
        ? defaultGoogleCallbackURL
        : configuredGoogleCallback || defaultGoogleCallbackURL;

    console.log("[AUTH] Using Google callback URL:", googleCallbackURL);

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!googleClientId || !googleClientSecret) {
      throw new Error(
        "[AUTH] Google OAuth enabled but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing"
      );
    }

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
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

  function getCookieValue(req: Request, key: string): string | null {
    const header = String(req.headers.cookie || "");
    if (!header) return null;
    const parts = header.split(";").map((p) => p.trim());
    for (const part of parts) {
      if (!part) continue;
      const idx = part.indexOf("=");
      if (idx <= 0) continue;
      const k = part.slice(0, idx).trim();
      if (k !== key) continue;
      try {
        return decodeURIComponent(part.slice(idx + 1));
      } catch {
        return part.slice(idx + 1);
      }
    }
    return null;
  }

  function setReferralCookie(res: Response, referralCode: string) {
    const safe = String(referralCode || "").trim();
    if (!safe) return;
    const maxAgeDays = 30;
    const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
    const cookie = [
      `ts_ref=${encodeURIComponent(safe)}`,
      "Path=/",
      `Max-Age=${maxAgeSeconds}`,
      "SameSite=Lax",
      // Let the CDN/app decide; in production always secure.
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    const existing = res.getHeader("Set-Cookie");
    if (!existing) {
      res.setHeader("Set-Cookie", cookie);
      return;
    }
    const arr = Array.isArray(existing) ? existing : [String(existing)];
    res.setHeader("Set-Cookie", [...arr, cookie]);
  }

  async function recordReferralClick(params: {
    referralCode: string;
    destination: string;
    source: string;
    conversionType?: string;
  }) {
    const referralCode = String(params.referralCode || "").trim();
    if (!referralCode) return;

    const [account] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.referralCode, referralCode))
      .limit(1);

    if (!account) return;

    await storage.trackReferralClick({
      affiliateId: account.id,
      referredUserId: null,
      shareLinkId: null,
      customLink: params.destination || null,
      conversionSource: params.source || "unknown",
      conversionType: params.conversionType || "click",
      couponCode: null,
    } as any);
  }

  async function persistLifetimeReferralOwner(params: {
    referredUserId: string;
    referralCode: string;
    conversionSource: string;
    conversionType: string;
    destination?: string;
  }) {
    const referredUserId = String(params.referredUserId || "").trim();
    const referralCode = String(params.referralCode || "").trim();
    if (!referredUserId || !referralCode) return;

    try {
      const [account] = await db
        .select({
          id: affiliateAccounts.id,
          affiliateId: affiliateAccounts.affiliateId,
        })
        .from(affiliateAccounts)
        .where(eq(affiliateAccounts.referralCode, referralCode))
        .limit(1);

      if (!account?.id) return;
      if (String(account.affiliateId) === referredUserId) return; // no self-attribution

      const [current] = await db
        .select({ referredByAffiliateAccountId: users.referredByAffiliateAccountId })
        .from(users)
        .where(eq(users.id, referredUserId))
        .limit(1);

      const existingOwner = current?.referredByAffiliateAccountId
        ? String(current.referredByAffiliateAccountId)
        : "";

      // First-touch lifetime: never overwrite once set to a different affiliate.
      if (existingOwner && existingOwner !== account.id) return;

      if (!existingOwner) {
        await db
          .update(users)
          .set({
            referredByAffiliateAccountId: account.id,
            referredAt: new Date(),
          } as any)
          .where(and(eq(users.id, referredUserId), isNull(users.referredByAffiliateAccountId)));
      }

      const [existingReferral] = await db
        .select({ id: affiliateReferrals.id })
        .from(affiliateReferrals)
        .where(
          and(
            eq(affiliateReferrals.affiliateId, account.id),
            eq(affiliateReferrals.referredUserId, referredUserId)
          )
        )
        .limit(1);

      if (!existingReferral?.id) {
        await db
          .insert(affiliateReferrals)
          .values({
            affiliateId: account.id,
            referredUserId,
            shareLinkId: null,
            customLink: params.destination || null,
            conversionSource: params.conversionSource || "unknown",
            conversionType: params.conversionType || "signup",
            couponCode: null,
          } as any)
          .catch(() => {});
      }
    } catch {
      // Never block auth flows on referral persistence.
    }
  }

  // Referral attribution middleware:
  // - If a visitor arrives with ?ref=CODE, persist it in a cookie for later signup conversion.
  // - If a visitor lands on a public profile/business page without ?ref=..., attribute to the
  //   page owner (clean URLs still count).
  app.use(async (req: Request, res: Response, next: any) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return next();

      const path = String(req.path || "");
      if (!path || path.startsWith("/api/")) return next();

      // Ignore static assets
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/i.test(path)) {
        return next();
      }

      const explicitRef =
        typeof (req.query as any)?.ref === "string" ? String((req.query as any).ref).trim() : "";
      const existingRef = getCookieValue(req, "ts_ref");

      // Explicit referrals are recorded, but cookie attribution is first-touch (lifetime) and will not overwrite.
      if (explicitRef) {
        await recordReferralClick({
          referralCode: explicitRef,
          destination: req.originalUrl || path,
          source: "query_ref",
          conversionType: "click",
        }).catch(() => {});
        if (!existingRef) {
          setReferralCookie(res, explicitRef);
        }
        return next();
      }

      // No explicit ref: do not overwrite an existing referral cookie.
      if (existingRef) return next();

      // Clean public profile attribution (no ?ref=... required).
      if (path.startsWith("/profile/")) {
        const parts = path.split("/").filter(Boolean);
        const profileId = parts[1] ? decodeURIComponent(parts[1]) : "";
        if (!profileId) return next();

        // Avoid self-attribution
        const authedUserId =
          ((req as any)?.user as any)?.id || ((req as any)?.user as any)?.claims?.sub || null;
        if (authedUserId && String(authedUserId) === profileId) return next();

        let program = await storage.getAffiliateProgram(profileId).catch(() => undefined);
        if (!program) {
          program = await storage
            .createAffiliateProgram({ userId: profileId } as any)
            .catch(() => undefined);
        }
        const referralCode = String((program as any)?.referralCode || "").trim();
        if (!referralCode) return next();

        setReferralCookie(res, referralCode);
        await recordReferralClick({
          referralCode,
          destination: req.originalUrl || path,
          source: "profile_clean",
          conversionType: "profile_view",
        }).catch(() => {});
        return next();
      }

      if (path.startsWith("/business/")) {
        const parts = path.split("/").filter(Boolean);
        const slug = parts[1] ? decodeURIComponent(parts[1]) : "";
        if (!slug) return next();

        const [biz] = await db
          .select({ ownerUserId: businesses.ownerUserId })
          .from(businesses)
          .where(eq(businesses.slug, slug))
          .limit(1);

        const ownerUserId = (biz as any)?.ownerUserId ? String((biz as any).ownerUserId) : "";
        if (!ownerUserId) return next();

        const authedUserId =
          ((req as any)?.user as any)?.id || ((req as any)?.user as any)?.claims?.sub || null;
        if (authedUserId && String(authedUserId) === ownerUserId) return next();

        let program = await storage.getAffiliateProgram(ownerUserId).catch(() => undefined);
        if (!program) {
          program = await storage
            .createAffiliateProgram({ userId: ownerUserId } as any)
            .catch(() => undefined);
        }
        const referralCode = String((program as any)?.referralCode || "").trim();
        if (!referralCode) return next();

        setReferralCookie(res, referralCode);
        await recordReferralClick({
          referralCode,
          destination: req.originalUrl || path,
          source: "business_clean",
          conversionType: "business_view",
        }).catch(() => {});
        return next();
      }
    } catch {
      // Never block page loads on referral attribution.
    }

    return next();
  });

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

  const readAndClearOAuthNext = (req: Request): string => {
    try {
      const raw = String((req.session as any)?.oauthNext || "").trim();
      if (req.session) {
        delete (req.session as any).oauthNext;
      }
      if (!raw) return "";
      if (!raw.startsWith("/")) return "";
      if (raw.startsWith("//")) return "";
      return raw;
    } catch {
      return "";
    }
  };

  const getRuntimeOAuthCallbackUrl = (
    req: Request,
    provider: "google" | "facebook",
    fallbackFromEnv?: string
  ): string | undefined => {
    try {
      const host = String(req.get("host") || "").trim();
      const hostOnly = host.split(":")[0].toLowerCase();
      const protocolHeader = String(req.get("x-forwarded-proto") || "")
        .trim()
        .toLowerCase();
      const protocol = protocolHeader === "https" ? "https" : req.protocol || "http";
      const isLocalHost = /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/i.test(host);
      const isCanonicalHost =
        hostOnly === "www.thetradescout.com" || hostOnly === "thetradescout.com";

      // Always prefer request host for local development, even when NODE_ENV=production.
      if (host && isLocalHost) {
        return `${protocol}://${host}/api/auth/${provider}/callback`;
      }

      // In production, prefer canonical web hosts over stale env callback values
      // so OAuth cookies stay on the same origin users are actually on.
      if (host && isCanonicalHost) {
        return `${protocol}://${host}/api/auth/${provider}/callback`;
      }

      if (host && process.env.NODE_ENV !== "production") {
        return `${protocol}://${host}/api/auth/${provider}/callback`;
      }
    } catch {
      // fall through to env value
    }
    return fallbackFromEnv;
  };

  if (hasFacebookOAuth) {
    app.get("/api/auth/facebook", (req: Request, res: Response, next: any) => {
      try {
        const requestedNext =
          typeof (req.query as any)?.next === "string"
            ? String((req.query as any).next).trim()
            : "";
        if (
          req.session &&
          requestedNext &&
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//")
        ) {
          (req.session as any).oauthNext = requestedNext;
        }
      } catch {
        // ignore
      }
      const callbackURL = getRuntimeOAuthCallbackUrl(
        req,
        "facebook",
        process.env.FACEBOOK_CALLBACK_URL
      );
      return passport.authenticate("facebook", {
        scope: ["email"],
        callbackURL,
      } as any)(req, res, next);
    });
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
            const needsProfileNormalization =
              profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true;
            const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
            return res.redirect(redirectTo);
          }
        } catch {
          // ignore
        }
        return next();
      },
      (req: Request, res: Response, next: any) => {
        const callbackURL = getRuntimeOAuthCallbackUrl(
          req,
          "facebook",
          process.env.FACEBOOK_CALLBACK_URL
        );
        return passport.authenticate("facebook", {
          failureRedirect: "/login",
          callbackURL,
        } as any)(req, res, next);
      },
      (req: Request, res: Response) => {
        const user = req.user as any;
        const referralCodeFromCookie = getCookieValue(req, "ts_ref");
        if (user && referralCodeFromCookie) {
          persistLifetimeReferralOwner({
            referredUserId: String(user?.id || user?.claims?.sub || ""),
            referralCode: referralCodeFromCookie,
            conversionSource: "facebook_oauth",
            conversionType: (user as any)?._wasNewSocialUser ? "oauth_signup" : "oauth_login",
            destination: req.originalUrl || "/",
          }).catch(() => {});
        }
        maybeSendEmailVerificationForUser(req, user).catch(() => {});
        const email = typeof user?.email === "string" ? user.email : "";
        const anyUser: any = user || {};
        const profileVersion: number =
          typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
        const needsProfileNormalization =
          profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true;
        const oauthNext = readAndClearOAuthNext(req);
        const redirectBase = needsProfileNormalization
          ? "/onboarding/profile"
          : oauthNext || "/pre-scout-setup";
        const redirectWithSession = (target: string) => {
          if (req.session) {
            return req.session.save((saveErr: any) => {
              if (saveErr) {
                console.error("Failed to persist session before Facebook OAuth redirect:", saveErr);
              }
              return res.redirect(target);
            });
          }
          return res.redirect(target);
        };
        getGeneralSetting<boolean>("email_verification_required", true)
          .then((required) => {
            if (required && user && user.emailVerified !== true && email) {
              return redirectWithSession(
                `/check-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectBase)}`
              );
            }
            return redirectWithSession(redirectBase);
          })
          .catch(() => redirectWithSession(redirectBase));
      }
    );
  }

  if (hasGoogleOAuth) {
    // Google OAuth entrypoint: request standard OpenID scopes
    app.get("/api/auth/google", (req: Request, res: Response, next: any) => {
      try {
        const requestedNext =
          typeof (req.query as any)?.next === "string"
            ? String((req.query as any).next).trim()
            : "";
        if (
          req.session &&
          requestedNext &&
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//")
        ) {
          (req.session as any).oauthNext = requestedNext;
        }
      } catch {
        // ignore
      }
      const callbackURL = getRuntimeOAuthCallbackUrl(
        req,
        "google",
        process.env.GOOGLE_CALLBACK_URL
      );
      return passport.authenticate("google", {
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
        callbackURL,
      } as any)(req, res, next);
    });
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
            const needsProfileNormalization =
              profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true;
            const redirectTo = needsProfileNormalization ? "/onboarding/profile" : "/";
            return res.redirect(redirectTo);
          }
        } catch {
          // ignore
        }
        return next();
      },
      (req: Request, res: Response, next: any) => {
        const callbackURL = getRuntimeOAuthCallbackUrl(
          req,
          "google",
          process.env.GOOGLE_CALLBACK_URL
        );
        return passport.authenticate("google", {
          failureRedirect: "/login",
          session: true,
          callbackURL,
        } as any)(req, res, next);
      },
      (req: Request, res: Response) => {
        const user = req.user as any;
        const referralCodeFromCookie = getCookieValue(req, "ts_ref");
        if (user && referralCodeFromCookie) {
          persistLifetimeReferralOwner({
            referredUserId: String(user?.id || user?.claims?.sub || ""),
            referralCode: referralCodeFromCookie,
            conversionSource: "google_oauth",
            conversionType: (user as any)?._wasNewSocialUser ? "oauth_signup" : "oauth_login",
            destination: req.originalUrl || "/",
          }).catch(() => {});
        }
        maybeSendEmailVerificationForUser(req, user).catch(() => {});
        const email = typeof user?.email === "string" ? user.email : "";
        const anyUser: any = user || {};
        const profileVersion: number =
          typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;
        const needsProfileNormalization =
          profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true;
        const oauthNext = readAndClearOAuthNext(req);
        const redirectBase = needsProfileNormalization
          ? "/onboarding/profile"
          : oauthNext || "/pre-scout-setup";
        const redirectWithSession = (target: string) => {
          if (req.session) {
            return req.session.save((saveErr: any) => {
              if (saveErr) {
                console.error("Failed to persist session before Google OAuth redirect:", saveErr);
              }
              return res.redirect(target);
            });
          }
          return res.redirect(target);
        };
        getGeneralSetting<boolean>("email_verification_required", true)
          .then((required) => {
            if (required && user && user.emailVerified !== true && email) {
              return redirectWithSession(
                `/check-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectBase)}`
              );
            }
            return redirectWithSession(redirectBase);
          })
          .catch(() => redirectWithSession(redirectBase));
      }
    );
  }

  // Admin role impersonation routes
  app.post(
    "/api/admin/impersonate",
    isAuthenticated,
    requireRole(["ops_admin", "super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { role, reason } = (req.body ?? {}) as any;

        if (typeof reason !== "string" || reason.trim().length < 5) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 5 characters)" });
        }

        // Validate the target role
        const validRoles = ["homeowner", "contractor", "startup_founder", "moderator", "ops_admin"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: "Invalid role for impersonation" });
        }

        // Store original user info in session for restoration
        const adminId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        (req.session as any).originalUser = {
          id: adminId,
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

        await logAdminAction({
          type: "admin_impersonation_start_role",
          adminId,
          adminRole: (req.user as any)?.role,
          targetRole: role,
          targetUserId: userId,
          reason: String(reason).trim(),
        });

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
    "/api/admin/impersonate/start/:userId",
    isAuthenticated,
    requireRole(["ops_admin", "super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params as any;
        const { reason } = (req.body ?? {}) as any;

        if (!userId) {
          return res.status(400).json({ message: "Target user is required" });
        }

        if (typeof reason !== "string" || reason.trim().length < 5) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 5 characters)" });
        }

        const adminId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const [targetUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, String(userId)))
          .limit(1);
        if (!targetUser) {
          return res.status(404).json({ message: "Target user not found" });
        }

        (req.session as any).originalUser = {
          id: adminId,
          role: (req.user as any)?.role,
          email: (req.user as any)?.email,
        };

        (req.session as any).impersonatingRole = targetUser.activeRole || targetUser.role;
        (req.session as any).impersonatedUserId = targetUser.id;
        (req.session as any).isImpersonating = true;

        await logAdminAction({
          type: "admin_impersonation_start_user",
          adminId,
          adminRole: (req.user as any)?.role,
          targetUserId: targetUser.id,
          targetRole: targetUser.activeRole || targetUser.role,
          reason: String(reason).trim(),
        });

        res.json({
          message: `Impersonation started for user: ${targetUser.email || targetUser.id}`,
          isImpersonating: true,
          userId: targetUser.id,
          role: targetUser.activeRole || targetUser.role,
        });
      } catch (error: any) {
        console.error("User impersonation start error:", error);
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

        const originalUser = (req.session as any).originalUser;

        // Clear impersonation from session
        delete (req.session as any).impersonatingRole;
        delete (req.session as any).impersonatedUserId;
        delete (req.session as any).isImpersonating;
        delete (req.session as any).originalUser;

        await logAdminAction({
          type: "admin_impersonation_stop",
          adminId: originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub,
          adminRole: originalUser?.role || (req.user as any)?.role,
        });

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

  app.post("/api/admin/impersonate/stop", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!(req.session as any).isImpersonating || !(req.session as any).originalUser) {
        return res.status(400).json({ message: "No active impersonation session" });
      }

      const originalUser = (req.session as any).originalUser;

      delete (req.session as any).impersonatingRole;
      delete (req.session as any).impersonatedUserId;
      delete (req.session as any).isImpersonating;
      delete (req.session as any).originalUser;

      await logAdminAction({
        type: "admin_impersonation_stop",
        adminId: originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub,
        adminRole: originalUser?.role || (req.user as any)?.role,
      });

      res.json({
        message: "Impersonation stopped",
        isImpersonating: false,
      });
    } catch (error: any) {
      console.error("Stop impersonation error:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Backward-compat alias: older clients call /api/admin/impersonate/exit.
  app.post("/api/admin/impersonate/exit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!(req.session as any).isImpersonating || !(req.session as any).originalUser) {
        return res.status(400).json({ message: "No active impersonation session" });
      }

      const originalUser = (req.session as any).originalUser;

      delete (req.session as any).impersonatingRole;
      delete (req.session as any).impersonatedUserId;
      delete (req.session as any).isImpersonating;
      delete (req.session as any).originalUser;

      await logAdminAction({
        type: "admin_impersonation_stop",
        adminId: originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub,
        adminRole: originalUser?.role || (req.user as any)?.role,
      });

      res.json({
        message: "Impersonation stopped",
        isImpersonating: false,
      });
    } catch (error: any) {
      console.error("Stop impersonation error (exit alias):", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

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
        "super_admin",
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
      const routingRole = coerceToRoutingRoleEnum(activeRole);
      const rolesForDb = dedupeStrings([routingRole, ...filteredRoles]).filter(
        (r) => !BLOCKED_SELF_ASSIGN_ROLES.has(r)
      );

      const user = await storage.updateUser(userId, {
        roles: rolesForDb,
        activeRole,
        role: routingRole,
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
      const routingRole = coerceToRoutingRoleEnum(activeRole);
      const rolesForDb = dedupeStrings([routingRole, ...normalized]).filter(
        (r) => !BLOCKED_SELF_ASSIGN_ROLES.has(r)
      );

      const user = await storage.updateUser(userId, {
        roles: rolesForDb,
        activeRole,
        role: routingRole,
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
          (t: any) => t === "marketplace" || t === "trade"
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

  // Helper endpoint for Scout/tools: merge preferences.scout without clobbering other scout keys.
  // This avoids the shallow-merge behavior of /api/users/preferences, which would overwrite the
  // entire scout object when toggling a single flag.
  app.post("/api/agent/preferences/scout", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const body: any = req.body ?? {};
      const delta: any = body.scout ?? body.delta ?? body;

      if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
        return res.status(400).json({ message: "scout delta must be an object" });
      }

      const currentPrefs: any = (currentUser as any).preferences || {};
      const currentScout: any = currentPrefs.scout || {};

      const nextScout: any = {
        ...currentScout,
        ...delta,
      };

      const updatedPreferences = {
        ...currentPrefs,
        scout: nextScout,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ scout: (user as any).preferences?.scout });
    } catch (error: any) {
      console.error("Error updating user scout preferences via agent helper:", error);
      res.status(500).json({ message: "Failed to update scout preferences" });
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

      // If pre-Scout setup has captured a canonical locality draft, commit the minimal
      // location fields onto the user record so protected routes don't keep re-sending
      // logged-in users through setup loops.
      const provisional = (updatedPreferences as any)?.provisional;
      const profileDraft = provisional?.profileDraft;
      const presenceType = profileDraft?.presenceType;
      const stateCode = profileDraft?.stateCode;
      const countyFips = profileDraft?.countyFips;
      const countyName = profileDraft?.countyName;

      const shouldCommitLocality =
        typeof presenceType === "string" &&
        typeof stateCode === "string" &&
        typeof countyFips === "string" &&
        /^\d{5}$/.test(countyFips);

      const normalizedStateCode =
        typeof stateCode === "string" ? stateCode.trim().toUpperCase() : stateCode;
      const normalizedCountyFips = typeof countyFips === "string" ? countyFips.trim() : countyFips;

      const userUpdate: any = {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      };

      if (shouldCommitLocality) {
        userUpdate.stateCode = normalizedStateCode;
        userUpdate.countyFips = normalizedCountyFips;
        if (typeof countyName === "string" && countyName.trim()) {
          userUpdate.countyName = countyName.trim();
        }
        userUpdate.locationCommitted = true;
      }

      const user = await storage.updateUser(userId, userUpdate);

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

      const viewerId =
        (req as AuthedRequest)?.user?.id || (req as AuthedRequest)?.user?.claims?.sub || "";
      const isOwner = Boolean(viewerId) && String(viewerId) === String(user.id);
      let hasInAppRelationshipAccess = false;

      // In-app profile viewing fallback:
      // if a signed-in member is connected (follow or accepted contact permission),
      // allow profile rendering even when public visibility is off.
      if (viewerId && !isOwner) {
        try {
          const { getContactPermission } = await import("./utils/contactRequests");
          const [viewerToOwnerPermission, ownerToViewerPermission] = await Promise.all([
            getContactPermission(String(viewerId), String(user.id)),
            getContactPermission(String(user.id), String(viewerId)),
          ]);
          hasInAppRelationshipAccess =
            viewerToOwnerPermission?.status === "accepted" ||
            ownerToViewerPermission?.status === "accepted";
        } catch (permissionError) {
          console.warn("[public-profile] failed checking contact permission access", {
            viewerId,
            userId: user.id,
            error: permissionError,
          });
        }

        if (!hasInAppRelationshipAccess) {
          try {
            const [followEdge] = await db
              .select({ followerId: userFollows.followerId })
              .from(userFollows)
              .where(
                or(
                  and(
                    eq(userFollows.followerId, String(viewerId)),
                    eq(userFollows.followingId, String(user.id))
                  ),
                  and(
                    eq(userFollows.followerId, String(user.id)),
                    eq(userFollows.followingId, String(viewerId))
                  )
                )
              )
              .limit(1);

            hasInAppRelationshipAccess = Boolean(followEdge);
          } catch (followError) {
            console.warn("[public-profile] failed checking follow relationship access", {
              viewerId,
              userId: user.id,
              error: followError,
            });
          }
        }
      }

      // Check if profile is public
      const isPublic = user.preferences?.profileVisibility === "public";
      if (!isPublic && !isOwner && !hasInAppRelationshipAccess) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const ownerProfiles = await storage.listProfilesByOwner(user.id);
      const canonicalPublicProfile = ownerProfiles.find((profile: any) => {
        const status = String(profile?.status || "").toLowerCase();
        const slug = typeof profile?.slug === "string" ? profile.slug.trim() : "";
        return status === "published" && slug.length > 0;
      });

      // Optionally enrich with connection stats when viewer is authenticated
      let connectionSummary: { followers: number; following: number; mutual: number } | undefined;
      let viewerConnection:
        | { isFollowing: boolean; isFollowedBy: boolean; isMutual: boolean }
        | undefined;

      try {
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

      // Optional: professional profile enrichment (realtor / car sales).
      // Only expose a safe subset of fields; never expose verification documents.
      let realtorProfilePublic:
        | {
            brokerageName?: string | null;
            mlsId?: string | null;
            licenseState?: string | null;
            licenseNumber?: string | null;
            yearsExperience?: number | null;
            specializations?: string[] | null;
            serviceAreas?: any;
            verificationStatus?: string | null;
          }
        | undefined;
      let carSalesProfilePublic:
        | {
            dealershipName?: string | null;
            dealerLicense?: string | null;
            salesmanLicense?: string | null;
            licenseState?: string | null;
            yearsExperience?: number | null;
            specializations?: string[] | null;
            brandsSpecialty?: string[] | null;
            serviceAreas?: any;
            verificationStatus?: string | null;
          }
        | undefined;

      try {
        const roles: string[] = Array.isArray((user as any)?.roles)
          ? (user as any).roles.filter((r: unknown): r is string => typeof r === "string")
          : [];
        const primaryRole = typeof (user as any)?.role === "string" ? (user as any).role : "";
        const hasRole = (r: string) => primaryRole === r || roles.includes(r);

        if (hasRole("realtor")) {
          const prof = await storage.getRealtorProfileByUserId(user.id);
          if (prof) {
            // Prefer showing only approved/active, but include status so viewers understand the badge state.
            realtorProfilePublic = {
              brokerageName: (prof as any).brokerageName ?? null,
              mlsId: (prof as any).mlsId ?? null,
              licenseState: (prof as any).licenseState ?? null,
              licenseNumber: (prof as any).licenseNumber ?? null,
              yearsExperience: (prof as any).yearsExperience ?? null,
              specializations: Array.isArray((prof as any).specializations)
                ? (prof as any).specializations
                : null,
              serviceAreas: (prof as any).serviceAreas ?? null,
              verificationStatus: (prof as any).verificationStatus ?? null,
            };
          }
        }

        if (hasRole("car_salesman")) {
          const prof = await storage.getCarSalesmanProfileByUserId(user.id);
          if (prof) {
            carSalesProfilePublic = {
              dealershipName: (prof as any).dealershipName ?? null,
              dealerLicense: (prof as any).dealerLicense ?? null,
              salesmanLicense: (prof as any).salesmanLicense ?? null,
              licenseState: (prof as any).licenseState ?? null,
              yearsExperience: (prof as any).yearsExperience ?? null,
              specializations: Array.isArray((prof as any).specializations)
                ? (prof as any).specializations
                : null,
              brandsSpecialty: Array.isArray((prof as any).brandsSpecialty)
                ? (prof as any).brandsSpecialty
                : null,
              serviceAreas: (prof as any).serviceAreas ?? null,
              verificationStatus: (prof as any).verificationStatus ?? null,
            };
          }
        }
      } catch (err) {
        console.error("Failed to enrich public profile with professional data:", err);
      }

      // Return safe public profile data
      const publicProfile = {
        id: user.id,
        canonicalProfileSlug: canonicalPublicProfile?.slug || null,
        canonicalProfileUrl: canonicalPublicProfile?.slug
          ? `/u/${encodeURIComponent(String(canonicalPublicProfile.slug))}`
          : null,
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
          profileBooking: toPublicProfileBookingPrefs((user.preferences as any)?.profileBooking),
        },
        // Stats: populate from real aggregates only; omit fake zeros
        stats: credibilityStats,
        connections: connectionSummary,
        viewerConnection,
        realtorProfile: realtorProfilePublic,
        carSalesProfile: carSalesProfilePublic,
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
        const { profileVisibility, proceedUnverified } = (req.body ?? {}) as any;

        if (!["public", "private"].includes(profileVisibility)) {
          return res.status(400).json({ message: "Invalid visibility option" });
        }

        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // C2-3: Soft gate - offer verification for better visibility (PUBLISH_PUBLIC_PROFILE action)
        // Not blocking; contractor can publish unverified but gets visibility boost if verified
        if (profileVisibility === "public" && proceedUnverified !== true) {
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

  app.get("/api/users/profile-booking", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const profileBooking = normalizeProfileBookingPrefs(
        (currentUser.preferences as any)?.profileBooking
      );
      res.json({ profileBooking });
    } catch (error: any) {
      console.error("Error fetching profile booking settings:", error);
      res.status(500).json({ message: "Failed to fetch profile booking settings" });
    }
  });

  app.patch("/api/users/profile-booking", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const existingProfileBooking = normalizeProfileBookingPrefs(
        (currentPrefs as any).profileBooking
      );
      const incoming = req.body && typeof req.body === "object" ? req.body : {};

      const normalized = normalizeProfileBookingPrefs({
        ...existingProfileBooking,
        ...incoming,
        slots:
          incoming && Object.prototype.hasOwnProperty.call(incoming, "slots")
            ? (incoming as any).slots
            : existingProfileBooking.slots,
        pricingRows:
          incoming && Object.prototype.hasOwnProperty.call(incoming, "pricingRows")
            ? (incoming as any).pricingRows
            : existingProfileBooking.pricingRows,
      });

      const updatedPreferences = {
        ...currentPrefs,
        profileBooking: normalized,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({
        message: "Profile booking settings updated",
        profileBooking: normalizeProfileBookingPrefs((user.preferences as any)?.profileBooking),
      });
    } catch (error: any) {
      console.error("Error updating profile booking settings:", error);
      res.status(500).json({ message: "Failed to update profile booking settings" });
    }
  });

  app.post(
    "/api/profile-booking/requests",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const requesterUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const ownerUserId = String((req.body as any)?.ownerUserId || "").trim();
        const requestMessage =
          typeof (req.body as any)?.requestMessage === "string"
            ? (req.body as any).requestMessage.trim().slice(0, 1000)
            : null;
        const serviceLabel =
          typeof (req.body as any)?.serviceLabel === "string"
            ? (req.body as any).serviceLabel.trim().slice(0, 120)
            : null;
        const timezone =
          typeof (req.body as any)?.timezone === "string"
            ? (req.body as any).timezone.trim().slice(0, 80)
            : null;
        const requestedStartAtRaw = (req.body as any)?.requestedStartAt;
        const requestedEndAtRaw = (req.body as any)?.requestedEndAt;
        const requestedStartAt =
          requestedStartAtRaw && !Number.isNaN(new Date(requestedStartAtRaw).getTime())
            ? new Date(requestedStartAtRaw)
            : null;
        const requestedEndAt =
          requestedEndAtRaw && !Number.isNaN(new Date(requestedEndAtRaw).getTime())
            ? new Date(requestedEndAtRaw)
            : null;
        const deliveryModeRaw = String((req.body as any)?.deliveryMode || "").toLowerCase();
        const deliveryMode =
          deliveryModeRaw === "remote" || deliveryModeRaw === "mobile" ? deliveryModeRaw : "onsite";
        const locationNote =
          typeof (req.body as any)?.locationNote === "string"
            ? (req.body as any).locationNote.trim().slice(0, 500)
            : null;
        const bookingContext =
          (req.body as any)?.bookingContext && typeof (req.body as any).bookingContext === "object"
            ? (req.body as any).bookingContext
            : {};

        if (!ownerUserId) {
          return res.status(400).json({ message: "ownerUserId is required" });
        }
        if (ownerUserId === requesterUserId) {
          return res
            .status(400)
            .json({ message: "Cannot create booking request for your own profile" });
        }

        const owner = await storage.getUser(ownerUserId);
        if (!owner) return res.status(404).json({ message: "Profile owner not found" });
        if ((owner.preferences?.profileVisibility || "private") !== "public") {
          return res.status(404).json({ message: "Profile not available for booking" });
        }

        const booking = normalizeProfileBookingPrefs((owner.preferences as any)?.profileBooking);
        if (!booking.enabled) {
          return res.status(400).json({ message: "Bookings are not enabled on this profile" });
        }

        const verificationGate = evaluateNotaryPaidRemoteGate({
          owner: {
            verificationStatus: owner.verificationStatus,
            addressVerified: owner.addressVerified,
            role: owner.role,
            roles: owner.roles || [],
            preferences: owner.preferences,
          },
          bookingContext: bookingContext as any,
          paidBooking: booking.paidBookings,
        });

        if (verificationGate.applied && !verificationGate.allowed) {
          return res.status(403).json({
            message: "Louisiana remote notary paid bookings require additional verification",
            verificationGate,
          });
        }

        const created = await storage.createProfileBookingRequest({
          ownerUserId,
          requesterUserId,
          status: "requested",
          requestMessage,
          serviceLabel,
          requestedStartAt,
          requestedEndAt,
          timezone,
          deliveryMode,
          locationNote,
          depositRequired: booking.paidBookings,
          depositAmountUsd: booking.paidBookings
            ? String(booking.bookingPriceUsd.toFixed(2))
            : null,
          paymentStatus: booking.paidBookings ? "requires_payment" : "none",
          paymentIntentId: null,
          bookingContext,
          verificationSnapshot: {
            gate: verificationGate.applied ? "notary_remote_paid_la" : "none",
            passed: verificationGate.allowed,
            missing: verificationGate.missing || [],
            checkedAt: new Date().toISOString(),
          },
        } as any);

        // Optional: sync booking activity into a linked Property Program so HomeFax/readiness stays current.
        try {
          const ctx =
            bookingContext && typeof bookingContext === "object" ? (bookingContext as any) : {};
          const propertyProgramId =
            typeof ctx.propertyProgramId === "string" ? String(ctx.propertyProgramId).trim() : "";
          if (propertyProgramId) {
            await requirePropertyProgramAccess({
              propertyProgramId,
              userId: String(requesterUserId || ""),
            });
            await addPropertyLifecycleEvent({
              propertyProgramId,
              actionType: "booking_request_created",
              phase: "bookings",
              title: serviceLabel ? `Booking requested: ${serviceLabel}` : "Booking requested",
              description: requestMessage || null,
              occurredAt: requestedStartAt || new Date(),
              source: "user",
              status: "done",
              metadata: {
                bookingRequestId: created?.id ?? null,
                ownerUserId,
                deliveryMode,
              },
              createdByUserId: String(requesterUserId || ""),
              sourceSurface: "profile_booking",
              idempotencyKey: `profile_booking:request:${created?.id ?? "missing"}`,
            });
          }
        } catch (err) {
          console.warn(
            "[profile-booking] Failed to sync booking request to property program:",
            err
          );
        }

        res.status(201).json(created);
      } catch (error: any) {
        console.error("Error creating profile booking request:", error);
        res.status(500).json({ message: "Failed to create profile booking request" });
      }
    }
  );

  app.get(
    "/api/profile-booking/requests/incoming",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const ownerUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const rows = await storage.listProfileBookingRequestsForOwner(ownerUserId);
        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching incoming booking requests:", error);
        res.status(500).json({ message: "Failed to fetch incoming booking requests" });
      }
    }
  );

  app.get(
    "/api/profile-booking/requests/outgoing",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const requesterUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const rows = await storage.listProfileBookingRequestsForRequester(requesterUserId);
        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching outgoing booking requests:", error);
        res.status(500).json({ message: "Failed to fetch outgoing booking requests" });
      }
    }
  );

  app.patch(
    "/api/profile-booking/requests/:id/status",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const actorUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const id = String(req.params.id || "").trim();
        const nextStatus = String((req.body as any)?.status || "")
          .trim()
          .toLowerCase();
        if (!id) return res.status(400).json({ message: "Request id required" });
        if (!["accepted", "declined", "cancelled", "completed"].includes(nextStatus)) {
          return res.status(400).json({ message: "Invalid status transition" });
        }

        const existing = await storage.getProfileBookingRequestById(id);
        if (!existing) return res.status(404).json({ message: "Booking request not found" });

        const actorIsOwner = existing.ownerUserId === actorUserId;
        const actorIsRequester = existing.requesterUserId === actorUserId;
        if (!actorIsOwner && !actorIsRequester) {
          return res.status(403).json({ message: "Not authorized to update this request" });
        }
        if (
          (nextStatus === "accepted" || nextStatus === "declined" || nextStatus === "completed") &&
          !actorIsOwner
        ) {
          return res.status(403).json({ message: "Only profile owner can set this status" });
        }
        if (nextStatus === "cancelled" && !actorIsRequester && !actorIsOwner) {
          return res.status(403).json({ message: "Only participants can cancel this request" });
        }

        const updated = await storage.updateProfileBookingRequest(id, {
          status: nextStatus as any,
        });

        // Optional: sync status transitions into a linked Property Program.
        try {
          const ctx =
            existing.bookingContext && typeof existing.bookingContext === "object"
              ? (existing.bookingContext as any)
              : {};
          const propertyProgramId =
            typeof ctx.propertyProgramId === "string" ? String(ctx.propertyProgramId).trim() : "";
          if (propertyProgramId) {
            await requirePropertyProgramAccess({
              propertyProgramId,
              userId: String(actorUserId || ""),
            });
            await addPropertyLifecycleEvent({
              propertyProgramId,
              actionType: `booking_request_${nextStatus}`,
              phase: "bookings",
              title: `Booking ${nextStatus}`,
              description: null,
              occurredAt: new Date(),
              source: "user",
              status: "done",
              metadata: {
                bookingRequestId: existing?.id ?? null,
                ownerUserId: existing?.ownerUserId ?? null,
                requesterUserId: existing?.requesterUserId ?? null,
              },
              createdByUserId: String(actorUserId || ""),
              sourceSurface: "profile_booking",
              idempotencyKey: `profile_booking:status:${existing?.id ?? "missing"}:${nextStatus}`,
            });
          }
        } catch (err) {
          console.warn("[profile-booking] Failed to sync status change to property program:", err);
        }

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating booking request status:", error);
        res.status(500).json({ message: "Failed to update booking request status" });
      }
    }
  );

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
        const { email } = req.body || {};

        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const user = await storage.getUserByEmail(String(email).toLowerCase());

        if (user) {
          const { token, code, expiresAt } = passwordResetService.createToken(user.id);
          const resetBase =
            process.env.PASSWORD_RESET_URL || process.env.APP_BASE_URL || "http://localhost:5173";
          const resetLink = `${resetBase.replace(/\/$/, "")}/reset-password?token=${token}`;

          if (emailService.isConfigured()) {
            await emailService.sendEmail({
              to: user.email,
              subject: "Reset your TradeScout password",
              html: `<p>We received a request to reset your TradeScout password.</p>
                 <p><a href="${resetLink}">Click here to reset your password</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
                 <p>Or enter this verification code: <strong>${code}</strong></p>
                 <p>If you did not request this, you can ignore this email.</p>`,
              text: `Reset your password: ${resetLink}\nVerification code: ${code}`,
              purpose: "password_reset",
            });
          } else {
            console.warn(
              `[password-reset] SendGrid not configured; token generated for ${user.email}`
            );
          }
        }

        const payload = {
          message: "If an account exists for that email, a reset link has been sent.",
        };
        res.json(payload);
      } catch (error: any) {
        console.error("[REQUEST-PASSWORD-RESET] CRITICAL ERROR:", error);
        console.error("[REQUEST-PASSWORD-RESET] Stack:", error?.stack);
        sendAutoClassifiedError(res, error, "Failed to request password reset");
      }
    }
  );

  app.post(
    "/api/auth/verify-password-reset-code",
    passwordResetLimiter,
    async (req: Request, res: Response) => {
      try {
        const { email, code } = req.body || {};
        const normalizedEmail = String(email || "")
          .trim()
          .toLowerCase();
        const normalizedCode = String(code || "").trim();

        if (!normalizedEmail || !normalizedCode) {
          return res.status(400).json({ message: "Email and verification code are required" });
        }

        const user = await storage.getUserByEmail(normalizedEmail);
        if (!user) {
          return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        const valid = passwordResetService.consumeCodeForUser(user.id, normalizedCode);
        if (!valid) {
          return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        const { token } = passwordResetService.createToken(user.id);
        return res.json({ token });
      } catch (error: any) {
        return sendAutoClassifiedError(res, error, "Failed to verify reset code");
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
      const { token, newPassword } = req.body || {};

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const userId = passwordResetService.consumeToken(token);

      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const passwordHash = await hashPassword(newPassword);

      await storage.updateUser(userId, {
        password: passwordHash,
        updatedAt: new Date(),
      });

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
  app.get("/api/contractors/search", contractorSearchLimiter, async (req: any, res: any) => {
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
        // Resolve county by FIPS or name without pulling all counties into memory.
        const countyRecord = await storage.findCountyByNameOrFips({ query: String(county) });
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

      const userIds = contractors
        .map((c: any) => c.userId as string | undefined)
        .filter((id): id is string => Boolean(id));

      // Compliance gate: only apply if this trade has explicit requirements.
      // Automatic routing must fail closed when requirements are not met.
      let gatedContractors = contractors;
      if (tradeRecord) {
        const requirements = await storage.getTradeRequirementsByTradeId(tradeRecord.id);
        if (requirements) {
          const requiresLicense = requirements.requiresLicense ?? false;
          const requiresInsurance = requirements.requiresInsurance ?? false;
          const requiresEin = requirements.requiresEin ?? false;
          const hasExplicitRequirements = requiresLicense || requiresInsurance || requiresEin;

          if (!hasExplicitRequirements) {
            gatedContractors = contractors;
          } else {
            const compliance =
              userIds.length > 0 ? await storage.getUserVerificationSummary(userIds) : {};

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
      const resolvedServiceAreaCounties: Array<{
        countyFips: string;
        countyName: string;
        stateCode: string;
      }> = [];
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
        resolvedServiceAreaCounties.push({
          countyFips: countyRecord.fips,
          countyName: countyRecord.name,
          stateCode: countyRecord.stateCode,
        });
      }

      const computedEligibilities = await getComputedProviderEligibilitiesForUser(userId);
      const blockedServiceAreas = resolvedServiceAreaCounties.filter((county) => {
        return !getEligibilityDecisionForCounty(computedEligibilities, {
          fips: county.countyFips,
          stateCode: county.stateCode,
        }).eligible;
      });

      if (blockedServiceAreas.length > 0) {
        return res.status(428).json({
          message: "Verified legal eligibility is required for every service area you declare.",
          code: "ELIGIBILITY_REQUIRED",
          blockedServiceAreas: blockedServiceAreas.map((county) => ({
            countyFips: county.countyFips,
            countyName: county.countyName,
            stateCode: county.stateCode,
          })),
        });
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
        legalEligibility: {
          eligibleStateCodes: Array.from(
            new Set(
              computedEligibilities
                .filter((entry) => entry.jurisdictionType === "state" && entry.stateCode)
                .map((entry) => entry.stateCode as string)
            )
          ),
          eligibleCountyFips: Array.from(
            new Set(
              computedEligibilities
                .filter((entry) => entry.jurisdictionType === "county" && entry.countyFips)
                .map((entry) => entry.countyFips as string)
            )
          ),
        },
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

  app.get(
    "/api/providers/eligibility",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const explicitEligibilities = await storage.getProviderEligibilitiesForUser(userId);
        const computedEligibilities = await getComputedProviderEligibilitiesForUser(userId);

        res.json({
          explicitEligibilities,
          computedEligibilities,
        });
      } catch (error: any) {
        console.error("Error fetching provider eligibility:", error);
        res.status(500).json({ message: "Failed to fetch provider eligibility" });
      }
    }
  );

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
      const computedEligibilities = await getComputedProviderEligibilitiesForUser(userId);
      const legalDecision = getEligibilityDecisionForCounty(computedEligibilities, {
        fips: county.fips,
        stateCode: county.stateCode,
      });

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
      if (servesThisCounty && !legalDecision.eligible) {
        reachLabel = "declared_not_eligible_here";
      } else if (servesThisCounty && declaredServiceAreas.length <= 3) {
        reachLabel = "local_here";
      } else if (servesThisCounty && declaredServiceAreas.length > 3) {
        reachLabel = "regional_here";
      } else if (legalDecision.eligible) {
        reachLabel = "eligible_not_declared_here";
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
        legal: {
          eligibleInCounty: legalDecision.eligible,
          matchedEligibilities: legalDecision.matched,
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
        !(() => {
          const raw = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
          const token = raw.trim().toLowerCase();
          const normalized = token === "owner" || token === "head_admin" ? "super_admin" : token;
          return ["super_admin", "moderator", "ops_admin"].includes(normalized);
        })()
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { notificationService } = await import("./notification-service");
      void notificationService;
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
        !(() => {
          const raw = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
          const token = raw.trim().toLowerCase();
          const normalized = token === "owner" || token === "head_admin" ? "super_admin" : token;
          return ["super_admin", "moderator", "ops_admin"].includes(normalized);
        })()
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
          roleFilter = ["admin", "moderator", "ops_admin", "super_admin"];
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

  app.put(
    "/api/admin/providers/:userId/eligibilities",
    isAuthenticated,
    isSuperAdmin,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.params.userId || "").trim();
        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const rawEligibilities = Array.isArray((req.body as any)?.eligibilities)
          ? ((req.body as any).eligibilities as any[])
          : [];

        const sanitized: Array<{
          jurisdictionType: "state" | "county";
          eligibilityBasis: "state_license" | "county_license" | "verified_exception";
          verificationStatus: "approved";
          stateCode: string | null;
          countyFips: string | null;
          evidenceNote: string | null;
          expiresAt: Date | null;
          isActive: true;
        }> = [];

        for (const raw of rawEligibilities) {
          const jurisdictionType = String(raw?.jurisdictionType || "")
            .trim()
            .toLowerCase();
          const eligibilityBasis = String(raw?.eligibilityBasis || "")
            .trim()
            .toLowerCase();

          if (jurisdictionType !== "state" && jurisdictionType !== "county") {
            return res.status(400).json({ message: "Invalid jurisdictionType" });
          }
          if (
            eligibilityBasis !== "state_license" &&
            eligibilityBasis !== "county_license" &&
            eligibilityBasis !== "verified_exception"
          ) {
            return res.status(400).json({ message: "Invalid eligibilityBasis" });
          }

          let stateCode: string | null = null;
          let countyFipsValue: string | null = null;

          if (jurisdictionType === "state") {
            const candidate = String(raw?.stateCode || "")
              .trim()
              .toUpperCase();
            if (!/^[A-Z]{2}$/.test(candidate)) {
              return res
                .status(400)
                .json({ message: "Valid stateCode is required for state eligibility" });
            }
            stateCode = candidate;
          } else {
            const countyFips = String(raw?.countyFips || "").trim();
            if (!/^\d{5}$/.test(countyFips)) {
              return res
                .status(400)
                .json({ message: "Valid countyFips is required for county eligibility" });
            }
            const countyRecord = await storage.getCountyByFips(countyFips);
            if (!countyRecord) {
              return res.status(400).json({ message: `Unknown countyFips: ${countyFips}` });
            }
            countyFipsValue = countyRecord.fips;
            stateCode = countyRecord.stateCode;
          }

          const expiry = raw?.expiresAt ? new Date(raw.expiresAt) : null;
          if (expiry && Number.isNaN(expiry.getTime())) {
            return res.status(400).json({ message: "Invalid expiresAt" });
          }

          sanitized.push({
            jurisdictionType: jurisdictionType as "state" | "county",
            eligibilityBasis: eligibilityBasis as
              | "state_license"
              | "county_license"
              | "verified_exception",
            verificationStatus: "approved",
            stateCode,
            countyFips: countyFipsValue,
            evidenceNote:
              typeof raw?.evidenceNote === "string" && raw.evidenceNote.trim()
                ? raw.evidenceNote.trim()
                : null,
            expiresAt: expiry,
            isActive: true,
          });
        }

        const explicitEligibilities = await storage.replaceProviderEligibilitiesForUser(
          userId,
          sanitized
        );
        const computedEligibilities = await getComputedProviderEligibilitiesForUser(userId);

        res.json({ explicitEligibilities, computedEligibilities });
      } catch (error: any) {
        console.error("Error updating provider eligibilities:", error);
        res.status(500).json({ message: "Failed to update provider eligibilities" });
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

  // Maps v1: awareness-only entities for map surfaces (no direct contact data)
  app.get("/api/map/entities", async (req: Request, res: Response) => {
    try {
      const mapsV1Enabled =
        String(process.env.FEATURE_MAPS_V1 ?? "true")
          .trim()
          .toLowerCase() !== "false";
      if (!mapsV1Enabled) {
        return res.status(404).json({ message: "Maps v1 is disabled", code: "FEATURE_DISABLED" });
      }

      const bboxRaw = typeof req.query.bbox === "string" ? req.query.bbox.trim() : "";
      const bboxParts = bboxRaw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value));

      if (bboxParts.length !== 4) {
        return res
          .status(400)
          .json({ message: "Invalid bbox. Expected minLng,minLat,maxLng,maxLat." });
      }

      const [minLng, minLat, maxLng, maxLat] = bboxParts;
      if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
        return res.status(400).json({ message: "Invalid bbox bounds." });
      }
      if (minLng >= maxLng || minLat >= maxLat) {
        return res.status(400).json({ message: "Invalid bbox order." });
      }

      const typesRaw = typeof req.query.types === "string" ? req.query.types.trim() : "";
      const requestedTypes = (typesRaw ? typesRaw.split(",") : [])
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const allowAllTypes = requestedTypes.length === 0;
      const wants = (t: string) => allowAllTypes || requestedTypes.includes(t);

      const tradeFilter =
        typeof req.query.trade === "string" ? req.query.trade.trim().toLowerCase() : "";
      const verifiedOnly =
        String(req.query.verified || "false")
          .trim()
          .toLowerCase() === "true";
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 1000;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, limitRaw)) : 1000;

      const points: Array<{
        id: string;
        type: string;
        lat: number;
        lng: number;
        title: string;
        subtitle?: string | null;
        href?: string | null;
        meta?: Record<string, unknown>;
      }> = [];

      if (wants("provider")) {
        const providerRoles = [
          "contractor",
          "handyman",
          "service_provider",
          "specialty_tradesperson",
          "realtor",
          "insurance_agent",
          "mortgage_broker",
          "car_dealer",
          "auto_service",
          "inspector",
          "business_owner",
          "commercial_property",
        ] as const;

        const predicates: any[] = [
          sql`${users.latitude} is not null`,
          sql`${users.longitude} is not null`,
          sql`${users.latitude}::numeric between ${minLat} and ${maxLat}`,
          sql`${users.longitude}::numeric between ${minLng} and ${maxLng}`,
          or(sql`${contractors.id} is not null`, inArray(users.role, providerRoles as any)),
        ];

        if (tradeFilter) {
          predicates.push(
            or(
              sql`lower(${trades.slug}) = ${tradeFilter}`,
              sql`lower(${trades.name}) = ${tradeFilter}`
            )
          );
        }

        if (verifiedOnly) {
          predicates.push(
            or(
              eq(contractors.verifiedLicensed, true),
              eq(contractors.verifiedInsured, true),
              eq(users.verificationStatus, "approved" as any)
            )
          );
        }

        const rows = await db
          .select({
            providerId: users.id,
            displayName: sql<string>`
              coalesce(
                nullif(${contractors.companyName}, ''),
                nullif(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')), ''),
                'TradeScout Provider'
              )
            `,
            lat: users.latitude,
            lng: users.longitude,
            role: users.role,
            verifiedLicensed: contractors.verifiedLicensed,
            verifiedInsured: contractors.verifiedInsured,
            userVerificationStatus: users.verificationStatus,
            tradeCategories: sql<
              string[]
            >`coalesce(array_remove(array_agg(distinct ${trades.slug}), null), array[]::text[])`,
          })
          .from(users)
          .leftJoin(contractors, eq(contractors.userId, users.id))
          .leftJoin(contractorTrades, eq(contractorTrades.contractorId, contractors.id))
          .leftJoin(trades, eq(trades.id, contractorTrades.tradeId))
          .where(and(...predicates))
          .groupBy(
            users.id,
            users.firstName,
            users.lastName,
            users.role,
            users.latitude,
            users.longitude,
            users.verificationStatus,
            contractors.id,
            contractors.companyName,
            contractors.verifiedLicensed,
            contractors.verifiedInsured
          )
          .limit(Math.min(limit, 2000));

        const providerIds = rows.map((row) => String(row.providerId));
        const profileRows = providerIds.length
          ? await db
              .select({ ownerUserId: profiles.ownerUserId, slug: profiles.slug })
              .from(profiles)
              .where(
                and(inArray(profiles.ownerUserId, providerIds), eq(profiles.status, "published"))
              )
          : [];

        const canonicalProfileUrlByProviderId = new Map<string, string>();
        for (const row of profileRows) {
          if (!canonicalProfileUrlByProviderId.has(row.ownerUserId)) {
            canonicalProfileUrlByProviderId.set(row.ownerUserId, `/u/${row.slug}`);
          }
        }

        for (const row of rows) {
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const contractorVerified = row.verifiedLicensed === true || row.verifiedInsured === true;
          const userVerified =
            String(row.userVerificationStatus || "").toLowerCase() === "approved";
          const verifiedStatus = contractorVerified || userVerified ? "verified" : "unverified";

          points.push({
            id: String(row.providerId),
            type: "provider",
            lat,
            lng,
            title: row.displayName,
            subtitle: verifiedStatus === "verified" ? "Verified provider" : "Provider",
            href:
              canonicalProfileUrlByProviderId.get(String(row.providerId)) ??
              `/profile/${encodeURIComponent(String(row.providerId))}`,
            meta: {
              role: row.role ?? null,
              verifiedStatus,
              tradeCategories: Array.isArray(row.tradeCategories) ? row.tradeCategories : [],
            },
          });
        }
      }

      if (wants("business")) {
        // Use geo stored inside profile_data.importExtras (no DB migration dependency).
        // Filter bbox in SQL to avoid scanning all active businesses at scale.
        const bizLatExpr = sql<number>`
          nullif(
            coalesce(
              nullif((${businesses.profileData} -> 'importExtras' ->> 'lat')::text, ''),
              nullif((${businesses.profileData} -> 'importExtras' ->> 'latitude')::text, '')
            ),
            ''
          )::numeric
        `;
        const bizLngExpr = sql<number>`
          nullif(
            coalesce(
              nullif((${businesses.profileData} -> 'importExtras' ->> 'lng')::text, ''),
              nullif((${businesses.profileData} -> 'importExtras' ->> 'lon')::text, ''),
              nullif((${businesses.profileData} -> 'importExtras' ->> 'longitude')::text, '')
            ),
            ''
          )::numeric
        `;

        const rows = await db
          .select({
            id: businesses.id,
            name: businesses.name,
            slug: businesses.slug,
            type: businesses.type,
            ownerUserId: businesses.ownerUserId,
            claimStatus: businesses.claimStatus,
            category: sql<
              string | null
            >`nullif((${businesses.profileData} ->> 'category')::text, '')`,
            lat: bizLatExpr,
            lng: bizLngExpr,
            ownerVerificationStatus: users.verificationStatus,
            contractorVerifiedLicensed: contractors.verifiedLicensed,
            contractorVerifiedInsured: contractors.verifiedInsured,
          })
          .from(businesses)
          .leftJoin(users, eq(users.id, businesses.ownerUserId))
          .leftJoin(contractors, eq(contractors.userId, users.id))
          .where(
            and(
              eq(businesses.status, "active" as any),
              sql`${bizLatExpr} is not null`,
              sql`${bizLngExpr} is not null`,
              sql`${bizLatExpr} between ${minLat} and ${maxLat}`,
              sql`${bizLngExpr} between ${minLng} and ${maxLng}`,
              ...(verifiedOnly
                ? [
                    or(
                      eq(users.verificationStatus, "approved" as any),
                      eq(contractors.verifiedLicensed, true),
                      eq(contractors.verifiedInsured, true)
                    ),
                  ]
                : [])
            )
          )
          .limit(Math.min(limit, 5000));

        for (const row of rows) {
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const isClaimed = Boolean(row.ownerUserId) || String(row.claimStatus || "") === "claimed";
          const isVerified =
            String(row.ownerVerificationStatus || "").toLowerCase() === "approved" ||
            row.contractorVerifiedLicensed === true ||
            row.contractorVerifiedInsured === true;
          const verifiedStatus = isVerified ? "verified" : isClaimed ? "unverified" : "directory";

          points.push({
            id: String(row.id),
            type: "business",
            lat,
            lng,
            title: String(row.name || "Business"),
            subtitle:
              verifiedStatus === "verified"
                ? "Verified business"
                : verifiedStatus === "unverified"
                  ? "Business (unverified)"
                  : "Directory listing",
            href: `/business/${encodeURIComponent(String(row.slug))}`,
            meta: {
              businessType: row.type ?? null,
              verifiedStatus,
              claimStatus: row.claimStatus ?? null,
            },
          });
        }
      }

      // For now, other entity types are optional layers and may be empty.
      return res.json({
        points: points.slice(0, limit),
        meta: { count: Math.min(points.length, limit) },
      });
    } catch (error: any) {
      console.error("Error fetching map entities:", error);
      return res.status(500).json({ message: "Failed to fetch map entities" });
    }
  });

  // Maps v1: awareness-only provider discovery (no direct contact data)
  app.get("/api/map/providers", async (req: Request, res: Response) => {
    try {
      const mapsV1Enabled =
        String(process.env.FEATURE_MAPS_V1 ?? "true")
          .trim()
          .toLowerCase() !== "false";
      if (!mapsV1Enabled) {
        return res.status(404).json({ message: "Maps v1 is disabled", code: "FEATURE_DISABLED" });
      }

      const bboxRaw = typeof req.query.bbox === "string" ? req.query.bbox.trim() : "";
      const bboxParts = bboxRaw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value));

      if (bboxParts.length !== 4) {
        return res
          .status(400)
          .json({ message: "Invalid bbox. Expected minLng,minLat,maxLng,maxLat." });
      }

      const [minLng, minLat, maxLng, maxLat] = bboxParts;
      if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
        return res.status(400).json({ message: "Invalid bbox bounds." });
      }
      if (minLng >= maxLng || minLat >= maxLat) {
        return res.status(400).json({ message: "Invalid bbox order." });
      }

      const tradeFilter =
        typeof req.query.trade === "string" ? req.query.trade.trim().toLowerCase() : "";
      const verifiedOnly =
        String(req.query.verified || "false")
          .trim()
          .toLowerCase() === "true";
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 1000;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, limitRaw)) : 1000;

      const providerRoles = [
        "contractor",
        "handyman",
        "service_provider",
        "specialty_tradesperson",
        "realtor",
        "insurance_agent",
        "mortgage_broker",
        "car_dealer",
        "auto_service",
        "inspector",
        "business_owner",
        "commercial_property",
      ] as const;

      const predicates: any[] = [
        sql`${users.latitude} is not null`,
        sql`${users.longitude} is not null`,
        sql`${users.latitude}::numeric between ${minLat} and ${maxLat}`,
        sql`${users.longitude}::numeric between ${minLng} and ${maxLng}`,
        or(sql`${contractors.id} is not null`, inArray(users.role, providerRoles as any)),
      ];

      if (tradeFilter) {
        predicates.push(
          or(
            sql`lower(${trades.slug}) = ${tradeFilter}`,
            sql`lower(${trades.name}) = ${tradeFilter}`
          )
        );
      }

      if (verifiedOnly) {
        predicates.push(
          or(
            eq(contractors.verifiedLicensed, true),
            eq(contractors.verifiedInsured, true),
            eq(users.verificationStatus, "approved" as any)
          )
        );
      }

      const rows = await db
        .select({
          providerId: users.id,
          displayName: sql<string>`
            coalesce(
              nullif(${contractors.companyName}, ''),
              nullif(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')), ''),
              'TradeScout Provider'
            )
          `,
          lat: users.latitude,
          lng: users.longitude,
          countyId: users.countyId,
          countyFips: users.countyFips,
          countyName: users.countyName,
          role: users.role,
          verifiedLicensed: contractors.verifiedLicensed,
          verifiedInsured: contractors.verifiedInsured,
          userVerificationStatus: users.verificationStatus,
          tradeCategories: sql<
            string[]
          >`coalesce(array_remove(array_agg(distinct ${trades.slug}), null), array[]::text[])`,
        })
        .from(users)
        .leftJoin(contractors, eq(contractors.userId, users.id))
        .leftJoin(contractorTrades, eq(contractorTrades.contractorId, contractors.id))
        .leftJoin(trades, eq(trades.id, contractorTrades.tradeId))
        .where(and(...predicates))
        .groupBy(
          users.id,
          users.firstName,
          users.lastName,
          users.countyId,
          users.countyFips,
          users.countyName,
          users.role,
          users.latitude,
          users.longitude,
          users.verificationStatus,
          contractors.id,
          contractors.companyName,
          contractors.verifiedLicensed,
          contractors.verifiedInsured
        )
        .limit(limit);

      const providers = rows
        .map((row) => {
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          const contractorVerified = row.verifiedLicensed === true || row.verifiedInsured === true;
          const userVerified =
            String(row.userVerificationStatus || "").toLowerCase() === "approved";
          const verifiedStatus = contractorVerified || userVerified ? "verified" : "unverified";

          return {
            id: row.providerId,
            displayName: row.displayName,
            lat,
            lng,
            countyId: row.countyId ?? null,
            countyFips: row.countyFips ?? null,
            countyName: row.countyName ?? null,
            tradeCategories: Array.isArray(row.tradeCategories) ? row.tradeCategories : [],
            verifiedStatus,
            role: row.role ?? null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      return res.json({
        providers,
        meta: {
          count: providers.length,
          bbox: { minLng, minLat, maxLng, maxLat },
          filters: {
            trade: tradeFilter || null,
            verifiedOnly,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching map providers:", error);
      return res.status(500).json({ message: "Failed to fetch map providers" });
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
  const ADMIN_WRITE_CONFIRM_PHRASE = "I UNDERSTAND THIS EDIT IS AUDITED";
  const PROTECTED_ADMIN_ROLE_SET = new Set(["moderator", "ops_admin", "super_admin"]);

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
  const isOpsAdminUser = (user: any): boolean => hasRole(user, "ops_admin");
  const canRunOpsUserControls = (user: any): boolean =>
    isSuperAdminUser(user) || isOpsAdminUser(user);

  const isProtectedAdminUser = (user: any): boolean => {
    if (!user) return false;
    for (const role of PROTECTED_ADMIN_ROLE_SET) {
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

    const strictRequired =
      opts?.forceStrict === true || process.env.ADMIN_HARDENED_WRITES === "true";
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
      const adminRoles = new Set(["super_admin", "moderator", "ops_admin"]);
      const hasAdminAccess =
        reqUser.isSuperAdmin === true ||
        reqUser.isAdmin === true ||
        adminRoles.has(normalizeAdminRoleToken(reqRole)) ||
        adminRoles.has(normalizeAdminRoleToken(reqActiveRole)) ||
        reqRoles.some((role: string) => adminRoles.has(normalizeAdminRoleToken(role))) ||
        adminRoles.has(normalizeAdminRoleToken(dbRole)) ||
        adminRoles.has(normalizeAdminRoleToken(dbActiveRole)) ||
        dbRoles.some((role: string) => adminRoles.has(normalizeAdminRoleToken(role)));

      if (!hasAdminAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      const userIds = users
        .map((entry: any) => String(entry?.id || "").trim())
        .filter((id: string) => id.length > 0);

      const profileRows = userIds.length
        ? await db
            .select({ ownerUserId: profiles.ownerUserId, slug: profiles.slug })
            .from(profiles)
            .where(and(inArray(profiles.ownerUserId, userIds), eq(profiles.status, "published")))
        : [];

      const canonicalProfileUrlByUserId = new Map<string, string>();
      for (const row of profileRows) {
        if (!canonicalProfileUrlByUserId.has(row.ownerUserId)) {
          canonicalProfileUrlByUserId.set(row.ownerUserId, `/u/${row.slug}`);
        }
      }

      res.json(
        users.map((entry: any) => ({
          ...entry,
          canonicalProfileUrl: canonicalProfileUrlByUserId.get(String(entry?.id || "")) ?? null,
        }))
      );
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
      const requestedRoleToken = normalizeAdminRoleToken(role);
      const actorRole = normalizeAdminRoleToken(adminUser?.role);

      if (!adminUser || !["super_admin", "moderator", "ops_admin"].includes(actorRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      if (!requestedRoleToken) {
        return res.status(400).json({ message: "role is required" });
      }

      if (!USER_ROLE_ENUM_VALUES.has(requestedRoleToken)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const requestedRole = requestedRoleToken as UserRoleEnumValue;

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      const targetProtected = isProtectedAdminUser(targetUser);
      const actorIsSuperAdmin = isSuperAdminUser(adminUser);

      if (targetProtected && !actorIsSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Only super admins can modify protected admin users" });
      }

      if (PROTECTED_ADMIN_ROLE_SET.has(requestedRole) && !actorIsSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Only super admins can assign protected admin roles" });
      }

      const safety = validateAdminWriteSafety(req.body ?? {}, req.headers as any, {
        forceStrict: targetProtected,
      });
      if (!safety.ok) {
        return res.status(403).json({ message: safety.message });
      }

      const normalizedTargetRole = normalizeAdminRoleToken(targetUser?.role);
      if (normalizedTargetRole === "super_admin" && actorRole !== "super_admin") {
        return res.status(403).json({ message: "Only super admins can modify super admins" });
      }

      const updatedUser = await storage.updateUser(userId, { role: requestedRole });

      await logAdminAction({
        action: "admin_user_role_update",
        actorUserId: adminUserId,
        targetUserId: userId,
        oldRole: targetUser.role,
        newRole: requestedRole,
        protectedTarget: targetProtected,
      });

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
      const actorRole = normalizeAdminRoleToken(adminUser?.role);

      if (!adminUser || !["super_admin", "moderator"].includes(actorRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      const targetProtected = isProtectedAdminUser(targetUser);
      const actorIsSuperAdmin = isSuperAdminUser(adminUser);

      if (targetProtected && !actorIsSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Only super admins can delete protected admin users" });
      }

      const safety = validateAdminWriteSafety(req.body ?? {}, req.headers as any, {
        forceStrict: targetProtected,
      });
      if (!safety.ok) {
        return res.status(403).json({ message: safety.message });
      }

      const normalizedTargetRole = normalizeAdminRoleToken(targetUser?.role);
      if (normalizedTargetRole === "super_admin" && actorRole !== "super_admin") {
        return res.status(403).json({ message: "Only super admins can delete super admins" });
      }

      // Prevent self-deletion
      if (userId === adminUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);

      await logAdminAction({
        action: "admin_user_delete",
        actorUserId: adminUserId,
        targetUserId: userId,
        targetRole: targetUser.role,
        protectedTarget: targetProtected,
      });

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

        if (!adminUser || !canRunOpsUserControls(adminUser)) {
          return res.status(403).json({ message: "Ops admin access required" });
        }

        const { userId } = req.params;
        if (userId === adminUserId) {
          return res.status(400).json({ message: "Cannot suspend your own account" });
        }

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (hasRole(targetUser, "super_admin")) {
          return res.status(403).json({ message: "Cannot suspend a super admin" });
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

        if (!adminUser || !canRunOpsUserControls(adminUser)) {
          return res.status(403).json({ message: "Ops admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        if (
          hasRole(targetUser, "super_admin") &&
          !hasRole(adminUser, "super_admin") &&
          adminUser.id !== targetUser.id
        ) {
          return res.status(403).json({ message: "Cannot modify a super admin account" });
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

        if (!adminUser || !canRunOpsUserControls(adminUser)) {
          return res.status(403).json({ message: "Ops admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }
        if (hasRole(targetUser, "super_admin") && !hasRole(adminUser, "super_admin")) {
          return res.status(403).json({ message: "Cannot modify a super admin account" });
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

        if (!adminUser || !canRunOpsUserControls(adminUser)) {
          return res.status(403).json({ message: "Ops admin access required" });
        }

        const { userId } = req.params;

        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }
        if (hasRole(targetUser, "super_admin") && !hasRole(adminUser, "super_admin")) {
          return res.status(403).json({ message: "Cannot modify a super admin account" });
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

      const actorIsSuper = Boolean(adminUser && hasRole(adminUser, "super_admin"));
      const actorIsOps = Boolean(adminUser && hasRole(adminUser, "ops_admin"));
      if (!adminUser || (!actorIsSuper && !actorIsOps)) {
        return res.status(403).json({ message: "Ops admin access required" });
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

      // Enforce canonical admin tier: no head_admin role in product model.
      newRole = normalizeAdminRoleToken(newRole);

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
      ];

      if (!allowedRoles.includes(newRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (hasRole(targetUser, "super_admin") && !actorIsSuper) {
        return res.status(403).json({ message: "Only super admins can modify super admins" });
      }

      if (!actorIsSuper) {
        const blocked = new Set(["super_admin", "ops_admin", "moderator", "admin"]);
        if (blocked.has(newRole)) {
          return res.status(403).json({ message: "Ops admins cannot assign admin/staff roles" });
        }
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
      const { projectType, squareFootage, countyFips, urgency } = (req.body ?? {}) as any;

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
    requireRole(["super_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { timeframe = "30d" } = req.query;
        const { pricingAnalyticsService } = await import("./pricing-analytics");
        const { hydratePricingAnalyticsWithStarterData } =
          await import("./pricingAnalyticsStarter");

        const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);
        const hydrated = hydratePricingAnalyticsWithStarterData(analytics, timeframe as any);
        res.json(hydrated);
      } catch (error: any) {
        console.error("Error fetching pricing analytics:", error);
        res.status(500).json({ message: "Failed to fetch pricing analytics" });
      }
    }
  );

  app.post(
    "/api/admin/pricing-analytics/update-calculator",
    isAuthenticated,
    requireRole(["super_admin", "ops_admin"]),
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
    requireRole(["super_admin", "ops_admin"]),
    async (req: any, res: any) => {
      try {
        const { timeframe = "30d" } = req.query;
        const { pricingAnalyticsService } = await import("./pricing-analytics");
        const { hydratePricingAnalyticsWithStarterData } =
          await import("./pricingAnalyticsStarter");

        const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);
        const hydrated = hydratePricingAnalyticsWithStarterData(analytics, timeframe as any);

        // Convert analytics to CSV format
        const csvData = [];

        // Add trade data
        for (const [tradeId, data] of Object.entries(hydrated.averageQuotes.byTrade)) {
          csvData.push({
            type: "trade",
            id: tradeId,
            average: data.average,
            count: data.count,
            trend: data.trend,
          });
        }

        // Add region data
        for (const [regionKey, data] of Object.entries(hydrated.averageQuotes.byRegion)) {
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
    requireRole(["super_admin", "ops_admin"]),
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
      const isAdminLike = roles.some((r) => {
        const token = String(r || "")
          .trim()
          .toLowerCase();
        const normalized = token === "owner" || token === "head_admin" ? "super_admin" : token;
        return ["admin", "moderator", "ops_admin", "super_admin"].includes(normalized);
      });

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
      const payload = (req.body ?? {}) as any;
      const rawEventType = typeof payload?.eventType === "string" ? payload.eventType.trim() : "";
      const eventType = rawEventType || "event.unknown";
      const data = payload?.data ?? {};
      const sessionUser = (req as any)?.user ?? null;

      // Never block UX on telemetry writes.
      res.status(204).end();

      void storage
        .logEvent(eventType, {
          ...data,
          userId: sessionUser?.id || data?.userId || null,
          contractorId: sessionUser?.contractorId || data?.contractorId || null,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        })
        .catch((error: any) => {
          console.error("Error persisting /api/events telemetry", error);
        });
    } catch (error: any) {
      console.error("Error logging event:", error);
      // Fail-soft: telemetry should never block the client.
      res.status(204).end();
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
      const roleFromClaimsRaw = req.user?.claims?.role;
      const roleFromClaims =
        typeof roleFromClaimsRaw === "string"
          ? (() => {
              const token = roleFromClaimsRaw.trim().toLowerCase();
              return token === "owner" || token === "head_admin" ? "super_admin" : token;
            })()
          : roleFromClaimsRaw;
      const rawRoles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const roles: string[] = [roleFromClaims, ...(rawRoles || [])].filter(
        (r): r is string => typeof r === "string"
      );

      const isSuperAdminLike = roles.some((r) => {
        const token = String(r || "")
          .trim()
          .toLowerCase();
        const normalized = token === "owner" || token === "head_admin" ? "super_admin" : token;
        return ["super_admin", "ops_admin", "analytics_read"].includes(normalized);
      });
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

        if (!hasPrivilegedVerificationBypass(user) && missingRequirements.length > 0) {
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
    requireRole(["super_admin", "ops_admin"]),
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
    requireRole(["super_admin", "ops_admin"]),
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
    requireRole(["super_admin", "ops_admin", "moderator"]),
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
    requireRole(["super_admin", "ops_admin", "moderator"]),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { action } = (req.body ?? {}) as any; // action: 'approve' or 'reject'
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
      const { limit = 20 } = req.query;

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
      const rawCategoryId =
        typeof req.query.categoryId === "string" ? String(req.query.categoryId).trim() : "";

      const categorySlugToName: Record<string, string> = {
        business: "Sell Your Business",
        "real-estate": "Real Estate",
        vehicles: "Vehicles",
        construction: "Construction Equipment",
        tools: "Tools & Hardware",
        furniture: "Furniture & Home Goods",
        farm: "Farm Equipment",
        "business-equipment": "Business Equipment",
        electronics: "Electronics & Technology",
        sports: "Sports & Recreation",
        collectibles: "Art & Collectibles",
        jewelry: "Jewelry & Luxury Items",
        "local-food": "Local Food & Artisan Goods",
        metals: "Precious Metals (Physical)",
        other: "Other High-Value Items",
      };

      const looksLikeUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

      let resolvedCategoryId: string | undefined;
      if (rawCategoryId) {
        if (looksLikeUuid(rawCategoryId)) {
          resolvedCategoryId = rawCategoryId;
        } else {
          const desiredName = categorySlugToName[rawCategoryId] || rawCategoryId;
          const categories = await storage.getMarketplaceCategories();
          const match = (categories || []).find(
            (c: any) => String(c?.name || "").toLowerCase() === desiredName.toLowerCase()
          );
          if (match?.id) {
            resolvedCategoryId = String(match.id);
          }
        }
      }

      // Exchange is not location-gated. Locality params are treated as a sort preference, not a filter.
      const preferredStateCode =
        typeof req.query.stateCode === "string"
          ? String(req.query.stateCode)
          : typeof req.query.state === "string" && String(req.query.state).length === 2
            ? String(req.query.state)
            : undefined;

      const preferredCountyFips =
        typeof req.query.countyFips === "string"
          ? String(req.query.countyFips)
          : typeof req.query.county === "string" && /^\d{5}$/.test(String(req.query.county))
            ? String(req.query.county)
            : undefined;

      // Resolve county name when caller provides FIPS, so we can prefer either legacy county strings or FIPS.
      let preferredCountyName: string | undefined;
      if (preferredCountyFips) {
        try {
          const countyRow = await storage.getCountyByFips(preferredCountyFips);
          if (countyRow?.name) preferredCountyName = String(countyRow.name);
        } catch {
          // Ignore geo lookup failures; preference ordering can still use FIPS.
        }
      }

      const listings = await storage.getMarketplaceListings({
        categoryId: resolvedCategoryId,
        // Keep explicit county/state filters available for callers that truly want filtering.
        county:
          typeof req.query.filterCounty === "string"
            ? (req.query.filterCounty as string)
            : undefined,
        state:
          typeof req.query.filterState === "string" ? (req.query.filterState as string) : undefined,
        preferredStateCode,
        preferredCountyFips,
        preferredCountyName,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        condition: req.query.condition as string,
        searchQuery: req.query.search as string,
        sortBy: req.query.sort as any,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });

      const sellerIds = Array.from(
        new Set((listings || []).map((l: any) => String(l?.sellerId || "").trim()).filter(Boolean))
      );

      const sellers =
        sellerIds.length > 0
          ? await db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                trustScore: users.trustScore,
                verifiedBadge: users.verifiedBadge,
                emailVerified: users.emailVerified,
                addressVerified: users.addressVerified,
              })
              .from(users)
              .where(inArray(users.id, sellerIds))
          : [];

      const sellerById = new Map<string, any>(sellers.map((s: any) => [String(s.id), s]));

      const mapped = (listings || []).map((listing: any) => {
        const seller = sellerById.get(String(listing?.sellerId || "")) || {};
        const firstName = String(seller?.firstName || "").trim();
        const lastName = String(seller?.lastName || "").trim();
        const sellerName =
          `${firstName} ${lastName}`.trim() ||
          (String(seller?.id || "").trim() ? "TradeScout Member" : "Unknown seller");

        const trustScore = Number(seller?.trustScore ?? 10);
        const rating = Number.isFinite(trustScore)
          ? Math.max(3, Math.min(5, 3 + trustScore / 20))
          : 4.0;

        const city = String(listing?.city || "").trim();
        const county = String(listing?.county || "").trim();
        const state = String(listing?.state || "").trim();
        const location = city
          ? `${city}${state ? `, ${state}` : ""}`
          : `${county || "Local pickup"}${state ? `, ${state}` : ""}`.trim();

        const promotedUntil = listing?.promotedUntil ? new Date(listing.promotedUntil) : null;
        const featured =
          Boolean(listing?.isPromoted) ||
          Boolean(promotedUntil && promotedUntil.getTime() > Date.now());

        return {
          id: String(listing.id),
          title: listing.title,
          description: listing.description,
          price: Number(listing.price),
          category: String(rawCategoryId || listing.categoryId || ""),
          condition: listing.condition,
          images: Array.isArray(listing.images) ? listing.images : [],
          location,
          seller: {
            id: String(listing.sellerId),
            name: sellerName,
            rating,
            verified: Boolean(
              seller?.verifiedBadge || (seller?.emailVerified && seller?.addressVerified)
            ),
          },
          createdAt: listing.createdAt,
          featured,
          views: Number(listing.viewCount || 0),
          favorites: Number(listing.favoriteCount || 0),
        };
      });

      res.json(mapped);
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
      const { search, dealType } = req.query;
      const rows = await storage.listPromotions({
        status: "active",
        limit: 100,
      });

      const loweredSearch = String(search || "")
        .trim()
        .toLowerCase();
      const loweredDealType = String(dealType || "")
        .trim()
        .toLowerCase();
      const mapped = (rows || [])
        .filter((promo: any) => {
          if (loweredDealType && String(promo.type || "").toLowerCase() !== loweredDealType) {
            return false;
          }
          if (loweredSearch) {
            const haystack = [promo.title, promo.shortDescription, promo.ctaLabel]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(loweredSearch);
          }
          return true;
        })
        .map((promo: any) => ({
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

        // Platform Support Inbox: ensure the official TradeScout support thread exists for every user.
        // This is platform-to-user communication (help/safety/announcements), not peer-to-peer contact.
        try {
          const { ensurePlatformSupportThreadForUser } =
            await import("./services/platformSupportInbox");
          await ensurePlatformSupportThreadForUser(String(userId));
        } catch (err) {
          console.warn("[messages] support inbox ensure failed", err);
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

  // Home report sharing (intent-gated thread context)
  app.get(
    "/api/messages/threads/:threadId/home-report",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const threadId = String(req.params.threadId || "").trim();
        if (!threadId) return res.status(400).json({ message: "threadId required" });

        const marketplaceConversation = await storage.getMarketplaceConversation(threadId);
        let threadType: "marketplace" | "legacy" = "marketplace";

        if (marketplaceConversation) {
          if (
            marketplaceConversation.buyerId !== userId &&
            marketplaceConversation.sellerId !== userId
          ) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          const legacyConversation = await storage.getConversation(threadId);
          if (!legacyConversation) return res.status(404).json({ message: "Thread not found" });
          threadType = "legacy";
          if (
            legacyConversation.homeownerId !== userId &&
            legacyConversation.contractorId !== userId
          ) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const shares = await db
          .select()
          .from(homeReportShares)
          .where(
            and(
              eq(homeReportShares.threadId, threadId),
              eq(homeReportShares.threadType, threadType),
              isNull(homeReportShares.revokedAt)
            )
          )
          .orderBy(desc(homeReportShares.createdAt))
          .limit(5);

        const homeIds = shares.map((s: any) => String((s as any).userHomeId || "")).filter(Boolean);
        const homes = homeIds.length
          ? await db.select().from(userHomes).where(inArray(userHomes.id, homeIds))
          : [];
        const homeById = new Map<string, any>(homes.map((h: any) => [String(h.id), h]));

        const projectIds = homeIds.length
          ? (
              await db
                .select({ id: homeProjects.id })
                .from(homeProjects)
                .where(inArray(homeProjects.userHomeId, homeIds))
                .orderBy(desc(homeProjects.updatedAt))
                .limit(200)
            ).map((p: any) => String(p.id))
          : [];

        const plans = projectIds.length
          ? await db
              .select({
                homeProjectId: homeProjectPlans.homeProjectId,
                planType: homeProjectPlans.planType,
                targetAmount: homeProjectPlans.targetAmount,
                monthlyContribution: homeProjectPlans.monthlyContribution,
                targetBy: homeProjectPlans.targetBy,
              })
              .from(homeProjectPlans)
              .where(inArray(homeProjectPlans.homeProjectId, projectIds))
              .orderBy(desc(homeProjectPlans.updatedAt))
          : [];
        const planByProjectId = new Map<string, any>();
        for (const plan of plans as any[]) {
          const pid = String(plan.homeProjectId || "");
          if (pid && !planByProjectId.has(pid)) planByProjectId.set(pid, plan);
        }

        const reports = await Promise.all(
          (shares as any[]).map(async (share) => {
            const homeId = String(share.userHomeId || "");
            const home = homeById.get(homeId);
            if (!home) return null;

            const includeAddress = share.includeAddress === true;
            const includeDocuments = share.includeDocuments === true;

            const safeHome = {
              id: home.id,
              nickname: home.nickname,
              propertyType: home.propertyType,
              yearBuilt: home.yearBuilt,
              city: home.city,
              stateCode: home.stateCode,
              countyFips: home.countyFips,
              ...(includeAddress
                ? {
                    address1: home.address1,
                    address2: home.address2,
                    zipCode: home.zipCode,
                  }
                : {}),
            };

            const records = await db
              .select({
                id: userHomeRecords.id,
                recordType: userHomeRecords.recordType,
                occurredAt: userHomeRecords.occurredAt,
                title: userHomeRecords.title,
                cost: userHomeRecords.cost,
                tags: userHomeRecords.tags,
                createdAt: userHomeRecords.createdAt,
              })
              .from(userHomeRecords)
              .where(eq(userHomeRecords.homeId, homeId))
              .orderBy(desc(userHomeRecords.occurredAt), desc(userHomeRecords.createdAt))
              .limit(50);

            const appliances = await db
              .select({
                id: userHomeAppliances.id,
                category: userHomeAppliances.category,
                brand: userHomeAppliances.brand,
                model: userHomeAppliances.model,
                installedAt: userHomeAppliances.installedAt,
                notes: userHomeAppliances.notes,
                updatedAt: userHomeAppliances.updatedAt,
              })
              .from(userHomeAppliances)
              .where(eq(userHomeAppliances.homeId, homeId))
              .orderBy(desc(userHomeAppliances.updatedAt))
              .limit(80);

            const schedules = await db
              .select({
                id: homeMaintenanceSchedules.id,
                title: homeMaintenanceSchedules.title,
                cadenceDays: homeMaintenanceSchedules.cadenceDays,
                nextDueAt: homeMaintenanceSchedules.nextDueAt,
                lastCompletedAt: homeMaintenanceSchedules.lastCompletedAt,
                status: homeMaintenanceSchedules.status,
                updatedAt: homeMaintenanceSchedules.updatedAt,
              })
              .from(homeMaintenanceSchedules)
              .where(eq(homeMaintenanceSchedules.userHomeId, homeId))
              .orderBy(desc(homeMaintenanceSchedules.updatedAt))
              .limit(80);

            const projects = await db
              .select({
                id: homeProjects.id,
                title: homeProjects.title,
                description: homeProjects.description,
                projectType: homeProjects.projectType,
                status: homeProjects.status,
                estimatedCost: homeProjects.estimatedCost,
                desiredStartAt: homeProjects.desiredStartAt,
                createdAt: homeProjects.createdAt,
                updatedAt: homeProjects.updatedAt,
              })
              .from(homeProjects)
              .where(eq(homeProjects.userHomeId, homeId))
              .orderBy(desc(homeProjects.updatedAt))
              .limit(50);

            const docs = includeDocuments
              ? await db
                  .select({
                    documentType: userHomeDocuments.documentType,
                    originalName: userHomeDocuments.originalName,
                    bytes: userHomeDocuments.bytes,
                    createdAt: userHomeDocuments.createdAt,
                  })
                  .from(userHomeDocuments)
                  .where(eq(userHomeDocuments.homeId, homeId))
                  .orderBy(desc(userHomeDocuments.createdAt))
                  .limit(25)
              : [];

            // Include the latest Homefax snapshot if this home is linked to a Property Program.
            let homefax: any = null;
            const [program] = await db
              .select({ id: propertyPrograms.id })
              .from(propertyPrograms)
              .where(eq(propertyPrograms.userHomeId, homeId))
              .orderBy(desc(propertyPrograms.updatedAt))
              .limit(1);
            if (program?.id) {
              const [snap] = await db
                .select()
                .from(propertyHomefaxSnapshots)
                .where(eq(propertyHomefaxSnapshots.propertyProgramId, program.id))
                .orderBy(desc(propertyHomefaxSnapshots.computedAt))
                .limit(1);
              if (snap) {
                homefax = {
                  computedAt: snap.computedAt,
                  version: snap.version,
                  summary: snap.summary,
                  timeline: snap.timeline,
                };
              }
            }

            return {
              share: {
                id: share.id,
                sharedByUserId: share.sharedByUserId,
                createdAt: share.createdAt,
                includeAddress,
                includeDocuments,
              },
              report: {
                home: safeHome,
                records,
                appliances,
                schedules,
                projects: (projects as any[]).map((p) => ({
                  ...p,
                  plan: planByProjectId.get(String(p.id)) || null,
                })),
                documents: docs,
                homefax,
              },
            };
          })
        );

        res.json({ shares: reports.filter(Boolean) });
      } catch (error: any) {
        console.error("Error fetching shared home report:", error);
        res.status(500).json({ message: "Failed to fetch shared home report" });
      }
    }
  );

  app.post(
    "/api/messages/threads/:threadId/home-report/share",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const threadId = String(req.params.threadId || "").trim();
        if (!threadId) return res.status(400).json({ message: "threadId required" });

        const { homeId, includeAddress, includeDocuments } = (req.body ?? {}) as any;
        const userHomeId = String(homeId || "").trim();
        if (!userHomeId) return res.status(400).json({ message: "homeId required" });

        const marketplaceConversation = await storage.getMarketplaceConversation(threadId);
        let threadType: "marketplace" | "legacy" = "marketplace";

        if (marketplaceConversation) {
          if (
            marketplaceConversation.buyerId !== userId &&
            marketplaceConversation.sellerId !== userId
          ) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          const legacyConversation = await storage.getConversation(threadId);
          if (!legacyConversation) return res.status(404).json({ message: "Thread not found" });
          threadType = "legacy";
          if (
            legacyConversation.homeownerId !== userId &&
            legacyConversation.contractorId !== userId
          ) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const [home] = await db
          .select({ id: userHomes.id, ownerUserId: userHomes.ownerUserId })
          .from(userHomes)
          .where(and(eq(userHomes.id, userHomeId), eq(userHomes.ownerUserId, userId)))
          .limit(1);
        if (!home) return res.status(404).json({ message: "Home not found" });

        const [created] = await db
          .insert(homeReportShares)
          .values({
            ownerUserId: userId,
            sharedByUserId: userId,
            threadId,
            threadType,
            userHomeId,
            includeAddress: includeAddress === true,
            includeDocuments: includeDocuments === true,
            metadata: {},
            updatedAt: new Date(),
          } as any)
          .returning();

        // Keep Homefax and readiness snapshots up-to-date when users take actions linked to a home.
        try {
          const [program] = await db
            .select({ id: propertyPrograms.id })
            .from(propertyPrograms)
            .where(eq(propertyPrograms.userHomeId, userHomeId))
            .orderBy(desc(propertyPrograms.updatedAt))
            .limit(1);
          if (program?.id) {
            const { addPropertyLifecycleEvent } =
              await import("./services/propertyLifecycleService");
            await addPropertyLifecycleEvent({
              propertyProgramId: program.id,
              actionType: "home_report_shared",
              phase: "maintain",
              title: "Home report shared",
              description: "Home report shared inside an intent-gated conversation.",
              occurredAt: new Date(),
              source: "user",
              status: "completed",
              createdByUserId: userId,
              sourceSurface: "messages",
              idempotencyKey: `home:${userHomeId}:thread:${threadId}:home_report_share:${created?.id ?? "missing"}`,
              metadata: {
                threadId,
                threadType,
                userHomeId,
                shareId: created?.id ?? null,
                includeAddress: includeAddress === true,
                includeDocuments: includeDocuments === true,
              },
            } as any);
          }
        } catch (err) {
          console.error("[messages] Failed to sync home_report_shared lifecycle event:", err);
        }

        res.status(201).json({ share: created });
      } catch (error: any) {
        console.error("Error sharing home report:", error);
        res.status(500).json({ message: "Failed to share home report" });
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

    const normalizeRole = (role: unknown): string => {
      const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
      if (!raw) return "";
      return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
    };

    const activeRole = normalizeRole(req.user.activeRole);
    const primaryRole = normalizeRole(req.user.role);
    const roles = Array.isArray(req.user.roles)
      ? req.user.roles.map((r: any) => normalizeRole(r)).filter(Boolean)
      : [];
    const adminRoles = new Set(["moderator", "ops_admin", "super_admin"]);
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
    return res.status(410).json({
      message:
        "Emergency admin access has been disabled. Use normal admin authentication and role-gated admin tools.",
    });
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const listingId = String(req.body?.listingId || "").trim();
      const initialMessage = String(req.body?.initialMessage || "").trim();

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!listingId) {
        return res.status(400).json({ message: "Listing is required" });
      }
      if (!initialMessage) {
        return res.status(400).json({ message: "Request message is required" });
      }

      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      if (String(listing.status || "") !== "active") {
        return res.status(410).json({ message: "Listing is not available for requests" });
      }

      const buyerId = String(userId);
      const sellerId = String(listing.sellerId || "");
      if (!sellerId) {
        return res.status(400).json({ message: "Listing seller unavailable" });
      }
      if (buyerId === sellerId) {
        return res.status(400).json({ message: "Cannot request your own listing" });
      }

      // Keep one conversation per listing + buyer + seller.
      const existingConversation = await storage.getMarketplaceConversationByParticipants(
        listingId,
        buyerId,
        sellerId
      );
      if (existingConversation) {
        return res.status(200).json({
          ...existingConversation,
          created: false,
          message: "Conversation already exists",
        });
      }

      // Enforce request/decision flow before opening direct conversation.
      const { getContactPermission, ensureContactRequest } =
        await import("./utils/contactRequests");
      const permission = await getContactPermission(buyerId, sellerId);
      if (permission?.status === "pending") {
        return res.status(202).json({
          created: false,
          pending: true,
          requestId: permission.lastRequestNotificationId || null,
          message: "Request already pending seller decision.",
        });
      }
      if (permission?.status === "declined" || permission?.status === "blocked") {
        return res.status(403).json({
          created: false,
          reasonCode: "CONTACT_DECLINED",
          message: "Seller declined this contact request.",
        });
      }
      if (permission?.status !== "accepted") {
        const ensure = await ensureContactRequest({
          requesterId: buyerId,
          targetUserId: sellerId,
          preview: initialMessage,
          metadata: {
            contactType: "message",
            content: initialMessage,
            intent: "hire",
            authorityGate: "scout_recommendation",
            decisionScope: `marketplace_listing:${listingId}`,
          },
        });

        if (ensure.status === "pending") {
          return res.status(202).json({
            created: false,
            pending: true,
            requestId: ensure.requestId || null,
            message: "Request sent. Seller must accept before chat opens.",
          });
        }
      }

      const conversation = await storage.createMarketplaceConversation({
        listingId,
        buyerId,
        sellerId,
        status: "active",
        intent: "hire",
        authorityGate: "scout_recommendation",
        decisionScope: `marketplace_listing:${listingId}`,
      } as any);

      await storage.createMarketplaceMessage({
        conversationId: conversation.id,
        senderId: buyerId,
        senderType: "buyer",
        content: initialMessage,
        messageType: "text",
      });

      res.status(201).json({ ...conversation, created: true });
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

  // Private object uploads: returns { uploadURL, objectKey } (no public URL).
  // Used for account-only storage (e.g., private home vault documents).
  app.post("/api/objects/upload-private", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const useR2 = process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID;

      if (useR2) {
        const { R2StorageService } = await import("./localStorage");
        const storageService = new R2StorageService();
        const { uploadURL, objectKey } = await storageService.getPrivateUploadURL(userId);
        return res.json({ uploadURL, objectKey });
      }

      const { LocalStorageService } = await import("./localStorage");
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

      const { LocalStorageService } = await import("./localStorage");
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

      const { LocalStorageService } = await import("./localStorage");
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

        await logAdminAction({
          action: "admin_user_reset_password",
          actorUserId: actorId,
          targetUserId: target.id,
          targetEmail: target.email,
          protectedTarget: targetProtected,
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
        if (!targetUserId) return res.status(400).json({ message: "userId is required" });

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

        await logAdminAction({
          action: "admin_user_profile_update",
          actorUserId: actorId,
          targetUserId,
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
  // Requires explicit reason + confirm phrase. Optionally requires ADMIN_SAFETY_KEY if configured.
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

        const reason = String(adminSafety.reason || "").trim();
        if (reason.length < 12) {
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

        const targetUserId = String(body.targetUserId || "").trim();
        const targetEmail = String(body.targetEmail || "")
          .trim()
          .toLowerCase();

        if (!targetUserId && !targetEmail) {
          return res.status(400).json({ message: "Provide targetUserId or targetEmail" });
        }

        const target = targetUserId
          ? await storage.getUser(targetUserId)
          : await storage.getUserByEmail(targetEmail);

        if (!target) {
          return res.status(404).json({ message: "Target user not found" });
        }

        const actor = await storage.getUser(actorId);
        if (!actor) {
          return res.status(401).json({ message: "Actor not found" });
        }

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

        await logAdminAction({
          action: "admin_support_user_edit",
          actorUserId: actorId,
          targetUserId: target.id,
          targetEmail: target.email,
          reason,
          protectedTarget: targetProtected,
          changedFields: [
            ...changedUserKeys,
            ...changedPreferenceKeys.map((k) => `preferences.${k}`),
          ],
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
        const { token } = passwordResetService.createToken(user.id);
        resetLink = `${publicBase}/reset-password?token=${token}`;
      }

      if (emailVerificationRequired && user.emailVerified !== true) {
        const verify = emailVerificationService.createToken(user.id);
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

  // Admin: bulk import business owner accounts (CSV/TSV/text)
  const multer = (await import("multer")).default;
  const businessImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Number(process.env.BUSINESS_IMPORT_FILE_LIMIT_BYTES || 25 * 1024 * 1024),
    },
  });
  const businessImportMaybeUploadFile = (req: any, res: any, next: any) => {
    const contentType = String(req.headers?.["content-type"] || "");
    if (!contentType.toLowerCase().includes("multipart/form-data")) return next();
    return businessImportUpload.single("file")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err?.message || "File upload failed" });
      }
      next();
    });
  };

  app.post(
    "/api/admin/businesses/import",
    isAuthenticated,
    isAdmin,
    businessImportMaybeUploadFile,
    // Accept text/csv uploads directly to avoid JSON body-size limits (413) in production.
    express.text({
      type: ["text/plain", "text/csv", "text/tab-separated-values"],
      limit: process.env.BUSINESS_IMPORT_TEXT_LIMIT || "25mb",
    }),
    async (req: any, res: any) => {
      try {
        const uploadedFile = (req as any).file as
          | { originalname?: string; mimetype?: string; buffer?: Buffer }
          | undefined;
        const uploadName = String(uploadedFile?.originalname || "")
          .trim()
          .toLowerCase();
        const isXlsxUpload = Boolean(uploadedFile?.buffer) && uploadName.endsWith(".xlsx");

        const rawBody = req.body;
        const body = rawBody && typeof rawBody === "object" ? (rawBody as any) : {};
        const content =
          typeof rawBody === "string"
            ? rawBody
            : typeof body.content === "string"
              ? body.content
              : "";

        const readBool = (value: any): boolean => {
          if (value === true) return true;
          const v = String(value ?? "")
            .trim()
            .toLowerCase();
          return v === "true" || v === "1" || v === "yes" || v === "y";
        };

        const readStr = (value: any): string => (typeof value === "string" ? value : "").trim();

        const query = (req.query ?? {}) as any;
        const dryRun = readBool(body.dryRun ?? query.dryRun ?? query.dry_run);
        const sendActivationEmails = readBool(
          body.sendActivationEmails ?? query.sendActivationEmails ?? query.send_activation_emails
        );
        const includeActivationLinks = readBool(
          body.includeActivationLinks ??
            query.includeActivationLinks ??
            query.include_activation_links
        );
        // Default to importing directory entries (unclaimed businesses). Creating real auth users
        // from an import is powerful and should be opt-in to avoid inflating "site user" counts.
        const requestedCreateOwnerAccounts = readBool(
          body.createOwnerAccounts ??
            body.create_owner_accounts ??
            body.createUsers ??
            body.create_users ??
            query.createOwnerAccounts ??
            query.create_owner_accounts ??
            query.createUsers ??
            query.create_users
        );
        // Safety: creating real auth users via bulk import must be explicitly confirmed.
        // This prevents accidental inflation of user counts and unintended account creation.
        const confirmCreateUsers = readStr(
          body.confirmCreateUsers ??
            body.confirm_create_users ??
            query.confirmCreateUsers ??
            query.confirm_create_users
        );
        const createOwnerAccounts =
          requestedCreateOwnerAccounts && confirmCreateUsers === "CREATE_USERS";
        const createPublicProfiles = readBool(
          body.createPublicProfiles ?? query.createPublicProfiles ?? query.create_public_profiles
        );
        const defaultCountyFips = readStr(
          body.defaultCountyFips ?? query.defaultCountyFips ?? query.default_county_fips
        );
        const defaultStateCode = readStr(
          body.defaultStateCode ?? query.defaultStateCode ?? query.default_state_code
        );
        const sourceLabelRaw = readStr(body.source ?? query.source);
        const sourceLabel = (sourceLabelRaw || "admin_import").toLowerCase().slice(0, 64);

        if (!isXlsxUpload && !content.trim()) {
          return res.status(400).json({ message: "content is required (or upload an .xlsx file)" });
        }

        const isProductionEnv =
          process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
        const allowActivationLinkExport =
          process.env.ADMIN_ALLOW_ACTIVATION_LINK_EXPORT === "true" || !isProductionEnv;
        // Guardrails: activation links/emails and profile provisioning only make sense when we are
        // explicitly creating owner accounts (users). If we're importing directory entries only,
        // ignore these flags even if the client sends them.
        const sendActivationEmailsEffective = sendActivationEmails && createOwnerAccounts;
        const includeActivationLinksEffective = includeActivationLinks && createOwnerAccounts;
        const createPublicProfilesEffective = createPublicProfiles && createOwnerAccounts;

        let lastParseMeta: {
          looksLikeHeader: boolean;
          headers: string[];
          delimiter: string;
        } | null = null;

        const parseDelimited = (
          input: string,
          delimiter: string
        ): Array<Record<string, string>> => {
          const normalizeHeaderKey = (value: unknown): string =>
            String(value || "")
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "")
              .replace(/_+/g, "_");

          const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          const rows: string[][] = [];
          let row: string[] = [];
          let field = "";
          let inQuotes = false;

          const pushField = () => {
            row.push(field);
            field = "";
          };

          const pushRow = () => {
            // Trim trailing empty columns
            while (row.length > 0 && row[row.length - 1] === "") row.pop();
            if (row.length > 0) rows.push(row);
            row = [];
          };

          for (let i = 0; i < normalized.length; i++) {
            const ch = normalized[i];
            if (inQuotes) {
              if (ch === '"') {
                const next = normalized[i + 1];
                if (next === '"') {
                  field += '"';
                  i++;
                } else {
                  inQuotes = false;
                }
              } else {
                field += ch;
              }
              continue;
            }

            if (ch === '"') {
              inQuotes = true;
              continue;
            }
            if (ch === delimiter) {
              pushField();
              continue;
            }
            if (ch === "\n") {
              pushField();
              pushRow();
              continue;
            }
            field += ch;
          }

          pushField();
          pushRow();

          if (!rows.length) return [];

          const headerRowRaw = rows[0];
          const headerRow = headerRowRaw.map((h) => normalizeHeaderKey(h));

          // Header detection is intentionally conservative to avoid dropping the first data row.
          // We only treat row[0] as a header if the "header-looking" keys align with the
          // shape of row[1] (e.g., an email column whose next row contains '@').
          const looksLikeHeader = (() => {
            if (headerRow.length < 2) return false;

            const nextRow = rows.length > 1 ? rows[1] : [];
            const peek = (idx: number) =>
              typeof nextRow[idx] === "string"
                ? nextRow[idx].trim()
                : String(nextRow[idx] ?? "").trim();

            const isEmailValue = (value: string) => value.includes("@") && value.includes(".");
            const isFipsValue = (value: string) => /^[0-9]{5}$/.test(value);
            const isPhoneValue = (value: string) => value.replace(/\D/g, "").length >= 10;

            let score = 0;
            let hasStrongSignal = false;

            for (let i = 0; i < headerRow.length; i++) {
              const key = headerRow[i] || "";
              const sample = peek(i);
              if (!key) continue;

              const keyIsEmail =
                key === "email" ||
                key.endsWith("_email") ||
                key.includes("email") ||
                key === "invitee_email";
              const keyIsName =
                key === "business_name" ||
                key === "company_name" ||
                key === "company" ||
                key === "trade_name" ||
                key === "dba" ||
                key === "legal_name" ||
                key === "name";
              const keyIsFips =
                key === "county_fips" || key === "fips" || key.includes("county_fips");
              const keyIsPhone =
                key === "phone" || key.endsWith("_phone") || key.includes("phone") || key === "tel";

              if (keyIsEmail) {
                hasStrongSignal = true;
                if (sample && isEmailValue(sample)) score += 2;
                continue;
              }
              if (keyIsFips) {
                hasStrongSignal = true;
                if (sample && isFipsValue(sample)) score += 1;
                continue;
              }
              if (keyIsPhone) {
                if (sample && isPhoneValue(sample)) score += 1;
                continue;
              }
              if (keyIsName) {
                if (sample && !isEmailValue(sample)) score += 1;
              }
            }

            // If we only have one row, fall back to legacy hint matching (still conservative).
            if (rows.length === 1) {
              return headerRow.some((h) =>
                [
                  "email",
                  "business_name",
                  "company_name",
                  "name",
                  "company",
                  "phone",
                  "county_fips",
                  "fips",
                  "state_code",
                  "website",
                ].includes(h)
              );
            }

            return hasStrongSignal && score >= 2;
          })();

          const headers = looksLikeHeader
            ? headerRow
            : [
                "email",
                "business_name",
                "county_fips",
                "state_code",
                "phone",
                "website",
                "category",
                "services",
                "owner_first_name",
                "owner_last_name",
              ];

          const dataRows = looksLikeHeader ? rows.slice(1) : rows;

          lastParseMeta = {
            looksLikeHeader,
            headers,
            delimiter,
          };

          return dataRows
            .map((cols) => {
              const rec: Record<string, string> = {};
              for (let idx = 0; idx < headers.length; idx++) {
                const key = headers[idx] || `col_${idx}`;
                rec[key] =
                  typeof cols[idx] === "string" ? cols[idx].trim() : String(cols[idx] ?? "").trim();
              }
              return rec;
            })
            .filter((r) => Object.values(r).some((v) => String(v || "").trim().length > 0));
        };

        const detectDelimiter = (input: string): string => {
          const sample = input.slice(0, 4000);
          const comma = (sample.match(/,/g) || []).length;
          const semi = (sample.match(/;/g) || []).length;
          const tab = (sample.match(/\t/g) || []).length;
          const pipe = (sample.match(/\|/g) || []).length;
          if (tab >= comma && tab >= pipe && tab >= semi && tab > 0) return "\t";
          if (pipe >= comma && pipe >= semi && pipe > 0) return "|";
          if (semi >= comma && semi > 0) return ";";
          return ",";
        };

        let delimiter = detectImportDelimiter(content);
        let records: Array<Record<string, string>> = [];
        let parseFile: any = null;

        if (isXlsxUpload) {
          const parsedXlsx = parseXlsxImport(uploadedFile!.buffer as Buffer);
          records = parsedXlsx.records;
          parseFile = parsedXlsx.meta;
          // Keep response delimiter stable for the existing client UI.
          delimiter = ",";
          lastParseMeta = null;
        } else {
          const parsed = parseDelimitedImport(content, delimiter);
          records = parsed.records;
          lastParseMeta = parsed.meta;
        }
        if (!records.length) {
          return res.status(400).json({ message: "No rows found to import" });
        }

        const normalizeEmail = (value: unknown) =>
          String(value || "")
            .trim()
            .toLowerCase();

        const getFirstNonEmpty = (rec: Record<string, string>, keys: string[]): string => {
          for (const key of keys) {
            const raw = rec[key];
            if (typeof raw === "string" && raw.trim()) return raw.trim();
          }
          return "";
        };

        const normalizeServices = (value: unknown): string[] => {
          const raw = String(value || "").trim();
          if (!raw) return [];
          return Array.from(
            new Set(
              raw
                // Allow comma-separated category lists (e.g. Maps-scraper exports).
                .split(/[;,|]/g)
                .map((s) => s.trim())
                .filter(Boolean)
            )
          ).slice(0, 50);
        };

        const slugify = (text: string): string =>
          String(text || "")
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80);

        const STATE_NAME_TO_CODE: Record<string, string> = {
          alabama: "AL",
          alaska: "AK",
          arizona: "AZ",
          arkansas: "AR",
          california: "CA",
          colorado: "CO",
          connecticut: "CT",
          delaware: "DE",
          florida: "FL",
          georgia: "GA",
          hawaii: "HI",
          idaho: "ID",
          illinois: "IL",
          indiana: "IN",
          iowa: "IA",
          kansas: "KS",
          kentucky: "KY",
          louisiana: "LA",
          maine: "ME",
          maryland: "MD",
          massachusetts: "MA",
          michigan: "MI",
          minnesota: "MN",
          mississippi: "MS",
          missouri: "MO",
          montana: "MT",
          nebraska: "NE",
          nevada: "NV",
          "new hampshire": "NH",
          "new jersey": "NJ",
          "new mexico": "NM",
          "new york": "NY",
          "north carolina": "NC",
          "north dakota": "ND",
          ohio: "OH",
          oklahoma: "OK",
          oregon: "OR",
          pennsylvania: "PA",
          "rhode island": "RI",
          "south carolina": "SC",
          "south dakota": "SD",
          tennessee: "TN",
          texas: "TX",
          utah: "UT",
          vermont: "VT",
          virginia: "VA",
          washington: "WA",
          "west virginia": "WV",
          wisconsin: "WI",
          wyoming: "WY",
          "district of columbia": "DC",
        };

        const normalizeStateCodeLoose = (input: unknown): string => {
          const raw = String(input || "").trim();
          if (!raw) return "";
          const upper = raw.toUpperCase();
          if (/^[A-Z]{2}$/.test(upper)) return upper;
          const name = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
          return STATE_NAME_TO_CODE[name] || "";
        };

        const inferStateCodeFromLooseAddress = (input: unknown): string => {
          const raw = String(input || "").trim();
          if (!raw) return "";
          const match2 = raw.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/);
          if (match2?.[1]) return match2[1];
          const matchName = raw
            .toLowerCase()
            .replace(/\./g, "")
            .replace(/\s+/g, " ")
            .trim()
            .match(/\b([a-z]+(?:\s+[a-z]+)*)\b(?:\s+\d{5}(?:-\d{4})?)?$/);
          const tail = matchName?.[1] ? normalizeStateCodeLoose(matchName[1]) : "";
          return tail || "";
        };

        const inferZipFromLooseAddress = (input: unknown): string => {
          const raw = String(input || "").trim();
          if (!raw) return "";
          const match = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
          return match?.[1] || "";
        };

        const inferCityFromLooseAddress = (input: unknown): string => {
          const raw = String(input || "").trim();
          if (!raw) return "";
          const comma = raw.match(/^\s*([^,]+)\s*,\s*[A-Z]{2}\b/);
          if (comma?.[1]) return comma[1].trim();
          const space = raw.match(/^\s*(.+?)\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/);
          if (space?.[1]) return space[1].trim();
          return "";
        };

        const ensureUniqueBusinessProfileSlug = async (base: string, userId: string) => {
          const baseSlug = slugify(base) || randomUUID();
          let candidate = baseSlug;
          for (let attempt = 0; attempt < 50; attempt++) {
            const existing = await storage.getBusinessProfileBySlug(candidate);
            if (!existing || existing.userId === userId) return candidate;
            candidate = `${baseSlug}-${attempt + 2}`;
          }
          return `${baseSlug}-${randomUUID().slice(0, 8)}`;
        };

        // Preload county lookups (FIPS -> county row)
        const allFips = Array.from(
          new Set(
            records
              .map((r) => String(r.county_fips || r.countyfips || r.fips || "").trim())
              .filter(Boolean)
              .concat(defaultCountyFips ? [defaultCountyFips] : [])
          )
        );
        const countyRows = allFips.length
          ? await db
              .select({
                id: counties.id,
                fips: counties.fips,
                name: counties.name,
                stateCode: counties.stateCode,
              })
              .from(counties)
              .where(inArray(counties.fips, allFips))
          : [];
        const countyByFips = new Map<string, (typeof countyRows)[number]>();
        for (const c of countyRows) countyByFips.set(String(c.fips), c);

        const resetBase =
          process.env.PASSWORD_RESET_URL || process.env.APP_BASE_URL || "http://localhost:5173";

        const results: any[] = [];
        let createdUsers = 0;
        let updatedUsers = 0;
        let createdBusinesses = 0;
        let updatedBusinesses = 0;
        let createdUnclaimedBusinesses = 0;
        let updatedUnclaimedBusinesses = 0;
        let createdPublicProfiles = 0;
        let activationPrepared = 0;
        let activationEmailed = 0;

        for (let idx = 0; idx < records.length; idx++) {
          const rec = records[idx] || {};
          const email = normalizeEmail(
            getFirstNonEmpty(rec, [
              "email",
              "owner_email",
              "invitee_email",
              "business_email",
              "contact_email",
              "email_address",
              "emailaddress",
              "primary_email",
              "primaryemail",
            ])
          );
          const businessName = getFirstNonEmpty(rec, [
            "business_name",
            "businessname",
            "business",
            "name",
            "company_name",
            "companyname",
            "company",
            "trade_name",
            "tradename",
            "dba",
            "legal_name",
            "legalname",
            "organization",
            "organization_name",
            "organizationname",
            "org_name",
            "orgname",
            "listing_name",
            "listingname",
            "provider_name",
            "providername",
          ]);
          const countyFips =
            getFirstNonEmpty(rec, [
              "county_fips",
              "countyfips",
              "fips",
              "county_fips_code",
              "fips_code",
              "fipscode",
            ]).trim() ||
            defaultCountyFips ||
            "";
          const stateCodeRaw =
            getFirstNonEmpty(rec, [
              "state_code",
              "statecode",
              "state",
              "st",
              "sourcestate",
            ]).trim() ||
            defaultStateCode ||
            "";
          const muni = getFirstNonEmpty(rec, ["municipality", "city_state_zip", "city"]);
          const cityRaw = getFirstNonEmpty(rec, ["city", "city_name", "town", "locality"]);
          const zipRaw = getFirstNonEmpty(rec, [
            "zip",
            "zip_code",
            "zipcode",
            "postal_code",
            "postcode",
          ]);
          const address1 = getFirstNonEmpty(rec, [
            "address_1",
            "address1",
            "address_line_1",
            "address_line1",
            "street_address",
            "street_address_1",
            "street1",
            "street_1",
            "street",
            "address",
            "mailing_address",
          ]);
          const address2 = getFirstNonEmpty(rec, [
            "address_2",
            "address2",
            "address_line_2",
            "address_line2",
            "street_address_2",
            "street2",
            "street_2",
            "suite",
            "unit",
          ]);
          const fulladdr = getFirstNonEmpty(rec, [
            "fulladdress",
            "full_address",
            "mailing_address",
            "address",
            "street",
          ]);
          const stateCode =
            normalizeStateCodeLoose(stateCodeRaw) ||
            inferStateCodeFromLooseAddress(muni) ||
            inferStateCodeFromLooseAddress(fulladdr) ||
            "";
          const city =
            cityRaw || inferCityFromLooseAddress(muni) || inferCityFromLooseAddress(fulladdr) || "";
          const zipCode =
            zipRaw || inferZipFromLooseAddress(muni) || inferZipFromLooseAddress(fulladdr) || "";
          const streetAddress =
            [address1, address2].filter(Boolean).join(", ").trim() || address1 || "";
          const phone = getFirstNonEmpty(rec, [
            "phone",
            "phone_number",
            "business_phone",
            "contact_phone",
            "telephone",
            "tel",
            "mobile",
            "mobile_phone",
            "mobilephone",
            "cell",
            "cell_phone",
            "cellphone",
            "primary_phone",
            "primaryphone",
            "main_phone",
            "mainphone",
          ]);
          const website = getFirstNonEmpty(rec, [
            "website",
            "website_url",
            "websiteurl",
            "homepage",
            "domain",
            "url",
            "web",
            "site",
          ]);
          const category = getFirstNonEmpty(rec, [
            "category",
            "categories",
            "business_category",
            "industry",
          ]);
          const services = normalizeServices(
            getFirstNonEmpty(rec, ["services", "service_list", "categories"])
          );

          const latStr = getFirstNonEmpty(rec, ["lat", "latitude", "y"]);
          const lngStr = getFirstNonEmpty(rec, ["lng", "lon", "longitude", "x"]);
          const lat = latStr ? Number.parseFloat(String(latStr)) : NaN;
          const lng = lngStr ? Number.parseFloat(String(lngStr)) : NaN;
          const hasLatLng = Number.isFinite(lat) && Number.isFinite(lng);

          const licenseNumber = getFirstNonEmpty(rec, [
            "license_number",
            "licensenumber",
            "license",
          ]).trim();
          const licenseStatus = getFirstNonEmpty(rec, ["license_status", "status"]).trim();
          const licenseExpiresAt = getFirstNonEmpty(rec, [
            "license_expires_at",
            "expireson",
            "expires_on",
          ]).trim();

          const osmType = getFirstNonEmpty(rec, ["osm_type", "osmtype"]).trim();
          const osmId = getFirstNonEmpty(rec, ["osm_id", "osmid"]).trim();
          const categoryId = getFirstNonEmpty(rec, ["category_id", "categoryid"]).trim();
          const categoryLabel = getFirstNonEmpty(rec, ["category_label", "categorylabel"]).trim();

          const businessTypeRaw = getFirstNonEmpty(rec, ["business_type", "businesstype", "type"])
            .trim()
            .toLowerCase();
          const roleContextRaw = getFirstNonEmpty(rec, ["role_context", "rolecontext"])
            .trim()
            .toLowerCase();

          const inferredBusinessType = (() => {
            const raw = businessTypeRaw;
            const normalized =
              raw === "contractor" || raw === "community" || raw === "vendor" || raw === "other"
                ? raw
                : raw.includes("contract")
                  ? "contractor"
                  : raw.includes("vendor") || raw.includes("retail") || raw.includes("store")
                    ? "vendor"
                    : raw.includes("community")
                      ? "community"
                      : "";

            if (normalized) return normalized as "contractor" | "community" | "vendor" | "other";
            if (licenseNumber) return "contractor" as const;

            const hint = `${category} ${categoryId} ${categoryLabel}`.toLowerCase();
            if (
              hint.includes("supply") ||
              hint.includes("materials") ||
              hint.includes("lumber") ||
              hint.includes("equipment") ||
              hint.includes("tool") ||
              hint.includes("rental")
            ) {
              return "vendor" as const;
            }

            return "other" as const;
          })();

          const inferredRoleContext = (() => {
            // Keep this conservative: role_context is a user_role enum, but imports are directory entities.
            if (
              roleContextRaw === "contractor" ||
              roleContextRaw === "business_owner" ||
              roleContextRaw === "community_builder"
            ) {
              return roleContextRaw as "contractor" | "business_owner" | "community_builder";
            }
            if (inferredBusinessType === "contractor") return "contractor" as const;
            if (inferredBusinessType === "community") return "community_builder" as const;
            return "business_owner" as const;
          })();

          const externalId =
            licenseNumber && stateCode
              ? `license:${stateCode}:${licenseNumber}`
              : osmType && osmId
                ? `osm:${osmType}:${osmId}`
                : "";

          const normalizedWebsite = String(website || "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .replace(/\/+$/, "");
          const normalizedPhone = String(phone || "").replace(/\D/g, "");

          const dedupeKey = externalId
            ? externalId
            : normalizedWebsite
              ? `web:${normalizedWebsite}`
              : normalizedPhone
                ? `phone:${normalizedPhone}`
                : `name:${slugify(businessName)}:${stateCode || ""}:${inferZipFromLooseAddress(muni) || inferZipFromLooseAddress(fulladdr) || ""}`;
          const ownerFirstName = getFirstNonEmpty(rec, [
            "owner_first_name",
            "first_name",
            "contact_first_name",
          ]);
          const ownerLastName = getFirstNonEmpty(rec, [
            "owner_last_name",
            "last_name",
            "contact_last_name",
          ]);

          const rowRef = { row: idx + 1, email, businessName, countyFips };

          if (!businessName) {
            results.push({ ...rowRef, status: "error", error: "Missing business_name" });
            continue;
          }
          if (email && !email.includes("@")) {
            results.push({ ...rowRef, status: "error", error: "Invalid email" });
            continue;
          }

          if (countyFips && !/^[0-9]{5}$/.test(countyFips)) {
            results.push({ ...rowRef, status: "error", error: "Invalid county_fips" });
            continue;
          }

          const county = countyFips ? countyByFips.get(countyFips) : null;
          if (countyFips && !county) {
            results.push({
              ...rowRef,
              status: "error",
              error: `Unknown county_fips (${countyFips})`,
            });
            continue;
          }

          const resolvedStateCode = stateCode || county?.stateCode || "";

          try {
            const hasOwnerEmail = Boolean(email);
            const shouldCreateOwnerAccounts = hasOwnerEmail && createOwnerAccounts;
            const countyIds = county?.id ? [county.id] : [];

            let userId: string | null = null;
            let businessId: string | null = null;
            let profileSlug: string | null = null;
            let publicProfileSlug: string | null = null;

            const knownKeys = new Set([
              "email",
              "owner_email",
              "invitee_email",
              "business_email",
              "contact_email",
              "business_name",
              "business",
              "name",
              "company_name",
              "company",
              "trade_name",
              "dba",
              "legal_name",
              "organization",
              "org_name",
              "county_fips",
              "countyfips",
              "fips",
              "county_fips_code",
              "state_code",
              "state",
              "st",
              "phone",
              "phone_number",
              "business_phone",
              "contact_phone",
              "telephone",
              "tel",
              "website",
              "url",
              "web",
              "site",
              "category",
              "business_category",
              "industry",
              "services",
              "service_list",
              "owner_first_name",
              "first_name",
              "contact_first_name",
              "owner_last_name",
              "last_name",
              "contact_last_name",
              "mailing_address",
              "address_1",
              "address1",
              "address_line_1",
              "address_line1",
              "street_address",
              "street_address_1",
              "street1",
              "street_1",
              "address_2",
              "address2",
              "address_line_2",
              "address_line2",
              "street_address_2",
              "street2",
              "street_2",
              "suite",
              "unit",
              "fulladdress",
              "full_address",
              "address",
              "street",
              "municipality",
              "city_state_zip",
              "city",
              "zip",
              "zip_code",
              "zipcode",
              "postal_code",
              "postcode",
              "lat",
              "latitude",
              "lng",
              "lon",
              "longitude",
              "osm_type",
              "osmtype",
              "osm_id",
              "osmid",
              "category_id",
              "categoryid",
              "category_label",
              "categorylabel",
              "license_number",
              "licensenumber",
              "license_status",
              "license_expires_at",
              "expireson",
              "expires_on",
              "sourcestate",
              "external_id",
              "businesstype",
              "business_type",
              "rolecontext",
              "role_context",
            ]);
            const importExtras: Record<string, string> = {};
            for (const [key, value] of Object.entries(rec)) {
              if (knownKeys.has(key)) continue;
              const v = String(value || "").trim();
              if (!v) continue;
              // Preserve any extra indexed columns so they can be used later.
              importExtras[key] = v;
            }
            // Stable dedupe key for repeatable imports across chunks/files.
            if (dedupeKey && !importExtras.dedupe_key) importExtras.dedupe_key = dedupeKey;
            if (externalId && !importExtras.external_id) importExtras.external_id = externalId;
            // Preserve contact hints for later claim/verification flows without creating users.
            if (email && !importExtras.owner_email) importExtras.owner_email = email;
            if (ownerFirstName && !importExtras.owner_first_name)
              importExtras.owner_first_name = ownerFirstName;
            if (ownerLastName && !importExtras.owner_last_name)
              importExtras.owner_last_name = ownerLastName;
            if (streetAddress && !importExtras.address) importExtras.address = streetAddress;
            if (address1 && !importExtras.address_1) importExtras.address_1 = address1;
            if (address2 && !importExtras.address_2) importExtras.address_2 = address2;
            if (city && !importExtras.city) importExtras.city = city;
            if (zipCode && !importExtras.zip_code) importExtras.zip_code = zipCode;
            if (resolvedStateCode && !importExtras.state_code)
              importExtras.state_code = resolvedStateCode;

            if (shouldCreateOwnerAccounts) {
              const existingUser = await storage.getUserByEmail(email);
              let userRecord = existingUser;

              if (!existingUser) {
                if (dryRun) {
                  userRecord = {
                    id: "__dry_run__",
                    email,
                  } as any;
                } else {
                  userRecord = await storage.createUser({
                    email,
                    phone: phone || undefined,
                    address: (streetAddress || fulladdr || "").trim() || undefined,
                    city: city || undefined,
                    stateCode: resolvedStateCode || undefined,
                    zipCode: zipCode || undefined,
                    firstName: ownerFirstName || businessName || undefined,
                    lastName: ownerLastName || undefined,
                    role: "business_owner" as any,
                    roles: ["business_owner"],
                    activeRole: "business_owner",
                    onboardingCompleted: false,
                    profileVersion: 0,
                    provider: "local",
                  } as any);
                }
                createdUsers++;
              } else {
                const currentRoles: string[] = Array.isArray((existingUser as any).roles)
                  ? ((existingUser as any).roles as string[])
                  : [];
                const nextRoles = Array.from(new Set([...currentRoles, "business_owner"]));
                if (!dryRun && nextRoles.length !== currentRoles.length) {
                  await storage.updateUser(existingUser.id, { roles: nextRoles } as any);
                  updatedUsers++;
                }
              }

              userId = String((userRecord as any).id);

              // Create/attach a business entity record (draft)
              if (!dryRun && userId && userId !== "__dry_run__") {
                const existingBiz = await db
                  .select({ id: businesses.id, name: businesses.name })
                  .from(businesses)
                  .where(
                    and(
                      eq(businesses.ownerUserId, userId),
                      sql`lower(${businesses.name}) = ${businessName.toLowerCase()}`
                    )
                  )
                  .limit(1);

                if (existingBiz.length > 0) {
                  businessId = existingBiz[0].id;
                  updatedBusinesses++;
                } else {
                  const createdBiz = await storage.createBusinessForOwner(userId, {
                    name: businessName,
                    slug: businessName,
                    type: "other" as any,
                    roleContext: "business_owner" as any,
                    profileData: {
                      category: category || undefined,
                      services: services.length ? services : undefined,
                      website: website || undefined,
                      phone: phone || undefined,
                      email,
                      address: (streetAddress || "").trim() || undefined,
                      city: city || undefined,
                      stateCode: resolvedStateCode || undefined,
                      zipCode: zipCode || undefined,
                      importExtras: Object.keys(importExtras).length ? importExtras : undefined,
                    },
                    sources: [sourceLabel],
                    status: "draft" as any,
                    countyIds,
                  } as any);
                  businessId = createdBiz.id;
                  createdBusinesses++;
                }
              }

              // Ensure business profile exists (stored on the user for now)
              if (!dryRun && userId && userId !== "__dry_run__") {
                const baseSlug = businessName;
                const nextSlug = await ensureUniqueBusinessProfileSlug(baseSlug, userId);
                profileSlug = nextSlug;

                await storage.saveBusinessProfile({
                  id: userId,
                  userId,
                  slug: nextSlug,
                  name: businessName,
                  headline: null as any,
                  description: null,
                  countyFips: countyFips || "",
                  countyName: county?.name || "",
                  city: null,
                  stateCode: resolvedStateCode || null,
                  serviceAreas: countyFips ? [countyFips] : [],
                  website: website || null,
                  services: services.length ? services : null,
                  verificationStatus: "pending" as any,
                  addressVerified: false,
                  cvsScore: null as any,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  publishedAt: new Date().toISOString(),
                } as any);

                if (createPublicProfilesEffective) {
                  const existingProfiles = await storage.listProfilesByOwner(userId);
                  if (existingProfiles.length > 0) {
                    publicProfileSlug = String(existingProfiles[0]?.slug || "") || null;
                    if (!(existingUser as any)?.activeProfileId && existingProfiles[0]?.id) {
                      await storage.setUserActiveProfile(userId, existingProfiles[0].id);
                    }
                  } else {
                    const createdProfile = await storage.createProfileForOwner(userId, {
                      businessId: businessId || undefined,
                      roleContext: "business_owner" as any,
                      slug: businessName,
                      displayName: businessName,
                      headline: null,
                      contentBlocks: [],
                      ctaConfig: {},
                      seoMeta: {},
                      status: "published" as any,
                    } as any);
                    createdPublicProfiles++;
                    publicProfileSlug = createdProfile.slug;
                    await storage.setUserActiveProfile(userId, createdProfile.id);
                  }
                }
              }

              // Claim-first: write claim event for representsBusiness in this county (only with county scope)
              if (!dryRun && userId && userId !== "__dry_run__" && countyFips && county) {
                try {
                  await writeClaimEvent({
                    userId,
                    claimType: ClaimType.REPRESENTS_BUSINESS,
                    countyFips,
                    countyName: county.name,
                    source: ClaimSource.ADMIN,
                    claimTimestamp: new Date(),
                    metadata: {
                      import: true,
                      businessName,
                      businessId,
                      profileSlug,
                    },
                  });
                } catch (e) {
                  console.warn("[admin business import] claim write failed", e);
                }
              }
            } else {
              // Business-name-only minimum: create/attach an unclaimed directory business.
              if (dryRun) {
                createdUnclaimedBusinesses++;
              } else {
                const normalizedWebsite = String(website || "")
                  .trim()
                  .toLowerCase()
                  .replace(/^https?:\/\//, "")
                  .replace(/^www\./, "")
                  .replace(/\/+$/, "");
                const normalizedPhone = String(phone || "").replace(/\D/g, "");

                const existingUnclaimed = await db
                  .select({
                    id: businesses.id,
                    profileData: businesses.profileData,
                  })
                  .from(businesses)
                  .where(
                    and(
                      isNull(businesses.ownerUserId),
                      eq(businesses.claimStatus, "unclaimed" as any),
                      ne(businesses.status, "suspended" as any),
                      or(
                        dedupeKey
                          ? sql`coalesce(${businesses.profileData} -> 'importExtras' ->> 'dedupe_key', '') = ${dedupeKey}`
                          : sql`false`,
                        externalId
                          ? sql`coalesce(${businesses.profileData} -> 'importExtras' ->> 'external_id', '') = ${externalId}`
                          : sql`false`,
                        normalizedWebsite
                          ? sql`lower(coalesce(${businesses.profileData} ->> 'website', '')) = ${normalizedWebsite}`
                          : sql`false`,
                        normalizedPhone
                          ? sql`regexp_replace(coalesce(${businesses.profileData} ->> 'phone', ''), '\\D', '', 'g') = ${normalizedPhone}`
                          : sql`false`,
                        and(
                          sql`lower(${businesses.name}) = ${businessName.toLowerCase()}`,
                          resolvedStateCode
                            ? sql`coalesce(${businesses.profileData} -> 'importExtras' ->> 'state_code', '') = ${resolvedStateCode}`
                            : sql`true`
                        )
                      )
                    )
                  )
                  .limit(1);

                if (existingUnclaimed.length > 0) {
                  businessId = existingUnclaimed[0].id;

                  // Merge in missing profile fields (do not overwrite).
                  const existingProfile: any = existingUnclaimed[0].profileData || {};
                  const nextProfile: any = { ...existingProfile };
                  if (!nextProfile.category && category) nextProfile.category = category;
                  if (
                    (!nextProfile.services || !Array.isArray(nextProfile.services)) &&
                    services.length
                  ) {
                    nextProfile.services = services;
                  }
                  if (!nextProfile.website && website) nextProfile.website = website;
                  if (!nextProfile.phone && phone) nextProfile.phone = phone;
                  // Store owner email for later claim verification without creating a site user.
                  if (!nextProfile.email && email) nextProfile.email = email;
                  if (!nextProfile.address && streetAddress) nextProfile.address = streetAddress;
                  if (!nextProfile.city && city) nextProfile.city = city;
                  if (!nextProfile.stateCode && resolvedStateCode)
                    nextProfile.stateCode = resolvedStateCode;
                  if (!nextProfile.zipCode && zipCode) nextProfile.zipCode = zipCode;

                  const nextExtras: any =
                    nextProfile.importExtras && typeof nextProfile.importExtras === "object"
                      ? { ...nextProfile.importExtras }
                      : {};
                  if (dedupeKey && !nextExtras.dedupe_key) nextExtras.dedupe_key = dedupeKey;
                  if (externalId && !nextExtras.external_id) nextExtras.external_id = externalId;
                  if (licenseNumber && !nextExtras.license_number)
                    nextExtras.license_number = licenseNumber;
                  if (licenseStatus && !nextExtras.license_status)
                    nextExtras.license_status = licenseStatus;
                  if (licenseExpiresAt && !nextExtras.license_expires_at)
                    nextExtras.license_expires_at = licenseExpiresAt;
                  // Always record the best known state code for safer future dedupe.
                  if (resolvedStateCode && !nextExtras.state_code)
                    nextExtras.state_code = resolvedStateCode;
                  if (streetAddress && !nextExtras.address) nextExtras.address = streetAddress;
                  if (address1 && !nextExtras.address_1) nextExtras.address_1 = address1;
                  if (address2 && !nextExtras.address_2) nextExtras.address_2 = address2;
                  if (city && !nextExtras.city) nextExtras.city = city;
                  if (zipCode && !nextExtras.zip_code) nextExtras.zip_code = zipCode;
                  for (const [k, v] of Object.entries(importExtras)) {
                    if (!nextExtras[k] && v) nextExtras[k] = String(v);
                  }
                  if (hasLatLng) {
                    if (!nextExtras.lat) nextExtras.lat = String(lat);
                    if (!nextExtras.lng) nextExtras.lng = String(lng);
                  }
                  if (Object.keys(nextExtras).length) nextProfile.importExtras = nextExtras;

                  if (hasLatLng) {
                    if (!nextExtras.lat) nextExtras.lat = String(lat);
                    if (!nextExtras.lng) nextExtras.lng = String(lng);
                  }

                  await db
                    .update(businesses)
                    .set({
                      profileData: nextProfile,
                      updatedAt: new Date(),
                    } as any)
                    .where(eq(businesses.id, businessId));

                  await db.execute(sql`
                  update businesses
                  set sources = (
                    select coalesce(jsonb_agg(distinct source_value), '[]'::jsonb)
                    from (
                      select jsonb_array_elements_text(coalesce(businesses.sources, '[]'::jsonb)) as source_value
                      union all
                      select ${sourceLabel}
                    ) dedupe
                  ),
                  updated_at = now()
                  where businesses.id = ${businessId}
                `);
                  updatedUnclaimedBusinesses++;
                } else {
                  // Always record state code inside importExtras so future uploads can dedupe by state
                  // even when we don't yet know county FIPS.
                  if (resolvedStateCode && !importExtras.state_code) {
                    importExtras.state_code = resolvedStateCode;
                  }
                  if (streetAddress && !importExtras.address) importExtras.address = streetAddress;
                  if (address1 && !importExtras.address_1) importExtras.address_1 = address1;
                  if (address2 && !importExtras.address_2) importExtras.address_2 = address2;
                  if (city && !importExtras.city) importExtras.city = city;
                  if (dedupeKey && !importExtras.dedupe_key) {
                    importExtras.dedupe_key = dedupeKey;
                  }
                  if (externalId && !importExtras.external_id)
                    importExtras.external_id = externalId;
                  if (licenseNumber && !importExtras.license_number)
                    importExtras.license_number = licenseNumber;
                  if (licenseStatus && !importExtras.license_status)
                    importExtras.license_status = licenseStatus;
                  if (licenseExpiresAt && !importExtras.license_expires_at)
                    importExtras.license_expires_at = licenseExpiresAt;
                  if (hasLatLng) {
                    if (!importExtras.lat) importExtras.lat = String(lat);
                    if (!importExtras.lng) importExtras.lng = String(lng);
                  }
                  const inferredZip =
                    inferZipFromLooseAddress(muni) || inferZipFromLooseAddress(fulladdr);
                  if (inferredZip && !importExtras.zip_code) {
                    importExtras.zip_code = inferredZip;
                  }

                  const createdBiz = await storage.createUnclaimedBusiness({
                    name: businessName,
                    slug: businessName,
                    type: inferredBusinessType as any,
                    roleContext: inferredRoleContext as any,
                    profileData: {
                      category: category || undefined,
                      services: services.length ? services : undefined,
                      website: website || undefined,
                      phone: phone || undefined,
                      email: email || undefined,
                      address: (streetAddress || "").trim() || undefined,
                      city: city || undefined,
                      stateCode: resolvedStateCode || undefined,
                      zipCode: zipCode || undefined,
                      importExtras: Object.keys(importExtras).length ? importExtras : undefined,
                    },
                    sources: [sourceLabel],
                    status: "active" as any,
                    countyIds,
                  } as any);
                  businessId = createdBiz.id;
                  createdUnclaimedBusinesses++;
                }
              }
            }

            // Activation: generate password reset token and optionally email it (only when a user exists)
            let activationLink: string | undefined;
            if (!dryRun && userId && userId !== "__dry_run__") {
              const { token, expiresAt } = passwordResetService.createToken(userId);
              activationPrepared++;
              const resetLink = `${resetBase.replace(/\/$/, "")}/reset-password?token=${token}`;

              if (sendActivationEmailsEffective && emailService.isConfigured()) {
                const emailVerificationRequired = await getGeneralSetting<boolean>(
                  "email_verification_required",
                  true
                );
                let verifyLink: string | null = null;
                if (emailVerificationRequired) {
                  const verify = emailVerificationService.createToken(userId);
                  const verifyBase = getPublicBaseUrlFromRequest(req as any);
                  verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
                }

                await emailService.sendEmail({
                  to: email,
                  subject: "Claim your TradeScout business account",
                  html: `<p>Your business account has been created in TradeScout.</p>
<p><a href="${resetLink}">Set your password</a> to claim your account. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
${verifyLink ? `<p><a href="${verifyLink}">Verify my email</a> (required)</p>` : ""}
<p>After you sign in, you can finish your profile and complete insurance/license verification.</p>`,
                  text: `Set your password: ${resetLink}`,
                  purpose: "activation",
                });
                activationEmailed++;
              } else if (includeActivationLinksEffective && allowActivationLinkExport) {
                activationLink = resetLink;
              }
            }

            results.push({
              ...rowRef,
              status: dryRun ? "dry_run" : "ok",
              userId: dryRun ? null : userId,
              businessId,
              profileSlug,
              publicProfileSlug,
              activationLink,
            });
          } catch (e: any) {
            results.push({
              ...rowRef,
              status: "error",
              error: e?.message || "Import failed",
            });
          }
        }

        res.json({
          dryRun,
          delimiter: delimiter === "\t" ? "tab" : delimiter === "|" ? "pipe" : "comma",
          parse: lastParseMeta,
          parseFile,
          warnings:
            requestedCreateOwnerAccounts && !createOwnerAccounts
              ? [
                  'createOwnerAccounts was requested but ignored. To create real user accounts, set confirmCreateUsers="CREATE_USERS".',
                ]
              : [],
          totals: {
            rows: records.length,
            createdUsers,
            updatedUsers,
            createdBusinesses,
            updatedBusinesses,
            createdUnclaimedBusinesses,
            updatedUnclaimedBusinesses,
            createdPublicProfiles,
            activationPrepared,
            activationEmailed,
          },
          activationLinkExport: {
            requested: includeActivationLinksEffective,
            allowed: includeActivationLinksEffective && allowActivationLinkExport,
            reason:
              includeActivationLinksEffective && !allowActivationLinkExport
                ? "Activation link export is disabled in production. Set ADMIN_ALLOW_ACTIVATION_LINK_EXPORT=true to allow."
                : null,
          },
          results,
        });
      } catch (error: any) {
        console.error("Error importing businesses:", error);
        res.status(500).json({
          message: "Failed to import businesses",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Admin: find "import-created" directory owner accounts so they can be archived into unclaimed businesses.
  // These accounts were created before we defaulted imports to "directory entries only" (no auth users).
  const archiveImportedDirectoryUserToDirectory = async (userId: string) => {
    const id = String(userId || "").trim();
    if (!id) throw { status: 400, message: "userId is required" };

    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0] as any;
    if (!user) throw { status: 404, message: "User not found" };

    const roles: string[] = Array.isArray(user.roles) ? user.roles.map((r: any) => String(r)) : [];
    const alreadyArchivedEmail = String(user.email || "")
      .toLowerCase()
      .startsWith("archived+");
    const isCandidate =
      user.onboardingCompleted === false &&
      (user.password == null || user.password === "") &&
      (roles.includes("business_owner") || String(user.role || "") === "business_owner");

    if (!isCandidate) {
      // Idempotent cleanup behavior: if this user was already archived by this flow, return success.
      if (
        alreadyArchivedEmail &&
        String((user.preferences as any)?.archivedReason || "") === "admin_import_cleanup"
      ) {
        return {
          userId: id,
          archivedEmail: String(user.email || ""),
          directoryBusinessId: String((user.preferences as any)?.archivedDirectoryBusinessId || ""),
          directoryBusinessSlug: null,
          directoryBusinessName: null,
          alreadyArchived: true,
        };
      }
      throw {
        status: 400,
        message:
          "User does not match import-cleanup heuristics (must be an unclaimed import-style business_owner account).",
      };
    }

    const originalEmail = String(user.email || "").trim();
    const originalPhone = typeof user.phone === "string" ? user.phone : null;
    const archivedEmail = `archived+${id}@thetradescout.invalid`;

    const slugify = (text: string): string =>
      String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

    const now = new Date();
    return db.transaction(async (tx) => {
      // Prefer to detach an existing owned business (created during the old import flow)
      // so we don't duplicate directory entries.
      const ownedBizRows = await tx
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          profileData: businesses.profileData,
          sources: businesses.sources,
          status: businesses.status,
          roleContext: businesses.roleContext,
          type: businesses.type,
          createdAt: businesses.createdAt,
        })
        .from(businesses)
        .where(eq(businesses.ownerUserId, id))
        .orderBy(desc(businesses.createdAt))
        .limit(1);

      let directoryBusinessId: string | null = null;
      let directoryBusinessSlug: string | null = null;
      let directoryBusinessName: string | null = null;

      if (ownedBizRows.length > 0) {
        const biz = ownedBizRows[0] as any;
        directoryBusinessId = String(biz.id);
        directoryBusinessSlug = String(biz.slug);
        directoryBusinessName = String(biz.name);

        const existingProfile: any = biz.profileData || {};
        const existingExtras: any =
          existingProfile && typeof existingProfile === "object"
            ? existingProfile.importExtras
            : null;

        const nextExtras: Record<string, string> = {
          ...(existingExtras && typeof existingExtras === "object" ? existingExtras : {}),
          archived_from_user_id: id,
          archived_from_user_email: originalEmail,
          ...(originalPhone ? { archived_from_user_phone: String(originalPhone) } : {}),
        };

        const nextProfileData: any = {
          ...existingProfile,
          // Preserve original contact fields so verified TradeScout users can reach this business
          // via the intent-gated reveal flow even before it is claimed.
          ...(originalEmail ? { email: originalEmail } : {}),
          ...(originalPhone ? { phone: originalPhone } : {}),
          importExtras: nextExtras,
        };

        const currentSources: string[] = Array.isArray(biz.sources)
          ? biz.sources.map((s: any) => String(s)).filter(Boolean)
          : [];
        const nextSources = Array.from(new Set([...currentSources, "admin_import_cleanup"]));

        try {
          await tx
            .update(businesses)
            .set({
              ownerUserId: null,
              claimStatus: "unclaimed" as any,
              profileData: nextProfileData,
              sources: nextSources as any,
              updatedAt: now,
            } as any)
            .where(eq(businesses.id, directoryBusinessId));
        } catch (error: any) {
          const isMissingClaimStatusColumn =
            String(error?.code || "") === "42703" &&
            String(error?.message || "")
              .toLowerCase()
              .includes("claim_status");
          if (!isMissingClaimStatusColumn) throw error;

          await tx
            .update(businesses)
            .set({
              ownerUserId: null,
              profileData: nextProfileData,
              sources: nextSources as any,
              updatedAt: now,
            } as any)
            .where(eq(businesses.id, directoryBusinessId));
        }
      } else {
        // Fallback: create a directory business if the import-created user has no owned business.
        const baseName =
          String(user.businessSlug || "").trim() ||
          String(user.firstName || "").trim() ||
          (originalEmail.includes("@") ? originalEmail.split("@")[0] : "") ||
          `business-${id.slice(0, 8)}`;

        const baseSlug = slugify(baseName) || `business-${id.slice(0, 8)}`;
        let candidateSlug = baseSlug;
        for (let attempt = 0; attempt < 50; attempt++) {
          const existing = await tx
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.slug, candidateSlug))
            .limit(1);
          if (!existing.length) break;
          candidateSlug = `${baseSlug}-${attempt + 2}`;
        }

        let inserted: any[] = [];
        try {
          inserted = await tx
            .insert(businesses)
            .values({
              name: String(baseName).slice(0, 255),
              slug: candidateSlug,
              type: "other" as any,
              ownerUserId: null,
              roleContext: "business_owner" as any,
              claimStatus: "unclaimed" as any,
              sources: ["admin_import_cleanup"] as any,
              status: "draft" as any,
              profileData: {
                ...(originalEmail ? { email: originalEmail } : {}),
                ...(originalPhone ? { phone: originalPhone } : {}),
                importExtras: {
                  archived_from_user_id: id,
                  archived_from_user_email: originalEmail,
                  ...(originalPhone ? { archived_from_user_phone: String(originalPhone) } : {}),
                },
              } as any,
              createdAt: now,
              updatedAt: now,
            } as any)
            .returning();
        } catch (error: any) {
          const isMissingClaimStatusColumn =
            String(error?.code || "") === "42703" &&
            String(error?.message || "")
              .toLowerCase()
              .includes("claim_status");
          if (!isMissingClaimStatusColumn) throw error;

          inserted = await tx
            .insert(businesses)
            .values({
              name: String(baseName).slice(0, 255),
              slug: candidateSlug,
              type: "other" as any,
              ownerUserId: null,
              roleContext: "business_owner" as any,
              sources: ["admin_import_cleanup"] as any,
              status: "draft" as any,
              profileData: {
                ...(originalEmail ? { email: originalEmail } : {}),
                ...(originalPhone ? { phone: originalPhone } : {}),
                importExtras: {
                  archived_from_user_id: id,
                  archived_from_user_email: originalEmail,
                  ...(originalPhone ? { archived_from_user_phone: String(originalPhone) } : {}),
                },
              } as any,
              createdAt: now,
              updatedAt: now,
            } as any)
            .returning();
        }

        const createdBiz = inserted[0] as any;
        directoryBusinessId = createdBiz?.id ? String(createdBiz.id) : null;
        directoryBusinessSlug = createdBiz?.slug ? String(createdBiz.slug) : null;
        directoryBusinessName = createdBiz?.name ? String(createdBiz.name) : null;
      }

      const nextPreferences: any =
        user.preferences && typeof user.preferences === "object" ? { ...user.preferences } : {};
      nextPreferences.archivedEmail = originalEmail || null;
      nextPreferences.archivedAt = now.toISOString();
      nextPreferences.archivedReason = "admin_import_cleanup";
      nextPreferences.archivedDirectoryBusinessId = directoryBusinessId;

      const nextRoles = roles.filter((r) => r !== "business_owner");

      await tx
        .update(users)
        .set({
          email: archivedEmail,
          password: null,
          phone: null,
          roles: nextRoles as any,
          role: "homeowner" as any,
          activeRole: "homeowner",
          activeBusinessId: null,
          activeProfileId: null,
          businessSlug: null,
          preferences: nextPreferences,
          updatedAt: now,
        } as any)
        .where(eq(users.id, id));

      return {
        userId: id,
        archivedEmail,
        directoryBusinessId,
        directoryBusinessSlug,
        directoryBusinessName,
      };
    });
  };

  app.get(
    "/api/admin/imported-directory-users",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const limitRaw =
          typeof (req.query as any)?.limit === "string" ? String((req.query as any).limit) : "";
        const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : 200;
        const limit = Number.isFinite(parsedLimit)
          ? Math.max(50, Math.min(2000, parsedLimit))
          : 200;

        const result = (await db.execute(sql`
          select
            u.id,
            u.email,
            u.first_name as "firstName",
            u.last_name as "lastName",
            u.phone,
            u.role,
            u.roles,
            u.onboarding_completed as "onboardingCompleted",
            u.email_verified as "emailVerified",
            u.active_business_id as "activeBusinessId",
            u.active_profile_id as "activeProfileId",
            u.business_slug as "businessSlug",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            (
              select b.id
              from businesses b
              where b.owner_user_id = u.id
              order by b.created_at desc
              limit 1
            ) as "ownedBusinessId",
            (
              select b.slug
              from businesses b
              where b.owner_user_id = u.id
              order by b.created_at desc
              limit 1
            ) as "ownedBusinessSlug"
          from users u
          where u.onboarding_completed = false
            and u.password_hash is null
            and (
              'business_owner' = any(u.roles)
              or u.role = 'business_owner'
            )
          order by u.created_at desc
          limit ${limit}
        `)) as any;

        const users = Array.isArray(result?.rows) ? result.rows : [];
        return res.json({ users });
      } catch (error: any) {
        console.error("Error listing imported directory users:", error);
        return res.status(500).json({ message: "Failed to list imported directory users" });
      }
    }
  );

  // Admin: archive an import-created directory owner account into an unclaimed business listing.
  // This keeps directory discovery/calling intact while preventing these accounts from inflating "real users".
  app.post(
    "/api/admin/imported-directory-users/:userId/archive-to-directory",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.params.userId || "").trim();
        const outcome = await archiveImportedDirectoryUserToDirectory(userId);
        return res.json({ ok: true, ...outcome });
      } catch (error: any) {
        console.error("Error archiving imported directory user:", error);
        const status = typeof error?.status === "number" ? error.status : 500;
        return res.status(status).json({
          message:
            status >= 500
              ? error?.message || "Failed to archive user"
              : error?.message || "Failed to archive user",
          code: error?.code || null,
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Admin: bulk archive import-created directory owner accounts (with safety confirmation).
  app.post(
    "/api/admin/imported-directory-users/archive-all",
    isAuthenticated,
    isAdmin,
    express.json({ limit: "1mb" }),
    async (req: Request, res: Response) => {
      try {
        const confirm = String(
          (req.body as any)?.confirm || (req.body as any)?.confirmPhrase || ""
        ).trim();
        if (confirm !== "ARCHIVE_ALL") {
          return res.status(400).json({ message: 'Type "ARCHIVE_ALL" to confirm bulk archiving.' });
        }

        const limitRaw = String((req.body as any)?.limit ?? "").trim();
        const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : 500;
        const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(5000, parsedLimit)) : 500;

        const result = (await db.execute(sql`
          select u.id
          from users u
          where u.onboarding_completed = false
            and u.password_hash is null
            and (
              'business_owner' = any(u.roles)
              or u.role = 'business_owner'
            )
            and lower(u.email) not like 'archived+%@thetradescout.invalid'
          order by u.created_at desc
          limit ${limit}
        `)) as any;

        const ids: string[] = Array.isArray(result?.rows)
          ? result.rows.map((r: any) => String(r?.id || "")).filter(Boolean)
          : [];

        let archived = 0;
        const errors: Array<{ userId: string; message: string }> = [];
        for (const id of ids) {
          try {
            await archiveImportedDirectoryUserToDirectory(id);
            archived += 1;
          } catch (err: any) {
            errors.push({
              userId: id,
              message: typeof err?.message === "string" ? err.message : "archive failed",
            });
          }
        }

        return res.json({
          requestedLimit: limit,
          matched: ids.length,
          archived,
          failed: errors.length,
          errors,
        });
      } catch (error: any) {
        console.error("Error bulk archiving imported directory users:", error);
        return res.status(500).json({
          message: "Failed to bulk-archive users",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Admin: list import batches from staging table with status counts
  app.get(
    "/api/admin/businesses/import/batches",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const result = (await db.execute(sql`
          select
            batch_id as "batchId",
            source,
            count(*)::int as "totalRows",
            count(*) filter (where status = 'pending')::int as "pendingRows",
            count(*) filter (where status = 'merged')::int as "mergedRows",
            count(*) filter (where status = 'failed')::int as "failedRows",
            count(*) filter (where status = 'skipped_duplicate')::int as "skippedRows",
            max(created_at) as "latestCreatedAt"
          from listing_import_staging
          group by batch_id, source
          order by max(created_at) desc
          limit 50
        `)) as any;

        const batches = Array.isArray(result?.rows) ? result.rows : [];
        return res.json({ batches });
      } catch (error: any) {
        console.error("Error listing import batches:", error);
        return res.status(500).json({ message: "Failed to list import batches" });
      }
    }
  );

  // Admin: view staged rows for one batch (with optional status filter)
  app.get(
    "/api/admin/businesses/import/batches/:batchId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const batchId = String(req.params.batchId || "").trim();
        if (!batchId) {
          return res.status(400).json({ message: "batchId is required" });
        }

        const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
        const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

        const predicates = [eq(listingImportStaging.batchId, batchId)];
        if (status) {
          predicates.push(eq(listingImportStaging.status, status as any));
        }

        const rows = await db
          .select()
          .from(listingImportStaging)
          .where(and(...predicates))
          .orderBy(desc(listingImportStaging.createdAt))
          .limit(limit);

        return res.json({ rows });
      } catch (error: any) {
        console.error("Error loading import batch rows:", error);
        return res.status(500).json({ message: "Failed to load import batch rows" });
      }
    }
  );

  // Admin: Enrich businesses with county assignment (business_counties) from stored import address fields.
  // Purpose: route jobs by county without requiring businesses to claim first.
  app.post(
    "/api/admin/businesses/enrich-counties",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as any;
        const dryRun = body.dryRun === true;
        const onlyUnclaimed = body.onlyUnclaimed !== false; // default true
        const limitRaw =
          typeof body.limit === "number" ? body.limit : parseInt(String(body.limit || "100"), 10);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

        const parseAddress = (
          profileData: any
        ): { address: string; stateCode?: string; zip?: string } | null => {
          const pd = profileData && typeof profileData === "object" ? profileData : {};
          const extras =
            pd.importExtras && typeof pd.importExtras === "object" ? pd.importExtras : {};
          const full = String(
            extras.gmb_full_address ||
              extras.fulladdress ||
              extras.full_address ||
              extras.address ||
              ""
          ).trim();
          const street = String(extras.gmb_street || extras.street || "").trim();
          const muni = String(extras.gmb_municipality || extras.municipality || "").trim();
          const stateCode = String(extras.state_code || "")
            .trim()
            .toUpperCase();
          const zip = String(extras.zip_code || "").trim();

          const address = full || [street, muni].filter(Boolean).join(", ");
          if (!address) return null;
          return { address, stateCode: stateCode || undefined, zip: zip || undefined };
        };

        const rowsResult = (await db.execute(sql`
          select
            b.id,
            b.name,
            b.owner_user_id as "ownerUserId",
            b.claim_status as "claimStatus",
            b.status,
            b.profile_data as "profileData"
          from businesses b
          left join business_counties bc on bc.business_id = b.id
          where bc.id is null
            and b.status <> 'suspended'
            ${onlyUnclaimed ? sql`and b.owner_user_id is null and b.claim_status = 'unclaimed'` : sql``}
          order by b.updated_at desc
          limit ${limit}
        `)) as any;

        const candidates = Array.isArray(rowsResult?.rows) ? rowsResult.rows : [];

        const summary = {
          dryRun,
          onlyUnclaimed,
          scanned: candidates.length,
          enriched: 0,
          skipped: 0,
          failed: 0,
          notFound: 0,
        };

        const details: any[] = [];

        const fetchCountyFips = async (
          address: string
        ): Promise<{ countyFips: string; countyName?: string } | null> => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12_000);
          try {
            const url = new URL(
              "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"
            );
            url.searchParams.set("address", address);
            url.searchParams.set("benchmark", "2020");
            url.searchParams.set("vintage", "2020");
            url.searchParams.set("format", "json");
            const resp = await fetch(url.toString(), { signal: controller.signal });
            if (!resp.ok) return null;
            const data: any = await resp.json();
            const match = data?.result?.addressMatches?.[0];
            const county = match?.geographies?.Counties?.[0];
            const geoid = String(county?.GEOID || "").trim();
            if (!/^\d{5}$/.test(geoid)) return null;
            return {
              countyFips: geoid,
              countyName: typeof county?.NAME === "string" ? county.NAME : undefined,
            };
          } catch {
            return null;
          } finally {
            clearTimeout(timeout);
          }
        };

        for (const cand of candidates) {
          const parsed = parseAddress(cand.profileData);
          if (!parsed?.address) {
            summary.skipped++;
            details.push({
              id: cand.id,
              name: cand.name,
              status: "skipped",
              reason: "missing_address",
            });
            continue;
          }

          const geocoded = await fetchCountyFips(parsed.address);
          if (!geocoded) {
            summary.notFound++;
            details.push({
              id: cand.id,
              name: cand.name,
              status: "not_found",
              address: parsed.address,
            });
            continue;
          }

          const [county] = await db
            .select({
              id: counties.id,
              fips: counties.fips,
              name: counties.name,
              stateCode: counties.stateCode,
            })
            .from(counties)
            .where(eq(counties.fips, geocoded.countyFips))
            .limit(1);

          if (!county?.id) {
            summary.notFound++;
            details.push({
              id: cand.id,
              name: cand.name,
              status: "not_found",
              countyFips: geocoded.countyFips,
            });
            continue;
          }

          if (!dryRun) {
            await db
              .insert(businessCounties)
              .values({ businessId: cand.id, countyId: county.id } as any)
              .onConflictDoNothing();

            // Persist enrichment back into importExtras (non-authoritative; helps future dedupe + UI).
            const existingProfile: any =
              cand.profileData && typeof cand.profileData === "object" ? cand.profileData : {};
            const existingExtras: any =
              existingProfile.importExtras && typeof existingProfile.importExtras === "object"
                ? { ...existingProfile.importExtras }
                : {};
            if (!existingExtras.county_fips) existingExtras.county_fips = county.fips;
            if (!existingExtras.county_name) existingExtras.county_name = county.name;
            if (!existingExtras.state_code) existingExtras.state_code = county.stateCode;

            await db
              .update(businesses)
              .set({
                profileData: { ...existingProfile, importExtras: existingExtras },
                updatedAt: new Date(),
              } as any)
              .where(eq(businesses.id, cand.id));
          }

          summary.enriched++;
          details.push({
            id: cand.id,
            name: cand.name,
            status: dryRun ? "dry_run" : "enriched",
            countyFips: county.fips,
            countyName: county.name,
            stateCode: county.stateCode,
          });

          // Soft throttle to avoid hammering the Census geocoder.
          await new Promise((r) => setTimeout(r, 150));
        }

        return res.json({ summary, details: details.slice(0, 50) });
      } catch (error: any) {
        console.error("Error enriching business counties:", error);
        return res.status(500).json({
          message: "Failed to enrich counties",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Public: Claim My Business (send password set/reset link for the account behind a business slug)
  app.get("/api/business-claim/search", async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const countyFips =
        typeof req.query.countyFips === "string" ? req.query.countyFips.trim() : "";
      const stateCode =
        typeof req.query.stateCode === "string" ? req.query.stateCode.trim().toUpperCase() : "";
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 10;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(25, limitRaw)) : 10;

      if (q.length < 2) {
        return res.json({ items: [] });
      }

      const likeQ = `%${q.toLowerCase()}%`;
      const rowsResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where b.status <> 'suspended'
          and b.owner_user_id is null
          and b.claim_status = 'unclaimed'
          and (
            lower(b.name) like ${likeQ}
            or lower(b.slug) like ${likeQ}
          )
          ${countyFips ? sql`and co.fips = ${countyFips}` : sql``}
          ${stateCode ? sql`and co.state_code = ${stateCode}` : sql``}
        group by b.id, b.name, b.slug, b.type, b.status
        order by b.name asc
        limit ${limit}
      `)) as any;

      const items = Array.isArray(rowsResult?.rows) ? rowsResult.rows : [];
      res.json({ items });
    } catch (error: any) {
      console.error("Error searching claimable businesses:", error);
      res.status(500).json({ message: "Failed to search businesses" });
    }
  });

  function normalizeClaimEmail(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function normalizeClaimPhone(value: unknown): string {
    const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
    // Keep the last 10 for consistent matching (US default); if longer, keep tail.
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  function normalizeClaimWebsiteDomain(value: unknown): string {
    if (typeof value !== "string") return "";
    let raw = value.trim().toLowerCase();
    if (!raw) return "";

    // Allow inputs like "example.com", "https://example.com/path", "www.example.com"
    try {
      if (!raw.includes("://")) raw = `https://${raw}`;
      const parsed = new URL(raw);
      const host = parsed.hostname
        .replace(/^www\./, "")
        .replace(/\.$/, "")
        .trim();
      return host;
    } catch {
      return "";
    }
  }

  // Public: Resolve a claimable directory business by slug (used for claim links).
  app.get("/api/business-claim/resolve", async (req: Request, res: Response) => {
    try {
      const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
      if (!slug) return res.status(400).json({ message: "slug is required" });

      const rowsResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where b.slug = ${slug}
          and b.status <> 'suspended'
        group by b.id, b.name, b.slug, b.type, b.status
        limit 1
      `)) as any;

      const row = Array.isArray(rowsResult?.rows) ? rowsResult.rows[0] : null;
      if (!row) return res.status(404).json({ message: "Business not found" });
      return res.json({ business: row });
    } catch (error: any) {
      console.error("Error resolving claim business slug:", error);
      return res.status(500).json({ message: "Failed to resolve business" });
    }
  });

  // Public: Find-or-create an unclaimed business shell so any business can be claimed without bulk uploads.
  app.post("/api/business-claim/find-or-create", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as any;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const stateCode =
        typeof body.stateCode === "string" ? body.stateCode.trim().toUpperCase() : "";
      const countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : "";
      const email = normalizeClaimEmail(body.email);
      const phone = normalizeClaimPhone(body.phone);
      const websiteDomain = normalizeClaimWebsiteDomain(body.website);
      const category = typeof body.category === "string" ? body.category.trim().slice(0, 120) : "";
      const type = typeof body.type === "string" ? body.type.trim() : "contractor";
      const roleContext =
        typeof body.roleContext === "string" && body.roleContext.trim()
          ? body.roleContext.trim().slice(0, 64)
          : "contractor";

      if (name.length < 2) return res.status(400).json({ message: "name is required" });
      if (!/^[A-Z]{2}$/.test(stateCode)) {
        return res.status(400).json({ message: "stateCode is required (2-letter code)" });
      }
      if (!/^\d{5}$/.test(countyFips)) {
        return res.status(400).json({ message: "countyFips is required (5-digit FIPS)" });
      }

      const countyRows = await db
        .select({
          id: counties.id,
          fips: counties.fips,
          stateCode: counties.stateCode,
          name: counties.name,
        })
        .from(counties)
        .where(and(eq(counties.fips, countyFips), eq(counties.stateCode, stateCode)))
        .limit(1);

      const county = countyRows[0];
      if (!county) {
        return res.status(400).json({ message: "Unknown county for stateCode/countyFips" });
      }

      // Dedupe: try strong keys first, then fall back to name+county.
      const existingResult = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.status,
          b.claim_status as "claimStatus",
          b.sources,
          coalesce(
            json_agg(distinct jsonb_build_object(
              'fips', co.fips,
              'stateCode', co.state_code,
              'name', co.name
            )) filter (where co.fips is not null),
            '[]'::json
          ) as counties
        from businesses b
        left join business_counties bc on bc.business_id = b.id
        left join counties co on co.id = bc.county_id
        where b.status <> 'suspended'
          and b.owner_user_id is null
          and b.claim_status = 'unclaimed'
          and (
            ${email ? sql`lower(coalesce(b.profile_data->>'email','')) = ${email}` : sql`false`}
            or ${phone ? sql`regexp_replace(coalesce(b.profile_data->>'phone',''), '\\D','','g') = ${phone}` : sql`false`}
            or ${websiteDomain ? sql`lower(coalesce(b.profile_data->>'website','')) like ${`%${websiteDomain}%`}` : sql`false`}
            or (lower(b.name) = ${name.toLowerCase()} and co.fips = ${countyFips} and co.state_code = ${stateCode})
          )
        group by b.id, b.name, b.slug, b.type, b.status
        order by b.name asc
        limit 1
      `)) as any;

      const existing = Array.isArray(existingResult?.rows) ? existingResult.rows[0] : null;
      if (existing) {
        return res.json({ created: false, business: existing });
      }

      const created = await storage.createUnclaimedBusiness({
        name,
        slug: name,
        type: (["contractor", "community", "vendor", "other"].includes(type)
          ? type
          : "contractor") as any,
        roleContext,
        status: "active" as any,
        // Store contact fields for later verification/outreach, but do not expose them publicly by default.
        profileData: {
          ...(category ? { category } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(body.website && typeof body.website === "string"
            ? { website: body.website.trim() }
            : {}),
          contactPreference: "message",
        } as any,
        sources: ["lazy_seed"],
        countyIds: [county.id],
      } as any);

      return res.status(201).json({
        created: true,
        business: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          type: created.type,
          status: created.status,
          claimStatus: created.claimStatus,
          counties: [{ fips: county.fips, stateCode: county.stateCode, name: county.name }],
        },
      });
    } catch (error: any) {
      console.error("Error creating claimable business:", error);
      return res.status(500).json({ message: "Failed to create business shell" });
    }
  });

  // Auth: Claim an unclaimed business directory entry for the current user (email/phone verified).
  app.post("/api/business-claim/claim", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const body = (req.body ?? {}) as any;
      const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
      if (!businessId) return res.status(400).json({ message: "businessId is required" });

      const user = await storage.getUser(String(userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const rows = await db
        .select({
          id: businesses.id,
          slug: businesses.slug,
          ownerUserId: businesses.ownerUserId,
          claimStatus: businesses.claimStatus,
          status: businesses.status,
          profileData: businesses.profileData,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      const biz = rows[0] as any;
      if (!biz || biz.status === "suspended") {
        return res.status(404).json({ message: "Business not found" });
      }
      if (biz.ownerUserId || biz.claimStatus !== "unclaimed") {
        return res.status(409).json({ message: "Business already claimed" });
      }

      const signupEmail = normalizeClaimEmail((user as any).email);
      const signupPhone = normalizeClaimPhone((user as any).phone);
      const bizEmail = normalizeClaimEmail(biz.profileData?.email);
      const bizPhone = normalizeClaimPhone(biz.profileData?.phone);

      const verifiedByEmail = Boolean(bizEmail) && bizEmail === signupEmail;
      const verifiedByPhone =
        Boolean(bizPhone) && bizPhone.length >= 10 && bizPhone === signupPhone;

      if (!verifiedByEmail && !verifiedByPhone) {
        return res.status(403).json({
          message: "Claim requires verification. Email/phone did not match the business on file.",
          code: "CLAIM_NOT_VERIFIED",
        });
      }

      const claimed = await storage.claimUnclaimedBusinessForUser(biz.id, String(userId));
      await storage.updateUser(String(userId), {
        activeBusinessId: biz.id,
        role: "business_owner" as any,
        activeRole: "business_owner",
        roles: Array.from(
          new Set([
            ...(Array.isArray((user as any).roles) ? (user as any).roles : []),
            "business_owner",
          ])
        ),
        updatedAt: new Date(),
      } as any);

      return res.json({ status: "claimed", businessId: claimed.id, slug: claimed.slug });
    } catch (error: any) {
      console.error("Error claiming business:", error);
      return res.status(500).json({ message: "Failed to claim business" });
    }
  });

  app.post("/api/business-claim/request", async (req: Request, res: Response) => {
    try {
      const { slug, email } = (req.body ?? {}) as any;
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const normalizedEmail = typeof email === "string" ? String(email).trim().toLowerCase() : "";

      if (!normalizedSlug || !normalizedEmail) {
        return res.status(400).json({ message: "slug and email are required" });
      }

      const user = await storage.getUserByEmail(normalizedEmail);

      // Generic response to avoid account enumeration
      const generic = {
        message: "If that email matches the business on file, a claim link has been sent.",
      };

      if (!user || !user.businessSlug || String(user.businessSlug) !== String(normalizedSlug)) {
        return res.json(generic);
      }

      const emailVerificationRequired = await getGeneralSetting<boolean>(
        "email_verification_required",
        true
      );

      const { token, expiresAt } = passwordResetService.createToken(user.id);
      const resetBase =
        process.env.PASSWORD_RESET_URL ||
        process.env.APP_BASE_URL ||
        getPublicBaseUrlFromRequest(req);
      const resetLink = `${resetBase.replace(/\/$/, "")}/reset-password?token=${token}`;

      let verifyLink: string | null = null;
      if (emailVerificationRequired && user.emailVerified !== true) {
        const verify = emailVerificationService.createToken(user.id);
        const verifyBase = getPublicBaseUrlFromRequest(req);
        verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
      }

      if (emailService.isConfigured()) {
        await emailService.sendEmail({
          to: user.email,
          subject: "Claim your business on TradeScout",
          html: `<p>Use this link to set your password and claim your business account.</p>
<p><a href="${resetLink}">Claim my business</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
${verifyLink ? `<p><a href="${verifyLink}">Verify my email</a> (required)</p>` : ""}`,
          text: `Claim your business: ${resetLink}`,
          purpose: "claim_business",
        });
      } else {
        console.warn(`[business-claim] Email not configured; token generated for ${user.email}`);
      }

      // Claim-first: record an explicit direct claim attempt (write-only)
      try {
        const countyFips = String((user as any).countyFips || "");
        const countyName = String((user as any).countyName || "");
        if (/^[0-9]{5}$/.test(countyFips) && countyName) {
          await writeClaimEvent({
            userId: user.id,
            claimType: ClaimType.REPRESENTS_BUSINESS,
            countyFips,
            countyName,
            source: ClaimSource.DIRECT_CLAIM,
            claimTimestamp: new Date(),
            metadata: { slug: normalizedSlug },
          });
        }
      } catch (e) {
        console.warn("[business-claim] claim write failed", e);
      }

      return res.json(generic);
    } catch (error: any) {
      console.error("Error requesting business claim:", error);
      return res.status(500).json({ message: "Failed to request claim" });
    }
  });

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
              about: contractor.about,
              photos: contractor.photos,
              yearsInBusiness: contractor.yearsInBusiness,
              verifiedLicensed: contractor.verifiedLicensed,
              verifiedInsured: contractor.verifiedInsured,
              contactAccess: {
                mode: "request_required",
                ctaLabel: "Request Quote",
                ctaPath: "/request-quote",
              },
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;

      const normalizeRole = (role: unknown): string => {
        const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
        if (!raw) return "";
        return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
      };

      const allowedRoles = new Set(["super_admin", "moderator", "ops_admin", "support_agent"]);

      const primaryRole = normalizeRole((user as any)?.role);
      const activeRole = normalizeRole((user as any)?.activeRole);
      const roleList = Array.isArray((user as any)?.roles)
        ? (user as any).roles.map((r: any) => normalizeRole(r)).filter(Boolean)
        : [];
      const hasAccess =
        (user as any)?.isAdmin === true ||
        (user as any)?.isSuperAdmin === true ||
        allowedRoles.has(primaryRole) ||
        allowedRoles.has(activeRole) ||
        roleList.some((r: string) => allowedRoles.has(r));

      if (!user || !hasAccess) {
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;

      const normalizeRole = (role: unknown): string => {
        const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
        if (!raw) return "";
        return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
      };

      const allowedRoles = new Set(["super_admin", "moderator", "ops_admin", "support_agent"]);

      const primaryRole = normalizeRole((user as any)?.role);
      const activeRole = normalizeRole((user as any)?.activeRole);
      const roleList = Array.isArray((user as any)?.roles)
        ? (user as any).roles.map((r: any) => normalizeRole(r)).filter(Boolean)
        : [];
      const hasAccess =
        (user as any)?.isAdmin === true ||
        (user as any)?.isSuperAdmin === true ||
        allowedRoles.has(primaryRole) ||
        allowedRoles.has(activeRole) ||
        roleList.some((r: string) => allowedRoles.has(r));

      if (!user || !hasAccess) {
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
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;

      const normalizeRole = (role: unknown): string => {
        const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
        if (!raw) return "";
        return raw === "owner" || raw === "head_admin" ? "super_admin" : raw;
      };

      const allowedRoles = new Set(["super_admin", "moderator", "ops_admin", "support_agent"]);

      const primaryRole = normalizeRole((user as any)?.role);
      const activeRole = normalizeRole((user as any)?.activeRole);
      const roleList = Array.isArray((user as any)?.roles)
        ? (user as any).roles.map((r: any) => normalizeRole(r)).filter(Boolean)
        : [];
      const hasAccess =
        (user as any)?.isAdmin === true ||
        (user as any)?.isSuperAdmin === true ||
        allowedRoles.has(primaryRole) ||
        allowedRoles.has(activeRole) ||
        roleList.some((r: string) => allowedRoles.has(r));

      if (!user || !hasAccess) {
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
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }
        const now = Date.now();
        const testReports = [
          {
            id: `TEST-${now}-1`,
            userId,
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
            userId,
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

        for (const testReport of testReports) {
          await storage.createErrorReport(testReport);
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

  const marketplaceCategoryIdCache = new Map<string, { id: string | null; expiresAtMs: number }>();

  async function getMarketplaceCategoryIdByName(name: string): Promise<string | null> {
    const key = String(name || "")
      .trim()
      .toLowerCase();
    if (!key) return null;

    const cached = marketplaceCategoryIdCache.get(key);
    if (cached && Date.now() < cached.expiresAtMs) {
      return cached.id;
    }

    const categories = await storage.getMarketplaceCategories();
    const match = (categories || []).find(
      (c: any) =>
        String(c?.name || "")
          .trim()
          .toLowerCase() === key
    );
    const id = match?.id ? String(match.id) : null;
    marketplaceCategoryIdCache.set(key, { id, expiresAtMs: Date.now() + 5 * 60 * 1000 });
    return id;
  }

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

      const validatedData = parsedListing.data as any;

      // Back-compat: some clients still send Exchange category slugs instead of a category UUID.
      const maybeCategoryId = String(validatedData.categoryId || "").trim();
      const looksLikeUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

      if (maybeCategoryId && !looksLikeUuid(maybeCategoryId)) {
        const slugToName: Record<string, string> = {
          business: "Sell Your Business",
          "real-estate": "Real Estate",
          vehicles: "Vehicles",
          construction: "Construction Equipment",
          tools: "Tools & Hardware",
          furniture: "Furniture & Home Goods",
          farm: "Farm Equipment",
          "business-equipment": "Business Equipment",
          electronics: "Electronics & Technology",
          sports: "Sports & Recreation",
          collectibles: "Art & Collectibles",
          jewelry: "Jewelry & Luxury Items",
          "local-food": "Local Food & Artisan Goods",
          metals: "Precious Metals (Physical)",
          other: "Other High-Value Items",
        };

        const desiredName = slugToName[maybeCategoryId] || "";
        if (desiredName) {
          const resolvedId = await getMarketplaceCategoryIdByName(desiredName);
          if (resolvedId) {
            validatedData.categoryId = resolvedId;
          }
        }
      }

      // Require basic verification before allowing marketplace listings.
      // Marketplace listing requires a verified person (address/email) or an approved vendor verification.
      const vendorVerification = await storage.getVendorVerificationByUserId(user?.id);
      const buyerVerification = await storage.getBuyerVerificationByUserId(user?.id);
      const addressVerification = await storage.getAddressVerificationByUserId(user?.id);

      const isVerifiedForMarketplace =
        (vendorVerification && vendorVerification.status === "approved") ||
        (buyerVerification && buyerVerification.status === "approved") ||
        (addressVerification && addressVerification.status === "approved");

      if (!isVerifiedForMarketplace) {
        return res.status(403).json({
          message:
            "You must complete basic verification (email + address) or vendor verification before creating marketplace listings.",
          required: {
            email: true,
            address: true,
            vendorVerification: "optional_but_accepted",
          },
        });
      }

      // All new listings require admin/moderator approval before going live
      const preciousMetalsCategoryId = await getMarketplaceCategoryIdByName(
        "Precious Metals (Physical)"
      );

      const normalizedData: any = {
        ...validatedData,
        sellerId: user?.id,
        status: "pending_approval", // Require approval for all new listings
      };

      if (preciousMetalsCategoryId && validatedData.categoryId === preciousMetalsCategoryId) {
        const metals = (validatedData as any)?.specifications?.metals ?? null;
        const metalType = String(metals?.metalType || "")
          .trim()
          .toLowerCase();
        const formFactor = String(metals?.formFactor || "")
          .trim()
          .toLowerCase();
        const purity = String(metals?.purity || "").trim();

        const weightOzRaw = metals?.weightOz;
        const quantityRaw = metals?.quantityUnits ?? 1;
        const premiumRaw = metals?.premiumOverSpotUsd;

        const weightOz =
          typeof weightOzRaw === "number" ? weightOzRaw : Number(String(weightOzRaw || ""));
        const quantityUnits =
          typeof quantityRaw === "number" ? quantityRaw : Number(String(quantityRaw || ""));
        const premiumOverSpotUsd =
          premiumRaw == null
            ? null
            : typeof premiumRaw === "number"
              ? premiumRaw
              : Number(String(premiumRaw || ""));

        const allowedMetalTypes = new Set(["gold", "silver", "platinum", "palladium", "other"]);
        const allowedForms = new Set([
          "coin",
          "bar",
          "round",
          "junk",
          "grain",
          "shot",
          "scrap",
          "other",
        ]);

        if (!allowedMetalTypes.has(metalType)) {
          return res.status(400).json({
            message: "Invalid precious metals listing: metalType is required.",
          });
        }

        if (!allowedForms.has(formFactor)) {
          return res.status(400).json({
            message: "Invalid precious metals listing: formFactor is required.",
          });
        }

        if (!Number.isFinite(weightOz) || weightOz <= 0) {
          return res.status(400).json({
            message: "Invalid precious metals listing: weightOz must be a positive number.",
          });
        }

        if (!Number.isFinite(quantityUnits) || quantityUnits <= 0) {
          return res.status(400).json({
            message: "Invalid precious metals listing: quantityUnits must be a positive number.",
          });
        }

        if (
          premiumOverSpotUsd != null &&
          (!Number.isFinite(premiumOverSpotUsd) || premiumOverSpotUsd < 0)
        ) {
          return res.status(400).json({
            message:
              "Invalid precious metals listing: premiumOverSpotUsd must be >= 0 when provided.",
          });
        }

        if (purity.length > 24) {
          return res.status(400).json({
            message: "Invalid precious metals listing: purity must be 24 characters or less.",
          });
        }

        // Physical-only norm: prefer meetup-only visibility and local pickup.
        normalizedData.locationVisibility = "meetup_only";
        normalizedData.isLocalPickupOnly = true;
      }

      const listing = await storage.createMarketplaceListing(normalizedData);

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
    return res.status(410).json({
      message:
        "Listing boosts are disabled. TradeScout does not allow paid ranking in marketplace results.",
      reasonCode: "PAID_RANKING_DISABLED",
    });
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
          !["super_admin", "moderator", "ops_admin"].includes(user.role || ""))
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
        buyerPhone: null,
        buyerEmail: null,
        preferredContactMethod: "message",
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

  // Community Posts
  app.get("/api/community/posts", async (req: any, res: any) => {
    try {
      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const scopeParam =
        typeof req.query.scope === "string" ? (req.query.scope as string) : undefined;

      // Phase 1: Global community toggle (read-only visibility)
      // Allow all users to view global posts (posts-only, no new contact paths)
      const roleFromClaimsRaw = (req.user as any)?.claims?.role;
      const roleFromClaims =
        typeof roleFromClaimsRaw === "string" && roleFromClaimsRaw.trim().toLowerCase() === "owner"
          ? "super_admin"
          : roleFromClaimsRaw;
      const rawRoles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const roles: string[] = [roleFromClaims, ...(rawRoles || [])].filter(
        (r): r is string => typeof r === "string"
      );
      const isSuperAdminLike = roles.some((r) =>
        ["super_admin", "head_admin", "owner"].includes(r)
      );

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
        tag: typeof req.query.tag === "string" ? (req.query.tag as string) : undefined,
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

        case "saved": {
          if (!authUserId) {
            return res.status(401).json({ message: "Unauthorized" });
          }
          const savedPosts = await storage.getSavedCommunityPosts(String(authUserId), {
            limit: filters.limit,
            offset: filters.offset,
          });
          res.json(savedPosts);
          return;
        }

        case "nearby":
          // Nearby keeps county scoping and uses recency ordering for now.
          (filters as any).sort = "recent";
          break;

        case "recent":
          (filters as any).sort = "recent";
          break;

        case "trending":
          (filters as any).sort = "trending";
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

      // Ensure posts have keyword tags for feed scanability (no leading '#').
      // This is response-only; we do not mutate DB records here.
      const normalizeTagValue = (value: unknown): string => {
        const cleaned = String(value ?? "")
          .trim()
          .replace(/^#+/, "");
        return cleaned.trim().toLowerCase();
      };
      posts = posts.map((post: any) => {
        const rawTags = Array.isArray(post?.tags) ? post.tags : [];
        const cleaned = rawTags.map(normalizeTagValue).filter(Boolean);
        const derivedFromContent = deriveCommunityTagsFromContent(
          post?.title,
          post?.content,
          post?.category
        );
        const roleTagRaw =
          typeof post?.author?.role === "string"
            ? String(post.author.role).trim().toLowerCase()
            : "";
        const roleTag = roleTagRaw
          ? roleTagRaw.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
          : "";
        const merged = Array.from(
          new Set([...cleaned, ...derivedFromContent, roleTag].filter(Boolean))
        )
          .filter(Boolean)
          .slice(0, 12);
        return { ...post, tags: merged };
      });

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
      const { countyFips, stateCode } = req.query || {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const hasCountyScope = typeof countyFips === "string" && countyFips.length > 0;

      const totalMembersResult = hasCountyScope
        ? ((await db.execute(
            sql`select count(*)::int as count from users where county_fips = ${countyFips}`
          )) as any)
        : ((await db.execute(sql`select count(*)::int as count from users`)) as any);

      const postsTodayResult = hasCountyScope
        ? ((await db.execute(
            sql`select count(*)::int as count from community_posts where created_at >= ${today} and county_fips = ${countyFips}`
          )) as any)
        : ((await db.execute(
            sql`select count(*)::int as count from community_posts where created_at >= ${today}`
          )) as any);

      const helpRequestsResult = hasCountyScope
        ? ((await db.execute(sql`
            select count(*)::int as count
            from community_posts
            where created_at >= ${sevenDaysAgo}
              and county_fips = ${countyFips}
              and category in ('questions', 'projects')
          `)) as any)
        : ((await db.execute(sql`
            select count(*)::int as count
            from community_posts
            where created_at >= ${sevenDaysAgo}
              and category in ('questions', 'projects')
          `)) as any);

      const recommendationsResult = hasCountyScope
        ? ((await db.execute(sql`
            select count(*)::int as count
            from community_posts
            where created_at >= ${sevenDaysAgo}
              and county_fips = ${countyFips}
              and category = 'recommendations'
          `)) as any)
        : ((await db.execute(sql`
            select count(*)::int as count
            from community_posts
            where created_at >= ${sevenDaysAgo}
              and category = 'recommendations'
          `)) as any);

      const verifiedProsResult = hasCountyScope
        ? ((await db.execute(sql`
            select count(distinct c.id)::int as count
            from contractors c
            inner join contractor_counties cc on cc.contractor_id = c.id
            inner join counties co on co.id = cc.county_id
            where co.fips = ${countyFips}
              and c.is_active = true
              and c.verified_licensed = true
              and c.verified_insured = true
          `)) as any)
        : ((await db.execute(sql`
            select count(*)::int as count
            from contractors c
            where c.is_active = true
              and c.verified_licensed = true
              and c.verified_insured = true
          `)) as any);

      const countiesActiveResult = (await db.execute(
        sql`select count(distinct county_fips)::int as count from community_posts where county_fips is not null and created_at >= ${thirtyDaysAgo}`
      )) as any;

      const activeTodayResult = hasCountyScope
        ? ((await db.execute(sql`
            select count(distinct user_id)::int as count
            from (
              select author_id as user_id
              from community_posts
              where created_at >= ${today} and county_fips = ${countyFips}
              union
              select pl.user_id as user_id
              from post_likes pl
              inner join community_posts cp on cp.id = pl.post_id
              where pl.created_at >= ${today} and cp.county_fips = ${countyFips}
              union
              select pc.author_id as user_id
              from post_comments pc
              inner join community_posts cp2 on cp2.id = pc.post_id
              where pc.created_at >= ${today} and cp2.county_fips = ${countyFips}
            ) t
          `)) as any)
        : ((await db.execute(sql`
            select count(distinct user_id)::int as count
            from (
              select author_id as user_id from community_posts where created_at >= ${today}
              union
              select user_id as user_id from post_likes where created_at >= ${today}
              union
              select author_id as user_id from post_comments where created_at >= ${today}
            ) t
          `)) as any);

      // Median time-to-first-reply (in minutes) for posts created in the last 7 days.
      // Returns null when there are no replies.
      const medianFirstReplyResult = hasCountyScope
        ? ((await db.execute(sql`
            with posts as (
              select id, created_at
              from community_posts
              where created_at >= ${sevenDaysAgo}
                and county_fips = ${countyFips}
            ),
            first_reply as (
              select p.id, p.created_at, min(c.created_at) as first_reply_at
              from posts p
              inner join post_comments c on c.post_id = p.id
              group by p.id, p.created_at
            )
            select
              percentile_cont(0.5) within group (
                order by extract(epoch from (first_reply_at - created_at)) / 60.0
              ) as minutes
            from first_reply
          `)) as any)
        : ((await db.execute(sql`
            with posts as (
              select id, created_at
              from community_posts
              where created_at >= ${sevenDaysAgo}
            ),
            first_reply as (
              select p.id, p.created_at, min(c.created_at) as first_reply_at
              from posts p
              inner join post_comments c on c.post_id = p.id
              group by p.id, p.created_at
            )
            select
              percentile_cont(0.5) within group (
                order by extract(epoch from (first_reply_at - created_at)) / 60.0
              ) as minutes
            from first_reply
          `)) as any);

      const totalMembers = Number(totalMembersResult?.rows?.[0]?.count ?? 0);
      const postsToday = Number(postsTodayResult?.rows?.[0]?.count ?? 0);
      const countiesActive = Number(countiesActiveResult?.rows?.[0]?.count ?? 0);
      const activeToday = Number(activeTodayResult?.rows?.[0]?.count ?? 0);
      const helpRequests7d = Number(helpRequestsResult?.rows?.[0]?.count ?? 0);
      const recommendations7d = Number(recommendationsResult?.rows?.[0]?.count ?? 0);
      const verifiedPros = Number(verifiedProsResult?.rows?.[0]?.count ?? 0);
      const medianFirstReplyMinutes7dRaw = (medianFirstReplyResult as any)?.rows?.[0]?.minutes;
      const medianFirstReplyMinutes7d =
        medianFirstReplyMinutes7dRaw == null ? null : Number(medianFirstReplyMinutes7dRaw);

      res.json({
        totalMembers,
        activeToday,
        postsToday,
        countiesActive,
        helpRequests7d,
        recommendations7d,
        verifiedPros,
        medianFirstReplyMinutes7d,
        scope: hasCountyScope ? "local" : "global",
        stateCode: typeof stateCode === "string" ? stateCode : null,
        countyFips: hasCountyScope ? countyFips : null,
      });
    } catch (error: any) {
      console.error("Error fetching community stats:", error);
      res.json({
        totalMembers: 0,
        activeToday: 0,
        postsToday: 0,
        countiesActive: 0,
        helpRequests7d: 0,
        recommendations7d: 0,
        verifiedPros: 0,
        medianFirstReplyMinutes7d: null,
      });
    }
  });

  // XP & badges read endpoints (me-only)
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

  // Trending Topics (DB-backed; community-only)
  app.get("/api/community/trending", async (req: any, res: any) => {
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
    if (/floor|flooring|tile|tiles|grout|laminate|vinyl\s+plank|lvp|hardwood/.test(text))
      tags.add("flooring");
    if (/paint|painting|painter|primer|caulk|stain\b/.test(text)) tags.add("painting");
    if (/drywall|sheetrock|mud\b|tape\b|texture|skim\s+coat/.test(text)) tags.add("drywall");
    if (/trim\b|finish\s+work|baseboard|crown\s+molding|door\s+trim|window\s+trim/.test(text))
      tags.add("trim");
    if (/carpentry|framing|cabinet|cabinets|millwork/.test(text)) tags.add("carpentry");
    if (/masonry|brick|block|stone|chimney/.test(text)) tags.add("masonry");
    if (/insulation|spray\s+foam|attic\s+insulation/.test(text)) tags.add("insulation");
    if (/plumb|leak|pipe|drain/.test(text)) tags.add("plumbing");
    if (/electric|breaker|panel|outlet|switch/.test(text)) tags.add("electrical");
    if (/hvac|furnace|ac|air\s+conditioner|heat\s+pump/.test(text)) tags.add("hvac");
    if (/concrete|foundation|slab|driveway/.test(text)) tags.add("concrete");
    if (/siding|stucco|fascia/.test(text)) tags.add("siding");
    if (/window|windows|door|doors|garage\s+door/.test(text)) tags.add("windows_doors");
    if (/pest|termite|rodent|exterminator/.test(text)) tags.add("pest_control");
    if (/pool|hot\s+tub|spa\b/.test(text)) tags.add("pool_spa");
    if (/locksmith|rekey|lock\s+change/.test(text)) tags.add("locksmith");
    if (/cleaning|maid\s+service|deep\s+clean/.test(text)) tags.add("cleaning");
    if (/moving|movers|relocation/.test(text)) tags.add("moving");
    if (/junk\s+removal|dumpster|haul\s+away/.test(text)) tags.add("junk_removal");
    if (/fence|fencing|gate\b/.test(text)) tags.add("fencing");
    if (/landscap|lawn|sprinkler|irrigation|tree\s+service/.test(text)) tags.add("landscaping");
    if (/pressure\s+wash|power\s+wash|soft\s+wash/.test(text)) tags.add("pressure_washing");
    if (/solar|panel\s+install|pv\b/.test(text)) tags.add("solar");
    if (/security\s+camera|alarm\s+system|cctv/.test(text)) tags.add("security");
    if (/smart\s+home|home\s+automation|ring\b|nest\b/.test(text)) tags.add("smart_home");

    // Real estate + finance + governance
    if (/realtor|real\s+estate\s+agent|listing\s+agent|buyer'?s\s+agent|broker\b/.test(text))
      tags.add("real_estate");
    if (/mortgage|lender|loan|refinance|rate\b|apr\b/.test(text)) tags.add("mortgage");
    if (/insurance|insured|claim\b|policy\b|adjuster/.test(text)) tags.add("insurance");
    if (/title\s+company|escrow|closing\b/.test(text)) tags.add("title_escrow");
    if (/appraisal|appraiser/.test(text)) tags.add("appraisal");
    if (/inspection|home\s+inspector/.test(text)) tags.add("inspection");
    if (/permit|permitting|code\s+enforcement|inspection\s+department/.test(text))
      tags.add("permits_code");
    if (/attorney|lawyer|legal\b|contract\b|lien\b/.test(text)) tags.add("legal");
    if (/notary|notarize|notarized/.test(text)) tags.add("notary");
    if (/contractor|builder|remodel/.test(text)) tags.add("contractors");
    if (/marketplace|exchange|for sale|listing/.test(text)) tags.add("marketplace");
    if (/event|meetup|meeting|gathering/.test(text)) tags.add("events");
    if (/recommendation|recommendations|who do you recommend|who would you recommend/.test(text))
      tags.add("recommendations");
    if (/lead|leads|job|jobs|work\b|bid|estimate|quote/.test(text)) tags.add("work");
    if (/diy|do\s+it\s+yourself|how\s+to\b|tutorial/.test(text)) tags.add("diy");

    if (category && typeof category === "string") {
      const cat = category.toLowerCase();
      if (cat && !["general"].includes(cat)) tags.add(cat);
    }

    return Array.from(tags).slice(0, 12);
  }

  async function createAutomaticCommunityWelcomeForUser(
    user: any,
    _options?: { createdViaScout?: boolean }
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
          console.log(
            `[CATEGORY ROUTING] Request post created: ${newPost.id} - Direct Connect eligibility check queued`
          );
        }

        // 2. QUESTION → Notify Scout for potential AI response
        if (category === "question") {
          console.log(
            `[CATEGORY ROUTING] Question post created: ${newPost.id} - Scout analysis queued`
          );
        }

        // 3. FOR SALE → Auto-create marketplace listing
        if (category === "forsale") {
          console.log(
            `[CATEGORY ROUTING] For Sale post created: ${newPost.id} - Marketplace listing creation queued`
          );
        }

        // 4. ALERT → Priority notifications to relevant users
        if (category === "alert") {
          console.log(
            `[CATEGORY ROUTING] Alert post created: ${newPost.id} - Priority notifications queued`
          );
        }

        // 5. EVENT → Calendar integration
        if (category === "event") {
          console.log(
            `[CATEGORY ROUTING] Event post created: ${newPost.id} - Calendar integration queued`
          );
        }

        // 6. RECOMMENDATION → Link to contractor/business profiles
        if (category === "recommendation") {
          console.log(
            `[CATEGORY ROUTING] Recommendation post created: ${newPost.id} - Profile linking queued`
          );
        }

        // 7. TIP → Feed Scout learning system
        if (category === "tip") {
          console.log(
            `[CATEGORY ROUTING] Tip post created: ${newPost.id} - Scout learning ingestion queued`
          );
        }

        const categoryRoutingSummary: Partial<Record<string, string>> = {
          request: "direct_connect_eligibility",
          question: "scout_analysis",
          forsale: "marketplace_extraction",
          alert: "priority_notifications",
          event: "calendar_extraction",
          recommendation: "profile_linking",
          tip: "knowledge_ingestion",
        };
        const routingSummary = categoryRoutingSummary[category];
        if (resolvedCountyFips && routingSummary) {
          await db.insert(countyNotes).values({
            countyFips: resolvedCountyFips,
            authorUserId: String(userId),
            category: "operations",
            content: `community_post:${newPost.id}:${routingSummary}`,
          } as any);
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

        const viewer = userId ? await storage.getUser(String(userId)) : null;
        const post = await storage.getCommunityPost(String(postId));
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        const viewerCountyFips = (viewer as any)?.countyFips || null;
        const postCountyFips = (post as any)?.countyFips || null;
        if (
          !viewerCountyFips ||
          !postCountyFips ||
          String(viewerCountyFips) !== String(postCountyFips)
        ) {
          return res.status(403).json({
            message: "Likes are local-only. Switch to Local to interact with posts in your county.",
            reasonCode: "GLOBAL_READ_ONLY",
          });
        }

        const result = await storage.togglePostLike(userId, postId);
        res.json(result);
      } catch (error: any) {
        console.error("Error toggling post like:", error);
        res.status(500).json({ message: "Failed to toggle like" });
      }
    }
  );

  app.post(
    "/api/community/posts/:id/save",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const { id: postId } = req.params;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const viewer = await storage.getUser(String(userId));
        const post = await storage.getCommunityPost(String(postId));
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        const viewerCountyFips = (viewer as any)?.countyFips || null;
        const postCountyFips = (post as any)?.countyFips || null;
        if (
          !viewerCountyFips ||
          !postCountyFips ||
          String(viewerCountyFips) !== String(postCountyFips)
        ) {
          return res.status(403).json({
            message: "Saving is local-only. Switch to Local to interact with posts in your county.",
            reasonCode: "GLOBAL_READ_ONLY",
          });
        }

        const [existing] = await db
          .select()
          .from(communityPostSaves)
          .where(
            and(
              eq(communityPostSaves.userId, String(userId)),
              eq(communityPostSaves.postId, String(postId))
            )
          )
          .limit(1);

        if (existing) {
          await db.delete(communityPostSaves).where(eq(communityPostSaves.id, existing.id));
          return res.json({ saved: false });
        }

        await db
          .insert(communityPostSaves)
          .values({ userId: String(userId), postId: String(postId) })
          .onConflictDoNothing();

        try {
          await storage.logEvent("post.saved", {
            userId: String(userId),
            targetUserId: String((post as any).authorId),
            postId: String(postId),
            source: "community",
          });
        } catch (e) {
          console.error("Failed to log post.saved for XP", e);
        }

        res.json({ saved: true });
      } catch (error: any) {
        console.error("Error saving community post:", error);
        res.status(500).json({ message: "Failed to save post" });
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

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        if (typeof content !== "string" || !content.trim()) {
          return res.status(400).json({ message: "Comment content is required" });
        }

        const post = await storage.getCommunityPost(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        const viewer = await storage.getUser(String(userId));
        const viewerCountyFips = (viewer as any)?.countyFips || null;
        const postCountyFips = (post as any)?.countyFips || null;
        if (
          !viewerCountyFips ||
          !postCountyFips ||
          String(viewerCountyFips) !== String(postCountyFips)
        ) {
          return res.status(403).json({
            message:
              "Comments are local-only. Switch to Local to interact with posts in your county.",
            reasonCode: "GLOBAL_READ_ONLY",
          });
        }

        const enforceCommentContactGate =
          String(process.env.ENFORCE_COMMENT_CONTACT_GATE || "")
            .trim()
            .toLowerCase() === "true";

        if (enforceCommentContactGate && String(post.authorId) !== String(userId)) {
          const { getContactPermission, ensureContactRequest } =
            await import("./utils/contactRequests");
          const requester = await storage.getUser(String(userId));
          const requesterCountyFips = (requester as any)?.countyFips || null;

          const permission = await getContactPermission(String(userId), String(post.authorId));
          if (permission?.status === "accepted") {
            // proceed
          } else if (permission?.status === "pending") {
            return res.status(202).json({
              pending: true,
              requestId: permission.lastRequestNotificationId || null,
              message: "Contact request already pending recipient approval.",
            });
          } else if (permission?.status === "declined" || permission?.status === "blocked") {
            return res.status(403).json({
              message: "Recipient has declined first contact.",
              reasonCode: "CONTACT_DECLINED",
            });
          } else {
            const ensure = await ensureContactRequest({
              requesterId: String(userId),
              targetUserId: String(post.authorId),
              preview: content,
              metadata: {
                contactType: "comment",
                content,
                postId,
                source: "community",
                countyFips: requesterCountyFips,
              },
            });

            if (ensure.status === "pending") {
              return res.status(202).json({
                pending: true,
                requestId: ensure.requestId || null,
                message: "Contact request sent. Recipient must accept before comment posts.",
              });
            }
          }
        }

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
        res.status(500).json({
          message: "Failed to send post to Work Board",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get("/api/community/posts/:id/comments", async (req: any, res: any) => {
    try {
      const { id: postId } = req.params;
      const comments = await db
        .select({
          comment: postComments,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            verified: users.addressVerified,
          },
        })
        .from(postComments)
        .leftJoin(users, eq(postComments.authorId, users.id))
        .where(eq(postComments.postId, postId))
        .orderBy(asc(postComments.createdAt));

      const formatted = comments.map(({ comment, author }) => ({
        ...comment,
        author: author
          ? {
              id: author.id,
              name:
                `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Community member",
              avatar: author.profileImageUrl,
              role: author.role,
              verified: Boolean(author.verified),
            }
          : undefined,
      }));

      res.json(formatted);
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
      if (authUserId) {
        try {
          const { ensureCountyGroupMembershipForUser } = await import("./routes/groups");
          await ensureCountyGroupMembershipForUser(String(authUserId));
        } catch (membershipError) {
          console.warn(
            "[community/groups] failed to enforce county auto-membership",
            membershipError
          );
        }
      }
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const hasExplicitLocationFilters =
        Boolean(req.query.stateCode) || Boolean(req.query.countyFips);

      const filters: Parameters<typeof storage.getGroups>[0] = {
        stateCode:
          (req.query.stateCode as string) ||
          (user && !hasExplicitLocationFilters
            ? ((user as any).stateCode as string) || (user.state as string) || undefined
            : undefined),
        countyFips:
          (req.query.countyFips as string) ||
          (user && !hasExplicitLocationFilters
            ? ((user as any).countyFips as string) ||
              ((user as any).county_fips as string) ||
              undefined
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
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const reputation = await storage.getUserModerationReputation(userId);

      if (!reputation) {
        const newReputation = await storage.createUserModerationReputation({
          userId,
          canVote: true,
          votingPower: "1.0" as any,
          primaryCounty: null as any,
          primaryState: null as any,
        });
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

      try {
        const inviteBase =
          process.env.PUBLIC_WEB_URL || process.env.APP_URL || getPublicBaseUrlFromRequest(req);
        const inviteLink = `${inviteBase.replace(/\/$/, "")}/register?invite=${encodeURIComponent(invitationCode)}`;
        await emailService.sendEmail({
          to: email,
          subject: "You're invited to TradeScout",
          html: `<p>You were invited to TradeScout as <strong>${targetRole}</strong>.</p><p><a href="${inviteLink}">Accept invitation</a></p>${
            personalMessage ? `<p>Message: ${personalMessage}</p>` : ""
          }`,
          text: `You were invited to TradeScout as ${targetRole}. Accept invitation: ${inviteLink}${
            personalMessage ? `\nMessage: ${personalMessage}` : ""
          }`,
          purpose: "invitation",
        });
      } catch (emailError) {
        console.error("Invitation email send failed:", emailError);
      }

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

      const existing = await db
        .select()
        .from(professionalPartnerships)
        .where(
          and(
            or(
              and(
                eq(professionalPartnerships.initiatorId, String(userId)),
                eq(professionalPartnerships.partnerId, String(partnerId))
              ),
              and(
                eq(professionalPartnerships.initiatorId, String(partnerId)),
                eq(professionalPartnerships.partnerId, String(userId))
              )
            ),
            or(
              eq(professionalPartnerships.status, "pending"),
              eq(professionalPartnerships.status, "active")
            )
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ message: "Partnership already exists for this pair" });
      }

      const [partnership] = await db
        .insert(professionalPartnerships)
        .values({
          initiatorId: String(userId),
          partnerId: String(partnerId),
          partnershipType,
          referralTerms: referralTerms ?? null,
          partnershipDescription: partnershipDescription ?? null,
          status: "pending",
        } as any)
        .returning();

      res.status(201).json(partnership);
    } catch (error: any) {
      console.error("Error creating partnership:", error);
      res.status(500).json({ message: "Failed to create partnership request" });
    }
  });

  // Get user's partnerships
  app.get("/api/partnerships/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const rows = await db
        .select()
        .from(professionalPartnerships)
        .where(
          or(
            eq(professionalPartnerships.initiatorId, String(userId)),
            eq(professionalPartnerships.partnerId, String(userId))
          )
        )
        .orderBy(desc(professionalPartnerships.createdAt))
        .limit(200);

      return res.json(rows);
    } catch (error: any) {
      console.error("Error fetching partnerships:", error);
      res.status(500).json({ message: "Failed to fetch partnerships" });
    }
  });

  // Find potential partners by role
  app.get("/api/partnerships/find/:role", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { role } = req.params;
      const targetRole = String(role || "").trim();
      if (!targetRole) {
        return res.status(400).json({ message: "Role is required" });
      }

      const candidates = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          county: users.county,
          state: users.state,
          city: users.city,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(and(eq(users.role, targetRole as any), sql`${users.id} <> ${String(userId)}`))
        .orderBy(desc(users.createdAt))
        .limit(50);

      res.json(candidates);
    } catch (error: any) {
      console.error("Error finding potential partners:", error);
      res.status(500).json({ message: "Failed to find potential partners" });
    }
  });

  // ==================== AFFILIATE SYSTEM ROUTES ====================

  // ---------------------------------------------------------------------------
  // Back-compat endpoints used by Scout tools / older clients
  // ---------------------------------------------------------------------------

  // Enroll the current user into the affiliate program (idempotent)
  app.post("/api/affiliate/enroll", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      let program = await storage.getAffiliateProgram(userId);
      if (!program) {
        program = await storage.createAffiliateProgram({ userId } as any);
      }

      return res.json({
        affiliateId: (program as any).id || (program as any).affiliateId || userId,
        status: (program as any).status ?? "active",
      });
    } catch (error: any) {
      console.error("Error enrolling affiliate:", error);
      res.status(500).json({ message: "Failed to enroll affiliate" });
    }
  });

  // Generate a canonical referral URL for the current user's affiliate code
  app.post("/api/affiliate/link", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const destination =
        typeof req.body?.destination === "string" ? req.body.destination.trim() : "";
      const entityId = typeof req.body?.entityId === "string" ? req.body.entityId.trim() : "";

      if (!destination || !destination.startsWith("/")) {
        return res
          .status(400)
          .json({ message: "destination must be a relative path starting with '/'" });
      }

      let program = await storage.getAffiliateProgram(userId);
      if (!program) {
        program = await storage.createAffiliateProgram({ userId } as any);
      }

      let referralCode = String((program as any).referralCode || "").trim();
      if (!referralCode) {
        // Server-side repair for legacy rows: missing referralCode is not a client fault.
        referralCode = await storage.generateAffiliateCode(userId);
        try {
          await storage.updateAffiliateProgram(program.id, { referralCode } as any);
        } catch {
          // Best-effort: if the update fails, still attempt to proceed with the generated code.
        }
      }

      const baseOrigin =
        process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com";
      const url = new URL(destination, baseOrigin);
      if (!url.searchParams.has("ref")) {
        url.searchParams.set("ref", referralCode);
      }
      if (entityId && !url.searchParams.has("eid")) {
        url.searchParams.set("eid", entityId);
      }

      return res.json({ url: url.toString() });
    } catch (error: any) {
      console.error("Error generating affiliate link:", error);
      res.status(500).json({ message: "Failed to generate affiliate link" });
    }
  });

  // Log an attributed action for affiliate tracking (best-effort, non-throwing)
  app.post("/api/affiliate/referral", isAuthenticated, async (req: any, res: any) => {
    try {
      const affiliateId =
        typeof req.body?.affiliateId === "string" ? req.body.affiliateId.trim() : "";
      const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
      const entityId = typeof req.body?.entityId === "string" ? req.body.entityId.trim() : "";

      if (!affiliateId || !action) {
        return res.status(400).json({ ok: false, message: "affiliateId and action are required" });
      }

      // Only record if the affiliate program exists; do not error if missing.
      const program = await storage
        .getAffiliateProgramByAccountId(affiliateId)
        .catch(() => undefined);
      if (program) {
        await storage
          .trackReferralClick({
            affiliateId,
            referredUserId: null,
            shareLinkId: null,
            customLink: entityId ? `${action}:${entityId}` : action,
            conversionSource: "internal_action",
            conversionType: action,
            couponCode: null,
          } as any)
          .catch((e) => console.error("Failed to record affiliate referral action", e));
      }

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error recording affiliate referral:", error);
      // Non-throwing contract: always return 200-ish unless request is malformed.
      return res.json({ ok: false });
    }
  });

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
      const affiliateCode =
        typeof req.body?.affiliateCode === "string"
          ? req.body.affiliateCode.trim()
          : typeof req.body?.ref === "string"
            ? req.body.ref.trim()
            : "";

      const destination =
        typeof req.body?.destination === "string"
          ? req.body.destination.trim()
          : typeof req.body?.url === "string"
            ? req.body.url.trim()
            : "";

      const source = typeof req.body?.source === "string" ? req.body.source.trim() : "site";

      if (!affiliateCode) {
        return res.status(400).json({ ok: false, message: "affiliateCode is required" });
      }

      const [account] = await db
        .select()
        .from(affiliateAccounts)
        .where(eq(affiliateAccounts.referralCode, affiliateCode))
        .limit(1);

      if (!account) {
        // Do not reveal whether a code exists; treat as ok to prevent probing.
        return res.json({ ok: true });
      }

      await storage.trackReferralClick({
        affiliateId: account.id,
        referredUserId: null,
        shareLinkId: null,
        customLink: destination || null,
        conversionSource: source,
        conversionType: "click",
        couponCode: null,
      } as any);

      return res.json({ ok: true });
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
      const { affiliateProgramId, referralId, transactionId, revenueAmount, commissionAmount } =
        req.body;

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
        if (!user || !["ops_admin", "super_admin"].includes(userRole)) {
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
      if (!user || !["ops_admin", "super_admin"].includes(userRole)) {
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
        if (!user || !["ops_admin", "super_admin"].includes(userRole)) {
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
  app.get("/api/marketplace/search", marketplaceSearchLimiter, async (req: any, res: any) => {
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

  // ---------------------------------------------------------------------------
  // HomeScout (Real Estate Portal)
  // ---------------------------------------------------------------------------

  const homeScoutReportLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000,
        max: 6,
        message: "Too many HomeScout reports, please slow down",
        store: limiterStore("homescout_report"),
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (req: any, _res: any, next: any) => next();

  const homeScoutInspectionLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000,
        max: 8,
        message: "Too many HomeScout inspection actions, please slow down",
        store: limiterStore("homescout_inspection"),
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (req: any, _res: any, next: any) => next();

  app.get("/api/homescout/search", homeScoutSearchLimiter, async (req: any, res: any) => {
    try {
      const {
        query,
        countyFips,
        stateCode,
        propertyType,
        bedsMin,
        bathsMin,
        sqftMin,
        yearBuiltMin,
        maxDomDays,
        priceDropsOnly,
        minPrice,
        maxPrice,
        sortBy = "newest",
        limit = 20,
        offset = 0,
      } = req.query ?? {};

      const rows = await storage.searchHomeScoutListings({
        query: typeof query === "string" ? query : undefined,
        countyFips: typeof countyFips === "string" ? countyFips : undefined,
        stateCode: typeof stateCode === "string" ? stateCode : undefined,
        propertyType: typeof propertyType === "string" ? (propertyType as any) : undefined,
        bedsMin: bedsMin != null ? Number(bedsMin) : undefined,
        bathsMin: bathsMin != null ? Number(bathsMin) : undefined,
        sqftMin: sqftMin != null ? Number(sqftMin) : undefined,
        yearBuiltMin: yearBuiltMin != null ? Number(yearBuiltMin) : undefined,
        maxDomDays: maxDomDays != null ? Number(maxDomDays) : undefined,
        priceDropsOnly: priceDropsOnly === "true",
        priceMin: minPrice != null ? Number(minPrice) : undefined,
        priceMax: maxPrice != null ? Number(maxPrice) : undefined,
        // Search is public-facing; only active inventory is discoverable here.
        status: "active" as any,
        sortBy: typeof sortBy === "string" ? (sortBy as any) : "newest",
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json(rows);
    } catch (error: any) {
      console.error("Error searching HomeScout listings:", error);
      res.status(500).json({ message: "Failed to search HomeScout listings" });
    }
  });

  // Backwards-compatible alias: older clients used /api/homescout/search/county?fips=XXXXX&stateCode=YY
  // Keep this route thin and deterministic by delegating to the unified search function.
  app.get("/api/homescout/search/county", homeScoutSearchLimiter, async (req: any, res: any) => {
    try {
      const fips = typeof req.query?.fips === "string" ? String(req.query.fips).trim() : "";
      const stateCode =
        typeof req.query?.stateCode === "string" ? String(req.query.stateCode).trim() : "";
      const limitRaw = req.query?.limit;
      const offsetRaw = req.query?.offset;

      if (!/^[0-9]{5}$/.test(fips) || !/^[A-Za-z]{2}$/.test(stateCode)) {
        return res.status(400).json({ message: "Invalid county fips or stateCode" });
      }

      const rows = await storage.searchHomeScoutListings({
        countyFips: fips,
        stateCode: stateCode.toUpperCase(),
        status: "active" as any,
        sortBy: "newest" as any,
        limit: limitRaw != null ? Number(limitRaw) : 20,
        offset: offsetRaw != null ? Number(offsetRaw) : 0,
      });

      return res.json(rows);
    } catch (error: any) {
      console.error("Error searching HomeScout county listings:", error);
      return res.status(500).json({ message: "Failed to search HomeScout county listings" });
    }
  });

  app.get("/api/homescout/listings/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const listing = await storage.getHomeScoutListing(String(id));
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Only active listings are public. Pending/removed listings are visible only to:
      // - the seller/agent/contact user
      // - admins
      const status = String((listing as any).status || "active");
      if (status !== "active") {
        const viewerId = (req.user as any)?.claims?.sub || (req.user as any)?.id || null;
        if (!viewerId) {
          return res.status(404).json({ message: "Listing not found" });
        }

        const viewer = await storage.getUser(viewerId);
        const viewerRole = (viewer as any)?.role || "";
        const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(String(viewerRole));
        const isOwner =
          viewerId === (listing as any).sellerUserId ||
          viewerId === (listing as any).agentUserId ||
          viewerId === (listing as any).contactUserId;

        if (!isAdminLike && !isOwner) {
          return res.status(404).json({ message: "Listing not found" });
        }
      }
      const contactUserId =
        (listing as any).contactUserId ||
        (listing as any).agentUserId ||
        (listing as any).sellerUserId;

      const events = await storage.listHomeScoutListingEvents({
        listingId: String((listing as any).id),
        limit: 100,
        offset: 0,
      });

      const bedsNum = (listing as any).beds != null ? Number((listing as any).beds) : null;
      const bedsBucket =
        bedsNum == null || !Number.isFinite(bedsNum)
          ? null
          : bedsNum >= 5
            ? 5
            : Math.max(0, Math.trunc(bedsNum));

      const propertyType = String((listing as any).propertyType || "house");
      const countyFipsStr = String((listing as any).countyFips || "");
      const stateCodeStr = String((listing as any).stateCode || "");

      const partnerRecommendations = await storage.listHomeScoutPartnerRecommendations({
        countyFips: countyFipsStr,
        stateCode: stateCodeStr,
        limitPerCategory: 3,
      });
      const inspectorRecommendations = partnerRecommendations
        .filter((x: any) => String(x?.category || "") === "inspector")
        .slice(0, 3);

      const marketBucket =
        (await storage.getHomeScoutMarketBucket({
          countyFips: countyFipsStr,
          stateCode: stateCodeStr,
          propertyType,
          bedsBucket,
        })) ||
        (await storage.getHomeScoutMarketBucket({
          countyFips: countyFipsStr,
          stateCode: stateCodeStr,
          propertyType,
          bedsBucket: null,
        })) ||
        null;

      const countyMetrics = await storage.getCountyMetricsForCounty({
        countyFips: countyFipsStr,
        metricKeys: [
          "homescout_active_listings",
          "homescout_median_price",
          "homescout_median_dom_days",
          "homescout_price_drops_7d",
        ],
      });

      const inspectionReports = await storage.listHomeScoutInspectionReports({
        listingId: String((listing as any).id),
        visibility: "public",
        status: "published",
        limit: 50,
        offset: 0,
      } as any);

      // Authenticated viewers may see their own uploads (even if pending/private/removed).
      const viewerId = (req.user as any)?.claims?.sub || (req.user as any)?.id || null;
      let myInspectionReports: any[] = [];
      let pendingInspectionReports: any[] = [];
      if (viewerId) {
        try {
          myInspectionReports = await storage.listHomeScoutInspectionReports({
            listingId: String((listing as any).id),
            submittedByUserId: String(viewerId),
            limit: 50,
            offset: 0,
          } as any);

          const viewer = await storage.getUser(String(viewerId));
          const viewerRole = String((viewer as any)?.role || "");
          const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(viewerRole);
          const isOwner =
            String(viewerId) === String((listing as any).sellerUserId || "") ||
            String(viewerId) === String((listing as any).agentUserId || "") ||
            String(viewerId) === String((listing as any).contactUserId || "");

          if (isAdminLike || isOwner) {
            pendingInspectionReports = await storage.listHomeScoutInspectionReports({
              listingId: String((listing as any).id),
              visibility: "public",
              status: "pending_review",
              limit: 50,
              offset: 0,
            } as any);
          }
        } catch {
          // Do not fail the listing page if privileged inspection metadata can't be loaded.
          myInspectionReports = [];
          pendingInspectionReports = [];
        }
      }

      const openInspectionRequests = await storage.listHomeScoutInspectionRequests({
        listingId: String((listing as any).id),
        status: "open",
        limit: 50,
        offset: 0,
      } as any);

      // Do not bypass privacy: consumers may optionally call /api/users/:userId/public.
      res.json({
        listing,
        contactUserId: contactUserId || null,
        events,
        marketBucket,
        countyMetrics,
        inspectorRecommendations,
        inspectionReports,
        myInspectionReports,
        pendingInspectionReports,
        openInspectionRequests,
      });
    } catch (error: any) {
      console.error("Error fetching HomeScout listing:", error);
      res.status(500).json({ message: "Failed to fetch HomeScout listing" });
    }
  });

  function extractInspectionPhrases(reports: any[]): string[] {
    const out: string[] = [];
    for (const r of reports) {
      if (typeof r?.summary === "string" && r.summary.trim()) out.push(r.summary.trim());
      if (Array.isArray(r?.highlights)) {
        for (const h of r.highlights) {
          if (typeof h === "string" && h.trim()) out.push(h.trim());
        }
      }
    }
    return out;
  }

  function scoreKeywordHits(lines: string[], keywords: string[]): number {
    const lower = lines.map((x) => x.toLowerCase());
    let hits = 0;
    for (const k of keywords) {
      const kw = k.toLowerCase();
      if (lower.some((ln) => ln.includes(kw))) hits += 1;
    }
    return hits;
  }

  function buildInspectionInsights(listing: any, reports: any[]) {
    const phrases = extractInspectionPhrases(reports);
    const normalizedHighlights = phrases
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 400);

    const counts = new Map<string, number>();
    for (const h of normalizedHighlights) {
      const key = h.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const allHighlights = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([text, mentions]) => ({ text, mentions }));

    const consensusHighlights = allHighlights.filter((x) => x.mentions >= 2).slice(0, 20);

    const roofHits = scoreKeywordHits(normalizedHighlights, [
      "roof",
      "leak",
      "shingle",
      "flashing",
    ]);
    const foundationHits = scoreKeywordHits(normalizedHighlights, [
      "foundation",
      "settlement",
      "crack",
      "structural",
    ]);
    const electricalHits = scoreKeywordHits(normalizedHighlights, [
      "electrical",
      "panel",
      "wiring",
      "breaker",
      "gfci",
    ]);
    const plumbingHits = scoreKeywordHits(normalizedHighlights, [
      "plumbing",
      "leak",
      "water heater",
      "pipe",
      "sewer",
    ]);
    const hvacHits = scoreKeywordHits(normalizedHighlights, [
      "hvac",
      "ac",
      "furnace",
      "air handler",
    ]);
    const moistureHits = scoreKeywordHits(normalizedHighlights, [
      "mold",
      "moisture",
      "rot",
      "humidity",
    ]);

    const severitySignals = roofHits + foundationHits * 2 + moistureHits * 2 + electricalHits;

    const buyerRecommendations: string[] = [];
    const sellerRecommendations: string[] = [];
    const questionsToAsk: string[] = [];
    const negotiationPoints: string[] = [];

    buyerRecommendations.push(
      "Cross-check repeated findings across multiple reports before making concessions."
    );
    questionsToAsk.push("What items are safety-related vs. maintenance-related?");
    questionsToAsk.push("Which findings are active issues vs. observed history?");

    if (foundationHits > 0) {
      buyerRecommendations.push(
        "If foundation/structural items appear, ask for a licensed structural evaluation."
      );
      questionsToAsk.push("Are cracks active, and what evidence supports that?");
      negotiationPoints.push("Structural items: request credits tied to third-party estimates.");
      sellerRecommendations.push(
        "If any structural notes exist, gather engineer letters or repair invoices before showings."
      );
    }
    if (roofHits > 0) {
      buyerRecommendations.push(
        "If roof concerns appear, request an inspection by a roofing contractor for scope + remaining life."
      );
      negotiationPoints.push(
        "Roof: negotiate based on remaining life and documented repair quotes."
      );
      sellerRecommendations.push(
        "Address obvious roof leak sources and document repairs with photos/invoices."
      );
    }
    if (electricalHits > 0) {
      buyerRecommendations.push(
        "Electrical findings: prioritize safety fixes and confirm permit requirements in your county."
      );
      negotiationPoints.push(
        "Electrical safety items: negotiate for immediate remediation or credits."
      );
      sellerRecommendations.push(
        "Fix obvious electrical safety items (GFCI, exposed wiring) before listing photos and open houses."
      );
    }
    if (plumbingHits > 0) {
      buyerRecommendations.push(
        "Plumbing findings: confirm whether leaks are active and request camera scope if sewer is mentioned."
      );
      sellerRecommendations.push(
        "Repair active leaks and replace worn supply lines; keep receipts for disclosure."
      );
    }
    if (hvacHits > 0) {
      buyerRecommendations.push(
        "HVAC findings: ask for service records and confirm age/efficiency; consider a tune-up addendum."
      );
      sellerRecommendations.push(
        "Service HVAC, replace filters, and document last maintenance date before listing."
      );
    }
    if (moistureHits > 0) {
      buyerRecommendations.push(
        "Moisture/mold signals: treat as time-sensitive and confirm root-cause (drainage, ventilation, leaks)."
      );
      negotiationPoints.push("Moisture mitigation: negotiate using itemized remediation bids.");
      sellerRecommendations.push(
        "Handle moisture sources first; dry-out plus documentation reduces buyer uncertainty."
      );
    }

    if (severitySignals === 0 && reports.length > 0) {
      buyerRecommendations.push(
        "No major red flags detected in the uploaded highlights. Still verify permits/age of major systems."
      );
      sellerRecommendations.push(
        "Use the clean inspection narrative to build confidence: organize docs and concise disclosures."
      );
    }

    // Light market context using precomputed county metrics already returned elsewhere.
    const propertyType = String(listing?.propertyType || "house");
    const condition = String(listing?.condition || "");
    if (propertyType && condition) {
      sellerRecommendations.push(
        "Align fixes with your condition tier so pricing and photos match buyer expectations."
      );
    }

    return {
      reportCount: reports.length,
      reportTypes: Array.from(new Set(reports.map((r) => String(r?.reportType || "other")))),
      consensusHighlights,
      allHighlights,
      buyerRecommendations: buyerRecommendations.slice(0, 10),
      sellerRecommendations: sellerRecommendations.slice(0, 10),
      questionsToAsk: questionsToAsk.slice(0, 10),
      negotiationPoints: negotiationPoints.slice(0, 10),
    };
  }

  app.get("/api/homescout/listings/:id/inspection-insights", async (req: any, res: any) => {
    try {
      const listingId = String(req.params.id || "").trim();
      if (!listingId) return res.status(400).json({ message: "Listing id required" });

      const listing = await storage.getHomeScoutListing(listingId);
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      // Only published public reports are used for public insights.
      const reports = await storage.listHomeScoutInspectionReports({
        listingId,
        visibility: "public",
        status: "published",
        limit: 100,
        offset: 0,
      } as any);

      const insights = buildInspectionInsights(listing, reports as any[]);
      return res.json({ listingId, insights });
    } catch (error: any) {
      console.error("Error building inspection insights:", error);
      return res.status(500).json({ message: "Failed to build inspection insights" });
    }
  });

  app.post("/api/homescout/presale-suggestions", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const body = req.body ?? {};
      const stateCode = typeof body.stateCode === "string" ? body.stateCode.trim() : "";
      const countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : "";
      const condition = typeof body.condition === "string" ? body.condition.trim() : "";
      const yearBuilt = body.yearBuilt != null ? Number(body.yearBuilt) : null;
      const sqft = body.sqft != null ? Number(body.sqft) : null;
      const features: string[] = Array.isArray(body.features)
        ? body.features
            .filter((x: any) => typeof x === "string")
            .map((x: string) => x.trim())
            .filter(Boolean)
            .slice(0, 60)
        : [];

      if (!stateCode || stateCode.length !== 2) {
        return res.status(400).json({ message: "stateCode required" });
      }
      if (!countyFips || !/^[0-9]{5}$/.test(countyFips)) {
        return res.status(400).json({ message: "countyFips required" });
      }

      const suggestions: any[] = [];

      // Universal presentation wins
      suggestions.push({
        title: "Deep clean + declutter the entry and main living spaces",
        why: "Buyers anchor quickly. A strong first 30 seconds improves perceived condition.",
        effort: "medium",
        costRange: "low",
        timeline: "1-2 days",
      });

      suggestions.push({
        title: "Fix visible small defects (drips, loose handles, missing covers, squeaks)",
        why: "Small issues read as neglect. Tightening them raises trust and reduces inspection anxiety.",
        effort: "low",
        costRange: "low",
        timeline: "half day",
      });

      const older =
        typeof yearBuilt === "number" && Number.isFinite(yearBuilt) ? yearBuilt < 1990 : false;
      if (older) {
        suggestions.push({
          title: "Pre-list electrical + plumbing safety check",
          why: "Older homes benefit from proactive safety validation that reduces buyer objections.",
          effort: "medium",
          costRange: "medium",
          timeline: "1 week",
        });
      }

      if (condition === "fair" || condition === "needs_work") {
        suggestions.push({
          title:
            "Prioritize curb appeal: landscaping, power wash, fresh mulch, touch-up exterior paint",
          why: "For fixer-leaning listings, curb appeal protects value by signaling potential and care.",
          effort: "medium",
          costRange: "low",
          timeline: "1-3 days",
        });
      } else {
        suggestions.push({
          title: "Neutral paint and consistent lighting temperatures",
          why: "Modern photos and showings look cleaner and larger with consistent light and neutral tones.",
          effort: "medium",
          costRange: "medium",
          timeline: "2-7 days",
        });
      }

      if (!features.some((f: string) => /smoke|co2|carbon/i.test(f))) {
        suggestions.push({
          title: "Install/verify smoke + CO detectors",
          why: "Safety basics reduce buyer worry and can help with appraisal/insurance friction.",
          effort: "low",
          costRange: "low",
          timeline: "1 hour",
        });
      }

      if (typeof sqft === "number" && Number.isFinite(sqft) && sqft > 2500) {
        suggestions.push({
          title: "Stage or define oversized rooms (office, dining, flex space)",
          why: "Bigger homes sell better when spaces have a clear purpose in photos and tours.",
          effort: "medium",
          costRange: "low",
          timeline: "1-2 days",
        });
      }

      // Light local context: precomputed county metrics are the authoritative inputs.
      const countyMetrics = await storage.getCountyMetricsForCounty({
        countyFips,
        metricKeys: ["homescout_median_dom_days", "homescout_median_price"],
      });
      const dom = countyMetrics.find((m: any) => m.metricKey === "homescout_median_dom_days");
      const domDays = dom?.metricValue != null ? Number(dom.metricValue) : null;
      if (typeof domDays === "number" && Number.isFinite(domDays) && domDays > 45) {
        suggestions.push({
          title:
            "Boost photo quality and listing clarity (floor plan, room labels, daylight shots)",
          why: "In slower markets, presentation reduces time-on-market and improves showing conversion.",
          effort: "low",
          costRange: "low",
          timeline: "1-2 days",
        });
      }

      return res.json({
        countyFips,
        stateCode,
        suggestions: suggestions.slice(0, 10),
      });
    } catch (error: any) {
      console.error("Error generating presale suggestions:", error);
      return res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  app.get("/api/homescout/inspection-reports/:reportId/download", async (req: any, res: any) => {
    try {
      const reportId = String(req.params.reportId || "");
      if (!reportId) return res.status(400).json({ message: "reportId required" });

      const report = await storage.getHomeScoutInspectionReport(reportId);
      if (!report) return res.status(404).json({ message: "Inspection report not found" });

      const listing = await storage.getHomeScoutListing(String((report as any).listingId || ""));
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const isPublicReport =
        String((report as any).status || "") === "published" &&
        String((report as any).visibility || "") === "public";

      if (!isPublicReport) {
        const viewerId = (req.user as any)?.claims?.sub || (req.user as any)?.id || null;
        if (!viewerId) return res.status(403).json({ message: "Not allowed" });

        const viewer = await storage.getUser(String(viewerId));
        const viewerRole = String((viewer as any)?.role || "");
        const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(viewerRole);
        const isOwner =
          String(viewerId) === String((listing as any).sellerUserId || "") ||
          String(viewerId) === String((listing as any).agentUserId || "") ||
          String(viewerId) === String((listing as any).contactUserId || "") ||
          String(viewerId) === String((report as any).submittedByUserId || "");

        if (!isAdminLike && !isOwner) {
          return res.status(403).json({ message: "Not allowed" });
        }
      }

      const upstreamUrl = String((report as any).reportUrl || "").trim();
      if (!upstreamUrl || !/^https?:\/\//i.test(upstreamUrl)) {
        return res.status(400).json({ message: "Invalid report URL" });
      }

      const upstream = await fetch(upstreamUrl, {
        headers: { Accept: "application/pdf,application/octet-stream,*/*" },
      });
      if (!upstream.ok) {
        return res.status(502).json({ message: "Failed to fetch report file" });
      }

      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      const sourcePath = (() => {
        try {
          return new URL(upstreamUrl).pathname || "";
        } catch {
          return "";
        }
      })();
      const ext = (sourcePath.match(/\.([a-zA-Z0-9]{2,8})$/)?.[1] || "pdf").toLowerCase();
      const safeExt = /^[a-z0-9]{2,8}$/.test(ext) ? ext : "pdf";
      const baseName = `homescout-inspection-${reportId}.${safeExt}`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
      res.setHeader("Cache-Control", "private, max-age=300");

      const body = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Length", String(body.byteLength));
      return res.status(200).send(body);
    } catch (error: any) {
      console.error("Error downloading HomeScout inspection report:", error);
      res.status(500).json({ message: "Failed to download inspection report" });
    }
  });

  app.post(
    "/api/homescout/listings/:id/inspection-requests",
    isAuthenticated,
    homeScoutInspectionLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "Listing id required" });

        const listing = await storage.getHomeScoutListing(listingId);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const body = req.body ?? {};
        const requestMessage =
          typeof body.requestMessage === "string" ? body.requestMessage.trim() : "";
        const preferredWindow =
          typeof body.preferredWindow === "string" ? body.preferredWindow.trim() : "";

        if (!requestMessage || requestMessage.length < 12 || requestMessage.length > 2000) {
          return res.status(400).json({ message: "requestMessage must be 12-2000 characters" });
        }
        if (preferredWindow.length > 120) {
          return res.status(400).json({ message: "preferredWindow must be <= 120 characters" });
        }

        const created = await storage.createHomeScoutInspectionRequest({
          listingId,
          requesterUserId: String(userId),
          status: "open" as any,
          requestMessage,
          preferredWindow: preferredWindow || null,
          fulfilledAt: null,
          cancelledAt: null,
        } as any);

        res.status(201).json({ id: created.id });
      } catch (error: any) {
        console.error("Error creating HomeScout inspection request:", error);
        res.status(500).json({ message: "Failed to create inspection request" });
      }
    }
  );

  app.post(
    "/api/homescout/listings/:id/inspection-reports",
    isAuthenticated,
    homeScoutInspectionLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "Listing id required" });

        const listing = await storage.getHomeScoutListing(listingId);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const body = req.body ?? {};
        const reportType =
          typeof body.reportType === "string" && body.reportType.trim()
            ? body.reportType.trim()
            : "other";
        const reportUrl = typeof body.reportUrl === "string" ? body.reportUrl.trim() : "";
        const inspectionDate =
          typeof body.inspectionDate === "string" && body.inspectionDate.trim()
            ? body.inspectionDate.trim()
            : null;
        const inspectorName =
          typeof body.inspectorName === "string" ? body.inspectorName.trim() : "";
        const inspectorCompany =
          typeof body.inspectorCompany === "string" ? body.inspectorCompany.trim() : "";
        const inspectorLicense =
          typeof body.inspectorLicense === "string" ? body.inspectorLicense.trim() : "";
        const summary = typeof body.summary === "string" ? body.summary.trim() : "";
        const sourceRequestId =
          typeof body.sourceRequestId === "string" ? body.sourceRequestId.trim() : "";
        const highlights = Array.isArray(body.highlights)
          ? body.highlights
              .filter((x: any) => typeof x === "string")
              .map((x: string) => x.trim())
              .filter(Boolean)
              .slice(0, 20)
          : [];

        const allowedReportTypes = [
          "seller_pre_listing",
          "buyer_independent",
          "municipal",
          "other",
        ];
        if (!allowedReportTypes.includes(reportType)) {
          return res.status(400).json({ message: "Invalid reportType" });
        }
        if (!reportUrl || reportUrl.length > 500 || !/^https?:\/\//i.test(reportUrl)) {
          return res.status(400).json({ message: "reportUrl (http/https) required" });
        }
        if (summary.length > 4000) {
          return res.status(400).json({ message: "summary too long" });
        }
        if (
          inspectorName.length > 140 ||
          inspectorCompany.length > 140 ||
          inspectorLicense.length > 80
        ) {
          return res.status(400).json({ message: "Inspector fields exceed max length" });
        }

        const isOwner =
          String(userId) === String((listing as any).sellerUserId || "") ||
          String(userId) === String((listing as any).agentUserId || "") ||
          String(userId) === String((listing as any).contactUserId || "");

        let sourceRequest: any = null;
        if (sourceRequestId) {
          sourceRequest = await storage.getHomeScoutInspectionRequest(sourceRequestId);
          if (!sourceRequest || String((sourceRequest as any).listingId) !== listingId) {
            return res.status(400).json({ message: "Invalid sourceRequestId for listing" });
          }
        }

        if (reportType === "seller_pre_listing" && !isOwner) {
          return res
            .status(403)
            .json({ message: "Only listing owner/agent can upload seller reports" });
        }
        // Buyer independent uploads are allowed without a source request, but default to pending_review
        // so the listing owner (or admin) can approve for public visibility.
        if (
          sourceRequest &&
          String((sourceRequest as any).requesterUserId) !== String(userId) &&
          !isOwner
        ) {
          return res
            .status(403)
            .json({ message: "You can only fulfill your own inspection request" });
        }

        const shouldAutoPublish =
          reportType === "seller_pre_listing" ? isOwner : Boolean(sourceRequest) || isOwner; // fulfilling a request or owner uploads

        const created = await storage.createHomeScoutInspectionReport({
          listingId,
          submittedByUserId: String(userId),
          reportType: reportType as any,
          inspectionDate: inspectionDate || null,
          inspectorName: inspectorName || null,
          inspectorCompany: inspectorCompany || null,
          inspectorLicense: inspectorLicense || null,
          summary: summary || null,
          highlights,
          reportUrl,
          sourceRequestId: sourceRequestId || null,
          visibility: "public" as any,
          status: (shouldAutoPublish ? "published" : "pending_review") as any,
        } as any);

        if (sourceRequestId) {
          await storage.markHomeScoutInspectionRequestFulfilled({ requestId: sourceRequestId });
        }

        res.status(201).json({ id: created.id, status: (created as any).status || null });
      } catch (error: any) {
        console.error("Error creating HomeScout inspection report:", error);
        res.status(500).json({ message: "Failed to upload inspection report" });
      }
    }
  );

  app.post(
    "/api/homescout/inspection-reports/:reportId/publish",
    isAuthenticated,
    homeScoutInspectionLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const reportId = String(req.params.reportId || "");
        if (!reportId) return res.status(400).json({ message: "reportId required" });

        const report = await storage.getHomeScoutInspectionReport(reportId);
        if (!report) return res.status(404).json({ message: "Inspection report not found" });

        const listing = await storage.getHomeScoutListing(String((report as any).listingId || ""));
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const viewer = await storage.getUser(String(userId));
        const viewerRole = String((viewer as any)?.role || "");
        const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(viewerRole);
        const isOwner =
          String(userId) === String((listing as any).sellerUserId || "") ||
          String(userId) === String((listing as any).agentUserId || "") ||
          String(userId) === String((listing as any).contactUserId || "");

        if (!isAdminLike && !isOwner) {
          return res.status(403).json({ message: "Not allowed" });
        }

        const updated = await storage.updateHomeScoutInspectionReportStatus({
          reportId,
          status: "published",
        } as any);

        return res.json({ id: reportId, status: (updated as any)?.status || "published" });
      } catch (error: any) {
        console.error("Error publishing HomeScout inspection report:", error);
        return res.status(500).json({ message: "Failed to publish report" });
      }
    }
  );

  app.post(
    "/api/homescout/inspection-reports/:reportId/remove",
    isAuthenticated,
    homeScoutInspectionLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const reportId = String(req.params.reportId || "");
        if (!reportId) return res.status(400).json({ message: "reportId required" });

        const report = await storage.getHomeScoutInspectionReport(reportId);
        if (!report) return res.status(404).json({ message: "Inspection report not found" });

        const listing = await storage.getHomeScoutListing(String((report as any).listingId || ""));
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const viewer = await storage.getUser(String(userId));
        const viewerRole = String((viewer as any)?.role || "");
        const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(viewerRole);
        const isOwner =
          String(userId) === String((listing as any).sellerUserId || "") ||
          String(userId) === String((listing as any).agentUserId || "") ||
          String(userId) === String((listing as any).contactUserId || "");

        if (!isAdminLike && !isOwner) {
          return res.status(403).json({ message: "Not allowed" });
        }

        const updated = await storage.updateHomeScoutInspectionReportStatus({
          reportId,
          status: "removed",
        } as any);

        return res.json({ id: reportId, status: (updated as any)?.status || "removed" });
      } catch (error: any) {
        console.error("Error removing HomeScout inspection report:", error);
        return res.status(500).json({ message: "Failed to remove report" });
      }
    }
  );

  app.post(
    "/api/homescout/inspection-reports/:reportId/service-requests",
    isAuthenticated,
    homeScoutInspectionLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const reportId = String(req.params.reportId || "");
        if (!reportId) return res.status(400).json({ message: "reportId required" });

        const report = await storage.getHomeScoutInspectionReport(reportId);
        if (!report) return res.status(404).json({ message: "Inspection report not found" });

        const listing = await storage.getHomeScoutListing(String((report as any).listingId || ""));
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const body = req.body ?? {};
        const serviceCategory =
          typeof body.serviceCategory === "string" ? body.serviceCategory.trim() : "";
        const serviceDescription =
          typeof body.serviceDescription === "string" ? body.serviceDescription.trim() : "";

        const allowedCategories = [
          "roofing",
          "plumbing",
          "electrical",
          "hvac",
          "foundation",
          "structural",
          "pest",
          "mold",
          "general_repair",
          "follow_up_inspection",
        ];
        if (!allowedCategories.includes(serviceCategory)) {
          return res.status(400).json({ message: "Invalid serviceCategory" });
        }
        if (
          !serviceDescription ||
          serviceDescription.length < 12 ||
          serviceDescription.length > 4000
        ) {
          return res.status(400).json({
            message: "serviceDescription must be 12-4000 characters",
          });
        }

        const [workRequest] = await db
          .insert(workRequests)
          .values({
            createdByUserId: String(userId),
            title: `Inspection follow-up: ${serviceCategory.replace(/_/g, " ")}`,
            description: [
              `HomeScout listing: ${(listing as any).title || "Property"}`,
              `Inspection report: ${String((report as any).reportUrl || "")}`,
              "",
              serviceDescription,
            ].join("\n"),
            category: serviceCategory,
            countyFips: (listing as any).countyFips || null,
            stateCode: (listing as any).stateCode || null,
            scope: "community",
            source: "scout",
            sourceRefId: `homescout_report:${reportId}`,
            status: "open",
            visibility: "community",
            exposureMode: "guided",
            competitionMode: "none",
          })
          .returning();

        if (workRequest) {
          await db.insert(workRequestEvents).values({
            workRequestId: workRequest.id,
            type: "created",
            actorUserId: String(userId),
            metadata: {
              source: "homescout_inspection_report",
              reportId,
              listingId: (listing as any).id,
            },
          });
        }

        const created = await storage.createHomeScoutInspectionServiceRequest({
          reportId,
          listingId: String((listing as any).id),
          requesterUserId: String(userId),
          countyFips: String((listing as any).countyFips || ""),
          stateCode: String((listing as any).stateCode || ""),
          serviceCategory,
          serviceDescription,
          status: "open" as any,
          workRequestId: workRequest?.id || null,
        } as any);

        res.status(201).json({
          id: created.id,
          workRequestId: workRequest?.id || null,
        });
      } catch (error: any) {
        console.error("Error creating HomeScout inspection service request:", error);
        res.status(500).json({ message: "Failed to create service request" });
      }
    }
  );

  app.post(
    "/api/homescout/listings/:id/report",
    isAuthenticated,
    homeScoutReportLimiter,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "Listing id required" });

        const listing = await storage.getHomeScoutListing(listingId);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const body = req.body ?? {};
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";

        if (!reason || reason.length < 3 || reason.length > 64) {
          return res.status(400).json({ message: "reason (3-64 chars) required" });
        }
        if (message && message.length > 2000) {
          return res.status(400).json({ message: "message too long" });
        }

        const report = await storage.createHomeScoutListingReport({
          listingId,
          reporterUserId: String(userId),
          reason,
          message: message || null,
          status: "open" as any,
          closedAt: null,
          closedByUserId: null,
        } as any);

        res.status(201).json({ id: report.id });
      } catch (error: any) {
        console.error("Error reporting HomeScout listing:", error);
        res.status(500).json({ message: "Failed to report listing" });
      }
    }
  );

  app.get(
    "/api/homescout/my-listings",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const { limit = 50, offset = 0 } = req.query ?? {};

        const rows = await storage.listHomeScoutListingsForSeller({
          sellerUserId: String(userId),
          limit: Number(limit),
          offset: Number(offset),
        });

        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching my HomeScout listings:", error);
        res.status(500).json({ message: "Failed to fetch listings" });
      }
    }
  );

  app.post(
    "/api/homescout/listings",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const body = req.body ?? {};

        const countyFips = typeof body.countyFips === "string" ? body.countyFips : "";
        const stateCode = typeof body.stateCode === "string" ? body.stateCode : "";
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const priceRaw = body.price;
        const price = Number(priceRaw);

        if (!countyFips || !/^[0-9]{5}$/.test(countyFips)) {
          return res.status(400).json({ message: "countyFips (5 digits) required" });
        }
        if (!stateCode || String(stateCode).length !== 2) {
          return res.status(400).json({ message: "stateCode (2 letters) required" });
        }
        if (!title || title.length < 10) {
          return res.status(400).json({ message: "title must be at least 10 characters" });
        }
        if (!Number.isFinite(price) || price <= 0) {
          return res.status(400).json({ message: "price must be a positive number" });
        }

        const requestedAuthorTypeRaw =
          typeof body.listingAuthorType === "string" ? body.listingAuthorType.trim() : "";
        const requestedAuthorType =
          requestedAuthorTypeRaw === "agent" || requestedAuthorTypeRaw === "owner"
            ? requestedAuthorTypeRaw
            : null;

        // Allow agent-posted listings only for approved realtors.
        let resolvedAuthorType: "owner" | "agent" = "owner";
        if (requestedAuthorType === "agent") {
          const realtorProfile = await storage.getRealtorProfileByUserId(String(userId));
          const ok =
            realtorProfile &&
            String((realtorProfile as any).verificationStatus || "") === "approved" &&
            Boolean((realtorProfile as any).isActive ?? true);
          if (!ok) {
            return res.status(403).json({
              message: "Agent-posted listings require an approved Realtor profile",
            });
          }
          resolvedAuthorType = "agent";
        }

        const listing = await storage.createHomeScoutListing({
          sourceKey: "manual",
          sourceListingId: null,
          dedupeKey: null,
          status: "pending_review" as any,
          title,
          description: typeof body.description === "string" ? body.description : null,
          price: String(price) as any,
          pricePrevious: null,
          priceChangedAt: null,
          listedAt: null,
          offMarketAt: null,
          propertyType: (typeof body.propertyType === "string"
            ? body.propertyType
            : "house") as any,
          beds: body.beds != null ? Number(body.beds) : null,
          baths: body.baths != null ? String(Number(body.baths)) : null,
          sqft: body.sqft != null ? Number(body.sqft) : null,
          lotSqft: body.lotSqft != null ? Number(body.lotSqft) : null,
          yearBuilt: body.yearBuilt != null ? Number(body.yearBuilt) : null,
          features: Array.isArray(body.features)
            ? body.features.filter((x: any) => typeof x === "string")
            : null,
          countyFips,
          stateCode,
          city: typeof body.city === "string" ? body.city : null,
          zipCode: typeof body.zipCode === "string" ? body.zipCode : null,
          address1: typeof body.address1 === "string" ? body.address1 : null,
          address2: typeof body.address2 === "string" ? body.address2 : null,
          addressVisibility: (body.addressVisibility === "approximate"
            ? "approximate"
            : "exact") as any,
          latitude: body.latitude != null ? String(Number(body.latitude)) : null,
          longitude: body.longitude != null ? String(Number(body.longitude)) : null,
          photos: Array.isArray(body.photos)
            ? body.photos.filter((x: any) => typeof x === "string")
            : [],
          sellerUserId: userId,
          agentUserId: resolvedAuthorType === "agent" ? userId : null,
          contactUserId: userId,
          listingAuthorType: resolvedAuthorType as any,
          approvedAt: null,
          approvedByUserId: null,
        } as any);

        const sourceHomeId = typeof body.sourceHomeId === "string" ? body.sourceHomeId.trim() : "";
        if (sourceHomeId) {
          try {
            const { userHomes } = await import("../shared/schema");
            await db
              .update(userHomes)
              .set({ homeScoutListingId: listing.id, updatedAt: new Date() } as any)
              .where(
                and(eq(userHomes.id, sourceHomeId), eq(userHomes.ownerUserId, String(userId)))
              );
          } catch (err) {
            console.error("Failed to link home vault record to HomeScout listing:", err);
          }
        }

        res.status(201).json({ id: listing.id });
      } catch (error: any) {
        console.error("Error creating HomeScout listing:", error);
        res.status(500).json({ message: "Failed to create HomeScout listing" });
      }
    }
  );

  app.patch(
    "/api/homescout/listings/:id",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const listingId = String(req.params.id || "");
        if (!listingId) return res.status(400).json({ message: "listingId required" });

        const existing = await storage.getHomeScoutListing(listingId);
        if (!existing) return res.status(404).json({ message: "Listing not found" });

        const viewer = await storage.getUser(String(userId));
        const viewerRole = (viewer as any)?.role || "";
        const isAdminLike = ["super_admin", "ops_admin", "moderator"].includes(String(viewerRole));

        const isOwner =
          String(userId) === String((existing as any).sellerUserId || "") ||
          String(userId) === String((existing as any).agentUserId || "") ||
          String(userId) === String((existing as any).contactUserId || "");

        if (!isAdminLike && !isOwner) {
          return res.status(403).json({ message: "Not allowed" });
        }

        const body = req.body ?? {};
        const updates: any = {};

        if (typeof body.title === "string") {
          const title = body.title.trim();
          if (title.length < 10 || title.length > 200) {
            return res.status(400).json({ message: "title must be 10-200 characters" });
          }
          updates.title = title;
        }

        if (typeof body.description === "string") {
          updates.description = body.description;
        }

        if (body.price != null) {
          const nextPrice = Number(body.price);
          if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
            return res.status(400).json({ message: "price must be a positive number" });
          }
          const prev = Number(String((existing as any).price ?? 0));
          if (Number.isFinite(prev) && prev !== nextPrice) {
            updates.pricePrevious = (existing as any).price;
            updates.priceChangedAt = new Date();
          }
          updates.price = String(nextPrice);
        }

        const intField = (key: string, min: number, max: number) => {
          if (body[key] == null) return;
          const n = Number(body[key]);
          if (!Number.isFinite(n)) return;
          updates[key] = Math.max(min, Math.min(max, Math.trunc(n)));
        };

        const numField = (key: string, min: number, max: number) => {
          if (body[key] == null) return;
          const n = Number(body[key]);
          if (!Number.isFinite(n)) return;
          updates[key] = String(Math.max(min, Math.min(max, n)));
        };

        if (typeof body.propertyType === "string" && body.propertyType.trim()) {
          updates.propertyType = body.propertyType.trim();
        }
        intField("beds", 0, 50);
        numField("baths", 0, 50);
        intField("sqft", 0, 200000);
        intField("lotSqft", 0, 50000000);
        intField("yearBuilt", 1600, 2200);

        if (Array.isArray(body.features)) {
          updates.features = body.features.filter((x: any) => typeof x === "string");
        }
        if (Array.isArray(body.photos)) {
          updates.photos = body.photos.filter((x: any) => typeof x === "string");
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No updates provided" });
        }

        const updated = await storage.updateHomeScoutListing({ listingId, updates } as any);
        if (!updated) return res.status(404).json({ message: "Listing not found" });

        // Timeline events (job/UI reads)
        if (updates.priceChangedAt) {
          await storage.createHomeScoutListingEvent({
            listingId,
            eventType: "price_changed" as any,
            observedAt: updates.priceChangedAt,
            payload: { from: (existing as any).price, to: (updated as any).price },
          } as any);
        }
        await storage.createHomeScoutListingEvent({
          listingId,
          eventType: "updated" as any,
          observedAt: new Date(),
          payload: { fields: Object.keys(updates) },
        } as any);

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating HomeScout listing:", error);
        res.status(500).json({ message: "Failed to update HomeScout listing" });
      }
    }
  );

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
      const amountRaw = (req.query as any)?.amount;
      const paymentTypeRaw = (req.query as any)?.paymentType;
      const amount = amountRaw != null ? Number(amountRaw) : undefined;
      const paymentType =
        typeof paymentTypeRaw === "string" && paymentTypeRaw.trim()
          ? (paymentTypeRaw.trim() as any)
          : undefined;

      const methods = paymentService.getAvailablePaymentMethods(true, { amount, paymentType });
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

      if (hasFrom && fromDate) {
        conditions.push(gte(walletTransactions.createdAt, fromDate));
      }
      if (hasTo && toDate) {
        conditions.push(lte(walletTransactions.createdAt, toDate));
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
        const { transactionId, processingMethod } = req.body;

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

        const method =
          processingMethod === "ach" ? "ach" : processingMethod === "card" ? "card" : undefined;

        const result = await paymentService.createMarketplacePaymentIntent(transaction as any, {
          processingMethod: method as any,
        });
        res.json(result);
      } catch (error: any) {
        console.error("Error creating marketplace payment intent:", error);
        res.status(500).json({ message: "Failed to create payment intent" });
      }
    }
  );

  app.post(
    "/api/payments/profile-booking/create-intent",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const buyerUserId = req.user?.claims?.sub || req.user?.id;
        const bookingRequestId = String(req.body?.bookingRequestId || "").trim();
        const ownerUserId = String(req.body?.ownerUserId || "").trim();
        const requestedAmount = Number(req.body?.amount);
        const descriptionRaw =
          typeof req.body?.description === "string" ? req.body.description.trim() : "";
        const slotId = typeof req.body?.slotId === "string" ? req.body.slotId.trim() : "";
        const requestMessage =
          typeof req.body?.requestMessage === "string"
            ? req.body.requestMessage.trim().slice(0, 1000)
            : null;
        const serviceLabel =
          typeof req.body?.serviceLabel === "string"
            ? req.body.serviceLabel.trim().slice(0, 120)
            : null;
        const bookingContext =
          req.body?.bookingContext && typeof req.body.bookingContext === "object"
            ? req.body.bookingContext
            : {};

        if (!buyerUserId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        let requestRecord = bookingRequestId
          ? await storage.getProfileBookingRequestById(bookingRequestId)
          : undefined;

        if (requestRecord && requestRecord.requesterUserId !== buyerUserId) {
          return res.status(403).json({ message: "Not authorized to pay this booking request" });
        }

        const resolvedOwnerUserId = requestRecord?.ownerUserId || ownerUserId;
        if (!resolvedOwnerUserId) {
          return res.status(400).json({ message: "ownerUserId is required" });
        }
        if (resolvedOwnerUserId === buyerUserId) {
          return res
            .status(400)
            .json({ message: "You cannot create a paid booking intent for your own profile" });
        }

        const owner = await storage.getUser(resolvedOwnerUserId);
        if (!owner) {
          return res.status(404).json({ message: "Profile owner not found" });
        }
        if ((owner.preferences?.profileVisibility || "private") !== "public") {
          return res.status(404).json({ message: "Profile not available for booking" });
        }

        const booking = normalizeProfileBookingPrefs((owner.preferences as any)?.profileBooking);
        if (!booking.enabled) {
          return res.status(400).json({ message: "Bookings are not enabled on this profile" });
        }
        if (!booking.paidBookings) {
          return res.status(400).json({ message: "Paid bookings are not enabled on this profile" });
        }
        if (!Number.isFinite(booking.bookingPriceUsd) || booking.bookingPriceUsd <= 0) {
          return res.status(400).json({ message: "Booking payment amount is not configured" });
        }

        const verificationGate = evaluateNotaryPaidRemoteGate({
          owner: {
            verificationStatus: owner.verificationStatus,
            addressVerified: owner.addressVerified,
            role: owner.role,
            roles: owner.roles || [],
            preferences: owner.preferences,
          },
          bookingContext: (requestRecord?.bookingContext as any) || bookingContext,
          paidBooking: booking.paidBookings,
        });

        if (verificationGate.applied && !verificationGate.allowed) {
          return res.status(403).json({
            message: "Louisiana remote notary paid bookings require additional verification",
            verificationGate,
          });
        }

        const finalAmount =
          Number.isFinite(requestedAmount) && requestedAmount > 0
            ? Number(requestedAmount.toFixed(2))
            : booking.bookingPriceUsd;
        if (Math.abs(finalAmount - booking.bookingPriceUsd) > 0.01) {
          return res
            .status(400)
            .json({ message: "Booking amount does not match profile settings" });
        }

        const description =
          descriptionRaw.length > 0
            ? descriptionRaw.slice(0, 280)
            : `Booking deposit for ${owner.firstName || "TradeScout"} ${owner.lastName || "User"}`.trim();

        if (!requestRecord) {
          requestRecord = await storage.createProfileBookingRequest({
            ownerUserId: resolvedOwnerUserId,
            requesterUserId: String(buyerUserId),
            status: "requested",
            requestMessage,
            serviceLabel,
            requestedStartAt: null,
            requestedEndAt: null,
            timezone: booking.timezone,
            deliveryMode: "onsite",
            locationNote: null,
            depositRequired: true,
            depositAmountUsd: String(finalAmount.toFixed(2)),
            paymentStatus: "requires_payment",
            paymentIntentId: null,
            bookingContext,
            verificationSnapshot: {
              gate: verificationGate.applied ? "notary_remote_paid_la" : "none",
              passed: verificationGate.allowed,
              missing: verificationGate.missing || [],
              checkedAt: new Date().toISOString(),
            },
          } as any);
        }

        if (!stripe) {
          return res.status(400).json({ message: "Stripe not configured" });
        }

        const intent = await stripe.paymentIntents.create({
          amount: Math.round(finalAmount * 100),
          currency: "usd",
          description,
          metadata: {
            type: "profile_booking",
            ownerUserId: resolvedOwnerUserId,
            buyerUserId: String(buyerUserId),
            bookingRequestId: String(requestRecord.id),
            slotId,
            timestamp: new Date().toISOString(),
          },
        });

        await storage.updateProfileBookingRequest(requestRecord.id, {
          paymentIntentId: intent.id,
          paymentStatus: "processing",
        } as any);

        // Optional: sync payment intent creation into a linked Property Program.
        try {
          const ctx =
            requestRecord?.bookingContext && typeof requestRecord.bookingContext === "object"
              ? (requestRecord.bookingContext as any)
              : (bookingContext as any) || {};
          const propertyProgramId =
            typeof ctx.propertyProgramId === "string" ? String(ctx.propertyProgramId).trim() : "";
          if (propertyProgramId) {
            await requirePropertyProgramAccess({
              propertyProgramId,
              userId: String(buyerUserId || ""),
            });
            await addPropertyLifecycleEvent({
              propertyProgramId,
              actionType: "booking_payment_intent_created",
              phase: "bookings",
              title: "Booking payment started",
              description: description || null,
              occurredAt: new Date(),
              source: "system",
              status: "done",
              metadata: {
                bookingRequestId: requestRecord?.id ?? null,
                paymentIntentId: intent.id,
                amountUsd: finalAmount,
              },
              createdByUserId: String(buyerUserId || ""),
              sourceSurface: "profile_booking",
              idempotencyKey: `profile_booking:payment_intent:${intent.id}`,
            });
          }
        } catch (err) {
          console.warn("[profile-booking] Failed to sync payment intent to property program:", err);
        }

        res.json({
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
          bookingRequestId: requestRecord.id,
          amount: finalAmount,
          currency: "usd",
        });
      } catch (error: any) {
        console.error("Error creating profile booking payment intent:", error);
        res.status(500).json({ message: "Failed to create booking payment intent" });
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
      const { amount, paymentType = "contractor_service", processingMethod } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }

      const fees = await paymentService.calculatePaymentFees(amount, paymentType, {
        processingMethod: processingMethod === "ach" ? "ach" : "card",
      });
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

      // Vault contributions:
      // - Direct: payouts-to-vault from the current user's Community Builder contributions (any county vault).
      // - Network: payouts-to-vault from builders they referred (any county vault).
      // - Total to home county vault: direct + network constrained to the user's home county vault.
      let userDirectContribution = 0;
      let userIndirectContribution = 0;
      let userTotalContributionToCountyVault = 0;
      try {
        const builderProfile = await storage.getBuilderProfile(userId);
        if (builderProfile) {
          const sumDirectVaultPayouts = async (params?: {
            countyId?: string | null;
          }): Promise<number> => {
            const countyId = params?.countyId ?? null;
            const [row] = await db
              .select({
                total: sql<string>`
                  coalesce(
                    sum(coalesce(${builderContributions.paidOutAmount}, ${builderContributions.actualValue}, 0)),
                    0
                  )
                `,
              })
              .from(builderContributions)
              .where(
                and(
                  eq(builderContributions.builderId, builderProfile.id),
                  eq(builderContributions.isPaidOut, true),
                  eq(builderContributions.paidOutToVault, true),
                  countyId ? eq(builderContributions.countyId, countyId) : sql`true`
                )
              );

            return Number(row?.total ?? 0) || 0;
          };

          const sumNetworkVaultPayouts = async (params?: {
            countyId?: string | null;
          }): Promise<number> => {
            const countyId = params?.countyId ?? null;
            const [row] = await db
              .select({
                total: sql<string>`
                  coalesce(
                    sum(coalesce(${builderContributions.paidOutAmount}, ${builderContributions.actualValue}, 0)),
                    0
                  )
                `,
              })
              .from(builderContributions)
              .innerJoin(
                builderReferrals,
                eq(builderReferrals.referredBuilderId, builderContributions.builderId)
              )
              .where(
                and(
                  eq(builderReferrals.referrerId, builderProfile.id),
                  eq(builderContributions.isPaidOut, true),
                  eq(builderContributions.paidOutToVault, true),
                  countyId ? eq(builderContributions.countyId, countyId) : sql`true`
                )
              );

            return Number(row?.total ?? 0) || 0;
          };

          // Direct to any county vault
          userDirectContribution = await sumDirectVaultPayouts();

          // Network: 1-hop referred builders to any county vault
          userIndirectContribution = await sumNetworkVaultPayouts();

          // Total direct+network to the user's home county vault (if resolvable)
          const homeCountyId = snapshot.county?.id ?? null;
          if (homeCountyId) {
            const directToHome = await sumDirectVaultPayouts({ countyId: homeCountyId });
            const networkToHome = await sumNetworkVaultPayouts({ countyId: homeCountyId });
            userTotalContributionToCountyVault = directToHome + networkToHome;
          }
        }
      } catch (err) {
        console.warn("[local-impact] Failed to compute vault contribution metrics", err);
      }

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
        userTotalContributionToCountyVault,
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
  app.post(
    "/api/admin/foundation/causes",
    isAuthenticated,
    requireRole(["ops_admin", "super_admin"]),
    async (req: any, res: any) => {
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
        if (!user) {
          return res
            .status(403)
            .json({ message: "Only ops/super admins can create foundation causes" });
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
    }
  );

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
  setupAdminModerationRoutes(app);

  // Setup UI monitoring routes
  registerUIIssuesRoutes(app);

  // Register AI Code Fixing routes
  registerAICodeFixRoutes(app);

  // Register CRM routes
  registerCrmRoutes(app);

  // Register ScoutFitters (merch / marketing tools)
  registerScoutFittersRoutes(app);

  // Register notification routes
  registerNotificationRoutes(app);
  registerDirectConnectRoutes(app);
  registerEmploymentRoutes(app);
  registerIdentityVerificationRoutes(app);
  registerObjectivesRoutes(app);

  // Register analytics routes
  registerAnalyticsRoutes(app);

  // Register recommendation generator routes
  registerRecommendationGeneratorRoutes(app);

  // Register business profile routes (PHASE 3d-C: Published Presence)
  registerBusinessProfileRoutes(app);
  registerBusinessContactRoutes(app);

  // Register business profile routes
  app.use(businessDirectoryPublicRouter);
  app.use(cityPublicRouter);
  app.use(datasetsPublicRouter);
  app.use(businessesRouter);

  // Register Profile website routes
  app.use(profilesRouter);

  // Property Lifecycle OS routes (Build / Existing / Upgrades / Maintain / Sell)
  app.use(propertyProgramsRouter);

  // Account-only Home Vault routes ("Carfax for your home")
  app.use(homesRouter);

  // Account-only Vehicle Vault routes ("Carfax for your vehicle")
  app.use(vehiclesRouter);

  // Marketplace Metals Exchange (physical-only, USD-only)
  app.use(metalsRouter);

  // Register contractor signup routes
  app.use(contractorSignupRouter);

  // Register Hardrock commercial landing + staff directory routes
  registerHardrockRoutes(app);
  // Register commercial project board + campaign landing routes
  registerCommercialDirectoryRoutes(app);

  // Public geographic coverage endpoints used by county pages
  app.use("/api/geographic-coverage", geographicCoverageRouter);

  // Register Community Builder routes
  app.use("/api/community-builder", communityBuilderRouter);
  app.use("/api/admin/community-builder", adminCommunityBuilderRouter);
  app.use("/api/tradepartner-landing", tradePartnerLandingRouter);
  app.use("/api/partner-interest", partnerInterestRouter);

  // Register Community Vault MVP routes (profile-scoped)
  app.use("/api/community-vault", communityVaultRouter);
  app.use("/api/community-causes", communityCausesRouter);
  app.use("/api/platform-support", platformSupportRouter);
  app.use("/api/legal/notary", legalNotaryRouter);

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

  app.post("/api/admin/scout-insights", isAuthenticated, requireAdmin, scoutInsightsHandler);

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

  // Keep generic :hoaId route after static HOA routes so /api/hoa/dashboard and /api/hoa/votes do not get shadowed.
  app.get("/api/hoa/:hoaId", getHOA);

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
      } catch {
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

  // 1c. PUBLIC CONFIG (safe, non-auth, non-secret)
  // Used by client-only features that may need a public key at runtime
  // (e.g. Google Maps JS API key). Do NOT include secrets here.
  app.get("/api/public-config", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");

    const googleMapsApiKey = String(
      process.env.GOOGLE_MAPS_API_KEY ||
        process.env.PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        ""
    ).trim();

    res.json({ googleMapsApiKey });
  });

  // 2. MESSAGING API
  // Note: /api/conversations handlers live earlier under "Chat system routes".

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
        purpose: "admin_manual",
      });

      res.json({ message: "Email sent successfully", messageId: result.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  return httpServer;
}
