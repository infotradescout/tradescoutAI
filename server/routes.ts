/* eslint-disable @typescript-eslint/no-explicit-any -- Legacy route module ingests dynamic JSON across many endpoints; incremental hardening tracked separately. */
import scoutRoute from "./routes/scout";
import scoutNormalizeRouter from "./routes/scout-normalize";
import { scoutHeatmapRoutes } from "./routes/scout-heatmap";
import { scoutHomeSnapshotRouter } from "./routes/scout-home-snapshot";
import { ClaimSource, ClaimType } from "./services/claimEventSchema";
import { logger } from "./services/logger";
import { ingestKnowledgeFolder } from "./services/knowledgeIngest";
import { reflectCommunityAction } from "./services/communityActionReflection";
import { EventTypes } from "./xp/eventTypes";
import express from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { generateGeminiTextWithFallback } from "./ai/geminiFallback";
import { detectImportDelimiter, parseDelimitedImport } from "./utils/adminBusinessImportParser";
import { parseXlsxImport } from "./utils/adminBusinessImportXlsx";
import { contractorSignupRouter } from "./routes/contractor-signup";
import { onboardingRouter } from "./routes/onboarding";
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
import { registerAdRoutes } from "./routes/ads";
import { registerQuoteCalculatorRoutes } from "./routes/quote-calculator";
import { registerEventRoutes } from "./routes/events";
import { registerPublicHeatmapRoutes } from "./routes/public-heatmap";
import { registerDirectConnectRoutes } from "./routes/direct-connect";
import { registerProviderSearchRoutes } from "./routes/provider-search";
import { registerProcurementRoutes } from "./routes/procurement";
import { registerEmploymentRoutes } from "./routes/employment";
import { registerIdentityVerificationRoutes } from "./routes/identity-verification";
import { registerObjectivesRoutes } from "./routes/objectives";
import { registerBusinessProfileRoutes } from "./routes/business-profile";
import { registerBusinessContactRoutes } from "./routes/business-contact";
import { registerTradePartnerExpressRoutes } from "./routes/tradepartner-express";
import { registerJwStoneSavedStonesEmailRoutes } from "./routes/jw-stone-saved-stones-email";
import { registerStoneInventoryRoutes } from "./routes/stone-inventory";
import { registerBidRockRoutes } from "./routes/bidrock";
import { registerStoneDesignerImageRoutes } from "./routes/stone-designer-images";
import { registerJwStonePublicMediaRoutes } from "./routes/jw-stone-public-media";
import { registerRedGranitiPublicMediaRoutes } from "./routes/red-graniti-public-media";
import { registerBusinessClaimRoutes } from "./routes/business-claim";
import { registerWorkerTasksRoutes } from "./routes/worker-tasks";
import { registerTutorialRoutes } from "./routes/tutorials";
import { registerContractorLeaderboardRoutes } from "./routes/contractor-leaderboards";
import { registerCommercialPromotionRoutes } from "./routes/commercial-promotions";
import { registerStoryRoutes } from "./routes/stories";
import { registerInvitationRoutes } from "./routes/invitations";
import { registerProfessionalNetworkRoutes } from "./routes/professional-network";
import { registerProfessionalPartnershipRoutes } from "./routes/professional-partnerships";
import { registerAdminBusinessCountyEnrichmentRoutes } from "./routes/admin-business-county-enrichment";
import { registerContractorPromoRoutes } from "./routes/contractor-promos";
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
import zeroBaseFeeInspectionRouter from "./routes/zero-base-fee-inspection";
import inspectionIntelligenceRouter from "./routes/inspection-intelligence";
import legalNotaryRouter from "./routes/legal-notary-routes";
import { mountAdminRoutes } from "./routes/admin";
import missionControlRouter from "./routes/mission-control";
import preferredSourceRouter from "./routes/preferred-source";
import { registerPublicMetadataRoutes } from "./routes/public-metadata";
import { registerPublicProfileSocialPreviewRoutes } from "./routes/public-profile-social-preview";
import { registerAuthorityOperationsRoutes } from "./routes/authority-operations";
import tradePartnerLandingRouter from "./routes/tradepartner-landing";
import partnerInterestRouter from "./routes/partner-interest";
import tradePartnerRsvpRouter from "./routes/tradepartner-rsvp";
import adminToolNotificationsRouter from "./routes/admin-tool-notifications";
import { ROLE_PERMISSIONS, type UserRole as SharedUserRole } from "../shared/roles";
import { COMPREHENSIVE_TRADES } from "../shared/trades-data";
import { CURRENT_PROFILE_VERSION } from "../shared/profile";
import { isOutcomeOnboardingComplete } from "@shared/onboardingCompletion";
import {
  getExchangeCategorySlugFromMarketplaceCategoryName,
  validateExchangeCategoryListing,
} from "../shared/exchangeListingRules";
import { listProfileOfferImageUrls } from "../shared/profileOfferShare";
import { sanitizePublicListingText } from "../shared/publicListingSafety";
import {
  buildHomeScoutInspectionRequestDecisionScope,
  buildHomeScoutInspectionServiceDecisionScope,
  normalizeHomeScoutInspectionReportId,
  normalizeHomeScoutListingId,
} from "../shared/homeScoutListingShare";
import { toPublicExchangeListing } from "./publicExchangeListing";
import {
  toPublicHandmadeProduct,
  toPublicHandmadeProductReview,
  toPublicHandmadeSellerProfile,
} from "./publicHandmadeProduct";
import { toPublicContractorRecommendations } from "./publicContractorRecommendations";
import {
  isUsefulPublicCommunityBrowsePost,
  isAutomaticCommunityWelcomePost,
  normalizeAutomaticCommunityWelcomePost,
  sanitizePublicCommunityFeedPost,
  toPublicCommunityPost,
} from "./publicCommunityPost";
import { resolveUserCountyWriteContext } from "./locationContext";
import { resolveRequestEffectiveUser } from "./utils/requestEffectiveUser";
import {
  getHomeScoutAuthorityUserId,
  HOME_SCOUT_REPORT_DOWNLOAD_MAX_BYTES,
  normalizeHomeScoutReportSourceUrl,
  toPublicHomeScoutCountyMetric,
  toPublicHomeScoutInspectionReport,
  toPublicHomeScoutListing,
  toPublicHomeScoutListingEvent,
  toPublicHomeScoutMarketBucket,
  toPublicHomeScoutPartnerRecommendation,
  toVisibleHomeScoutInspectionRequest,
} from "./publicHomeScoutListing";
import {
  TRADESCOUT_TRANSACTION_FEE_CENTS,
  TRADESCOUT_TRANSACTION_FEE_MODEL,
} from "../shared/platformRevenue";
import { sendAutoClassifiedError } from "./utils/httpErrors";
import { resolvePublicOrigin } from "./utils/publicOrigin";
import {
  isSafeAffiliateShareDestination,
  resolveAffiliateOriginForRequest,
} from "./utils/affiliateShareDestination";
import {
  affiliateShareSlugError,
  directConnectOwnsPersistedShareSlug,
} from "./utils/shareRouteNamespace";
import {
  hasPrivilegedVerificationBypass,
  hasRequestPrivilegedVerificationBypass,
} from "./utils/privilegedVerification";
import {
  collectAuthorityRoles,
  getPrivilegedAliasEmails,
  isAdminTierRole,
  isDirectConnectUnverifiedBypassEnabled,
  normalizeAuthorityRole,
  resolvePrivilegedVerificationBypass,
} from "./utils/authorityPolicy";
import { getAuthorityPhaseGateState } from "./utils/authorityPhaseGates";
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
import { getRelatedBusinessSuggestions } from "./services/relatedBusinessSuggestions";
import { emailVerificationService } from "./services/emailVerificationService";
import { computeVerificationRequirements } from "./services/profileVerificationService";
import {
  adminBusinessVerificationDecisionSchema,
  buildVerificationFieldReviewState,
  businessVerificationFieldSchema,
  deriveOverallBusinessVerificationStatus,
  getStoredVerificationDocumentKey,
  isOwnedPrivateObjectKey,
  mergeVerificationSubmission,
  profileVerificationSubmissionSchema,
  recordVerificationDecision,
  sanitizeVerificationSubmissions,
  selectOwnedVerificationProfile,
} from "./services/businessVerificationWorkflow";
import { notifyIndexNow } from "./services/indexNowService";
import { logAdminAction } from "./services/adminAuditLogService";
import { inferCountyFromCityState } from "./services/countyInferenceService";
import { getMarketSignalsSnapshot } from "./services/marketSignalsSnapshotJob";
import { getPartnerCountyObservationSnapshots } from "./services/partnerCountyObservationSnapshotService";
import { publicBusinessDetailExposureSqlPredicate } from "./publicationBusiness";
import { loadCanonicalPublicMapProfileUrls } from "./repositories/profileRepository";
import { getTradepartnerUserEntitlement } from "./services/tradepartnerAccessService";
import { recordTrustLedgerEvent } from "./services/trustLedgerService";
import { buildExposureAuthorityMap } from "./services/exposureAuthority";
import { hasExposureAuthority } from "./services/exposureAuthority";
import { scoutcoinService } from "./services/scoutcoinService";
import {
  buildPublicSolarPriceInsight,
  buildSolarProviderEstimate,
  isSolarV1Enabled,
} from "./services/solarInsightsService";
import {
  actorHasPrivilegedCapability,
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
  suppliedEmailMatchesTarget,
} from "./utils/privilegedActions";
import { createServer } from "http";
import { requireAddressVerification } from "./requireAddressVerification";
import { checkTrustedDevice, DeviceAuthService } from "./deviceAuth";
import { registerAdminDeviceSecurityRoutes } from "./routes/admin-device-security";
import {
  buildIdentityHeadersMiddleware,
  resolveBuildRevision,
} from "./middleware/buildIdentityHeaders";
import {
  addPropertyLifecycleEvent,
  requirePropertyProgramAccess,
} from "./services/propertyLifecycleService";
import { recordAttributionConversionEvent } from "./utils/attributionConversionLedger";
import { handleUniversalAttributionClick } from "./utils/universalAttributionRef";
import { buildMarketplaceConversationPresentation } from "./utils/conversationContext";
import {
  users,
  userRoleEnum,
  businesses,
  affiliateAccounts,
  affiliateReferrals,
  affiliateAttributionConversions,
  affiliateShareLinks,
  affiliateTrafficEvents,
  leads,
  quotes,
  conversations,
  foundationCauses,
  marketplaceListings,
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
  insertLeadSchema,
  insertMarketplaceCategorySchema,
  insertMarketplaceListingSchema,
  insertMarketplaceReportSchema,
  insertVendorVerificationSchema,
  insertBuyerVerificationSchema,
  insertAddressVerificationSchema,
  insertModerationReportSchema,
  insertModerationVoteSchema,
  insertModerationAppealSchema,
  counties,
  userFollows,
  walletTransactions,
  marketplaceTransactions,
  userProfiles,
  profiles,
  businessCounties,
  // Home Vault + Property Lifecycle OS (used by intent-gated home report sharing in messages)
  homeReportShares,
  userHomes,
  userVehicles,
  userHomeRecords,
  userHomeAppliances,
  userHomeDocuments,
  homeMaintenanceSchedules,
  homeProjects,
  homeProjectPlans,
  propertyPrograms,
  propertyHomefaxSnapshots,
  commercialProjectBids,
  commercialProjects,
  scoutConversations,
  decisionCards,
  homeScoutInspectionRequests,
  homeScoutInspectionServiceRequests,
} from "../shared/schema";

function sanitizeContractorPublic<T extends Record<string, any>>(
  contractor: T
): Omit<T, "phone" | "email" | "userId" | "businessId" | "insuranceDocUrl"> {
  if (!contractor || typeof contractor !== "object") return contractor as any;
  const { phone, email, userId, businessId, insuranceDocUrl, ...rest } = contractor as any;
  void phone;
  void email;
  void userId;
  void businessId;
  void insuranceDocUrl;
  return rest;
}

async function getViewerConnectionIds(viewerUserId: string): Promise<string[]> {
  if (!viewerUserId) return [];

  const [followerRows, followingRows] = await Promise.all([
    db
      .select({ userId: userFollows.followerId })
      .from(userFollows)
      .where(eq(userFollows.followingId, viewerUserId)),
    db
      .select({ userId: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, viewerUserId)),
  ]);

  return Array.from(
    new Set(
      [...followerRows, ...followingRows]
        .map((row: any) => String(row?.userId || "").trim())
        .filter((id) => id.length > 0 && id !== viewerUserId)
    )
  );
}

async function attachConnectionRecommendationCounts<T extends { id: string }>(
  contractorRows: T[],
  viewerUserId: string | null
): Promise<Array<T & { connectionRecommendationCount: number | null }>> {
  if (!Array.isArray(contractorRows) || contractorRows.length === 0) {
    return [];
  }

  if (!viewerUserId) {
    return contractorRows.map((row) => ({ ...row, connectionRecommendationCount: null }));
  }

  const connectionIds = await getViewerConnectionIds(viewerUserId);
  if (connectionIds.length === 0) {
    return contractorRows.map((row) => ({ ...row, connectionRecommendationCount: 0 }));
  }

  const contractorIds = Array.from(
    new Set(contractorRows.map((row) => String(row?.id || "").trim()).filter((id) => id.length > 0))
  );
  if (contractorIds.length === 0) {
    return contractorRows.map((row) => ({ ...row, connectionRecommendationCount: 0 }));
  }

  const connectionRecommendationRows = await db
    .select({
      contractorId: recommendations.contractorId,
      connectionRecommendationCount: sql<number>`count(distinct ${recommendations.userId})::int`,
    })
    .from(recommendations)
    .where(
      and(
        inArray(recommendations.contractorId, contractorIds),
        inArray(recommendations.userId, connectionIds),
        eq(recommendations.recommendationType, "positive"),
        eq(recommendations.isPublic, true),
        eq(recommendations.moderationStatus, "approved")
      )
    )
    .groupBy(recommendations.contractorId);

  const countByContractorId = new Map<string, number>(
    connectionRecommendationRows.map((row: any) => [
      String(row.contractorId),
      Number(row.connectionRecommendationCount || 0),
    ])
  );

  return contractorRows.map((row) => ({
    ...row,
    connectionRecommendationCount: countByContractorId.get(String(row.id)) ?? 0,
  }));
}

async function attachLatestTrustSnapshotToUser<T extends Record<string, any> | null | undefined>(
  user: T
): Promise<T> {
  if (!user || typeof user !== "object") return user;

  const userId = typeof user.id === "string" ? user.id.trim() : "";
  if (!userId) return user;

  const countyFips =
    typeof (user as any).countyFips === "string"
      ? (user as any).countyFips.trim()
      : typeof (user as any).county_fips === "string"
        ? (user as any).county_fips.trim()
        : "";

  try {
    const trustResult = await pool.query(
      `
        select
          ts.cvs_score::text as cvs_score,
          ts.verification_status,
          ts.license_status,
          ts.insurance_status,
          ts.risk_flags
        from trust_snapshots ts
        where ts.user_id = $1
          and ($2::text = '' or ts.county_fips = $2)
        order by
          case when $2::text <> '' and ts.county_fips = $2 then 0 else 1 end,
          ts.computed_at desc
        limit 1
      `,
      [userId, countyFips]
    );

    const trustRow = trustResult.rows?.[0];
    const parsedCvs =
      typeof trustRow?.cvs_score === "number"
        ? trustRow.cvs_score
        : typeof trustRow?.cvs_score === "string" && trustRow.cvs_score.trim().length > 0
          ? Number(trustRow.cvs_score)
          : typeof (user as any).trustScore === "number"
            ? (user as any).trustScore
            : typeof (user as any).trustScore === "string" &&
                String((user as any).trustScore).trim().length > 0
              ? Number((user as any).trustScore)
              : null;

    const cvsScore = Number.isFinite(parsedCvs as number) ? Number(parsedCvs) : null;

    return {
      ...(user as any),
      cvsScore,
      trustScore: cvsScore ?? (user as any).trustScore ?? null,
      trustSnapshot:
        trustRow && cvsScore !== null
          ? {
              cvsScore,
              verificationStatus:
                trustRow.verification_status ?? (user as any).verificationStatus ?? null,
              licenseStatus: trustRow.license_status ?? null,
              insuranceStatus: trustRow.insurance_status ?? null,
              riskFlags: Array.isArray(trustRow.risk_flags) ? trustRow.risk_flags : [],
            }
          : undefined,
    } as T;
  } catch (error) {
    console.warn("[trust] Failed to enrich user with latest trust snapshot", { userId, error });
    return user;
  }
}
import { getUserTypeBadgeLabel, getUserTypeMetadata } from "../shared/userTypes";
import { shouldIndexPublicProfileSlug } from "../shared/publicProfileIndexing";
import { storage } from "./storage";
import {
  applyRequestSessionCookieScope,
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
import {
  getCookieValue,
  setReferralCookie,
  recordReferralClick,
  persistLifetimeReferralOwner,
  handleExplicitOrExistingReferral,
  attributeCleanPageViewToOwner,
} from "./services/referralAttribution";
import { rateLimit } from "express-rate-limit";
import { createPostgresRateLimitStore } from "./utils/postgresRateLimitStore";

type MarketSignalsWindow = "1h" | "24h" | "7d" | "30d";

function parseMarketSignalsWindow(raw: unknown): MarketSignalsWindow {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "1h" || value === "24h" || value === "7d" || value === "30d") return value;
  return "24h";
}

function marketSignalsInterval(window: MarketSignalsWindow): string {
  switch (window) {
    case "1h":
      return "1 hour";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    default:
      return "24 hours";
  }
}

function isValidCountyFips(value: unknown): value is string {
  return typeof value === "string" && /^\d{5}$/.test(value.trim());
}

function isValidStateCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim());
}

const SCOUT_CONVERSATION_LIMIT = 20;
const SCOUT_CONVERSATION_MESSAGE_LIMIT = 40;
const SCOUT_CONVERSATION_CONTENT_LIMIT = 4000;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

function safeScoutConversationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!/^[A-Za-z0-9_-]{6,96}$/.test(clean)) return null;
  return clean;
}

function compactScoutConversationMessages(input: unknown): any[] {
  if (!Array.isArray(input)) return [];
  return input.slice(-SCOUT_CONVERSATION_MESSAGE_LIMIT).map((message: any) => {
    const role =
      message?.role === "user" || message?.role === "assistant" || message?.role === "system"
        ? message.role
        : "assistant";
    const rawContent = typeof message?.content === "string" ? message.content : "";
    return {
      ...message,
      id:
        typeof message?.id === "string" && message.id.trim()
          ? message.id.trim().slice(0, 120)
          : randomUUID(),
      role,
      content:
        rawContent.length > SCOUT_CONVERSATION_CONTENT_LIMIT
          ? `${rawContent.slice(0, SCOUT_CONVERSATION_CONTENT_LIMIT - 3)}...`
          : rawContent,
      timestamp:
        typeof message?.timestamp === "string" && message.timestamp.trim()
          ? message.timestamp.trim()
          : new Date().toISOString(),
    };
  });
}

function scoutConversationPayload(row: any) {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview ?? "",
    summary: row.summary ?? "",
    intent: row.intent ?? null,
    countyFips: row.countyFips ?? null,
    stateCode: row.stateCode ?? null,
    messageCount: row.messageCount ?? 0,
    messages: Array.isArray(row.messages) ? row.messages : [],
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

type ScoutConversationRelatedKind = "project" | "home" | "vehicle" | "client";

function scoutConversationRelatedTo(metadata: any): {
  kind: ScoutConversationRelatedKind;
  id: string;
  homeId?: string;
  surface?: string;
} | null {
  const relatedTo =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as any).relatedTo
      : null;
  if (!relatedTo || typeof relatedTo !== "object" || Array.isArray(relatedTo)) return null;

  const kind = String((relatedTo as any).kind || "").trim();
  const id = String((relatedTo as any).id || "").trim();
  const homeId = String((relatedTo as any).homeId || "").trim();
  const surface = String((relatedTo as any).surface || "").trim();
  if (!id) return null;
  if (kind === "project" || kind === "home" || kind === "vehicle" || kind === "client") {
    return {
      kind,
      id: id.slice(0, 120),
      homeId: homeId ? homeId.slice(0, 120) : undefined,
      surface: surface ? surface.slice(0, 80) : undefined,
    };
  }
  return null;
}

function homeSavedConversationLabel(home: any): string | null {
  const nickname = safeText(home?.nickname, 120);
  if (nickname) return nickname;

  const address = [home?.address1, home?.city, home?.stateCode]
    .map((part) => safeText(part, 80))
    .filter(Boolean)
    .join(", ");
  return address || null;
}

function vehicleSavedConversationLabel(vehicle: any): string | null {
  const nickname = safeText(vehicle?.nickname, 120);
  if (nickname) return nickname;

  const details = [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .map((part) => (part == null ? null : safeText(String(part), 80)))
    .filter(Boolean)
    .join(" ");
  return details || null;
}

function homeProjectSavedConversationLabel(project: any): string | null {
  const title = safeText(project?.title, 120);
  if (title) return title;

  const projectType = safeText(project?.projectType, 80);
  return projectType ? `${projectType} project` : null;
}

async function loadScoutConversationRelatedLabels(
  userId: string,
  relatedItems: Array<{
    kind: ScoutConversationRelatedKind;
    id: string;
    homeId?: string;
    surface?: string;
  }>
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const idsByKind = relatedItems.reduce(
    (acc, item) => {
      acc[item.kind].add(item.id);
      return acc;
    },
    {
      project: new Set<string>(),
      home: new Set<string>(),
      vehicle: new Set<string>(),
      client: new Set<string>(),
    } as Record<ScoutConversationRelatedKind, Set<string>>
  );

  const homeIds = Array.from(idsByKind.home);
  if (homeIds.length) {
    const homes = await db
      .select({
        id: userHomes.id,
        nickname: userHomes.nickname,
        address1: userHomes.address1,
        city: userHomes.city,
        stateCode: userHomes.stateCode,
      })
      .from(userHomes)
      .where(and(eq(userHomes.ownerUserId, userId), inArray(userHomes.id, homeIds)));
    for (const home of homes) {
      const label = homeSavedConversationLabel(home);
      if (label) labels.set(`home:${home.id}`, label);
    }
  }

  const vehicleIds = Array.from(idsByKind.vehicle);
  if (vehicleIds.length) {
    const vehicles = await db
      .select({
        id: userVehicles.id,
        nickname: userVehicles.nickname,
        year: userVehicles.year,
        make: userVehicles.make,
        model: userVehicles.model,
        trim: userVehicles.trim,
      })
      .from(userVehicles)
      .where(and(eq(userVehicles.ownerUserId, userId), inArray(userVehicles.id, vehicleIds)));
    for (const vehicle of vehicles) {
      const label = vehicleSavedConversationLabel(vehicle);
      if (label) labels.set(`vehicle:${vehicle.id}`, label);
    }
  }

  const projectIds = Array.from(idsByKind.project);
  if (projectIds.length) {
    const projects = await db
      .select({ id: commercialProjects.id, title: commercialProjects.title })
      .from(commercialProjects)
      .where(
        and(
          eq(commercialProjects.createdByUserId, userId),
          inArray(commercialProjects.id, projectIds)
        )
      );
    for (const project of projects) {
      const label = safeText(project.title, 120);
      if (label) labels.set(`project:${project.id}`, label);
    }

    const homeProjectRows = await db
      .select({
        id: homeProjects.id,
        title: homeProjects.title,
        projectType: homeProjects.projectType,
        userHomeId: homeProjects.userHomeId,
      })
      .from(homeProjects)
      .where(and(eq(homeProjects.ownerUserId, userId), inArray(homeProjects.id, projectIds)));
    for (const project of homeProjectRows) {
      const label = homeProjectSavedConversationLabel(project);
      if (label) labels.set(`project:${project.id}`, label);
    }
  }

  const clientIds = Array.from(idsByKind.client);
  if (clientIds.length) {
    try {
      const clientRows = await db.execute(sql`
        SELECT id, display_name
        FROM accounting_clients
        WHERE created_by = ${userId}
          AND id IN (${sql.join(
            clientIds.map((clientId) => sql`${clientId}`),
            sql`, `
          )})
      `);
      for (const row of (clientRows as any).rows || []) {
        const id = safeText(row?.id, 120);
        const label = safeText(row?.display_name, 120);
        if (id && label) labels.set(`client:${id}`, label);
      }
    } catch (error: any) {
      if (!String(error?.message || "").includes('relation "accounting_clients" does not exist')) {
        console.warn("[scout-conversations] client label refresh failed:", error);
      }
    }
  }

  return labels;
}

async function refreshScoutConversationRelatedLabels(userId: string, rows: any[]): Promise<any[]> {
  const relatedItems = rows
    .map((row) => scoutConversationRelatedTo(row?.metadata))
    .filter(
      (
        item
      ): item is {
        kind: ScoutConversationRelatedKind;
        id: string;
        homeId?: string;
        surface?: string;
      } => !!item
    );
  if (!relatedItems.length) return rows;

  const labels = await loadScoutConversationRelatedLabels(userId, relatedItems);
  if (!labels.size) return rows;

  return rows.map((row) => {
    const related = scoutConversationRelatedTo(row?.metadata);
    if (!related) return row;
    const label = labels.get(`${related.kind}:${related.id}`);
    if (!label) return row;

    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? { ...row.metadata }
        : {};
    const relatedTo =
      metadata.relatedTo &&
      typeof metadata.relatedTo === "object" &&
      !Array.isArray(metadata.relatedTo)
        ? { ...metadata.relatedTo, label }
        : { kind: related.kind, id: related.id, label };

    return {
      ...row,
      metadata: {
        ...metadata,
        relatedLabel: label,
        relatedTo,
        relatedLabelRefreshedAt: new Date().toISOString(),
      },
    };
  });
}

type ScoutConversationSurfaceFilter =
  | "project"
  | "home"
  | "vehicle"
  | "client"
  | "materials"
  | "prices";

function scoutConversationSurfaceFilter(value: unknown): ScoutConversationSurfaceFilter | null {
  const normalized = (safeText(value, 40) || "").toLowerCase();
  if (
    normalized === "project" ||
    normalized === "home" ||
    normalized === "vehicle" ||
    normalized === "client" ||
    normalized === "materials" ||
    normalized === "prices"
  ) {
    return normalized;
  }
  return null;
}

function scoutConversationSurfaceWhere(surface: ScoutConversationSurfaceFilter) {
  if (surface === "materials") {
    return or(
      eq(scoutConversations.intent, "materials"),
      sql`lower(${scoutConversations.metadata}->>'relatedLabel') = 'materials'`
    );
  }

  if (surface === "prices") {
    return or(
      eq(scoutConversations.intent, "prices"),
      sql`lower(${scoutConversations.metadata}->>'relatedLabel') in ('prices', 'price signals')`
    );
  }

  return sql`${scoutConversations.metadata}->'relatedTo'->>'kind' = ${surface}`;
}
import { paymentService } from "./payment-service";
import { DataManagementService } from "./data-management";
import { communityBuilderPaymentService } from "./community-builder-payment-service";
import { platformSupportPaymentService } from "./platform-support-payment-service";
import { antiScrapeShield } from "./middleware/antiScrape";
import { ObjectStorageService } from "./objectStorage";
import { notificationService } from "./notification-service";
import { resolveCapabilities, type CapabilityStatus } from "./capabilities";
import { redactContactDetails } from "./utils/workRequestShare";
import {
  evaluateNotaryPaidRemoteGate,
  normalizeProfileBookingPrefs,
  toPublicProfileBookingPrefs,
} from "./services/profileBookingService";
import { resolveProfileBookingOwner } from "./services/profileBookingIdentity";
import { resolveProfileBookingConfig } from "./services/profileBookingConfig";
import {
  normalizeOptionalBookingText,
  refundPaidProfileBookingDeposit,
  resolveBookingVerificationContext,
  resolveProfileBookingPaymentIntent,
  validateExistingProfileBookingPayment,
  validateProfileBookingStatusTransition,
  validateRequestedBookingWindow,
} from "./services/profileBookingPayment";
import { registerPaymentWebhookRoutes } from "./paymentWebhookRoutes";
import { getStripeClient } from "./services/stripeClient";
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
// DeviceAuthService imported from ./deviceAuth above
const objectStorageService = new ObjectStorageService();
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
      title: `${audience.label} â€¢ ${trade.name}`,
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

    const { token, expiresAt } = await emailVerificationService.createToken(userId);
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
  'TradeScout is a community operating system that keeps projects and dollars local. Homeowners and contractors can connect, message, and run the full job flowâ€”quotes, scheduling, invoices, and payments (including off-site work). Beyond jobs, TradeScout includes a local marketplace, community feed and groups, and real neighborhood tools so communities can manage vendors, requests, budgets, and decisions with total transparency. Community Builders and the foundation layer add public accountability and local reinvestmentâ€”so TradeScout isnâ€™t just "find a pro," itâ€™s how a town organizes and improves itself.';

export async function registerRoutes(app: any) {
  registerJwStonePublicMediaRoutes(app);
  registerRedGranitiPublicMediaRoutes(app);
  registerStoneDesignerImageRoutes(app);
  const buildRevision = resolveBuildRevision();

  // Setup authentication
  await setupAuth(app);

  // Emit build identity on every response so production log/debug can confirm
  // which revision is currently serving traffic.
  app.use(buildIdentityHeadersMiddleware);

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

  registerPublicMetadataRoutes(app, {
    buildRevision,
    defaultFirstIntroAppendix: DEFAULT_FIRST_INTRO_APPENDIX,
  });
  registerPublicProfileSocialPreviewRoutes(app);

  const marketSignalsAccess = async (req: any, res: any, next: any) => {
    try {
      const authHeader = String(req.headers.authorization || "");
      const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
      const configuredApiKey = String(process.env.MARKET_SIGNALS_API_KEY || "").trim();
      const partnerKeysRaw = String(process.env.MARKET_SIGNALS_PARTNER_KEYS_JSON || "").trim();
      const partnerKeysEnabled =
        String(process.env.ENABLE_PARTNER_MARKET_SIGNALS_KEYS || "")
          .trim()
          .toLowerCase() === "true";
      const partnerKeys: Record<string, string> = partnerKeysRaw ? JSON.parse(partnerKeysRaw) : {};

      if (configuredApiKey && bearer && bearer === configuredApiKey) {
        req.marketSignalsAccess = { mode: "global_api_key", partnerSlug: null };
        return next();
      }

      if (partnerKeysEnabled && bearer) {
        const matchedPartner = Object.entries(partnerKeys).find(
          ([, key]) => String(key || "").trim() === bearer
        );
        if (matchedPartner) {
          req.marketSignalsAccess = { mode: "partner_api_key", partnerSlug: matchedPartner[0] };
          return next();
        }
      }

      if (bearer && !req.isAuthenticated?.()) {
        return res.status(403).json({ message: "Market signals access denied" });
      }

      if (!req.isAuthenticated?.()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      const roles = collectAuthorityRoles(user as any);
      const hasAccess = roles.some((role) => isAdminTierRole(role));

      if (hasAccess) {
        req.marketSignalsAccess = { mode: "admin_user", partnerSlug: null };
        return next();
      }

      const partnerSlugHeader = String(req.headers["x-tradepartner-slug"] || "")
        .trim()
        .toLowerCase();
      const partnerSlugQuery = String(req.query?.partnerSlug || "")
        .trim()
        .toLowerCase();
      const partnerSlugParam = String(req.params?.partnerSlug || "")
        .trim()
        .toLowerCase();
      const requestedPartnerSlug = partnerSlugParam || partnerSlugQuery || partnerSlugHeader;

      if (!requestedPartnerSlug) {
        return res.status(403).json({ message: "Market signals access denied" });
      }

      const entitlement = await getTradepartnerUserEntitlement({
        partnerSlug: requestedPartnerSlug,
        userId,
        accessScope: "market_signals",
      });

      if (!entitlement) {
        return res.status(403).json({ message: "Market signals access denied" });
      }

      req.marketSignalsAccess = {
        mode: "partner_user",
        partnerSlug: requestedPartnerSlug,
        entitlementLevel: entitlement.accessLevel,
      };
      return next();
    } catch (error) {
      console.error("Market signals auth failure", error);
      return res.status(500).json({ message: "Failed to authorize market signals access" });
    }
  };

  const requirePartnerMarketSignalsScope = (req: any, res: any, partnerSlug: string): boolean => {
    const accessMode = String(req.marketSignalsAccess?.mode || "");
    const scopedPartnerSlug = String(req.marketSignalsAccess?.partnerSlug || "")
      .trim()
      .toLowerCase();

    if (
      (accessMode === "partner_api_key" || accessMode === "partner_user") &&
      scopedPartnerSlug !== partnerSlug
    ) {
      res.status(403).json({ message: "Partner-scoped market signals access denied" });
      return false;
    }

    return true;
  };

  app.get(
    "/api/market-signals/v1/counties/:countyFips/demand",
    marketSignalsAccess,
    async (req: any, res: any) => {
      try {
        const countyFips = String(req.params?.countyFips || "").trim();
        if (!isValidCountyFips(countyFips)) {
          return res.status(400).json({ message: "Invalid countyFips" });
        }

        const window = parseMarketSignalsWindow(req.query?.window);
        // Snapshot is built from: from scout_interactions, from objectives, from county_metrics
        // Suppressed when if (interactionCount < 25) â€” see marketSignalsSnapshotJob.ts
        const snapshot = await getMarketSignalsSnapshot({
          kind: "county_demand",
          window,
          scopeType: "county",
          scopeId: countyFips,
        });
        if (!snapshot) {
          return res.status(503).json({
            message: "County demand snapshot unavailable. Retry after scheduled refresh.",
            reasonCode: "SNAPSHOT_UNAVAILABLE",
          });
        }

        const payload = snapshot.payload || {};
        // Propagate suppression: if (interactionCount < 25) payload.status === "suppressed"
        return res.json({
          ...(payload as any),
          countyFips,
          window,
          generatedAt: snapshot.generatedAt || new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("Failed to load county demand signal", error);
        return res.status(500).json({ message: "Failed to load county demand signal" });
      }
    }
  );

  app.get(
    "/api/market-signals/v1/homescout-listings/inventory",
    marketSignalsAccess,
    async (req: any, res: any) => {
      try {
        const countyFips = String(req.query?.countyFips || "").trim();
        const stateCode = String(req.query?.stateCode || "")
          .trim()
          .toUpperCase();
        const propertyTypeRaw = String(req.query?.propertyType || "").trim();
        const propertyType = propertyTypeRaw.length > 0 ? propertyTypeRaw : null;
        const window = parseMarketSignalsWindow(req.query?.window);
        const interval = marketSignalsInterval(window);

        if (!isValidCountyFips(countyFips) || !isValidStateCode(stateCode)) {
          return res.status(400).json({ message: "countyFips and stateCode are required" });
        }

        const bucketResult = await pool.query(
          `
          select
            coalesce(sum(active_count), 0)::int as active_listing_count,
            round(avg(median_dom_days))::int as median_dom_days,
            coalesce(sum(price_drop_count_7d), 0)::int as price_drop_count_7d
          from home_scout_market_buckets
          where county_fips = $1
            and state_code = $2
            and ($3::text is null or property_type = $3)
        `,
          [countyFips, stateCode, propertyType]
        );

        const velocityResult = await pool.query(
          `
          select
            count(*) filter (where e.event_type = 'created')::int as created_count,
            count(*) filter (where e.event_type = 'price_changed')::int as price_changed_count
          from home_scout_listing_events e
          inner join home_scout_listings l on l.id = e.listing_id
          where l.county_fips = $1
            and l.state_code = $2
            and ($3::text is null or l.property_type = $3)
            and e.observed_at >= (now() - ($4::interval))
        `,
          [countyFips, stateCode, propertyType, interval]
        );

        const countResult = await pool.query(
          `
          select count(*)::int as listing_count
          from home_scout_listings
          where county_fips = $1
            and state_code = $2
            and status = 'active'
            and ($3::text is null or property_type = $3)
        `,
          [countyFips, stateCode, propertyType]
        );

        const listingCount = Number(countResult.rows?.[0]?.listing_count || 0);
        if (listingCount < 25) {
          return res.json({ status: "suppressed", reason: "minimum_threshold_not_met" });
        }

        const bucketRow = bucketResult.rows?.[0] || {};
        const velocityRow = velocityResult.rows?.[0] || {};

        return res.json({
          status: "ok",
          countyFips,
          stateCode,
          propertyType: propertyType || undefined,
          window,
          generatedAt: new Date().toISOString(),
          activeListingCount: Number(bucketRow.active_listing_count || 0),
          newListingVelocityIndex: Math.max(
            0,
            Math.min(100, Number(velocityRow.created_count || 0) * 4)
          ),
          priceDropPressureIndex: Math.max(
            0,
            Math.min(
              100,
              Number(bucketRow.price_drop_count_7d || 0) * 5 +
                Number(velocityRow.price_changed_count || 0) * 2
            )
          ),
          buyerDemandProxyIndex: Math.max(
            0,
            Math.min(
              100,
              Math.round(
                Number(bucketRow.active_listing_count || 0) * 0.4 +
                  Math.max(0, 30 - Number(bucketRow.median_dom_days || 30)) * 2
              )
            )
          ),
        });
      } catch (error: any) {
        console.error("Failed to load HomeScout Listings inventory signal", error);
        return res
          .status(500)
          .json({ message: "Failed to load HomeScout Listings inventory signal" });
      }
    }
  );

  app.get(
    "/api/market-signals/v1/activation-readiness",
    marketSignalsAccess,
    async (req: any, res: any) => {
      try {
        const countyFips =
          typeof req.query?.countyFips === "string" ? String(req.query.countyFips).trim() : "";
        const stateCode =
          typeof req.query?.stateCode === "string"
            ? String(req.query.stateCode).trim().toUpperCase()
            : "";
        const category =
          typeof req.query?.category === "string" ? String(req.query.category).trim() : undefined;
        const surface =
          typeof req.query?.surface === "string" ? String(req.query.surface).trim() : undefined;
        const window = parseMarketSignalsWindow(req.query?.window);

        if (countyFips && !isValidCountyFips(countyFips)) {
          return res.status(400).json({ message: "Invalid countyFips" });
        }
        if (stateCode && !isValidStateCode(stateCode)) {
          return res.status(400).json({ message: "Invalid stateCode" });
        }

        let scopeType: "county" | "state" | "global" = "global";
        let scopeId = "global";
        if (countyFips) {
          scopeType = "county";
          scopeId = countyFips;
        } else if (stateCode) {
          scopeType = "state";
          scopeId = stateCode;
        }

        const snapshot = await getMarketSignalsSnapshot({
          kind: "activation_readiness",
          window,
          scopeType,
          scopeId,
        });
        if (!snapshot) {
          return res.status(503).json({
            message: "Activation readiness snapshot unavailable. Retry after scheduled refresh.",
            reasonCode: "SNAPSHOT_UNAVAILABLE",
          });
        }

        const payload = (snapshot.payload || {}) as any;
        const categoryKey = category ? String(category).trim().toLowerCase() : "";
        const categoryScore = categoryKey ? payload?.categoryScores?.[categoryKey] : null;

        const marketActivationScore =
          typeof categoryScore?.marketActivationScore === "number"
            ? categoryScore.marketActivationScore
            : Number(payload.marketActivationScore || 0);
        const sponsorReadinessScore =
          typeof categoryScore?.sponsorReadinessScore === "number"
            ? categoryScore.sponsorReadinessScore
            : Number(payload.sponsorReadinessScore || 0);

        return res.json({
          status: "ok",
          countyFips: countyFips || undefined,
          stateCode: stateCode || undefined,
          category,
          surface,
          window,
          generatedAt: snapshot.generatedAt || new Date().toISOString(),
          marketActivationScore,
          sponsorReadinessScore,
          meetsMinimumAudienceThreshold: Boolean(payload.meetsMinimumAudienceThreshold),
          recommendedSurface: surface || payload.recommendedSurface || "scout",
        });
      } catch (error: any) {
        console.error("Failed to load activation readiness signal", error);
        return res.status(500).json({ message: "Failed to load activation readiness signal" });
      }
    }
  );

  app.get(
    "/api/market-signals/v1/partners/:partnerSlug/county-observation",
    marketSignalsAccess,
    async (req: any, res: any) => {
      try {
        const partnerSlug = String(req.params?.partnerSlug || "")
          .trim()
          .toLowerCase();
        if (!/^[a-z0-9-]{2,120}$/.test(partnerSlug)) {
          return res.status(400).json({ message: "Invalid partnerSlug" });
        }
        if (!requirePartnerMarketSignalsScope(req, res, partnerSlug)) {
          return;
        }

        const window = parseMarketSignalsWindow(req.query?.window);
        const stateCode =
          typeof req.query?.stateCode === "string"
            ? String(req.query.stateCode).trim().toUpperCase()
            : "";
        const sourceSurface =
          typeof req.query?.surface === "string"
            ? String(req.query.surface).trim().toLowerCase()
            : "";
        const limit = Math.max(
          25,
          Math.min(500, Number.parseInt(String(req.query?.limit || "100"), 10) || 100)
        );

        if (stateCode && !isValidStateCode(stateCode)) {
          return res.status(400).json({ message: "Invalid stateCode" });
        }

        const snapshot = await getPartnerCountyObservationSnapshots({
          partnerSlug,
          window,
          stateCode: stateCode || undefined,
          surface: sourceSurface || undefined,
          limit,
        });

        if (snapshot.counties.length === 0) {
          return res.json({ status: "suppressed", reason: "minimum_threshold_not_met" });
        }

        return res.json({
          status: "ok",
          partnerSlug,
          window,
          generatedAt: snapshot.generatedAt,
          counties: snapshot.counties,
        });
      } catch (error: any) {
        console.error("Failed to load partner county observation signal", error);
        return res
          .status(500)
          .json({ message: "Failed to load partner county observation signal" });
      }
    }
  );

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

  const normalizeWhitespace = (value: unknown): string =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeOptionalText = (value: unknown): string | null => {
    const normalized = normalizeWhitespace(value);
    return normalized.length ? normalized : null;
  };

  const normalizeRedactedText = (value: unknown, maxLength = 4000): string =>
    normalizeWhitespace(redactContactDetails(String(value || ""))).slice(0, maxLength);

  const normalizeOptionalRedactedText = (value: unknown, maxLength = 4000): string | null => {
    const normalized = normalizeRedactedText(value, maxLength);
    return normalized.length ? normalized : null;
  };

  const normalizeOptionalStateCode = (value: unknown): string | null => {
    const normalized = normalizeWhitespace(value).toUpperCase();
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
  };

  const normalizeOptionalZipCode = (value: unknown): string | null => {
    const normalized = normalizeWhitespace(value);
    return normalized.length ? normalized.slice(0, 10) : null;
  };

  const normalizeStringArray = (value: unknown, maxItems = 50, maxLength = 200): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeWhitespace(item))
          .filter(Boolean)
          .map((item) => item.slice(0, maxLength))
      )
    ).slice(0, maxItems);
  };

  const normalizeRedactedStringArray = (
    value: unknown,
    maxItems = 50,
    maxLength = 200
  ): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeRedactedText(item, maxLength))
          .filter(Boolean)
      )
    ).slice(0, maxItems);
  };

  const sanitizeContactBearingValue = (value: unknown, depth = 0): unknown => {
    if (value == null) return value;
    if (depth > 4) return value;
    if (typeof value === "string") {
      return normalizeOptionalRedactedText(value, 1000);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => sanitizeContactBearingValue(item, depth + 1))
        .filter((item) => item != null)
        .slice(0, 50);
    }
    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .map(([key, item]) => [key, sanitizeContactBearingValue(item, depth + 1)])
          .filter(([, item]) => item != null)
      );
    }
    return value;
  };

  const hasOwnKeys = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) &&
    typeof value === "object" &&
    Object.keys(value as Record<string, unknown>).length > 0;

  const buildCanonicalHash = (...parts: Array<string | null | undefined>): string =>
    createHash("sha256")
      .update(parts.map((part) => normalizeWhitespace(part).toLowerCase()).join("|"))
      .digest("hex")
      .slice(0, 24);

  const normalizeCanonicalIdentityPart = (value: unknown): string =>
    normalizeWhitespace(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const buildMarketplaceIngressKey = (input: {
    sellerId: string;
    categoryId: string;
    title: string;
    county: string;
    state: string;
    price: string | number;
  }) =>
    buildCanonicalHash(
      input.sellerId,
      input.categoryId,
      input.title,
      input.county,
      input.state,
      String(input.price)
    );

  const pickMarketplaceWritableFields = (body: any) => ({
    categoryId: body?.categoryId,
    title: body?.title,
    description: body?.description,
    price: body?.price,
    priceType: body?.priceType,
    originalPrice: body?.originalPrice,
    county: body?.county,
    state: body?.state,
    city: body?.city,
    zipCode: body?.zipCode,
    locationVisibility: body?.locationVisibility,
    latitude: body?.latitude,
    longitude: body?.longitude,
    isLocalPickupOnly: body?.isLocalPickupOnly,
    willShip: body?.willShip,
    shippingCost: body?.shippingCost,
    shippingQuote: body?.shippingQuote,
    packageDetails: body?.packageDetails,
    listingType: body?.listingType,
    bundlePurchaseMode: body?.bundlePurchaseMode,
    bundleItems: body?.bundleItems,
    valueGuidance: body?.valueGuidance,
    rarityTags: body?.rarityTags,
    rarityConfidence: body?.rarityConfidence,
    raritySampleSize: body?.raritySampleSize,
    rarityExplanation: body?.rarityExplanation,
    condition: body?.condition,
    brand: body?.brand,
    model: body?.model,
    year: body?.year,
    mileage: body?.mileage,
    hours: body?.hours,
    specifications: body?.specifications,
    images: body?.images,
    primaryImageIndex: body?.primaryImageIndex,
    videoUrl: body?.videoUrl,
    requiresBuyerVerification: body?.requiresBuyerVerification,
    metaDescription: body?.metaDescription,
    tags: body?.tags,
  });

  const normalizeMarketplaceWritableFields = (input: any) => {
    const sanitizedSpecifications = sanitizeContactBearingValue(input?.specifications);
    const sanitizedBundleItems = sanitizeContactBearingValue(input?.bundleItems);
    const sanitizedShippingQuote = sanitizeContactBearingValue(input?.shippingQuote);
    const sanitizedPackageDetails = sanitizeContactBearingValue(input?.packageDetails);
    const sanitizedValueGuidance = sanitizeContactBearingValue(input?.valueGuidance);
    const normalized: any = {
      ...input,
      title: normalizeRedactedText(input?.title, 200),
      description: normalizeRedactedText(input?.description, 4000),
      county: normalizeWhitespace(input?.county),
      state: normalizeOptionalStateCode(input?.state),
      city: normalizeOptionalText(input?.city),
      zipCode: normalizeOptionalZipCode(input?.zipCode),
      brand: normalizeOptionalRedactedText(input?.brand, 100),
      model: normalizeOptionalRedactedText(input?.model, 100),
      videoUrl: normalizeOptionalText(input?.videoUrl),
      metaDescription: normalizeOptionalRedactedText(input?.metaDescription, 320),
      tags: normalizeRedactedStringArray(input?.tags, 20, 64),
      images: normalizeStringArray(input?.images, 24, 1000),
      specifications: hasOwnKeys(sanitizedSpecifications) ? sanitizedSpecifications : null,
      rarityTags: normalizeRedactedStringArray(input?.rarityTags, 12, 48),
      rarityExplanation: normalizeOptionalRedactedText(input?.rarityExplanation, 600),
    };

    if (Array.isArray(sanitizedBundleItems)) {
      normalized.bundleItems = sanitizedBundleItems.slice(0, 100);
    }
    if (hasOwnKeys(sanitizedShippingQuote)) {
      normalized.shippingQuote = sanitizedShippingQuote;
    }
    if (hasOwnKeys(sanitizedPackageDetails)) {
      normalized.packageDetails = sanitizedPackageDetails;
    }
    if (hasOwnKeys(sanitizedValueGuidance)) {
      normalized.valueGuidance = sanitizedValueGuidance;
    }

    if (!normalized.state) {
      delete normalized.state;
    }

    if (normalized.primaryImageIndex != null) {
      const maxIndex = Math.max(0, normalized.images.length - 1);
      normalized.primaryImageIndex = Math.max(
        0,
        Math.min(maxIndex, Number(normalized.primaryImageIndex) || 0)
      );
    }

    return normalized;
  };

  const normalizeMarketplaceGuidanceInput = (body: any) => ({
    categoryId: normalizeOptionalText(body?.categoryId),
    title: normalizeRedactedText(body?.title, 200),
    brand: normalizeOptionalRedactedText(body?.brand, 100),
    model: normalizeOptionalRedactedText(body?.model, 100),
    condition: normalizeOptionalText(body?.condition),
    state: normalizeOptionalStateCode(body?.state),
    county: normalizeWhitespace(body?.county),
    price: Number(body?.price),
    rarityTags: normalizeRedactedStringArray(body?.rarityTags, 12, 48),
  });

  const conditionValueFactor = (condition: string | null | undefined): number => {
    switch (String(condition || "").toLowerCase()) {
      case "new":
        return 1.18;
      case "like_new":
        return 1.08;
      case "excellent":
        return 1;
      case "good":
        return 0.86;
      case "fair":
        return 0.68;
      case "poor":
        return 0.46;
      case "parts_only":
        return 0.28;
      default:
        return 0.8;
    }
  };

  const buildListingValueGuidance = async (body: any) => {
    const input = normalizeMarketplaceGuidanceInput(body);
    const tokens = String(input.title || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3)
      .slice(0, 8);
    const searchQuery = [input.brand, input.model, tokens.slice(0, 4).join(" ")]
      .filter(Boolean)
      .join(" ")
      .trim();
    const comps = await storage.getMarketplaceListings({
      categoryId: input.categoryId || undefined,
      state: input.state || undefined,
      searchQuery: searchQuery || tokens.slice(0, 4).join(" ") || undefined,
      status: "active",
      limit: 80,
    });

    const currentConditionFactor = conditionValueFactor(input.condition);
    const prices = comps
      .map((listing: any) => {
        const rawPrice = Number(String(listing?.price || ""));
        if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null;
        const compFactor = conditionValueFactor(String(listing?.condition || ""));
        return rawPrice * (currentConditionFactor / Math.max(0.2, compFactor));
      })
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => a - b);

    const sampleSize = prices.length;
    const medianCompPrice =
      sampleSize === 0
        ? null
        : sampleSize % 2 === 1
          ? prices[Math.floor(sampleSize / 2)]
          : (prices[sampleSize / 2 - 1] + prices[sampleSize / 2]) / 2;
    const confidence = sampleSize >= 12 ? "high" : sampleSize >= 4 ? "medium" : "low";
    const rarityAdjustment = Math.min(0.18, input.rarityTags.length * 0.03);
    const baseline =
      medianCompPrice ?? (Number.isFinite(input.price) && input.price > 0 ? input.price : 0);
    const adjustedMedian = baseline * (1 + rarityAdjustment);
    const spread = confidence === "high" ? 0.18 : confidence === "medium" ? 0.28 : 0.4;
    const suggestedRangeLow = Math.max(1, Math.round(adjustedMedian * (1 - spread)));
    const suggestedRangeHigh = Math.max(
      suggestedRangeLow,
      Math.round(adjustedMedian * (1 + spread))
    );
    const price = Number.isFinite(input.price) ? input.price : 0;
    const undercutPercent =
      medianCompPrice && price > 0 ? (medianCompPrice - price) / Math.max(1, medianCompPrice) : 0;

    return {
      suggestedRangeLow,
      suggestedRangeHigh,
      medianCompPrice: medianCompPrice == null ? null : Math.round(medianCompPrice),
      confidence,
      sampleSize,
      conditionAdjustment: Number(currentConditionFactor.toFixed(2)),
      rarityAdjustment: Number(rarityAdjustment.toFixed(2)),
      ...(undercutPercent >= 0.15
        ? {
            undercutWarning: {
              severity: undercutPercent >= 0.28 ? "strong" : "soft",
              message: `You are listing ${Math.round(undercutPercent * 100)}% below similar-condition comps.`,
              expectedSellTimeImpact:
                "Likely faster sale, but you may be leaving money on the table.",
            },
          }
        : {}),
    };
  };

  const buildManualHomeScoutSourceListingId = (input: {
    userId: string;
    countyFips: string;
    stateCode: string;
    address1?: string | null;
    city?: string | null;
    zipCode?: string | null;
    sourceHomeId?: string | null;
  }) => {
    const sourceHomeId = normalizeCanonicalIdentityPart(input.sourceHomeId);
    const address1 = normalizeCanonicalIdentityPart(input.address1);
    const city = normalizeCanonicalIdentityPart(input.city);
    const zipCode = normalizeCanonicalIdentityPart(input.zipCode);
    const countyFips = normalizeCanonicalIdentityPart(input.countyFips);
    const stateCode = normalizeCanonicalIdentityPart(input.stateCode);

    const identityAnchor = sourceHomeId || address1;
    if (!identityAnchor) {
      return null;
    }
    const fingerprint = buildCanonicalHash(
      input.userId,
      countyFips,
      stateCode,
      sourceHomeId,
      address1,
      city,
      zipCode
    );
    return {
      sourceListingId: `manual:${input.userId}:${fingerprint}`,
      dedupeKey: `manual:${fingerprint}`,
    };
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
      profileImageUrl: normalizeProfileImageUrl((user as any)?.profileImageUrl),
      profileVersion:
        typeof (user as any).profileVersion === "number" ? (user as any).profileVersion : 0,
      // Expose license and insurance verification status from the trust snapshot
      // so the offer-services hub and other client surfaces can read them without
      // an extra API call. Source of truth is contractors.verified_licensed /
      // verified_insured, surfaced here via the trust_snapshots enrichment.
      licenseVerified:
        (user as any)?.trustSnapshot?.licenseStatus === "verified" ||
        (user as any)?.licenseVerified === true ||
        (user as any)?.license_verified === true,
      insuranceVerified:
        (user as any)?.trustSnapshot?.insuranceStatus === "verified" ||
        (user as any)?.insuranceVerified === true ||
        (user as any)?.insurance_verified === true,
      // Pass through the full trust snapshot so clients can read raw status strings
      trustSnapshot: (user as any)?.trustSnapshot ?? undefined,
      password: undefined,
    };
  };

  const hasCanonicalCountySetup = (user: any): boolean => {
    const stateCodeRaw =
      (user as any)?.stateCode ?? (user as any)?.state_code ?? (user as any)?.state ?? null;
    const countyFipsRaw =
      (user as any)?.countyFips ??
      (user as any)?.county_fips ??
      (typeof (user as any)?.county === "string" && /^\d{5}$/.test((user as any).county)
        ? (user as any).county
        : null);

    const stateCode = typeof stateCodeRaw === "string" ? stateCodeRaw.trim().toUpperCase() : "";
    const countyFips = typeof countyFipsRaw === "string" ? countyFipsRaw.trim() : "";

    return stateCode.length === 2 && /^\d{5}$/.test(countyFips);
  };

  const shouldBackfillCompletedSetup = (user: any): boolean =>
    (user as any)?.onboardingCompleted === true &&
    (typeof (user as any)?.profileVersion === "number" ? Number((user as any).profileVersion) : 0) <
      CURRENT_PROFILE_VERSION;

  const getCompletedSetupBackfillPatch = (user: any) => {
    if (!shouldBackfillCompletedSetup(user)) return null;

    const patch: Record<string, unknown> = {};
    const profileVersion =
      typeof (user as any)?.profileVersion === "number" ? Number((user as any).profileVersion) : 0;

    if (profileVersion < CURRENT_PROFILE_VERSION) {
      patch.profileVersion = CURRENT_PROFILE_VERSION;
    }
    if ((user as any)?.locationCommitted !== true && hasCanonicalCountySetup(user)) {
      patch.locationCommitted = true;
    }

    return Object.keys(patch).length > 0 ? patch : null;
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

  type AuthMethod = "password" | "google" | "facebook";
  const getAvailableAuthMethodsForUser = (user: any): AuthMethod[] => {
    const methods = new Set<AuthMethod>();
    const provider = String(user?.provider || "")
      .trim()
      .toLowerCase();
    const hasPassword = typeof user?.password === "string" && user.password.trim().length > 0;

    if (hasPassword) methods.add("password");
    if (provider === "google" || (typeof user?.googleId === "string" && user.googleId.trim())) {
      methods.add("google");
    }
    if (
      provider === "facebook" ||
      (typeof user?.facebookId === "string" && user.facebookId.trim())
    ) {
      methods.add("facebook");
    }

    if (methods.size === 0) {
      // Keep behavior resilient for legacy rows where provider metadata is sparse.
      methods.add("password");
    }

    return Array.from(methods);
  };

  const sendAccountExistsConflict = (res: Response, existingUser: any) => {
    const availableAuthMethods = getAvailableAuthMethodsForUser(existingUser);
    const hasPassword = availableAuthMethods.includes("password");
    const hasSocial =
      availableAuthMethods.includes("google") || availableAuthMethods.includes("facebook");
    const socialOnly = !hasPassword && hasSocial;

    return res.status(409).json({
      message: socialOnly
        ? "An account with this email already exists. Sign in with Google/Facebook or reset your password."
        : "An account with this email already exists. Sign in to continue.",
      code: socialOnly ? "AUTH_ACCOUNT_EXISTS_SOCIAL_ONLY" : "AUTH_ACCOUNT_EXISTS",
      availableAuthMethods,
    });
  };

  // Authentication routes
  const establishAuthenticatedSession = (req: Request, user: any): Promise<void> =>
    new Promise((resolve, reject) => {
      req.logIn(user, (loginErr: any) => {
        if (loginErr) {
          reject(loginErr);
          return;
        }

        if (!req.session) {
          resolve();
          return;
        }

        applyRequestSessionCookieScope(req);
        req.session.save((saveErr: any) => {
          if (saveErr) {
            reject(saveErr);
            return;
          }
          resolve();
        });
      });
    });

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
      establishAuthenticatedSession(req, user)
        .then(() =>
          res.json({ user: sanitizeUserForResponse(req.user), message: "Login successful" })
        )
        .catch(next);
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
        return sendAccountExistsConflict(res, existingUser);
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
        const { token, expiresAt } = await emailVerificationService.createToken(created.user.id);
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
          profiles: created.profiles.map((p: any) => ({
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
      if (String(error?.code || "") === "23505") {
        const duplicateEmail =
          typeof req.body?.email === "string" ? String(req.body.email).trim().toLowerCase() : "";
        const existingUser = duplicateEmail ? await storage.getUserByEmail(duplicateEmail) : null;
        if (existingUser) {
          return sendAccountExistsConflict(res, existingUser);
        }
        return res.status(409).json({
          message: "An account with this email already exists. Sign in to continue.",
          code: "AUTH_ACCOUNT_EXISTS",
          availableAuthMethods: ["password"],
        });
      }

      console.error("Multi-profile registration error:", error);
      sendAutoClassifiedError(res, error, "Registration failed", {});
    }
  };

  type OwnedVerificationProfileRow = Omit<typeof userProfiles.$inferSelect, "id"> & {
    id: string;
  };

  const loadOwnedVerificationProfiles = async (
    userId: string
  ): Promise<OwnedVerificationProfileRow[]> => {
    const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return rows as OwnedVerificationProfileRow[];
  };

  const selectVerificationProfile = (
    profiles: readonly OwnedVerificationProfileRow[],
    requestedBusinessProfileId?: string
  ): OwnedVerificationProfileRow | null =>
    selectOwnedVerificationProfile<OwnedVerificationProfileRow>(
      profiles,
      requestedBusinessProfileId
    );

  const verificationStatusForProfile = (profile: any, user: any) => ({
    email: Boolean(user?.emailVerified || profile?.email_verified),
    address: Boolean(user?.addressVerified || profile?.address_verified),
    license: Boolean(profile?.license_verified),
    insurance: Boolean(profile?.insurance_verified),
    tax_id: Boolean(profile?.tax_id_verified),
    business_registration: Boolean(profile?.business_registration_verified),
  });

  // Verification checklist: profile selection is owner-scoped and business-first.
  app.get("/api/profile/verification", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const requestedBusinessProfileId =
        typeof req.query.businessProfileId === "string"
          ? req.query.businessProfileId.trim()
          : undefined;
      if (requestedBusinessProfileId && requestedBusinessProfileId.length > 128) {
        return res.status(400).json({ message: "Invalid businessProfileId" });
      }

      const profiles = await loadOwnedVerificationProfiles(userId);
      const profile = selectVerificationProfile(profiles, requestedBusinessProfileId);
      if (requestedBusinessProfileId && !profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      const verificationBypassActive = hasRequestPrivilegedVerificationBypass(req);
      if (!profile) {
        const requirements = await computeVerificationRequirements("person");
        const status = verificationStatusForProfile(null, user);
        return res.json({
          profileId: null,
          displayName: null,
          userIntent: "person",
          businessType: null,
          requirements,
          status,
          fieldReview: buildVerificationFieldReviewState({ requirements, status, submissions: {} }),
          submissions: sanitizeVerificationSubmissions({}),
          verificationStatus: verificationBypassActive ? "not_required" : "pending",
          verificationBypassActive,
        });
      }

      const requirements = await computeVerificationRequirements(
        profile.userIntent as "person" | "business",
        (profile.businessType as "service_provider" | "seller" | "generic" | null) || undefined,
        profile.serviceTags || [],
        profile.sellerTags || []
      );
      const status = verificationStatusForProfile(profile, user);
      const submissions = (profile as any).verificationSubmissions || {};

      return res.json({
        profileId: profile.id,
        displayName: profile.displayName || null,
        userIntent: profile.userIntent,
        businessType: profile.businessType,
        requirements,
        status,
        fieldReview: buildVerificationFieldReviewState({ requirements, status, submissions }),
        submissions: sanitizeVerificationSubmissions(submissions),
        verificationStatus: verificationBypassActive
          ? "not_required"
          : profile.verificationStatus || "pending",
        verificationBypassActive,
      });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      return res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  // Submissions remain claims until an admin reviews each required field.
  app.patch("/api/profile/verification", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const parsed = profileVerificationSubmissionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid verification submission",
          errors: parsed.error.flatten(),
        });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const profiles = await loadOwnedVerificationProfiles(userId);
      const profile = selectVerificationProfile(profiles, parsed.data.businessProfileId);
      if (!profile) return res.status(404).json({ message: "Business profile not found" });

      const privateDocumentFields = [
        ["licenseDocObjectKey", parsed.data.licenseDocObjectKey],
        ["insuranceDocObjectKey", parsed.data.insuranceDocObjectKey],
        ["taxDocumentObjectKey", parsed.data.taxDocumentObjectKey],
        ["businessRegistrationDocObjectKey", parsed.data.businessRegistrationDocObjectKey],
      ] as const;
      for (const [field, objectKey] of privateDocumentFields) {
        if (objectKey && !isOwnedPrivateObjectKey(objectKey, userId)) {
          return res.status(400).json({ message: `${field} is not an owned private object key` });
        }
      }

      const requirements = await computeVerificationRequirements(
        profile.userIntent as "person" | "business",
        (profile.businessType as "service_provider" | "seller" | "generic" | null) || undefined,
        profile.serviceTags || [],
        profile.sellerTags || []
      );
      const submittedAt = new Date().toISOString();
      const nextSubmissions = mergeVerificationSubmission(
        (profile as any).verificationSubmissions || {},
        parsed.data,
        submittedAt
      );
      const nextValues: Record<string, unknown> = {
        verificationRequirements: requirements,
        verificationSubmissions: nextSubmissions,
        verificationStatus: "pending",
        updatedAt: new Date(),
      };
      if (parsed.data.licenseNumber || parsed.data.licenseDocObjectKey) {
        nextValues.license_verified = false;
      }
      if (parsed.data.insuranceDocObjectKey) nextValues.insurance_verified = false;
      if (parsed.data.taxIdLast4 || parsed.data.taxDocumentObjectKey) {
        nextValues.tax_id_verified = false;
      }
      if (parsed.data.businessRegistrationDocObjectKey) {
        nextValues.business_registration_verified = false;
      }

      const [updated] = await db
        .update(userProfiles)
        .set(nextValues as any)
        .where(and(eq(userProfiles.id, profile.id), eq(userProfiles.userId, userId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Business profile not found" });

      const status = verificationStatusForProfile(updated, user);
      const verificationBypassActive = hasRequestPrivilegedVerificationBypass(req);
      return res.json({
        profileId: updated.id,
        displayName: updated.displayName || null,
        requirements,
        status,
        fieldReview: buildVerificationFieldReviewState({
          requirements,
          status,
          submissions: nextSubmissions,
        }),
        submissions: sanitizeVerificationSubmissions(nextSubmissions),
        verificationStatus: verificationBypassActive ? "not_required" : "pending",
        verificationBypassActive,
      });
    } catch (error) {
      console.error("Error submitting verification info:", error);
      return res.status(500).json({ message: "Failed to submit verification info" });
    }
  });

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
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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
      let stateCode = typeof body.stateCode === "string" ? body.stateCode.trim() : state;
      stateCode = typeof stateCode === "string" ? stateCode.toUpperCase() : stateCode;
      let countyFips = typeof body.countyFips === "string" ? body.countyFips.trim() : undefined;
      let countyName = typeof body.countyName === "string" ? body.countyName.trim() : county;

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

      // Fail-soft county inference for signup flows where users skip county selection.
      if (
        (!countyFips || !/^\d{5}$/.test(countyFips)) &&
        city &&
        /^[A-Z]{2}$/.test(String(stateCode || ""))
      ) {
        try {
          const inferred = await inferCountyFromCityState({
            city,
            stateCode: String(stateCode),
            zipCode: zipCode || "",
          });

          const canonicalCandidates: Array<{
            countyFips: string;
            countyName: string;
            cityMatch: boolean;
          }> = [];
          for (const candidate of inferred.candidates || []) {
            const countyRecord = await storage.getCountyByFips(String(candidate.countyFips || ""));
            if (!countyRecord) continue;
            if (String(countyRecord.stateCode || "").toUpperCase() !== String(stateCode)) continue;
            canonicalCandidates.push({
              countyFips: countyRecord.fips,
              countyName: countyRecord.name,
              cityMatch: Boolean(candidate.cityMatch),
            });
          }

          const deduped = Array.from(
            new Map(canonicalCandidates.map((entry) => [entry.countyFips, entry])).values()
          );
          const cityMatches = deduped.filter((entry) => entry.cityMatch);
          const inferredCounty =
            deduped.length === 1 ? deduped[0] : cityMatches.length === 1 ? cityMatches[0] : null;

          if (inferredCounty) {
            countyFips = inferredCounty.countyFips;
            if (!countyName) countyName = inferredCounty.countyName;
          }
        } catch (inferenceError) {
          console.warn("[auth/register] Failed to infer county from city/state", inferenceError);
        }
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return sendAccountExistsConflict(res, existingUser);
      }

      // Referral attribution (cookie-first) â€” best-effort, never blocks signup.
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
        const { token, expiresAt } = await emailVerificationService.createToken(user.id);
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
      if (String(error?.code || "") === "23505") {
        const duplicateEmail =
          typeof req.body?.email === "string" ? String(req.body.email).trim().toLowerCase() : "";
        const existingUser = duplicateEmail ? await storage.getUserByEmail(duplicateEmail) : null;
        if (existingUser) {
          return sendAccountExistsConflict(res, existingUser);
        }
        return res.status(409).json({
          message: "An account with this email already exists. Sign in to continue.",
          code: "AUTH_ACCOUNT_EXISTS",
          availableAuthMethods: ["password"],
        });
      }

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

      if (!isSafeAffiliateShareDestination(destination)) {
        return res.status(400).json({ message: "destination must be a safe root-relative path" });
      }

      const safeSlug = slugInput || `link-${Math.random().toString(36).slice(2, 8)}`;
      const slugError = affiliateShareSlugError(safeSlug);
      if (slugError) return res.status(400).json({ message: slugError });

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
      const destinationOrigin = await resolveAffiliateOriginForRequest(
        req,
        baseOrigin,
        destination
      );
      const shortLinkOrigin =
        destinationOrigin === baseOrigin ? baseOrigin : resolvePublicOrigin(req);
      const full = new URL(destination, destinationOrigin);
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
        shortUrl: `${shortLinkOrigin}/r/${encodeURIComponent(
          String(created.friendlySlug || safeSlug)
        )}`,
      });
    } catch (error: any) {
      console.error("Error creating affiliate share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  // Universal attribution click bridge:
  // /ref/<tag>?to=<safe-internal-path>
  // Validates tag + destination before attaching attribution.
  app.get("/ref/:tag", async (req: any, res: any) => {
    await handleUniversalAttributionClick({
      req,
      res,
      rawTag: req.params?.tag,
      rawTarget: req.query?.to,
      tagExists: async (tag) => {
        const [account] = await db
          .select({ id: affiliateAccounts.id })
          .from(affiliateAccounts)
          .where(eq(affiliateAccounts.referralCode, tag))
          .limit(1);
        return Boolean(account?.id);
      },
      getExistingAttribution: (request) => getCookieValue(request as any, "ts_ref"),
      setAttributionCookie: (response, tag) => setReferralCookie(response as any, tag),
      onAttributionAccepted: async ({ tag, target }) => {
        await recordReferralClick({
          referralCode: tag,
          destination: target,
          source: "universal_ref",
          conversionType: "click",
        }).catch(() => {});
      },
    });
  });

  app.post("/api/affiliate/attribution/conversions", async (req: any, res: any) => {
    try {
      const sessionAttribution = req.session?.referralAttribution || null;
      const cookieTag = getCookieValue(req as any, "ts_ref");

      const result = await recordAttributionConversionEvent({
        input: {
          sessionAttribution,
          cookieAttributionTag: cookieTag,
          conversionType: String(req.body?.conversionType || ""),
          source: String(req.body?.source || sessionAttribution?.source || ""),
          targetPath: String(req.body?.targetPath || ""),
          targetId: String(req.body?.targetId || ""),
          payoutEligible: req.body?.payoutEligible === true,
          payoutCalculated: req.body?.payoutCalculated === true,
          paymentTriggered: req.body?.paymentTriggered === true,
        },
        persist: async (event) => {
          await db.insert(affiliateAttributionConversions).values({
            conversionEventId: event.conversionEventId,
            affiliateTag: event.affiliateTag,
            source: event.source,
            attributionProofType: event.attributionProofType,
            attributionProof: event.attributionProof,
            conversionType: event.conversionType,
            targetPath: event.targetPath,
            targetId: event.targetId,
            occurredAt: new Date(event.occurredAt),
            status: event.status,
            payoutEligible: false,
            payoutCalculated: false,
            paymentTriggered: false,
          } as any);
        },
      });

      if (!result.ok) {
        return res.status(400).json({
          code: result.code,
          message: result.message,
        });
      }

      return res.status(201).json({
        event: result.event,
      });
    } catch (error) {
      console.error("Error recording attribution conversion event:", error);
      return res.status(500).json({ message: "Failed to record attribution conversion event" });
    }
  });

  // Public redirect for a share link slug
  app.get("/r/:slug", async (req: any, res: any, next: any) => {
    try {
      const slug = typeof req.params?.slug === "string" ? req.params.slug.trim() : "";
      if (!slug) return res.redirect(302, "/");

      if (await directConnectOwnsPersistedShareSlug(slug)) return next();

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

      // `/r/:token` is also the public Direct Connect request route. If this
      // value is not an affiliate slug, let the later public-page renderer
      // resolve it instead of swallowing the request with a generic redirect.
      if (!row?.id || !row.fullUrl) return next();

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
        const genericMessage = "If an account exists, a verification link has been sent.";
        const body = (req.body || {}) as any;
        const email = typeof body.email === "string" ? body.email.trim() : "";
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const user = await storage.getUserByEmail(email);
        if (!user || user.emailVerified) {
          return res.json({ message: genericMessage });
        }

        const { token, expiresAt } = await emailVerificationService.createToken(user.id);
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
          message: genericMessage,
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

      const userId = await emailVerificationService.consumeToken(token);
      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      const updated = await storage.updateUser(userId, { emailVerified: true } as any);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      // Auto-login: establish a session immediately after verification so the user
      // lands in the app without a second sign-in step (mirrors OAuth flow behavior).
      try {
        await new Promise<void>((resolve, reject) => {
          req.login(updated as any, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        applyRequestSessionCookieScope(req);
        if (req.session) {
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => (err ? reject(err) : resolve()));
          });
        }
      } catch (loginErr) {
        // Non-fatal: verification succeeded; session establishment failed.
        // The client will fall back to the normal sign-in path.
        console.warn("[email-verification] Auto-login after verification failed:", loginErr);
      }

      return res.json({
        message: "Email verified successfully",
        email: (updated as any)?.email || null,
        userId: (updated as any)?.id || userId,
        autoLoggedIn: !req.isUnauthenticated?.(),
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

  // Register the canonical onboarding owner before retired compatibility handlers.
  app.use(onboardingRouter);

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
        const existingUser = await storage.getUser(userId);
        const existingPrefs = ((existingUser as any)?.preferences || {}) as Record<string, any>;
        const draft = (existingPrefs as any)?.provisional?.profileDraft || {};

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
        const resolvedPresenceType = String(
          draft?.presenceType ||
            (bundles.includes("service_provider") || role === "contractor"
              ? "represent_business"
              : "personal")
        ).trim();
        const resolvedStartIntent = String(
          existingPrefs.startIntent ||
            (resolvedPresenceType === "represent_business" ? "business" : "services")
        ).trim();
        const resolvedFirstName = String(
          firstName || (existingUser as any)?.firstName || ""
        ).trim();
        const resolvedLastName = String(lastName || (existingUser as any)?.lastName || "").trim();
        const resolvedFullName = String(
          (req.body as any)?.name ||
            (existingUser as any)?.name ||
            (existingUser as any)?.displayName ||
            (draft as any)?.name ||
            (draft as any)?.displayName ||
            ""
        ).trim();
        const fullNameParts = resolvedFullName.split(/\s+/).filter(Boolean);
        const effectiveFirstName = resolvedFirstName || fullNameParts[0] || "";
        const effectiveLastName =
          resolvedLastName || (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : "");
        const resolvedPhone = String(phone || (existingUser as any)?.phone || "").trim();
        const resolvedPhoneDigits = resolvedPhone.replace(/\D+/g, "");
        const resolvedStateCode = String(
          state || (existingUser as any)?.stateCode || (draft as any)?.stateCode || ""
        )
          .trim()
          .toUpperCase();
        const resolvedCountyFips = String(
          (existingUser as any)?.countyFips || (draft as any)?.countyFips || ""
        ).trim();

        const missing: string[] = [];
        if (!effectiveFirstName) missing.push("name");
        if (resolvedPhoneDigits.length < 10) missing.push("phone");
        if (!/^[A-Z]{2}$/.test(resolvedStateCode)) missing.push("stateCode");
        if (!/^\d{5}$/.test(resolvedCountyFips)) missing.push("countyFips");
        if (!resolvedStartIntent) missing.push("startIntent");
        if (missing.length > 0) {
          return res.status(428).json({
            code: "ONBOARDING_MINIMUM_REQUIRED",
            message:
              "Day-1 onboarding minimum is required before completion: name, phone, location, mode, and intent.",
            missingFields: missing,
          });
        }

        // Start with basic profile + geo data
        const updateData: any = {
          firstName: effectiveFirstName,
          lastName: effectiveLastName,
          phone: resolvedPhone,
          address,
          city,
          state,
          stateCode: resolvedStateCode,
          zipCode,
          county,
          countyFips: resolvedCountyFips,
          locationCommitted: true,
          onboardingCompleted: true,
          profileVersion: CURRENT_PROFILE_VERSION,
          preferences: {
            ...existingPrefs,
            startIntent: resolvedStartIntent,
          },
        };
        const draftBusinessType = String((draft as any)?.businessType || "other");

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
          updateData.preferences = ensureBusinessOnboardingState(
            updateData.preferences,
            draftBusinessType
          );
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
        profileVersion: CURRENT_PROFILE_VERSION,
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

      user = await attachLatestTrustSnapshotToUser(user);
      user = await syncBusinessOnboardingFromSignals(user);

      const completedSetupBackfill = getCompletedSetupBackfillPatch(user);
      if (completedSetupBackfill) {
        try {
          const existingUserId = user?.id;
          if (!existingUserId) {
            res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
            return;
          }
          user = await storage.updateUser(existingUserId, {
            ...completedSetupBackfill,
            updatedAt: new Date(),
          } as any);
          if (!user) {
            res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
            return;
          }
        } catch (setupBackfillError) {
          console.warn("[auth/user] Failed to backfill legacy setup state", {
            userId,
            error: setupBackfillError,
          });
        }
      }

      const adminEmailAliases = getPrivilegedAliasEmails();

      const userEmail = String((user as any)?.email || "")
        .trim()
        .toLowerCase();
      const isAdminAliasEmail = userEmail.length > 0 && adminEmailAliases.has(userEmail);
      if (isAdminAliasEmail) {
        const currentRoles = Array.from(
          new Set(
            [
              ...(Array.isArray((user as any)?.roles) ? ((user as any).roles as unknown[]) : []),
              (user as any)?.role,
              (user as any)?.activeRole,
            ]
              .map((role) => normalizeAuthorityRole(role))
              .filter(Boolean)
          )
        );
        const alreadyAdminTier =
          (user as any)?.isSuperAdmin === true ||
          (user as any)?.isAdmin === true ||
          currentRoles.some((role) => isAdminTierRole(role));

        if (!alreadyAdminTier || !currentRoles.includes("super_admin")) {
          const nextRoles = Array.from(new Set([...currentRoles, "super_admin"]));
          try {
            const existingUserId = user?.id;
            if (!existingUserId) {
              res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
              return;
            }
            user = await storage.updateUser(existingUserId, {
              role: "super_admin",
              activeRole: "super_admin",
              roles: nextRoles as any,
              isAdmin: true,
              isSuperAdmin: true,
            } as any);
            if (!user) {
              res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
              return;
            }
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
              .map((role) => normalizeAuthorityRole(role))
              .filter(Boolean)
          )
        );

        const findFirstAdminRole = (roles: string[]): string =>
          roles.find((role) => isAdminTierRole(role)) || "";

        const baseUserRoles = Array.from(
          new Set(
            [
              ...(Array.isArray(baseUser?.roles) ? baseUser.roles : []),
              baseUser?.activeRole,
              baseUser?.role,
            ]
              .map((role) => normalizeAuthorityRole(role))
              .filter(Boolean)
          )
        );
        const baseUserAdminRole = findFirstAdminRole(baseUserRoles);

        const resolvedRole =
          normalizeAuthorityRole(baseUser?.activeRole) ||
          normalizeAuthorityRole(baseUser?.role) ||
          normalizeAuthorityRole(authUser?.activeRole) ||
          normalizeAuthorityRole(authUser?.role) ||
          normalizeAuthorityRole((authClaims as any)?.activeRole) ||
          normalizeAuthorityRole((authClaims as any)?.role) ||
          mergedRoles[0] ||
          "";

        const hasAdminRole = mergedRoles.some((role) => isAdminTierRole(role));
        const hasSuperAdminRole = mergedRoles.includes("super_admin");

        // Data authority: if DB says this user is admin-tier, do not allow stale session role payloads
        // to downgrade admin surfaces in the app shell.
        const effectiveRole =
          baseUserAdminRole ||
          (hasAdminRole && !isAdminTierRole(resolvedRole) ? findFirstAdminRole(mergedRoles) : "") ||
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

      const buildAuthUserPayload = (baseUser: any) => {
        const sanitized = sanitizeUserForResponse(baseUser);
        const privilegedBypass = resolvePrivilegedVerificationBypass(baseUser);
        const directConnectDemoBypass = isDirectConnectUnverifiedBypassEnabled();
        const bypassActive = privilegedBypass.active || directConnectDemoBypass;
        const bypassReason = privilegedBypass.active
          ? privilegedBypass.reason
          : directConnectDemoBypass
            ? "direct_connect_demo_mode"
            : "none";

        return {
          ...sanitized,
          verificationBypass: {
            active: bypassActive,
            privileged: privilegedBypass.active,
            reason: bypassReason,
            matchedRoles: privilegedBypass.matchedRoles,
            matchedEmail: privilegedBypass.matchedEmail,
            directConnectDemoMode: directConnectDemoBypass,
          },
        };
      };

      // Active profile resolution (session spine):
      // - If activeProfileId exists, keep it.
      // - Else if user owns exactly 1 profile, auto-set it.
      // Never let optional profile resolution break authenticated sessions.
      if (!user) {
        res.status(200).json({ authenticated: false, diagnostics: authDiagnostics });
        return;
      }
      if (!user.activeProfileId) {
        try {
          const profiles = await storage.listProfilesByOwner(userId);
          if (profiles.length === 1) {
            const updated = await attachLatestTrustSnapshotToUser(
              await storage.setUserActiveProfile(userId, profiles[0].id)
            );
            const synced = await syncBusinessOnboardingFromSignals(updated);
            res.json({
              authenticated: true,
              user: buildAuthUserPayload(mergeSessionAuthority(applyImpersonation(synced))),
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
            const updated = await attachLatestTrustSnapshotToUser(
              await storage.setUserActiveBusiness(userId, businesses[0].id)
            );
            const synced = await syncBusinessOnboardingFromSignals(updated);
            res.json({
              authenticated: true,
              user: buildAuthUserPayload(mergeSessionAuthority(applyImpersonation(synced))),
            });
            return;
          }
        } catch (businessError) {
          console.warn("[auth/user] business auto-resolution skipped:", businessError);
        }
      }

      const finalUser = buildAuthUserPayload(mergeSessionAuthority(applyImpersonation(user)));
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
      // Register the master admin's device as trusted (auto-approved on first setup)
      const { DeviceAuthService: _DAS } = await import("./deviceAuth");
      const deviceReg = await _DAS.registerDevice(masterAdmin.id, req, undefined, true);
      const sessionToken = deviceReg.sessionToken || "";

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
        // const { DeviceAuthService } = await import("./deviceAuth");
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

  registerAdminDeviceSecurityRoutes(app, { isAuthenticated, requireRole });

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

      // Explicit ?ref=... is recorded and, absent an existing cookie, sets
      // first-touch attribution. An existing cookie is never overwritten.
      const handled = await handleExplicitOrExistingReferral(req, res);
      if (handled) return next();

      // Clean public profile attribution (no ?ref=... required).
      if (path.startsWith("/profile/") || path.startsWith("/u/") || path.startsWith("/p/")) {
        let ownerUserId = "";
        let conversionSource = "profile_clean";
        let conversionType = "profile_view";

        if (path.startsWith("/profile/")) {
          const parts = path.split("/").filter(Boolean);
          ownerUserId = parts[1] ? decodeURIComponent(parts[1]) : "";
        } else {
          const parts = path.split("/").filter(Boolean);
          const slug = parts[1] ? decodeURIComponent(parts[1]) : "";
          if (!slug) return next();
          // Exact unlisted/internal profile URLs may render for review, but
          // clean visits must not create owner-fallback affiliate attribution.
          if (!shouldIndexPublicProfileSlug(slug)) return next();

          const [profileOwner] = await db
            .select({ ownerUserId: profiles.ownerUserId })
            .from(profiles)
            .innerJoin(users, eq(profiles.ownerUserId, users.id))
            .where(
              and(
                eq(profiles.slug, slug),
                eq(profiles.status, "published" as any),
                sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`
              )
            )
            .limit(1);

          ownerUserId = profileOwner?.ownerUserId ? String(profileOwner.ownerUserId) : "";
          conversionSource = "public_profile_clean";
          conversionType = "public_profile_view";
        }

        await attributeCleanPageViewToOwner({
          req,
          res,
          ownerUserId,
          destination: req.originalUrl || path,
          source: conversionSource,
          conversionType,
        });
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

        await attributeCleanPageViewToOwner({
          req,
          res,
          ownerUserId,
          destination: req.originalUrl || path,
          source: "business_clean",
          conversionType: "business_view",
        });
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
            const needsProfileNormalization = !isOutcomeOnboardingComplete(anyUser);
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
        const needsProfileNormalization = !isOutcomeOnboardingComplete(anyUser);
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
            const needsProfileNormalization = !isOutcomeOnboardingComplete(anyUser);
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
        const needsProfileNormalization = !isOutcomeOnboardingComplete(anyUser);
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
        const actor = resolvePrivilegedActor(req.user);
        const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);

        if (!reason) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 12 characters)" });
        }

        await auditPrivilegedAction({
          action: "admin_impersonation_start_role_denied",
          route: "/api/admin/impersonate",
          operationType: "impersonation_start",
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          actorRoles: actor.actorRoles,
          targetType: "role",
          targetId: null,
          resolutionSource: "role_token",
          reason,
          outcome: "denied",
          details: { message: "role_based_impersonation_disabled" },
        });

        return res.status(410).json({
          message: "Role-based impersonation is disabled. Use immutable user targeting instead.",
          reasonCode: "IMMUTABLE_TARGET_REQUIRED",
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
        const actor = resolvePrivilegedActor(req.user);
        const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);

        if (!userId) {
          return res.status(400).json({ message: "Target user is required" });
        }

        if (!reason) {
          return res
            .status(400)
            .json({ message: "Impersonation reason is required (min 12 characters)" });
        }

        const adminId = actor.actorId;
        const [targetUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, String(userId)))
          .limit(1);
        if (!targetUser) {
          return res.status(404).json({ message: "Target user not found" });
        }

        if (!adminId || !actorHasPrivilegedCapability(req.user, ["ops_admin", "super_admin"])) {
          await auditPrivilegedAction({
            action: "admin_impersonation_start_user",
            route: "/api/admin/impersonate/start/:userId",
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

        if ((targetUser as any).isActive === false) {
          return res.status(403).json({ message: "Cannot impersonate an inactive account" });
        }

        if (userHasProtectedAdminRole(targetUser) && !userIsSuperAdmin(req.user)) {
          return res
            .status(403)
            .json({ message: "Only super admins can impersonate protected admin users" });
        }

        (req.session as any).originalUser = {
          id: adminId,
          role: (req.user as any)?.role,
          email: (req.user as any)?.email,
        };

        (req.session as any).impersonatingRole = targetUser.activeRole || targetUser.role;
        (req.session as any).impersonatedUserId = targetUser.id;
        (req.session as any).isImpersonating = true;

        await auditPrivilegedAction({
          action: "admin_impersonation_start_user",
          route: "/api/admin/impersonate/start/:userId",
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
        const targetUserId = normalizeImmutableTargetId((req.session as any).impersonatedUserId);

        // Clear impersonation from session
        delete (req.session as any).impersonatingRole;
        delete (req.session as any).impersonatedUserId;
        delete (req.session as any).isImpersonating;
        delete (req.session as any).originalUser;

        await auditPrivilegedAction({
          action: "admin_impersonation_stop",
          route: "/api/admin/stop-impersonation",
          operationType: "impersonation_stop",
          actorId: normalizeImmutableTargetId(
            originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub
          ),
          actorRole: String(originalUser?.role || (req.user as any)?.role || "") || null,
          actorRoles: [String(originalUser?.role || (req.user as any)?.role || "")].filter(Boolean),
          targetType: "user",
          targetId: targetUserId,
          resolutionSource: "session.impersonatedUserId",
          reason: "stop_impersonation",
          outcome: "stopped",
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
      const targetUserId = normalizeImmutableTargetId((req.session as any).impersonatedUserId);

      delete (req.session as any).impersonatingRole;
      delete (req.session as any).impersonatedUserId;
      delete (req.session as any).isImpersonating;
      delete (req.session as any).originalUser;

      await auditPrivilegedAction({
        action: "admin_impersonation_stop",
        route: "/api/admin/impersonate/stop",
        operationType: "impersonation_stop",
        actorId: normalizeImmutableTargetId(
          originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub
        ),
        actorRole: String(originalUser?.role || (req.user as any)?.role || "") || null,
        actorRoles: [String(originalUser?.role || (req.user as any)?.role || "")].filter(Boolean),
        targetType: "user",
        targetId: targetUserId,
        resolutionSource: "session.impersonatedUserId",
        reason: "stop_impersonation",
        outcome: "stopped",
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
      const targetUserId = normalizeImmutableTargetId((req.session as any).impersonatedUserId);

      delete (req.session as any).impersonatingRole;
      delete (req.session as any).impersonatedUserId;
      delete (req.session as any).isImpersonating;
      delete (req.session as any).originalUser;

      await auditPrivilegedAction({
        action: "admin_impersonation_stop",
        route: "/api/admin/impersonate/exit",
        operationType: "impersonation_stop",
        actorId: normalizeImmutableTargetId(
          originalUser?.id || (req.user as any)?.id || (req.user as any)?.claims?.sub
        ),
        actorRole: String(originalUser?.role || (req.user as any)?.role || "") || null,
        actorRoles: [String(originalUser?.role || (req.user as any)?.role || "")].filter(Boolean),
        targetType: "user",
        targetId: targetUserId,
        resolutionSource: "session.impersonatedUserId",
        reason: "stop_impersonation",
        outcome: "stopped",
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

  type BusinessOnboardingModuleId =
    | "identity_profile"
    | "service_catalog"
    | "coverage_availability"
    | "trust_verification"
    | "operations_payout";

  type BusinessOnboardingModuleStatus = "not_started" | "in_progress" | "complete";

  type BusinessOnboardingState = {
    version: 1;
    businessType: string;
    startedAt: string;
    lastUpdatedAt: string;
    completedAt?: string;
    modules: Record<BusinessOnboardingModuleId, BusinessOnboardingModuleStatus>;
  };

  const BUSINESS_ONBOARDING_MODULES: BusinessOnboardingModuleId[] = [
    "identity_profile",
    "service_catalog",
    "coverage_availability",
    "trust_verification",
    "operations_payout",
  ];
  const BUSINESS_ONBOARDING_STATUS_ORDER: Record<BusinessOnboardingModuleStatus, number> = {
    not_started: 0,
    in_progress: 1,
    complete: 2,
  };
  const BUSINESS_ONBOARDING_ALLOWED_NEXT: Record<
    BusinessOnboardingModuleStatus,
    BusinessOnboardingModuleStatus[]
  > = {
    not_started: ["not_started", "in_progress"],
    in_progress: ["in_progress", "complete"],
    complete: ["complete"],
  };
  const isDiscoverabilityVerified = (user: any): boolean =>
    Boolean(
      user?.verifiedBadge === true ||
      String(user?.verificationStatus || "")
        .trim()
        .toLowerCase() === "approved" ||
      user?.licenseVerified === true ||
      user?.addressVerified === true
    );
  const isMissingBooksFoundationTable = (error: unknown): boolean => {
    const message = String((error as any)?.message || "").toLowerCase();
    return (
      message.includes('relation "accounting_profiles" does not exist') ||
      message.includes('relation "accounting_accounts" does not exist') ||
      message.includes('relation "accounting_journal_entries" does not exist') ||
      message.includes('relation "accounting_automation_events" does not exist') ||
      (error as any)?.code === "42P01"
    );
  };

  const createBusinessOnboardingState = (businessType: string): BusinessOnboardingState => {
    const now = new Date().toISOString();
    return {
      version: 1,
      businessType: businessType || "other",
      startedAt: now,
      lastUpdatedAt: now,
      modules: {
        identity_profile: "not_started",
        service_catalog: "not_started",
        coverage_availability: "not_started",
        trust_verification: "not_started",
        operations_payout: "not_started",
      },
    };
  };

  const normalizeBusinessOnboardingState = (
    raw: unknown,
    fallbackBusinessType: string
  ): BusinessOnboardingState => {
    if (!raw || typeof raw !== "object") {
      return createBusinessOnboardingState(fallbackBusinessType);
    }
    const record = raw as Record<string, any>;
    const now = new Date().toISOString();
    const base = createBusinessOnboardingState(fallbackBusinessType);
    const modules = { ...base.modules };
    for (const moduleId of BUSINESS_ONBOARDING_MODULES) {
      const candidate = String(record?.modules?.[moduleId] || "").trim();
      if (candidate === "not_started" || candidate === "in_progress" || candidate === "complete") {
        modules[moduleId] = candidate;
      }
    }
    const allComplete = BUSINESS_ONBOARDING_MODULES.every(
      (moduleId) => modules[moduleId] === "complete"
    );
    return {
      version: 1,
      businessType: String(record.businessType || fallbackBusinessType || "other"),
      startedAt: String(record.startedAt || now),
      lastUpdatedAt: String(record.lastUpdatedAt || now),
      completedAt: allComplete ? String(record.completedAt || now) : undefined,
      modules,
    };
  };

  const ensureBusinessOnboardingState = (
    existingPreferences: Record<string, any> | null | undefined,
    businessType: string
  ): Record<string, any> => {
    const currentPrefs = existingPreferences || {};
    const normalized = normalizeBusinessOnboardingState(
      (currentPrefs as any).businessOnboarding,
      businessType
    );
    return {
      ...currentPrefs,
      businessOnboarding: normalized,
    };
  };
  const recordBusinessOnboardingTransitionEvents = async (input: {
    userId: string;
    actorUserId: string;
    source:
      | "auth_user_fetch_sync"
      | "business_onboarding_read_sync"
      | "business_onboarding_manual_update";
    beforeModules: Record<BusinessOnboardingModuleId, BusinessOnboardingModuleStatus>;
    afterModules: Record<BusinessOnboardingModuleId, BusinessOnboardingModuleStatus>;
  }) => {
    const nowIso = new Date().toISOString();
    for (const moduleId of BUSINESS_ONBOARDING_MODULES) {
      const fromStatus = input.beforeModules[moduleId];
      const toStatus = input.afterModules[moduleId];
      if (fromStatus === toStatus) continue;
      await storage.logEvent("business_onboarding.module_transition", {
        userId: input.userId,
        actorUserId: input.actorUserId,
        source: input.source,
        moduleId,
        fromStatus,
        toStatus,
        transitionedAt: nowIso,
      });
    }
  };
  const syncBusinessOnboardingFromSignals = async (
    user: any,
    source: "auth_user_fetch_sync" | "business_onboarding_read_sync" = "auth_user_fetch_sync"
  ): Promise<any> => {
    if (!user || typeof user !== "object" || !user.id) return user;

    const roleToken = String(user.role || "")
      .trim()
      .toLowerCase();
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
          .map((r: unknown) =>
            String(r || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : [];
    const capabilityBundles: string[] = Array.isArray(user.capabilityBundles)
      ? user.capabilityBundles
          .map((r: unknown) =>
            String(r || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      : [];
    const draftPresenceType = String(
      user?.preferences?.provisional?.profileDraft?.presenceType || ""
    ).trim();
    const isBusinessUser =
      draftPresenceType === "represent_business" ||
      [
        "contractor",
        "business_owner",
        "property_manager",
        "service_provider",
        "realtor",
        "mortgage_broker",
        "insurance_agent",
        "title_company",
        "car_dealer",
        "auto_service",
      ].includes(roleToken) ||
      roles.some((role) =>
        ["contractor", "business_owner", "property_manager", "service_provider"].includes(role)
      ) ||
      capabilityBundles.some((bundle) =>
        ["service_provider", "property_operator", "local_seller", "organization_admin"].includes(
          bundle
        )
      );

    if (!isBusinessUser) return user;

    const userId = String(user.id);
    const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
    const fallbackBusinessType =
      String(existingPrefs?.businessOnboarding?.businessType || "").trim() ||
      String((existingPrefs as any)?.provisional?.profileDraft?.businessType || "other");
    const normalized = normalizeBusinessOnboardingState(
      existingPrefs?.businessOnboarding,
      fallbackBusinessType
    );
    const modules = { ...normalized.modules };
    const enforceModule = (
      id: BusinessOnboardingModuleId,
      status: BusinessOnboardingModuleStatus
    ) => {
      const current = modules[id];
      if (BUSINESS_ONBOARDING_STATUS_ORDER[status] > BUSINESS_ONBOARDING_STATUS_ORDER[current]) {
        modules[id] = status;
      }
    };

    const hasIdentityProfile =
      String((user as any)?.firstName || "").trim().length > 0 &&
      String((user as any)?.lastName || "").trim().length > 0 &&
      String((user as any)?.phone || "").replace(/\D+/g, "").length >= 10;
    const hasCoverageAvailability =
      /^[A-Z]{2}$/.test(
        String((user as any)?.stateCode || "")
          .trim()
          .toUpperCase()
      ) && /^\d{5}$/.test(String((user as any)?.countyFips || "").trim());
    const hasTrustVerification = isDiscoverabilityVerified(user);
    const hasBusinessProfile = Boolean(await storage.getBusinessProfileByUserId(userId));

    let activeProfileOfferCount = 0;
    try {
      const profileOffersResult = await pool.query(
        `SELECT COUNT(*)::int AS count
           FROM profile_offers
          WHERE seller_user_id = $1
            AND is_active = true`,
        [userId]
      );
      activeProfileOfferCount = Number(profileOffersResult.rows?.[0]?.count || 0);
    } catch (error) {
      const message = String((error as any)?.message || "").toLowerCase();
      if (!(message.includes("profile_offers") || (error as any)?.code === "42P01")) {
        throw error;
      }
    }

    let booksCounts = {
      accounts: 0,
      journalEntries: 0,
      postedEntries: 0,
      proposedAutomation: 0,
    };
    try {
      const booksResult = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int
              FROM accounting_accounts aa
             WHERE aa.profile_id = ap.id
               AND aa.is_active = true) AS account_count,
           (SELECT COUNT(*)::int
              FROM accounting_journal_entries aje
             WHERE aje.profile_id = ap.id) AS journal_entry_count,
           (SELECT COUNT(*)::int
              FROM accounting_journal_entries aje
             WHERE aje.profile_id = ap.id
               AND aje.status = 'posted') AS posted_entry_count,
           (SELECT COUNT(*)::int
              FROM accounting_automation_events aae
             WHERE aae.requester_user_id = $1
               AND aae.automation_state = 'proposed') AS proposed_automation_count
          FROM accounting_profiles ap
         WHERE ap.created_by = $1
         LIMIT 1`,
        [userId]
      );
      const row = booksResult.rows?.[0] || {};
      booksCounts = {
        accounts: Number(row.account_count || 0),
        journalEntries: Number(row.journal_entry_count || 0),
        postedEntries: Number(row.posted_entry_count || 0),
        proposedAutomation: Number(row.proposed_automation_count || 0),
      };
    } catch (error) {
      const message = String((error as any)?.message || "").toLowerCase();
      if (
        !(
          message.includes("accounting_profiles") ||
          message.includes("accounting_accounts") ||
          message.includes("accounting_journal_entries") ||
          message.includes("accounting_automation_events") ||
          (error as any)?.code === "42P01"
        )
      ) {
        throw error;
      }
    }

    if (hasIdentityProfile) enforceModule("identity_profile", "complete");
    if (hasBusinessProfile || activeProfileOfferCount > 0)
      enforceModule("service_catalog", "in_progress");
    if (activeProfileOfferCount > 0) enforceModule("service_catalog", "complete");
    if (hasCoverageAvailability) enforceModule("coverage_availability", "complete");
    if (hasTrustVerification) enforceModule("trust_verification", "complete");
    if (
      booksCounts.accounts > 0 ||
      booksCounts.journalEntries > 0 ||
      booksCounts.proposedAutomation > 0
    ) {
      enforceModule("operations_payout", "in_progress");
    }
    if (booksCounts.accounts > 0 && booksCounts.postedEntries > 0) {
      enforceModule("operations_payout", "complete");
    }

    const unchanged = BUSINESS_ONBOARDING_MODULES.every(
      (moduleId) => normalized.modules[moduleId] === modules[moduleId]
    );
    if (unchanged && normalized.businessType === fallbackBusinessType) return user;

    const now = new Date().toISOString();
    const allComplete = BUSINESS_ONBOARDING_MODULES.every(
      (moduleId) => modules[moduleId] === "complete"
    );
    const updatedState: BusinessOnboardingState = {
      ...normalized,
      businessType: fallbackBusinessType || "other",
      modules,
      lastUpdatedAt: now,
      completedAt: allComplete ? normalized.completedAt || now : undefined,
    };

    const updated = await storage.updateUser(userId, {
      preferences: {
        ...existingPrefs,
        businessOnboarding: updatedState,
      },
      updatedAt: new Date(),
    } as any);
    try {
      await recordBusinessOnboardingTransitionEvents({
        userId,
        actorUserId: userId,
        source,
        beforeModules: normalized.modules,
        afterModules: updatedState.modules,
      });
    } catch (eventError) {
      console.warn("[business-onboarding] transition event logging skipped during sync", {
        userId,
        source,
        error: eventError,
      });
    }
    return updated || user;
  };

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

  app.get("/api/user/business-onboarding", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      let currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      currentUser = await attachLatestTrustSnapshotToUser(currentUser);
      currentUser = await syncBusinessOnboardingFromSignals(
        currentUser,
        "business_onboarding_read_sync"
      );

      const draft = (currentUser as any)?.preferences?.provisional?.profileDraft;
      const inferredBusinessType = String(
        (currentUser as any)?.preferences?.businessOnboarding?.businessType ||
          draft?.businessType ||
          "other"
      );
      const state = normalizeBusinessOnboardingState(
        (currentUser as any)?.preferences?.businessOnboarding,
        inferredBusinessType
      );
      res.json({ businessOnboarding: state });
    } catch (error: any) {
      console.error("Error fetching business onboarding state:", error);
      res.status(500).json({ message: "Failed to fetch business onboarding state" });
    }
  });

  app.patch(
    "/api/user/business-onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const moduleId = String(
          (req.body as any)?.moduleId || ""
        ).trim() as BusinessOnboardingModuleId;
        const nextStatus = String(
          (req.body as any)?.status || ""
        ).trim() as BusinessOnboardingModuleStatus;
        const nextBusinessType = String((req.body as any)?.businessType || "").trim();

        if (!BUSINESS_ONBOARDING_MODULES.includes(moduleId)) {
          return res.status(400).json({ message: "Invalid moduleId" });
        }
        if (!["not_started", "in_progress", "complete"].includes(nextStatus)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const existingPrefs = ((currentUser as any)?.preferences || {}) as Record<string, any>;
        const roleToken = String((currentUser as any)?.role || "")
          .trim()
          .toLowerCase();
        const roleList: string[] = Array.isArray((currentUser as any)?.roles)
          ? (currentUser as any).roles
              .map((r: unknown) =>
                String(r || "")
                  .trim()
                  .toLowerCase()
              )
              .filter(Boolean)
          : [];
        const isAdminActor =
          roleToken === "admin" ||
          roleToken === "super_admin" ||
          roleList.includes("admin") ||
          roleList.includes("super_admin");
        const fallbackBusinessType =
          nextBusinessType ||
          String(existingPrefs?.businessOnboarding?.businessType || "") ||
          String((existingPrefs as any)?.provisional?.profileDraft?.businessType || "other");
        const state = normalizeBusinessOnboardingState(
          existingPrefs?.businessOnboarding,
          fallbackBusinessType
        );
        const currentStatus = state.modules[moduleId];
        if (!isAdminActor) {
          const allowed = BUSINESS_ONBOARDING_ALLOWED_NEXT[currentStatus] || [currentStatus];
          if (!allowed.includes(nextStatus)) {
            return res.status(400).json({
              message: "Invalid business onboarding transition",
              moduleId,
              currentStatus,
              attemptedStatus: nextStatus,
              allowedNextStatuses: allowed,
            });
          }
        }

        if (moduleId === "trust_verification" && nextStatus === "complete") {
          const verified = isDiscoverabilityVerified(currentUser);
          if (!verified && !isAdminActor) {
            return res.status(428).json({
              code: "BUSINESS_VERIFICATION_REQUIRED",
              message:
                "Verification is required before trust_verification can be marked complete and discoverability can unlock.",
              moduleId,
            });
          }
        }

        const modules = { ...state.modules, [moduleId]: nextStatus };
        const enforceModule = (
          id: BusinessOnboardingModuleId,
          status: BusinessOnboardingModuleStatus
        ) => {
          const current = modules[id];
          if (
            BUSINESS_ONBOARDING_STATUS_ORDER[status] > BUSINESS_ONBOARDING_STATUS_ORDER[current]
          ) {
            modules[id] = status;
          }
        };

        // Auto-progression from real signals so status is grounded in product truth.
        const hasIdentityProfile =
          String((currentUser as any)?.firstName || "").trim().length > 0 &&
          String((currentUser as any)?.lastName || "").trim().length > 0 &&
          String((currentUser as any)?.phone || "").replace(/\D+/g, "").length >= 10;
        const hasCoverageAvailability =
          /^[A-Z]{2}$/.test(
            String((currentUser as any)?.stateCode || "")
              .trim()
              .toUpperCase()
          ) && /^\d{5}$/.test(String((currentUser as any)?.countyFips || "").trim());
        const hasTrustVerification = isDiscoverabilityVerified(currentUser);
        const hasBusinessProfile = Boolean(await storage.getBusinessProfileByUserId(userId));
        let activeProfileOfferCount = 0;
        try {
          const profileOffersResult = await pool.query(
            `SELECT COUNT(*)::int AS count
               FROM profile_offers
              WHERE seller_user_id = $1
                AND is_active = true`,
            [userId]
          );
          activeProfileOfferCount = Number(profileOffersResult.rows?.[0]?.count || 0);
        } catch (error) {
          if (!isMissingProfileOffersTable(error)) {
            throw error;
          }
        }

        let booksCounts = {
          accounts: 0,
          journalEntries: 0,
          postedEntries: 0,
          proposedAutomation: 0,
        };
        try {
          const booksResult = await pool.query(
            `SELECT
               (SELECT COUNT(*)::int
                  FROM accounting_accounts aa
                 WHERE aa.profile_id = ap.id
                   AND aa.is_active = true) AS account_count,
               (SELECT COUNT(*)::int
                  FROM accounting_journal_entries aje
                 WHERE aje.profile_id = ap.id) AS journal_entry_count,
               (SELECT COUNT(*)::int
                  FROM accounting_journal_entries aje
                 WHERE aje.profile_id = ap.id
                   AND aje.status = 'posted') AS posted_entry_count,
               (SELECT COUNT(*)::int
                  FROM accounting_automation_events aae
                 WHERE aae.requester_user_id = $1
                   AND aae.automation_state = 'proposed') AS proposed_automation_count
              FROM accounting_profiles ap
             WHERE ap.created_by = $1
             LIMIT 1`,
            [userId]
          );
          const row = booksResult.rows?.[0] || {};
          booksCounts = {
            accounts: Number(row.account_count || 0),
            journalEntries: Number(row.journal_entry_count || 0),
            postedEntries: Number(row.posted_entry_count || 0),
            proposedAutomation: Number(row.proposed_automation_count || 0),
          };
        } catch (error) {
          if (!isMissingBooksFoundationTable(error)) {
            throw error;
          }
        }

        if (hasIdentityProfile) enforceModule("identity_profile", "complete");
        if (hasBusinessProfile || activeProfileOfferCount > 0) {
          enforceModule("service_catalog", "in_progress");
        }
        if (activeProfileOfferCount > 0) {
          enforceModule("service_catalog", "complete");
        }
        if (hasCoverageAvailability) enforceModule("coverage_availability", "complete");
        if (hasTrustVerification) enforceModule("trust_verification", "complete");
        if (
          booksCounts.accounts > 0 ||
          booksCounts.journalEntries > 0 ||
          booksCounts.proposedAutomation > 0
        ) {
          enforceModule("operations_payout", "in_progress");
        }
        if (booksCounts.accounts > 0 && booksCounts.postedEntries > 0) {
          enforceModule("operations_payout", "complete");
        }

        const allComplete = BUSINESS_ONBOARDING_MODULES.every((id) => modules[id] === "complete");
        const now = new Date().toISOString();

        const updatedState: BusinessOnboardingState = {
          ...state,
          businessType: fallbackBusinessType || "other",
          modules,
          lastUpdatedAt: now,
          completedAt: allComplete ? state.completedAt || now : undefined,
        };

        const updatedPrefs: any = {
          ...existingPrefs,
          businessOnboarding: updatedState,
        };

        await storage.updateUser(userId, {
          preferences: updatedPrefs,
          updatedAt: new Date(),
        });
        try {
          await recordBusinessOnboardingTransitionEvents({
            userId,
            actorUserId: userId,
            source: "business_onboarding_manual_update",
            beforeModules: state.modules,
            afterModules: updatedState.modules,
          });
        } catch (eventError) {
          console.warn("[business-onboarding] transition event logging skipped on manual update", {
            userId,
            moduleId,
            error: eventError,
          });
        }

        res.json({ businessOnboarding: updatedState });
      } catch (error: any) {
        console.error("Error updating business onboarding state:", error);
        res.status(500).json({ message: "Failed to update business onboarding state" });
      }
    }
  );

  app.post(
    "/api/user/complete-onboarding",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

        // â”€â”€ Promote provisional draft fields to canonical user record â”€â”€â”€â”€â”€â”€â”€â”€
        // The pre-scout-setup form stores captured data in
        // preferences.provisional.profileDraft. On completion we promote the
        // business-identity fields so they are available as first-class user
        // columns and not buried in JSONB preferences.
        const currentUser = await storage.getUser(userId);
        const provisional = (currentUser as any)?.preferences?.provisional;
        const draft = provisional?.profileDraft;

        const resolvedFirstName = String(
          (currentUser as any)?.firstName || (draft as any)?.firstName || ""
        ).trim();
        const resolvedLastName = String(
          (currentUser as any)?.lastName || (draft as any)?.lastName || ""
        ).trim();
        const resolvedFullName = String(
          (currentUser as any)?.name ||
            (currentUser as any)?.displayName ||
            (draft as any)?.name ||
            (draft as any)?.displayName ||
            ""
        ).trim();
        const fullNameParts = resolvedFullName.split(/\s+/).filter(Boolean);
        const effectiveFirstName = resolvedFirstName || fullNameParts[0] || "";
        const effectiveLastName =
          resolvedLastName || (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : "");
        const resolvedPhoneRaw = String((currentUser as any)?.phone || (draft as any)?.phone || "");
        const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D+/g, "");
        const resolvedStateCode = String(
          (currentUser as any)?.stateCode || (draft as any)?.stateCode || ""
        )
          .trim()
          .toUpperCase();
        const resolvedCountyFips = String(
          (currentUser as any)?.countyFips || (draft as any)?.countyFips || ""
        ).trim();
        const resolvedPresenceType = String((draft as any)?.presenceType || "personal").trim();
        const resolvedStartIntent = String(
          (currentUser as any)?.preferences?.startIntent ||
            (resolvedPresenceType === "represent_business" ? "business" : "services")
        ).trim();

        const missing: string[] = [];
        if (!effectiveFirstName) missing.push("name");
        if (resolvedPhoneDigits.length < 10) missing.push("phone");
        if (!/^[A-Z]{2}$/.test(resolvedStateCode)) missing.push("stateCode");
        if (!/^\d{5}$/.test(resolvedCountyFips)) missing.push("countyFips");
        if (!resolvedStartIntent) missing.push("startIntent");

        if (missing.length > 0) {
          return res.status(428).json({
            code: "ONBOARDING_MINIMUM_REQUIRED",
            message:
              "Day-1 onboarding minimum is required before completion: name, phone, location, mode, and intent.",
            missingFields: missing,
          });
        }

        const promotionPatch: Record<string, unknown> = {
          onboardingCompleted: true,
          profileVersion: CURRENT_PROFILE_VERSION,
          updatedAt: new Date(),
        };

        promotionPatch.firstName = effectiveFirstName;
        promotionPatch.lastName = effectiveLastName;
        promotionPatch.phone = resolvedPhoneRaw.trim();
        promotionPatch.stateCode = resolvedStateCode;
        promotionPatch.countyFips = resolvedCountyFips;
        promotionPatch.locationCommitted = true;

        if (draft && typeof draft === "object") {
          // Location fields (already promoted by /api/user/preferences PATCH,
          // but re-apply here as a safety net for any path that skips that step)
          if (typeof draft.stateCode === "string" && draft.stateCode.trim().length === 2) {
            promotionPatch.stateCode = draft.stateCode.trim().toUpperCase();
          }
          if (typeof draft.countyFips === "string" && /^\d{5}$/.test(draft.countyFips.trim())) {
            promotionPatch.countyFips = draft.countyFips.trim();
            promotionPatch.locationCommitted = true;
          }
          if (typeof draft.countyName === "string" && draft.countyName.trim()) {
            promotionPatch.countyName = draft.countyName.trim();
          }
          if (typeof draft.city === "string" && draft.city.trim()) {
            promotionPatch.city = draft.city.trim();
          }

          // Business identity fields â€” only promote when presenceType is business
          if (draft.presenceType === "represent_business") {
            if (typeof draft.businessName === "string" && draft.businessName.trim()) {
              promotionPatch.businessName = draft.businessName.trim();
            }
            // Promote role to contractor if not already a privileged role
            const currentRole = String((currentUser as any)?.role || "");
            const privilegedRoles = ["admin", "super_admin", "moderator", "support"];
            if (!privilegedRoles.some((r) => currentRole.includes(r))) {
              const currentRoles: string[] = Array.isArray((currentUser as any)?.roles)
                ? (currentUser as any).roles
                : [];
              if (!currentRoles.includes("contractor")) {
                promotionPatch.roles = [...new Set([...currentRoles, "contractor"])];
                if (!currentRole || currentRole === "homeowner") {
                  promotionPatch.role = "contractor";
                  promotionPatch.activeRole = "contractor";
                }
              }
            }
          }

          // Clear the provisional draft now that it has been promoted
          const existingPrefs = (currentUser as any)?.preferences || {};
          const existingProvisional = existingPrefs?.provisional || {};
          const nextPreferences: Record<string, any> = {
            ...existingPrefs,
            provisional: {
              ...existingProvisional,
              profileDraft: undefined,
              promotedAt: new Date().toISOString(),
            },
          };
          if (draft.presenceType === "represent_business") {
            const businessType = String((draft as any)?.businessType || "other");
            const withBusinessOnboarding = ensureBusinessOnboardingState(
              nextPreferences,
              businessType
            );
            promotionPatch.preferences = withBusinessOnboarding;
          } else {
            promotionPatch.preferences = nextPreferences;
          }
        }

        const user = await storage.updateUser(userId, promotionPatch as any);
        res.json(sanitizeUserForResponse(user));
      } catch (error: any) {
        console.error("Error completing onboarding:", error);
        res.status(500).json({ message: "Failed to complete onboarding" });
      }
    }
  );

  // PHASE 3d-A: AI inference for Scout claim suggestion
  app.post("/api/ai/inference", isAuthenticated, aiLimiter, async (req: Request, res: Response) => {
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
      const authUser: any = req.user as any;
      const userId = authUser?.id || authUser?.claims?.sub;
      const { confirmedClaimTypes, countyFips, metadata } = req.body;

      if (!Array.isArray(confirmedClaimTypes) || confirmedClaimTypes.length === 0) {
        return res.status(400).json({ error: "confirmedClaimTypes must be a non-empty array" });
      }

      const requestedCountyFips = typeof countyFips === "string" ? countyFips.trim() : "";
      const fallbackCountyFips =
        typeof authUser?.countyFips === "string"
          ? authUser.countyFips.trim()
          : typeof authUser?.county_fips === "string"
            ? authUser.county_fips.trim()
            : "";
      const normalizedCountyFips = isValidCountyFips(requestedCountyFips)
        ? requestedCountyFips
        : isValidCountyFips(fallbackCountyFips)
          ? fallbackCountyFips
          : null;

      if (!normalizedCountyFips) {
        return res.status(400).json({
          error:
            "countyFips is required to write claims. Complete local setup first so claims route to the correct county.",
          code: "COUNTY_FIPS_REQUIRED",
        });
      }

      // Write each claim individually
      const results = await Promise.all(
        confirmedClaimTypes.map(async (claimType: string) => {
          const writeRequest: WriteClaimEventRequest = {
            userId,
            claimType: claimType as any,
            countyFips: normalizedCountyFips,
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

  app.get("/api/scout/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const query = safeText(req.query.q, 80);
      const surface = scoutConversationSurfaceFilter(req.query.surface);
      const likeQuery = query ? `%${query.toLowerCase().replace(/[%_]/g, "\\$&")}%` : null;
      const baseWhere = and(
        eq(scoutConversations.userId, userId),
        isNull(scoutConversations.archivedAt),
        surface ? scoutConversationSurfaceWhere(surface) : undefined
      );
      const searchWhere = likeQuery
        ? and(
            baseWhere,
            or(
              sql`lower(${scoutConversations.title}) like ${likeQuery} escape '\'`,
              sql`lower(${scoutConversations.preview}) like ${likeQuery} escape '\'`,
              sql`lower(${scoutConversations.summary}) like ${likeQuery} escape '\'`,
              sql`lower(${scoutConversations.intent}) like ${likeQuery} escape '\'`,
              sql`lower(${scoutConversations.metadata}::text) like ${likeQuery} escape '\'`
            )
          )
        : baseWhere;

      const rows = await db
        .select()
        .from(scoutConversations)
        .where(searchWhere)
        .orderBy(desc(scoutConversations.updatedAt))
        .limit(SCOUT_CONVERSATION_LIMIT);
      const refreshedRows = await refreshScoutConversationRelatedLabels(userId, rows);

      res.json({ conversations: refreshedRows.map(scoutConversationPayload) });
    } catch (error: any) {
      console.error("Error loading Scout conversations:", error);
      res.status(500).json({ message: "Failed to load Scout conversations" });
    }
  });

  app.post("/api/scout/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const body: any = req.body ?? {};
      const id = safeScoutConversationId(body.id);
      const messages = compactScoutConversationMessages(body.messages);
      const title = safeText(body.title, 160) || "Scout conversation";
      const preview = safeText(body.preview, 1000);
      const summary = safeText(body.summary, 2000);
      const intent = safeText(body.intent, 80);
      const countyFips = isValidCountyFips(body.countyFips) ? body.countyFips.trim() : null;
      const stateCode = isValidStateCode(body.stateCode)
        ? body.stateCode.trim().toUpperCase()
        : null;
      const messageCount =
        typeof body.messageCount === "number" && Number.isFinite(body.messageCount)
          ? Math.max(0, Math.min(500, Math.floor(body.messageCount)))
          : messages.length;
      const metadata =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : {};
      const now = new Date();

      if (id) {
        const [existingById] = await db
          .select({ id: scoutConversations.id, userId: scoutConversations.userId })
          .from(scoutConversations)
          .where(eq(scoutConversations.id, id))
          .limit(1);

        if (existingById && existingById.userId !== userId) {
          return res.status(403).json({ message: "Scout conversation belongs to another user" });
        }

        if (existingById) {
          const [updated] = await db
            .update(scoutConversations)
            .set({
              title,
              preview,
              summary,
              intent,
              countyFips,
              stateCode,
              messageCount,
              messages,
              metadata,
              archivedAt: null,
              updatedAt: now,
            })
            .where(and(eq(scoutConversations.id, id), eq(scoutConversations.userId, userId)))
            .returning();
          const [refreshed] = await refreshScoutConversationRelatedLabels(userId, [updated]);

          return res.json({ conversation: scoutConversationPayload(refreshed || updated) });
        }
      }

      const [created] = await db
        .insert(scoutConversations)
        .values({
          ...(id ? { id } : {}),
          userId,
          title,
          preview,
          summary,
          intent,
          countyFips,
          stateCode,
          messageCount,
          messages,
          metadata,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const [refreshed] = await refreshScoutConversationRelatedLabels(userId, [created]);

      res.status(201).json({ conversation: scoutConversationPayload(refreshed || created) });
    } catch (error: any) {
      console.error("Error saving Scout conversation:", error);
      res.status(500).json({ message: "Failed to save Scout conversation" });
    }
  });

  app.delete(
    "/api/scout/conversations/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const id = safeScoutConversationId(req.params.id);
        if (!id) return res.status(400).json({ message: "Invalid Scout conversation id" });

        await db
          .delete(scoutConversations)
          .where(and(eq(scoutConversations.id, id), eq(scoutConversations.userId, userId)));

        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error deleting Scout conversation:", error);
        res.status(500).json({ message: "Failed to delete Scout conversation" });
      }
    }
  );

  // Back-compat: mark onboarding completed (do NOT allow arbitrary updates)
  app.patch("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { onboardingCompleted } = (req.body ?? {}) as any;

      if (onboardingCompleted !== true) {
        return res.status(400).json({ message: "Unsupported update" });
      }
      const currentUser = await storage.getUser(userId);
      const draft = (currentUser as any)?.preferences?.provisional?.profileDraft || {};
      const resolvedFirstName = String(
        (currentUser as any)?.firstName || draft?.firstName || ""
      ).trim();
      const resolvedLastName = String(
        (currentUser as any)?.lastName || draft?.lastName || ""
      ).trim();
      const resolvedFullName = String(
        (currentUser as any)?.name ||
          (currentUser as any)?.displayName ||
          draft?.name ||
          draft?.displayName ||
          ""
      ).trim();
      const fullNameParts = resolvedFullName.split(/\s+/).filter(Boolean);
      const effectiveFirstName = resolvedFirstName || fullNameParts[0] || "";
      const effectiveLastName =
        resolvedLastName || (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : "");
      const resolvedPhoneRaw = String((currentUser as any)?.phone || draft?.phone || "").trim();
      const resolvedPhoneDigits = resolvedPhoneRaw.replace(/\D+/g, "");
      const resolvedStateCode = String((currentUser as any)?.stateCode || draft?.stateCode || "")
        .trim()
        .toUpperCase();
      const resolvedCountyFips = String(
        (currentUser as any)?.countyFips || draft?.countyFips || ""
      ).trim();
      const resolvedStartIntent = String(
        (currentUser as any)?.preferences?.startIntent || ""
      ).trim();
      const missing: string[] = [];
      if (!effectiveFirstName) missing.push("name");
      if (resolvedPhoneDigits.length < 10) missing.push("phone");
      if (!/^[A-Z]{2}$/.test(resolvedStateCode)) missing.push("stateCode");
      if (!/^\d{5}$/.test(resolvedCountyFips)) missing.push("countyFips");
      if (!resolvedStartIntent) missing.push("startIntent");
      if (missing.length > 0) {
        return res.status(428).json({
          code: "ONBOARDING_MINIMUM_REQUIRED",
          message:
            "Day-1 onboarding minimum is required before completion: name, phone, location, mode, and intent.",
          missingFields: missing,
        });
      }

      const nextPrefsBase = ((currentUser as any)?.preferences || {}) as Record<string, any>;
      const nextPrefs =
        draft?.presenceType === "represent_business"
          ? ensureBusinessOnboardingState(nextPrefsBase, String(draft?.businessType || "other"))
          : nextPrefsBase;
      const updatedUserPatch: any = {
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        phone: resolvedPhoneRaw,
        stateCode: resolvedStateCode,
        countyFips: resolvedCountyFips,
        locationCommitted: true,
        onboardingCompleted: true,
        profileVersion: CURRENT_PROFILE_VERSION,
        preferences: nextPrefs,
        updatedAt: new Date(),
      };
      const user = await storage.updateUser(userId, updatedUserPatch);

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
      const requestedId = String(req.params.userId || "").trim();
      let resolvedUserId = requestedId;
      let user = resolvedUserId ? await storage.getUser(resolvedUserId) : undefined;

      // Back-compat: some legacy /profile/:id links still pass profile ids.
      // Resolve those to the owning user id so public profile rendering works.
      if (!user && resolvedUserId) {
        try {
          const ownerUserId = await storage.getProfileOwnerUserId(resolvedUserId);
          if (ownerUserId) {
            const ownerUser = await storage.getUser(ownerUserId);
            if (ownerUser) {
              user = ownerUser;
              resolvedUserId = ownerUserId;
            }
          }
        } catch (resolveError) {
          console.warn("[public-profile] profile-id fallback resolution failed", {
            requestedId: resolvedUserId,
            error: resolveError,
          });
        }
      }

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
        profileImageUrl: normalizeProfileImageUrl(user.profileImageUrl),
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
        const presenceType = String(
          (currentUser as any)?.preferences?.provisional?.profileDraft?.presenceType || ""
        ).trim();
        const isBusinessAccount =
          presenceType === "represent_business" ||
          ["contractor", "business_owner", "service_provider", "property_manager"].includes(
            String((currentUser as any)?.role || "")
              .trim()
              .toLowerCase()
          );
        const isBusinessVerifiedForDiscovery =
          (currentUser as any)?.verifiedBadge === true ||
          String((currentUser as any)?.verificationStatus || "")
            .trim()
            .toLowerCase() === "approved" ||
          (currentUser as any)?.licenseVerified === true ||
          (currentUser as any)?.addressVerified === true;

        if (
          profileVisibility === "public" &&
          isBusinessAccount &&
          !isBusinessVerifiedForDiscovery
        ) {
          return res.status(428).json({
            code: "BUSINESS_DISCOVERY_LOCKED",
            message:
              "Business discovery is locked until verification is complete. You can continue setup and requests now, but public visibility stays private.",
            verificationOptional: true,
            discoverabilityLocked: true,
          });
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

        const ensurePublishedActiveProfile = async () => {
          const list = await storage.listProfilesByOwner(userId);
          const activeProfileId = (currentUser as any)?.activeProfileId as string | undefined;
          let targetProfile = activeProfileId
            ? list.find((profile: any) => String(profile?.id || "") === String(activeProfileId))
            : undefined;

          if (!targetProfile) {
            targetProfile = list.find(
              (profile: any) => String(profile?.status || "") === "published"
            );
          }

          if (!targetProfile) {
            targetProfile = list[0];
          }

          if (!targetProfile) {
            const fullName = [currentUser.firstName, currentUser.lastName]
              .filter((value) => typeof value === "string" && value.trim().length > 0)
              .join(" ")
              .trim();
            const emailLocal = String(currentUser.email || "")
              .split("@")[0]
              ?.trim();
            const displayName = fullName || emailLocal || "TradeScout Profile";
            const roleContextRaw = String(
              (currentUser as any)?.activeRole || currentUser.role || "homeowner"
            ).trim();
            const roleContext = roleContextRaw.length >= 2 ? roleContextRaw : "homeowner";

            targetProfile = await storage.createProfileForOwner(userId, {
              ownerUserId: userId as any,
              roleContext: roleContext as any,
              slug: displayName,
              displayName,
              headline: null,
              contentBlocks: [],
              ctaConfig: {},
              seoMeta: {},
              status: "published" as any,
            } as any);
          } else if (String(targetProfile.status || "").toLowerCase() !== "published") {
            targetProfile = await storage.updateProfileForOwner(userId, String(targetProfile.id), {
              status: "published" as any,
            } as any);
          }

          if (
            targetProfile?.id &&
            String((currentUser as any)?.activeProfileId || "") !== String(targetProfile.id)
          ) {
            await storage.setUserActiveProfile(userId, String(targetProfile.id));
          }

          return targetProfile;
        };

        let ensuredProfile: any = null;
        if (profileVisibility === "public") {
          ensuredProfile = await ensurePublishedActiveProfile();
        }

        const currentPrefs = currentUser.preferences || {};
        const updatedPreferences = {
          ...currentPrefs,
          profileVisibility,
          ...(profileVisibility === "private" ? { publicProfileIds: [] } : {}),
        };

        const user = await storage.updateUser(userId, {
          preferences: updatedPreferences,
          updatedAt: new Date(),
        });

        res.json({
          profileVisibility: user.preferences?.profileVisibility,
          profileId: ensuredProfile?.id || null,
          profileSlug: ensuredProfile?.slug || null,
          profileStatus: ensuredProfile?.status || null,
        });
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
      if (normalized.paidBookings && normalized.bookingPriceUsd <= 0) {
        return res.status(400).json({ message: "A booking deposit must be greater than zero" });
      }

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
        const requesterUserId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const requestMessage = normalizeOptionalBookingText(
          (req.body as any)?.requestMessage,
          1000
        );
        const serviceLabel = normalizeOptionalBookingText((req.body as any)?.serviceLabel, 120);
        const timezone =
          typeof (req.body as any)?.timezone === "string"
            ? (req.body as any).timezone.trim().slice(0, 80)
            : null;
        const requestedWindow = validateRequestedBookingWindow(
          (req.body as any)?.requestedStartAt,
          (req.body as any)?.requestedEndAt
        );
        if (!requestedWindow.ok) {
          return res.status(400).json({ message: requestedWindow.message });
        }
        const { requestedStartAt, requestedEndAt } = requestedWindow;
        const deliveryModeRaw = String((req.body as any)?.deliveryMode || "").toLowerCase();
        const deliveryMode =
          deliveryModeRaw === "remote" || deliveryModeRaw === "mobile" ? deliveryModeRaw : "onsite";
        const locationNote = normalizeOptionalBookingText((req.body as any)?.locationNote, 120);
        const rawBookingContext = (req.body as any)?.bookingContext;

        const bookingIdentity = await resolveProfileBookingOwner(storage, req.body);
        if (!bookingIdentity.ok) {
          return res.status(bookingIdentity.status).json({ message: bookingIdentity.message });
        }
        const { ownerUserId, owner } = bookingIdentity;

        if (ownerUserId === requesterUserId) {
          return res
            .status(400)
            .json({ message: "Cannot create booking request for your own profile" });
        }

        const businessProfileSlug = String((req.body as any)?.businessProfileSlug || "")
          .trim()
          .toLowerCase();
        const legacyBusinessProfile =
          !bookingIdentity.profileId && businessProfileSlug
            ? await storage.getBusinessProfileBySlug(businessProfileSlug)
            : null;
        if (
          businessProfileSlug &&
          (!legacyBusinessProfile ||
            legacyBusinessProfile.visibility !== "public" ||
            legacyBusinessProfile.userId !== ownerUserId)
        ) {
          return res.status(404).json({ message: "Profile not available for booking" });
        }
        const bookingProfile = bookingIdentity.profileId
          ? await storage.getProfileById(bookingIdentity.profileId)
          : null;
        const booking = legacyBusinessProfile
          ? normalizeProfileBookingPrefs(legacyBusinessProfile.bookingConfig)
          : resolveProfileBookingConfig(bookingProfile, owner).profileBooking;
        if (!booking.enabled) {
          return res.status(400).json({ message: "Bookings are not enabled on this profile" });
        }
        const depositRequired =
          booking.paidBookings &&
          Number.isFinite(booking.bookingPriceUsd) &&
          booking.bookingPriceUsd > 0;
        const bookingContext = resolveBookingVerificationContext(
          owner,
          rawBookingContext,
          deliveryMode,
          serviceLabel
        );

        const verificationGate = evaluateNotaryPaidRemoteGate({
          owner: {
            verificationStatus: owner.verificationStatus,
            addressVerified: owner.addressVerified,
            role: owner.role,
            roles: owner.roles || [],
            preferences: owner.preferences,
          },
          bookingContext: bookingContext as any,
          paidBooking: depositRequired,
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
          depositRequired,
          depositAmountUsd: depositRequired ? String(booking.bookingPriceUsd.toFixed(2)) : null,
          paymentStatus: depositRequired ? "requires_payment" : "none",
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
                profileId: bookingIdentity.profileId,
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
        const transition = validateProfileBookingStatusTransition(existing.status, nextStatus);
        if (!transition.ok) {
          return res.status(409).json({ message: transition.message });
        }
        if (
          (existing.status === "requested" || transition.idempotent) &&
          (nextStatus === "declined" || nextStatus === "cancelled")
        ) {
          try {
            await refundPaidProfileBookingDeposit({
              stripe: getStripeClient(),
              request: existing,
              updatePaymentState: (patch) =>
                storage.updateProfileBookingRequest(existing.id, patch as any),
            });
          } catch (refundError) {
            console.error(
              "[profile-booking] Could not refund pre-acceptance deposit:",
              refundError
            );
            return res.status(503).json({
              message: "The booking deposit could not be refunded, so the status was not changed",
            });
          }
        }
        if (transition.idempotent) {
          const current = await storage.getProfileBookingRequestById(existing.id);
          return res.json(current || existing);
        }
        if (
          existing.depositRequired &&
          existing.paymentStatus !== "paid" &&
          (nextStatus === "accepted" || nextStatus === "completed")
        ) {
          return res.status(409).json({ message: "Required booking deposit has not been paid" });
        }

        let updated = await storage.updateProfileBookingRequest(id, {
          status: nextStatus as any,
        });
        if (
          existing.status === "requested" &&
          (nextStatus === "declined" || nextStatus === "cancelled")
        ) {
          try {
            await refundPaidProfileBookingDeposit({
              stripe: getStripeClient(),
              request: updated,
              updatePaymentState: (patch) =>
                storage.updateProfileBookingRequest(updated.id, patch as any),
            });
            updated = (await storage.getProfileBookingRequestById(updated.id)) || updated;
          } catch (refundError) {
            console.error(
              "[profile-booking] Status changed but deposit refund is pending:",
              refundError
            );
            return res.status(503).json({
              message: "The booking was closed, but its deposit refund is still pending",
            });
          }
        }

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
          const { token, code, expiresAt } = await passwordResetService.createToken(user.id);
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

        const valid = await passwordResetService.consumeCodeForUser(user.id, normalizedCode);
        if (!valid) {
          return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        const { token } = await passwordResetService.createToken(user.id);
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

      const userId = await passwordResetService.consumeToken(token);

      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const passwordHash = await hashPassword(newPassword);

      await storage.updateUser(userId, {
        password: passwordHash,
        updatedAt: new Date(),
      });

      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        throw new Error("Password reset identity could not be reloaded");
      }

      await establishAuthenticatedSession(req, updatedUser);

      return res.json({
        message: "Password has been reset successfully",
        user: sanitizeUserForResponse(req.user),
      });
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
      const sanitized = contractors.map(sanitizeContractorPublic);
      const viewerUserId =
        ((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim() || null;
      const enriched = await attachConnectionRecommendationCounts(sanitized, viewerUserId);
      res.json(enriched);
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
      const sanitized = contractors.map(sanitizeContractorPublic);
      const viewerUserId =
        ((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim() || null;
      const enriched = await attachConnectionRecommendationCounts(sanitized, viewerUserId);
      res.json(enriched);
    } catch (error: any) {
      console.error("Error searching contractors:", error);
      res.status(500).json({ message: "Failed to search contractors" });
    }
  });

  // Keep both public aliases explicit here; implementation lives in the extracted route module.
  registerProviderSearchRoutes(app, contractorSearchLimiter, [
    "/api/providers/search",
    "/api/business-providers/search",
  ]);

  // Get top contractors in area (for lead assignment)
  app.get(["/api/contractors/top", "/api/business-providers/top"], async (req: any, res: any) => {
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
          const canonicalBusinessProfile = contractor.userId
            ? await storage.getBusinessProfileByUserId(contractor.userId)
            : null;
          const canonicalBusinessProfileSlug =
            canonicalBusinessProfile?.visibility === "public" &&
            typeof canonicalBusinessProfile.slug === "string" &&
            canonicalBusinessProfile.slug.trim()
              ? canonicalBusinessProfile.slug.trim()
              : null;

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
            presenceLabel = "Serves this area Â· building local presence";
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
            canonicalBusinessProfileUrl: canonicalBusinessProfileSlug
              ? `/business/${encodeURIComponent(canonicalBusinessProfileSlug)}`
              : null,
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
      const viewerUserId =
        ((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim() || null;
      const withConnectionCounts = await attachConnectionRecommendationCounts(
        limited,
        viewerUserId
      );
      res.json(withConnectionCounts);
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

      // Public profiles may only publish explicitly approved recommendations.
      // The mapper also removes contact, request, verification, and moderation internals.
      const recommendationRows = await storage.getRecommendations(contractor.id);
      const recommendations = toPublicContractorRecommendations(recommendationRows);
      const ratings = {
        count: recommendations.length,
        average: recommendations.length > 0 ? 5 : 0,
      };
      const ownerUserId = String((contractor as any).userId || "").trim();
      const canonicalBusinessProfile = ownerUserId
        ? await storage.getBusinessProfileByUserId(ownerUserId)
        : null;
      const canonicalBusinessProfileSlug =
        canonicalBusinessProfile?.visibility === "public" &&
        typeof canonicalBusinessProfile.slug === "string" &&
        canonicalBusinessProfile.slug.trim()
          ? canonicalBusinessProfile.slug.trim()
          : null;
      const viewerUserId =
        ((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim() || null;
      const [contractorWithConnectionCount] = await attachConnectionRecommendationCounts(
        [sanitizeContractorPublic(contractor)],
        viewerUserId
      );

      res.json({
        contractor: contractorWithConnectionCount,
        recommendations,
        ratingSummary: ratings,
        canonicalBusinessProfileSlug,
        canonicalBusinessProfileUrl: canonicalBusinessProfileSlug
          ? `/business/${encodeURIComponent(canonicalBusinessProfileSlug)}`
          : null,
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

  // Infer county by city + state, then return canonical county records.
  app.get("/api/counties/infer", async (req: any, res: any) => {
    try {
      const city = typeof req.query?.city === "string" ? req.query.city.trim() : "";
      const stateCode =
        typeof req.query?.state === "string" ? req.query.state.trim().toUpperCase() : "";
      const zipCode = typeof req.query?.zip === "string" ? req.query.zip.trim() : "";

      if (city.length < 2) {
        return res.status(400).json({ message: "city is required" });
      }
      if (!/^[A-Z]{2}$/.test(stateCode)) {
        return res.status(400).json({ message: "valid state code is required" });
      }

      const inferred = await inferCountyFromCityState({ city, stateCode, zipCode });

      const canonicalByFips = new Map<
        string,
        {
          countyFips: string;
          countyName: string;
          stateCode: string;
          cityMatch: boolean;
        }
      >();

      for (const candidate of inferred.candidates) {
        const countyRecord = await storage.getCountyByFips(candidate.countyFips);
        if (!countyRecord) continue;
        if (String(countyRecord.stateCode || "").toUpperCase() !== stateCode) continue;

        const normalized = {
          countyFips: countyRecord.fips,
          countyName: countyRecord.name,
          stateCode: countyRecord.stateCode,
          cityMatch: candidate.cityMatch,
        };

        const existing = canonicalByFips.get(normalized.countyFips);
        if (!existing || (normalized.cityMatch && !existing.cityMatch)) {
          canonicalByFips.set(normalized.countyFips, normalized);
        }
      }

      const candidates = Array.from(canonicalByFips.values()).sort((left, right) => {
        if (left.cityMatch !== right.cityMatch) return left.cityMatch ? -1 : 1;
        return left.countyName.localeCompare(right.countyName);
      });

      let inferredCounty: (typeof candidates)[number] | null = null;
      if (candidates.length === 1) {
        inferredCounty = candidates[0];
      } else {
        const cityMatches = candidates.filter((candidate) => candidate.cityMatch);
        if (cityMatches.length === 1) inferredCounty = cityMatches[0];
      }

      const ambiguous = !inferredCounty && candidates.length > 1;
      const confidence: "high" | "medium" | "low" =
        inferredCounty && candidates.length === 1 ? "high" : inferredCounty ? "medium" : "low";

      return res.json({
        query: { city, stateCode, zipCode: zipCode || undefined },
        inferred: inferredCounty,
        candidates,
        ambiguous,
        confidence,
        source: inferred.source,
        cached: inferred.cached,
      });
    } catch (error: any) {
      console.error("Error inferring county:", error);
      return res.status(500).json({ message: "Failed to infer county" });
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

        let tradeRecord: any = null;
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

  registerAdRoutes(app, { storage, isAuthenticated });

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
        message: `Test notification Â· ${nowIso}`,
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
        profileVersion: CURRENT_PROFILE_VERSION,
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

  registerPublicHeatmapRoutes(app, { storage });

  const mapApiCacheTtlMs = Math.max(0, Number(process.env.MAP_API_CACHE_TTL_MS || 15_000));
  const mapApiResponseCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const mapApiInFlight = new Map<string, Promise<unknown>>();

  const getMapApiPayload = async <T>(req: Request, loader: () => Promise<T>): Promise<T> => {
    const key = req.originalUrl || req.url;
    const now = Date.now();
    const cached = mapApiResponseCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.payload as T;
    }

    const existing = mapApiInFlight.get(key);
    if (existing) {
      return (await existing) as T;
    }

    const pending = loader().then((payload) => {
      if (mapApiCacheTtlMs > 0) {
        mapApiResponseCache.set(key, { expiresAt: Date.now() + mapApiCacheTtlMs, payload });
        if (mapApiResponseCache.size > 200) {
          const oldestKey = mapApiResponseCache.keys().next().value;
          if (oldestKey) mapApiResponseCache.delete(oldestKey);
        }
      }
      return payload;
    });

    mapApiInFlight.set(key, pending);
    try {
      return (await pending) as T;
    } finally {
      mapApiInFlight.delete(key);
    }
  };

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
      const allowAllTypes = requÛÎ:ß¦òµë(š+myÓ°¢–b†Æ–6Vç6U7FGW2bbæW‡DW‡G&2æÆ–6Vç6U÷7FGW2¢æW‡DW‡G&2æÆ–6Vç6U÷7FGW2ÒÆ–6Vç6U7FGW3°¢–b†Æ–6Vç6TW‡—&W4BbbæW‡DW‡G&2æÆ–6Vç6UöW‡—&W5öB¢æW‡DW‡G&2æÆ–6Vç6UöW‡—&W5öBÒÆ–6Vç6TW‡—&W4C°¢òòÇv—2&V6÷&BF†R&W7B¶æ÷vâ7FFR6öFRf÷"6fW"gWGW&RFVGWRà¢–b‡&W6öÇfVE7FFT6öFRbbæW‡DW‡G&2ç7FFUö6öFR¢æW‡DW‡G&2ç7FFUö6öFRÒ&W6öÇfVE7FFT6öFS°¢–b‡7G&VWDFG&W72bbæW‡DW‡G&2æFG&W72’æW‡DW‡G&2æFG&W72Ò7G&VWDFG&W73°¢–b†FG&W73bbæW‡DW‡G&2æFG&W75ó’æW‡DW‡G&2æFG&W75óÒFG&W73°¢–b†FG&W73"bbæW‡DW‡G&2æFG&W75ó"’æW‡DW‡G&2æFG&W75ó"ÒFG&W73#°¢–b†6—G’bbæW‡DW‡G&2æ6—G’’æW‡DW‡G&2æ6—G’Ò6—G“°¢–b‡¦—6öFRbbæW‡DW‡G&2ç¦—ö6öFR’æW‡DW‡G&2ç¦—ö6öFRÒ¦—6öFS°¢f÷"†6öç7B¶²ÂeÒöbö&¦V7BæVçG&–W2†–×÷'DW‡G&2’’°¢–b‚æW‡DW‡G&5¶µÒbbb’æW‡DW‡G&5¶µÒÒ7G&–ær‡b“°¢Ð¢–b††4ÆDÆær’°¢–b‚æW‡DW‡G&2æÆB’æW‡DW‡G&2æÆBÒ7G&–ær†ÆB“°¢–b‚æW‡DW‡G&2æÆær’æW‡DW‡G&2æÆærÒ7G&–ær†Æær“°¢Ð¢–b„ö&¦V7Bæ¶W—2†æW‡DW‡G&2’æÆVæwF‚’æW‡E&öf–ÆRæ–×÷'DW‡G&2ÒæW‡DW‡G&3° ¢–b††4ÆDÆær’°¢–b‚æW‡DW‡G&2æÆB’æW‡DW‡G&2æÆBÒ7G&–ær†ÆB“°¢–b‚æW‡DW‡G&2æÆær’æW‡DW‡G&2æÆærÒ7G&–ær†Æær“°¢Ð ¢v—BF ¢çWFFR†'W6–æW76W2¢ç6WB‡°¢&öf–ÆTFF¢æW‡E&öf–ÆRÀ¢WFFVDC¢æWrFFR‚’À¢Ò2ç’¢çv†W&R†W†'W6–æW76W2æ–BÂ7G&–ær†'W6–æW74–B’’“° ¢v—BF"æW†V7WFR‡7Æ ¢WFFR'W6–æW76W0¢6WB6÷W&6W2Ò€¢6VÆV7B6öÆW66R†§6öæ%övr†F—7F–æ7B6÷W&6U÷fÇVR’ÂuµÒs£¦§6öæ"¢g&öÒ€¢6VÆV7B§6öæ%ö'&•öVÆVÖVçG5÷FW‡B†6öÆW66R†'W6–æW76W2ç6÷W&6W2ÂuµÒs£¦§6öæ"’’26÷W&6U÷fÇVP¢Væ–öâÆÀ¢6VÆV7BG·6÷W&6TÆ&VÇÐ¢’FVGWP¢’À¢WFFVEöBÒæ÷r‚¢v†W&R'W6–æW76W2æ–BÒG¶'W6–æW74–GÐ¢“°¢WFFVEVæ6Æ–ÖVD'W6–æW76W2²³°¢ÒVÇ6R°¢òòÇv—2&V6÷&B7FFR6öFR–ç6–FR–×÷'DW‡G&26ògWGW&RWÆöG26âFVGWR'’7FFP¢òòWfVâv†VâvRFöâwB–WB¶æ÷r6÷VçG’d•2à¢–b‡&W6öÇfVE7FFT6öFRbb–×÷'DW‡G&2ç7FFUö6öFR’°¢–×÷'DW‡G&2ç7FFUö6öFRÒ&W6öÇfVE7FFT6öFS°¢Ð¢–b‡7G&VWDFG&W72bb–×÷'DW‡G&2æFG&W72’–×÷'DW‡G&2æFG&W72Ò7G&VWDFG&W73°¢–b†FG&W73bb–×÷'DW‡G&2æFG&W75ó’–×÷'DW‡G&2æFG&W75óÒFG&W73°¢–b†FG&W73"bb–×÷'DW‡G&2æFG&W75ó"’–×÷'DW‡G&2æFG&W75ó"ÒFG&W73#°¢–b†6—G’bb–×÷'DW‡G&2æ6—G’’–×÷'DW‡G&2æ6—G’Ò6—G“°¢–b†FVGWT¶W’bb–×÷'DW‡G&2æFVGWUö¶W’’°¢–×÷'DW‡G&2æFVGWUö¶W’ÒFVGWT¶W“°¢Ð¢–b†W‡FW&æÄ–Bbb–×÷'DW‡G&2æW‡FW&æÅö–B¢–×÷'DW‡G&2æW‡FW&æÅö–BÒW‡FW&æÄ–C°¢–b†Æ–6Vç6TçVÖ&W"bb–×÷'DW‡G&2æÆ–6Vç6UöçVÖ&W"¢–×÷'DW‡G&2æÆ–6Vç6UöçVÖ&W"ÒÆ–6Vç6TçVÖ&W#°¢–b†Æ–6Vç6U7FGW2bb–×÷'DW‡G&2æÆ–6Vç6U÷7FGW2¢–×÷'DW‡G&2æÆ–6Vç6U÷7FGW2ÒÆ–6Vç6U7FGW3°¢–b†Æ–6Vç6TW‡—&W4Bbb–×÷'DW‡G&2æÆ–6Vç6UöW‡—&W5öB¢–×÷'DW‡G&2æÆ–6Vç6UöW‡—&W5öBÒÆ–6Vç6TW‡—&W4C°¢–b††4ÆDÆær’°¢–b‚–×÷'DW‡G&2æÆB’–×÷'DW‡G&2æÆBÒ7G&–ær†ÆB“°¢–b‚–×÷'DW‡G&2æÆær’–×÷'DW‡G&2æÆærÒ7G&–ær†Æær“°¢Ð¢6öç7B–æfW'&VE¦—Ð¢–æfW%¦—g&öÔÆö÷6TFG&W72†×Væ’’ÇÂ–æfW%¦—g&öÔÆö÷6TFG&W72†gVÆÆFG"“°¢–b†–æfW'&VE¦—bb–×÷'DW‡G&2ç¦—ö6öFR’°¢–×÷'DW‡G&2ç¦—ö6öFRÒ–æfW'&VE¦—°¢Ð ¢6öç7B7&VFVD&—¢Òv—B7F÷&vRæ7&VFUVæ6Æ–ÖVD'W6–æW72‡°¢æÖS¢'W6–æW74æÖRÀ¢6ÇVs¢'W6–æW74æÖRÀ¢G—S¢–æfW'&VD'W6–æW75G—R2ç’À¢&öÆT6öçFW‡C¢–æfW'&VE&öÆT6öçFW‡B2ç’À¢&öf–ÆTFF¢°¢6FVv÷'“¢6FVv÷'’ÇÂVæFVf–æVBÀ¢6W'f–6W3¢6W'f–6W2æÆVæwF‚ò6W'f–6W2¢VæFVf–æVBÀ¢vV'6—FS¢vV'6—FRÇÂVæFVf–æVBÀ¢†öæS¢†öæRÇÂVæFVf–æVBÀ¢VÖ–Ã¢VÖ–ÂÇÂVæFVf–æVBÀ¢FG&W73¢‡7G&VWDFG&W72ÇÂ""’çG&–Ò‚’ÇÂVæFVf–æVBÀ¢6—G“¢6—G’ÇÂVæFVf–æVBÀ¢7FFT6öFS¢&W6öÇfVE7FFT6öFRÇÂVæFVf–æVBÀ¢¦—6öFS¢¦—6öFRÇÂVæFVf–æVBÀ¢–×÷'DW‡G&3¢ö&¦V7Bæ¶W—2†–×÷'DW‡G&2’æÆVæwF‚ò–×÷'DW‡G&2¢VæFVf–æVBÀ¢ÒÀ¢6÷W&6W3¢·6÷W&6TÆ&VÅÒÀ¢7FGW3¢&7F—fR"2ç’À¢6÷VçG”–G2À¢Ò2ç’“°¢'W6–æW74–BÒ7&VFVD&—¢æ–C°¢7&VFVEVæ6Æ–ÖVD'W6–æW76W2²³°¢Ð¢Ð¢Ð ¢òò7F—fF–öã¢vVæW&FR77v÷&B&W6WBFö¶VâæB÷F–öæÆÇ’VÖ–Â—B†öæÇ’v†VâW6W"W†—7G2¢ÆWB7F—fF–öäÆ–æ³¢7G&–ærÂVæFVf–æVC°¢–b‚G'•'VâbbW6W$–BbbW6W$–BÓÒ%õöG'•÷'Våõò"’°¢6öç7B²Fö¶VâÂW‡—&W4BÒÒv—B77v÷&E&W6WE6W'f–6Ræ7&VFUFö¶Vâ‡W6W$–B“°¢7F—fF–öå&W&VB²³°¢6öç7B&W6WDÆ–æ²ÒG·&W6WD&6Rç&WÆ6R‚õÂòBòÂ""—Ò÷&W6WB×77v÷&C÷Fö¶VãÒG·Fö¶VçÖ° ¢–b‡6VæD7F—fF–öäVÖ–Ç4VffV7F—fRbbVÖ–Å6W'f–6Ræ—46öæf–wW&VB‚’’°¢6öç7BVÖ–ÅfW&–f–6F–öå&WV—&VBÒv—BvWDvVæW&Å6WGF–æsÆ&ööÆVãâ€¢&VÖ–Å÷fW&–f–6F–öå÷&WV—&VB"À¢G'VP¢“°¢ÆWBfW&–g”Æ–æ³¢7G&–ærÂçVÆÂÒçVÆÃ°¢–b†VÖ–ÅfW&–f–6F–öå&WV—&VB’°¢6öç7BfW&–g’Òv—BVÖ–ÅfW&–f–6F–öå6W'f–6Ræ7&VFUFö¶Vâ‡W6W$–B“°¢6öç7BfW&–g”&6RÒvWEV&Æ–4&6UW&Äg&öÕ&WVW7B‡&W2ç’“°¢fW&–g”Æ–æ²ÒG·fW&–g”&6Rç&WÆ6R‚õÂòBòÂ""—Ò÷fW&–g’ÖVÖ–Ã÷Fö¶VãÒG·fW&–g’çFö¶VçÒfæW‡CÒG¶Væ6öFUU$”6ö×öæVçB‚"÷&R×66÷WB×6WGW"—Ö°¢Ð ¢v—BVÖ–Å6W'f–6Rç6VæDVÖ–Â‡°¢Fó¢VÖ–ÂÀ¢7V&¦V7C¢$6Æ–Ò–÷W"G&FU66÷WB'W6–æW7266÷VçB"À¢‡FÖÃ¢Çå–÷W"'W6–æW7266÷VçB†2&VVâ7&VFVB–âG&FU66÷WBãÂ÷à£ÇãÆ‡&VcÒ"G·&W6WDÆ–æ·Ò#å6WB–÷W"77v÷&CÂöâFò6Æ–Ò–÷W"66÷VçBâF†—2Æ–æ²W‡—&W2–âG´ÖF‚ç&÷VæB‚†W‡—&W4BÒFFRææ÷r‚’’òc—ÒÖ–çWFW2ãÂ÷à¢G·fW&–g”Æ–æ²òÇãÆ‡&VcÒ"G·fW&–g”Æ–æ·Ò#åfW&–g’×’VÖ–ÃÂöâ‡&WV—&VB“Â÷æ¢"'Ð£ÇägFW"–÷R6–vâ–âÂ–÷R6âf–æ—6‚–÷W"&öf–ÆRæB6ö×ÆWFR–ç7W&æ6RöÆ–6Vç6RfW&–f–6F–öâãÂ÷æÀ¢FW‡C¢6WB–÷W"77v÷&C¢G·&W6WDÆ–æ·ÖÀ¢W'÷6S¢&7F—fF–öâ"À¢Ò“°¢7F—fF–öäVÖ–ÆVB²³°¢ÒVÇ6R–b†–æ6ÇVFT7F—fF–öäÆ–æ·4VffV7F—fRbbÆÆ÷t7F—fF–öäÆ–æ´W‡÷'B’°¢7F—fF–öäÆ–æ²Ò&W6WDÆ–æ³°¢Ð¢Ð ¢&W7VÇG2çW6‚‡°¢ââç&÷u&VbÀ¢7FGW3¢G'•'Vâò&G'•÷'Vâ"¢&ö²"À¢W6W$–C¢G'•'VâòçVÆÂ¢W6W$–BÀ¢'W6–æW74–BÀ¢&öf–ÆU6ÇVrÀ¢V&Æ–5&öf–ÆU6ÇVrÀ¢7F—fF–öäÆ–æ²À¢Ò“°¢Ò6F6‚†S¢ç’’°¢&W7VÇG2çW6‚‡°¢ââç&÷u&VbÀ¢7FGW3¢&W'&÷""À¢W'&÷#¢SòæÖW76vRÇÂ$–×÷'Bf–ÆVB"À¢Ò“°¢Ð¢Ð ¢&W2æ§6öâ‡°¢G'•'VâÀ¢FVÆ–Ö—FW#¢FVÆ–Ö—FW"ÓÓÒ%ÇB"ò'F""¢FVÆ–Ö—FW"ÓÓÒ'Â"ò'—R"¢&6öÖÖ"À¢'6S¢Æ7E'6TÖWFÀ¢'6Tf–ÆRÀ¢v&æ–æw3 ¢&WVW7FVD7&VFT÷væW$66÷VçG2bb7&VFT÷væW$66÷VçG0¢ò°¢v7&VFT÷væW$66÷VçG2v2&WVW7FVB'WB–væ÷&VBâFò7&VFR&VÂW6W"66÷VçG2Â6WB6öæf—&Ô7&VFUW6W'3Ò$5$TDUõU4U%2"ârÀ¢Ð¢¢µÒÀ¢F÷FÇ3¢°¢&÷w3¢&V6÷&G2æÆVæwF‚À¢7&VFVEW6W'2À¢WFFVEW6W'2À¢7&VFVD'W6–æW76W2À¢WFFVD'W6–æW76W2À¢7&VFVEVæ6Æ–ÖVD'W6–æW76W2À¢WFFVEVæ6Æ–ÖVD'W6–æW76W2À¢7&VFVEV&Æ–5&öf–ÆW2À¢7F—fF–öå&W&VBÀ¢7F—fF–öäVÖ–ÆVBÀ¢ÒÀ¢7F—fF–öäÆ–æ´W‡÷'C¢°¢&WVW7FVC¢–æ6ÇVFT7F—fF–öäÆ–æ·4VffV7F—fRÀ¢ÆÆ÷vVC¢–æ6ÇVFT7F—fF–öäÆ–æ·4VffV7F—fRbbÆÆ÷t7F—fF–öäÆ–æ´W‡÷'BÀ¢&V6öã ¢–æ6ÇVFT7F—fF–öäÆ–æ·4VffV7F—fRbbÆÆ÷t7F—fF–öäÆ–æ´W‡÷'@¢ò$7F—fF–öâÆ–æ²W‡÷'B—2F—6&ÆVB–â&öGV7F–öââ6WBDÔ”åôÄÄõuô5D•dD”ôåôÄ”äµôU…õ%C×G'VRFòÆÆ÷râ ¢¢çVÆÂÀ¢ÒÀ¢&W7VÇG2À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"–×÷'F–ær'W6–æW76W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡°¢ÖW76vS¢$f–ÆVBFò–×÷'B'W6–æW76W2"À¢&WVW7D–C¢‡&W2ç’’ç&WVW7D–BÇÂçVÆÂÀ¢Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢f–æB&–×÷'BÖ7&VFVB"F—&V7F÷'’÷væW"66÷VçG26òF†W’6â&R&6†—fVB–çFòVæ6Æ–ÖVB'W6–æW76W2à¢òòF†W6R66÷VçG2vW&R7&VFVB&Vf÷&RvRFVfVÇFVB–×÷'G2Fò&F—&V7F÷'’VçG&–W2öæÇ’"†æòWF‚W6W'2’à¢6öç7B&6†—fT–×÷'FVDF—&V7F÷'•W6W%FôF—&V7F÷'’Ò7–æ2‡W6W$–C¢7G&–ær’Óâ°¢6öç7B–BÒ7G&–ær‡W6W$–BÇÂ""’çG&–Ò‚“°¢–b‚–B’F‡&÷r²7FGW3¢CÂÖW76vS¢'W6W$–B—2&WV—&VB"Ó° ¢6öç7B&÷w2Òv—BF"ç6VÆV7B‚’æg&öÒ‡W6W'2’çv†W&R†W‡W6W'2æ–BÂ–B’’æÆ–Ö—Bƒ“°¢6öç7BW6W"Ò&÷w5³Ò2ç“°¢–b‚W6W"’F‡&÷r²7FGW3¢CBÂÖW76vS¢%W6W"æ÷Bf÷VæB"Ó° ¢6öç7B&öÆW3¢7G&–æuµÒÒ'&’æ—4'&’‡W6W"ç&öÆW2’òW6W"ç&öÆW2æÖ‚‡#¢ç’’Óâ7G&–ær‡"’’¢µÓ°¢6öç7BÇ&VG”&6†—fVDVÖ–ÂÒ7G&–ær‡W6W"æVÖ–ÂÇÂ""¢çFôÆ÷vW$66R‚¢ç7F'G5v—F‚‚&&6†—fVB²"“°¢6öç7B—46æF–FFRÐ¢W6W"æöæ&ö&F–æt6ö×ÆWFVBÓÓÒfÇ6Rb`¢‡W6W"ç77v÷&BÓÒçVÆÂÇÂW6W"ç77v÷&BÓÓÒ""’b`¢‡&öÆW2æ–æ6ÇVFW2‚&'W6–æW75ö÷væW""’ÇÂ7G&–ær‡W6W"ç&öÆRÇÂ""’ÓÓÒ&'W6–æW75ö÷væW""“° ¢–b‚—46æF–FFR’°¢òò–FV×÷FVçB6ÆVçW&V†f–÷#¢–bF†—2W6W"v2Ç&VG’&6†—fVB'’F†—2fÆ÷rÂ&WGW&â7V66W72à¢–b€¢Ç&VG”&6†—fVDVÖ–Âb`¢7G&–ær‚‡W6W"ç&VfW&Væ6W22ç’“òæ&6†—fVE&V6öâÇÂ""’ÓÓÒ&FÖ–åö–×÷'Eö6ÆVçW ¢’°¢&WGW&â°¢W6W$–C¢–BÀ¢&6†—fVDVÖ–Ã¢7G&–ær‡W6W"æVÖ–ÂÇÂ""’À¢F—&V7F÷'”'W6–æW74–C¢7G&–ær‚‡W6W"ç&VfW&Væ6W22ç’“òæ&6†—fVDF—&V7F÷'”'W6–æW74–BÇÂ""’À¢F—&V7F÷'”'W6–æW756ÇVs¢çVÆÂÀ¢F—&V7F÷'”'W6–æW74æÖS¢çVÆÂÀ¢Ç&VG”&6†—fVC¢G'VRÀ¢Ó°¢Ð¢F‡&÷r°¢7FGW3¢CÀ¢ÖW76vS ¢%W6W"FöW2æ÷BÖF6‚–×÷'BÖ6ÆVçW†WW&—7F–72†×W7B&RâVæ6Æ–ÖVB–×÷'B×7G–ÆR'W6–æW75ö÷væW"66÷VçB’â"À¢Ó°¢Ð ¢6öç7B÷&–v–æÄVÖ–ÂÒ7G&–ær‡W6W"æVÖ–ÂÇÂ""’çG&–Ò‚“°¢6öç7B÷&–v–æÅ†öæRÒG—VöbW6W"ç†öæRÓÓÒ'7G&–ær"òW6W"ç†öæR¢çVÆÃ°¢6öç7B&6†—fVDVÖ–ÂÒ&6†—fVB²G¶–GÔF†WG&FW66÷WBæ–çfÆ–F° ¢6öç7B6ÇVv–g’Ò‡FW‡C¢7G&–ær“¢7G&–ærÓà¢7G&–ær‡FW‡BÇÂ""¢çFôÆ÷vW$66R‚¢çG&–Ò‚¢ç&WÆ6R‚õµåÇuÇ2ÕÒörÂ""¢ç&WÆ6R‚õµÇ5òÕÒ²örÂ"Ò"¢ç&WÆ6R‚õâÒ·ÂÒ²BörÂ""¢ç6Æ–6RƒÂƒ“° ¢6öç7Bæ÷rÒæWrFFR‚“°¢&WGW&âF"çG&ç67F–öâ†7–æ2‡G‚’Óâ°¢òò&VfW"FòFWF6‚âW†—7F–ær÷væVB'W6–æW72†7&VFVBGW&–ærF†RöÆB–×÷'BfÆ÷r¢òò6òvRFöâwBGWÆ–6FRF—&V7F÷'’VçG&–W2à¢6öç7B÷væVD&—¥&÷w2Òv—BG€¢ç6VÆV7B‡°¢–C¢'W6–æW76W2æ–BÀ¢æÖS¢'W6–æW76W2ææÖRÀ¢6ÇVs¢'W6–æW76W2ç6ÇVrÀ¢&öf–ÆTFF¢'W6–æW76W2ç&öf–ÆTFFÀ¢6÷W&6W3¢'W6–æW76W2ç6÷W&6W2À¢7FGW3¢'W6–æW76W2ç7FGW2À¢&öÆT6öçFW‡C¢'W6–æW76W2ç&öÆT6öçFW‡BÀ¢G—S¢'W6–æW76W2çG—RÀ¢7&VFVDC¢'W6–æW76W2æ7&VFVDBÀ¢Ò¢æg&öÒ†'W6–æW76W2¢çv†W&R†W†'W6–æW76W2æ÷væW%W6W$–BÂ–B’¢æ÷&FW$'’†FW62†'W6–æW76W2æ7&VFVDB’¢æÆ–Ö—Bƒ“° ¢ÆWBF—&V7F÷'”'W6–æW74–C¢7G&–ærÂçVÆÂÒçVÆÃ°¢ÆWBF—&V7F÷'”'W6–æW756ÇVs¢7G&–ærÂçVÆÂÒçVÆÃ°¢ÆWBF—&V7F÷'”'W6–æW74æÖS¢7G&–ærÂçVÆÂÒçVÆÃ° ¢–b†÷væVD&—¥&÷w2æÆVæwF‚â’°¢6öç7B&—¢Ò÷væVD&—¥&÷w5³Ò2ç“°¢F—&V7F÷'”'W6–æW74–BÒ7G&–ær†&—¢æ–B“°¢F—&V7F÷'”'W6–æW756ÇVrÒ7G&–ær†&—¢ç6ÇVr“°¢F—&V7F÷'”'W6–æW74æÖRÒ7G&–ær†&—¢ææÖR“° ¢6öç7BW†—7F–æu&öf–ÆS¢ç’Ò&—¢ç&öf–ÆTFFÇÂ·Ó°¢6öç7BW†—7F–ætW‡G&3¢ç’Ð¢W†—7F–æu&öf–ÆRbbG—VöbW†—7F–æu&öf–ÆRÓÓÒ&ö&¦V7B ¢òW†—7F–æu&öf–ÆRæ–×÷'DW‡G&0¢¢çVÆÃ° ¢6öç7BæW‡DW‡G&3¢&V6÷&CÇ7G&–ærÂ7G&–æsâÒ°¢âââ†W†—7F–ætW‡G&2bbG—VöbW†—7F–ætW‡G&2ÓÓÒ&ö&¦V7B"òW†—7F–ætW‡G&2¢·Ò’À¢&6†—fVEög&öÕ÷W6W%ö–C¢–BÀ¢&6†—fVEög&öÕ÷W6W%öVÖ–Ã¢÷&–v–æÄVÖ–ÂÀ¢âââ†÷&–v–æÅ†öæRò²&6†—fVEög&öÕ÷W6W%÷†öæS¢7G&–ær†÷&–v–æÅ†öæR’Ò¢·Ò’À¢Ó° ¢6öç7BæW‡E&öf–ÆTFF¢ç’Ò°¢ââæW†—7F–æu&öf–ÆRÀ¢òò&W6W'fR÷&–v–æÂ6öçF7Bf–VÆG26òfW&–f–VBG&FU66÷WBW6W'26â&V6‚F†—2'W6–æW70¢òòf–F†R–çFVçBÖvFVB&WfVÂfÆ÷rWfVâ&Vf÷&R—B—26Æ–ÖVBà¢âââ†÷&–v–æÄVÖ–Âò²VÖ–Ã¢÷&–v–æÄVÖ–ÂÒ¢·Ò’À¢âââ†÷&–v–æÅ†öæRò²†öæS¢÷&–v–æÅ†öæRÒ¢·Ò’À¢–×÷'DW‡G&3¢æW‡DW‡G&2À¢Ó° ¢6öç7B7W'&VçE6÷W&6W3¢7G&–æuµÒÒ'&’æ—4'&’†&—¢ç6÷W&6W2¢ò&—¢ç6÷W&6W2æÖ‚‡3¢ç’’Óâ7G&–ær‡2’’æf–ÇFW"„&ööÆVâ¢¢µÓ°¢6öç7BæW‡E6÷W&6W2Ò'&’æg&öÒ†æWr6WB…²ââæ7W'&VçE6÷W&6W2Â&FÖ–åö–×÷'Eö6ÆVçW%Ò’“° ¢G'’°¢v—BG€¢çWFFR†'W6–æW76W2¢ç6WB‡°¢÷væW%W6W$–C¢çVÆÂÀ¢6Æ–Õ7FGW3¢'Væ6Æ–ÖVB"2ç’À¢&öf–ÆTFF¢æW‡E&öf–ÆTFFÀ¢6÷W&6W3¢æW‡E6÷W&6W22ç’À¢WFFVDC¢æ÷rÀ¢Ò2ç’¢çv†W&R†W†'W6–æW76W2æ–BÂF—&V7F÷'”'W6–æW74–B’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç7B—4Ö—76–æt6Æ–Õ7FGW46öÇVÖâÐ¢7G&–ær†W'&÷#òæ6öFRÇÂ""’ÓÓÒ#C#s2"b`¢7G&–ær†W'&÷#òæÖW76vRÇÂ""¢çFôÆ÷vW$66R‚¢æ–æ6ÇVFW2‚&6Æ–Õ÷7FGW2"“°¢–b‚—4Ö—76–æt6Æ–Õ7FGW46öÇVÖâ’F‡&÷rW'&÷#° ¢v—BG€¢çWFFR†'W6–æW76W2¢ç6WB‡°¢÷væW%W6W$–C¢çVÆÂÀ¢&öf–ÆTFF¢æW‡E&öf–ÆTFFÀ¢6÷W&6W3¢æW‡E6÷W&6W22ç’À¢WFFVDC¢æ÷rÀ¢Ò2ç’¢çv†W&R†W†'W6–æW76W2æ–BÂF—&V7F÷'”'W6–æW74–B’“°¢Ð¢ÒVÇ6R°¢òòfÆÆ&6³¢7&VFRF—&V7F÷'’'W6–æW72–bF†R–×÷'BÖ7&VFVBW6W"†2æò÷væVB'W6–æW72à¢6öç7B&6TæÖRÐ¢7G&–ær‡W6W"æ'W6–æW756ÇVrÇÂ""’çG&–Ò‚’ÇÀ¢7G&–ær‡W6W"æf—'7DæÖRÇÂ""’çG&–Ò‚’ÇÀ¢†÷&–v–æÄVÖ–Âæ–æ6ÇVFW2‚$"’ò÷&–v–æÄVÖ–Âç7Æ—B‚$"•³Ò¢""’ÇÀ¢'W6–æW72ÒG¶–Bç6Æ–6RƒÂ‚—Ö° ¢6öç7B&6U6ÇVrÒ6ÇVv–g’†&6TæÖR’ÇÂ'W6–æW72ÒG¶–Bç6Æ–6RƒÂ‚—Ö°¢ÆWB6æF–FFU6ÇVrÒ&6U6ÇVs°¢f÷"†ÆWBGFV×BÒ²GFV×BÂS²GFV×B²²’°¢6öç7BW†—7F–ærÒv—BG€¢ç6VÆV7B‡²–C¢'W6–æW76W2æ–BÒ¢æg&öÒ†'W6–æW76W2¢çv†W&R†W†'W6–æW76W2ç6ÇVrÂ6æF–FFU6ÇVr’¢æÆ–Ö—Bƒ“°¢–b‚W†—7F–æræÆVæwF‚’'&V³°¢6æF–FFU6ÇVrÒG¶&6U6ÇVwÒÒG¶GFV×B²'Ö°¢Ð ¢ÆWB–ç6W'FVC¢ç•µÒÒµÓ°¢G'’°¢–ç6W'FVBÒv—BG€¢æ–ç6W'B†'W6–æW76W2¢çfÇVW2‡°¢æÖS¢7G&–ær†&6TæÖR’ç6Æ–6RƒÂ#SR’À¢6ÇVs¢6æF–FFU6ÇVrÀ¢G—S¢&÷F†W""2ç’À¢÷væW%W6W$–C¢çVÆÂÀ¢&öÆT6öçFW‡C¢&'W6–æW75ö÷væW""2ç’À¢6Æ–Õ7FGW3¢'Væ6Æ–ÖVB"2ç’À¢6÷W&6W3¢²&FÖ–åö–×÷'Eö6ÆVçW%Ò2ç’À¢7FGW3¢&G&gB"2ç’À¢&öf–ÆTFF¢°¢âââ†÷&–v–æÄVÖ–Âò²VÖ–Ã¢÷&–v–æÄVÖ–ÂÒ¢·Ò’À¢âââ†÷&–v–æÅ†öæRò²†öæS¢÷&–v–æÅ†öæRÒ¢·Ò’À¢–×÷'DW‡G&3¢°¢&6†—fVEög&öÕ÷W6W%ö–C¢–BÀ¢&6†—fVEög&öÕ÷W6W%öVÖ–Ã¢÷&–v–æÄVÖ–ÂÀ¢âââ†÷&–v–æÅ†öæRò²&6†—fVEög&öÕ÷W6W%÷†öæS¢7G&–ær†÷&–v–æÅ†öæR’Ò¢·Ò’À¢ÒÀ¢Ò2ç’À¢7&VFVDC¢æ÷rÀ¢WFFVDC¢æ÷rÀ¢Ò2ç’¢ç&WGW&æ–ær‚“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç7B—4Ö—76–æt6Æ–Õ7FGW46öÇVÖâÐ¢7G&–ær†W'&÷#òæ6öFRÇÂ""’ÓÓÒ#C#s2"b`¢7G&–ær†W'&÷#òæÖW76vRÇÂ""¢çFôÆ÷vW$66R‚¢æ–æ6ÇVFW2‚&6Æ–Õ÷7FGW2"“°¢–b‚—4Ö—76–æt6Æ–Õ7FGW46öÇVÖâ’F‡&÷rW'&÷#° ¢–ç6W'FVBÒv—BG€¢æ–ç6W'B†'W6–æW76W2¢çfÇVW2‡°¢æÖS¢7G&–ær†&6TæÖR’ç6Æ–6RƒÂ#SR’À¢6ÇVs¢6æF–FFU6ÇVrÀ¢G—S¢&÷F†W""2ç’À¢÷væW%W6W$–C¢çVÆÂÀ¢&öÆT6öçFW‡C¢&'W6–æW75ö÷væW""2ç’À¢6÷W&6W3¢²&FÖ–åö–×÷'Eö6ÆVçW%Ò2ç’À¢7FGW3¢&G&gB"2ç’À¢&öf–ÆTFF¢°¢âââ†÷&–v–æÄVÖ–Âò²VÖ–Ã¢÷&–v–æÄVÖ–ÂÒ¢·Ò’À¢âââ†÷&–v–æÅ†öæRò²†öæS¢÷&–v–æÅ†öæRÒ¢·Ò’À¢–×÷'DW‡G&3¢°¢&6†—fVEög&öÕ÷W6W%ö–C¢–BÀ¢&6†—fVEög&öÕ÷W6W%öVÖ–Ã¢÷&–v–æÄVÖ–ÂÀ¢âââ†÷&–v–æÅ†öæRò²&6†—fVEög&öÕ÷W6W%÷†öæS¢7G&–ær†÷&–v–æÅ†öæR’Ò¢·Ò’À¢ÒÀ¢Ò2ç’À¢7&VFVDC¢æ÷rÀ¢WFFVDC¢æ÷rÀ¢Ò2ç’¢ç&WGW&æ–ær‚“°¢Ð ¢6öç7B7&VFVD&—¢Ò–ç6W'FVE³Ò2ç“°¢F—&V7F÷'”'W6–æW74–BÒ7&VFVD&—£òæ–Bò7G&–ær†7&VFVD&—¢æ–B’¢çVÆÃ°¢F—&V7F÷'”'W6–æW756ÇVrÒ7&VFVD&—£òç6ÇVrò7G&–ær†7&VFVD&—¢ç6ÇVr’¢çVÆÃ°¢F—&V7F÷'”'W6–æW74æÖRÒ7&VFVD&—£òææÖRò7G&–ær†7&VFVD&—¢ææÖR’¢çVÆÃ°¢Ð ¢6öç7BæW‡E&VfW&Væ6W3¢ç’Ð¢W6W"ç&VfW&Væ6W2bbG—VöbW6W"ç&VfW&Væ6W2ÓÓÒ&ö&¦V7B"ò²ââçW6W"ç&VfW&Væ6W2Ò¢·Ó°¢æW‡E&VfW&Væ6W2æ&6†—fVDVÖ–ÂÒ÷&–v–æÄVÖ–ÂÇÂçVÆÃ°¢æW‡E&VfW&Væ6W2æ&6†—fVDBÒæ÷rçFô•4õ7G&–ær‚“°¢æW‡E&VfW&Væ6W2æ&6†—fVE&V6öâÒ&FÖ–åö–×÷'Eö6ÆVçW#°¢æW‡E&VfW&Væ6W2æ&6†—fVDF—&V7F÷'”'W6–æW74–BÒF—&V7F÷'”'W6–æW74–C° ¢6öç7BæW‡E&öÆW2Ò&öÆW2æf–ÇFW"‚‡"’Óâ"ÓÒ&'W6–æW75ö÷væW""“° ¢v—BG€¢çWFFR‡W6W'2¢ç6WB‡°¢VÖ–Ã¢&6†—fVDVÖ–ÂÀ¢77v÷&C¢çVÆÂÀ¢†öæS¢çVÆÂÀ¢&öÆW3¢æW‡E&öÆW22ç’À¢&öÆS¢&†öÖV÷væW""2ç’À¢7F—fU&öÆS¢&†öÖV÷væW""À¢7F—fT'W6–æW74–C¢çVÆÂÀ¢7F—fU&öf–ÆT–C¢çVÆÂÀ¢'W6–æW756ÇVs¢çVÆÂÀ¢&VfW&Væ6W3¢æW‡E&VfW&Væ6W2À¢WFFVDC¢æ÷rÀ¢Ò2ç’¢çv†W&R†W‡W6W'2æ–BÂ–B’“° ¢&WGW&â°¢W6W$–C¢–BÀ¢&6†—fVDVÖ–ÂÀ¢F—&V7F÷'”'W6–æW74–BÀ¢F—&V7F÷'”'W6–æW756ÇVrÀ¢F—&V7F÷'”'W6–æW74æÖRÀ¢Ó°¢Ò“°¢Ó° ¢ævWB€¢"ö’öFÖ–âö–×÷'FVBÖF—&V7F÷'’×W6W'2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BÆ–Ö—E&rÐ¢G—Vöb‡&WçVW'’2ç’“òæÆ–Ö—BÓÓÒ'7G&–ær"ò7G&–ær‚‡&WçVW'’2ç’’æÆ–Ö—B’¢"#°¢6öç7B'6VDÆ–Ö—BÒÆ–Ö—E&rò'6T–çB†Æ–Ö—E&rÂ’¢#°¢6öç7BÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR‡'6VDÆ–Ö—B¢òÖF‚æÖ‚ƒSÂÖF‚æÖ–âƒ#Â'6VDÆ–Ö—B’¢¢#° ¢6öç7B&W7VÇBÒ†v—BF"æW†V7WFR‡7Æ ¢6VÆV7@¢Ræ–BÀ¢RæVÖ–ÂÀ¢Ræf—'7EöæÖR2&f—'7DæÖR"À¢RæÆ7EöæÖR2&Æ7DæÖR"À¢Rç†öæRÀ¢Rç&öÆRÀ¢Rç&öÆW2À¢Ræöæ&ö&F–æuö6ö×ÆWFVB2&öæ&ö&F–æt6ö×ÆWFVB"À¢RæVÖ–Å÷fW&–f–VB2&VÖ–ÅfW&–f–VB"À¢Ræ7F—fUö'W6–æW75ö–B2&7F—fT'W6–æW74–B"À¢Ræ7F—fU÷&öf–ÆUö–B2&7F—fU&öf–ÆT–B"À¢Ræ'W6–æW75÷6ÇVr2&'W6–æW756ÇVr"À¢Ræ7&VFVEöB2&7&VFVDB"À¢RçWFFVEöB2'WFFVDB"À¢€¢6VÆV7B"æ–@¢g&öÒ'W6–æW76W2 ¢v†W&R"æ÷væW%÷W6W%ö–BÒRæ–@¢÷&FW"'’"æ7&VFVEöBFW60¢Æ–Ö—B¢’2&÷væVD'W6–æW74–B"À¢€¢6VÆV7B"ç6ÇVp¢g&öÒ'W6–æW76W2 ¢v†W&R"æ÷væW%÷W6W%ö–BÒRæ–@¢÷&FW"'’"æ7&VFVEöBFW60¢Æ–Ö—B¢’2&÷væVD'W6–æW756ÇVr ¢g&öÒW6W'2P¢v†W&RRæöæ&ö&F–æuö6ö×ÆWFVBÒfÇ6P¢æBRç77v÷&Eö†6‚—2çVÆÀ¢æB€¢v'W6–æW75ö÷væW"rÒç’‡Rç&öÆW2¢÷"Rç&öÆRÒv'W6–æW75ö÷væW"p¢¢÷&FW"'’Ræ7&VFVEöBFW60¢Æ–Ö—BG¶Æ–Ö—GÐ¢’’2ç“° ¢6öç7BW6W'2Ò'&’æ—4'&’‡&W7VÇCòç&÷w2’ò&W7VÇBç&÷w2¢µÓ°¢&WGW&â&W2æ§6öâ‡²W6W'2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"Æ—7F–ær–×÷'FVBF—&V7F÷'’W6W'3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆ—7B–×÷'FVBF—&V7F÷'’W6W'2"Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢&6†—fRâ–×÷'BÖ7&VFVBF—&V7F÷'’÷væW"66÷VçB–çFòâVæ6Æ–ÖVB'W6–æW72Æ—7F–ærà¢òòF†—2¶VW2F—&V7F÷'’F—66÷fW'’ö6ÆÆ–ær–çF7Bv†–ÆR&WfVçF–ærF†W6R66÷VçG2g&öÒ–æfÆF–ær'&VÂW6W'2"à¢ç÷7B€¢"ö’öFÖ–âö–×÷'FVBÖF—&V7F÷'’×W6W'2ó§W6W$–Bö&6†—fR×FòÖF—&V7F÷'’"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BW6W$–BÒ7G&–ær‡&Wç&×2çW6W$–BÇÂ""’çG&–Ò‚“°¢6öç7B÷WF6öÖRÒv—B&6†—fT–×÷'FVDF—&V7F÷'•W6W%FôF—&V7F÷'’‡W6W$–B“°¢&WGW&â&W2æ§6öâ‡²ö³¢G'VRÂââæ÷WF6öÖRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&6†—f–ær–×÷'FVBF—&V7F÷'’W6W#¢"ÂW'&÷"“°¢6öç7B7FGW2ÒG—VöbW'&÷#òç7FGW2ÓÓÒ&çVÖ&W""òW'&÷"ç7FGW2¢S°¢&WGW&â&W2ç7FGW2‡7FGW2’æ§6öâ‡°¢ÖW76vS ¢7FGW2ãÒS ¢òW'&÷#òæÖW76vRÇÂ$f–ÆVBFò&6†—fRW6W" ¢¢W'&÷#òæÖW76vRÇÂ$f–ÆVBFò&6†—fRW6W""À¢6öFS¢W'&÷#òæ6öFRÇÂçVÆÂÀ¢&WVW7D–C¢‡&W2ç’’ç&WVW7D–BÇÂçVÆÂÀ¢Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢'VÆ²&6†—fR–×÷'BÖ7&VFVBF—&V7F÷'’÷væW"66÷VçG2‡v—F‚6fWG’6öæf—&ÖF–öâ’à¢ç÷7B€¢"ö’öFÖ–âö–×÷'FVBÖF—&V7F÷'’×W6W'2ö&6†—fRÖÆÂ"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢W‡&W72æ§6öâ‡²Æ–Ö—C¢#Ö""Ò’À¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B6öæf—&ÒÒ7G&–ær€¢‡&Wæ&öG’2ç’“òæ6öæf—&ÒÇÂ‡&Wæ&öG’2ç’“òæ6öæf—&Õ‡&6RÇÂ" ¢’çG&–Ò‚“°¢–b†6öæf—&ÒÓÒ$$4„•dUôÄÂ"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢uG—R$$4„•dUôÄÂ"Fò6öæf—&Ò'VÆ²&6†—f–ærârÒ“°¢Ð ¢6öç7BÆ–Ö—E&rÒ7G&–ær‚‡&Wæ&öG’2ç’“òæÆ–Ö—Bóò""’çG&–Ò‚“°¢6öç7B'6VDÆ–Ö—BÒÆ–Ö—E&rò'6T–çB†Æ–Ö—E&rÂ’¢S°¢6öç7BÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR‡'6VDÆ–Ö—B’òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒSÂ'6VDÆ–Ö—B’’¢S° ¢6öç7B&W7VÇBÒ†v—BF"æW†V7WFR‡7Æ ¢6VÆV7BRæ–@¢g&öÒW6W'2P¢v†W&RRæöæ&ö&F–æuö6ö×ÆWFVBÒfÇ6P¢æBRç77v÷&Eö†6‚—2çVÆÀ¢æB€¢v'W6–æW75ö÷væW"rÒç’‡Rç&öÆW2¢÷"Rç&öÆRÒv'W6–æW75ö÷væW"p¢¢æBÆ÷vW"‡RæVÖ–Â’æ÷BÆ–¶Rv&6†—fVB²TF†WG&FW66÷WBæ–çfÆ–Bp¢÷&FW"'’Ræ7&VFVEöBFW60¢Æ–Ö—BG¶Æ–Ö—GÐ¢’’2ç“° ¢6öç7B–G3¢7G&–æuµÒÒ'&’æ—4'&’‡&W7VÇCòç&÷w2¢ò&W7VÇBç&÷w2æÖ‚‡#¢ç’’Óâ7G&–ær‡#òæ–BÇÂ""’’æf–ÇFW"„&ööÆVâ¢¢µÓ° ¢ÆWB&6†—fVBÒ°¢6öç7BW'&÷'3¢'&“Ç²W6W$–C¢7G&–æs²ÖW76vS¢7G&–ærÓâÒµÓ°¢f÷"†6öç7B–Böb–G2’°¢G'’°¢v—B&6†—fT–×÷'FVDF—&V7F÷'•W6W%FôF—&V7F÷'’†–B“°¢&6†—fVB³Ò°¢Ò6F6‚†W'#¢ç’’°¢W'&÷'2çW6‚‡°¢W6W$–C¢–BÀ¢ÖW76vS¢G—VöbW'#òæÖW76vRÓÓÒ'7G&–ær"òW'"æÖW76vR¢&&6†—fRf–ÆVB"À¢Ò“°¢Ð¢Ð ¢&WGW&â&W2æ§6öâ‡°¢&WVW7FVDÆ–Ö—C¢Æ–Ö—BÀ¢ÖF6†VC¢–G2æÆVæwF‚À¢&6†—fVBÀ¢f–ÆVC¢W'&÷'2æÆVæwF‚À¢W'&÷'2À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"'VÆ²&6†—f–ær–×÷'FVBF—&V7F÷'’W6W'3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡°¢ÖW76vS¢$f–ÆVBFò'VÆ²Ö&6†—fRW6W'2"À¢&WVW7D–C¢‡&W2ç’’ç&WVW7D–BÇÂçVÆÂÀ¢Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢Æ—7B–×÷'B&F6†W2g&öÒ7Fv–ærF&ÆRv—F‚7FGW26÷VçG0¢ævWB€¢"ö’öFÖ–âö'W6–æW76W2ö–×÷'Bö&F6†W2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2…÷&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B&W7VÇBÒ†v—BF"æW†V7WFR‡7Æ ¢6VÆV7@¢&F6…ö–B2&&F6„–B"À¢6÷W&6RÀ¢6÷VçB‚¢“£¦–çB2'F÷FÅ&÷w2"À¢6÷VçB‚¢’f–ÇFW"‡v†W&R7FGW2ÒwVæF–ærr“£¦–çB2'VæF–æu&÷w2"À¢6÷VçB‚¢’f–ÇFW"‡v†W&R7FGW2ÒvÖW&vVBr“£¦–çB2&ÖW&vVE&÷w2"À¢6÷VçB‚¢’f–ÇFW"‡v†W&R7FGW2Òvf–ÆVBr“£¦–çB2&f–ÆVE&÷w2"À¢6÷VçB‚¢’f–ÇFW"‡v†W&R7FGW2Òw6¶—VEöGWÆ–6FRr“£¦–çB2'6¶—VE&÷w2"À¢Ö‚†7&VFVEöB’2&ÆFW7D7&VFVDB ¢g&öÒÆ—7F–æuö–×÷'E÷7Fv–æp¢w&÷W'’&F6…ö–BÂ6÷W&6P¢÷&FW"'’Ö‚†7&VFVEöB’FW60¢Æ–Ö—BS ¢’’2ç“° ¢6öç7B&F6†W2Ò'&’æ—4'&’‡&W7VÇCòç&÷w2’ò&W7VÇBç&÷w2¢µÓ°¢&WGW&â&W2æ§6öâ‡²&F6†W2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"Æ—7F–ær–×÷'B&F6†W3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆ—7B–×÷'B&F6†W2"Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢f–Wr7FvVB&÷w2f÷"öæR&F6‚‡v—F‚÷F–öæÂ7FGW2f–ÇFW"¢ævWB€¢"ö’öFÖ–âö'W6–æW76W2ö–×÷'Bö&F6†W2ó¦&F6„–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B&F6„–BÒ7G&–ær‡&Wç&×2æ&F6„–BÇÂ""’çG&–Ò‚“°¢–b‚&F6„–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&&F6„–B—2&WV—&VB"Ò“°¢Ð ¢6öç7B7FGW2ÒG—Vöb&WçVW'’ç7FGW2ÓÓÒ'7G&–ær"ò&WçVW'’ç7FGW2çG&–Ò‚’¢"#°¢6öç7BÆ–Ö—E&rÒG—Vöb&WçVW'’æÆ–Ö—BÓÓÒ'7G&–ær"ò'6T–çB‡&WçVW'’æÆ–Ö—BÂ’¢°¢6öç7BÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR†Æ–Ö—E&r’òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒSÂÆ–Ö—E&r’’¢° ¢6öç7B&VF–6FW2Ò¶W†Æ—7F–æt–×÷'E7Fv–æræ&F6„–BÂ&F6„–B•Ó°¢–b‡7FGW2’°¢&VF–6FW2çW6‚†W†Æ—7F–æt–×÷'E7Fv–ærç7FGW2Â7FGW22ç’’“°¢Ð ¢6öç7B&÷w2Òv—BF ¢ç6VÆV7B‚¢æg&öÒ†Æ—7F–æt–×÷'E7Fv–ær¢çv†W&R†æB‚ââç&VF–6FW2’¢æ÷&FW$'’†FW62†Æ—7F–æt–×÷'E7Fv–æræ7&VFVDB’¢æÆ–Ö—B†Æ–Ö—B“° ¢&WGW&â&W2æ§6öâ‡²&÷w2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"ÆöF–ær–×÷'B&F6‚&÷w3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB–×÷'B&F6‚&÷w2"Ò“°¢Ð¢Ð¢“° ¢ç÷7B‚"ö’öW'&÷"×&W÷'G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂçVÆÃ°¢6öç7B&W÷'DFFÒ°¢ââç&Wæ&öG’À¢W6W$–BÀ¢Ó° ¢òò'V–ÆB&W÷'B–ÆöBæBW'6—7Bf–7F÷&vRÆ–W"†FF&6RÖ&6¶VB¢6öç7B&W÷'BÒ°¢–C¢&W÷'EòG´FFRææ÷r‚—ÖÀ¢ââç&W÷'DFFÀ¢7FGW3¢&÷Vâ"À¢&–÷&—G“¢&ÖVF—VÒ"À¢7&VFVDC¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢WFFVDC¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢Ó° ¢òò6fRFòFF&6P¢v—B7F÷&vRæ7&VFTW'&÷%&W÷'B‡&W÷'B“° ¢&W2æ§6öâ‡²ÖW76vS¢$W'&÷"&W÷'B7V&Ö—GFVB7V66W76gVÆÇ’"Â&W÷'D–C¢&W÷'Bæ–BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærW'&÷"&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7V&Ö—BW'&÷"&W÷'B"Ò“°¢Ð¢Ò“° ¢òòöæR×F'Vr&W÷'Bv—F‚67&VVç6†÷@¢ç÷7B‚"ö’ö'Vr×&W÷'G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²F—FÆRÂFW67&—F–öâÂ67&VVç6†÷BÂW6W$vVçBÂW&ÂÂF–ÖW7F×Âf–Ww÷'BÂG—RÒÐ¢&Wæ&öG“° ¢òòvVæW&FRVæ—VR&W÷'B”@¢6öç7B&W÷'D–BÒ%TrÒG´FFRææ÷r‚—ÒÒG´ÖF‚ç&æFöÒ‚’çFõ7G&–ærƒ3b’ç7V'7G"ƒ"Âb’çFõWW$66R‚—Ö° ¢òòG&6²'Vr&W÷'B7V&Ö—76–öâv—F‚Æö6Æ—G¢òòÆö6Æ—G•G&6¶W"6ÆÂ&VÖ÷fV@ ¢òòFV'VrÆörF†R–æ6öÖ–ærFF¢6öç6öÆRæÆör‚$'Vr&W÷'BFF&V6V—fVC¢"Â°¢F—FÆRÀ¢FW67&—F–öâÀ¢G—RÀ¢W&ÂÀ¢W6W$vVçBÀ¢f–Ww÷'BÀ¢†567&VVç6†÷C¢67&VVç6†÷BÀ¢Ò“° ¢òò7F÷&R'Vr&W÷'BFFv—F‚&÷W"f–VÆBÖ–æp¢6öç7B'Vu&W÷'BÒ°¢–C¢&W÷'D–BÀ¢W6W$–C¢&WçW6W#òæ6Æ–×3òç7V"ÇÂ&æöç–Ö÷W2"À¢W6W$VÖ–Ã¢&WçW6W#òæVÖ–ÂÇÂçVÆÂÀ¢F—FÆS¢F—FÆRÇÂ$öæRÕF'Vr&W÷'B"À¢òòFW67&—F–öã¢FW67&—F–öâÇÂtWFöÖF–6ÆÇ’vVæW&FVB'Vr&W÷'Bv—F‚67&VVç6†÷BrÀ¢W'&÷%G—S¢G—RÇÂ&'Vr"À¢7W'&VçEW&Ã¢W&ÂÀ¢W6W$vVçBÀ¢'&÷w6W$–æfó¢f–Ww÷'Bò²f–Ww÷'BÒ¢çVÆÂÀ¢GF6†ÖVçG3¢67&VVç6†÷Bò·²G—S¢'67&VVç6†÷B"ÂFF¢67&VVç6†÷BÕÒ¢çVÆÂÀ¢7FGW3¢&÷Vâ"À¢&–÷&—G“¢&ÖVF—VÒ"À¢Ó° ¢òòÆörFWF–ÆVB'Vr&W÷'@¢6öç6öÆRæÆör‚/	ù	²öæRÕF'Vr&W÷'C¢"Â°¢&W÷'D–BÀ¢W&ÂÀ¢f–Ww÷'BÀ¢W6W$vVçC¢W6W$vVçCòç7V'7G&–ærƒÂS’²"âââ"À¢F–ÖW7F×À¢†567&VVç6†÷C¢&Wæf–ÆW3òç67&VVç6†÷BÇÂ&Wæ&öG’ç67&VVç6†÷BÀ¢Ò“° ¢òò6fRFòFF&6P¢v—B7F÷&vRæ7&VFTW'&÷%&W÷'B†'Vu&W÷'B“° ¢&W2æ§6öâ‡°¢ÖW76vS¢$'Vr&W÷'B7V&Ö—GFVB7V66W76gVÆÇ’"À¢&W÷'D–BÀ¢7FGW3¢'&V6V—fVB"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&ö6W76–ær'Vr&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&ö6W72'Vr&W÷'B"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öFÖ–âöW'&÷"×&W÷'G2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7BW6W"ÒW6W$–Bòv—B7F÷&vRævWEW6W"‡W6W$–B’¢çVÆÃ° ¢6öç7Bæ÷&ÖÆ—¦U&öÆRÒ‡&öÆS¢Væ¶æ÷vâ“¢7G&–ærÓâ°¢6öç7B&rÒG—Vöb&öÆRÓÓÒ'7G&–ær"ò&öÆRçG&–Ò‚’çFôÆ÷vW$66R‚’¢"#°¢–b‚&r’&WGW&â"#°¢&WGW&â&rÓÓÒ&÷væW""ÇÂ&rÓÓÒ&†VEöFÖ–â"ò'7WW%öFÖ–â"¢&s°¢Ó° ¢6öç7BÆÆ÷vVE&öÆW2ÒæWr6WB…²'7WW%öFÖ–â"Â&ÖöFW&F÷""Â&÷5öFÖ–â"Â'7W÷'EövVçB%Ò“° ¢6öç7B&–Ö'•&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òç&öÆR“°¢6öç7B7F—fU&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òæ7F—fU&öÆR“°¢6öç7B&öÆTÆ—7BÒ'&’æ—4'&’‚‡W6W"2ç’“òç&öÆW2¢ò‡W6W"2ç’’ç&öÆW2æÖ‚‡#¢ç’’Óâæ÷&ÖÆ—¦U&öÆR‡"’’æf–ÇFW"„&ööÆVâ¢¢µÓ°¢6öç7B†466W72Ð¢‡W6W"2ç’“òæ—4FÖ–âÓÓÒG'VRÇÀ¢‡W6W"2ç’“òæ—57WW$FÖ–âÓÓÒG'VRÇÀ¢ÆÆ÷vVE&öÆW2æ†2‡&–Ö'•&öÆR’ÇÀ¢ÆÆ÷vVE&öÆW2æ†2†7F—fU&öÆR’ÇÀ¢&öÆTÆ—7Bç6öÖR‚‡#¢7G&–ær’ÓâÆÆ÷vVE&öÆW2æ†2‡"’“° ¢–b‚W6W"ÇÂ†466W72’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢òò&WGW&â&VÂW'&÷"&W÷'G2g&öÒF†RFF&6RÂæWvW7Bf—'7@¢6öç7B&W÷'G2Òv—B7F÷&vRævWDW'&÷%&W÷'G2‚“°¢&W2æ§6öâ‡&W÷'G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærW'&÷"&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚W'&÷"&W÷'G2"Ò“°¢Ð¢Ò“° ¢çF6‚‚"ö’öFÖ–âöW'&÷"×&W÷'G2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7BW6W"ÒW6W$–Bòv—B7F÷&vRævWEW6W"‡W6W$–B’¢çVÆÃ° ¢6öç7Bæ÷&ÖÆ—¦U&öÆRÒ‡&öÆS¢Væ¶æ÷vâ“¢7G&–ærÓâ°¢6öç7B&rÒG—Vöb&öÆRÓÓÒ'7G&–ær"ò&öÆRçG&–Ò‚’çFôÆ÷vW$66R‚’¢"#°¢–b‚&r’&WGW&â"#°¢&WGW&â&rÓÓÒ&÷væW""ÇÂ&rÓÓÒ&†VEöFÖ–â"ò'7WW%öFÖ–â"¢&s°¢Ó° ¢6öç7BÆÆ÷vVE&öÆW2ÒæWr6WB…²'7WW%öFÖ–â"Â&ÖöFW&F÷""Â&÷5öFÖ–â"Â'7W÷'EövVçB%Ò“° ¢6öç7B&–Ö'•&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òç&öÆR“°¢6öç7B7F—fU&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òæ7F—fU&öÆR“°¢6öç7B&öÆTÆ—7BÒ'&’æ—4'&’‚‡W6W"2ç’“òç&öÆW2¢ò‡W6W"2ç’’ç&öÆW2æÖ‚‡#¢ç’’Óâæ÷&ÖÆ—¦U&öÆR‡"’’æf–ÇFW"„&ööÆVâ¢¢µÓ°¢6öç7B†466W72Ð¢‡W6W"2ç’“òæ—4FÖ–âÓÓÒG'VRÇÀ¢‡W6W"2ç’“òæ—57WW$FÖ–âÓÓÒG'VRÇÀ¢ÆÆ÷vVE&öÆW2æ†2‡&–Ö'•&öÆR’ÇÀ¢ÆÆ÷vVE&öÆW2æ†2†7F—fU&öÆR’ÇÀ¢&öÆTÆ—7Bç6öÖR‚‡#¢7G&–ær’ÓâÆÆ÷vVE&öÆW2æ†2‡"’“° ¢–b‚W6W"ÇÂ†466W72’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BWFFTFFÒ&Wæ&öG“° ¢òòWFFRF†RFF&6P¢v—B7F÷&vRçWFFTW'&÷%&W÷'B†–BÂWFFTFF“° ¢&W2æ§6öâ‡²ÖW76vS¢$W'&÷"&W÷'BWFFVB7V66W76gVÆÇ’"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærW'&÷"&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRW'&÷"&W÷'B"Ò“°¢Ð¢Ò“° ¢òòFW7F–ær6WGF–æw2VæGö–çG0¢ævWB€¢"ö’öFÖ–â÷FW7F–ær×6WGF–æw2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B6WGF–æw2Òv—B7F÷&vRævWE6—FU6WGF–æw2‚'FW7F–ær"“° ¢6öç7BFVfVÇG2Ò°¢'Vu&W÷'DVæ&ÆVC¢G'VRÀ¢FW7F–ætÖöFTVæ&ÆVC¢fÇ6RÀ¢6†÷uFW7F–æt&ææW#¢fÇ6RÀ¢Ó° ¢6öç7BÖW&vVBÒ²ââæFVfVÇG2Ò2ç“° ¢f÷"†6öç7B6WGF–æröb6WGF–æw2’°¢6öç7B¶W’Ò7G&–ær‚‡6WGF–ær2ç’’æ¶W’ÇÂ""“°¢–b‚¶W’’6öçF–çVS°¢6öç7BfÇVRÒ‡6WGF–ær2ç’’çfÇVS° ¢–b‡G—VöbfÇVRÓÓÒ&&ööÆVâ"’°¢ÖW&vVE¶¶W•ÒÒfÇVS°¢ÒVÇ6R–b‡fÇVRbbG—VöbfÇVRÓÓÒ&ö&¦V7B"bb&Væ&ÆVB"–âfÇVR’°¢ÖW&vVE¶¶W•ÒÒ&ööÆVâ‚‡fÇVR2ç’’æVæ&ÆVB“°¢ÒVÇ6R–b‡G—VöbfÇVRÓÓÒ'7G&–ær"’°¢ÖW&vVE¶¶W•ÒÒfÇVRÓÓÒ'G'VR#°¢Ð¢Ð ¢&W2æ§6öâ†ÖW&vVB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFW7F–ær6WGF–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚FW7F–ær6WGF–æw2"Ò“°¢Ð¢Ð¢“° ¢çF6‚€¢"ö’öFÖ–â÷FW7F–ær×6WGF–æw2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BWFFW2Ò&Wæ&öG’ÇÂ·Ó°¢6öç7BÆÆ÷vVD¶W—2Ò²&'Vu&W÷'DVæ&ÆVB"Â'FW7F–ætÖöFTVæ&ÆVB"Â'6†÷uFW7F–æt&ææW"%Ó° ¢–b‚WFFW2ÇÂG—VöbWFFW2ÓÒ&ö&¦V7B"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B6WGF–æw2–ÆöB"Ò“°¢Ð ¢6öç7BW†—7F–ærÒv—B7F÷&vRævWE6—FU6WGF–æw2‚'FW7F–ær"“°¢6öç7B'”¶W’ÒæWrÖÇ7G&–ærÂç“â‚“°¢f÷"†6öç7B6WGF–æröbW†—7F–ær’°¢'”¶W’ç6WB…7G&–ær‚‡6WGF–ær2ç’’æ¶W’’Â6WGF–ær“°¢Ð ¢f÷"†6öç7B¶W’öbÆÆ÷vVD¶W—2’°¢–b‚†¶W’–âWFFW2’’6öçF–çVS°¢6öç7BVæ&ÆVBÒ&ööÆVâ‡WFFW5¶¶W•Ò“°¢6öç7B7W'&VçBÒ'”¶W’ævWB†¶W’“° ¢6öç7BfÇVRÒ²Væ&ÆVBÒ2ç“° ¢–b†7W'&VçB’°¢v—B7F÷&vRçWFFU6—FU6WGF–ær‚†7W'&VçB2ç’’æ–BÂ²fÇVRÒ“°¢ÒVÇ6R°¢v—B7F÷&vRæ7&VFU6—FU6WGF–ær‡°¢6FVv÷'“¢'FW7F–ær"À¢¶W’À¢fÇVRÀ¢Ò2ç’“°¢Ð¢Ð ¢&W2æ§6öâ‡²ÖW76vS¢%6WGF–æw2WFFVB7V66W76gVÆÇ’"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærFW7F–ær6WGF–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRFW7F–ær6WGF–æw2"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’öFÖ–âöW'&÷"×&W÷'B×7FG2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7BW6W"ÒW6W$–Bòv—B7F÷&vRævWEW6W"‡W6W$–B’¢çVÆÃ° ¢6öç7Bæ÷&ÖÆ—¦U&öÆRÒ‡&öÆS¢Væ¶æ÷vâ“¢7G&–ærÓâ°¢6öç7B&rÒG—Vöb&öÆRÓÓÒ'7G&–ær"ò&öÆRçG&–Ò‚’çFôÆ÷vW$66R‚’¢"#°¢–b‚&r’&WGW&â"#°¢&WGW&â&rÓÓÒ&÷væW""ÇÂ&rÓÓÒ&†VEöFÖ–â"ò'7WW%öFÖ–â"¢&s°¢Ó° ¢6öç7BÆÆ÷vVE&öÆW2ÒæWr6WB…²'7WW%öFÖ–â"Â&ÖöFW&F÷""Â&÷5öFÖ–â"Â'7W÷'EövVçB%Ò“° ¢6öç7B&–Ö'•&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òç&öÆR“°¢6öç7B7F—fU&öÆRÒæ÷&ÖÆ—¦U&öÆR‚‡W6W"2ç’“òæ7F—fU&öÆR“°¢6öç7B&öÆTÆ—7BÒ'&’æ—4'&’‚‡W6W"2ç’“òç&öÆW2¢ò‡W6W"2ç’’ç&öÆW2æÖ‚‡#¢ç’’Óâæ÷&ÖÆ—¦U&öÆR‡"’’æf–ÇFW"„&ööÆVâ¢¢µÓ°¢6öç7B†466W72Ð¢‡W6W"2ç’“òæ—4FÖ–âÓÓÒG'VRÇÀ¢‡W6W"2ç’“òæ—57WW$FÖ–âÓÓÒG'VRÇÀ¢ÆÆ÷vVE&öÆW2æ†2‡&–Ö'•&öÆR’ÇÀ¢ÆÆ÷vVE&öÆW2æ†2†7F—fU&öÆR’ÇÀ¢&öÆTÆ—7Bç6öÖR‚‡#¢7G&–ær’ÓâÆÆ÷vVE&öÆW2æ†2‡"’“° ¢–b‚W6W"ÇÂ†466W72’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢6öç7B&W÷'G2Òv—B7F÷&vRævWDW'&÷%&W÷'G2‚“° ¢6öç7BF÷FÂÒ&W÷'G2æÆVæwFƒ°¢ÆWB÷VâÒ°¢ÆWB–å&öw&W72Ò°¢ÆWB&W6öÇfVBÒ° ¢f÷"†6öç7B&W÷'Böb&W÷'G2’°¢6öç7B7FGW2Ò7G&–ær‚‡&W÷'B2ç’’ç7FGW2ÇÂ""“°¢–b‡7FGW2ÓÓÒ&÷Vâ"’÷Vâ²³°¢VÇ6R–b‡7FGW2ÓÓÒ&–å÷&öw&W72"’–å&öw&W72²³°¢VÇ6R–b‡7FGW2ÓÓÒ'&W6öÇfVB"’&W6öÇfVB²³°¢Ð ¢&W2æ§6öâ‡°¢F÷FÂÀ¢÷VâÀ¢–å&öw&W72À¢&W6öÇfVBÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6ö×WF–ærW'&÷"&W÷'B7FG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚W'&÷"&W÷'B7FG2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’öFÖ–âövVæW&FR×FW7BÖFF"À¢—4WF†VçF–6FVBÀ¢&WV—&TFÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð¢6öç7Bæ÷rÒFFRææ÷r‚“°¢6öç7BFW7E&W÷'G2Ò°¢°¢–C¢DU5BÒG¶æ÷wÒÓÀ¢W6W$–BÀ¢W6W$VÖ–Ã¢&WçW6W#òæVÖ–ÂÇÂçVÆÂÀ¢F—FÆS¢%µDU5EÒ6×ÆR'Vr&W÷'B"À¢W'&÷%G—S¢'FW7EöFF"À¢7W'&VçEW&Ã¢&‡GG3¢ò÷G&FW66÷WBæöFÖ–â÷FW7F–ærÖ6öçG&öÇ2"À¢W6W$vVçC¢&Wæ†VFW'5²'W6W"ÖvVçB%ÒÇÂ'FW7BÖvVçB"À¢'&÷w6W$–æfó¢çVÆÂÀ¢GF6†ÖVçG3¢çVÆÂÀ¢7FGW3¢&÷Vâ"À¢&–÷&—G“¢&ÖVF—VÒ"À¢ÒÀ¢°¢–C¢DU5BÒG¶æ÷wÒÓ&À¢W6W$–BÀ¢W6W$VÖ–Ã¢&WçW6W#òæVÖ–ÂÇÂçVÆÂÀ¢F—FÆS¢%µDU5EÒ6×ÆRT’—77VR"À¢W'&÷%G—S¢'FW7EöFF"À¢7W'&VçEW&Ã¢&‡GG3¢ò÷G&FW66÷WBæò"À¢W6W$vVçC¢&Wæ†VFW'5²'W6W"ÖvVçB%ÒÇÂ'FW7BÖvVçB"À¢'&÷w6W$–æfó¢çVÆÂÀ¢GF6†ÖVçG3¢çVÆÂÀ¢7FGW3¢&–å÷&öw&W72"À¢&–÷&—G“¢&Æ÷r"À¢ÒÀ¢Ó° ¢f÷"†6öç7BFW7E&W÷'BöbFW7E&W÷'G2’°¢v—B7F÷&vRæ7&VFTW'&÷%&W÷'B‡FW7E&W÷'B“°¢Ð ¢&W2æ§6öâ‡²ÖW76vS¢%FW7BFFvVæW&FVB7V66W76gVÆÇ’"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"vVæW&F–ærFW7BW'&÷"&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòvVæW&FRFW7BFF"Ò“°¢Ð¢Ð¢“° ¢æFVÆWFR€¢"ö’öFÖ–âö6ÆV"×FW7BÖFF"À¢—4WF†VçF–6FVBÀ¢&WV—&TFÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B&W÷'G2Òv—B7F÷&vRævWDW'&÷%&W÷'G2‚“°¢6öç7BFW7E&W÷'G2Ò&W÷'G2æf–ÇFW"‚‡&W÷'C¢ç’’Óâ°¢6öç7B–BÒ7G&–ær‡&W÷'Bæ–BÇÂ""“°¢6öç7BG—RÒ7G&–ær‡&W÷'BæW'&÷%G—RÇÂ""“°¢6öç7BF—FÆRÒ7G&–ær‡&W÷'BçF—FÆRÇÂ""“°¢&WGW&â–Bç7F'G5v—F‚‚%DU5BÒ"’ÇÂG—RÓÓÒ'FW7EöFF"ÇÂF—FÆRç7F'G5v—F‚‚%µDU5EÒ"“°¢Ò“° ¢f÷"†6öç7B&W÷'BöbFW7E&W÷'G2’°¢v—B7F÷&vRæFVÆWFTW'&÷%&W÷'B‚‡&W÷'B2ç’’æ–B“°¢Ð ¢&W2æ§6öâ‡²ÖW76vS¢%FW7BFF6ÆV&VB7V66W76gVÆÇ’"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6ÆV&–ærFW7BW'&÷"&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6ÆV"FW7BFF"Ò“°¢Ð¢Ð¢“° ¢6öç7BÖ&¶WGÆ6T6FVv÷'”–D66†RÒæWrÖÇ7G&–ærÂ²–C¢7G&–ærÂçVÆÃ²W‡—&W4D×3¢çVÖ&W"Óâ‚“° ¢7–æ2gVæ7F–öâvWDÖ&¶WGÆ6T6FVv÷'”–D'”æÖR†æÖS¢7G&–ær“¢&öÖ—6SÇ7G&–ærÂçVÆÃâ°¢6öç7B¶W’Ò7G&–ær†æÖRÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚“°¢–b‚¶W’’&WGW&âçVÆÃ° ¢6öç7B66†VBÒÖ&¶WGÆ6T6FVv÷'”–D66†RævWB†¶W’“°¢–b†66†VBbbFFRææ÷r‚’Â66†VBæW‡—&W4D×2’°¢&WGW&â66†VBæ–C°¢Ð ¢6öç7B6FVv÷&–W2Òv—B7F÷&vRævWDÖ&¶WGÆ6T6FVv÷&–W2‚“°¢6öç7BÖF6‚Ò†6FVv÷&–W2ÇÂµÒ’æf–æB€¢†3¢ç’’Óà¢7G&–ær†3òææÖRÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚’ÓÓÒ¶W¢“°¢6öç7B–BÒÖF6ƒòæ–Bò7G&–ær†ÖF6‚æ–B’¢çVÆÃ°¢Ö&¶WGÆ6T6FVv÷'”–D66†Rç6WB†¶W’Â²–BÂW‡—&W4D×3¢FFRææ÷r‚’²R¢c¢Ò“°¢&WGW&â–C°¢Ð ¢7–æ2gVæ7F–öâvWDÖ&¶WGÆ6T6FVv÷'”æÖT'”–B†–C¢7G&–ær“¢&öÖ—6SÇ7G&–ærÂçVÆÃâ°¢6öç7B¶W’Ò7G&–ær†–BÇÂ""’çG&–Ò‚“°¢–b‚¶W’’&WGW&âçVÆÃ° ¢6öç7B6FVv÷&–W2Òv—B7F÷&vRævWDÖ&¶WGÆ6T6FVv÷&–W2‚“°¢6öç7BÖF6‚Ò†6FVv÷&–W2ÇÂµÒ’æf–æB‚†3¢ç’’Óâ7G&–ær†3òæ–BÇÂ""’çG&–Ò‚’ÓÓÒ¶W’“°¢&WGW&âÖF6ƒòææÖRò7G&–ær†ÖF6‚ææÖR’¢çVÆÃ°¢Ð ¢òòÖ&¶WGÆ6R&÷WFW0¢òò6FVv÷&–W0¢ævWB‚"ö’öÖ&¶WGÆ6Rö6FVv÷&–W2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B6FVv÷&–W2Òv—B7F÷&vRævWDÖ&¶WGÆ6T6FVv÷&–W2‚“°¢&W2æ§6öâ†6FVv÷&–W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6R6FVv÷&–W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6FVv÷&–W2"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’öÖ&¶WGÆ6Rö6FVv÷&–W2"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B'6VD6FVv÷'’Ò–ç6W'DÖ&¶WGÆ6T6FVv÷'•66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VD6FVv÷'’ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6R6FVv÷'’–ÆöB"À¢—77VW3¢'6VD6FVv÷'’æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VD6FVv÷'’æFF°¢6öç7B6FVv÷'’Òv—B7F÷&vRæ7&VFTÖ&¶WGÆ6T6FVv÷'’‡fÆ–FFVDFF“°¢&W2ç7FGW2ƒ#’æ§6öâ†6FVv÷'’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6R6FVv÷'“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6FVv÷'’"Ò“°¢Ð¢Ò“° ¢òòÆ—7F–æw2‡V&Æ–2ÒöæÇ’6†÷w2&÷fVBÆ—7F–æw2¢ævWB‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf–ÇFW'2Ò°¢6FVv÷'”–C¢&WçVW'’æ6FVv÷'”–B27G&–ærÀ¢6÷VçG“¢&WçVW'’æ6÷VçG’27G&–ærÀ¢7FFS¢&WçVW'’ç7FFR27G&–ærÀ¢&–6TÖ–ã¢&WçVW'’ç&–6TÖ–âòçVÖ&W"‡&WçVW'’ç&–6TÖ–â’¢VæFVf–æVBÀ¢&–6TÖƒ¢&WçVW'’ç&–6TÖ‚òçVÖ&W"‡&WçVW'’ç&–6TÖ‚’¢VæFVf–æVBÀ¢6öæF—F–öã¢&WçVW'’æ6öæF—F–öâ27G&–ærÀ¢6V&6…VW'“¢&WçVW'’ç6V&6‚27G&–ærÀ¢6÷'D'“¢&WçVW'’ç6÷'D'’2'&–6Uö62"Â'&–6UöFW62"Â&FFUöFW62"Â&FFUö62"À¢Æ–Ö—C¢&WçVW'’æÆ–Ö—BòçVÖ&W"‡&WçVW'’æÆ–Ö—B’¢#À¢öfg6WC¢&WçVW'’æöfg6WBòçVÖ&W"‡&WçVW'’æöfg6WB’¢À¢7FGW3¢&7F—fR"ÂòòöæÇ’6†÷r&÷fVBö7F—fRÆ—7F–æw2FòV&Æ–0¢Ó° ¢6öç7BÆ—7F–æw2Òv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–æw2†f–ÇFW'2“°¢6öç7B6VÆÆW%W6W$–G2ÒÆ—7F–æw0¢æÖ‚†Æ—7F–æs¢ç’’Óâ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’çG&–Ò‚’¢æf–ÇFW"‚‡fÇVS¢7G&–ær’ÓâfÇVRæÆVæwF‚â“°¢6öç7BWF†÷&—G”'•W6W$–BÒv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö‡6VÆÆW%W6W$–G2“°¢6öç7BvFVDÆ—7F–æw2ÒÆ—7F–æw0¢æf–ÇFW"€¢†Æ—7F–æs¢ç’’ÓâWF†÷&—G”'•W6W$–Eµ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÓÒG'VP¢¢æÖ‚†Æ—7F–æs¢ç’’ÓâFõV&Æ–4W†6†ævTÆ—7F–ær†Æ—7F–ær’¢æf–ÇFW"„&ööÆVâ“° ¢&W2æ§6öâ†vFVDÆ—7F–æw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6RÆ—7F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Æ—7F–æw2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’öÖ&¶WGÆ6RöÆ—7F–æw2÷fÇVRÖwV–Fæ6R"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BwV–Fæ6RÒv—B'V–ÆDÆ—7F–æufÇVTwV–Fæ6R‡&Wæ&öG’óò·Ò“°¢&W2æ§6öâ†wV–Fæ6R“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"'V–ÆF–ærÖ&¶WGÆ6RfÇVRwV–Fæ6S¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò'V–ÆBfÇVRwV–Fæ6R"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B&öf–ÆTöffW$–BÒg&öÕ&öf–ÆTöffW$W†6†ævT–B†–B“°¢–b‡&öf–ÆTöffW$–B’°¢G'’°¢6öç7B&W7VÇBÒv—BööÂçVW'’€¢4TÄT5Bòâ¢ÂRæf—'7EöæÖRÂRæÆ7EöæÖRÂRçG'W7E÷66÷&RÂRçfW&–f–VEö&FvRÀ¢RæVÖ–Å÷fW&–f–VBÂRæFG&W75÷fW&–f–VBÂRæ6—G’ÂRç7FFRÂRç7FFUö6öFRÀ¢Ræ6÷VçG’ÂRæ6÷VçG•öæÖRÂRæ6÷VçG•öf—0¢e$ôÒ&öf–ÆUööffW'2ð¢¤ô”âW6W'2RôâRæ–BÒòç6VÆÆW%÷W6W%ö–@¢t„U$Ròæ–BÒC¢äBòæ—5ö7F—fRÒG'VP¢äBòæöffW%÷G—RÒv—FVÒp¢Ä”Ô•BÀ¢·&öf–ÆTöffW$–EÐ¢“°¢6öç7B&÷rÒ&W7VÇBç&÷w5³Ó°¢–b‚&÷r’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö…µ7G&–ær‡&÷rç6VÆÆW%÷W6W%ö–BÇÂ""•Ò“°¢–b†WF†÷&—G•µ7G&–ær‡&÷rç6VÆÆW%÷W6W%ö–BÇÂ""’çG&–Ò‚•ÒÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢&WGW&â&W2æ§6öâ†'V–ÆE&öf–ÆTöffW$W†6†ævT—FVÒ‡&÷rÂ&÷F†W""’“°¢Ò6F6‚†W'&÷"’°¢–b†—4Ö—76–æu&öf–ÆTöffW'5F&ÆR†W'&÷"’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢F‡&÷rW'&÷#°¢Ð¢Ð ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†–B“° ¢–b‚Æ—7F–ærÇÂ7G&–ær†Æ—7F–ærç7FGW2ÇÂ""’ÓÒ&7F—fR"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö…µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""•Ò“°¢–b†WF†÷&—G•µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7BV&Æ–4Æ—7F–ærÒFõV&Æ–4W†6†ævTÆ—7F–ær†Æ—7F–ær“°¢–b‚V&Æ–4Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢òò–æ7&VÖVçBf–Wr6÷Vç@¢v—B7F÷&vRæ–æ7&VÖVçDÆ—7F–æuf–Wr†–B“° ¢&W2æ§6öâ‡V&Æ–4Æ—7F–ær“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6RÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Æ—7F–ær"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2÷6ÇVró§6ÇVr"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6ÇVrÒÒ&Wç&×3°¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–æt'•6ÇVr‡6ÇVr“° ¢–b‚Æ—7F–ærÇÂ7G&–ær†Æ—7F–ærç7FGW2ÇÂ""’ÓÒ&7F—fR"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö…µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""•Ò“°¢–b†WF†÷&—G•µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7BV&Æ–4Æ—7F–ærÒFõV&Æ–4W†6†ævTÆ—7F–ær†Æ—7F–ær“°¢–b‚V&Æ–4Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢òò–æ7&VÖVçBf–Wr6÷Vç@¢v—B7F÷&vRæ–æ7&VÖVçDÆ—7F–æuf–Wr†Æ—7F–æræ–B“° ¢&W2æ§6öâ‡V&Æ–4Æ—7F–ær“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6RÆ—7F–ær'’6ÇVs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Æ—7F–ær"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BÔ$´UEÄ4Uôdõ$$”DDTåõDU…BÐ¢õÆ"†Öö6·ÆFVÖ÷Ç6×ÆWÇFW7GÇÆ6V†öÆFW'ÇVæWF†÷&—¦VGÇ6Öö¶UÇ2¦Ö&¶WB•Æ"ö“°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B'6VDÆ—7F–ærÒ–ç6W'DÖ&¶WGÆ6TÆ—7F–æu66†VÖç6fU'6R‡°¢ââç–6´Ö&¶WGÆ6Uw&—F&ÆTf–VÆG2‡&Wæ&öG’’À¢6VÆÆW$–C¢7G&–ær‡W6W#òæ–BÇÂ""’À¢Ò“°¢–b‚'6VDÆ—7F–ærç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6RÆ—7F–ær–ÆöB"À¢—77VW3¢'6VDÆ—7F–æræW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒæ÷&ÖÆ—¦TÖ&¶WGÆ6Uw&—F&ÆTf–VÆG2‡'6VDÆ—7F–æræFF2ç’“°¢6öç7BÆ—7F–æuFW‡BÒGµ7G&–ær‚‡fÆ–FFVDFF2ç’“òçF—FÆRÇÂ""—ÒGµ7G&–ær‚‡fÆ–FFVDFF2ç’“òæFW67&—F–öâÇÂ""—Ö°¢–b„Ô$´UEÄ4Uôdõ$$”DDTåõDU…BçFW7B†Æ—7F–æuFW‡B’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$Æ—7F–ærF—FÆRöFW67&—F–öâ6öçF–ç2Æ6V†öÆFW"÷"&ö†–&—FVBFW‡Bâ"À¢&V6öä6öFS¢$”ådÄ”EôÄ•5D”äuõDU…B"À¢Ò“°¢Ð ¢òò&6²Ö6ö×C¢6öÖR6Æ–VçG27F–ÆÂ6VæBW†6†ævR6FVv÷'’6ÇVw2–ç7FVBöb6FVv÷'’UT”Bà¢6öç7BÖ–&T6FVv÷'”–BÒ7G&–ær‡fÆ–FFVDFFæ6FVv÷'”–BÇÂ""’çG&–Ò‚“°¢6öç7BÆöö·4Æ–¶UWV–BÒ‡fÇVS¢7G&–ær’Óà¢õå³Ó–Öe×³‡ÒÕ³Ó–Öe×³GÒÕ³ÓUÕ³Ó–Öe×³7ÒÕ³ƒ–%Õ³Ó–Öe×³7ÒÕ³Ó–Öe×³'ÒBö’çFW7B‡fÇVR“° ¢–b†Ö–&T6FVv÷'”–BbbÆöö·4Æ–¶UWV–B†Ö–&T6FVv÷'”–B’’°¢6öç7B6ÇVuFôæÖS¢&V6÷&CÇ7G&–ærÂ7G&–æsâÒ°¢'W6–æW73¢%6VÆÂ–÷W"'W6–æW72"À¢'&VÂÖW7FFR#¢%&VÂW7FFR"À¢fV†–6ÆW3¢%fV†–6ÆW2"À¢6öç7G'V7F–öã¢$6öç7G'V7F–öâWV—ÖVçB"À¢FööÇ3¢%FööÇ2b†&Gv&R"À¢gW&æ—GW&S¢$gW&æ—GW&Rb†öÖRvööG2"À¢f&Ó¢$f&ÒWV—ÖVçB"À¢&'W6–æW72ÖWV—ÖVçB#¢$'W6–æW72WV—ÖVçB"À¢VÆV7G&öæ–73¢$VÆV7G&öæ–72bFV6†æöÆöw’"À¢7÷'G3¢%7÷'G2b&V7&VF–öâ"À¢6öÆÆV7F–&ÆW3¢$'Bb6öÆÆV7F–&ÆW2"À¢¦WvVÇ'“¢$¦WvVÇ'’bÇW‡W'’—FV×2"À¢&Æö6ÂÖfööB#¢$Æö6ÂfööBb'F—6âvööG2"À¢ÖWFÇ3¢%&V6–÷W2ÖWFÇ2…‡—6–6Â’"À¢÷F†W#¢$÷F†W"†–v‚ÕfÇVR—FV×2"À¢Ó° ¢6öç7BFW6—&VDæÖRÒ6ÇVuFôæÖU¶Ö–&T6FVv÷'”–EÒÇÂ"#°¢–b†FW6—&VDæÖR’°¢6öç7B&W6öÇfVD–BÒv—BvWDÖ&¶WGÆ6T6FVv÷'”–D'”æÖR†FW6—&VDæÖR“°¢–b‡&W6öÇfVD–B’°¢fÆ–FFVDFFæ6FVv÷'”–BÒ&W6öÇfVD–C°¢Ð¢Ð¢Ð ¢òò&WV—&R&6–2fW&–f–6F–öâ&Vf÷&RÆÆ÷v–ærÖ&¶WGÆ6RÆ—7F–æw2à¢òòÖ&¶WGÆ6RÆ—7F–ær&WV—&W2fW&–f–VBW'6öâ†FG&W72öVÖ–Â’÷"â&÷fVBfVæF÷"fW&–f–6F–öâà¢6öç7BfVæF÷%fW&–f–6F–öâÒv—B7F÷&vRævWEfVæF÷%fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“°¢6öç7B'W–W%fW&–f–6F–öâÒv—B7F÷&vRævWD'W–W%fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“°¢6öç7BFG&W75fW&–f–6F–öâÒv—B7F÷&vRævWDFG&W75fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“° ¢6öç7B—5fW&–f–VDf÷$Ö&¶WGÆ6RÐ¢‡fVæF÷%fW&–f–6F–öâbbfVæF÷%fW&–f–6F–öâç7FGW2ÓÓÒ&&÷fVB"’ÇÀ¢†'W–W%fW&–f–6F–öâbb'W–W%fW&–f–6F–öâç7FGW2ÓÓÒ&&÷fVB"’ÇÀ¢†FG&W75fW&–f–6F–öâbbFG&W75fW&–f–6F–öâç7FGW2ÓÓÒ&&÷fVB"“° ¢–b‚—5fW&–f–VDf÷$Ö&¶WGÆ6R’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS ¢%–÷R×W7B6ö×ÆWFR&6–2fW&–f–6F–öâ†VÖ–Â²FG&W72’÷"fVæF÷"fW&–f–6F–öâ&Vf÷&R7&VF–ærÖ&¶WGÆ6RÆ—7F–æw2â"À¢&WV—&VC¢°¢VÖ–Ã¢G'VRÀ¢FG&W73¢G'VRÀ¢fVæF÷%fW&–f–6F–öã¢&÷F–öæÅö'WEö66WFVB"À¢ÒÀ¢Ò“°¢Ð ¢òòÆÂæWrÆ—7F–æw2&WV—&RFÖ–âöÖöFW&F÷"&÷fÂ&Vf÷&Rvö–ærÆ—fP¢6öç7B&V6–÷W4ÖWFÇ46FVv÷'”–BÒv—BvWDÖ&¶WGÆ6T6FVv÷'”–D'”æÖR€¢%&V6–÷W2ÖWFÇ2…‡—6–6Â’ ¢“° ¢6öç7Bæ÷&ÖÆ—¦VDFF¢ç’Ò°¢ââçfÆ–FFVDFFÀ¢6VÆÆW$–C¢W6W#òæ–BÀ¢7FGW3¢'VæF–æuö&÷fÂ"Âòò&WV—&R&÷fÂf÷"ÆÂæWrÆ—7F–æw0¢—5&öÖ÷FVC¢fÇ6RÀ¢&öÖ÷FVEVçF–Ã¢çVÆÂÀ¢&÷fVD'“¢çVÆÂÀ¢&÷fVDC¢çVÆÂÀ¢&V¦V7FVD'“¢çVÆÂÀ¢&V¦V7FVDC¢çVÆÂÀ¢&V¦V7F–öå&V6öã¢çVÆÂÀ¢ÖöFW&F–öäæ÷FW3¢çVÆÂÀ¢—56VÆÆW%fW&–f–VC¢fÇ6RÀ¢fW&–f–6F–öå7FGW3¢&æöæU÷&WV—&VB"À¢fW&–f–6F–öäæ÷FW3¢çVÆÂÀ¢fW&–f–VDC¢çVÆÂÀ¢Ó° ¢6öç7BW†—7F–ætÆ—7F–æw2Òv—B7F÷&vRævWEW6W$Æ—7F–æw2…7G&–ær‡W6W#òæ–BÇÂ""’“°¢6öç7B–æ6öÖ–æt¶W’Ò'V–ÆDÖ&¶WGÆ6T–æw&W74¶W’‡°¢6VÆÆW$–C¢7G&–ær‡W6W#òæ–BÇÂ""’À¢6FVv÷'”–C¢7G&–ær†æ÷&ÖÆ—¦VDFFæ6FVv÷'”–BÇÂ""’À¢F—FÆS¢7G&–ær†æ÷&ÖÆ—¦VDFFçF—FÆRÇÂ""’À¢6÷VçG“¢7G&–ær†æ÷&ÖÆ—¦VDFFæ6÷VçG’ÇÂ""’À¢7FFS¢7G&–ær†æ÷&ÖÆ—¦VDFFç7FFRÇÂ""’À¢&–6S¢7G&–ær†æ÷&ÖÆ—¦VDFFç&–6RÇÂ""’À¢Ò“° ¢6öç7BGWÆ–6FTÆ—7F–ærÒW†—7F–ætÆ—7F–æw2æf–æB‚†Æ—7F–æs¢ç’’Óâ°¢6öç7B7FGW2Ò7G&–ær†Æ—7F–æsòç7FGW2ÇÂ""’çFôÆ÷vW$66R‚“°¢–b‚²&G&gB"Â'VæF–æuö&÷fÂ"Â&7F—fR%Òæ–æ6ÇVFW2‡7FGW2’’&WGW&âfÇ6S° ¢6öç7BW†—7F–æt¶W’Ò'V–ÆDÖ&¶WGÆ6T–æw&W74¶W’‡°¢6VÆÆW$–C¢7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’À¢6FVv÷'”–C¢7G&–ær†Æ—7F–æsòæ6FVv÷'”–BÇÂ""’À¢F—FÆS¢7G&–ær†Æ—7F–æsòçF—FÆRÇÂ""’À¢6÷VçG“¢7G&–ær†Æ—7F–æsòæ6÷VçG’ÇÂ""’À¢7FFS¢7G&–ær†Æ—7F–æsòç7FFRÇÂ""’À¢&–6S¢7G&–ær†Æ—7F–æsòç&–6RÇÂ""’À¢Ò“° ¢&WGW&âW†—7F–æt¶W’ÓÓÒ–æ6öÖ–æt¶W“°¢Ò“° ¢–b†GWÆ–6FTÆ—7F–ær’°¢&WGW&â&W2ç7FGW2ƒC’’æ§6öâ‡°¢ÖW76vS¢$ÖF6†–ærÖ&¶WGÆ6RÆ—7F–ær—2Ç&VG’VæF–ær÷"7F—fRâ"À¢Æ—7F–æt–C¢GWÆ–6FTÆ—7F–æræ–BÀ¢&V6öä6öFS¢$EUÄ”4DUôÔ$´UEÄ4UôÄ•5D”är"À¢Ò“°¢Ð ¢6öç7B6FVv÷'”æÖRÒv—BvWDÖ&¶WGÆ6T6FVv÷'”æÖT'”–B€¢7G&–ær‡fÆ–FFVDFFæ6FVv÷'”–BÇÂ""¢“°¢6öç7BW†6†ævT6FVv÷'•6ÇVrÒvWDW†6†ævT6FVv÷'•6ÇVtg&öÔÖ&¶WGÆ6T6FVv÷'”æÖR†6FVv÷'”æÖR“°¢–b†W†6†ævT6FVv÷'•6ÇVrbbW†6†ævT6FVv÷'•6ÇVrÓÒ&ÖWFÇ2"’°¢òò&W6öÇfR6VÆÆW"w27FFRf÷"6÷GFvRfööBÆr6†V6°¢ÆWB6VÆÆW%7FFTf÷%fÆ–FF–öã¢7G&–ærÂçVÆÂÒçVÆÃ°¢G'’°¢6öç7B·6VÆÆW%&öf–ÆUÒÒv—B7F÷&vRævWEW6W'4'”–G2…µ7G&–ær‡W6W#òæ–BÇÂ""•Ò“°¢6VÆÆW%7FFTf÷%fÆ–FF–öâÐ¢7G&–ær‚‡6VÆÆW%&öf–ÆR2ç’“òç7FFRÇÂ""¢çFõWW$66R‚¢çG&–Ò‚’ÇÂçVÆÃ°¢Ò6F6‚°¢òòæöâÖfFÂ(	BfÆ–FF–öâv–ÆÂ7W&f6R7FFR×&WV—&VBW'&÷"f÷"Æö6ÂÖföö@¢Ð¢6öç7B6FVv÷'•fÆ–FF–öâÒfÆ–FFTW†6†ævT6FVv÷'”Æ—7F–ær‡°¢6FVv÷'“¢W†6†ævT6FVv÷'•6ÇVrÀ¢–ÖvT6÷VçC¢'&’æ—4'&’‚‡fÆ–FFVDFF2ç’“òæ–ÖvW2¢ò‡fÆ–FFVDFF2ç’’æ–ÖvW2æÆVæwF€¢¢À¢7V73¢‚‡fÆ–FFVDFF2ç’“òç7V6–f–6F–öç2ÇÂçVÆÂ’2&V6÷&CÇ7G&–ærÂVæ¶æ÷vãâÂçVÆÂÀ¢F—FÆS¢7G&–ær‚‡fÆ–FFVDFF2ç’“òçF—FÆRÇÂ""’À¢FW67&—F–öã¢7G&–ær‚‡fÆ–FFVDFF2ç’“òæFW67&—F–öâÇÂ""’À¢6VÆÆW%7FFS¢6VÆÆW%7FFTf÷%fÆ–FF–öâÀ¢Ò“°¢–b†6FVv÷'•fÆ–FF–öâ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ†6FVv÷'•fÆ–FF–öâ“°¢Ð¢Ð ¢–b‡&V6–÷W4ÖWFÇ46FVv÷'”–BbbfÆ–FFVDFFæ6FVv÷'”–BÓÓÒ&V6–÷W4ÖWFÇ46FVv÷'”–B’°¢6öç7BÖWFÇ2Ò‡fÆ–FFVDFF2ç’“òç7V6–f–6F–öç3òæÖWFÇ2óòçVÆÃ°¢6öç7BÖWFÅG—RÒ7G&–ær†ÖWFÇ3òæÖWFÅG—RÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚“°¢6öç7Bf÷&Ôf7F÷"Ò7G&–ær†ÖWFÇ3òæf÷&Ôf7F÷"ÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚“°¢6öç7BW&—G’Ò7G&–ær†ÖWFÇ3òçW&—G’ÇÂ""’çG&–Ò‚“° ¢6öç7BvV–v‡D÷¥&rÒÖWFÇ3òçvV–v‡D÷£°¢6öç7BVçF—G•&rÒÖWFÇ3òçVçF—G•Væ—G2óò°¢6öç7B&VÖ—VÕ&rÒÖWFÇ3òç&VÖ—VÔ÷fW%7÷EW6C° ¢6öç7BvV–v‡D÷¢Ð¢G—VöbvV–v‡D÷¥&rÓÓÒ&çVÖ&W""òvV–v‡D÷¥&r¢çVÖ&W"…7G&–ær‡vV–v‡D÷¥&rÇÂ""’“°¢6öç7BVçF—G•Væ—G2Ð¢G—VöbVçF—G•&rÓÓÒ&çVÖ&W""òVçF—G•&r¢çVÖ&W"…7G&–ær‡VçF—G•&rÇÂ""’“°¢6öç7B&VÖ—VÔ÷fW%7÷EW6BÐ¢&VÖ—VÕ&rÓÒçVÆÀ¢òçVÆÀ¢¢G—Vöb&VÖ—VÕ&rÓÓÒ&çVÖ&W" ¢ò&VÖ—VÕ&p¢¢çVÖ&W"…7G&–ær‡&VÖ—VÕ&rÇÂ""’“° ¢6öç7BÆÆ÷vVDÖWFÅG—W2ÒæWr6WB…²&vöÆB"Â'6–ÇfW""Â'ÆF–çVÒ"Â'ÆÆF—VÒ"Â&÷F†W"%Ò“°¢6öç7BÆÆ÷vVDf÷&×2ÒæWr6WB…°¢&6ö–â"À¢&&""À¢'&÷VæB"À¢&§Væ²"À¢&w&–â"À¢'6†÷B"À¢'67&"À¢&÷F†W""À¢Ò“° ¢–b‚ÆÆ÷vVDÖWFÅG—W2æ†2†ÖWFÅG—R’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢ÖWFÅG—R—2&WV—&VBâ"À¢Ò“°¢Ð ¢–b‚ÆÆ÷vVDf÷&×2æ†2†f÷&Ôf7F÷"’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢f÷&Ôf7F÷"—2&WV—&VBâ"À¢Ò“°¢Ð ¢–b‚çVÖ&W"æ—4f–æ—FR‡vV–v‡D÷¢’ÇÂvV–v‡D÷¢ÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢vV–v‡D÷¢×W7B&R÷6—F—fRçVÖ&W"â"À¢Ò“°¢Ð ¢–b‚çVÖ&W"æ—4f–æ—FR‡VçF—G•Væ—G2’ÇÂVçF—G•Væ—G2ÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢VçF—G•Væ—G2×W7B&R÷6—F—fRçVÖ&W"â"À¢Ò“°¢Ð ¢–b€¢&VÖ—VÔ÷fW%7÷EW6BÒçVÆÂb`¢‚çVÖ&W"æ—4f–æ—FR‡&VÖ—VÔ÷fW%7÷EW6B’ÇÂ&VÖ—VÔ÷fW%7÷EW6BÂ¢’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS ¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢&VÖ—VÔ÷fW%7÷EW6B×W7B&RãÒv†Vâ&÷f–FVBâ"À¢Ò“°¢Ð ¢–b‡W&—G’æÆVæwF‚â#B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B&V6–÷W2ÖWFÇ2Æ—7F–æs¢W&—G’×W7B&R#B6†&7FW'2÷"ÆW72â"À¢Ò“°¢Ð ¢òò‡—6–6ÂÖöæÇ’æ÷&Ó¢&VfW"ÖVWGWÖöæÇ’f—6–&–Æ—G’æBÆö6Â–6·Wà¢æ÷&ÖÆ—¦VDFFæÆö6F–öåf—6–&–Æ—G’Ò&ÖVWGWööæÇ’#°¢æ÷&ÖÆ—¦VDFFæ—4Æö6Å–6·WöæÇ’ÒG'VS°¢Ð ¢–b‚æ÷&ÖÆ—¦VDFFçfÇVTwV–Fæ6R’°¢æ÷&ÖÆ—¦VDFFçfÇVTwV–Fæ6RÒv—B'V–ÆDÆ—7F–æufÇVTwV–Fæ6R†æ÷&ÖÆ—¦VDFF“°¢Ð ¢6öç7BÆ—7F–ærÒv—B7F÷&vRæ7&VFTÖ&¶WGÆ6TÆ—7F–ær†æ÷&ÖÆ—¦VDFF“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡°¢ââæÆ—7F–ærÀ¢ÖW76vS¢$Æ—7F–ær7V&Ö—GFVB7V66W76gVÆÇ’æB—2VæF–ærFÖ–â&÷fÂâ"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6RÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRÆ—7F–ær"Ò“°¢Ð¢Ò“° ¢òò7&VFR–Bf—6–&–Æ—G’&ö÷7Bf÷"7V6–f–2Ö&¶WGÆ6RÆ—7F–æp¢ç÷7B‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–Bö&ö÷7B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS ¢$Æ—7F–ær&ö÷7G2&RF—6&ÆVBâG&FU66÷WBFöW2æ÷BÆÆ÷r–B&æ¶–ær–âÖ&¶WGÆ6R&W7VÇG2â"À¢&V6öä6öFS¢%”Eõ$ä´”äuôD•4$ÄTB"À¢Ò“°¢Ò“° ¢çWB‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢òò6†V6²–bW6W"÷vç2F†RÆ—7F–æp¢6öç7BW†—7F–ætÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†–B“°¢–b‚W†—7F–ætÆ—7F–ærÇÂW†—7F–ætÆ—7F–ærç6VÆÆW$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòVF—BF†—2Æ—7F–ær"Ò“°¢Ð ¢6öç7B'6VEWFFW2Ò–ç6W'DÖ&¶WGÆ6TÆ—7F–æu66†VÖ¢ç'F–Â‚¢ç6fU'6R‡–6´Ö&¶WGÆ6Uw&—F&ÆTf–VÆG2‡&Wæ&öG’’“° ¢–b‚'6VEWFFW2ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6RÆ—7F–ærWFFR–ÆöB"À¢—77VW3¢'6VEWFFW2æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BWFFW2Òæ÷&ÖÆ—¦TÖ&¶WGÆ6Uw&—F&ÆTf–VÆG2‡'6VEWFFW2æFF2ç’“°¢–b„ö&¦V7Bæ¶W—2‡WFFW2’æÆVæwF‚ÓÓÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$æòW&Ö—GFVBWFFW2&÷f–FVB"Ò“°¢Ð ¢6öç7BæW‡DÖ&¶WGÆ6T¶W’Ò'V–ÆDÖ&¶WGÆ6T–æw&W74¶W’‡°¢6VÆÆW$–C¢7G&–ær‡W6W#òæ–BÇÂ""’À¢6FVv÷'”–C¢7G&–ær‡WFFW2æ6FVv÷'”–BÇÂW†—7F–ætÆ—7F–æræ6FVv÷'”–BÇÂ""’À¢F—FÆS¢7G&–ær‡WFFW2çF—FÆRÇÂW†—7F–ætÆ—7F–ærçF—FÆRÇÂ""’À¢6÷VçG“¢7G&–ær‡WFFW2æ6÷VçG’ÇÂW†—7F–ætÆ—7F–æræ6÷VçG’ÇÂ""’À¢7FFS¢7G&–ær‡WFFW2ç7FFRÇÂW†—7F–ætÆ—7F–ærç7FFRÇÂ""’À¢&–6S¢7G&–ær‡WFFW2ç&–6RÇÂW†—7F–ætÆ—7F–ærç&–6RÇÂ""’À¢Ò“° ¢6öç7B6–&Æ–ætÆ—7F–æw2Òv—B7F÷&vRævWEW6W$Æ—7F–æw2…7G&–ær‡W6W#òæ–BÇÂ""’“°¢6öç7BGWÆ–6FTÆ—7F–ærÒ6–&Æ–ætÆ—7F–æw2æf–æB‚†Æ—7F–æs¢ç’’Óâ°¢–b…7G&–ær†Æ—7F–æsòæ–BÇÂ""’ÓÓÒ7G&–ær†–B’’&WGW&âfÇ6S°¢6öç7B7FGW2Ò7G&–ær†Æ—7F–æsòç7FGW2ÇÂ""’çFôÆ÷vW$66R‚“°¢–b‚²&G&gB"Â'VæF–æuö&÷fÂ"Â&7F—fR%Òæ–æ6ÇVFW2‡7FGW2’’&WGW&âfÇ6S° ¢6öç7BW†—7F–æt¶W’Ò'V–ÆDÖ&¶WGÆ6T–æw&W74¶W’‡°¢6VÆÆW$–C¢7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’À¢6FVv÷'”–C¢7G&–ær†Æ—7F–æsòæ6FVv÷'”–BÇÂ""’À¢F—FÆS¢7G&–ær†Æ—7F–æsòçF—FÆRÇÂ""’À¢6÷VçG“¢7G&–ær†Æ—7F–æsòæ6÷VçG’ÇÂ""’À¢7FFS¢7G&–ær†Æ—7F–æsòç7FFRÇÂ""’À¢&–6S¢7G&–ær†Æ—7F–æsòç&–6RÇÂ""’À¢Ò“° ¢&WGW&âW†—7F–æt¶W’ÓÓÒæW‡DÖ&¶WGÆ6T¶W“°¢Ò“° ¢–b†GWÆ–6FTÆ—7F–ær’°¢&WGW&â&W2ç7FGW2ƒC’’æ§6öâ‡°¢ÖW76vS¢$ÖF6†–ærÖ&¶WGÆ6RÆ—7F–ær—2Ç&VG’VæF–ær÷"7F—fRâ"À¢Æ—7F–æt–C¢GWÆ–6FTÆ—7F–æræ–BÀ¢&V6öä6öFS¢$EUÄ”4DUôÔ$´UEÄ4UôÄ•5D”är"À¢Ò“°¢Ð ¢òò&ö†–&—FVB—FV×2²6÷GFvRfööBfÆ–FF–öâöâWFFP¢6öç7BWFFT6FVv÷'”–BÒ7G&–ær‡WFFW2æ6FVv÷'”–BÇÂW†—7F–ætÆ—7F–æræ6FVv÷'”–BÇÂ""“°¢6öç7BWFFT6FVv÷'”æÖRÒv—BvWDÖ&¶WGÆ6T6FVv÷'”æÖT'”–B‡WFFT6FVv÷'”–B“°¢6öç7BWFFTW†6†ævU6ÇVrÐ¢vWDW†6†ævT6FVv÷'•6ÇVtg&öÔÖ&¶WGÆ6T6FVv÷'”æÖR‡WFFT6FVv÷'”æÖR“°¢–b‡WFFTW†6†ævU6ÇVrbbWFFTW†6†ævU6ÇVrÓÒ&ÖWFÇ2"’°¢ÆWB6VÆÆW%7FFTf÷%WFFS¢7G&–ærÂçVÆÂÒçVÆÃ°¢G'’°¢6öç7B·6VÆÆW%&öf–ÆUÒÒv—B7F÷&vRævWEW6W'4'”–G2…µ7G&–ær‡W6W#òæ–BÇÂ""•Ò“°¢6VÆÆW%7FFTf÷%WFFRÐ¢7G&–ær‚‡6VÆÆW%&öf–ÆR2ç’“òç7FFRÇÂ""¢çFõWW$66R‚¢çG&–Ò‚’ÇÂçVÆÃ°¢Ò6F6‚°¢ò¢æöâÖfFÂ¢ð¢Ð¢6öç7BWFFUfÆ–FF–öâÒfÆ–FFTW†6†ævT6FVv÷'”Æ—7F–ær‡°¢6FVv÷'“¢WFFTW†6†ævU6ÇVrÀ¢–ÖvT6÷VçC¢'&’æ—4'&’‚‡WFFW22ç’“òæ–ÖvW2¢ò‡WFFW22ç’’æ–ÖvW2æÆVæwF€¢¢'&’æ—4'&’‚†W†—7F–ætÆ—7F–ær2ç’“òæ–ÖvW2¢ò†W†—7F–ætÆ—7F–ær2ç’’æ–ÖvW2æÆVæwF€¢¢À¢7V73¢‚‡WFFW22ç’“òç7V6–f–6F–öç2ÇÀ¢†W†—7F–ætÆ—7F–ær2ç’“òç7V6–f–6F–öç2ÇÀ¢çVÆÂ’2&V6÷&CÇ7G&–ærÂVæ¶æ÷vãâÂçVÆÂÀ¢F—FÆS¢7G&–ær‚‡WFFW22ç’“òçF—FÆRÇÂ†W†—7F–ætÆ—7F–ær2ç’“òçF—FÆRÇÂ""’À¢FW67&—F–öã¢7G&–ær€¢‡WFFW22ç’“òæFW67&—F–öâÇÂ†W†—7F–ætÆ—7F–ær2ç’“òæFW67&—F–öâÇÂ" ¢’À¢6VÆÆW%7FFS¢6VÆÆW%7FFTf÷%WFFRÀ¢Ò“°¢–b‡WFFUfÆ–FF–öâ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡WFFUfÆ–FF–öâ“°¢Ð¢Ð ¢6öç7BÆ—7F–ærÒv—B7F÷&vRçWFFTÖ&¶WGÆ6TÆ—7F–ær†–BÂWFFW2“°¢&W2æ§6öâ†Æ—7F–ær“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærÖ&¶WGÆ6RÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRÆ—7F–ær"Ò“°¢Ð¢Ò“° ¢æFVÆWFR‚"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢òò6†V6²–bW6W"÷vç2F†RÆ—7F–ær÷"—2FÖ–à¢6öç7BW†—7F–ætÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†–B“°¢–b€¢W†—7F–ætÆ—7F–ærÇÀ¢†W†—7F–ætÆ—7F–ærç6VÆÆW$–BÓÒW6W#òæ–Bb`¢²'7WW%öFÖ–â"Â&ÖöFW&F÷""Â&÷5öFÖ–â%Òæ–æ6ÇVFW2‡W6W"ç&öÆRÇÂ""’¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòFVÆWFRF†—2Æ—7F–ær"Ò“°¢Ð ¢v—B7F÷&vRæFVÆWFTÖ&¶WGÆ6TÆ—7F–ær†–B“°¢&W2æ§6öâ‡²ÖW76vS¢$Æ—7F–ærFVÆWFVB7V66W76gVÆÇ’"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"FVÆWF–ærÖ&¶WGÆ6RÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFVÆWFRÆ—7F–ær"Ò“°¢Ð¢Ò“° ¢òòFÖ–âôÖöFW&F÷"VæGö–çG2f÷"Æ—7F–ær&÷fÀ ¢òòvWBÆÂVæF–ærÆ—7F–æw2f÷"FÖ–â&Wf–Wp¢ævWB€¢"ö’öFÖ–âöÖ&¶WGÆ6R÷VæF–ær"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf–ÇFW'2Ò°¢7FGW3¢'VæF–æuö&÷fÂ"À¢Æ–Ö—C¢&WçVW'’æÆ–Ö—BòçVÖ&W"‡&WçVW'’æÆ–Ö—B’¢SÀ¢öfg6WC¢&WçVW'’æöfg6WBòçVÖ&W"‡&WçVW'’æöfg6WB’¢À¢Ó° ¢6öç7BÆ—7F–æw2Òv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–æw2†f–ÇFW'2“°¢&W2æ§6öâ†Æ—7F–æw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærVæF–ærÆ—7F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚VæF–ærÆ—7F–æw2"Ò“°¢Ð¢Ð¢“° ¢òò&÷fRÆ—7F–æp¢ç÷7B€¢"ö’öFÖ–âöÖ&¶WGÆ6RöÆ—7F–æw2ó¦–Bö&÷fR"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BÖöFW&F–öäæ÷FW2Òæ÷&ÖÆ—¦T÷F–öæÅ&VF7FVEFW‡B‡&Wæ&öG“òææ÷FW2Â“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRçWFFTÖ&¶WGÆ6TÆ—7F–ær†–BÂ°¢7FGW3¢&7F—fR"À¢&÷fVD'“¢W6W#òæ–BÀ¢&÷fVDC¢æWrFFR‚’À¢ÖöFW&F–öäæ÷FW2À¢Ò“° ¢òòG&–vvW"‡—W"ÖÆö6Âæ÷F–f–6F–öç2f÷"æV&'’W6W'2v†VâÆ—7F–ærvöW2Æ—fP¢G'’°¢v—Bæ÷F–f–6F–öå6W'f–6Rææ÷F–g”æV&'•W6W'4ödÖ&¶WGÆ6TÆ—7F–ær†Æ—7F–ær2ç’“°¢Ò6F6‚†æ÷F–g”W'&÷"’°¢6öç6öÆRæW'&÷"‚$W'&÷"6VæF–æræV&'’Æ—7F–æræ÷F–f–6F–öç3¢"Âæ÷F–g”W'&÷"“°¢Ð ¢&W2æ§6öâ‡°¢ÖW76vS¢$Æ—7F–ær&÷fVB7V66W76gVÆÇ’"À¢Æ—7F–ærÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&÷f–ærÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&÷fRÆ—7F–ær"Ò“°¢Ð¢Ð¢“° ¢òò&V¦V7BÆ—7F–æp¢ç÷7B€¢"ö’öFÖ–âöÖ&¶WGÆ6RöÆ—7F–æw2ó¦–B÷&V¦V7B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B&V¦V7F–öå&V6öâÒæ÷&ÖÆ—¦T÷F–öæÅ&VF7FVEFW‡B‡&Wæ&öG“òç&V6öâÂS“°¢6öç7BÖöFW&F–öäæ÷FW2Òæ÷&ÖÆ—¦T÷F–öæÅ&VF7FVEFW‡B‡&Wæ&öG“òææ÷FW2Â“° ¢–b‚&V¦V7F–öå&V6öâ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%&V¦V7F–öâ&V6öâ—2&WV—&VB"Ò“°¢Ð ¢6öç7BÆ—7F–ærÒv—B7F÷&vRçWFFTÖ&¶WGÆ6TÆ—7F–ær†–BÂ°¢7FGW3¢'&V¦V7FVB"À¢&V¦V7FVD'“¢W6W#òæ–BÀ¢&V¦V7FVDC¢æWrFFR‚’À¢&V¦V7F–öå&V6öâÀ¢ÖöFW&F–öäæ÷FW2À¢Ò“° ¢&W2æ§6öâ‡°¢ÖW76vS¢$Æ—7F–ær&V¦V7FVB7V66W76gVÆÇ’"À¢Æ—7F–ærÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&V¦V7F–ærÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&V¦V7BÆ—7F–ær"Ò“°¢Ð¢Ð¢“° ¢òòW6W"w2÷vâÆ—7F–æw0¢ævWB‚"ö’öÖ&¶WGÆ6Rö×’ÖÆ—7F–æw2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BÆ—7F–æw2Òv—B7F÷&vRævWEW6W$Æ—7F–æw2‡W6W#òæ–B“°¢&W2æ§6öâ†Æ—7F–æw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærW6W"Æ—7F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Æ—7F–æw2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öÖ&¶WGÆ6Rö÷&FW'2öÖ–æR"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B6VÆÆW$–C¢7G&–ærÒW6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V#°¢6öç7B&W7VÇBÒv—BööÂçVW'’€¢ ¢4TÄT5@¢Öòæ–BÀ¢ÖòæÆ—7F–æuö–B2&Æ—7F–æt–B"À¢ÖòçG&ç67F–öåö–B2'G&ç67F–öä–B"À¢Öòæ'W–W%ö–B2&'W–W$–B"À¢Öòç6VÆÆW%ö–B2'6VÆÆW$–B"À¢Öòç7FGW2À¢Öòç6†—–æu÷V÷FR2'6†—–æuV÷FR"À¢ÖòçG&6¶–æuöçVÖ&W"2'G&6¶–ætçVÖ&W""À¢ÖòæÆ&VÅ÷W&Â2&Æ&VÅW&Â"À¢Öòç–÷WEöFVGV7F–öåöÖ÷VçB2'–÷WDFVGV7F–öäÖ÷VçB"À¢Öòæ7&VFVEöB2&7&VFVDB"À¢ÖòçWFFVEöB2'WFFVDB"À¢ÖÂçF—FÆR2&Æ—7F–æuF—FÆR"À¢ÖÂç&–6R2&Æ—7F–æu&–6R"À¢ÖÂæ–ÖvW22&Æ—7F–æt–ÖvW2"À¢ÖÂç7FGW22&Æ—7F–æu7FGW2 ¢e$ôÒÖ&¶WGÆ6Uö÷&FW'2Öð¢¤ô”âÖ&¶WGÆ6UöÆ—7F–æw2ÖÂôâÖÂæ–BÒÖòæÆ—7F–æuö–@¢t„U$RÖòç6VÆÆW%ö–BÒC¢õ$DU"%’ÖòçWFFVEöBDU42åTÄÅ2Ä5BÂÖòæ7&VFVEöBDU40¢À¢·6VÆÆW$–EÐ¢“°¢&W2æ§6öâ‡&W7VÇBç&÷w2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6R6VÆÆW"÷&FW'3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Ö&¶WGÆ6R÷&FW'2"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’öÖ&¶WGÆ6Rö÷&FW'2ó¦–B÷7FGW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B6VÆÆW$–C¢7G&–ærÒW6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V#°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B6VÆÆW$÷&FW%G&ç6—F–öç3¢&V6÷&CÇ7G&–ærÂ7G&–æsâÒ°¢—FVÕ÷6öÆC¢'–ÖVçE÷&V6V—fVB"À¢–ÖVçE÷&V6V—fVC¢&Æ&VÅ÷VæF–ær"À¢Æ&VÅ÷VæF–æs¢&Æ&VÅ÷W&6†6VB"À¢Æ&VÅ÷W&6†6VC¢&–å÷G&ç6—B"À¢–å÷G&ç6—C¢&FVÆ—fW&VB"À¢FVÆ—fW&VC¢'–÷WE÷&V6öæ6–ÆVB"À¢Ó°¢6öç7BæW‡E7FGW2Ò7G&–ær‡&Wæ&öG“òç7FGW2ÇÂ""’çG&–Ò‚“°¢6öç7BÆÆ÷vVE7FGW6W2ÒæWr6WB…°¢&—FVÕ÷6öÆB"À¢'–ÖVçE÷&V6V—fVB"À¢&Æ&VÅ÷VæF–ær"À¢&Æ&VÅ÷W&6†6VB"À¢&–å÷G&ç6—B"À¢&FVÆ—fW&VB"À¢'–÷WE÷&V6öæ6–ÆVB"À¢Ò“°¢–b‚ÆÆ÷vVE7FGW6W2æ†2†æW‡E7FGW2’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6R÷&FW"7FGW2"Ò“°¢Ð ¢6öç7BW†—7F–æu&W7VÇBÒv—BööÂçVW'’€¢ ¢4TÄT5B–BÂ7FGW0¢e$ôÒÖ&¶WGÆ6Uö÷&FW'0¢t„U$R–BÒC¢äB6VÆÆW%ö–BÒC ¢Ä”Ô•B¢À¢¶–BÂ6VÆÆW$–EÐ¢“°¢6öç7BW†—7F–æt÷&FW"ÒW†—7F–æu&W7VÇBç&÷w5³Ó°¢–b‚W†—7F–æt÷&FW"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Ö&¶WGÆ6R÷&FW"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B7W'&VçE7FGW2Ò7G&–ær†W†—7F–æt÷&FW"ç7FGW2ÇÂ""“°¢6öç7BÆÆ÷vVDæW‡E7FGW2Ò6VÆÆW$÷&FW%G&ç6—F–öç5¶7W'&VçE7FGW5Ó°¢–b†æW‡E7FGW2ÓÒÆÆ÷vVDæW‡E7FGW2’°¢&WGW&â&W2ç7FGW2ƒC’’æ§6öâ‡°¢ÖW76vS¢$Ö&¶WGÆ6R÷&FW"7FGW2×W7BGfæ6RöæR7FWBF–ÖRâ"À¢7W'&VçE7FGW2À¢ÆÆ÷vVDæW‡E7FGW3¢ÆÆ÷vVDæW‡E7FGW2ÇÂçVÆÂÀ¢Ò“°¢Ð ¢6öç7BG&6¶–ætçVÖ&W"Ð¢æW‡E7FGW2ÓÓÒ&–å÷G&ç6—B"b`¢G—Vöb&Wæ&öG“òçG&6¶–ætçVÖ&W"ÓÓÒ'7G&–ær"b`¢&Wæ&öG’çG&6¶–ætçVÖ&W"çG&–Ò‚¢ò&Wæ&öG’çG&6¶–ætçVÖ&W"çG&–Ò‚’ç6Æ–6RƒÂ#¢¢çVÆÃ°¢6öç7BÆ&VÅW&ÂÐ¢æW‡E7FGW2ÓÓÒ&Æ&VÅ÷W&6†6VB"b`¢G—Vöb&Wæ&öG“òæÆ&VÅW&ÂÓÓÒ'7G&–ær"b`¢&Wæ&öG’æÆ&VÅW&ÂçG&–Ò‚¢ò&Wæ&öG’æÆ&VÅW&ÂçG&–Ò‚’ç6Æ–6RƒÂS¢¢çVÆÃ°¢–b†æW‡E7FGW2ÓÓÒ&Æ&VÅ÷W&6†6VB"bbÆ&VÅW&Â’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$Æ&VÂU$Â—2&WV—&VB&Vf÷&RGfæ6–ærFòÆ&VÂW&6†6VBâ"À¢Ò“°¢Ð¢–b†æW‡E7FGW2ÓÓÒ&–å÷G&ç6—B"bbG&6¶–ætçVÖ&W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢%G&6¶–ærçVÖ&W"—2&WV—&VB&Vf÷&RGfæ6–ærFò–âG&ç6—Bâ"À¢Ò“°¢Ð ¢6öç7B&W7VÇBÒv—BööÂçVW'’€¢ ¢UDDRÖ&¶WGÆ6Uö÷&FW'0¢4U@¢7FGW2ÒC2À¢G&6¶–æuöçVÖ&W"Ò4ôÄU44R‚CBÂG&6¶–æuöçVÖ&W"’À¢Æ&VÅ÷W&ÂÒ4ôÄU44R‚CRÂÆ&VÅ÷W&Â’À¢WFFVEöBÒæ÷r‚¢t„U$R–BÒC¢äB6VÆÆW%ö–BÒC ¢$UEU$ä”äp¢–BÀ¢Æ—7F–æuö–B2&Æ—7F–æt–B"À¢G&ç67F–öåö–B2'G&ç67F–öä–B"À¢'W–W%ö–B2&'W–W$–B"À¢6VÆÆW%ö–B2'6VÆÆW$–B"À¢7FGW2À¢6†—–æu÷V÷FR2'6†—–æuV÷FR"À¢G&6¶–æuöçVÖ&W"2'G&6¶–ætçVÖ&W""À¢Æ&VÅ÷W&Â2&Æ&VÅW&Â"À¢–÷WEöFVGV7F–öåöÖ÷VçB2'–÷WDFVGV7F–öäÖ÷VçB"À¢7&VFVEöB2&7&VFVDB"À¢WFFVEöB2'WFFVDB ¢À¢¶–BÂ6VÆÆW$–BÂæW‡E7FGW2ÂG&6¶–ætçVÖ&W"ÂÆ&VÅW&ÅÐ¢“°¢–b‚&W7VÇBç&÷w5³Ò’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Ö&¶WGÆ6R÷&FW"æ÷Bf÷VæB"Ò“°¢Ð¢G'’°¢v—B&V6÷&EG'W7DÆVFvW$WfVçB‡°¢7F÷%W6W$–C¢6VÆÆW$–BÀ¢VçF—G•G—S¢&Ö&¶WGÆ6Uö÷&FW""À¢VçF—G”–C¢7G&–ær‡&W7VÇBç&÷w5³Òæ–B’À¢WfVçEG—S¢Ö&¶WGÆ6Uö÷&FW%÷7FGW5òG¶æW‡E7FGW7ÖÀ¢6÷W&6U7W&f6S¢&W†6†ævU÷6VÆÆW%öF6†&ö&B"À¢fW&–f–6F–öäÆWfVÃ¢'6VÆe÷&W÷'FVB"À¢6öæf–FVæ6S ¢æW‡E7FGW2ÓÓÒ&FVÆ—fW&VB"ÇÂæW‡E7FGW2ÓÓÒ'–÷WE÷&V6öæ6–ÆVB"òãs‚¢ãcbÀ¢ÖWFFF¢°¢g&öÕ7FGW3¢7W'&VçE7FGW2À¢Fõ7FGW3¢æW‡E7FGW2À¢G&6¶–ætçVÖ&W#¢&W7VÇBç&÷w5³ÒçG&6¶–ætçVÖ&W"ÇÂçVÆÂÀ¢Æ&VÅW&Ã¢&W7VÇBç&÷w5³ÒæÆ&VÅW&ÂÇÂçVÆÂÀ¢ÒÀ¢Ò“°¢Ò6F6‚†ÆVFvW$W'&÷#¢ç’’°¢6öç6öÆRçv&â€¢%¶Ö&¶WGÆ6UÒG'W7BÆVFvW"w&—FR6¶—VBf÷"÷&FW"7FGW2WFFR"À¢ÆVFvW$W'&÷ ¢“°¢Ð¢&W2æ§6öâ‡&W7VÇBç&÷w5³Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærÖ&¶WGÆ6R6VÆÆW"÷&FW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRÖ&¶WGÆ6R÷&FW""Ò“°¢Ð¢Ò“° ¢òòÖ&²Æ—7F–ær26öÆB‡6VÆÆW"ÖöæÇ’¢ç÷7B€¢"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–BöÖ&²×6öÆB"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B6VÆÆW$–C¢7G&–ærÒW6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V#°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†–B“°¢–b‚Æ—7F–ær’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢–b…7G&–ær†Æ—7F–ærç6VÆÆW$–B’ÓÒ7G&–ær‡6VÆÆW$–B’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòWFFRF†—2Æ—7F–ær"Ò“°¢Ð¢6öç7BWFFVBÒv—B7F÷&vRçWFFTÖ&¶WGÆ6TÆ—7F–ær†–BÂ²7FGW3¢'6öÆB"Ò“°¢G'’°¢6öç7B6†—–æuV÷FT§6öâÒ†Æ—7F–ær2ç’’ç6†—–æuV÷FP¢ò¥4ôâç7G&–æv–g’‚†Æ—7F–ær2ç’’ç6†—–æuV÷FR¢¢çVÆÃ°¢v—BF"æW†V7WFR‡7Æ ¢”å4U%B”åDòÖ&¶WGÆ6Uö÷&FW'2€¢Æ—7F–æuö–BÀ¢6VÆÆW%ö–BÀ¢7FGW2À¢6†—–æu÷V÷FRÀ¢–÷WEöFVGV7F–öåöÖ÷Vç@¢¢dÅTU2€¢G¶–GÒÀ¢G·6VÆÆW$–GÒÀ¢v—FVÕ÷6öÆBrÀ¢G·6†—–æuV÷FT§6öçÓ£¦§6öæ"À¢44P¢t„TâG·6†—–æuV÷FT§6öçÓ£¦§6öæ"Óãâw6VÆÆW$'6÷&'2rÒwG'VRp¢D„Tâ4ôÄU44R‚‚‚G·6†—–æuV÷FT§6öçÓ£¦§6öæ"ÓãâvW7F–ÖFVD6÷7Br“£¦çVÖW&–2’Â¢TÅ4R ¢Tä@¢¢ôâ4ôädÄ”5B†Æ—7F–æuö–B’DòUDDR4U@¢7FGW2ÒÖ&¶WGÆ6Uö÷&FW'2ç7FGW2À¢6†—–æu÷V÷FRÒ4ôÄU44R†Ö&¶WGÆ6Uö÷&FW'2ç6†—–æu÷V÷FRÂU„4ÅTDTBç6†—–æu÷V÷FR’À¢WFFVEöBÒæ÷r‚¢“°¢G'’°¢v—B&V6÷&EG'W7DÆVFvW$WfVçB‡°¢7F÷%W6W$–C¢6VÆÆW$–BÀ¢VçF—G•G—S¢&Ö&¶WGÆ6UöÆ—7F–ær"À¢VçF—G”–C¢7G&–ær†–B’À¢WfVçEG—S¢&Ö&¶WGÆ6UöÆ—7F–æuöÖ&¶VE÷6öÆB"À¢6÷W&6U7W&f6S¢&W†6†ævU÷6VÆÆW%öF6†&ö&B"À¢fW&–f–6F–öäÆWfVÃ¢'6VÆe÷&W÷'FVB"À¢6öæf–FVæ6S¢ãcBÀ¢ÖWFFF¢°¢Æ—7F–æu7FGW3¢'6öÆB"À¢6†—–æuV÷FU&W6VçC¢&ööÆVâ‡6†—–æuV÷FT§6öâ’À¢ÒÀ¢Ò“°¢Ò6F6‚†ÆVFvW$W'&÷#¢ç’’°¢6öç6öÆRçv&â‚%¶Ö&¶WGÆ6UÒG'W7BÆVFvW"w&—FR6¶—VBf÷"Ö&²×6öÆB"ÂÆVFvW$W'&÷"“°¢Ð¢Ò6F6‚†÷&FW$W'&÷#¢ç’’°¢6öç6öÆRçv&â‚%¶Ö&¶WGÆ6UÒ6öÆBÆ—7F–ær÷&FW"Æ–fV7–6ÆRWfVçB6¶—VB"Â÷&FW$W'&÷"“°¢Ð¢&W2æ§6öâ‡WFFVB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"Ö&¶–ærÆ—7F–ær26öÆC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÖ&²Æ—7F–ær26öÆB"Ò“°¢Ð¢Ð¢“° ¢6öç7BÖ&¶WGÆ6T–çV—'•&WVW7E66†VÖÒ¢æö&¦V7B‡°¢Æ—7F–æt–C¢¢ç7G&–ær‚’çG&–Ò‚’æÖ–âƒ’æÖ‚ƒc’À¢ÖW76vS¢¢ç7G&–ær‚’çG&–Ò‚’æÖ–âƒ’æÖ‚ƒC’À¢öffW$Ö÷VçC¢¢æ6öW&6RæçVÖ&W"‚’ç÷6—F—fR‚’æÖ‚ƒóóó’æ÷F–öæÂ‚’À¢WF†÷&—G”vFS¢¢æÆ—FW&Â‚&FV6—6–öåö6&B"’À¢6÷W&6TFV6—6–öä6&D–C¢¢ç7G&–ær‚’çG&–Ò‚’æÖ–âƒ’æÖ‚ƒc’À¢FV6—6–öå66÷S¢¢ç7G&–ær‚’çG&–Ò‚’æÖ–âƒ’æÖ‚ƒS’À¢Ò“° ¢òò–çV—&–W2&R–â×ÆFf÷&Ò6öçF7BæB&WV—&RGW&&ÆRFV6—6–öâ6&Bà¢ç÷7B‚"ö’öÖ&¶WGÆ6Rö–çV—&–W2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BW6W$–BÒ7G&–ær‡W6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7B'W–W$–BÒ7G&–ær‡W6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚'W–W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B'6VD–çV—'’ÒÖ&¶WGÆ6T–çV—'•&WVW7E66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VD–çV—'’ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$fÆ–BW†6†ævRFV6—6–öâ6&B—2&WV—&VB&Vf÷&RÖW76v–ær6VÆÆW"â"À¢&V6öä6öFS¢$DT4•4”ôåô4$Eõ$UT•$TB"À¢—77VW3¢'6VD–çV—'’æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VD–çV—'’æFF°¢6öç7BFV6—6–öå66÷RÒÖ&¶WGÆ6UöÆ—7F–æs¢G·fÆ–FFVDFFæÆ—7F–æt–GÖ°¢–b‡fÆ–FFVDFFæFV6—6–öå66÷RÓÒFV6—6–öå66÷R’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$FV6—6–öâ6&B66÷RFöW2æ÷BÖF6‚F†—2Æ—7F–ærâ"À¢&V6öä6öFS¢$DT4•4”ôåõ44õUôÔ•4ÔD4‚"À¢Ò“°¢Ð ¢òòvWBF†RÆ—7F–ærFòf–æBF†R6VÆÆW ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær‡fÆ–FFVDFFæÆ—7F–æt–B“°¢–b‚Æ—7F–ærÇÂ7G&–ær†Æ—7F–ærç7FGW2ÇÂ""’ÓÒ&7F—fR"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7B6VÆÆW$–BÒ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""“°¢6öç7B6fTÆ—7F–æuF—FÆRÒ6æ—F—¦UV&Æ–4Æ—7F–æuFW‡B†Æ—7F–ærçF—FÆRÂ#’ÇÂ$W†6†ævRÆ—7F–ær#°¢–b‚6VÆÆW$–BÇÂ6VÆÆW$–BÓÓÒ'W–W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%–÷R6ææ÷B–çV—&R&÷WB–÷W"÷vâÆ—7F–ærâ"Ò“°¢Ð¢6öç7BW‡÷7W&TWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö…·6VÆÆW$–EÒ“°¢–b†W‡÷7W&TWF†÷&—G•·6VÆÆW$–EÒÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B¶FV6—6–öåÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ†FV6—6–öä6&G2¢çv†W&R€¢æB€¢W†FV6—6–öä6&G2æ–BÂfÆ–FFVDFFç6÷W&6TFV6—6–öä6&D–B’À¢W†FV6—6–öä6&G2çW6W$–BÂ'W–W$–B¢¢¢æÆ–Ö—Bƒ“°¢–b€¢FV6—6–öâÇÀ¢FV6—6–öâç7FGW2ÓÒ&7F—fR"ÇÀ¢FV6—6–öâæ–çFVçBÓÒ&6öÆÆ&÷&FR"ÇÀ¢FV6—6–öâæFV6—6–öå66÷RÓÒFV6—6–öå66÷P¢’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$FV6—6–öâ6&Bæ÷Bf÷VæBÂ–æ7F—fRÂ÷"Ö—6ÖF6†VBâ"À¢&V6öä6öFS¢$”ådÄ”EôDT4•4”ôåô4$B"À¢Ò“°¢Ð ¢6öç7B6fTÖW76vRÒ6æ—F—¦UV&Æ–4Æ—7F–æuFW‡B‡fÆ–FFVDFFæÖW76vRÂC“°¢–b‚6fTÖW76vR’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çV—'’ÖW76vR—2&WV—&VB"Ò“° ¢6öç7B–çV—'’Òv—B7F÷&vRæ7&VFTÖ&¶WGÆ6T–çV—'’‡°¢Æ—7F–æt–C¢fÆ–FFVDFFæÆ—7F–æt–BÀ¢ÖW76vS¢6fTÖW76vRÀ¢öffW$Ö÷VçC¢fÆ–FFVDFFæöffW$Ö÷VçBÓÒçVÆÂòçVÆÂ¢7G&–ær‡fÆ–FFVDFFæöffW$Ö÷VçB’À¢'W–W%†öæS¢çVÆÂÀ¢'W–W$VÖ–Ã¢çVÆÂÀ¢&VfW'&VD6öçF7DÖWF†öC¢&ÖW76vR"À¢'W–W$–BÀ¢6VÆÆW$–BÀ¢Ò“° ¢òò)H)Hv—&R–çV—'’–çFòF†RÖ&¶WGÆ6R6öçfW'6F–öâF‡&VB)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢òò&WW6RâW†—7F–ær6öçfW'6F–öâf÷"F†—2Æ—7F–ær¶'W–W"·6VÆÆW"—"Â÷ ¢òò7&VFRæWröæR6òF†R6VÆÆW"6â&WÇ’g&öÒF†V—"–æ&÷‚à¢G'’°¢6öç7BöffW$Ö÷VçBÒfÆ–FFVDFFæöffW$Ö÷VçC°¢6öç7BÖW76vT6öçFVçBÒöffW$Ö÷Vç@¢òG·6fTÖW76vWÕÆåÆäöffW#¢BG´çVÖ&W"†öffW$Ö÷VçB’çFôÆö6ÆU7G&–ær‚—Ö ¢¢6fTÖW76vS° ¢ÆWB6öçfW'6F–öâÒv—B7F÷&vRævWDÖ&¶WGÆ6T6öçfW'6F–öä'•'F–6—çG2€¢fÆ–FFVDFFæÆ—7F–æt–BÀ¢'W–W$–BÀ¢6VÆÆW$–@¢“°¢–b‚6öçfW'6F–öâÇÂ6öçfW'6F–öâæWF†÷&—G”vFRÓÒ&FV6—6–öåö6&B"’°¢6öçfW'6F–öâÒv—B7F÷&vRæ7&VFTÖ&¶WGÆ6T6öçfW'6F–öâ‡°¢Æ—7F–æt–C¢fÆ–FFVDFFæÆ—7F–æt–BÀ¢'W–W$–BÀ¢6VÆÆW$–BÀ¢7FGW3¢&7F—fR"À¢–çFVçC¢&6öÆÆ&÷&FR"À¢WF†÷&—G”vFS¢&FV6—6–öåö6&B"À¢6÷W&6TFV6—6–öä6&D–C¢fÆ–FFVDFFç6÷W&6TFV6—6–öä6&D–BÀ¢FV6—6–öå66÷RÀ¢Ò2ç’“°¢Ð¢v—B7F÷&vRæ7&VFTÖ&¶WGÆ6TÖW76vR‡°¢6öçfW'6F–öä–C¢6öçfW'6F–öâæ–BÀ¢6VæFW$–C¢'W–W$–BÀ¢6VæFW%G—S¢&'W–W""À¢6öçFVçC¢ÖW76vT6öçFVçBÀ¢ÖW76vUG—S¢öffW$Ö÷VçBò&öffW""¢'FW‡B"À¢ÖWFFF¢öffW$Ö÷VçBò²öffW$Ö÷VçC¢çVÖ&W"†öffW$Ö÷VçB’Ò¢VæFVf–æVBÀ¢Ò“° ¢òò)H)Hæ÷F–g’F†R6VÆÆW")H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H ¢6öç7B'W–W%W6W"Òv—B7F÷&vRævWEW6W"†'W–W$–B“°¢6öç7B'W–W$æÖRÒ'W–W%W6W#òæf—'7DæÖRò'W–W%W6W"æf—'7DæÖR¢%6öÖVöæR#°¢6öç7Bæ÷F–eF—FÆRÒöffW$Ö÷Vç@¢òæWröffW"öâ"G·6fTÆ—7F–æuF—FÆWÒ& ¢¢æWr–çV—'’öâ"G·6fTÆ—7F–æuF—FÆWÒ&°¢6öç7Bæ÷F–d×6rÒöffW$Ö÷Vç@¢òG¶'W–W$æÖWÒÖFRâöffW"öbBG´çVÖ&W"†öffW$Ö÷VçB’çFôÆö6ÆU7G&–ær‚—Òöâ–÷W"Æ—7F–æræ ¢¢G¶'W–W$æÖWÒ6VçB–÷RÖW76vR&÷WB–÷W"Æ—7F–æræ° ¢òò–âÖæ÷F–f–6F–öâ†f—&RÖæBÖf÷&vWB¢fö–Bæ÷F–f–6F–öå6W'f–6P¢æ7&VFTæ÷F–f–6F–öâ‡°¢W6W$–C¢6VÆÆW$–BÀ¢G—S¢&æWuöÖW76vR"À¢&–÷&—G“¢&†–v‚"À¢F—FÆS¢æ÷F–eF—FÆRÀ¢ÖW76vS¢æ÷F–d×6rÀ¢7F–öåW&Ã¢öÖW76vW3÷F‡&VCÒG¶6öçfW'6F–öâæ–GÒgG—SÖÖ&¶WGÆ6VÀ¢7F–öåFW‡C¢%f–WrÖW76vR"À¢–6öäæÖS¢$ÖW76vT6—&6ÆR"À¢–6öä6öÆ÷#¢&÷&ævR"À¢FVÆ—fW'”ÖWF†öG3¢²&–åö"Â'W6‚%ÒÀ¢ÖWFFF¢°¢6öçfW'6F–öä–C¢6öçfW'6F–öâæ–BÀ¢Æ—7F–æt–C¢fÆ–FFVDFFæÆ—7F–æt–BÀ¢–çV—'”–C¢–çV—'’æ–BÀ¢ÒÀ¢Ò¢æ6F6‚‚†S¢ç’’Óâ6öç6öÆRæW'&÷"‚%¶–çV—&–W5Ò6VÆÆW"–âÖæ÷F–f–6F–öâf–ÆVC¢"ÂR’“° ¢òòVÖ–Âæ÷F–f–6F–öâ†&W7BÖVff÷'B¢–b†VÖ–Å6W'f–6Ræ—46öæf–wW&VB‚’’°¢6öç7B6VÆÆW%W6W"Òv—B7F÷&vRævWEW6W"‡6VÆÆW$–B“°¢–b‡6VÆÆW%W6W#òæVÖ–Â’°¢6öç7B6fTVÖ–ÄÖW76vRÒæ÷F–d×6p¢ç&WÆ6R‚òbörÂ"f×²"¢ç&WÆ6R‚óÂörÂ"fÇC²"¢ç&WÆ6R‚óâörÂ"fwC²"¢ç&WÆ6R‚ò"örÂ"gV÷C²"¢ç&WÆ6R‚òrörÂ"b33“²"“°¢fö–BVÖ–Å6W'f–6P¢ç6VæDVÖ–Â‡°¢Fó¢6VÆÆW%W6W"æVÖ–ÂÀ¢7V&¦V7C¢æ÷F–eF—FÆRÀ¢‡FÖÃ¢ÇâG·6fTVÖ–ÄÖW76vWÓÂ÷ãÇãÆ‡&VcÒ&‡GG3¢ò÷wwrçF†WG&FW66÷WBæ6öÒöÖW76vW3÷F‡&VCÒG¶6öçfW'6F–öâæ–GÒgG—SÖÖ&¶WGÆ6R#å&WÇ’–âG&FU66÷WCÂöãÂ÷æÀ¢FW‡C¢G¶æ÷F–d×6wÕÆåÆå&WÇ’C¢‡GG3¢ò÷wwrçF†WG&FW66÷WBæ6öÒöÖW76vW3÷F‡&VCÒG¶6öçfW'6F–öâæ–GÒgG—SÖÖ&¶WGÆ6VÀ¢W'÷6S¢&Ö&¶WGÆ6Uö–çV—'’"À¢Ò¢æ6F6‚‚†S¢ç’’Óâ6öç6öÆRæW'&÷"‚%¶–çV—&–W5Ò6VÆÆW"VÖ–Âæ÷F–f–6F–öâf–ÆVC¢"ÂR’“°¢Ð¢Ð¢Ò6F6‚‡F‡&VDW'#¢ç’’°¢òòF‡&VBöæ÷F–f–6F–öâf–ÇW&R×W7BæWfW"&Æö6²F†R–çV—'’&W7öç6P¢6öç6öÆRæW'&÷"‚%¶–çV—&–W5Ò6öçfW'6F–öâF‡&VB6WGWf–ÆVC¢"ÂF‡&VDW'"“°¢Ð¢òò)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H)H  ¢v—BF ¢çWFFR†FV6—6–öä6&G2¢ç6WB‡²7FGW3¢&6ö×ÆWFVB"ÂFV6–FVDC¢æWrFFR‚’ÂWFFVDC¢æWrFFR‚’Ò¢çv†W&R†W†FV6—6–öä6&G2æ–BÂfÆ–FFVDFFç6÷W&6TFV6—6–öä6&D–B’“° ¢&W2ç7FGW2ƒ#’æ§6öâ†–çV—'’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6R–çV—'“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–çV—'’"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öÖ&¶WGÆ6Rö–çV—&–W2÷6VçB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B–çV—&–W2Òv—B7F÷&vRævWEW6W$–çV—&–W2‡W6W#òæ–BÂ'6VçB"“°¢&W2æ§6öâ†–çV—&–W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6VçB–çV—&–W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–çV—&–W2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öÖ&¶WGÆ6Rö–çV—&–W2÷&V6V—fVB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B–çV—&–W2Òv—B7F÷&vRævWEW6W$–çV—&–W2‡W6W#òæ–BÂ'&V6V—fVB"“°¢&W2æ§6öâ†–çV—&–W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&V6V—fVB–çV—&–W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–çV—&–W2"Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’öÖ&¶WGÆ6RöÆ—7F–æw2ó¦–Bö–çV—&–W2"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢òò6†V6²–bW6W"÷vç2F†RÆ—7F–æp¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†–B“°¢–b‚Æ—7F–ærÇÂÆ—7F–ærç6VÆÆW$–BÓÒW6W#òæ–B’°¢&WGW&â&W0¢ç7FGW2ƒC2¢æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòf–Wr–çV—&–W2f÷"F†—2Æ—7F–ær"Ò“°¢Ð ¢6öç7B–çV—&–W2Òv—B7F÷&vRævWDÆ—7F–æt–çV—&–W2†–B“°¢&W2æ§6öâ†–çV—&–W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÆ—7F–ær–çV—&–W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–çV—&–W2"Ò“°¢Ð¢Ð¢“° ¢çWB‚"ö’öÖ&¶WGÆ6Rö–çV—&–W2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢òò6†V6²–bW6W"÷vç2F†R–çV—'’‡6VÆÆW"6–FR¢6öç7B–çV—'’Òv—B7F÷&vRævWDÖ&¶WGÆ6T–çV—'’†–B“°¢–b‚–çV—'’ÇÂ–çV—'’ç6VÆÆW$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòWFFRF†—2–çV—'’"Ò“°¢Ð ¢6öç7BWFFW2Ò&Wæ&öG“°¢6öç7BWFFVD–çV—'’Òv—B7F÷&vRçWFFTÖ&¶WGÆ6T–çV—'’†–BÂWFFW2“°¢&W2æ§6öâ‡WFFVD–çV—'’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærÖ&¶WGÆ6R–çV—'“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR–çV—'’"Ò“°¢Ð¢Ò“° ¢òòff÷&—FW0¢ç÷7B‚"ö’öÖ&¶WGÆ6Röff÷&—FW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BW6W$–BÒ7G&–ær‡W6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7B'6VDff÷&—FRÒ ¢æö&¦V7B‡²Æ—7F–æt–C¢¢ç7G&–ær‚’çG&–Ò‚’æÖ–âƒ’æÖ‚ƒc’Ò¢ç6fU'6R‡&Wæ&öG’“°¢–b‚'6VDff÷&—FRç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6Rff÷&—FR–ÆöB"À¢—77VW3¢'6VDff÷&—FRæW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VDff÷&—FRæFF°¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær‡fÆ–FFVDFFæÆ—7F–æt–B“°¢–b‚Æ—7F–ærÇÂ7G&–ær†Æ—7F–ærç7FGW2ÇÂ""’ÓÒ&7F—fR"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö…µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""•Ò“°¢–b†WF†÷&—G•µ7G&–ær†Æ—7F–ærç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bff÷&—FRÒv—B7F÷&vRæ7&VFTÖ&¶WGÆ6Tff÷&—FR‡°¢ââçfÆ–FFVDFFÀ¢W6W$–BÀ¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ†ff÷&—FR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6Rff÷&—FS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFBFòff÷&—FW2"Ò“°¢Ð¢Ò“° ¢æFVÆWFR€¢"ö’öÖ&¶WGÆ6Röff÷&—FW2ó¦Æ—7F–æt–B"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BW6W$–BÒ7G&–ær‡W6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7B²Æ—7F–æt–BÒÒ&Wç&×3° ¢v—B7F÷&vRç&VÖ÷fTÖ&¶WGÆ6Tff÷&—FR‡W6W$–BÂÆ—7F–æt–B“°¢&W2æ§6öâ‡²ÖW76vS¢%&VÖ÷fVBg&öÒff÷&—FW2"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&VÖ÷f–ærÖ&¶WGÆ6Rff÷&—FS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&VÖ÷fRg&öÒff÷&—FW2"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’öÖ&¶WGÆ6Röff÷&—FW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BW6W$–BÒ7G&–ær‡W6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7Bff÷&—FW2Òv—B7F÷&vRævWEW6W$ff÷&—FW2‡W6W$–B“°¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö€¢ff÷&—FW2æÖ‚†Æ—7F–æs¢ç’’Óâ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’¢“°¢&W2æ§6öâ€¢ff÷&—FW0¢æf–ÇFW"€¢†Æ—7F–æs¢ç’’Óà¢WF†÷&—G•µ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÓÒG'VRb`¢7G&–ær†Æ—7F–æsòç7FGW2ÇÂ""’ÓÓÒ&7F—fR ¢¢æÖ‚†Æ—7F–æs¢ç’’ÓâFõV&Æ–4W†6†ævTÆ—7F–ær†Æ—7F–ær’¢æf–ÇFW"„&ööÆVâ¢“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6Rff÷&—FW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚ff÷&—FW2"Ò“°¢Ð¢Ò“° ¢òò&W÷'G0¢ç÷7B‚"ö’öÖ&¶WGÆ6R÷&W÷'G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B'6VE&W÷'BÒ–ç6W'DÖ&¶WGÆ6U&W÷'E66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VE&W÷'Bç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖ&¶WGÆ6R&W÷'B–ÆöB"À¢—77VW3¢'6VE&W÷'BæW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VE&W÷'BæFF° ¢6öç7B&W÷'BÒv—B7F÷&vRæ7&VFTÖ&¶WGÆ6U&W÷'B‡°¢ââçfÆ–FFVDFFÀ¢&W÷'FW$–C¢W6W#òæ–BÇÂçVÆÂÀ¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡&W÷'B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6R&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&W÷'B"Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’öÖ&¶WGÆ6RöFÖ–â÷&W÷'G2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B&W÷'G2Òv—B7F÷&vRævWDÖ&¶WGÆ6U&W÷'G2‚“°¢&W2æ§6öâ‡&W÷'G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6R&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&W÷'G2"Ò“°¢Ð¢Ð¢“° ¢çWB€¢"ö’öÖ&¶WGÆ6RöFÖ–â÷&W÷'G2ó¦–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BWFFW2Ò&Wæ&öG“° ¢6öç7B&W÷'BÒv—B7F÷&vRçWFFTÖ&¶WGÆ6U&W÷'B†–BÂWFFW2“°¢&W2æ§6öâ‡&W÷'B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærÖ&¶WGÆ6R&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR&W÷'B"Ò“°¢Ð¢Ð¢“° ¢òòÖ&¶WGÆ6RfW&–f–6F–öâVæGö–çG0¢ç÷7B‚"ö’öÖ&¶WGÆ6R÷fVæF÷"×fW&–f–6F–öâ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢òò3"Ó3¢6ögBvFRÒöffW"FG&W72fW&–f–6F–öâf÷"Ö&¶WGÆ6RfVæF÷"G'W7B„$T4ôÔUôÔ$´UEÄ4UõdTäDõ"¢6öç7B7W'&VçEW6W"Òv—B7F÷&vRævWEW6W"‡W6W#òæ–B“°¢6öç7B—5fW&–f–VBÒ†7W'&VçEW6W"2ç’“òæFG&W75fW&–f–VC° ¢–b‚—5fW&–f–VB’°¢6öç7B²'V–ÆE6ögDvFTöffW"Â'V–ÆE6ögDvFU&W7öç6RÒÐ¢v—B–×÷'B‚"â÷WF–Ç2÷6ögDvFTg&ÖWv÷&²"“° ¢6öç7BöffW"Ò'V–ÆE6ögDvFTöffW"‡°¢7F–öã¢$$T4ôÔUôÔ$´UEÄ4UõdTäDõ""À¢W6W%&öÆS¢†7W'&VçEW6W"2ç’“òç&öÆRÇÂ'W6W""À¢Ö—76–æu&WV—&VÖVçG3¢²&FG&W72%ÒÀ¢6öçFW‡C¢²–çFVçC¢&&V6öÖU÷fVæF÷""ÒÀ¢Ò“° ¢6öç7B&W7öç6RÒ'V–ÆE6ögDvFU&W7öç6R†öffW"Â$$T4ôÔUôÔ$´UEÄ4UõdTäDõ""“° ¢òò&WGW&â6ögBvFR'WBÆÆ÷r&ö6VVF–æp¢&WGW&â&W2ç7FGW2ƒ#’æ§6öâ‡°¢ââç&W7öç6RÀ¢fW&–f–6F–öå7VvvW7FVC¢°¢7F–öã¢$$T4ôÔUôÔ$´UEÄ4UõdTäDõ""À¢&VæVf—G3¢öffW"æ&VæVf—G2À¢ÒÀ¢ÆÆ÷u&ö6VVEVçfW&–f–VC¢G'VRÀ¢Ò“°¢Ð ¢6öç7B'6VEfVæF÷"Ò–ç6W'EfVæF÷%fW&–f–6F–öå66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VEfVæF÷"ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BfVæF÷"fW&–f–6F–öâ–ÆöB"À¢—77VW3¢'6VEfVæF÷"æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VEfVæF÷"æFF° ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRæ7&VFUfVæF÷%fW&–f–6F–öâ‡°¢ââçfÆ–FFVDFFÀ¢W6W$–C¢W6W#òæ–BÀ¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærfVæF÷"fW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRfVæF÷"fW&–f–6F–öâ"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’öÖ&¶WGÆ6Rö'W–W"×fW&–f–6F–öâ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B'6VD'W–W"Ò–ç6W'D'W–W%fW&–f–6F–öå66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VD'W–W"ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–B'W–W"fW&–f–6F–öâ–ÆöB"À¢—77VW3¢'6VD'W–W"æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VD'W–W"æFF° ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRæ7&VFT'W–W%fW&–f–6F–öâ‡°¢ââçfÆ–FFVDFFÀ¢W6W$–C¢W6W#òæ–BÀ¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær'W–W"fW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR'W–W"fW&–f–6F–öâ"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öÖ&¶WGÆ6R÷fW&–f–6F–öâ÷7FGW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢6öç7BfVæF÷%fW&–f–6F–öâÒv—B7F÷&vRævWEfVæF÷%fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“°¢6öç7B'W–W%fW&–f–6F–öâÒv—B7F÷&vRævWD'W–W%fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“° ¢&W2æ§6öâ‡°¢fVæF÷#¢fVæF÷%fW&–f–6F–öâÇÂçVÆÂÀ¢'W–W#¢'W–W%fW&–f–6F–öâÇÂçVÆÂÀ¢—5fVæF÷%fW&–f–VC¢fVæF÷%fW&–f–6F–öãòç7FGW2ÓÓÒ&&÷fVB"À¢—4'W–W%fW&–f–VC¢'W–W%fW&–f–6F–öãòç7FGW2ÓÓÒ&&÷fVB"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærfW&–f–6F–öâ7FGW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚fW&–f–6F–öâ7FGW2"Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’öÖ&¶WGÆ6RöFÖ–â÷fW&–f–6F–öç2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²G—RÒ&ÆÂ"Â7FGW2Ò&ÆÂ"ÒÒ&WçVW'“° ¢6öç7BfW&–f–6F–öç2Òv—B7F÷&vRævWEfW&–f–6F–öç2‡°¢G—S¢G—R27G&–ærÀ¢7FGW3¢7FGW227G&–ærÀ¢Ò“° ¢&W2æ§6öâ‡fW&–f–6F–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærfW&–f–6F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚fW&–f–6F–öç2"Ò“°¢Ð¢Ð¢“° ¢òòVæ–f–VBæ÷F–f–6F–öç27VÖÖ'’VæGö–ç@¢òòäõDS¢FWF–ÆVBæ÷F–f–6F–öâÆ—7B²7F–öç2Æ—fR–â&÷WFW2öæ÷F–f–6F–öâ×&÷WFW2çG0¢ævWB‚"ö’öæ÷F–f–6F–öç2÷7VÖÖ'’"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B7VÖÖ'’Òv—B‡7F÷&vR2ç’’ævWDæ÷F–f–6F–öç57VÖÖ'’‡W6W#òæ–B“°¢&W2æ§6öâ‡²7VÖÖ'’Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"–âö’öæ÷F–f–6F–öç2"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢$f–ÆVBFòÆöBæ÷F–f–6F–öç2"Ò“°¢Ð¢Ò“° ¢çWB€¢"ö’öÖ&¶WGÆ6RöFÖ–â÷fW&–f–6F–öç2ó¦–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²7FGW2ÂFÖ–äæ÷FW2ÒÒ&Wæ&öG“°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢6öç7BWFFW2Ò°¢7FGW2À¢FÖ–äæ÷FW2À¢&Wf–WvVD'“¢W6W#òæ–BÀ¢&Wf–WvVDC¢æWrFFR‚’À¢Ó° ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRçWFFUfW&–f–6F–öâ†–BÂWFFW2“°¢&W2æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærfW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRfW&–f–6F–öâ"Ò“°¢Ð¢Ð¢“° ¢òòFÖ–âfW&–f–6F–öâ’†æ÷&ÖÆ—¦VBf–Wrf÷"÷2v÷&·76R¢ævWB‚"ö’öFÖ–â÷fW&–f–6F–öç2"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²G—RÒ&ÆÂ"Â7FGW2Ò'VæF–ær"ÒÒ&WçVW'“° ¢6öç7BfW&–f–6F–öç2Òv—B7F÷&vRævWEfW&–f–6F–öç2‡°¢G—S¢‡G—R27G&–ær’ÇÂ&ÆÂ"À¢7FGW3¢‡7FGW227G&–ær’ÇÂ'VæF–ær"À¢Ò“° ¢6öç7Bæ÷rÒæWrFFR‚“° ¢6öç7Bæ÷&ÖÆ—¦VBÒ‡fW&–f–6F–öç2ÇÂµÒ’æÖ‚‡c¢ç’’Óâ°¢6öç7B—5fVæF÷"Ò&ööÆVâ‚‡b2ç’’æ6FVv÷'”–B“° ¢6öç7B7V&Ö—GFVDC¢7G&–ærÒ€¢bæ7&VFVDBÇÀ¢bç7V&Ö—GFVDBÇÀ¢bçWFFVDBÇÀ¢æ÷p¢’çFô•4õ7G&–ær‚“° ¢òòFW&—fRFö7VÖVçB7FGW6W2g&öÒf–Æ&ÆRf–VÆG0¢6öç7B†4Æ–6Vç6RÒ&ööÆVâ€¢‡b2ç’’æ'W6–æW74Æ–6Vç6UW&ÂÇÂ‡b2ç’’æ'W6–æW74Æ–6Vç6TçVÖ&W ¢“° ¢ÆWB–ç7W&æ6U7FGW3¢&ööÆVâÂ&W‡—&W5÷6ööâ"ÒfÇ6S°¢6öç7B–ç7W&æ6TW‡—'’Ò‡b2ç’’æ–ç7W&æ6TW‡—'¢òæWrFFR‚‡b2ç’’æ–ç7W&æ6TW‡—'’¢¢çVÆÃ°¢–b‚‡b2ç’’æ–ç7W&æ6T6W'F–f–6FUW&ÂÇÂ–ç7W&æ6TW‡—'’’°¢–b†–ç7W&æ6TW‡—'’’°¢6öç7BF–fdF—2Ò†–ç7W&æ6TW‡—'’ævWEF–ÖR‚’Òæ÷rævWEF–ÖR‚’’òƒ¢c¢c¢#B“°¢–ç7W&æ6U7FGW2ÒF–fdF—2ÃÒ3ò&W‡—&W5÷6ööâ"¢G'VS°¢ÒVÇ6R°¢–ç7W&æ6U7FGW2ÒG'VS°¢Ð¢Ð ¢6öç7B†4–BÒ&ööÆVâ‚‡b2ç’’æ–FVçF—G”Fö7VÖVçEW&ÂÇÂ‡b2ç’’æ–FVçF—G•fW&–f–VB“° ¢&WGW&â°¢–C¢bæ–BÀ¢¶–æC¢—5fVæF÷"ò'fVæF÷""¢&'W–W""À¢7FGW3¢bç7FGW2À¢W6W$–C¢bçW6W$–BÀ¢6ö×ç”æÖS¢—5fVæF÷"òbæ'W6–æW74æÖRÇÂçVÆÂ¢çVÆÂÀ¢G&FS¢çVÆÂÀ¢6W'f–6T&V¢çVÆÂÀ¢Æ–6Vç6TçVÖ&W#¢—5fVæF÷"òbæ'W6–æW74Æ–6Vç6TçVÖ&W"ÇÂçVÆÂ¢çVÆÂÀ¢7V&Ö—GFVDBÀ¢Fö7VÖVçG3¢°¢Æ–6Vç6S¢†4Æ–6Vç6RÀ¢–ç7W&æ6S¢–ç7W&æ6U7FGW2À¢–C¢†4–BÀ¢ÒÀ¢Ó°¢Ò“° ¢&W2æ§6öâ†æ÷&ÖÆ—¦VB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFÖ–âfW&–f–6F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚FÖ–âfW&–f–6F–öç2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’öFÖ–â÷fW&–f–6F–öç2ó¦–Bö7F–öç2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²7F–öâÂ&V6öâÒÒ&Wæ&öG’2²7F–öã¢7G&–æs²&V6öãó¢7G&–ærÓ°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢–b‚²&&÷fR"Â'&V¦V7B"Â'&WVW7E÷WFFR%Òæ–æ6ÇVFW2†7F–öâ’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B7F–öâ"Ò“°¢Ð ¢6öç7BWFFW3¢ç’Ò°¢&Wf–WvVD'“¢W6W#òæ–BÀ¢&Wf–WvVDC¢æWrFFR‚’À¢WFFVDC¢æWrFFR‚’À¢Ó° ¢–b†7F–öâÓÓÒ&&÷fR"’°¢WFFW2ç7FGW2Ò&&÷fVB#°¢WFFW2ç&V¦V7F–öå&V6öâÒçVÆÃ°¢ÒVÇ6R–b†7F–öâÓÓÒ'&V¦V7B"’°¢WFFW2ç7FGW2Ò'&V¦V7FVB#°¢WFFW2ç&V¦V7F–öå&V6öâÒ&V6öâÇÂ%&V¦V7FVB'’FÖ–â#°¢ÒVÇ6R–b†7F–öâÓÓÒ'&WVW7E÷WFFR"’°¢WFFW2ç7FGW2Ò&–å÷&Wf–Wr#°¢–b‡&V6öâ’°¢WFFW2æFÖ–äæ÷FW2Ò&V6öã°¢Ð¢Ð ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRçWFFUfW&–f–6F–öâ†–BÂWFFW2“°¢&W2æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&ö6W76–ærFÖ–âfW&–f–6F–öâ7F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&ö6W72fW&–f–6F–öâ7F–öâ"Ò“°¢Ð¢Ð¢“° ¢òòFG&W72fW&–f–6F–öâVæGö–çG0¢ç÷7B‚"ö’öFG&W72×fW&–f–6F–öâ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B'6VDFG&W72Ò–ç6W'DFG&W75fW&–f–6F–öå66†VÖç6fU'6R‡&Wæ&öG’“°¢–b‚'6VDFG&W72ç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BFG&W72fW&–f–6F–öâ–ÆöB"À¢—77VW3¢'6VDFG&W72æW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDFFÒ'6VDFG&W72æFF° ¢òò6Æ7VÆFRFVFÆ–æRƒBF—2g&öÒW6W"7&VF–öâ¢6öç7BW6W$7&VFVDBÒæWrFFR‡W6W"æ7&VFVDB“°¢6öç7BFVFÆ–æRÒæWrFFR‡W6W$7&VFVDB“°¢FVFÆ–æRç6WDFFR†FVFÆ–æRævWDFFR‚’²B“° ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRæ7&VFTFG&W75fW&–f–6F–öâ‡°¢ââçfÆ–FFVDFFÀ¢W6W$–C¢W6W#òæ–BÀ¢FVFÆ–æRÀ¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærFG&W72fW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRFG&W72fW&–f–6F–öâ"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’öFG&W72×fW&–f–6F–öâ÷7FGW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRævWDFG&W75fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“° ¢òò6Æ7VÆFRFVFÆ–æR–bæòfW&–f–6F–öâW†—7G0¢6öç7BW6W$7&VFVDBÒæWrFFR‡W6W"æ7&VFVDB“°¢6öç7BFVFÆ–æRÒæWrFFR‡W6W$7&VFVDB“°¢FVFÆ–æRç6WDFFR†FVFÆ–æRævWDFFR‚’²B“° ¢6öç7BF—5&VÖ–æ–ærÒÖF‚æÖ‚€¢À¢ÖF‚æ6V–Â‚†FVFÆ–æRævWEF–ÖR‚’ÒFFRææ÷r‚’’òƒ¢c¢c¢#B’¢“°¢6öç7B—4W‡—&VBÒF—5&VÖ–æ–ærÓÓÒbbW6W"æFG&W75fW&–f–VC° ¢&W2æ§6öâ‡°¢fW&–f–6F–öã¢fW&–f–6F–öâÇÂçVÆÂÀ¢—5fW&–f–VC¢W6W"æFG&W75fW&–f–VBÇÂfÇ6RÀ¢FVFÆ–æS¢FVFÆ–æRçFô•4õ7G&–ær‚’À¢F—5&VÖ–æ–ærÀ¢—4W‡—&VBÀ¢&WV—&W5fW&–f–6F–öã¢W6W"æFG&W75fW&–f–VBÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFG&W72fW&–f–6F–öâ7FGW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚fW&–f–6F–öâ7FGW2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’öFG&W72×fW&–f–6F–öâ÷÷7F6&B÷&WVW7B"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢òòvVæW&FRbÖF–v—BfW&–f–6F–öâ6öFP¢6öç7B6öFRÒÖF‚æfÆö÷"ƒ²ÖF‚ç&æFöÒ‚’¢“’çFõ7G&–ær‚“° ¢v—B7F÷&vRç6VæDFG&W75fW&–f–6F–öå÷7F6&B‡W6W#òæ–BÂ6öFR“° ¢òò–â&VÂ–×ÆVÖVçFF–öâÂ–÷Rv÷VÆB6VæBF†R÷7F6&Bf–U52¢6öç6öÆRæÆör†÷7F6&BfW&–f–6F–öâ6öFRf÷"G·W6W#òæ–GÓ¢G¶6öFWÖ“° ¢&W2æ§6öâ‡°¢ÖW76vS ¢%fW&–f–6F–öâ÷7F6&B†2&VVâ6VçBFò–÷W"FG&W72â—B6†÷VÆB'&—fRv—F†–âRÓr'W6–æW72F—2â"À¢W7F–ÖFVDFVÆ—fW'“¢#RÓr'W6–æW72F—2"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&WVW7F–ær÷7F6&BfW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&WVW7B÷7F6&BfW&–f–6F–öâ"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’öFG&W72×fW&–f–6F–öâ÷÷7F6&B÷fW&–g’"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²6öFRÒÒ&Wæ&öG“° ¢–b‚6öFRÇÂ6öFRæÆVæwF‚ÓÒb’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%fÆ–BbÖF–v—B6öFR—2&WV—&VB"Ò“°¢Ð ¢6öç7B7V66W72Òv—B7F÷&vRçfW&–g”FG&W75v—F…÷7F6&B‡W6W#òæ–BÂ6öFR“° ¢–b‡7V66W72’°¢&W2æ§6öâ‡°¢ÖW76vS¢$FG&W72fW&–f–VB7V66W76gVÆÇ’–÷Ræ÷r†fRgVÆÂ66W72FòF†RÆFf÷&Òâ"À¢fW&–f–VC¢G'VRÀ¢Ò“°¢ÒVÇ6R°¢&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS ¢$–çfÆ–BfW&–f–6F–öâ6öFRâÆV6R6†V6²F†R6öFRöâ–÷W"÷7F6&BæBG'’v–ââ"À¢fW&–f–VC¢fÇ6RÀ¢Ò“°¢Ð¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fW&–g––ær÷7F6&B6öFS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfW&–g’÷7F6&B6öFR"Ò“°¢Ð¢Ð¢“° ¢çWB‚"ö’öFG&W72×fW&–f–6F–öâó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BWFFW2Ò&Wæ&öG“° ¢òòfW&–g’F†RW6W"÷vç2F†—2fW&–f–6F–öà¢6öç7BW†—7F–æufW&–f–6F–öâÒv—B7F÷&vRævWDFG&W75fW&–f–6F–öä'•W6W$–B‡W6W#òæ–B“°¢–b‚W†—7F–æufW&–f–6F–öâÇÂW†—7F–æufW&–f–6F–öâæ–BÓÒ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFòWFFRF†—2fW&–f–6F–öâ"Ò“°¢Ð ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRçWFFTFG&W75fW&–f–6F–öâ†–BÂ°¢ââçWFFW2À¢7V&Ö—GFVDC¢æWrFFR‚’À¢7FGW3¢'7V&Ö—GFVB"À¢Ò“° ¢&W2æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærFG&W72fW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRfW&–f–6F–öâ"Ò“°¢Ð¢Ò“° ¢òòFÖ–âVæGö–çG2f÷"FG&W72fW&–f–6F–öà¢ævWB€¢"ö’öFÖ–âöFG&W72×fW&–f–6F–öç2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7FGW2Ò‡&WçVW'’ç7FGW227G&–ær’ÇÂ&ÆÂ#° ¢ÆWBVW'“¢ç’ÒF ¢ç6VÆV7B‡°¢fW&–f–6F–öã¢FG&W75fW&–f–6F–öç2À¢W6W#¢W6W'2À¢Ò¢æg&öÒ†FG&W75fW&–f–6F–öç2¢æÆVgD¦ö–â‡W6W'2ÂW†FG&W75fW&–f–6F–öç2çW6W$–BÂW6W'2æ–B’“° ¢–b‡7FGW2ÓÒ&ÆÂ"’°¢6öç7BÆÆ÷vVE7FGW6W2Ò°¢'VæF–ær"À¢&&÷fVB"À¢'&V¦V7FVB"À¢&W‡—&VB"À¢'7V&Ö—GFVB"À¢Ò26öç7C°¢–b†ÆÆ÷vVE7FGW6W2æ–æ6ÇVFW2‡7FGW22‡G—VöbÆÆ÷vVE7FGW6W2•¶çVÖ&W%Ò’’°¢VW'’ÒVW'’çv†W&R€¢W†FG&W75fW&–f–6F–öç2ç7FGW2Â7FGW22‡G—VöbÆÆ÷vVE7FGW6W2•¶çVÖ&W%Ò¢“°¢Ð¢Ð ¢6öç7B&W7VÇG2Òv—BVW'’æ÷&FW$'’†FW62†FG&W75fW&–f–6F–öç2æ7&VFVDB’“° ¢&W2æ§6öâ‡&W7VÇG2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFG&W72fW&–f–6F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚fW&–f–6F–öç2"Ò“°¢Ð¢Ð¢“° ¢çWB€¢"ö’öFÖ–âöFG&W72×fW&–f–6F–öç2ó¦–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²7FGW2ÂFÖ–äæ÷FW2ÒÒ&Wæ&öG“°¢6öç7BW6W"Ò&WçW6W"2ç“° ¢6öç7BWFFW3¢ç’Ò°¢7FGW2À¢FÖ–äæ÷FW2À¢&Wf–WvVD'“¢W6W#òæ–BÀ¢&Wf–WvVDC¢æWrFFR‚’À¢Ó° ¢–b‡7FGW2ÓÓÒ&&÷fVB"’°¢WFFW2æ&÷fVDBÒæWrFFR‚“° ¢òòvWBfW&–f–6F–öâ&V6÷&BFòf–æBF†RW6W ¢6öç7B·fW&–f–6F–öåÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ†FG&W75fW&–f–6F–öç2¢çv†W&R†W†FG&W75fW&–f–6F–öç2æ–BÂ–B’“°¢–b‡fW&–f–6F–öâ’°¢v—B7F÷&vRçWFFUW6W"‡fW&–f–6F–öâçW6W$–BÂ²FG&W75fW&–f–VC¢G'VRÒ“°¢Ð¢Ð ¢6öç7BfW&–f–6F–öâÒv—B7F÷&vRçWFFTFG&W75fW&–f–6F–öâ†–BÂWFFW2“°¢&W2æ§6öâ‡fW&–f–6F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærFG&W72fW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRfW&–f–6F–öâ"Ò“°¢Ð¢Ð¢“° ¢òòFÖ–â&Wf–WrVWVRf÷"Æ–6Vç6Rö–ç7W&æ6R÷F‚Ö–Bö'W6–æW72×&Vv—7G&F–öâ7V&Ö—76–öç0¢òò6GW&VBf–ö’÷&öf–ÆR÷fW&–f–6F–öâ‡6VÆb×&W÷'FVBÂv—F–ær&Wf–Wr’à¢ævWB€¢"ö’öFÖ–â÷&öf–ÆR×fW&–f–6F–öç2"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B7FGW4f–ÇFW"Ò7G&–ær‚‡&WçVW'’ç7FGW227G&–ær’ÇÂ&ÆÂ"¢çG&–Ò‚¢çFôÆ÷vW$66R‚“°¢–b€¢°¢&ÆÂ"À¢'VæF–ær"À¢'VæFW%÷&Wf–Wr"À¢&&÷fVB"À¢'&V¦V7FVB"À¢&W‡—&VB"À¢'7W7VæFVB"À¢Òæ–æ6ÇVFW2‡7FGW4f–ÇFW"¢’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B7FGW2f–ÇFW""Ò“°¢Ð ¢6öç7B&÷w2Òv—BF ¢ç6VÆV7B‡°¢&öf–ÆT–C¢W6W%&öf–ÆW2æ–BÀ¢&öf–ÆUW6W$–C¢W6W%&öf–ÆW2çW6W$–BÀ¢F—7Æ”æÖS¢W6W%&öf–ÆW2æF—7Æ”æÖRÀ¢W6W$–çFVçC¢W6W%&öf–ÆW2çW6W$–çFVçBÀ¢'W6–æW75G—S¢W6W%&öf–ÆW2æ'W6–æW75G—RÀ¢6W'f–6UFw3¢W6W%&öf–ÆW2ç6W'f–6UFw2À¢6VÆÆW%Fw3¢W6W%&öf–ÆW2ç6VÆÆW%Fw2À¢fW&–f–6F–öå&WV—&VÖVçG3¢W6W%&öf–ÆW2çfW&–f–6F–öå&WV—&VÖVçG2À¢fW&–f–6F–öå7FGW3¢W6W%&öf–ÆW2çfW&–f–6F–öå7FGW2À¢fW&–f–6F–öå7V&Ö—76–öç3¢W6W%&öf–ÆW2çfW&–f–6F–öå7V&Ö—76–öç2À¢VÖ–ÅfW&–f–VC¢W6W%&öf–ÆW2æVÖ–Å÷fW&–f–VBÀ¢FG&W75fW&–f–VC¢W6W%&öf–ÆW2æFG&W75÷fW&–f–VBÀ¢Æ–6Vç6UfW&–f–VC¢W6W%&öf–ÆW2æÆ–6Vç6U÷fW&–f–VBÀ¢–ç7W&æ6UfW&–f–VC¢W6W%&öf–ÆW2æ–ç7W&æ6U÷fW&–f–VBÀ¢F„–EfW&–f–VC¢W6W%&öf–ÆW2çF…ö–E÷fW&–f–VBÀ¢'W6–æW75&Vv—7G&F–öåfW&–f–VC¢W6W%&öf–ÆW2æ'W6–æW75÷&Vv—7G&F–öå÷fW&–f–VBÀ¢WFFVDC¢W6W%&öf–ÆW2çWFFVDBÀ¢W6W$VÖ–Ã¢W6W'2æVÖ–ÂÀ¢W6W$f—'7DæÖS¢W6W'2æf—'7DæÖRÀ¢W6W$Æ7DæÖS¢W6W'2æÆ7DæÖRÀ¢W6W$VÖ–ÅfW&–f–VC¢W6W'2æVÖ–ÅfW&–f–VBÀ¢W6W$FG&W75fW&–f–VC¢W6W'2æFG&W75fW&–f–VBÀ¢Ò¢æg&öÒ‡W6W%&öf–ÆW2¢æÆVgD¦ö–â‡W6W'2ÂW‡W6W%&öf–ÆW2çW6W$–BÂW6W'2æ–B’¢çv†W&R€¢7FGW4f–ÇFW"ÓÒ&ÆÂ ¢òW‡W6W%&öf–ÆW2çfW&–f–6F–öå7FGW2Â7FGW4f–ÇFW"2ç’¢¢7Æ‡W6W%÷&öf–ÆW2çfW&–f–6F–öå÷7V&Ö—76–öç2•2äõBåTÄÂäBW6W%÷&öf–ÆW2çfW&–f–6F–öå÷7V&Ö—76–öç2Òw·Òs£¦§6öæ"– ¢¢æ÷&FW$'’†FW62‡W6W%&öf–ÆW2çWFFVDB’“° ¢6öç7B&Wf–Wu&÷w2Òv—B&öÖ—6RæÆÂ€¢&÷w2æÖ†7–æ2‡&÷r’Óâ°¢6öç7B&WV—&VÖVçG2Òv—B6ö×WFUfW&–f–6F–öå&WV—&VÖVçG2€¢&÷rçW6W$–çFVçB2'W'6öâ"Â&'W6–æW72"À¢‡&÷ræ'W6–æW75G—R2'6W'f–6U÷&÷f–FW""Â'6VÆÆW""Â&vVæW&–2"ÂçVÆÂ’ÇÂVæFVf–æVBÀ¢&÷rç6W'f–6UFw2ÇÂµÒÀ¢&÷rç6VÆÆW%Fw2ÇÂµÐ¢“°¢6öç7B7FGW2Ò°¢VÖ–Ã¢&ööÆVâ‡&÷rçW6W$VÖ–ÅfW&–f–VBÇÂ&÷ræVÖ–ÅfW&–f–VB’À¢FG&W73¢&ööÆVâ‡&÷rçW6W$FG&W75fW&–f–VBÇÂ&÷ræFG&W75fW&–f–VB’À¢Æ–6Vç6S¢&ööÆVâ‡&÷ræÆ–6Vç6UfW&–f–VB’À¢–ç7W&æ6S¢&ööÆVâ‡&÷ræ–ç7W&æ6UfW&–f–VB’À¢F…ö–C¢&ööÆVâ‡&÷rçF„–EfW&–f–VB’À¢'W6–æW75÷&Vv—7G&F–öã¢&ööÆVâ‡&÷ræ'W6–æW75&Vv—7G&F–öåfW&–f–VB’À¢Ó°¢6öç7B6æ—F—¦VBÒ6æ—F—¦UfW&–f–6F–öå7V&Ö—76–öç2‡&÷rçfW&–f–6F–öå7V&Ö—76–öç2ÇÂ·Ò“°¢6öç7BFö7VÖVçD&6RÒö’öFÖ–â÷&öf–ÆR×fW&–f–6F–öç2òG¶Væ6öFUU$”6ö×öæVçB€¢7G&–ær‡&÷rç&öf–ÆT–B¢—ÒöFö7VÖVçG6°¢6öç7BFö7VÖVçEW&Ç2Ò°¢Æ–6Vç6S¢6æ—F—¦VBæWf–FVæ6RæÆ–6Vç6TFö7VÖVçBòG¶Fö7VÖVçD&6WÒöÆ–6Vç6V¢çVÆÂÀ¢–ç7W&æ6S¢6æ—F—¦VBæWf–FVæ6Ræ–ç7W&æ6TFö7VÖVçBòG¶Fö7VÖVçD&6WÒö–ç7W&æ6V¢çVÆÂÀ¢F…ö–C¢6æ—F—¦VBæWf–FVæ6RçF„Fö7VÖVçBòG¶Fö7VÖVçD&6WÒ÷F…ö–F¢çVÆÂÀ¢'W6–æW75÷&Vv—7G&F–öã¢6æ—F—¦VBæWf–FVæ6Ræ'W6–æW75&Vv—7G&F–öäFö7VÖVç@¢òG¶Fö7VÖVçD&6WÒö'W6–æW75÷&Vv—7G&F–öæ ¢¢çVÆÂÀ¢Ó°¢&WGW&â°¢&öf–ÆS¢°¢–C¢&÷rç&öf–ÆT–BÀ¢W6W$–C¢&÷rç&öf–ÆUW6W$–BÀ¢F—7Æ”æÖS¢&÷ræF—7Æ”æÖRÀ¢W6W$–çFVçC¢&÷rçW6W$–çFVçBÀ¢'W6–æW75G—S¢&÷ræ'W6–æW75G—RÀ¢fW&–f–6F–öå&WV—&VÖVçG3¢&WV—&VÖVçG2À¢fW&–f–6F–öå7FGW3¢&÷rçfW&–f–6F–öå7FGW2À¢Æ–6Vç6U÷fW&–f–VC¢7FGW2æÆ–6Vç6RÀ¢–ç7W&æ6U÷fW&–f–VC¢7FGW2æ–ç7W&æ6RÀ¢F…ö–E÷fW&–f–VC¢7FGW2çF…ö–BÀ¢'W6–æW75÷&Vv—7G&F–öå÷fW&–f–VC¢7FGW2æ'W6–æW75÷&Vv—7G&F–öâÀ¢fW&–f–6F–öå7V&Ö—76–öç3¢°¢Æ–6Vç6TçVÖ&W#¢6æ—F—¦VBæÆ–6Vç6TçVÖ&W"À¢F„–C¢6æ—F—¦VBçF„–DÆ7CBò¢¢¢¢G·6æ—F—¦VBçF„–DÆ7CGÖ¢çVÆÂÀ¢Æ–6Vç6TFö4ö&¦V7D¶W“¢Fö7VÖVçEW&Ç2æÆ–6Vç6RÀ¢–ç7W&æ6TFö4ö&¦V7D¶W“¢Fö7VÖVçEW&Ç2æ–ç7W&æ6RÀ¢'W6–æW75&Vv—7G&F–öäFö4ö&¦V7D¶W“¢Fö7VÖVçEW&Ç2æ'W6–æW75÷&Vv—7G&F–öâÀ¢7V&Ö—GFVDC¢6æ—F—¦VBç7V&Ö—GFVDBÀ¢ÒÀ¢f–VÆE&Wf–Ws¢'V–ÆEfW&–f–6F–öäf–VÆE&Wf–Wu7FFR‡°¢&WV—&VÖVçG2À¢7FGW2À¢7V&Ö—76–öç3¢&÷rçfW&–f–6F–öå7V&Ö—76–öç2ÇÂ·ÒÀ¢–æ6ÇVFU&Wf–WvW#¢G'VRÀ¢Ò’À¢Fö7VÖVçEW&Ç2À¢WFFVDC¢&÷rçWFFVDBÀ¢ÒÀ¢W6W#¢°¢–C¢&÷rç&öf–ÆUW6W$–BÀ¢VÖ–Ã¢&÷rçW6W$VÖ–ÂÀ¢f—'7DæÖS¢&÷rçW6W$f—'7DæÖRÀ¢Æ7DæÖS¢&÷rçW6W$Æ7DæÖRÀ¢ÒÀ¢Ó°¢Ò¢“°¢&WGW&â&W2æ§6öâ‡&Wf–Wu&÷w2“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&öf–ÆRfW&–f–6F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&öf–ÆRfW&–f–6F–öç2"Ò“°¢Ð¢Ð¢“° ¢çWB€¢"ö’öFÖ–â÷&öf–ÆR×fW&–f–6F–öç2ó§&öf–ÆT–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B&öf–ÆT–BÒ7G&–ær‡&Wç&×2ç&öf–ÆT–BÇÂ""’çG&–Ò‚“°¢6öç7B'6VBÒFÖ–ä'W6–æW75fW&–f–6F–öäFV6—6–öå66†VÖç6fU'6R‡&Wæ&öG’óò·Ò“°¢–b‚'6VBç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BfW&–f–6F–öâFV6—6–öâ"À¢W'&÷'3¢'6VBæW'&÷"æfÆGFVâ‚’À¢Ò“°¢Ð¢6öç7B&Wf–WvW$–BÒ7G&–ær€¢‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ" ¢’çG&–Ò‚“°¢–b‚&Wf–WvW$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“° ¢6öç7B·&öf–ÆUÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ‡W6W%&öf–ÆW2¢çv†W&R†W‡W6W%&öf–ÆW2æ–BÂ&öf–ÆT–B’¢æÆ–Ö—Bƒ“°¢–b‚&öf–ÆR’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öf–ÆRæ÷Bf÷VæB"Ò“° ¢6öç7B&WV—&VÖVçG2Òv—B6ö×WFUfW&–f–6F–öå&WV—&VÖVçG2€¢&öf–ÆRçW6W$–çFVçB2'W'6öâ"Â&'W6–æW72"À¢‡&öf–ÆRæ'W6–æW75G—R2'6W'f–6U÷&÷f–FW""Â'6VÆÆW""Â&vVæW&–2"ÂçVÆÂ’ÇÂVæFVf–æVBÀ¢&öf–ÆRç6W'f–6UFw2ÇÂµÒÀ¢&öf–ÆRç6VÆÆW%Fw2ÇÂµÐ¢“°¢6öç7B²f–VÆBÂFV6—6–öâÂ&V¦V7F–öå&V6öâÒÒ'6VBæFF°¢–b‚&WV—&VÖVçG5¶f–VÆEÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%F†—2fW&–f–6F–öâf–VÆB—2æ÷B&WV—&VB"Ò“°¢Ð ¢6öç7B6öÇVÖäÖÒ°¢Æ–6Vç6S¢&Æ–6Vç6U÷fW&–f–VB"À¢–ç7W&æ6S¢&–ç7W&æ6U÷fW&–f–VB"À¢F…ö–C¢'F…ö–E÷fW&–f–VB"À¢'W6–æW75÷&Vv—7G&F–öã¢&'W6–æW75÷&Vv—7G&F–öå÷fW&–f–VB"À¢Ò26öç7C° ¢6öç7B&Wf–WvVDBÒæWrFFR‚’çFô•4õ7G&–ær‚“°¢6öç7BæW‡E7V&Ö—76–öç2Ò&V6÷&EfW&–f–6F–öäFV6—6–öâ‡°¢7V&Ö—76–öç3¢‡&öf–ÆR2ç’’çfW&–f–6F–öå7V&Ö—76–öç2ÇÂ·ÒÀ¢f–VÆBÀ¢FV6—6–öâÀ¢&Wf–WvW$–BÀ¢&Wf–WvVDBÀ¢&V¦V7F–öå&V6öâÀ¢Ò“°¢6öç7BæW‡E7FGW2Ò°¢VÖ–Ã¢&ööÆVâ‚‡&öf–ÆR2ç’’æVÖ–Å÷fW&–f–VB’À¢FG&W73¢&ööÆVâ‚‡&öf–ÆR2ç’’æFG&W75÷fW&–f–VB’À¢Æ–6Vç6S ¢f–VÆBÓÓÒ&Æ–6Vç6R ¢òFV6—6–öâÓÓÒ&&÷fVB ¢¢&ööÆVâ‚‡&öf–ÆR2ç’’æÆ–6Vç6U÷fW&–f–VB’À¢–ç7W&æ6S ¢f–VÆBÓÓÒ&–ç7W&æ6R ¢òFV6—6–öâÓÓÒ&&÷fVB ¢¢&ööÆVâ‚‡&öf–ÆR2ç’’æ–ç7W&æ6U÷fW&–f–VB’À¢F…ö–C ¢f–VÆBÓÓÒ'F…ö–B ¢òFV6—6–öâÓÓÒ&&÷fVB ¢¢&ööÆVâ‚‡&öf–ÆR2ç’’çF…ö–E÷fW&–f–VB’À¢'W6–æW75÷&Vv—7G&F–öã ¢f–VÆBÓÓÒ&'W6–æW75÷&Vv—7G&F–öâ ¢òFV6—6–öâÓÓÒ&&÷fVB ¢¢&ööÆVâ‚‡&öf–ÆR2ç’’æ'W6–æW75÷&Vv—7G&F–öå÷fW&–f–VB’À¢Ó°¢6öç7Bf–VÆE&Wf–WrÒ'V–ÆEfW&–f–6F–öäf–VÆE&Wf–Wu7FFR‡°¢&WV—&VÖVçG2À¢7FGW3¢æW‡E7FGW2À¢7V&Ö—76–öç3¢æW‡E7V&Ö—76–öç2À¢–æ6ÇVFU&Wf–WvW#¢G'VRÀ¢Ò“°¢6öç7B÷fW&ÆÅ7FGW2ÒFW&—fT÷fW&ÆÄ'W6–æW75fW&–f–6F–öå7FGW2‡°¢&WV—&VÖVçG2À¢f–VÆE&Wf–Wu7FFS¢f–VÆE&Wf–WrÀ¢Ò“°¢6öç7B·WFFVEÒÒv—BF ¢çWFFR‡W6W%&öf–ÆW2¢ç6WB‡°¢¶6öÇVÖäÖ¶f–VÆEÕÓ¢FV6—6–öâÓÓÒ&&÷fVB"À¢fW&–f–6F–öå&WV—&VÖVçG3¢&WV—&VÖVçG2À¢fW&–f–6F–öå7V&Ö—76–öç3¢æW‡E7V&Ö—76–öç2À¢fW&–f–6F–öå7FGW3¢÷fW&ÆÅ7FGW2À¢WFFVDC¢æWrFFR‚’À¢Ò2ç’¢çv†W&R†W‡W6W%&öf–ÆW2æ–BÂ&öf–ÆT–B’¢ç&WGW&æ–ær‚“°¢–b‚WFFVB’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öf–ÆRæ÷Bf÷VæB"Ò“° ¢&WGW&â&W2æ§6öâ‡°¢&öf–ÆS¢°¢–C¢WFFVBæ–BÀ¢fW&–f–6F–öå7FGW3¢÷fW&ÆÅ7FGW2À¢fW&–f–6F–öå&WV—&VÖVçG3¢&WV—&VÖVçG2À¢7FGW3¢æW‡E7FGW2À¢f–VÆE&Wf–WrÀ¢7V&Ö—76–öç3¢6æ—F—¦UfW&–f–6F–öå7V&Ö—76–öç2†æW‡E7V&Ö—76–öç2’À¢ÒÀ¢Ò“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær&öf–ÆRfW&–f–6F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR&öf–ÆRfW&–f–6F–öâ"Ò“°¢Ð¢Ð¢“° ¢ævWB€¢"ö’öFÖ–â÷&öf–ÆR×fW&–f–6F–öç2ó§&öf–ÆT–BöFö7VÖVçG2ó¦f–VÆB"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B&öf–ÆT–BÒ7G&–ær‡&Wç&×2ç&öf–ÆT–BÇÂ""’çG&–Ò‚“°¢6öç7B'6VDf–VÆBÒ'W6–æW75fW&–f–6F–öäf–VÆE66†VÖç6fU'6R‡&Wç&×2æf–VÆB“°¢–b‚&öf–ÆT–BÇÂ'6VDf–VÆBç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–BfW&–f–6F–öâFö7VÖVçB&WVW7B"Ò“°¢Ð ¢6öç7B·&öf–ÆUÒÒv—BF ¢ç6VÆV7B‡°¢W6W$–C¢W6W%&öf–ÆW2çW6W$–BÀ¢fW&–f–6F–öå7V&Ö—76–öç3¢W6W%&öf–ÆW2çfW&–f–6F–öå7V&Ö—76–öç2À¢Ò¢æg&öÒ‡W6W%&öf–ÆW2¢çv†W&R†W‡W6W%&öf–ÆW2æ–BÂ&öf–ÆT–B’¢æÆ–Ö—Bƒ“°¢–b‚&öf–ÆR’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öf–ÆRæ÷Bf÷VæB"Ò“° ¢6öç7Bö&¦V7D¶W’ÒvWE7F÷&VEfW&–f–6F–öäFö7VÖVçD¶W’€¢&öf–ÆRçfW&–f–6F–öå7V&Ö—76–öç2À¢'6VDf–VÆBæFF¢“°¢–b‚ö&¦V7D¶W’ÇÂ—4÷væVE&—fFTö&¦V7D¶W’†ö&¦V7D¶W’Â&öf–ÆRçW6W$–B’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%fW&–f–6F–öâFö7VÖVçBæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bf–ÆVæÖRÒG·'6VDf–VÆBæFFç&WÆ6R‚õòörÂ"Ò"—Ò×fW&–f–6F–öâÖFö7VÖVçF°¢6öç7BW6U#"Ò&ööÆVâ‡&ö6W72æVçbå#%ô%T4´UEôäÔRbb&ö6W72æVçbå#%ô44U55ô´U•ô”B“°¢–b‡W6U#"’°¢6öç7B²#%7F÷&vU6W'f–6RÒÒv—B–×÷'B‚"âöÆö6Å7F÷&vR"“°¢6öç7B7F÷&vU6W'f–6RÒæWr#%7F÷&vU6W'f–6R‚“°¢6öç7BF÷væÆöEW&ÂÒv—B7F÷&vU6W'f–6RævWDF÷væÆöEU$Â†ö&¦V7D¶W’Â²f–ÆVæÖRÒ“°¢&WGW&â&W2ç&VF—&V7Bƒ3"ÂF÷væÆöEW&Â“°¢Ð ¢6öç7B²Æö6Å7F÷&vU6W'f–6RÒÒv—B–×÷'B‚"âöÆö6Å7F÷&vR"“°¢6öç7B7F÷&vU6W'f–6RÒæWrÆö6Å7F÷&vU6W'f–6R‚“°¢6öç7Bf–ÆUF‚Òv—B7F÷&vU6W'f–6RævWE&—fFTf–ÆUF„g&öÔö&¦V7D¶W’†ö&¦V7D¶W’“°¢–b‚f–ÆUF‚’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%fW&–f–6F–öâFö7VÖVçBæ÷Bf÷VæB"Ò“°¢&WGW&â&W2æF÷væÆöB†f–ÆUF‚Âf–ÆVæÖR“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚$W'&÷"F÷væÆöF–ær&öf–ÆRfW&–f–6F–öâFö7VÖVçC¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòF÷væÆöBfW&–f–6F–öâFö7VÖVçB"Ò“°¢Ð¢Ð¢“° ¢òò6ö6–ÂfVGW&W2’&÷WFW0 ¢ævWB‚"ö’ö6öÖ×Væ—G’öWF†÷&—G’×7W&f6W2"Â7–æ2…÷&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7FFRÒv—BvWDWF†÷&—G•†6TvFU7FFR‚“°¢&W2æ§6öâ‡°¢ö'6W'fF–öäÖöFTVæ&ÆVC¢7FFRæö'6W'fF–öäÖöFTVæ&ÆVBÀ¢†6S&$WF†÷&—G”Æ&VÇ4Væ&ÆVC¢7FFRç†6S&$WF†÷&—G”Æ&VÇ4Væ&ÆVBÀ¢†6S&4÷WF6öÖUvV–v‡F–ætVæ&ÆVC¢7FFRç†6S&4÷WF6öÖUvV–v‡F–ætVæ&ÆVBÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’WF†÷&—G’7W&f6W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡°¢ö'6W'fF–öäÖöFTVæ&ÆVC¢G'VRÀ¢†6S&$WF†÷&—G”Æ&VÇ4Væ&ÆVC¢fÇ6RÀ¢†6S&4÷WF6öÖUvV–v‡F–ætVæ&ÆVC¢fÇ6RÀ¢Ò“°¢Ð¢Ò“° ¢òò6öÖ×Væ—G’÷7G0¢ævWB‚"ö’ö6öÖ×Væ—G’÷÷7G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BWF…W6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7BW6W"ÒWF…W6W$–Bòv—B7F÷&vRævWEW6W"†WF…W6W$–B’¢çVÆÃ° ¢6öç7B66÷U&ÒÐ¢G—Vöb&WçVW'’ç66÷RÓÓÒ'7G&–ær"ò‡&WçVW'’ç66÷R27G&–ær’¢VæFVf–æVC° ¢òò†6R¢vÆö&Â6öÖ×Væ—G’FövvÆR‡&VBÖöæÇ’f—6–&–Æ—G’¢òòÆÆ÷rÆÂW6W'2Fòf–WrvÆö&Â÷7G2‡÷7G2ÖöæÇ’ÂæòæWr6öçF7BF‡2¢6öç7B&öÆTg&öÔ6Æ–×5&rÒ‡&WçW6W"2ç’“òæ6Æ–×3òç&öÆS°¢6öç7B&öÆTg&öÔ6Æ–×2Ð¢G—Vöb&öÆTg&öÔ6Æ–×5&rÓÓÒ'7G&–ær"bb&öÆTg&öÔ6Æ–×5&rçG&–Ò‚’çFôÆ÷vW$66R‚’ÓÓÒ&÷væW" ¢ò'7WW%öFÖ–â ¢¢&öÆTg&öÔ6Æ–×5&s°¢6öç7B&u&öÆW2Ò'&’æ—4'&’‚‡&WçW6W"2ç’“òç&öÆW2’ò‡&WçW6W"2ç’’ç&öÆW2¢µÓ°¢6öç7B&öÆW3¢7G&–æuµÒÒ·&öÆTg&öÔ6Æ–×2Ââââ‡&u&öÆW2ÇÂµÒ•Òæf–ÇFW"€¢‡"“¢"—27G&–ærÓâG—Vöb"ÓÓÒ'7G&–ær ¢“°¢6öç7B—57WW$FÖ–äÆ–¶RÒ&öÆW2ç6öÖR‚‡"’Óà¢²'7WW%öFÖ–â"Â&†VEöFÖ–â"Â&÷væW"%Òæ–æ6ÇVFW2‡"¢“° ¢6öç7BvçG4vÆö&Å66÷RÒ66÷U&ÒÓÓÒ&ÆÂ"ÇÂ66÷U&ÒÓÓÒ&vÆö&Â#°¢òò†6R¢ÆÆ÷rvÆö&Â66÷Rf÷"ÆÂW6W'2†æ÷B§W7B7WW"ÖFÖ–ç2¢6öç7B'—74Æö6F–öâÒvçG4vÆö&Å66÷S° ¢6öç7B†4W‡Æ–6—DÆö6F–öäf–ÇFW'2Ð¢&ööÆVâ‡&WçVW'’ç7FFT6öFR’ÇÂ&ööÆVâ‡&WçVW'’æ6÷VçG”f—2“° ¢6öç7Bf–ÇFW'3¢&ÖWFW'3ÇG—Vöb7F÷&vRævWD6öÖ×Væ—G•÷7G3å³ÒÒ°¢òòv†Vâ'—76–ærÆö6F–öâÂFVÆ–&W&FVÇ’fö–BÇ––ærç’66÷R÷7FFRö6÷VçG’f–ÇFW'2à¢66÷S¢'—74Æö6F–öà¢òVæFVf–æV@¢¢‡66÷U&Ò2ç’’ÇÂ‡W6W"bb†4W‡Æ–6—DÆö6F–öäf–ÇFW'2ò&6÷VçG’"¢VæFVf–æVB’À¢7FFT6öFS¢'—74Æö6F–öà¢òVæFVf–æV@¢¢‡&WçVW'’ç7FFT6öFR27G&–ær’ÇÀ¢‡W6W"bb†4W‡Æ–6—DÆö6F–öäf–ÇFW'2ò‡W6W"ç7FFR27G&–ærÂVæFVf–æVB’¢VæFVf–æVB’À¢6÷VçG”f—3¢'—74Æö6F–öà¢òVæFVf–æV@¢¢‡&WçVW'’æ6÷VçG”f—227G&–ær’ÇÀ¢‡W6W"bb†4W‡Æ–6—DÆö6F–öäf–ÇFW'0¢ò‚‡W6W"2ç’’æ6÷VçG”f—227G&–ærÂVæFVf–æVB¢¢VæFVf–æVB’À¢Fs¢G—Vöb&WçVW'’çFrÓÓÒ'7G&–ær"ò‡&WçVW'’çFr27G&–ær’¢VæFVf–æVBÀ¢6FVv÷'“¢&WçVW'’æ6FVv÷'’2ç’À¢WF†÷$–C¢&WçVW'’æWF†÷$–B27G&–ærÀ¢Æ–Ö—C¢&WçVW'’æÆ–Ö—Bò'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ærÂ’¢#À¢öfg6WC¢&WçVW'’æöfg6WBò'6T–çB‡&WçVW'’æöfg6WB27G&–ærÂ’¢À¢FVÖ÷FTöæ&ö&F–æuvVÆ6öÖW3¢G'VRÀ¢Ó° ¢òòGF6‚f–WvW"6öçFW‡Bf÷"6ö6–Â66÷W2v†VâWF†VçF–6FV@¢–b†WF…W6W$–B’°¢†f–ÇFW'22ç’’çf–WvW$–BÒWF…W6W$–C°¢Ð ¢6öç7Bæ÷&ÖÆ—¦VE66÷RÐ¢66÷U&ÒÇÀ¢‚†f–ÇFW'2ç66÷R27G&–ærÂVæFVf–æVB’óò†'—74Æö6F–öâò&ÆÂ"¢&6÷VçG’"’“° ¢òòFWFW&Ö–æ—7F–266÷R6VÆV7F÷'0¢7v—F6‚†æ÷&ÖÆ—¦VE66÷R’°¢66R&föÆÆ÷v–ær# ¢†f–ÇFW'22ç’’æföÆÆ÷v–ætöæÇ’ÒG'VS°¢†f–ÇFW'22ç’’ç6÷'BÒ'&V6VçB#°¢'&V³° ¢66R'6fVB#¢°¢–b‚WF…W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð¢6öç7B6fVE÷7G2Òv—B7F÷&vRævWE6fVD6öÖ×Væ—G•÷7G2…7G&–ær†WF…W6W$–B’Â°¢Æ–Ö—C¢f–ÇFW'2æÆ–Ö—BÀ¢öfg6WC¢f–ÇFW'2æöfg6WBÀ¢Ò“°¢&W2æ§6öâ‡6fVE÷7G2æÖ‡6æ—F—¦UV&Æ–46öÖ×Væ—G”fVVE÷7B’“°¢&WGW&ã°¢Ð ¢66R&æV&'’# ¢òòæV&'’¶VW26÷VçG’66÷–æræBW6W2&V6Væ7’÷&FW&–ærf÷"æ÷rà¢†f–ÇFW'22ç’’ç6÷'BÒ'&V6VçB#°¢'&V³° ¢66R'&V6VçB# ¢†f–ÇFW'22ç’’ç6÷'BÒ'&V6VçB#°¢'&V³° ¢66R'G&VæF–ær# ¢†f–ÇFW'22ç’’ç6÷'BÒ'G&VæF–ær#°¢'&V³° ¢66R'&V6öÖÖVæFF–öç2# ¢†f–ÇFW'22ç’’ç6÷'BÒ'&V6öÖÖVæFVB#°¢†f–ÇFW'22ç’’æW†6ÇVFTföÆÆ÷v–ærÒG'VS°¢'&V³° ¢FVfVÇC ¢òòf÷%÷–÷Rò6÷VçG’ò7FFRòvÆö&ÂfÆÂ&6²FòW†—7F–ær&V†f–÷ ¢'&V³°¢Ð ¢–b‡W6W"’°¢G'’°¢ÆWB66÷UG—S¢7G&–ærÂçVÆÂÒçVÆÃ°¢ÆWB66÷T–C¢7G&–ærÂçVÆÂÒçVÆÃ° ¢6öç7B6÷VçG”f—2Ò†f–ÇFW'2æ6÷VçG”f—227G&–ærÂVæFVf–æVB’ÇÂçVÆÃ°¢6öç7B7FFT6öFRÒ†f–ÇFW'2ç7FFT6öFR27G&–ærÂVæFVf–æVB’ÇÂçVÆÃ°¢6öç7B66÷RÒf–ÇFW'2ç66÷R27G&–ærÂVæFVf–æVC° ¢–b‡66÷R’°¢66÷UG—RÒ66÷S°¢–b‡66÷RÓÓÒ&6÷VçG’"bb6÷VçG”f—2’°¢66÷T–BÒ6÷VçG”f—3°¢ÒVÇ6R–b‡66÷RÓÓÒ'7FFR"bb7FFT6öFR’°¢66÷T–BÒ7FFT6öFS°¢ÒVÇ6R–b‡66÷RÓÓÒ&ÆÂ"ÇÂ66÷RÓÓÒ&vÆö&Â"’°¢66÷T–BÒ&vÆö&Â#°¢Ð¢ÒVÇ6R–b†6÷VçG”f—2’°¢66÷UG—RÒ&6÷VçG’#°¢66÷T–BÒ6÷VçG”f—3°¢ÒVÇ6R–b‡7FFT6öFR’°¢66÷UG—RÒ'7FFR#°¢66÷T–BÒ7FFT6öFS°¢Ð ¢–b‡66÷UG—Rbb66÷T–B’°¢v—B7F÷&vRæÆötWfVçB‚&6öÖ×Væ—G’çf–WvVE÷66÷R"Â°¢W6W$–C¢W6W"æ–BÀ¢66÷UG—RÀ¢66÷T–BÀ¢6÷VçG”f—2À¢7FFT6öFRÀ¢Ò“°¢Ð¢Ò6F6‚†R’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFòÆör6öÖ×Væ—G’çf–WvVE÷66÷Rf÷"…"ÂR“°¢Ð¢Ð ¢ÆWB÷7G2Òv—B7F÷&vRævWD6öÖ×Væ—G•÷7G2†f–ÇFW'2“° ¢òòöæR×&VÆV6RwV&C¢–b&V6öÖÖVæFF–öç2&RV×G’ÂfÆÂ&6²Fò&V6Vç@¢–b‚÷7G2æÆVæwF‚bbæ÷&ÖÆ—¦VE66÷RÓÓÒ'&V6öÖÖVæFF–öç2"’°¢6öç7BfÆÆ&6´f–ÇFW'3¢&ÖWFW'3ÇG—Vöb7F÷&vRævWD6öÖ×Væ—G•÷7G3å³ÒÒ°¢ââæf–ÇFW'2À¢6÷'C¢'&V6VçB"À¢W†6ÇVFTföÆÆ÷v–æs¢fÇ6RÀ¢Ó°¢÷7G2Òv—B7F÷&vRævWD6öÖ×Væ—G•÷7G2†fÆÆ&6´f–ÇFW'2“°¢Ð ¢òòVç7W&R÷7G2†fR¶W—v÷&BFw2f÷"fVVB66æ&–Æ—G’†æòÆVF–ærr2r’à¢òòF†—2—2&W7öç6RÖöæÇ“²vRFòæ÷B×WFFRD"&V6÷&G2†W&Rà¢6öç7Bæ÷&ÖÆ—¦UFufÇVRÒ‡fÇVS¢Væ¶æ÷vâ“¢7G&–ærÓâ°¢6öç7B6ÆVæVBÒ7G&–ær‡fÇVRóò""¢çG&–Ò‚¢ç&WÆ6R‚õâ2²òÂ""“°¢&WGW&â6ÆVæVBçG&–Ò‚’çFôÆ÷vW$66R‚“°¢Ó°¢÷7G2Ò÷7G2æÖ‚‡÷7C¢ç’’Óâ°¢6öç7B&uFw2Ò'&’æ—4'&’‡÷7CòçFw2’ò÷7BçFw2¢µÓ°¢6öç7B6ÆVæVBÒ&uFw2æÖ†æ÷&ÖÆ—¦UFufÇVR’æf–ÇFW"„&ööÆVâ“°¢6öç7BFW&—fVDg&öÔ6öçFVçBÒFW&—fT6öÖ×Væ—G•Fw4g&öÔ6öçFVçB€¢÷7CòçF—FÆRÀ¢÷7Còæ6öçFVçBÀ¢÷7Còæ6FVv÷'¢“°¢6öç7BÖW&vVBÒ'&’æg&öÒ†æWr6WB…²ââæ6ÆVæVBÂââæFW&—fVDg&öÔ6öçFVçEÒæf–ÇFW"„&ööÆVâ’’¢æf–ÇFW"„&ööÆVâ¢ç6Æ–6RƒÂ"“°¢6öç7BWF†÷"Ð¢÷7CòæWF†÷"bbG—Vöb÷7BæWF†÷"ÓÓÒ&ö&¦V7B ¢ò°¢ââç÷7BæWF†÷"À¢&öf–ÆT–ÖvUW&Ã¢æ÷&ÖÆ—¦U&öf–ÆT–ÖvUW&Â€¢÷7BæWF†÷"ç&öf–ÆT–ÖvUW&Âóò÷7BæWF†÷"æfF ¢’À¢fF#¢æ÷&ÖÆ—¦U&öf–ÆT–ÖvUW&Â‡÷7BæWF†÷"æfF"óò÷7BæWF†÷"ç&öf–ÆT–ÖvUW&Â’À¢Ð¢¢÷7CòæWF†÷#°¢&WGW&âæ÷&ÖÆ—¦TWFöÖF–46öÖ×Væ—G•vVÆ6öÖU÷7B€¢²ââç÷7BÂWF†÷"ÂFw3¢ÖW&vVBÒÀ¢—4WFöÖF–46öÖ×Væ—G•vVÆ6öÖU÷7B‡÷7B¢“°¢Ò“° ¢–b†æ÷&ÖÆ—¦VE66÷RÓÓÒ&vÆö&Â"ÇÂæ÷&ÖÆ—¦VE66÷RÓÓÒ&ÆÂ"’°¢÷7G2Ò÷7G2æf–ÇFW"‚‡÷7C¢ç’’Óâ—5W6VgVÅV&Æ–46öÖ×Væ—G”'&÷w6U÷7B‡÷7B’“°¢Ð ¢òòGF6‚&VÆFVBÂfW&–f–VBÂöâ×ÆFf÷&Ò'W6–æW76W2Fò÷7G2F†BÖVçF–öâ¢òò7WÆ–W"öÖFW&–Ç2æVVB†RærâæGW&Â7FöæRv÷&²’Â66÷VBFòF†R6ÖP¢òò6÷VçG’÷7FFR6öçFW‡BÇ&VG’W6VBFòf–ÇFW"F†—2fVVB&WVW7Bà¢òò&W7öç6RÖöæÇ’Â6öçF7BÖvFVB‡&öf–ÆRÆ–æ²öæÇ’’ÒÒFöW2æ÷B×WFFR÷7G2–âF†RD"à¢G'’°¢÷7G2Òv—B&öÖ—6RæÆÂ€¢÷7G2æÖ†7–æ2‡÷7C¢ç’’Óâ°¢6öç7BFW‡BÒG·÷7CòçF—FÆRÇÂ"'ÒG·÷7Còæ6öçFVçBÇÂ"'Ö°¢6öç7B7VvvW7F–öç2Òv—BvWE&VÆFVD'W6–æW757VvvW7F–öç2‡°¢FW‡BÀ¢6÷VçG”f—3¢f–ÇFW'2æ6÷VçG”f—2À¢7FFT6öFS¢f–ÇFW'2ç7FFT6öFRÀ¢Ò“°¢&WGW&â7VvvW7F–öç2æÆVæwF‚âò²ââç÷7BÂ&VÆFVD'W6–æW76W3¢7VvvW7F–öç2Ò¢÷7C°¢Ò¢“°¢Ò6F6‚‡&VÆFVD'W6–æW74W'&÷"’°¢6öç6öÆRçv&â€¢$f–ÆVBFòGF6‚&VÆFVB'W6–æW727VvvW7F–öç2Fò6öÖ×Væ—G’÷7G2"À¢&VÆFVD'W6–æW74W'&÷ ¢“°¢Ð ¢òòV&Æ–2fVVB–ÆöG2æWfW"W‡÷6RÖöFW&F–öâæ÷FW2ÂÖöFW&F÷"–FVçF—G’À¢òò÷"WF†÷"6öçF7Bf–VÆG2Â&Vv&FÆW72öbvVöw&†–266÷Rà¢÷7G2Ò÷7G2æÖ‡6æ—F—¦UV&Æ–46öÖ×Væ—G”fVVE÷7B“° ¢òò†6R$"ó$2WF†÷&—G’7W&f6W2&RwV&FVB'’ö'6W'fF–öâÖöFRæBW‡Æ–6—BFövvÆW2à¢òòÒ†6R$#¢&VæFW"–çFW'&WF—fRÆ&VÇ0¢òòÒ†6R$3¢Ç’&æ¶–ærvV–v‡G2‡&WV—&W2†6R$"¢6öç7B†6U7FFRÒv—BvWDWF†÷&—G•†6TvFU7FFR‚“°¢–b‡†6U7FFRç†6S&$WF†÷&—G”Æ&VÇ4Væ&ÆVBÇÂ†6U7FFRç†6S&4÷WF6öÖUvV–v‡F–ætVæ&ÆVB’°¢6öç7B²Ç”÷WF6öÖUvV–v‡F–ærÂ6÷'D'”÷WF6öÖU66÷&RÒÐ¢v—B–×÷'B‚"âö6öÖ×Væ—G’ö÷WF6öÖU66÷&–ær"“°¢v—BÇ”÷WF6öÖUvV–v‡F–ær‡÷7G2“° ¢òò†6R$26â–æfÇVVæ6R&æ¶–ærf÷"&V6öÖÖVæFF–öâÖfö7W6VB66÷W2öæÇ’à¢–b€¢†6U7FFRç†6S&4÷WF6öÖUvV–v‡F–ætVæ&ÆVBb`¢†æ÷&ÖÆ—¦VE66÷RÓÓÒ'&V6öÖÖVæFF–öç2"ÇÂæ÷&ÖÆ—¦VE66÷RÓÓÒ&f÷%–÷R"¢’°¢6÷'D'”÷WF6öÖU66÷&R‡÷7G2“°¢Ð¢Ð ¢&W2æ§6öâ‡÷7G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’÷7G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚÷7G2"Ò“°¢Ð¢Ò“° ¢òò6öÖ×Væ—G’7FG2‡&VÂfÇVW2öæÇ“²æòÆ6V†öÆFW'2¢ævWB‚"ö’ö6öÖ×Væ—G’÷7FG2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6÷VçG”f—2Â7FFT6öFRÒÒ&WçVW'’ÇÂ·Ó°¢6öç7BFöF’ÒæWrFFR‚“°¢FöF’ç6WD†÷W'2ƒÂÂÂ“° ¢6öç7B6WfVäF—4vòÒæWrFFR‚“°¢6WfVäF—4vòç6WDFFR‡6WfVäF—4vòævWDFFR‚’Òr“°¢6WfVäF—4vòç6WD†÷W'2ƒÂÂÂ“° ¢6öç7BF†—'G”F—4vòÒæWrFFR‚“°¢F†—'G”F—4vòç6WDFFR‡F†—'G”F—4vòævWDFFR‚’Ò3“°¢F†—'G”F—4vòç6WD†÷W'2ƒÂÂÂ“° ¢6öç7B†46÷VçG•66÷RÒG—Vöb6÷VçG”f—2ÓÓÒ'7G&–ær"bb6÷VçG”f—2æÆVæwF‚â° ¢6öç7BF÷FÄÖVÖ&W'5&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR€¢7Æ6VÆV7B6÷VçB‚¢“£¦–çB26÷VçBg&öÒW6W'2v†W&R6÷VçG•öf—2ÒG¶6÷VçG”f—7Ö ¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ6VÆV7B6÷VçB‚¢“£¦–çB26÷VçBg&öÒW6W'6’’2ç’“° ¢6öç7B÷7G5FöF•&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR€¢7Æ6VÆV7B6÷VçB‚¢“£¦–çB26÷VçBg&öÒ6öÖ×Væ—G•÷÷7G2v†W&R7&VFVEöBãÒG·FöF—ÒæB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ö ¢’’2ç’¢¢‚†v—BF"æW†V7WFR€¢7Æ6VÆV7B6÷VçB‚¢“£¦–çB26÷VçBg&öÒ6öÖ×Væ—G•÷÷7G2v†W&R7&VFVEöBãÒG·FöF—Ö ¢’’2ç’“° ¢6öç7B†VÇ&WVW7G5&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB‚¢“£¦–çB26÷Vç@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢æB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢æB6FVv÷'’–â‚w&WVW7BrÂwVW7F–öârÂwVW7F–öç2rÂw&ö¦V7BrÂw&ö¦V7G2r¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB‚¢“£¦–çB26÷Vç@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢æB6FVv÷'’–â‚w&WVW7BrÂwVW7F–öârÂwVW7F–öç2rÂw&ö¦V7BrÂw&ö¦V7G2r¢’’2ç’“° ¢6öç7B&V6öÖÖVæFF–öç5&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB‚¢“£¦–çB26÷Vç@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢æB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢æB6FVv÷'’–â‚w&V6öÖÖVæFF–öârÂw&V6öÖÖVæFF–öç2r¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB‚¢“£¦–çB26÷Vç@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢æB6FVv÷'’–â‚w&V6öÖÖVæFF–öârÂw&V6öÖÖVæFF–öç2r¢’’2ç’“° ¢6öç7BfW&–f–VE&÷5&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB†F—7F–æ7B2æ–B“£¦–çB26÷Vç@¢g&öÒ6öçG&7F÷'20¢–ææW"¦ö–â6öçG&7F÷%ö6÷VçF–W262öâ62æ6öçG&7F÷%ö–BÒ2æ–@¢–ææW"¦ö–â6÷VçF–W26òöâ6òæ–BÒ62æ6÷VçG•ö–@¢v†W&R6òæf—2ÒG¶6÷VçG”f—7Ð¢æB2æ—5ö7F—fRÒG'VP¢æB2çfW&–f–VEöÆ–6Vç6VBÒG'VP¢æB2çfW&–f–VEö–ç7W&VBÒG'VP¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB‚¢“£¦–çB26÷Vç@¢g&öÒ6öçG&7F÷'20¢v†W&R2æ—5ö7F—fRÒG'VP¢æB2çfW&–f–VEöÆ–6Vç6VBÒG'VP¢æB2çfW&–f–VEö–ç7W&VBÒG'VP¢’’2ç’“° ¢6öç7B6÷VçF–W47F—fU&W7VÇBÒ†v—BF"æW†V7WFR€¢7Æ6VÆV7B6÷VçB†F—7F–æ7B6÷VçG•öf—2“£¦–çB26÷VçBg&öÒ6öÖ×Væ—G•÷÷7G2v†W&R6÷VçG•öf—2—2æ÷BçVÆÂæB7&VFVEöBãÒG·F†—'G”F—4v÷Ö ¢’’2ç“° ¢6öç7B7F—fUFöF•&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB†F—7F–æ7BW6W%ö–B“£¦–çB26÷Vç@¢g&öÒ€¢6VÆV7BWF†÷%ö–B2W6W%ö–@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·FöF—ÒæB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢Væ–öà¢6VÆV7BÂçW6W%ö–B2W6W%ö–@¢g&öÒ÷7EöÆ–¶W2À¢–ææW"¦ö–â6öÖ×Væ—G•÷÷7G27öâ7æ–BÒÂç÷7Eö–@¢v†W&RÂæ7&VFVEöBãÒG·FöF—ÒæB7æ6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢Væ–öà¢6VÆV7B2æWF†÷%ö–B2W6W%ö–@¢g&öÒ÷7Eö6öÖÖVçG20¢–ææW"¦ö–â6öÖ×Væ—G•÷÷7G27"öâ7"æ–BÒ2ç÷7Eö–@¢v†W&R2æ7&VFVEöBãÒG·FöF—ÒæB7"æ6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢’@¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ ¢6VÆV7B6÷VçB†F—7F–æ7BW6W%ö–B“£¦–çB26÷Vç@¢g&öÒ€¢6VÆV7BWF†÷%ö–B2W6W%ö–Bg&öÒ6öÖ×Væ—G•÷÷7G2v†W&R7&VFVEöBãÒG·FöF—Ð¢Væ–öà¢6VÆV7BW6W%ö–B2W6W%ö–Bg&öÒ÷7EöÆ–¶W2v†W&R7&VFVEöBãÒG·FöF—Ð¢Væ–öà¢6VÆV7BWF†÷%ö–B2W6W%ö–Bg&öÒ÷7Eö6öÖÖVçG2v†W&R7&VFVEöBãÒG·FöF—Ð¢’@¢’’2ç’“° ¢òòÖVF–âF–ÖR×FòÖf—'7B×&WÇ’†–âÖ–çWFW2’f÷"÷7G27&VFVB–âF†RÆ7BrF—2à¢òò&WGW&ç2çVÆÂv†VâF†W&R&Ræò&WÆ–W2à¢6öç7BÖVF–äf—'7E&WÇ•&W7VÇBÒ†46÷VçG•66÷P¢ò‚†v—BF"æW†V7WFR‡7Æ ¢v—F‚÷7G22€¢6VÆV7B–BÂ7&VFVEö@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢æB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ð¢’À¢f—'7E÷&WÇ’2€¢6VÆV7Bæ–BÂæ7&VFVEöBÂÖ–â†2æ7&VFVEöB’2f—'7E÷&WÇ•ö@¢g&öÒ÷7G2 ¢–ææW"¦ö–â÷7Eö6öÖÖVçG22öâ2ç÷7Eö–BÒæ–@¢w&÷W'’æ–BÂæ7&VFVEö@¢¢6VÆV7@¢W&6VçF–ÆUö6öçBƒãR’v—F†–âw&÷W€¢÷&FW"'’W‡G&7B†Wö6‚g&öÒ†f—'7E÷&WÇ•öBÒ7&VFVEöB’’òcã ¢’2Ö–çWFW0¢g&öÒf—'7E÷&WÇ¢’’2ç’¢¢‚†v—BF"æW†V7WFR‡7Æ ¢v—F‚÷7G22€¢6VÆV7B–BÂ7&VFVEö@¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&R7&VFVEöBãÒG·6WfVäF—4v÷Ð¢’À¢f—'7E÷&WÇ’2€¢6VÆV7Bæ–BÂæ7&VFVEöBÂÖ–â†2æ7&VFVEöB’2f—'7E÷&WÇ•ö@¢g&öÒ÷7G2 ¢–ææW"¦ö–â÷7Eö6öÖÖVçG22öâ2ç÷7Eö–BÒæ–@¢w&÷W'’æ–BÂæ7&VFVEö@¢¢6VÆV7@¢W&6VçF–ÆUö6öçBƒãR’v—F†–âw&÷W€¢÷&FW"'’W‡G&7B†Wö6‚g&öÒ†f—'7E÷&WÇ•öBÒ7&VFVEöB’’òcã ¢’2Ö–çWFW0¢g&öÒf—'7E÷&WÇ¢’’2ç’“° ¢6öç7BF÷FÄÖVÖ&W'2ÒçVÖ&W"‡F÷FÄÖVÖ&W'5&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7B÷7G5FöF’ÒçVÖ&W"‡÷7G5FöF•&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7B6÷VçF–W47F—fRÒçVÖ&W"†6÷VçF–W47F—fU&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7B7F—fUFöF’ÒçVÖ&W"†7F—fUFöF•&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7B†VÇ&WVW7G3vBÒçVÖ&W"††VÇ&WVW7G5&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7B&V6öÖÖVæFF–öç3vBÒçVÖ&W"‡&V6öÖÖVæFF–öç5&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7BfW&–f–VE&÷2ÒçVÖ&W"‡fW&–f–VE&÷5&W7VÇCòç&÷w3òå³Óòæ6÷VçBóò“°¢6öç7BÖVF–äf—'7E&WÇ”Ö–çWFW3vE&rÒ†ÖVF–äf—'7E&WÇ•&W7VÇB2ç’“òç&÷w3òå³ÓòæÖ–çWFW3°¢6öç7BÖVF–äf—'7E&WÇ”Ö–çWFW3vBÐ¢ÖVF–äf—'7E&WÇ”Ö–çWFW3vE&rÓÒçVÆÂòçVÆÂ¢çVÖ&W"†ÖVF–äf—'7E&WÇ”Ö–çWFW3vE&r“° ¢&W2æ§6öâ‡°¢F÷FÄÖVÖ&W'2À¢7F—fUFöF’À¢÷7G5FöF’À¢6÷VçF–W47F—fRÀ¢†VÇ&WVW7G3vBÀ¢&V6öÖÖVæFF–öç3vBÀ¢fW&–f–VE&÷2À¢ÖVF–äf—'7E&WÇ”Ö–çWFW3vBÀ¢66÷S¢†46÷VçG•66÷Rò&Æö6Â"¢&vÆö&Â"À¢7FFT6öFS¢G—Vöb7FFT6öFRÓÓÒ'7G&–ær"ò7FFT6öFR¢çVÆÂÀ¢6÷VçG”f—3¢†46÷VçG•66÷Rò6÷VçG”f—2¢çVÆÂÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’7FG3¢"ÂW'&÷"“°¢&W2æ§6öâ‡°¢F÷FÄÖVÖ&W'3¢À¢7F—fUFöF“¢À¢÷7G5FöF“¢À¢6÷VçF–W47F—fS¢À¢†VÇ&WVW7G3vC¢À¢&V6öÖÖVæFF–öç3vC¢À¢fW&–f–VE&÷3¢À¢ÖVF–äf—'7E&WÇ”Ö–çWFW3vC¢çVÆÂÀ¢Ò“°¢Ð¢Ò“° ¢òò…b&FvW2&VBVæGö–çG2†ÖRÖöæÇ’¢ævWB‚"ö’÷‡öÖR"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–C¢7G&–ærÂVæFVf–æVBÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7B·‡F÷FÂÂÆVFvW%ÒÒv—B&öÖ—6RæÆÂ…°¢7F÷&vRævWEW6W%‡F÷FÂ‡W6W$–B’À¢7F÷&vRævWEW6W%‡ÆVFvW"‡W6W$–BÂS’À¢Ò“° ¢&W2æ§6öâ‡°¢W6W$–BÀ¢‡F÷FÂÀ¢&V6VçDÆVFvW#¢ÆVFvW"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær…f÷"7W'&VçBW6W#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚…"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö&FvW2öÖR"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–C¢7G&–ærÂVæFVf–æVBÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7B·W6W"Âv&FVEÒÒv—B&öÖ—6RæÆÂ…°¢7F÷&vRævWEW6W"‡W6W$–B’À¢7F÷&vRævWEW6W$v&FVD&FvW2‡W6W$–B’À¢Ò“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B6ö×WFVDÆ&VÇ2Ò6ö×WFT&FvW4f÷%W6W"‡W6W"“° ¢&W2æ§6öâ‡°¢W6W$–BÀ¢Æ&VÇ3¢6ö×WFVDÆ&VÇ2À¢v&FVBÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&FvW2f÷"7W'&VçBW6W#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&FvW2"Ò“°¢Ð¢Ò“° ¢òòG&VæF–ærF÷–72„D"Ö&6¶VC²6öÖ×Væ—G’ÖöæÇ’¢ævWB‚"ö’ö6öÖ×Væ—G’÷G&VæF–ær"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7FFT6öFRÒG—Vöb&WçVW'’ç7FFT6öFRÓÓÒ'7G&–ær"ò&WçVW'’ç7FFT6öFR¢VæFVf–æVC°¢6öç7B6÷VçG”f—2Ð¢G—Vöb&WçVW'’æ6÷VçG”f—2ÓÓÒ'7G&–ær"ò&WçVW'’æ6÷VçG”f—2¢VæFVf–æVC°¢6öç7BÆ–Ö—BÒ&WçVW'’æÆ–Ö—@¢òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒ#Â'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ærÂ’ÇÂ’¢¢° ¢6öç7B6–æ6RÒæWrFFR‚“°¢6–æ6Rç6WDFFR‡6–æ6RævWDFFR‚’Òr“° ¢6öç7B&÷w5&W7VÇBÒ†v—BF"æW†V7WFR‡7Æ ¢6VÆV7BFrÂ6÷VçB‚¢“£¦–çB2÷7G0¢g&öÒ€¢6VÆV7BVææW7B‡Fw2’2Fp¢g&öÒ6öÖ×Væ—G•÷÷7G0¢v†W&RFw2—2æ÷BçVÆÀ¢æB—5ö†–FFVâÒfÇ6P¢æB—5÷V&Æ—6†VBÒG'VP¢æB7&VFVEöBãÒG·6–æ6WÐ¢G·7FFT6öFRò7ÆæB7FFUö6öFRÒG·7FFT6öFWÖ¢7ÆÐ¢G¶6÷VçG”f—2ò7ÆæB6÷VçG•öf—2ÒG¶6÷VçG”f—7Ö¢7ÆÐ¢’@¢w&÷W'’Fp¢÷&FW"'’÷7G2FW60¢Æ–Ö—BG¶Æ–Ö—GÐ¢’’2ç“° ¢6öç7B–çFW&æÄ—FV×3¢'&“Ç²Fs¢7G&–æs²÷7G3¢çVÖ&W#²6÷W&6S¢&6öÖ×Væ—G’"ÓâÐ¢'&’æ—4'&’‡&÷w5&W7VÇCòç&÷w2¢ò&÷w5&W7VÇBç&÷w0¢æf–ÇFW"‚‡#¢ç’’ÓâG—Vöb#òçFrÓÓÒ'7G&–ær"bb"çFrçG&–Ò‚’æÆVæwF‚â¢æÖ‚‡#¢ç’’Óâ‡°¢Fs¢"çFrÀ¢÷7G3¢çVÖ&W"‡"ç÷7G2óò’À¢6÷W&6S¢&6öÖ×Væ—G’"26öç7BÀ¢Ò’¢¢µÓ° ¢–b†–çFW&æÄ—FV×2æÆVæwF‚â’°¢&WGW&â&W2æ§6öâ†–çFW&æÄ—FV×2“°¢Ð ¢òò–bF†W&R&Ræò&V6VçBÂFvvVB6öÖ×Væ—G’÷7G2Â&WGW&âà¢òòV×G’Æ—7B&F†W"F†âvVæW&–2W‡FW&æÂF÷–72âG&VæF–æp¢òò6†÷VÆB&VfÆV7Bv†N(	—27GVÆÇ’†Væ–ær–âF†R6öÖ×Væ—G’à¢&WGW&â&W2æ§6öâ…µÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’G&VæF–ærF÷–73¢"ÂW'&÷"“°¢&W2æ§6öâ…µÒ“°¢Ð¢Ò“° ¢gVæ7F–öâFW&—fT6öÖ×Væ—G•Fw4g&öÔ6öçFVçB€¢F—FÆS¢7G&–ærÂVæFVf–æVBÀ¢6öçFVçC¢7G&–ærÀ¢6FVv÷'“ó¢7G&–æp¢“¢7G&–æuµÒ°¢6öç7BFw2ÒæWr6WCÇ7G&–æsâ‚“°¢6öç7BFW‡BÒG·F—FÆRÇÂ"'ÒG¶6öçFVçGÖçFôÆ÷vW$66R‚“° ¢òò†6‡Fr×7G–ÆRFw3¢6†öÂ7&ööf–ærÂWF2à¢6öç7B†6„ÖF6†W2ÒFW‡BæÖF6‚‚ò2…¶×£Ó•òÕ×³"Ã3'Ò’öv’“°¢–b††6„ÖF6†W2’°¢f÷"†6öç7B&röb†6„ÖF6†W2’°¢6öç7B6ÆVæVBÒ&rç&WÆ6R‚õâ2òÂ""’çG&–Ò‚“°¢–b†6ÆVæVB’Fw2æFB†6ÆVæVB“°¢Ð¢Ð ¢òò6–×ÆR¶W—v÷&BÖ&6VBFw2FW&—fVBg&öÒF†R6öçFVçB&öG’à¢–b‚ö†öÆ†öÖV÷væW'2uÇ2¶76ö6–F–öçÆ&ö&BÖVWF–æròçFW7B‡FW‡B’’Fw2æFB‚&†ö"“°¢–b‚÷&öögÇ&ööf–æwÇ6†–ævÆWÇ6öff—GÆwWGFW"òçFW7B‡FW‡B’’Fw2æFB‚'&ööf–ær"“°¢–b‚öfÆö÷'ÆfÆö÷&–æwÇF–ÆWÇF–ÆW7Æw&÷WGÆÆÖ–æFWÇf–ç–ÅÇ2·Ææ·ÆÇgÆ†&GvööBòçFW7B‡FW‡B’¢Fw2æFB‚&fÆö÷&–ær"“°¢–b‚÷–çGÇ–çF–æwÇ–çFW'Ç&–ÖW'Æ6VÆ·Ç7F–åÆ"òçFW7B‡FW‡B’’Fw2æFB‚'–çF–ær"“°¢–b‚öG'—vÆÇÇ6†VWG&ö6·Æ×VEÆ'ÇFUÆ'ÇFW‡GW&WÇ6¶–ÕÇ2¶6öBòçFW7B‡FW‡B’’Fw2æFB‚&G'—vÆÂ"“°¢–b‚÷G&–ÕÆ'Æf–æ—6…Ç2·v÷&·Æ&6V&ö&GÆ7&÷våÇ2¶ÖöÆF–æwÆFö÷%Ç2·G&–×Çv–æF÷uÇ2·G&–ÒòçFW7B‡FW‡B’¢Fw2æFB‚'G&–Ò"“°¢–b‚ö6'VçG'—Æg&Ö–æwÆ6&–æWGÆ6&–æWG7ÆÖ–ÆÇv÷&²òçFW7B‡FW‡B’’Fw2æFB‚&6'VçG'’"“°¢–b‚öÖ6öç'—Æ'&–6·Æ&Æö6·Ç7FöæWÆ6†–ÖæW’òçFW7B‡FW‡B’’Fw2æFB‚&Ö6öç'’"“°¢–b‚ö–ç7VÆF–öçÇ7&•Ç2¶fö×ÆGF–5Ç2¶–ç7VÆF–öâòçFW7B‡FW‡B’’Fw2æFB‚&–ç7VÆF–öâ"“°¢–b‚÷ÇVÖ'ÆÆV·Ç—WÆG&–âòçFW7B‡FW‡B’’Fw2æFB‚'ÇVÖ&–ær"“°¢–b‚öVÆV7G&–7Æ'&V¶W'ÇæVÇÆ÷WFÆWGÇ7v—F6‚òçFW7B‡FW‡B’’Fw2æFB‚&VÆV7G&–6Â"“°¢–b‚ö‡f7ÆgW&æ6WÅÆ&5Æ'Æ—%Ç2¶6öæF—F–öæW'Æ†VEÇ2·V×òçFW7B‡FW‡B’’Fw2æFB‚&‡f2"“°¢–b‚ö6öæ7&WFWÆf÷VæFF–öçÇ6Æ'ÆG&—fWv’òçFW7B‡FW‡B’’Fw2æFB‚&6öæ7&WFR"“°¢–b‚÷6–F–æwÇ7GV66÷Æf66–òçFW7B‡FW‡B’’Fw2æFB‚'6–F–ær"“°¢–b‚÷v–æF÷wÇv–æF÷w7ÆFö÷'ÆFö÷'7Æv&vUÇ2¶Fö÷"òçFW7B‡FW‡B’’Fw2æFB‚'v–æF÷w5öFö÷'2"“°¢–b‚÷W7GÇFW&Ö—FWÇ&öFVçGÆW‡FW&Ö–æF÷"òçFW7B‡FW‡B’’Fw2æFB‚'W7Eö6öçG&öÂ"“°¢–b‚÷ööÇÆ†÷EÇ2·GV'Ç7Æ"òçFW7B‡FW‡B’’Fw2æFB‚'ööÅ÷7"“°¢–b‚öÆö6·6Ö—F‡Ç&V¶W—ÆÆö6µÇ2¶6†ævRòçFW7B‡FW‡B’’Fw2æFB‚&Æö6·6Ö—F‚"“°¢–b‚ö6ÆVæ–æwÆÖ–EÇ2·6W'f–6WÆFVWÇ2¶6ÆVâòçFW7B‡FW‡B’’Fw2æFB‚&6ÆVæ–ær"“°¢–b‚öÖ÷f–æwÆÖ÷fW'7Ç&VÆö6F–öâòçFW7B‡FW‡B’’Fw2æFB‚&Ö÷f–ær"“°¢–b‚ö§VæµÇ2·&VÖ÷fÇÆGV×7FW'Æ†VÅÇ2¶v’òçFW7B‡FW‡B’’Fw2æFB‚&§Væµ÷&VÖ÷fÂ"“°¢–b‚öfVæ6WÆfVæ6–æwÆvFUÆ"òçFW7B‡FW‡B’’Fw2æFB‚&fVæ6–ær"“°¢–b‚öÆæG66ÆÆvçÇ7&–æ¶ÆW'Æ—'&–vF–öçÇG&VUÇ2·6W'f–6RòçFW7B‡FW‡B’’Fw2æFB‚&ÆæG66–ær"“°¢–b‚÷&W77W&UÇ2·v6‡Ç÷vW%Ç2·v6‡Ç6ögEÇ2·v6‚òçFW7B‡FW‡B’’Fw2æFB‚'&W77W&U÷v6†–ær"“°¢–b‚÷6öÆ'ÇæVÅÇ2¶–ç7FÆÇÇeÆ"òçFW7B‡FW‡B’’Fw2æFB‚'6öÆ""“°¢–b‚÷6V7W&—G•Ç2¶6ÖW&ÆÆ&ÕÇ2·7—7FV×Æ67GbòçFW7B‡FW‡B’’Fw2æFB‚'6V7W&—G’"“°¢–b‚÷6Ö'EÇ2¶†öÖWÆ†öÖUÇ2¶WFöÖF–öçÇ&–æuÆ'ÆæW7EÆ"òçFW7B‡FW‡B’’Fw2æFB‚'6Ö'Eö†öÖR"“° ¢òò&VÂW7FFR²f–ææ6R²v÷fW&ææ6P¢–b‚÷&VÇF÷'Ç&VÅÇ2¶W7FFUÇ2¶vVçGÆÆ—7F–æuÇ2¶vVçGÆ'W–W"s÷5Ç2¶vVçGÆ'&ö¶W%Æ"òçFW7B‡FW‡B’¢Fw2æFB‚'&VÅöW7FFR"“°¢–b‚öÖ÷'FvvWÆÆVæFW'ÆÆöçÇ&Vf–ææ6WÇ&FUÆ'Æ%Æ"òçFW7B‡FW‡B’’Fw2æFB‚&Ö÷'FvvR"“°¢–b‚ö–ç7W&æ6WÆ–ç7W&VGÆ6Æ–ÕÆ'ÇöÆ–7•Æ'ÆF§W7FW"òçFW7B‡FW‡B’’Fw2æFB‚&–ç7W&æ6R"“°¢–b‚÷F—FÆUÇ2¶6ö×ç—ÆW67&÷wÆ6Æ÷6–æuÆ"òçFW7B‡FW‡B’’Fw2æFB‚'F—FÆUöW67&÷r"“°¢–b‚ö&—6ÇÆ&—6W"òçFW7B‡FW‡B’’Fw2æFB‚&&—6Â"“°¢–b‚ö–ç7V7F–öçÆ†öÖUÇ2¶–ç7V7F÷"òçFW7B‡FW‡B’’Fw2æFB‚&–ç7V7F–öâ"“°¢–b‚÷W&Ö—GÇW&Ö—GF–æwÆ6öFUÇ2¶Væf÷&6VÖVçGÆ–ç7V7F–öåÇ2¶FW'FÖVçBòçFW7B‡FW‡B’¢Fw2æFB‚'W&Ö—G5ö6öFR"“°¢–b‚öGF÷&æW—ÆÆw–W'ÆÆVvÅÆ'Æ6öçG&7EÆ'ÆÆ–VåÆ"òçFW7B‡FW‡B’’Fw2æFB‚&ÆVvÂ"“°¢–b‚öæ÷F'—Ææ÷F&—¦WÆæ÷F&—¦VBòçFW7B‡FW‡B’’Fw2æFB‚&æ÷F'’"“°¢–b‚ö6öçG&7F÷'Æ'V–ÆFW'Ç&VÖöFVÂòçFW7B‡FW‡B’’Fw2æFB‚&6öçG&7F÷'2"“°¢–b‚öÖ&¶WGÆ6WÆW†6†ævWÆf÷"6ÆWÆÆ—7F–æròçFW7B‡FW‡B’’Fw2æFB‚&Ö&¶WGÆ6R"“°¢–b‚öWfVçGÆÖVWGWÆÖVWF–æwÆvF†W&–æròçFW7B‡FW‡B’’Fw2æFB‚&WfVçG2"“°¢–b‚÷&V6öÖÖVæFF–öçÇ&V6öÖÖVæFF–öç7Çv†òFò–÷R&V6öÖÖVæGÇv†òv÷VÆB–÷R&V6öÖÖVæBòçFW7B‡FW‡B’¢Fw2æFB‚'&V6öÖÖVæFF–öç2"“°¢–b€¢õÆ"†ÆVG3÷Æ¦ö'3÷Æ&–G3÷ÆW7F–ÖFW3÷ÇV÷FW3ò•Æ'ÆÆöö¶–æuÇ2¶f÷%Ç2·v÷&·Çv÷&µÇ2²†æVVFVGÆf–Æ&ÆWÇvçFVB—ÆæVVEÇ2µµââõ×³ÃC‡ÕÇ2·v÷&²òçFW7B€¢FW‡@¢¢¢Fw2æFB‚'v÷&²"“°¢–b‚öF——ÆFõÇ2¶—EÇ2·–÷W'6VÆgÆ†÷uÇ2·FõÆ'ÇGWF÷&–ÂòçFW7B‡FW‡B’’Fw2æFB‚&F—’"“° ¢–b†6FVv÷'’bbG—Vöb6FVv÷'’ÓÓÒ'7G&–ær"’°¢6öç7B6BÒ6FVv÷'’çFôÆ÷vW$66R‚“°¢–b†6Bbb²&vVæW&Â%Òæ–æ6ÇVFW2†6B’’Fw2æFB†6B“°¢Ð ¢&WGW&â'&’æg&öÒ‡Fw2’ç6Æ–6RƒÂ"“°¢Ð ¢7–æ2gVæ7F–öâ7&VFTWFöÖF–46öÖ×Væ—G•vVÆ6öÖTf÷%W6W"€¢W6W#¢ç’À¢ö÷F–öç3ó¢²7&VFVEf–66÷WCó¢&ööÆVâÐ¢“¢&öÖ—6SÇfö–Câ°¢G'’°¢6öç7B&W6öÇfVE7FFT6öFRÐ¢‚‡W6W"2ç’’ç7FFT6öFR27G&–ærÂVæFVf–æVB’ÇÀ¢‡W6W"ç7FFR27G&–ærÂVæFVf–æVB’ÇÀ¢VæFVf–æVC°¢6öç7B&W6öÇfVD6÷VçG”f—2Ò‚‡W6W"2ç’’æ6÷VçG”f—227G&–ærÂVæFVf–æVB’ÇÂVæFVf–æVC°¢6öç7B6÷VçG”Æ&VÂÐ¢‚‡W6W"2ç’’æ6÷VçG”æÖR27G&–ærÂVæFVf–æVB’ÇÀ¢‚‡W6W"2ç’’æ6÷VçG’27G&–ærÂVæFVf–æVB’ÇÀ¢VæFVf–æVC° ¢òò6öÖ×Væ—G’7F—f—G’—26÷VçG’Ö&÷VæBâFòæ÷B7&VFR÷'†âææ÷Væ6VÖVçG0¢òò&Vf÷&Röæ&ö&F–ær†26öÖÖ—GFVB&VÂ6÷VçG’6öçFW‡Bà¢–b‚&W6öÇfVE7FFT6öFRÇÂõåÆG³WÒBòçFW7B‡&W6öÇfVD6÷VçG”f—2ÇÂ""’’&WGW&ã° ¢6öç7B&öÆW5&s¢7G&–æuµÒÐ¢'&’æ—4'&’‚‡W6W"2ç’’ç&öÆW2’bb‡W6W"2ç’’ç&öÆW2æÆVæwF€¢ò‡W6W"2ç’’ç&öÆW0¢¢‡W6W"2ç’’ç&öÆP¢ò²‡W6W"2ç’’ç&öÆUÐ¢¢µÓ° ¢6öç7Bf—'7DæÖRÒ‡W6W"æf—'7DæÖR27G&–ærÂVæFVf–æVB’ÇÂ$æV–v†&÷"#°¢6öç7BÆ7DæÖRÒ‡W6W"æÆ7DæÖR27G&–ærÂVæFVf–æVB’ÇÂ"#°¢6öç7BF—7Æ”æÖRÒG¶f—'7DæÖWÒG¶Æ7DæÖRòG¶Æ7DæÖU³×Òæ¢"'Ö° ¢6öç7BÆö6F–öäÆ&VÂÐ¢6÷VçG”Æ&VÂbb&W6öÇfVE7FFT6öFP¢òG¶6÷VçG”Æ&VÂç&WÆ6R‚õÇ2²†6÷VçG—Ç&—6‡Æ&÷&÷Vv‡Æ6Vç7W2&VÆ×Væ–6—Æ—G’’Bö’Â""—ÒÂG·&W6öÇfVE7FFT6öFWÖ ¢¢&W6öÇfVE7FFT6öFRÇÂ'–÷W"&V#° ¢6öç7B&öÆT6öçFW‡BÒ‚‚’Óâ°¢6öç7BÆ÷vW%&öÆW2Ò&öÆW5&ræÖ‚‡"’Óâ7G&–ær‡"’çFôÆ÷vW$66R‚’“°¢–b†Æ÷vW%&öÆW2ç6öÖR‚‡"’Óâ"æ–æ6ÇVFW2‚&6öçG&7F÷""’ÇÂ"æ–æ6ÇVFW2‚&'V–ÆFW""’’’°¢&WGW&â%F†W’¦ö–æVBFò6†&R&7F–6ÂW‡W&–Væ6RæBF¶R'B–â&ö¦V7B6öçfW'6F–öç2â#°¢Ð¢–b†Æ÷vW%&öÆW2ç6öÖR‚‡"’Óâ"æ–æ6ÇVFW2‚&†öÖV÷væW""’’’°¢&WGW&â%F†W’¦ö–æVBFòW†6†ævR&V6öÖÖVæFF–öç2ÂVW7F–öç2ÂæBW6VgVÂGf–6Râ#°¢Ð¢&WGW&â%F†W’¦ö–æVBFò7F’–æf÷&ÖVBæB6öçG&–'WFRFòF†R6öÖ×Væ—G’â#°¢Ò’‚“° ¢6öç7BvVÆ6öÖUF—FÆRÒvVÆ6öÖRG¶f—'7DæÖWÖ°¢6öç7BvVÆ6öÖT6öçFVçBÒG¶F—7Æ”æÖWÒ&V6VçFÇ’¦ö–æVBG¶Æö6F–öäÆ&VÇÒâG·&öÆT6öçFW‡GÖ°¢6öç7BvVÆ6öÖUFw2Ò²&æWuöæV–v†&÷"%Ó° ¢v—B7F÷&vRæ7&VFT6öÖ×Væ—G•÷7B‡°¢F—FÆS¢vVÆ6öÖUF—FÆRÀ¢6öçFVçC¢vVÆ6öÖT6öçFVçBÀ¢6FVv÷'“¢&ææ÷Væ6VÖVçG2"À¢66÷S¢&6÷VçG’"À¢7FFT6öFS¢&W6öÇfVE7FFT6öFRÀ¢6÷VçG”f—3¢&W6öÇfVD6÷VçG”f—2À¢–ÖvUW&Ç3¢VæFVf–æVBÀ¢WF†÷$–C¢W6W"æ–BÀ¢—5V&Æ—6†VC¢G'VRÀ¢—4†–FFVã¢fÇ6RÀ¢Æ–¶T6÷VçC¢À¢6öÖÖVçD6÷VçC¢À¢Fw3¢vVÆ6öÖUFw2æÆVæwF‚òvVÆ6öÖUFw2¢VæFVf–æVBÀ¢Ò“° ¢òò¶VWWFöÖF–2öæ&ö&F–ærfVVB6öçFVçBFò6–ævÆRvVÆ6öÖR÷7Bà¢òòFF—F–öæÂWFövVæW&FVB–çG&ò÷7G2ÖFRF†RfVVBfVVÂ&WWF—F—fRà¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚%´6öÖ×Væ—G•Òf–ÆVBFò7&VFRWFöÖF–2vVÆ6öÖRö–çG&ò÷7G2f÷"W6W""Â°¢W6W$–C¢‡W6W"2ç’“òæ–BÀ¢W'&÷#¢†W'"2ç’“òæÖW76vRÀ¢Ò“°¢Ð¢Ð ¢6öç7B&WV—&T6öÖ×Væ—G•&–æ6—Ä–FVçF—G’Ò‡&W¢ç’Â&W3¢ç’ÂæW‡C¢ç’’Óâ°¢6öç7B–FVçF—G”6öçFW‡BÒ&W6öÇfU&WVW7DVffV7F—fUW6W"‡&W“°¢–b‚–FVçF—G”6öçFW‡Bæö²’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢%Væ&ÆRFò6öæf—&ÒF†RVffV7F—fR6öÖ×Væ—G’–FVçF—G’â"À¢6öFS¢$4ôÔÕTä•E•ô”DTåD•E•ô4ôåDU…Eô”ådÄ”B"À¢Ò“°¢Ð ¢–b†–FVçF—G”6öçFW‡Bæ—4–×W'6öæF–ær’°¢&WGW&â&W2ç7FGW2ƒC’’æ§6öâ‡°¢ÖW76vS¢$6öÖ×Væ—G’÷7F–ær—2Væf–Æ&ÆRv†–ÆR7F–ær2æ÷F†W"W6W"â"À¢6öFS¢$4ôÔÕTä•E•ô”ÕU%4ôäD”ôåõu$•DUõTäd”Ä$ÄR"À¢Ò“°¢Ð ¢&Wæ6öÖ×Væ—G”7&VFT–FVçF—G’Ò–FVçF—G”6öçFW‡C°¢&WGW&âæW‡B‚“°¢Ó° ¢ç÷7B€¢"ö’ö6öÖ×Væ—G’÷÷7G2"À¢—4WF†VçF–6FVBÀ¢&WV—&T6öÖ×Væ—G•&–æ6—Ä–FVçF—G’À¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B–FVçF—G”6öçFW‡BÒ&Wæ6öÖ×Væ—G”7&VFT–FVçF—G“°¢–b‚–FVçF—G”6öçFW‡Còæö²ÇÂ–FVçF—G”6öçFW‡Bæ—4–×W'6öæF–ær’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢%Væ&ÆRFò6öæf—&ÒF†RVffV7F—fR6öÖ×Væ—G’–FVçF—G’â"À¢6öFS¢$4ôÔÕTä•E•ô”DTåD•E•ô4ôåDU…Eô”ådÄ”B"À¢Ò“°¢Ð ¢6öç7BW6W$–BÒ–FVçF—G”6öçFW‡BæVffV7F—fUW6W$–C°¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B²F—FÆRÂ6öçFVçBÂ6FVv÷'’Â–ÖvW2ÒÒ&Wæ&öG“°¢6öç7B–ÖvUW&Ç3¢7G&–æuµÒÂVæFVf–æVBÒ'&’æ—4'&’†–ÖvW2¢ò–ÖvW0¢¢–ÖvW0¢òµ7G&–ær†–ÖvW2•Ð¢¢VæFVf–æVC° ¢6öç7B6÷VçG”6öçFW‡BÒv—B&W6öÇfUW6W$6÷VçG•w&—FT6öçFW‡B‡W6W"Â†6÷VçG”f—2’Óà¢7F÷&vRævWD6÷VçG”'”f—2†6÷VçG”f—2¢“°¢–b‚6÷VçG”6öçFW‡B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$6ö×ÆWFR–÷W"6÷VçG’Æö6F–öâ&Vf÷&R7&VF–ær6öÖ×Væ—G’÷7Bâ"À¢6öFS¢$4ôÔÕTä•E•ô4õTåE•ô4ôåDU…Eõ$UT•$TB"À¢Ò“°¢Ð ¢6öç7B°¢66÷S¢&W6öÇfVE66÷RÀ¢7FFT6öFS¢&W6öÇfVE7FFT6öFRÀ¢6÷VçG”f—3¢&W6öÇfVD6÷VçG”f—2À¢ÒÒ6÷VçG”6öçFW‡C° ¢6öç7BFw2ÒFW&—fT6öÖ×Væ—G•Fw4g&öÔ6öçFVçB‡F—FÆRÂ6öçFVçBÂ6FVv÷'’“° ¢6öç7BæWu÷7BÒv—B7F÷&vRæ7&VFT6öÖ×Væ—G•÷7B‡°¢F—FÆRÀ¢6öçFVçBÀ¢6FVv÷'’À¢66÷S¢&W6öÇfVE66÷RÀ¢7FFT6öFS¢&W6öÇfVE7FFT6öFRÀ¢6÷VçG”f—3¢&W6öÇfVD6÷VçG”f—2À¢–ÖvUW&Ç2À¢WF†÷$–C¢W6W$–BÀ¢—5V&Æ—6†VC¢G'VRÀ¢—4†–FFVã¢fÇ6RÀ¢Æ–¶T6÷VçC¢À¢6öÖÖVçD6÷VçC¢À¢Fw3¢Fw2æÆVæwF‚òFw2¢VæFVf–æVBÀ¢Ò“° ¢v—B&VfÆV7D6öÖ×Væ—G”7F–öâ‡7F÷&vRÂ°¢WfVçEG—S¢WfVçEG—W2åõ5Eô5$TDTBÀ¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢÷7D–C¢7G&–ær†æWu÷7Bæ–B’À¢W‡G&¢°¢6FVv÷'“¢6FVv÷'’ÇÂçVÆÂÀ¢66÷S¢&W6öÇfVE66÷RÀ¢7FFT6öFS¢&W6öÇfVE7FFT6öFRÀ¢6÷VçG”f—3¢&W6öÇfVD6÷VçG”f—2À¢ÒÀ¢Ò“° ¢òò”åDTÄÄ”tTåB4DTtõ%’$õUD”äp¢òòÖ2‡VÖâ–çFVçB(i"7—7FVÒ7F–öç2t•D„õUBW‡÷6–ær–çFW&æÂ7—7FVÒæÖW2FòW6W'0¢òò†–Æ÷6÷‡“¢W6W'2F†–æ²$’æVVB†VÇ"Â7—7FVÒ&÷WFW2FòF—&V7B6öææV7B6–ÆVçFÇ ¢òòâ$UTU5B‡v÷&²’(i"6†V6²–bF—&V7B6öææV7BVÆ–v–&ÆP¢–b†6FVv÷'’ÓÓÒ'&WVW7B"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒ&WVW7B÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒF—&V7B6öææV7BVÆ–v–&–Æ—G’6†V6²VWVVF ¢“°¢Ð ¢òò"âTU5D”ôâ(i"æ÷F–g’66÷WBf÷"÷FVçF–Â’&W7öç6P¢–b†6FVv÷'’ÓÓÒ'VW7F–öâ"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒVW7F–öâ÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒ66÷WBæÇ—6—2VWVVF ¢“°¢Ð ¢òò2âdõ"4ÄR(i"WFòÖ7&VFRÖ&¶WGÆ6RÆ—7F–æp¢–b†6FVv÷'’ÓÓÒ&f÷'6ÆR"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒf÷"6ÆR÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒÖ&¶WGÆ6RÆ—7F–ær7&VF–öâVWVVF ¢“°¢Ð ¢òòBâÄU%B(i"&–÷&—G’æ÷F–f–6F–öç2Fò&VÆWfçBW6W'0¢–b†6FVv÷'’ÓÓÒ&ÆW'B"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒÆW'B÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒ&–÷&—G’æ÷F–f–6F–öç2VWVVF ¢“°¢Ð ¢òòRâUdTåB(i"6ÆVæF"–çFVw&F–öà¢–b†6FVv÷'’ÓÓÒ&WfVçB"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒWfVçB÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒ6ÆVæF"–çFVw&F–öâVWVVF ¢“°¢Ð ¢òòbâ$T4ôÔÔTäDD”ôâ(i"Æ–æ²Fò6öçG&7F÷"ö'W6–æW72&öf–ÆW0¢–b†6FVv÷'’ÓÓÒ'&V6öÖÖVæFF–öâ"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒ&V6öÖÖVæFF–öâ÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒ&öf–ÆRÆ–æ¶–ærVWVVF ¢“°¢Ð ¢òòrâD•(i"fVVB66÷WBÆV&æ–ær7—7FVÐ¢–b†6FVv÷'’ÓÓÒ'F—"’°¢6öç6öÆRæÆör€¢´4DTtõ%’$õUD”äuÒF—÷7B7&VFVC¢G¶æWu÷7Bæ–GÒÒ66÷WBÆV&æ–ær–ævW7F–öâVWVVF ¢“°¢Ð ¢6öç7B6FVv÷'•&÷WF–æu7VÖÖ'“¢'F–ÃÅ&V6÷&CÇ7G&–ærÂ7G&–æsãâÒ°¢&WVW7C¢&F—&V7Eö6öææV7EöVÆ–v–&–Æ—G’"À¢VW7F–öã¢'66÷WEöæÇ—6—2"À¢f÷'6ÆS¢&Ö&¶WGÆ6UöW‡G&7F–öâ"À¢ÆW'C¢'&–÷&—G•öæ÷F–f–6F–öç2"À¢WfVçC¢&6ÆVæF%öW‡G&7F–öâ"À¢&V6öÖÖVæFF–öã¢'&öf–ÆUöÆ–æ¶–ær"À¢F—¢&¶æ÷vÆVFvUö–ævW7F–öâ"À¢Ó°¢6öç7B&÷WF–æu7VÖÖ'’Ò6FVv÷'•&÷WF–æu7VÖÖ'•¶6FVv÷'•Ó°¢–b‡&W6öÇfVD6÷VçG”f—2bb&÷WF–æu7VÖÖ'’’°¢v—B7F÷&vRæ7&VFT6÷VçG”æ÷FR‡°¢6÷VçG”f—3¢&W6öÇfVD6÷VçG”f—2À¢WF†÷%W6W$–C¢7G&–ær‡W6W$–B’À¢6FVv÷'“¢&÷W&F–öç2"À¢6öçFVçC¢6öÖ×Væ—G•÷÷7C¢G¶æWu÷7Bæ–GÓ¢G·&÷WF–æu7VÖÖ'—ÖÀ¢Ò2ç’“°¢Ð ¢æ÷F–g”–æFW„æ÷r…¶ö6öÖ×Væ—G’÷÷7G2òG¶æWu÷7Bæ–GÖÂ"ö6öÖ×Væ—G’%Ò“°¢&W2ç7FGW2ƒ#’æ§6öâ†æWu÷7B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær6öÖ×Væ—G’÷7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR÷7B"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B†–B“° ¢–b‚÷7BÇÂ÷7Bæ—5V&Æ—6†VBÓÒG'VRÇÂ÷7Bæ—4†–FFVâÓÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð¢6öç7BWF†÷"Òv—B7F÷&vRævWEW6W"‡÷7BæWF†÷$–B“°¢6öç7BV&Æ–5÷7BÒFõV&Æ–46öÖ×Væ—G•÷7B€¢÷7BÀ¢WF†÷ ¢ò°¢ââæWF†÷"À¢&öf–ÆT–ÖvUW&Ã¢æ÷&ÖÆ—¦U&öf–ÆT–ÖvUW&Â†WF†÷"ç&öf–ÆT–ÖvUW&Â’À¢Ð¢¢çVÆÀ¢“°¢–b‚V&Æ–5÷7B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“° ¢&W2æ§6öâ‡V&Æ–5÷7B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’÷7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚÷7B"Ò“°¢Ð¢Ò“° ¢òò÷7B–çFW&7F–öç0¢ç÷7B€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–BöÆ–¶R"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B²–C¢÷7D–BÒÒ&Wç&×3° ¢6öç7Bf–WvW"ÒW6W$–Bòv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’’¢çVÆÃ°¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B…7G&–ær‡÷7D–B’“°¢–b‚÷7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bf–WvW$6÷VçG”f—2Ò‡f–WvW"2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢6öç7B÷7D6÷VçG”f—2Ò‡÷7B2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢–b€¢f–WvW$6÷VçG”f—2ÇÀ¢÷7D6÷VçG”f—2ÇÀ¢7G&–ær‡f–WvW$6÷VçG”f—2’ÓÒ7G&–ær‡÷7D6÷VçG”f—2¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢$Æ–¶W2&RÆö6ÂÖöæÇ’â7v—F6‚FòÆö6ÂFò–çFW&7Bv—F‚÷7G2–â–÷W"&Vâ"À¢&V6öä6öFS¢$tÄô$Åõ$TEôôäÅ’"À¢Ò“°¢Ð ¢6öç7B&W7VÇBÒv—B7F÷&vRçFövvÆU÷7DÆ–¶R‡W6W$–BÂ÷7D–B“° ¢–b‡&W7VÇBæÆ–¶VB’°¢v—B&VfÆV7D6öÖ×Væ—G”7F–öâ‡7F÷&vRÂ°¢WfVçEG—S¢WfVçEG—W2åõ5EôÄ”´TBÀ¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢7V&¦V7EW6W$–C¢7G&–ær‚‡÷7B2ç’’æWF†÷$–BÇÂ""’À¢÷7D–C¢7G&–ær‡÷7D–B’À¢Æ–¶VC¢G'VRÀ¢Ò“°¢Ð ¢&W2æ§6öâ‡&W7VÇB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"FövvÆ–ær÷7BÆ–¶S¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFövvÆRÆ–¶R"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–B÷6fR"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B²–C¢÷7D–BÒÒ&Wç&×3° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7Bf–WvW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B…7G&–ær‡÷7D–B’“°¢–b‚÷7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bf–WvW$6÷VçG”f—2Ò‡f–WvW"2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢6öç7B÷7D6÷VçG”f—2Ò‡÷7B2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢–b€¢f–WvW$6÷VçG”f—2ÇÀ¢÷7D6÷VçG”f—2ÇÀ¢7G&–ær‡f–WvW$6÷VçG”f—2’ÓÒ7G&–ær‡÷7D6÷VçG”f—2¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢%6f–ær—2Æö6ÂÖöæÇ’â7v—F6‚FòÆö6ÂFò–çFW&7Bv—F‚÷7G2–â–÷W"&Vâ"À¢&V6öä6öFS¢$tÄô$Åõ$TEôôäÅ’"À¢Ò“°¢Ð ¢6öç7B¶W†—7F–æuÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ†6öÖ×Væ—G•÷7E6fW2¢çv†W&R€¢æB€¢W†6öÖ×Væ—G•÷7E6fW2çW6W$–BÂ7G&–ær‡W6W$–B’’À¢W†6öÖ×Væ—G•÷7E6fW2ç÷7D–BÂ7G&–ær‡÷7D–B’¢¢¢æÆ–Ö—Bƒ“° ¢–b†W†—7F–ær’°¢v—BF"æFVÆWFR†6öÖ×Væ—G•÷7E6fW2’çv†W&R†W†6öÖ×Væ—G•÷7E6fW2æ–BÂW†—7F–æræ–B’“°¢&WGW&â&W2æ§6öâ‡²6fVC¢fÇ6RÒ“°¢Ð ¢v—BF ¢æ–ç6W'B†6öÖ×Væ—G•÷7E6fW2¢çfÇVW2‡²W6W$–C¢7G&–ær‡W6W$–B’Â÷7D–C¢7G&–ær‡÷7D–B’Ò¢æöä6öæfÆ–7DFôæ÷F†–ær‚“° ¢G'’°¢v—B7F÷&vRæÆötWfVçB‚'÷7Bç6fVB"Â°¢W6W$–C¢7G&–ær‡W6W$–B’À¢F&vWEW6W$–C¢7G&–ær‚‡÷7B2ç’’æWF†÷$–B’À¢÷7D–C¢7G&–ær‡÷7D–B’À¢6÷W&6S¢&6öÖ×Væ—G’"À¢Ò“°¢Ò6F6‚†R’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFòÆör÷7Bç6fVBf÷"…"ÂR“°¢Ð ¢&W2æ§6öâ‡²6fVC¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6f–ær6öÖ×Væ—G’÷7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6fR÷7B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–Bö6öÖÖVçG2"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7B²–C¢÷7D–BÒÒ&Wç&×3°¢6öç7B²6öçFVçBÂ&VçD6öÖÖVçD–BÒÒ&Wæ&öG“° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢–b‡G—Vöb6öçFVçBÓÒ'7G&–ær"ÇÂ6öçFVçBçG&–Ò‚’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$6öÖÖVçB6öçFVçB—2&WV—&VB"Ò“°¢Ð ¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B‡÷7D–B“°¢–b‚÷7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bæ÷&ÖÆ—¦VE&VçD6öÖÖVçD–BÐ¢G—Vöb&VçD6öÖÖVçD–BÓÓÒ'7G&–ær"bb&VçD6öÖÖVçD–BçG&–Ò‚¢ò&VçD6öÖÖVçD–BçG&–Ò‚¢¢çVÆÃ°¢ÆWB&VçDWF†÷$–C¢7G&–ærÂçVÆÂÒçVÆÃ°¢–b†æ÷&ÖÆ—¦VE&VçD6öÖÖVçD–B’°¢6öç7B&VçD6öÖÖVçBÒv—B7F÷&vRævWE÷7D6öÖÖVçB†æ÷&ÖÆ—¦VE&VçD6öÖÖVçD–B“°¢–b‚&VçD6öÖÖVçBÇÂ7G&–ær‡&VçD6öÖÖVçBç÷7D–B’ÓÒ7G&–ær‡÷7D–B’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%&VçB6öÖÖVçBFöW2æ÷B&VÆöærFòF†—2÷7B"Ò“°¢Ð¢&VçDWF†÷$–BÒ&VçD6öÖÖVçBæWF†÷$–Bò7G&–ær‡&VçD6öÖÖVçBæWF†÷$–B’¢çVÆÃ°¢Ð ¢6öç7Bf–WvW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7Bf–WvW$6÷VçG”f—2Ò‡f–WvW"2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢6öç7B÷7D6÷VçG”f—2Ò‡÷7B2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ°¢–b€¢f–WvW$6÷VçG”f—2ÇÀ¢÷7D6÷VçG”f—2ÇÀ¢7G&–ær‡f–WvW$6÷VçG”f—2’ÓÒ7G&–ær‡÷7D6÷VçG”f—2¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS ¢$6öÖÖVçG2&RÆö6ÂÖöæÇ’â7v—F6‚FòÆö6ÂFò–çFW&7Bv—F‚÷7G2–â–÷W"&Vâ"À¢&V6öä6öFS¢$tÄô$Åõ$TEôôäÅ’"À¢Ò“°¢Ð ¢6öç7BVæf÷&6T6öÖÖVçD6öçF7DvFRÐ¢7G&–ær‡&ö6W72æVçbäTädõ$4Uô4ôÔÔTåEô4ôåD5EôtDRÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚’ÓÓÒ'G'VR#° ¢–b†Væf÷&6T6öÖÖVçD6öçF7DvFRbb7G&–ær‡÷7BæWF†÷$–B’ÓÒ7G&–ær‡W6W$–B’’°¢6öç7B²vWD6öçF7EW&Ö—76–öâÂVç7W&T6öçF7E&WVW7BÒÐ¢v—B–×÷'B‚"â÷WF–Ç2ö6öçF7E&WVW7G2"“°¢6öç7B&WVW7FW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7B&WVW7FW$6÷VçG”f—2Ò‡&WVW7FW"2ç’“òæ6÷VçG”f—2ÇÂçVÆÃ° ¢6öç7BW&Ö—76–öâÒv—BvWD6öçF7EW&Ö—76–öâ…7G&–ær‡W6W$–B’Â7G&–ær‡÷7BæWF†÷$–B’“°¢–b‡W&Ö—76–öãòç7FGW2ÓÓÒ&66WFVB"’°¢òò&ö6VV@¢ÒVÇ6R–b‡W&Ö—76–öãòç7FGW2ÓÓÒ'VæF–ær"’°¢&WGW&â&W2ç7FGW2ƒ#"’æ§6öâ‡°¢VæF–æs¢G'VRÀ¢&WVW7D–C¢W&Ö—76–öâæÆ7E&WVW7Dæ÷F–f–6F–öä–BÇÂçVÆÂÀ¢ÖW76vS¢$6öçF7B&WVW7BÇ&VG’VæF–ær&V6—–VçB&÷fÂâ"À¢Ò“°¢ÒVÇ6R–b‡W&Ö—76–öãòç7FGW2ÓÓÒ&FV6Æ–æVB"ÇÂW&Ö—76–öãòç7FGW2ÓÓÒ&&Æö6¶VB"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢%&V6—–VçB†2FV6Æ–æVBf—'7B6öçF7Bâ"À¢&V6öä6öFS¢$4ôåD5EôDT4Ä”äTB"À¢Ò“°¢ÒVÇ6R°¢6öç7BVç7W&RÒv—BVç7W&T6öçF7E&WVW7B‡°¢&WVW7FW$–C¢7G&–ær‡W6W$–B’À¢F&vWEW6W$–C¢7G&–ær‡÷7BæWF†÷$–B’À¢&Wf–Ws¢6öçFVçBÀ¢ÖWFFF¢°¢6öçF7EG—S¢&6öÖÖVçB"À¢6öçFVçBÀ¢÷7D–BÀ¢6÷W&6S¢&6öÖ×Væ—G’"À¢6÷VçG”f—3¢&WVW7FW$6÷VçG”f—2À¢ÒÀ¢Ò“° ¢–b†Vç7W&Rç7FGW2ÓÓÒ'VæF–ær"’°¢&WGW&â&W2ç7FGW2ƒ#"’æ§6öâ‡°¢VæF–æs¢G'VRÀ¢&WVW7D–C¢Vç7W&Rç&WVW7D–BÇÂçVÆÂÀ¢ÖW76vS¢$6öçF7B&WVW7B6VçBâ&V6—–VçB×W7B66WB&Vf÷&R6öÖÖVçB÷7G2â"À¢Ò“°¢Ð¢Ð¢Ð ¢6öç7B6öÖÖVçBÒv—B7F÷&vRæ7&VFU÷7D6öÖÖVçB‡°¢÷7D–BÀ¢WF†÷$–C¢W6W$–BÀ¢6öçFVçBÀ¢&VçD6öÖÖVçD–C¢æ÷&ÖÆ—¦VE&VçD6öÖÖVçD–BÀ¢Ò“° ¢v—B&VfÆV7D6öÖ×Væ—G”7F–öâ‡7F÷&vRÂ°¢WfVçEG—S¢WfVçEG—W2ä4ôÔÔTåEô5$TDTBÀ¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢7V&¦V7EW6W$–C¢7G&–ær‡÷7BæWF†÷$–B’À¢÷7D–C¢7G&–ær‡÷7D–B’À¢6öÖÖVçD–C¢7G&–ær†6öÖÖVçBæ–B’À¢&VçD6öÖÖVçD–C¢æ÷&ÖÆ—¦VE&VçD6öÖÖVçD–BÀ¢W‡G&¢&VçDWF†÷$–Bò²&VçDWF†÷$–BÒ¢VæFVf–æVBÀ¢Ò“° ¢òòFV&FR÷&WÇ’&VfÆV7F–öã¢7&VF—BF†R&VçB6öÖÖVçBWF†÷"v†Vâ¢òòF–ffW&VçBW6W"&WÆ–W2‡VÆ—G’6–væÃ²66÷&–ær5Â62föÇVÖR’à¢–b€¢&VçDWF†÷$–Bb`¢&VçDWF†÷$–BÓÒ7G&–ær‡W6W$–B’b`¢&VçDWF†÷$–BÓÒ7G&–ær‡÷7BæWF†÷$–B¢’°¢v—B&VfÆV7D6öÖ×Væ—G”7F–öâ‡7F÷&vRÂ°¢WfVçEG—S¢WfVçEG—W2ä4ôÔÔTåEô5$TDTBÀ¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢7V&¦V7EW6W$–C¢&VçDWF†÷$–BÀ¢÷7D–C¢7G&–ær‡÷7D–B’À¢6öÖÖVçD–C¢7G&–ær†6öÖÖVçBæ–B’À¢&VçD6öÖÖVçD–C¢æ÷&ÖÆ—¦VE&VçD6öÖÖVçD–BÀ¢W‡G&¢²&VfÆV7F–öä¶–æC¢&FV&FU÷&WÇ’"ÒÀ¢Ò“°¢Ð ¢&W2ç7FGW2ƒ#’æ§6öâ†6öÖÖVçB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær6öÖÖVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6öÖÖVçB"Ò“°¢Ð¢Ð¢“° ¢òò6öÖ×Væ—G’(i"v÷&²&ö&C¢7&VFR÷"&WGW&ââ–FV×÷FVçBv÷&²&WVW7Bf÷"÷7@¢ç÷7B€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–B÷6VæB×FòÖ&ö&B"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B²–C¢÷7D–BÒÒ&Wç&×3° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B‡÷7D–B“°¢–b‚÷7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð ¢–b‡÷7BæWF†÷$–BÓÒ7G&–ær‡W6W$–B’’°¢&WGW&â&W0¢ç7FGW2ƒC2¢æ§6öâ‡²ÖW76vS¢$öæÇ’F†R÷&–v–æÂWF†÷"6â6VæB÷7BFòF†Rv÷&²&ö&B"Ò“°¢Ð ¢òò–FV×÷FVæ7“¢–bv÷&²&WVW7BÇ&VG’W†—7G2f÷"F†—2÷7BÂ&WGW&â—Bà¢6öç7B¶W†—7F–æuÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ‡v÷&µ&WVW7G2¢çv†W&R€¢æB†W‡v÷&µ&WVW7G2ç6÷W&6RÂ&6öÖ×Væ—G’"’ÂW‡v÷&µ&WVW7G2ç6÷W&6U&Vd–BÂ7G&–ær‡÷7D–B’’¢“° ¢–b†W†—7F–ær’°¢&WGW&â&W2æ§6öâ†W†—7F–ær“°¢Ð ¢6öç7BF—FÆRÐ¢‡÷7B2ç’’çF—FÆRbb7G&–ær‚‡÷7B2ç’’çF—FÆR’çG&–Ò‚’æÆVæwF‚â ¢ò7G&–ær‚‡÷7B2ç’’çF—FÆR’çG&–Ò‚¢¢%v÷&²&WVW7Bg&öÒ6öÖ×Væ—G’÷7B#° ¢6öç7BFW67&—F–öâÒ7G&–ær‚‡÷7B2ç’’æ6öçFVçBÇÂ""’çG&–Ò‚“°¢–b‚FW67&—F–öâ’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢%÷7B×W7B†fR6öçFVçBFò7&VFRv÷&²&WVW7B"Ò“°¢Ð ¢6öç7B7FFT6öFRÐ¢G—Vöb‡÷7B2ç’’ç7FFT6öFRÓÓÒ'7G&–ær"bb‡÷7B2ç’’ç7FFT6öFRæÆVæwF‚ÓÓÒ ¢ò‡÷7B2ç’’ç7FFT6öFP¢¢VæFVf–æVC°¢6öç7B6÷VçG”f—2Ð¢G—Vöb‡÷7B2ç’’æ6÷VçG”f—2ÓÓÒ'7G&–ær"bb‡÷7B2ç’’æ6÷VçG”f—2æÆVæwF‚â ¢ò‡÷7B2ç’’æ6÷VçG”f—0¢¢VæFVf–æVC° ¢6öç7B6FVv÷'’Ð¢G—Vöb‡÷7B2ç’’æ6FVv÷'’ÓÓÒ'7G&–ær"bb‡÷7B2ç’’æ6FVv÷'’çG&–Ò‚’æÆVæwF‚â ¢ò‡÷7B2ç’’æ6FVv÷'’çG&–Ò‚¢¢VæFVf–æVC° ¢6öç7B¶7&VFVEÒÒv—BF ¢æ–ç6W'B‡v÷&µ&WVW7G2¢çfÇVW2‡°¢7&VFVD'•W6W$–C¢7G&–ær‡W6W$–B’À¢F—FÆRÀ¢FW67&—F–öâÀ¢6FVv÷'’À¢6÷VçG”f—2À¢7FFT6öFRÀ¢66÷S¢&6öÖ×Væ—G’"À¢6÷W&6S¢&6öÖ×Væ—G’"À¢6÷W&6U&Vd–C¢7G&–ær‡÷7D–B’À¢7FGW3¢&÷Vâ"À¢f—6–&–Æ—G“¢&6öÖ×Væ—G’"À¢W‡÷7W&TÖöFS¢&wV–FVB"À¢6ö×WF—F–öäÖöFS¢&æöæR"À¢Ò¢ç&WGW&æ–ær‚“° ¢–b†7&VFVB’°¢G'’°¢v—BF"æ–ç6W'B‡v÷&µ&WVW7DWfVçG2’çfÇVW2‡°¢v÷&µ&WVW7D–C¢7&VFVBæ–BÀ¢G—S¢'6VçE÷Fõö&ö&B"À¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢g&öÕ7FGW3¢çVÆÂÀ¢Fõ7FGW3¢&÷Vâ"À¢ÖWFFF¢°¢6÷W&6S¢&6öÖ×Væ—G’"À¢÷7D–C¢7G&–ær‡÷7D–B’À¢ÒÀ¢Ò“°¢Ò6F6‚†R’°¢6öç6öÆRçv&â‚$f–ÆVBFò&V6÷&Bv÷&²&WVW7B6VçE÷Fõö&ö&BWfVçB"ÂR“°¢Ð¢Ð ¢&W2ç7FGW2ƒ#’æ§6öâ†7&VFVBóòçVÆÂ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6VæF–ær6öÖ×Væ—G’÷7BFòv÷&²&ö&C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡°¢ÖW76vS¢$f–ÆVBFò6VæB÷7BFòv÷&²&ö&B"À¢&WVW7D–C¢‡&W2ç’’ç&WVW7D–BÇÂçVÆÂÀ¢Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–Bö6öÖÖVçG2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–C¢÷7D–BÒÒ&Wç&×3°¢6öç7B÷7BÒv—B7F÷&vRævWD6öÖ×Væ—G•÷7B‡÷7D–B“°¢–b‚÷7BÇÂ÷7Bæ—5V&Æ—6†VBÓÒG'VRÇÂ÷7Bæ—4†–FFVâÓÓÒG'VR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð¢6öç7B6öÖÖVçG2Òv—BF ¢ç6VÆV7B‡°¢6öÖÖVçC¢÷7D6öÖÖVçG2À¢WF†÷#¢°¢–C¢W6W'2æ–BÀ¢f—'7DæÖS¢W6W'2æf—'7DæÖRÀ¢Æ7DæÖS¢W6W'2æÆ7DæÖRÀ¢&öf–ÆT–ÖvUW&Ã¢W6W'2ç&öf–ÆT–ÖvUW&ÂÀ¢&öÆS¢W6W'2ç&öÆRÀ¢fW&–f–VC¢W6W'2æFG&W75fW&–f–VBÀ¢ÒÀ¢Ò¢æg&öÒ‡÷7D6öÖÖVçG2¢æÆVgD¦ö–â‡W6W'2ÂW‡÷7D6öÖÖVçG2æWF†÷$–BÂW6W'2æ–B’¢çv†W&R†W‡÷7D6öÖÖVçG2ç÷7D–BÂ÷7D–B’¢æ÷&FW$'’†62‡÷7D6öÖÖVçG2æ7&VFVDB’“° ¢6öç7Bf÷&ÖGFVBÒ6öÖÖVçG2æÖ‚‡²6öÖÖVçBÂWF†÷"Ò’Óâ‡°¢ââæ6öÖÖVçBÀ¢WF†÷#¢WF†÷ ¢ò°¢–C¢WF†÷"æ–BÀ¢æÖS ¢G¶WF†÷"æf—'7DæÖRÇÂ"'ÒG¶WF†÷"æÆ7DæÖRÇÂ"'ÖçG&–Ò‚’ÇÂ$6öÖ×Væ—G’ÖVÖ&W""À¢fF#¢æ÷&ÖÆ—¦U&öf–ÆT–ÖvUW&Â†WF†÷"ç&öf–ÆT–ÖvUW&Â’À¢&öÆS¢WF†÷"ç&öÆRÀ¢fW&–f–VC¢&ööÆVâ†WF†÷"çfW&–f–VB’À¢Ð¢¢VæFVf–æVBÀ¢Ò’“° ¢&W2æ§6öâ†f÷&ÖGFVB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær÷7B6öÖÖVçG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6öÖÖVçG2"Ò“°¢Ð¢Ò“° ¢òò6öÖ×Væ—G’÷7BFÖ–â7F–öç0¢çF6‚€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–B÷–â"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢—46öÖ×Væ—G”ÖöFW&F÷"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²—5–ææVBÒÒ‡&Wæ&öG’óò·Ò’2ç“° ¢–b‡G—Vöb—5–ææVBÓÒ&&ööÆVâ"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&—5–ææVB×W7B&R&ööÆVâ"Ò“°¢Ð ¢v—BF ¢çWFFR†6öÖ×Væ—G•÷7G2¢ç6WB‡°¢—5–ææVBÀ¢WFFVDC¢æWrFFR‚’À¢ÖöFW&FVD'“¢‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"À¢ÖöFW&FVDC¢æWrFFR‚’À¢Ò¢çv†W&R†W†6öÖ×Væ—G•÷7G2æ–BÂ–B’“° ¢æ÷F–g”–æFW„æ÷r…¶ö6öÖ×Væ—G’÷÷7G2òG¶–GÖÂ"ö6öÖ×Væ—G’%Ò“°¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær6öÖ×Væ—G’÷7B–â7FFS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR–â7FFR"Ò“°¢Ð¢Ð¢“° ¢çF6‚€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–Bö†–FR"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢—46öÖ×Væ—G”ÖöFW&F÷"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²—4†–FFVâÂÖöFW&F÷$æ÷FW2ÒÒ‡&Wæ&öG’óò·Ò’2ç“° ¢–b‡G—Vöb—4†–FFVâÓÒ&&ööÆVâ"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&—4†–FFVâ×W7B&R&ööÆVâ"Ò“°¢Ð ¢v—BF ¢çWFFR†6öÖ×Væ—G•÷7G2¢ç6WB‡°¢—4†–FFVâÀ¢ÖöFW&F÷$æ÷FW3¢G—VöbÖöFW&F÷$æ÷FW2ÓÓÒ'7G&–ær"òÖöFW&F÷$æ÷FW2¢çVÆÂÀ¢ÖöFW&FVD'“¢‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"À¢ÖöFW&FVDC¢æWrFFR‚’À¢WFFVDC¢æWrFFR‚’À¢Ò¢çv†W&R†W†6öÖ×Væ—G•÷7G2æ–BÂ–B’“° ¢æ÷F–g”–æFW„æ÷r…¶ö6öÖ×Væ—G’÷÷7G2òG¶–GÖÂ"ö6öÖ×Væ—G’%Ò“°¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær6öÖ×Væ—G’÷7Bf—6–&–Æ—G“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRf—6–&–Æ—G’"Ò“°¢Ð¢Ð¢“° ¢æFVÆWFR€¢"ö’ö6öÖ×Væ—G’÷÷7G2ó¦–B"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢—46öÖ×Væ—G”ÖöFW&F÷"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3° ¢6öç7B·÷7EÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ†6öÖ×Væ—G•÷7G2¢çv†W&R†W†6öÖ×Væ—G•÷7G2æ–BÂ–B’¢æÆ–Ö—Bƒ“° ¢–b‚÷7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%÷7Bæ÷Bf÷VæB"Ò“°¢Ð ¢v—BF"æFVÆWFR†6öÖ×Væ—G•÷7G2’çv†W&R†W†6öÖ×Væ—G•÷7G2æ–BÂ–B’“° ¢æ÷F–g”–æFW„æ÷r…¶ö6öÖ×Væ—G’÷÷7G2òG¶–GÖÂ"ö6öÖ×Væ—G’%Ò“°¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"FVÆWF–ær6öÖ×Væ—G’÷7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFVÆWFR÷7B"Ò“°¢Ð¢Ð¢“° ¢òò6öÖ×Væ—G’w&÷W0¢ævWB‚"ö’ö6öÖ×Væ—G’öw&÷W2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BWF…W6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢–b†WF…W6W$–B’°¢G'’°¢6öç7B²Vç7W&T6÷VçG”w&÷WÖVÖ&W'6†—f÷%W6W"ÒÒv—B–×÷'B‚"â÷&÷WFW2öw&÷W2"“°¢v—BVç7W&T6÷VçG”w&÷WÖVÖ&W'6†—f÷%W6W"…7G&–ær†WF…W6W$–B’“°¢Ò6F6‚†ÖVÖ&W'6†—W'&÷"’°¢6öç6öÆRçv&â€¢%¶6öÖ×Væ—G’öw&÷W5Òf–ÆVBFòVæf÷&6R6÷VçG’WFòÖÖVÖ&W'6†—"À¢ÖVÖ&W'6†—W'&÷ ¢“°¢Ð¢Ð¢6öç7BW6W"ÒWF…W6W$–Bòv—B7F÷&vRævWEW6W"†WF…W6W$–B’¢çVÆÃ° ¢6öç7B†4W‡Æ–6—DÆö6F–öäf–ÇFW'2Ð¢&ööÆVâ‡&WçVW'’ç7FFT6öFR’ÇÂ&ööÆVâ‡&WçVW'’æ6÷VçG”f—2“° ¢6öç7Bf–ÇFW'3¢&ÖWFW'3ÇG—Vöb7F÷&vRævWDw&÷W3å³ÒÒ°¢7FFT6öFS ¢‡&WçVW'’ç7FFT6öFR27G&–ær’ÇÀ¢‡W6W"bb†4W‡Æ–6—DÆö6F–öäf–ÇFW'0¢ò‚‡W6W"2ç’’ç7FFT6öFR27G&–ær’ÇÂ‡W6W"ç7FFR27G&–ær’ÇÂVæFVf–æV@¢¢VæFVf–æVB’À¢6÷VçG”f—3 ¢‡&WçVW'’æ6÷VçG”f—227G&–ær’ÇÀ¢‡W6W"bb†4W‡Æ–6—DÆö6F–öäf–ÇFW'0¢ò‚‡W6W"2ç’’æ6÷VçG”f—227G&–ær’ÇÀ¢‚‡W6W"2ç’’æ6÷VçG•öf—227G&–ær’ÇÀ¢VæFVf–æV@¢¢VæFVf–æVB’À¢Æ–Ö—C¢&WçVW'’æÆ–Ö—Bò'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ær’¢#À¢öfg6WC¢&WçVW'’æöfg6WBò'6T–çB‡&WçVW'’æöfg6WB27G&–ær’¢À¢6V&6ƒ¢&WçVW'’ç6V&6‚27G&–ærÀ¢W6W$–C¢WF…W6W$–BÀ¢Ó° ¢6öç7Bw&÷W2Òv—B7F÷&vRævWDw&÷W2†f–ÇFW'2“°¢&W2æ§6öâ‡²w&÷W2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖ×Væ—G’w&÷W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚w&÷W2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’ö6öÖ×Væ—G’öw&÷W2ó¦w&÷W–Bö¦ö–â"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7B²w&÷W–BÒÒ&Wç&×3°¢v—B7F÷&vRæ¦ö–äw&÷W‡W6W$–BÂw&÷W–B“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"¦ö–æ–ær6öÖ×Væ—G’w&÷W¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò¦ö–âw&÷W"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö6öÖ×Væ—G’öw&÷W2ó¦w&÷W–BöÆVfR"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7B²w&÷W–BÒÒ&Wç&×3°¢v—B7F÷&vRæÆVfTw&÷W‡W6W$–BÂw&÷W–B“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"ÆVf–ær6öÖ×Væ—G’w&÷W¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆVfRw&÷W"Ò“°¢Ð¢Ð¢“° ¢òò&Vv–öç0¢ævWB‚"ö’÷&Vv–öç2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf–ÇFW'2Ò°¢7FFT6öFS¢&WçVW'’ç7FFT6öFR27G&–ærÀ¢—4öff–6–Ã¢&WçVW'’æ—4öff–6–ÂÓÓÒ'G'VR"À¢Æ–Ö—C¢&WçVW'’æÆ–Ö—Bò'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ær’¢SÀ¢öfg6WC¢&WçVW'’æöfg6WBò'6T–çB‡&WçVW'’æöfg6WB27G&–ær’¢À¢Ó° ¢6öç7B&Vv–öç2Òv—B7F÷&vRævWE&Vv–öç2†f–ÇFW'2“°¢&W2æ§6öâ‡&Vv–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&Vv–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&Vv–öç2"Ò“°¢Ð¢Ò“° ¢òò†æFÖFRÖ&¶WGÆ6R&÷WFW0 ¢òò6FVv÷&–W0¢ævWB‚"ö’ö†æFÖFRö6FVv÷&–W2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B6FVv÷&–W2Òv—B7F÷&vRævWD†æFÖFT6FVv÷&–W2‚“°¢&W2æ§6öâ†6FVv÷&–W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær†æFÖFR6FVv÷&–W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6FVv÷&–W2"Ò“°¢Ð¢Ò“° ¢6öç7B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2Ò7–æ2‡&÷w3¢ç•µÒ’Óâ°¢6öç7B&öGV7G2Ò„'&’æ—4'&’‡&÷w2’ò&÷w2¢µÒ¢æÖ‚‡&÷r’ÓâFõV&Æ–4†æFÖFU&öGV7B‡&÷r’¢æf–ÇFW"‚‡&÷r“¢&÷r—2&V6÷&CÇ7G&–ærÂVæ¶æ÷vãâÓâ&ööÆVâ‡&÷r’“°¢6öç7BWF†÷&—G’Òv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö€¢&öGV7G2æÖ‚‡&öGV7B’Óâ7G&–ær‡&öGV7Bç6VÆÆW$–BÇÂ""’¢“°¢&WGW&â&öGV7G2æf–ÇFW"‚‡&öGV7B’ÓâWF†÷&—G•µ7G&–ær‡&öGV7Bç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÓÒG'VR“°¢Ó° ¢òò&öGV7G0¢ævWB‚"ö’ö†æFÖFR÷&öGV7G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf–ÇFW'2Ò°¢6FVv÷'”–C¢&WçVW'’æ6FVv÷'”–B27G&–ærÀ¢6VÆÆW$–C¢&WçVW'’ç6VÆÆW$–B27G&–ærÀ¢fVGW&VC¢&WçVW'’æfVGW&VBÓÓÒ'G'VR"À¢Æö6F–öã¢°¢7FFS¢&WçVW'’ç7FFR27G&–ærÀ¢6÷VçG“¢&WçVW'’æ6÷VçG’27G&–ærÀ¢ÒÀ¢&–6U&ævS¢°¢Ö–ã¢&WçVW'’æÖ–å&–6Rò'6TfÆöB‡&WçVW'’æÖ–å&–6R27G&–ær’¢VæFVf–æVBÀ¢Öƒ¢&WçVW'’æÖ…&–6Rò'6TfÆöB‡&WçVW'’æÖ…&–6R27G&–ær’¢VæFVf–æVBÀ¢ÒÀ¢ÖFW&–Ç3¢&WçVW'’æÖFW&–Ç2ò‡&WçVW'’æÖFW&–Ç227G&–ær’ç7Æ—B‚"Â"’¢VæFVf–æVBÀ¢–å7Fö6³¢&WçVW'’æ–å7Fö6²ÓÓÒ'G'VR"À¢6V&6ƒ¢&WçVW'’ç6V&6‚27G&–ærÀ¢Æ–Ö—C¢&WçVW'’æÆ–Ö—Bò'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ær’¢#À¢öfg6WC¢&WçVW'’æöfg6WBò'6T–çB‡&WçVW'’æöfg6WB27G&–ær’¢À¢Ó° ¢6öç7B&öGV7G2Òv—B7F÷&vRævWD†æFÖFU&öGV7G2†f–ÇFW'2“°¢&W2æ§6öâ†v—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2‡&öGV7G2’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær†æFÖFR&öGV7G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&öGV7G2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†æFÖFR÷&öGV7G2ó¦–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B&öGV7BÒv—B7F÷&vRævWD†æFÖFU&öGV7B†–B“°¢6öç7B·V&Æ–5&öGV7EÒÒv—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2‡&öGV7Bò·&öGV7EÒ¢µÒ“°¢–b‚V&Æ–5&öGV7B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öGV7Bæ÷Bf÷VæB"Ò“°¢Ð ¢òò–æ7&VÖVçBf–Wr6÷Vç@¢v—B7F÷&vRæ–æ7&VÖVçE&öGV7Ef–Ww2†–B“° ¢&W2æ§6öâ‡V&Æ–5&öGV7B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&öGV7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&öGV7B"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’ö†æFÖFR÷&öGV7G2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B&öGV7DFFÒ°¢ââç&Wæ&öG’À¢6VÆÆW$–C¢W6W$–BÀ¢Ó° ¢6öç7B&öGV7BÒv—B7F÷&vRæ7&VFT†æFÖFU&öGV7B‡&öGV7DFF“°¢&W2ç7FGW2ƒ#’æ§6öâ‡&öGV7B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær&öGV7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&öGV7B"Ò“°¢Ð¢Ð¢“° ¢çWB€¢"ö’ö†æFÖFR÷&öGV7G2ó¦–B"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#° ¢òò6†V6²–bW6W"÷vç2F†R&öGV7@¢6öç7B&öGV7BÒv—B7F÷&vRævWD†æFÖFU&öGV7B†–B“°¢–b‚&öGV7BÇÂ&öGV7Bç6VÆÆW$–BÓÒW6W$–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7BWFFVE&öGV7BÒv—B7F÷&vRçWFFT†æFÖFU&öGV7B†–BÂ&Wæ&öG’“°¢&W2æ§6öâ‡WFFVE&öGV7B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær&öGV7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR&öGV7B"Ò“°¢Ð¢Ð¢“° ¢òò&öGV7Bff÷&—FW0¢ç÷7B€¢"ö’ö†æFÖFR÷&öGV7G2ó¦–Böff÷&—FR"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–C¢&öGV7D–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ7G&–ær‚‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7B&öGV7BÒv—B7F÷&vRævWD†æFÖFU&öGV7B‡&öGV7D–B“°¢6öç7B·V&Æ–5&öGV7EÒÒv—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2€¢&öGV7Bò·&öGV7EÒ¢µÐ¢“°¢–b‚V&Æ–5&öGV7B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öGV7Bæ÷Bf÷VæB"Ò“° ¢6öç7B&W7VÇBÒv—B7F÷&vRçFövvÆU&öGV7Dff÷&—FR‡W6W$–BÂ&öGV7D–B“°¢&W2æ§6öâ‡&W7VÇB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"FövvÆ–ærff÷&—FS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFövvÆRff÷&—FR"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö†æFÖFRöff÷&—FW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ7G&–ær‚‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢6öç7Bff÷&—FW2Òv—B7F÷&vRævWEW6W$ff÷&—FU&öGV7G2‡W6W$–B“°¢&W2æ§6öâ†v—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2†ff÷&—FW2’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærff÷&—FW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚ff÷&—FW2"Ò“°¢Ð¢Ò“° ¢òò&öGV7B÷&FW'0¢ç÷7B€¢"ö’ö†æFÖFRö÷&FW'2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B÷&FW$FFÒ°¢ââç&Wæ&öG’À¢'W–W$–C¢W6W$–BÀ¢Ó° ¢6öç7B÷&FW"Òv—B7F÷&vRæ7&VFU&öGV7D÷&FW"†÷&FW$FF“°¢&W2ç7FGW2ƒ#’æ§6öâ†÷&FW"“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær÷&FW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR÷&FW""Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö†æFÖFRö÷&FW'2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7BG—RÒ‡&WçVW'’çG—R2&'W–W""Â'6VÆÆW""’ÇÂ&'W–W"#° ¢6öç7B÷&FW'2Òv—B7F÷&vRævWEW6W$÷&FW'2‡W6W$–BÂG—R“°¢&W2æ§6öâ†÷&FW'2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær÷&FW'3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚÷&FW'2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†æFÖFRö÷&FW'2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#° ¢6öç7B÷&FW"Òv—B7F÷&vRævWE&öGV7D÷&FW"†–B“°¢–b‚÷&FW"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$÷&FW"æ÷Bf÷VæB"Ò“°¢Ð ¢òò6†V6²–bW6W"—2'W–W"÷"6VÆÆW ¢–b†÷&FW"æ'W–W$–BÓÒW6W$–Bbb÷&FW"ç6VÆÆW$–BÓÒW6W$–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢&W2æ§6öâ†÷&FW"“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær÷&FW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚÷&FW""Ò“°¢Ð¢Ò“° ¢çWB€¢"ö’ö†æFÖFRö÷&FW'2ó¦–B"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#° ¢6öç7B÷&FW"Òv—B7F÷&vRævWE&öGV7D÷&FW"†–B“°¢–b‚÷&FW"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$÷&FW"æ÷Bf÷VæB"Ò“°¢Ð ¢òò6†V6²–bW6W"—2'W–W"÷"6VÆÆW ¢–b†÷&FW"æ'W–W$–BÓÒW6W$–Bbb÷&FW"ç6VÆÆW$–BÓÒW6W$–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7BWFFVD÷&FW"Òv—B7F÷&vRçWFFU&öGV7D÷&FW"†–BÂ&Wæ&öG’“°¢&W2æ§6öâ‡WFFVD÷&FW"“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær÷&FW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR÷&FW""Ò“°¢Ð¢Ð¢“° ¢òò&öGV7B&Wf–Ww0¢ç÷7B€¢"ö’ö†æFÖFR÷&Wf–Ww2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B&Wf–WtFFÒ°¢ââç&Wæ&öG’À¢'W–W$–C¢W6W$–BÀ¢Ó° ¢6öç7B&Wf–WrÒv—B7F÷&vRæ7&VFU&öGV7E&Wf–Wr‡&Wf–WtFF“°¢&W2ç7FGW2ƒ#’æ§6öâ‡&Wf–Wr“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær&Wf–Ws¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&Wf–Wr"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö†æFÖFR÷&öGV7G2ó¦–B÷&Wf–Ww2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–C¢&öGV7D–BÒÒ&Wç&×3°¢6öç7B&öGV7BÒv—B7F÷&vRævWD†æFÖFU&öGV7B‡&öGV7D–B“°¢6öç7B·V&Æ–5&öGV7EÒÒv—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2‡&öGV7Bò·&öGV7EÒ¢µÒ“°¢–b‚V&Æ–5&öGV7B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öGV7Bæ÷Bf÷VæB"Ò“°¢6öç7B&Wf–Ww2Òv—B7F÷&vRævWE&öGV7E&Wf–Ww2‡&öGV7D–B“°¢&W2æ§6öâ‡&Wf–Ww2æÖ‡FõV&Æ–4†æFÖFU&öGV7E&Wf–Wr’æf–ÇFW"„&ööÆVâ’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&Wf–Ww3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&Wf–Ww2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†æFÖFR÷&öGV7G2ó¦–B÷&F–ær"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–C¢&öGV7D–BÒÒ&Wç&×3°¢6öç7B&öGV7BÒv—B7F÷&vRævWD†æFÖFU&öGV7B‡&öGV7D–B“°¢6öç7B·V&Æ–5&öGV7EÒÒv—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2‡&öGV7Bò·&öGV7EÒ¢µÒ“°¢–b‚V&Æ–5&öGV7B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&öGV7Bæ÷Bf÷VæB"Ò“°¢6öç7B&F–ærÒv—B7F÷&vRævWE&öGV7E&F–æu7VÖÖ'’‡&öGV7D–B“°¢&W2æ§6öâ‡&F–ær“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&F–ær"Ò“°¢Ð¢Ò“° ¢òò6VÆÆW"&öf–ÆW0¢ævWB‚"ö’ö†æFÖFR÷6VÆÆW'2ó§W6W$–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²W6W$–BÒÒ&Wç&×3°¢–b‚†v—B†4W‡÷7W&TWF†÷&—G’…7G&–ær‡W6W$–BÇÂ""’’’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6VÆÆW"&öf–ÆRæ÷Bf÷VæB"Ò“°¢Ð¢6öç7B&öf–ÆRÒv—B7F÷&vRævWE6VÆÆW%&öf–ÆR‡W6W$–B“°¢6öç7BV&Æ–5&öf–ÆRÒFõV&Æ–4†æFÖFU6VÆÆW%&öf–ÆR‡&öf–ÆR“°¢–b‚V&Æ–5&öf–ÆR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6VÆÆW"&öf–ÆRæ÷Bf÷VæB"Ò“°¢Ð ¢&W2æ§6öâ‡V&Æ–5&öf–ÆR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6VÆÆW"&öf–ÆS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6VÆÆW"&öf–ÆR"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’ö†æFÖFR÷6VÆÆW"×&öf–ÆR"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B&öf–ÆTFFÒ°¢ââç&Wæ&öG’À¢W6W$–BÀ¢Ó° ¢6öç7B&öf–ÆRÒv—B7F÷&vRæ7&VFU6VÆÆW%&öf–ÆR‡&öf–ÆTFF“°¢&W2ç7FGW2ƒ#’æ§6öâ‡&öf–ÆR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær6VÆÆW"&öf–ÆS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6VÆÆW"&öf–ÆR"Ò“°¢Ð¢Ð¢“° ¢çWB€¢"ö’ö†æFÖFR÷6VÆÆW"×&öf–ÆR"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B&öf–ÆRÒv—B7F÷&vRçWFFU6VÆÆW%&öf–ÆR‡W6W$–BÂ&Wæ&öG’“°¢&W2æ§6öâ‡&öf–ÆR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær6VÆÆW"&öf–ÆS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR6VÆÆW"&öf–ÆR"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’ö†æFÖFR÷6VÆÆW"×&öf–ÆR"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V#°¢6öç7B&öf–ÆRÒv—B7F÷&vRævWE6VÆÆW%&öf–ÆR‡W6W$–B“°¢&W2æ§6öâ‡&öf–ÆR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6VÆÆW"&öf–ÆS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6VÆÆW"&öf–ÆR"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†æFÖFR÷6VÆÆW'2ó§W6W$–B÷&öGV7G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²W6W$–BÒÒ&Wç&×3°¢–b‚†v—B†4W‡÷7W&TWF†÷&—G’…7G&–ær‡W6W$–BÇÂ""’’’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6VÆÆW"&öf–ÆRæ÷Bf÷VæB"Ò“°¢Ð¢6öç7B&öGV7G2Òv—B7F÷&vRævWD†æFÖFU&öGV7G2‡²6VÆÆW$–C¢W6W$–BÂÆ–Ö—C¢Ò“°¢&W2æ§6öâ†v—B'V–ÆDWF†÷&—¦VEV&Æ–4†æFÖFU&öGV7G2‡&öGV7G2’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6VÆÆW"&öGV7G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6VÆÆW"&öGV7G2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†æFÖFR÷6VÆÆW'2ó§W6W$–B÷&F–æw2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²W6W$–BÒÒ&Wç&×3°¢–b‚†v—B†4W‡÷7W&TWF†÷&—G’…7G&–ær‡W6W$–BÇÂ""’’’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6VÆÆW"&öf–ÆRæ÷Bf÷VæB"Ò“°¢Ð¢6öç7B&F–æw2Òv—B7F÷&vRævWE6VÆÆW%&F–æw2‡W6W$–B“°¢&W2æ§6öâ‡&F–æw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6VÆÆW"&F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6VÆÆW"&F–æw2"Ò“°¢Ð¢Ò“° ¢òòÓÓÓÓÒ4ôÔÕTä•E’ÔôDU$D”ôâ’$õUDU2ÓÓÓÓÐ ¢òò&W÷'B6öçFVçBf÷"ÖöFW&F–öà¢ç÷7B€¢"ö’öÖöFW&F–öâ÷&W÷'G2"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&W÷'DFFÒ°¢ââç&Wæ&öG’À¢&W÷'FW$–C¢W6W$–BÀ¢&W÷'FW$6÷VçG“¢W6W"æ6÷VçG’À¢&W÷'FW%7FFS¢W6W"ç7FFRÀ¢Ó° ¢6öç7B'6VE&W÷'BÒ–ç6W'DÖöFW&F–öå&W÷'E66†VÖç6fU'6R‡&W÷'DFF“°¢–b‚'6VE&W÷'Bç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖöFW&F–öâ&W÷'B–ÆöB"À¢—77VW3¢'6VE&W÷'BæW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVE&W÷'BÒ'6VE&W÷'BæFF°¢6öç7B&W÷'BÒv—B7F÷&vRæ7&VFTÖöFW&F–öå&W÷'B‡fÆ–FFVE&W÷'B“° ¢v—B&VfÆV7D6öÖ×Væ—G”7F–öâ‡7F÷&vRÂ°¢WfVçEG—S¢WfVçEG—W2äÔôDU$D”ôåõ$Uõ%Eôd”ÄTBÀ¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢7V&¦V7EW6W$–C¢fÆ–FFVE&W÷'Bæ6öçFVçD÷væW$–@¢ò7G&–ær‡fÆ–FFVE&W÷'Bæ6öçFVçD÷væW$–B¢¢çVÆÂÀ¢6öçFVçEG—S¢fÆ–FFVE&W÷'Bæ6öçFVçEG—Rò7G&–ær‡fÆ–FFVE&W÷'Bæ6öçFVçEG—R’¢çVÆÂÀ¢&W÷'D–C¢&W÷'Còæ–Bò7G&–ær‡&W÷'Bæ–B’¢çVÆÂÀ¢W‡G&¢°¢&V6öã¢fÆ–FFVE&W÷'Bç&V6öâÇÂçVÆÂÀ¢òòVæF–ær&W÷'G2Fòæ÷BÖ÷fR5e3²66÷&–ær5ÂöæÇ’6÷VçG0¢òòW†VÆBGfW'6Rf–æÅö7F–öâ÷WF6öÖW2à¢7FGW3¢&W÷'Còç7FGW2ÇÂ'VæF–ær"À¢ÒÀ¢Ò“° ¢&W2æ§6öâ‡&W÷'B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖöFW&F–öâ&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&W÷'B"Ò“°¢Ð¢Ð¢“° ¢òòvWBÖöFW&F–öâ&W÷'G2f÷"W6W"w2Æö6F–öà¢ævWB‚"ö’öÖöFW&F–öâ÷&W÷'G2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7Bf–ÇFW'2Ò°¢7FGW3¢‡&WçVW'’ç7FGW227G&–ær’ÇÂVæFVf–æVBÀ¢6öçFVçEG—S¢‡&WçVW'’æ6öçFVçEG—R27G&–ær’ÇÂVæFVf–æVBÀ¢6÷VçG“¢‡&WçVW'’æ6÷VçG’27G&–ær’ÇÂW6W"æ6÷VçG’ÇÂVæFVf–æVBÀ¢7FFS¢‡&WçVW'’ç7FFR27G&–ær’ÇÂW6W"ç7FFRÇÂVæFVf–æVBÀ¢Æ–Ö—C¢&WçVW'’æÆ–Ö—Bò'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ærÂ’¢#À¢öfg6WC¢&WçVW'’æöfg6WBò'6T–çB‡&WçVW'’æöfg6WB27G&–ærÂ’¢À¢Ó° ¢6öç7B&W÷'G2Òv—B7F÷&vRævWDÖöFW&F–öå&W÷'G2†f–ÇFW'2“°¢&W2æ§6öâ‡&W÷'G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâ&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&W÷'G2"Ò“°¢Ð¢Ò“° ¢òòvWB7V6–f–2ÖöFW&F–öâ&W÷'@¢ævWB‚"ö’öÖöFW&F–öâ÷&W÷'G2ó§&W÷'D–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²&W÷'D–BÒÒ&Wç&×3°¢6öç7B&W÷'BÒv—B7F÷&vRævWDÖöFW&F–öå&W÷'B‡&W÷'D–B“° ¢–b‚&W÷'B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&W÷'Bæ÷Bf÷VæB"Ò“°¢Ð ¢&W2æ§6öâ‡&W÷'B“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâ&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&W÷'B"Ò“°¢Ð¢Ò“° ¢òòf÷FRöâÖöFW&F–öâ&W÷'@¢ç÷7B€¢"ö’öÖöFW&F–öâ÷&W÷'G2ó§&W÷'D–B÷f÷FR"À¢—4WF†VçF–6FVBÀ¢&WV—&TFG&W75fW&–f–6F–öâÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²&W÷'D–BÒÒ&Wç&×3°¢6öç7B²f÷FRÒÒ&Wæ&öG“°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢òò6†V6²–bW6W"6âf÷FRöâF†—2&W÷'@¢6öç7B6åf÷FRÒv—B7F÷&vRæ6åW6W%f÷FTöå&W÷'B‡W6W$–BÂ&W÷'D–B“°¢–b‚6åf÷FR’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%–÷R&Ræ÷BVÆ–v–&ÆRFòf÷FRöâF†—2&W÷'B"Ò“°¢Ð ¢6öç7Bf÷FTFFÒ°¢&W÷'D–BÀ¢f÷FW$–C¢W6W$–BÀ¢f÷FRÀ¢f÷FW$6÷VçG“¢W6W"æ6÷VçG’À¢f÷FW%7FFS¢W6W"ç7FFRÀ¢Ó° ¢6öç7B'6VEf÷FRÒ–ç6W'DÖöFW&F–öåf÷FU66†VÖç6fU'6R‡f÷FTFF“°¢–b‚'6VEf÷FRç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖöFW&F–öâf÷FR–ÆöB"À¢—77VW3¢'6VEf÷FRæW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVEf÷FRÒ'6VEf÷FRæFF°¢6öç7BÖöFW&F–öåf÷FRÒv—B7F÷&vRæ7&VFTÖöFW&F–öåf÷FR‡fÆ–FFVEf÷FR“° ¢&W2æ§6öâ†ÖöFW&F–öåf÷FR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖöFW&F–öâf÷FS¢"ÂW'&÷"“° ¢–b†W'&÷"æÖW76vRÓÓÒ%W6W"†2Ç&VG’f÷FVBöâF†—2&W÷'B"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢W'&÷"æÖW76vRÒ“°¢Ð ¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRf÷FR"Ò“°¢Ð¢Ð¢“° ¢òòvWBf÷FW2f÷"7V6–f–2&W÷'@¢ævWB€¢"ö’öÖöFW&F–öâ÷&W÷'G2ó§&W÷'D–B÷f÷FW2"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²&W÷'D–BÒÒ&Wç&×3°¢6öç7Bf÷FW2Òv—B7F÷&vRævWE&W÷'Ef÷FW2‡&W÷'D–B“°¢&W2æ§6öâ‡f÷FW2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&W÷'Bf÷FW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚f÷FW2"Ò“°¢Ð¢Ð¢“° ¢òò6†V6²–bW6W"6âf÷FRöâ&W÷'@¢ævWB€¢"ö’öÖöFW&F–öâ÷&W÷'G2ó§&W÷'D–Bö6â×f÷FR"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²&W÷'D–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#° ¢6öç7B6åf÷FRÒv—B7F÷&vRæ6åW6W%f÷FTöå&W÷'B‡W6W$–BÂ&W÷'D–B“°¢&W2æ§6öâ‡²6åf÷FRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6†V6¶–ærf÷FRVÆ–v–&–Æ—G“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6†V6²f÷FRVÆ–v–&–Æ—G’"Ò“°¢Ð¢Ð¢“° ¢òò7&VFRÖöFW&F–öâVÀ¢ç÷7B‚"ö’öÖöFW&F–öâöVÇ2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#° ¢6öç7BVÄFFÒ°¢ââç&Wæ&öG’À¢VÆÆçD–C¢W6W$–BÀ¢Ó° ¢6öç7B'6VDVÂÒ–ç6W'DÖöFW&F–öäVÅ66†VÖç6fU'6R†VÄFF“°¢–b‚'6VDVÂç7V66W72’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$–çfÆ–BÖöFW&F–öâVÂ–ÆöB"À¢—77VW3¢'6VDVÂæW'&÷"æ—77VW2À¢Ò“°¢Ð ¢6öç7BfÆ–FFVDVÂÒ'6VDVÂæFF°¢6öç7BVÂÒv—B7F÷&vRæ7&VFTÖöFW&F–öäVÂ‡fÆ–FFVDVÂ“° ¢&W2æ§6öâ†VÂ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖöFW&F–öâVÃ¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRVÂ"Ò“°¢Ð¢Ò“° ¢òòvWBW6W"w2ÖöFW&F–öâVÇ0¢ævWB‚"ö’öÖöFW&F–öâöVÇ2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7BVÇ2Òv—B7F÷&vRævWDVÇ4'•W6W"‡W6W$–B“°¢&W2æ§6öâ†VÇ2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâVÇ3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚VÇ2"Ò“°¢Ð¢Ò“° ¢òòvWB7V6–f–2ÖöFW&F–öâVÀ¢ævWB‚"ö’öÖöFW&F–öâöVÇ2ó¦VÄ–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²VÄ–BÒÒ&Wç&×3°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#° ¢6öç7BVÂÒv—B7F÷&vRævWDÖöFW&F–öäVÂ†VÄ–B“° ¢–b‚VÂ’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$VÂæ÷Bf÷VæB"Ò“°¢Ð ¢òòöæÇ’ÆÆ÷r66W72Fò÷vâVÇ2÷"FÖ–âW6W'0¢–b†VÂæVÆÆçD–BÓÒW6W$–Bbb&WçW6W"æ—4FÖ–â’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$66W72FVæ–VB"Ò“°¢Ð ¢&W2æ§6öâ†VÂ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâVÃ¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚VÂ"Ò“°¢Ð¢Ò“° ¢òòvWBW6W"w2ÖöFW&F–öâ&WWFF–öà¢ævWB‚"ö’öÖöFW&F–öâ÷&WWFF–öâ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ–BÇÂ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B&WWFF–öâÒv—B7F÷&vRævWEW6W$ÖöFW&F–öå&WWFF–öâ‡W6W$–B“° ¢–b‚&WWFF–öâ’°¢6öç7BæWu&WWFF–öâÒv—B7F÷&vRæ7&VFUW6W$ÖöFW&F–öå&WWFF–öâ‡°¢W6W$–BÀ¢6åf÷FS¢G'VRÀ¢f÷F–æu÷vW#¢#ã"2ç’À¢&–Ö'”6÷VçG“¢çVÆÂ2ç’À¢&–Ö'•7FFS¢çVÆÂ2ç’À¢Ò“°¢&WGW&â&W2æ§6öâ†æWu&WWFF–öâ“°¢Ð ¢&W2æ§6öâ‡&WWFF–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâ&WWFF–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&WWFF–öâ"Ò“°¢Ð¢Ò“° ¢òòvWBÖöFW&F–öâ7F–öç2f÷"6öçFVç@¢ævWB€¢"ö’öÖöFW&F–öâö7F–öç2ó¦6öçFVçEG—Ró¦6öçFVçD–B"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6öçFVçEG—RÂ6öçFVçD–BÒÒ&Wç&×3°¢6öç7B7F–öç2Òv—B7F÷&vRævWDÖöFW&F–öä7F–öç2†6öçFVçEG—RÂ6öçFVçD–B“°¢&W2æ§6öâ†7F–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâ7F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚7F–öç2"Ò“°¢Ð¢Ð¢“° ¢òòvWBÖöFW&F–öâ6WGF–æw2f÷"Æö6F–öà¢ævWB‚"ö’öÖöFW&F–öâ÷6WGF–æw2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B6WGF–æw2Òv—B7F÷&vRævWDÖöFW&F–öå6WGF–æw2€¢W6W"æ6÷VçG’ÇÂVæFVf–æVBÀ¢W6W"ç7FFRÇÂVæFVf–æV@¢“°¢&W2æ§6öâ‡6WGF–æw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖöFW&F–öâ6WGF–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6WGF–æw2"Ò“°¢Ð¢Ò“° ¢&Vv—7FW$–çf—FF–öå&÷WFW2†Â²vWEV&Æ–4&6UW&Äg&öÕ&WVW7BÒ“° ¢&Vv—7FW%&öfW76–öæÄæWGv÷&µ&÷WFW2†“° ¢&Vv—7FW%&öfW76–öæÅ'FæW'6†—&÷WFW2†“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒdd”Ä”DR5•5DTÒ$õUDU2ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢òòÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÐ¢òò&6²Ö6ö×BVæGö–çG2W6VB'’66÷WBFööÇ2òöÆFW"6Æ–VçG0¢òòÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÐ ¢òòVç&öÆÂF†R7W'&VçBW6W"–çFòF†Rff–Æ–FR&öw&Ò†–FV×÷FVçB¢ç÷7B‚"ö’öff–Æ–FRöVç&öÆÂ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢ÆWB&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‚&öw&Ò’°¢&öw&ÒÒv—B7F÷&vRæ7&VFTff–Æ–FU&öw&Ò‡²W6W$–BÒ2ç’“°¢Ð ¢&WGW&â&W2æ§6öâ‡°¢ff–Æ–FT–C¢‡&öw&Ò2ç’’æ–BÇÂ‡&öw&Ò2ç’’æff–Æ–FT–BÇÂW6W$–BÀ¢7FGW3¢‡&öw&Ò2ç’’ç7FGW2óò&7F—fR"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"Vç&öÆÆ–ærff–Æ–FS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòVç&öÆÂff–Æ–FR"Ò“°¢Ð¢Ò“° ¢òòvVæW&FR6æöæ–6Â&VfW'&ÂU$Âf÷"F†R7W'&VçBW6W"w2ff–Æ–FR6öFP¢ç÷7B‚"ö’öff–Æ–FRöÆ–æ²"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7BFW7F–æF–öâÐ¢G—Vöb&Wæ&öG“òæFW7F–æF–öâÓÓÒ'7G&–ær"ò&Wæ&öG’æFW7F–æF–öâçG&–Ò‚’¢"#°¢6öç7BVçF—G”–BÒG—Vöb&Wæ&öG“òæVçF—G”–BÓÓÒ'7G&–ær"ò&Wæ&öG’æVçF—G”–BçG&–Ò‚’¢"#° ¢–b‚FW7F–æF–öâÇÂFW7F–æF–öâç7F'G5v—F‚‚"ò"’’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢&FW7F–æF–öâ×W7B&R&VÆF—fRF‚7F'F–ærv—F‚ròr"Ò“°¢Ð ¢ÆWB&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‚&öw&Ò’°¢&öw&ÒÒv—B7F÷&vRæ7&VFTff–Æ–FU&öw&Ò‡²W6W$–BÒ2ç’“°¢Ð ¢ÆWB&VfW'&Ä6öFRÒ7G&–ær‚‡&öw&Ò2ç’’ç&VfW'&Ä6öFRÇÂ""’çG&–Ò‚“°¢–b‚&VfW'&Ä6öFR’°¢òò6W'fW"×6–FR&W—"f÷"ÆVv7’&÷w3¢Ö—76–ær&VfW'&Ä6öFR—2æ÷B6Æ–VçBfVÇBà¢&VfW'&Ä6öFRÒv—B7F÷&vRævVæW&FTff–Æ–FT6öFR‡W6W$–B“°¢G'’°¢v—B7F÷&vRçWFFTff–Æ–FU&öw&Ò‡&öw&Òæ–BÂ²&VfW'&Ä6öFRÒ2ç’“°¢Ò6F6‚°¢òò&W7BÖVff÷'C¢–bF†RWFFRf–Ç2Â7F–ÆÂGFV×BFò&ö6VVBv—F‚F†RvVæW&FVB6öFRà¢Ð¢Ð ¢6öç7B&6T÷&–v–âÐ¢&ö6W72æVçbåT$Ä”5õtT%õU$ÂÇÂ&ö6W72æVçbäõU$ÂÇÂ&‡GG3¢ò÷wwrçF†WG&FW66÷WBæ6öÒ#°¢6öç7BW&ÂÒæWrU$Â†FW7F–æF–öâÂ&6T÷&–v–â“°¢–b‚W&Âç6V&6…&×2æ†2‚'&Vb"’’°¢W&Âç6V&6…&×2ç6WB‚'&Vb"Â&VfW'&Ä6öFR“°¢Ð¢–b†VçF—G”–BbbW&Âç6V&6…&×2æ†2‚&V–B"’’°¢W&Âç6V&6…&×2ç6WB‚&V–B"ÂVçF—G”–B“°¢Ð ¢&WGW&â&W2æ§6öâ‡²W&Ã¢W&ÂçFõ7G&–ær‚’Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"vVæW&F–ærff–Æ–FRÆ–æ³¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòvVæW&FRff–Æ–FRÆ–æ²"Ò“°¢Ð¢Ò“° ¢òòÆörâGG&–'WFVB7F–öâf÷"ff–Æ–FRG&6¶–ær†&W7BÖVff÷'BÂæöâ×F‡&÷v–ær¢ç÷7B‚"ö’öff–Æ–FR÷&VfW'&Â"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bff–Æ–FT–BÐ¢G—Vöb&Wæ&öG“òæff–Æ–FT–BÓÓÒ'7G&–ær"ò&Wæ&öG’æff–Æ–FT–BçG&–Ò‚’¢"#°¢6öç7B7F–öâÒG—Vöb&Wæ&öG“òæ7F–öâÓÓÒ'7G&–ær"ò&Wæ&öG’æ7F–öâçG&–Ò‚’¢"#°¢6öç7BVçF—G”–BÒG—Vöb&Wæ&öG“òæVçF—G”–BÓÓÒ'7G&–ær"ò&Wæ&öG’æVçF—G”–BçG&–Ò‚’¢"#° ¢–b‚ff–Æ–FT–BÇÂ7F–öâ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ö³¢fÇ6RÂÖW76vS¢&ff–Æ–FT–BæB7F–öâ&R&WV—&VB"Ò“°¢Ð ¢òòöæÇ’&V6÷&B–bF†Rff–Æ–FR&öw&ÒW†—7G3²Fòæ÷BW'&÷"–bÖ—76–ærà¢6öç7B&öw&ÒÒv—B7F÷&vP¢ævWDff–Æ–FU&öw&Ô'”66÷VçD–B†ff–Æ–FT–B¢æ6F6‚‚‚’ÓâVæFVf–æVB“°¢–b‡&öw&Ò’°¢v—B7F÷&vP¢çG&6µ&VfW'&Ä6Æ–6²‡°¢ff–Æ–FT–BÀ¢&VfW'&VEW6W$–C¢çVÆÂÀ¢6†&TÆ–æ´–C¢çVÆÂÀ¢7W7FöÔÆ–æ³¢VçF—G”–BòG¶7F–öçÓ¢G¶VçF—G”–GÖ¢7F–öâÀ¢6öçfW'6–öå6÷W&6S¢&–çFW&æÅö7F–öâ"À¢6öçfW'6–öåG—S¢7F–öâÀ¢6÷Wöä6öFS¢çVÆÂÀ¢Ò2ç’¢æ6F6‚‚†R’Óâ6öç6öÆRæW'&÷"‚$f–ÆVBFò&V6÷&Bff–Æ–FR&VfW'&Â7F–öâ"ÂR’“°¢Ð ¢&WGW&â&W2æ§6öâ‡²ö³¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&V6÷&F–ærff–Æ–FR&VfW'&Ã¢"ÂW'&÷"“°¢òòæöâ×F‡&÷v–ær6öçG&7C¢Çv—2&WGW&â#Ö—6‚VæÆW72&WVW7B—2ÖÆf÷&ÖVBà¢&WGW&â&W2æ§6öâ‡²ö³¢fÇ6RÒ“°¢Ð¢Ò“° ¢òò7&VFR÷"vWBff–Æ–FR&öw&Òf÷"W6W"†W‡Æ–6—B¦ö–âVæGö–çB¢ç÷7B‚"ö’öff–Æ–FRö¦ö–â"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢òò6†V6²–bW6W"Ç&VG’†2âff–Æ–FR&öw&Ð¢6öç7BW†—7F–æu&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b†W†—7F–æu&öw&Ò’°¢&WGW&â&W2æ§6öâ†W†—7F–æu&öw&Ò“°¢Ð ¢òòvVæW&FRVæ—VRff–Æ–FR6öFP¢6öç7B&VfW'&Ä6öFRÒv—B7F÷&vRævVæW&FTff–Æ–FT6öFR‡W6W$–B“° ¢òò7&VFRæWrff–Æ–FR&öw&Ð¢6öç7B&öw&ÒÒv—B7F÷&vRæ7&VFTff–Æ–FU&öw&Ò‡°¢W6W$–BÀ¢&VfW'&Ä6öFRÀ¢7FGW3¢&7F—fR"À¢Ò2ç’“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡&öw&Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"¦ö–æ–ærff–Æ–FR&öw&Ó¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò¦ö–âff–Æ–FR&öw&Ò"Ò“°¢Ð¢Ò“° ¢òòG&6²&VfW'&Â6Æ–6²‡V&Æ–2VæGö–çB¢ç÷7B‚"ö’öff–Æ–FR÷G&6²Ö6Æ–6²"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bff–Æ–FT6öFRÐ¢G—Vöb&Wæ&öG“òæff–Æ–FT6öFRÓÓÒ'7G&–ær ¢ò&Wæ&öG’æff–Æ–FT6öFRçG&–Ò‚¢¢G—Vöb&Wæ&öG“òç&VbÓÓÒ'7G&–ær ¢ò&Wæ&öG’ç&VbçG&–Ò‚¢¢"#° ¢6öç7BFW7F–æF–öâÐ¢G—Vöb&Wæ&öG“òæFW7F–æF–öâÓÓÒ'7G&–ær ¢ò&Wæ&öG’æFW7F–æF–öâçG&–Ò‚¢¢G—Vöb&Wæ&öG“òçW&ÂÓÓÒ'7G&–ær ¢ò&Wæ&öG’çW&ÂçG&–Ò‚¢¢"#° ¢6öç7B6÷W&6RÒG—Vöb&Wæ&öG“òç6÷W&6RÓÓÒ'7G&–ær"ò&Wæ&öG’ç6÷W&6RçG&–Ò‚’¢'6—FR#° ¢–b‚ff–Æ–FT6öFR’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ö³¢fÇ6RÂÖW76vS¢&ff–Æ–FT6öFR—2&WV—&VB"Ò“°¢Ð ¢6öç7B¶66÷VçEÒÒv—BF ¢ç6VÆV7B‚¢æg&öÒ†ff–Æ–FT66÷VçG2¢çv†W&R†W†ff–Æ–FT66÷VçG2ç&VfW'&Ä6öFRÂff–Æ–FT6öFR’¢æÆ–Ö—Bƒ“° ¢–b‚66÷VçB’°¢òòFòæ÷B&WfVÂv†WF†W"6öFRW†—7G3²G&VB2ö²Fò&WfVçB&ö&–ærà¢&WGW&â&W2æ§6öâ‡²ö³¢G'VRÒ“°¢Ð ¢v—B7F÷&vRçG&6µ&VfW'&Ä6Æ–6²‡°¢ff–Æ–FT–C¢66÷VçBæ–BÀ¢&VfW'&VEW6W$–C¢çVÆÂÀ¢6†&TÆ–æ´–C¢çVÆÂÀ¢7W7FöÔÆ–æ³¢FW7F–æF–öâÇÂçVÆÂÀ¢6öçfW'6–öå6÷W&6S¢6÷W&6RÀ¢6öçfW'6–öåG—S¢&6Æ–6²"À¢6÷Wöä6öFS¢çVÆÂÀ¢Ò2ç’“° ¢&WGW&â&W2æ§6öâ‡²ö³¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"G&6¶–ær&VfW'&Â6Æ–6³¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòG&6²&VfW'&Â"Ò“°¢Ð¢Ò“° ¢òò6öçfW'B&VfW'&Âv†VâW6W"6–vç2W ¢ç÷7B‚"ö’öff–Æ–FRö6öçfW'B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢6öç7B²ff–Æ–FT6öFRÒÒ&Wæ&öG“° ¢–b‚ff–Æ–FT6öFR’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$ff–Æ–FR6öFR—2&WV—&VB"Ò“°¢Ð ¢òò6öçfW'BF†R&VfW'&À¢v—B7F÷&vRæ6öçfW'E&VfW'&Â†ff–Æ–FT6öFRÂW6W$–B“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6öçfW'F–ær&VfW'&Ã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6öçfW'B&VfW'&Â"Ò“°¢Ð¢Ò“° ¢òò&ö6W726öÖÖ—76–öâ†–çFW&æÂW6RÒ6ÆÆVBv†Vâ&WfVçVR—2vVæW&FVB¢ç÷7B‚"ö’öff–Æ–FRö6öÖÖ—76–öâ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²ff–Æ–FU&öw&Ô–BÂ&VfW'&Ä–BÂG&ç67F–öä–BÂ&WfVçVTÖ÷VçBÂ6öÖÖ—76–öäÖ÷VçBÒÐ¢&Wæ&öG“° ¢–b‚ff–Æ–FU&öw&Ô–BÇÂ&WfVçVTÖ÷VçBÇÂ6öÖÖ—76–öäÖ÷VçB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$ff–Æ–FR&öw&Ò”BÂ&WfVçVRÖ÷VçBÂæB6öÖÖ—76–öâÖ÷VçB&R&WV—&VB"À¢Ò“°¢Ð ¢6öç7B6öÖÖ—76–öâÒv—B7F÷&vRæ7&VFT6öÖÖ—76–öâ‡°¢ff–Æ–FU&öw&Ô–BÀ¢&VfW'&Ä–BÀ¢G&ç67F–öä–BÀ¢&WfVçVTÖ÷VçC¢&WfVçVTÖ÷VçBçFõ7G&–ær‚’À¢6öÖÖ—76–öäÖ÷VçC¢6öÖÖ—76–öäÖ÷VçBçFõ7G&–ær‚’À¢òòFW67&—F–öã¢FW67&—F–öâÇÂt6öÖÖ—76–öâV&æVBrÀ¢7FGW3¢'VæF–ær"À¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ†6öÖÖ—76–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær6öÖÖ—76–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6öÖÖ—76–öâ"Ò“°¢Ð¢Ò“° ¢òòvWB&VfW'&Ç2f÷"ff–Æ–FP¢ævWB‚"ö’öff–Æ–FR÷&VfW'&Ç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‚&öw&Ò’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$ff–Æ–FR&öw&Òæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&VfW'&Ç2Òv—B7F÷&vRævWE&VfW'&Ç4'”ff–Æ–FR‡&öw&Òæ–B“°¢&W2æ§6öâ‡&VfW'&Ç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&VfW'&Ç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&VfW'&Ç2"Ò“°¢Ð¢Ò“° ¢òòvWB6öÖÖ—76–öç2f÷"ff–Æ–FP¢ævWB‚"ö’öff–Æ–FRö6öÖÖ—76–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‚&öw&Ò’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$ff–Æ–FR&öw&Òæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B6öÖÖ—76–öç2Òv—B7F÷&vRævWD6öÖÖ—76–öç4f÷$ff–Æ–FR‡&öw&Òæ–B“°¢&W2æ§6öâ†6öÖÖ—76–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öÖÖ—76–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6öÖÖ—76–öç2"Ò“°¢Ð¢Ò“° ¢òòvWB–÷WG2f÷"ff–Æ–FP¢ævWB‚"ö’öff–Æ–FR÷–÷WG2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‚&öw&Ò’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$ff–Æ–FR&öw&Òæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B–÷WG2Òv—B7F÷&vRævWE–÷WG4f÷$ff–Æ–FR‡&öw&Òæ–B“°¢&W2æ§6öâ‡–÷WG2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær–÷WG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–÷WG2"Ò“°¢Ð¢Ò“° ¢òòFÖ–ã¢&÷fR6öÖÖ—76–öà¢çWB€¢"ö’öFÖ–âöff–Æ–FRö6öÖÖ—76–öç2ó¦6öÖÖ—76–öä–Bö&÷fR"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢òò6†V6²FÖ–âW&Ö—76–öç0¢6öç7BW6W%&öÆRÒW6W#òç&öÆRÇÂ"#°¢–b‚W6W"ÇÂ²&÷5öFÖ–â"Â'7WW%öFÖ–â%Òæ–æ6ÇVFW2‡W6W%&öÆR’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢6öç7B²6öÖÖ—76–öä–BÒÒ&Wç&×3°¢v—B7F÷&vRæ&÷fT6öÖÖ—76–öâ†6öÖÖ—76–öä–B“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&÷f–ær6öÖÖ—76–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&÷fR6öÖÖ—76–öâ"Ò“°¢Ð¢Ð¢“° ¢òòFÖ–ã¢7&VFR–÷W@¢ç÷7B‚"ö’öFÖ–âöff–Æ–FR÷–÷WG2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢òò6†V6²FÖ–âW&Ö—76–öç0¢6öç7BW6W%&öÆRÒW6W#òç&öÆRÇÂ"#°¢–b‚W6W"ÇÂ²&÷5öFÖ–â"Â'7WW%öFÖ–â%Òæ–æ6ÇVFW2‡W6W%&öÆR’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢6öç7B²ff–Æ–FU&öw&Ô–BÂF÷FÄÖ÷VçBÂ–÷WDÖWF†öBÂæ÷FW2ÒÒ&Wæ&öG“° ¢–b‚ff–Æ–FU&öw&Ô–BÇÂF÷FÄÖ÷VçB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$ff–Æ–FR&öw&Ò”BæBF÷FÂÖ÷VçB&R&WV—&VB"À¢Ò“°¢Ð ¢6öç7B–÷WBÒv—B7F÷&vRæ7&VFU–÷WB‡°¢ff–Æ–FU&öw&Ô–BÀ¢F÷FÄÖ÷VçC¢F÷FÄÖ÷VçBçFõ7G&–ær‚’À¢–÷WDÖWF†öC¢–÷WDÖWF†öBÇÂ&ÖçVÂ"À¢7FGW3¢'VæF–ær"À¢æ÷FW2À¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡–÷WB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær–÷WC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–÷WB"Ò“°¢Ð¢Ò“° ¢òòFÖ–ã¢WFFR–÷WB7FGW0¢çWB€¢"ö’öFÖ–âöff–Æ–FR÷–÷WG2ó§–÷WD–B÷7FGW2"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢6öç7BW6W"Òv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢òò6†V6²FÖ–âW&Ö—76–öç0¢6öç7BW6W%&öÆRÒW6W#òç&öÆRÇÂ"#°¢–b‚W6W"ÇÂ²&÷5öFÖ–â"Â'7WW%öFÖ–â%Òæ–æ6ÇVFW2‡W6W%&öÆR’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$FÖ–â66W72&WV—&VB"Ò“°¢Ð ¢6öç7B²–÷WD–BÒÒ&Wç&×3°¢6öç7B²7FGW2ÒÒ&Wæ&öG“° ¢–b‚7FGW2ÇÂ²'VæF–ær"Â'&ö6W76–ær"Â&6ö×ÆWFVB"Â&f–ÆVB%Òæ–æ6ÇVFW2‡7FGW2’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%fÆ–B7FGW2—2&WV—&VB"Ò“°¢Ð ¢v—B7F÷&vRçWFFU–÷WE7FGW2‡–÷WD–BÂ7FGW2“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær–÷WB7FGW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR–÷WB7FGW2"Ò“°¢Ð¢Ð¢“° ¢&Vv—7FW%GWF÷&–Å&÷WFW2†“° ¢6öç7B‡GG6W'fW"Ò7&VFU6W'fW"†“°¢òò–æ—F–Æ—¦RvV%6ö6¶WBÖævW"f÷"&VÂ×F–ÖR6öÖ×Væ–6F–öà¢òòD•4$ÄTC¢W6–ær6ö6¶WBæ–òÖW76v–ær6W'f–6R–ç7FVB†6öæf–wW&VB–â–æFW‚çG2¢òò6öç7Bw4ÖævW"ÒæWrvV%6ö6¶WDÖævW"†‡GG6W'fW"“° ¢òòGfæ6VBÖ&¶WGÆ6RG&ç67F–öâ&÷WFW0 ¢òò7&VFR–ÖVçB–çFVçBf÷"Ö&¶WGÆ6RW&6†6P¢ç÷7B‚"ö’ö7&VFR×–ÖVçBÖ–çFVçB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7G&—RÒvWE7G&—T6Æ–VçB‚“°¢–b‚7G&—R’°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡°¢ÖW76vS¢%–ÖVçB&ö6W76–æræ÷B6öæf–wW&VBâ7G&—R¶W—2æVVFVBâ"À¢Ò“°¢Ð ¢6öç7B²Æ—7F–æt–BÒÒ&Wæ&öG“°¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–ær†Æ—7F–æt–B“° ¢–b‚Æ—7F–ær’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð ¢6öç7BÆ—7F–æu&–6RÒçVÖ&W"†Æ—7F–ærç&–6Róò“°¢6öç7BÆFf÷&ÔfVRÒE$DU44õUEõE$å45D”ôåôdTUô4TåE3²òòfÆBCG&FU66÷WBG&ç67F–öâfVS²æòÆVB6ÆR÷"–B66W72à¢6öç7BF÷FÄÖ÷VçBÒÖF‚ç&÷VæB†Æ—7F–æu&–6R¢’²ÆFf÷&ÔfVS²òòF÷FÂ–â6VçG0 ¢6öç7B–ÖVçD–çFVçBÒv—B7G&—Rç–ÖVçD–çFVçG2æ7&VFR‡°¢Ö÷VçC¢F÷FÄÖ÷VçBÀ¢7W'&Væ7“¢'W6B"À¢ÖWFFF¢°¢Æ—7F–æt–C¢Æ—7F–æræ–BÀ¢6VÆÆW$–C¢Æ—7F–ærç6VÆÆW$–BÀ¢'W–W$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢ÆFf÷&ÔfVS¢ÆFf÷&ÔfVRçFõ7G&–ær‚’À¢ÆFf÷&ÔfVTÖöFVÃ¢E$DU44õUEõE$å45D”ôåôdTUôÔôDTÂÀ¢ÒÀ¢Ò“° ¢&W2æ§6öâ‡²6Æ–VçE6V7&WC¢–ÖVçD–çFVçBæ6Æ–VçE÷6V7&WBÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær–ÖVçB–çFVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$W'&÷"7&VF–ær–ÖVçB–çFVçC¢"²W'&÷"æÖW76vRÒ“°¢Ð¢Ò“° ¢òò7&VFRÖ&¶WGÆ6RG&ç67F–öà¢ç÷7B‚"ö’öÖ&¶WGÆ6R÷G&ç67F–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BG&ç67F–öäFFÒ°¢ââç&Wæ&öG’À¢'W–W$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢Ó° ¢6öç7BG&ç67F–öâÒv—B7F÷&vRæ7&VFTÖ&¶WGÆ6UG&ç67F–öâ‡G&ç67F–öäFF“° ¢òò6VæBæ÷F–f–6F–öç2Fò&÷F‚'W–W"æB6VÆÆW ¢6öç7B6VÆÆW$æ÷F–f–6F–öâÒ°¢W6W$–C¢G&ç67F–öâç6VÆÆW$–BÀ¢G—S¢'–ÖVçE÷&V6V—fVB"26öç7BÀ¢F—FÆS¢$æWrW&6†6R"À¢ÖW76vS¢6öÖVöæRW&6†6VB–÷W"—FVÒf÷"BG·G&ç67F–öâçF÷FÄÖ÷VçGÖÀ¢7F–öåW&Ã¢÷G&ç67F–öç2òG·G&ç67F–öâæ–GÖÀ¢Ó° ¢6öç7B'W–W$æ÷F–f–6F–öâÒ°¢W6W$–C¢G&ç67F–öâæ'W–W$–BÀ¢G—S¢'–ÖVçE÷&V6V—fVB"26öç7BÀ¢F—FÆS¢%W&6†6R6öæf—&ÖVB"À¢ÖW76vS¢–÷W"W&6†6RöbBG·G&ç67F–öâçF÷FÄÖ÷VçGÒ†2&VVâ6öæf—&ÖVFÀ¢7F–öåW&Ã¢÷G&ç67F–öç2òG·G&ç67F–öâæ–GÖÀ¢Ó° ¢v—B&öÖ—6RæÆÂ…°¢7F÷&vRæ7&VFTæ÷F–f–6F–öâ‡6VÆÆW$æ÷F–f–6F–öâ’À¢7F÷&vRæ7&VFTæ÷F–f–6F–öâ†'W–W$æ÷F–f–6F–öâ’À¢Ò“° ¢òò6VæB&VÂ×F–ÖRæ÷F–f–6F–öç2f–6ö6¶WBæ–òÖW76v–ær6W'f–6R†–bf–Æ&ÆR¢G'’°¢6öç7BÖW76v–ærÒvWDÖW76v–æu6W'f–6R‚“°¢v—B&öÖ—6RæÆÂ…°¢ÖW76v–ærææ÷F–g•W6W"€¢7G&–ær‡G&ç67F–öâç6VÆÆW$–B’À¢&æ÷F–f–6F–öã¦æWuöÖ&¶WGÆ6U÷G&ç67F–öâ"À¢°¢&öÆS¢'6VÆÆW""À¢G&ç67F–öä–C¢G&ç67F–öâæ–BÀ¢F÷FÄÖ÷VçC¢G&ç67F–öâçF÷FÄÖ÷VçBÀ¢Ð¢’À¢ÖW76v–ærææ÷F–g•W6W"€¢7G&–ær‡G&ç67F–öâæ'W–W$–B’À¢&æ÷F–f–6F–öã¦æWuöÖ&¶WGÆ6U÷G&ç67F–öâ"À¢°¢&öÆS¢&'W–W""À¢G&ç67F–öä–C¢G&ç67F–öâæ–BÀ¢F÷FÄÖ÷VçC¢G&ç67F–öâçF÷FÄÖ÷VçBÀ¢Ð¢’À¢Ò“°¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%´ÖW76v–æuÒf–ÆVBFòVÖ—BÖ&¶WGÆ6RG&ç67F–öâæ÷F–f–6F–öç2"ÂW'"“°¢Ð ¢&W2æ§6öâ‡G&ç67F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærG&ç67F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRG&ç67F–öâ"Ò“°¢Ð¢Ò“° ¢òòvWBW6W"G&ç67F–öç0¢ævWB‚"ö’öÖ&¶WGÆ6R÷G&ç67F–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²&öÆRÒ&'W–W""ÒÒ&WçVW'“°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C° ¢6öç7BG&ç67F–öç2Òv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öç4'•W6W"€¢W6W$–BÀ¢&öÆR2&'W–W""Â'6VÆÆW" ¢“°¢&W2æ§6öâ‡G&ç67F–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærG&ç67F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚G&ç67F–öç2"Ò“°¢Ð¢Ò“° ¢òòWFFRG&ç67F–öâ7FGW0¢çWB‚"ö’öÖ&¶WGÆ6R÷G&ç67F–öç2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BG&ç67F–öâÒv—B7F÷&vRçWFFTÖ&¶WGÆ6UG&ç67F–öâ†–BÂ&Wæ&öG’“° ¢òò6VæB&VÂ×F–ÖRWFFRf–6ö6¶WBæ–òÖW76v–ær6W'f–6R†–bf–Æ&ÆR¢G'’°¢6öç7BÖW76v–ærÒvWDÖW76v–æu6W'f–6R‚“°¢–b‡G&ç67F–öãòæ'W–W$–B’°¢v—BÖW76v–ærææ÷F–g•W6W"€¢7G&–ær‡G&ç67F–öâæ'W–W$–B’À¢&Ö&¶WGÆ6S§G&ç67F–öå÷WFFR"À¢°¢G&ç67F–öâÀ¢&öÆS¢&'W–W""À¢Ð¢“°¢Ð¢–b‡G&ç67F–öãòç6VÆÆW$–B’°¢v—BÖW76v–ærææ÷F–g•W6W"€¢7G&–ær‡G&ç67F–öâç6VÆÆW$–B’À¢&Ö&¶WGÆ6S§G&ç67F–öå÷WFFR"À¢°¢G&ç67F–öâÀ¢&öÆS¢'6VÆÆW""À¢Ð¢“°¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%´ÖW76v–æuÒf–ÆVBFòVÖ—BÖ&¶WGÆ6RG&ç67F–öâWFFR"ÂW'"“°¢Ð ¢&W2æ§6öâ‡G&ç67F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærG&ç67F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFRG&ç67F–öâ"Ò“°¢Ð¢Ò“° ¢òò7&VFRW6W"&Wf–Wp¢ç÷7B‚"ö’÷&Wf–Ww2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B&Wf–WtFFÒ°¢ââç&Wæ&öG’À¢&Wf–WvW$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢Ó° ¢6öç7B&Wf–WrÒv—B7F÷&vRæ7&VFUW6W%&Wf–Wr‡&Wf–WtFF“° ¢òò6VæBæ÷F–f–6F–öâFò&Wf–WvVP¢6öç7Bæ÷F–f–6F–öâÒ°¢W6W$–C¢&Wf–Wrç&Wf–WvVT–BÀ¢G—S¢'&Wf–Wu÷&V6V—fVB"26öç7BÀ¢F—FÆS¢$æWr&Wf–Wr&V6V—fVB"À¢ÖW76vS¢–÷R&V6V—fVBG·&Wf–Wrç&F–æwÒ×7F"&Wf–WvÀ¢7F–öåW&Ã¢÷&öf–ÆR÷&Wf–Ww6À¢Ó° ¢v—B7F÷&vRæ7&VFTæ÷F–f–6F–öâ†æ÷F–f–6F–öâ“° ¢òòW6‚&VÂ×F–ÖRæ÷F–f–6F–öâf–6ö6¶WBæ–òÖW76v–ær6W'f–6R†–bf–Æ&ÆR¢G'’°¢6öç7BÖW76v–ærÒvWDÖW76v–æu6W'f–6R‚“°¢v—BÖW76v–ærææ÷F–g•W6W"…7G&–ær‡&Wf–Wrç&Wf–WvVT–B’Â&æ÷F–f–6F–öã¦æWu÷&Wf–Wr"Â°¢&Wf–Wt–C¢&Wf–Wræ–BÀ¢&F–æs¢&Wf–Wrç&F–ærÀ¢Ò“°¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%´ÖW76v–æuÒf–ÆVBFòVÖ—B&Wf–Wræ÷F–f–6F–öâ"ÂW'"“°¢Ð ¢&W2æ§6öâ‡&Wf–Wr“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær&Wf–Ws¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&Wf–Wr"Ò“°¢Ð¢Ò“° ¢òòvWBW6W"&Wf–Ww0¢ævWB‚"ö’÷&Wf–Ww2ó§W6W$–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²W6W$–BÒÒ&Wç&×3°¢6öç7B²&öÆRÒ'&Wf–WvVR"ÒÒ&WçVW'“° ¢6öç7B&Wf–Ww2Òv—B7F÷&vRævWEW6W%&Wf–Ww2‡W6W$–BÂ&öÆR2'&Wf–WvW""Â'&Wf–WvVR"“°¢6öç7B&F–æw2Òv—B7F÷&vRævWEW6W%&F–æw2‡W6W$–B“° ¢&W2æ§6öâ‡²&Wf–Ww2Â&F–æw2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&Wf–Ww3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&Wf–Ww2"Ò“°¢Ð¢Ò“° ¢òòæ÷F–f–6F–öâ&÷WFW2&VÖ÷fVBÒW6–ær6W'fW"÷&÷WFW2öæ÷F–f–6F–öâ×&÷WFW2çG0 ¢òòGfæ6VB6V&6‚æBF—66÷fW'¢ævWB‚"ö’öÖ&¶WGÆ6R÷6V&6‚"ÂÖ&¶WGÆ6U6V&6„Æ–Ö—FW"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B°¢VW'’À¢6FVv÷'’À¢Ö–å&–6RÀ¢Ö…&–6RÀ¢Æö6F–öâÀ¢6öæF—F–öâÀ¢fW&–f–VDöæÇ’À¢g&VU6†—–ærÀ¢'W–W%&÷FV7F–öâÀ¢6÷'D'’Ò&FFUöFW62"À¢ÒÒ&WçVW'“° ¢òòÆör6V&6‚æÇ—F–72–bW6W"—2WF†VçF–6FV@¢–b‡&WçW6W"’°¢v—B7F÷&vRæÆöu6V&6„æÇ—F–72‡°¢W6W$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢6V&6…VW'“¢VW'’27G&–ærÀ¢6V&6…G—S¢&Ö&¶WGÆ6R"À¢f–ÇFW'3¢°¢6FVv÷'’À¢Ö–å&–6S¢Ö–å&–6Rò'6T–çB†Ö–å&–6R27G&–ær’¢VæFVf–æVBÀ¢Ö…&–6S¢Ö…&–6Rò'6T–çB†Ö…&–6R27G&–ær’¢VæFVf–æVBÀ¢Æö6F–öâÀ¢6öæF—F–öâÀ¢fW&–f–VDöæÇ“¢fW&–f–VDöæÇ’ÓÓÒ'G'VR"À¢g&VU6†—–æs¢g&VU6†—–ærÓÓÒ'G'VR"À¢'W–W%&÷FV7F–öã¢'W–W%&÷FV7F–öâÓÓÒ'G'VR"À¢6÷'D'’À¢ÒÀ¢&W7VÇG46÷VçC¢Âòòv–ÆÂ&RWFFVBgFW"6V&6€¢Ò“°¢Ð ¢òòW&f÷&Ò6V&6‚v—F‚f–ÇFW'0¢6öç7B6V&6…&W7VÇG2Òv—B7F÷&vRævWDÖ&¶WGÆ6TÆ—7F–æw2‡°¢6V&6…VW'“¢VW'’27G&–ærÀ¢7FGW3¢&7F—fR"À¢6FVv÷'”–C¢6FVv÷'’27G&–ærÀ¢&–6TÖ–ã¢Ö–å&–6Rò'6T–çB†Ö–å&–6R27G&–ær’¢VæFVf–æVBÀ¢&–6TÖƒ¢Ö…&–6Rò'6T–çB†Ö…&–6R27G&–ær’¢VæFVf–æVBÀ¢6öæF—F–öã¢6öæF—F–öâ27G&–ærÀ¢6÷'D'“¢6÷'D'’2ç’À¢Ò“°¢6öç7B6VÆÆW%W6W$–G2Ò6V&6…&W7VÇG0¢æÖ‚†Æ—7F–æs¢ç’’Óâ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’çG&–Ò‚’¢æf–ÇFW"‚‡fÇVS¢7G&–ær’ÓâfÇVRæÆVæwF‚â“°¢6öç7BWF†÷&—G”'•W6W$–BÒv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö‡6VÆÆW%W6W$–G2“°¢6öç7BvFVE6V&6…&W7VÇG2Ò6V&6…&W7VÇG0¢æf–ÇFW"€¢†Æ—7F–æs¢ç’’ÓâWF†÷&—G”'•W6W$–Eµ7G&–ær†Æ—7F–æsòç6VÆÆW$–BÇÂ""’çG&–Ò‚•ÒÓÓÒG'VP¢¢æÖ‚†Æ—7F–æs¢ç’’ÓâFõV&Æ–4W†6†ævTÆ—7F–ær†Æ—7F–ær’¢æf–ÇFW"„&ööÆVâ“° ¢&W2æ§6öâ†vFVE6V&6…&W7VÇG2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"W&f÷&Ö–ær6V&6ƒ¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòW&f÷&Ò6V&6‚"Ò“°¢Ð¢Ò“° ¢òòÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÐ¢òò†öÖU66÷WB…&VÂW7FFR÷'FÂ¢òòÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÒÐ ¢6öç7B†öÖU66÷WE&W÷'DÆ–Ö—FW"Ò—5&öGV7F–öäVç`¢ò&FTÆ–Ö—B‡°¢v–æF÷t×3¢c¢À¢Öƒ¢bÀ¢ÖW76vS¢%FöòÖç’†öÖU66÷WB&W÷'G2ÂÆV6R6Æ÷rF÷vâ"À¢7F÷&S¢Æ–Ö—FW%7F÷&R‚&†öÖW66÷WE÷&W÷'B"’À¢7FæF&D†VFW'3¢G'VRÀ¢ÆVv7”†VFW'3¢fÇ6RÀ¢Ò¢¢‡&W¢ç’Â÷&W3¢ç’ÂæW‡C¢ç’’ÓâæW‡B‚“° ¢6öç7B†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"Ò—5&öGV7F–öäVç`¢ò&FTÆ–Ö—B‡°¢v–æF÷t×3¢c¢À¢Öƒ¢‚À¢ÖW76vS¢%FöòÖç’†öÖU66÷WB–ç7V7F–öâ7F–öç2ÂÆV6R6Æ÷rF÷vâ"À¢7F÷&S¢Æ–Ö—FW%7F÷&R‚&†öÖW66÷WEö–ç7V7F–öâ"’À¢7FæF&D†VFW'3¢G'VRÀ¢ÆVv7”†VFW'3¢fÇ6RÀ¢Ò¢¢‡&W¢ç’Â÷&W3¢ç’ÂæW‡C¢ç’’ÓâæW‡B‚“° ¢G—R†öÖU66÷WDÆ—7F–æt66W72Ò°¢f–WvW%W6W$–C¢7G&–ærÂçVÆÃ°¢—4FÖ–äÆ–¶Uf–WvW#¢&ööÆVã°¢—4÷væW%f–WvW#¢&ööÆVã°¢—5V&Æ–5f—6–&ÆS¢&ööÆVã°¢6åf–Ws¢&ööÆVã°¢Ó° ¢6öç7B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72Ò7–æ2€¢&W¢ç’À¢Æ—7F–æs¢ç¢“¢&öÖ—6SÄ†öÖU66÷WDÆ—7F–æt66W73âÓâ°¢6öç7B&uf–WvW%W6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÇÂçVÆÃ°¢6öç7Bf–WvW%W6W$–BÒ&uf–WvW%W6W$–Bò7G&–ær‡&uf–WvW%W6W$–B’¢çVÆÃ°¢6öç7Bf–WvW"Òf–WvW%W6W$–Bòv—B7F÷&vRævWEW6W"‡f–WvW%W6W$–B’¢çVÆÃ°¢6öç7Bf–WvW%&öÆRÒ7G&–ær‚‡f–WvW"2ç’“òç&öÆRÇÂ""“°¢6öç7B—4FÖ–äÆ–¶Uf–WvW"Ò²'7WW%öFÖ–â"Â&÷5öFÖ–â"Â&ÖöFW&F÷"%Òæ–æ6ÇVFW2‡f–WvW%&öÆR“°¢6öç7B—4÷væW%f–WvW"Ð¢&ööÆVâ‡f–WvW%W6W$–B’b`¢¶Æ—7F–æsòç6VÆÆW%W6W$–BÂÆ—7F–æsòævVçEW6W$–BÂÆ—7F–æsòæ6öçF7EW6W$–EÒç6öÖR€¢†6æF–FFR’Óâ7G&–ær†6æF–FFRÇÂ""’ÓÓÒf–WvW%W6W$–@¢“°¢6öç7BWF†÷&—G•W6W$–BÒvWD†öÖU66÷WDWF†÷&—G•W6W$–B†Æ—7F–ær“°¢6öç7B6ä'—75V&Æ–4vFRÒ—4FÖ–äÆ–¶Uf–WvW"ÇÂ—4÷væW%f–WvW#°¢6öç7B—5V&Æ–5f—6–&ÆRÐ¢6ä'—75V&Æ–4vFRb`¢7G&–ær†Æ—7F–æsòç7FGW2ÇÂ""’ÓÓÒ&7F—fR"b`¢&ööÆVâ†WF†÷&—G•W6W$–B’b`¢†v—B†4W‡÷7W&TWF†÷&—G’…7G&–ær†WF†÷&—G•W6W$–B’’“° ¢&WGW&â°¢f–WvW%W6W$–BÀ¢—4FÖ–äÆ–¶Uf–WvW"À¢—4÷væW%f–WvW"À¢—5V&Æ–5f—6–&ÆRÀ¢6åf–Ws¢6ä'—75V&Æ–4vFRÇÂ—5V&Æ–5f—6–&ÆRÀ¢Ó°¢Ó° ¢6öç7B&VD†öÖU66÷WDFV6—6–öäWF†÷&—G’Ò€¢&öG“¢ç’À¢W‡V7FVDFV6—6–öå66÷S¢7G&–ærÂçVÆÀ¢“¢²6÷W&6TFV6—6–öä6&D–C¢7G&–æs²FV6—6–öå66÷S¢7G&–ærÒÂçVÆÂÓâ°¢6öç7BWF†÷&—G”vFRÒ7G&–ær†&öG“òæWF†÷&—G”vFRÇÂ""’çG&–Ò‚“°¢6öç7B6÷W&6TFV6—6–öä6&D–BÒ7G&–ær†&öG“òç6÷W&6TFV6—6–öä6&D–BÇÂ""’çG&–Ò‚“°¢6öç7BFV6—6–öå66÷RÒ7G&–ær†&öG“òæFV6—6–öå66÷RÇÂ""’çG&–Ò‚“°¢–b€¢WF†÷&—G”vFRÓÒ&FV6—6–öåö6&B"ÇÀ¢6÷W&6TFV6—6–öä6&D–BÇÀ¢W‡V7FVDFV6—6–öå66÷RÇÀ¢FV6—6–öå66÷RÓÒW‡V7FVDFV6—6–öå66÷P¢’°¢&WGW&âçVÆÃ°¢Ð¢&WGW&â²6÷W&6TFV6—6–öä6&D–BÂFV6—6–öå66÷RÓ°¢Ó° ¢6Æ72†öÖU66÷WDFV6—6–öäWF†÷&—G”W'&÷"W‡FVæG2W'&÷"·Ð ¢6öç7B6ö×ÆWFT†öÖU66÷WDFV6—6–öä6&BÒ7–æ2†&w3¢°¢Gƒ¢ç“°¢6÷W&6TFV6—6–öä6&D–C¢7G&–æs°¢W6W$–C¢7G&–æs°¢FV6—6–öå66÷S¢7G&–æs°¢Ò’Óâ°¢6öç7Bæ÷rÒæWrFFR‚“°¢6öç7B¶6ö×ÆWFVDFV6—6–öåÒÒv—B&w2çG€¢çWFFR†FV6—6–öä6&G2¢ç6WB‡²7FGW3¢&6ö×ÆWFVB"ÂFV6–FVDC¢æ÷rÂWFFVDC¢æ÷rÒ¢çv†W&R€¢æB€¢W†FV6—6–öä6&G2æ–BÂ&w2ç6÷W&6TFV6—6–öä6&D–B’À¢W†FV6—6–öä6&G2çW6W$–BÂ&w2çW6W$–B’À¢W†FV6—6–öä6&G2ç7FGW2Â&7F—fR"’À¢W†FV6—6–öä6&G2æ–çFVçBÂ&†—&R"’À¢W†FV6—6–öä6&G2æFV6—6–öå66÷RÂ&w2æFV6—6–öå66÷R¢¢¢ç&WGW&æ–ær‡²–C¢FV6—6–öä6&G2æ–BÒ“°¢–b‚6ö×ÆWFVDFV6—6–öâ’°¢F‡&÷ræWr†öÖU66÷WDFV6—6–öäWF†÷&—G”W'&÷"‚$–çfÆ–B÷"Ç&VG’W6VBFV6—6–öâ6&B"“°¢Ð¢Ó° ¢ævWB‚"ö’ö†öÖW66÷WB÷6V&6‚"Â†öÖU66÷WE6V&6„Æ–Ö—FW"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B°¢VW'’À¢6÷VçG”f—2À¢7FFT6öFRÀ¢&÷W'G•G—RÀ¢&VG4Ö–âÀ¢&F‡4Ö–âÀ¢7gDÖ–âÀ¢–V$'V–ÇDÖ–âÀ¢Ö„FöÔF—2À¢&–6TG&÷4öæÇ’À¢Ö–å&–6RÀ¢Ö…&–6RÀ¢6÷'D'’Ò&æWvW7B"À¢Æ–Ö—BÒ#À¢öfg6WBÒÀ¢ÒÒ&WçVW'’óò·Ó° ¢6öç7B&÷w2Òv—B7F÷&vRç6V&6„†öÖU66÷WDÆ—7F–æw2‡°¢VW'“¢G—VöbVW'’ÓÓÒ'7G&–ær"òVW'’¢VæFVf–æVBÀ¢6÷VçG”f—3¢G—Vöb6÷VçG”f—2ÓÓÒ'7G&–ær"ò6÷VçG”f—2¢VæFVf–æVBÀ¢7FFT6öFS¢G—Vöb7FFT6öFRÓÓÒ'7G&–ær"ò7FFT6öFR¢VæFVf–æVBÀ¢&÷W'G•G—S¢G—Vöb&÷W'G•G—RÓÓÒ'7G&–ær"ò‡&÷W'G•G—R2ç’’¢VæFVf–æVBÀ¢&VG4Ö–ã¢&VG4Ö–âÒçVÆÂòçVÖ&W"†&VG4Ö–â’¢VæFVf–æVBÀ¢&F‡4Ö–ã¢&F‡4Ö–âÒçVÆÂòçVÖ&W"†&F‡4Ö–â’¢VæFVf–æVBÀ¢7gDÖ–ã¢7gDÖ–âÒçVÆÂòçVÖ&W"‡7gDÖ–â’¢VæFVf–æVBÀ¢–V$'V–ÇDÖ–ã¢–V$'V–ÇDÖ–âÒçVÆÂòçVÖ&W"‡–V$'V–ÇDÖ–â’¢VæFVf–æVBÀ¢Ö„FöÔF—3¢Ö„FöÔF—2ÒçVÆÂòçVÖ&W"†Ö„FöÔF—2’¢VæFVf–æVBÀ¢&–6TG&÷4öæÇ“¢&–6TG&÷4öæÇ’ÓÓÒ'G'VR"À¢&–6TÖ–ã¢Ö–å&–6RÒçVÆÂòçVÖ&W"†Ö–å&–6R’¢VæFVf–æVBÀ¢&–6TÖƒ¢Ö…&–6RÒçVÆÂòçVÖ&W"†Ö…&–6R’¢VæFVf–æVBÀ¢òò6V&6‚—2V&Æ–2Öf6–æs²öæÇ’7F—fR–çfVçF÷'’—2F—66÷fW&&ÆR†W&Rà¢7FGW3¢&7F—fR"2ç’À¢6÷'D'“¢G—Vöb6÷'D'’ÓÓÒ'7G&–ær"ò‡6÷'D'’2ç’’¢&æWvW7B"À¢Æ–Ö—C¢çVÖ&W"†Æ–Ö—B’À¢öfg6WC¢çVÖ&W"†öfg6WB’À¢Ò“°¢6öç7BWF†÷&—G•W6W$–G2Ò&÷w0¢æÖ‚‡&÷s¢ç’’Óà¢7G&–ær‡&÷sòæ6öçF7EW6W$–BÇÂ&÷sòævVçEW6W$–BÇÂ&÷sòç6VÆÆW%W6W$–BÇÂ""’çG&–Ò‚¢¢æf–ÇFW"‚‡fÇVS¢7G&–ær’ÓâfÇVRæÆVæwF‚â“°¢6öç7BWF†÷&—G”'•W6W$–BÒv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö†WF†÷&—G•W6W$–G2“°¢6öç7BvFVE&÷w2Ò&÷w0¢æf–ÇFW"‚‡&÷s¢ç’’Óâ°¢6öç7BWF†÷&—G•W6W$–BÒ7G&–ær€¢&÷sòæ6öçF7EW6W$–BÇÂ&÷sòævVçEW6W$–BÇÂ&÷sòç6VÆÆW%W6W$–BÇÂ" ¢’çG&–Ò‚“°¢&WGW&âWF†÷&—G”'•W6W$–E¶WF†÷&—G•W6W$–EÒÓÓÒG'VS°¢Ò¢æÖ‚‡&÷s¢ç’’ÓâFõV&Æ–4†öÖU66÷WDÆ—7F–ær‡&÷r’¢æf–ÇFW"„&ööÆVâ“° ¢&W2æ§6öâ†vFVE&÷w2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6V&6†–ær†öÖU66÷WBÆ—7F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6V&6‚†öÖU66÷WBÆ—7F–æw2"Ò“°¢Ð¢Ò“° ¢òò&6·v&G2Ö6ö×F–&ÆRÆ–3¢öÆFW"6Æ–VçG2W6VBö’ö†öÖW66÷WB÷6V&6‚ö6÷VçG“öf—3Õ…………‚g7FFT6öFSÕ•¢òò¶VWF†—2&÷WFRF†–âæBFWFW&Ö–æ—7F–2'’FVÆVvF–ærFòF†RVæ–f–VB6V&6‚gVæ7F–öâà¢ævWB‚"ö’ö†öÖW66÷WB÷6V&6‚ö6÷VçG’"Â†öÖU66÷WE6V&6„Æ–Ö—FW"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf—2ÒG—Vöb&WçVW'“òæf—2ÓÓÒ'7G&–ær"ò7G&–ær‡&WçVW'’æf—2’çG&–Ò‚’¢"#°¢6öç7B7FFT6öFRÐ¢G—Vöb&WçVW'“òç7FFT6öFRÓÓÒ'7G&–ær"ò7G&–ær‡&WçVW'’ç7FFT6öFR’çG&–Ò‚’¢"#°¢6öç7BÆ–Ö—E&rÒ&WçVW'“òæÆ–Ö—C°¢6öç7Böfg6WE&rÒ&WçVW'“òæöfg6WC° ¢–b‚õå³Ó•×³WÒBòçFW7B†f—2’ÇÂõå´Õ¦×¥×³'ÒBòçFW7B‡7FFT6öFR’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B6÷VçG’f—2÷"7FFT6öFR"Ò“°¢Ð ¢6öç7B&÷w2Òv—B7F÷&vRç6V&6„†öÖU66÷WDÆ—7F–æw2‡°¢6÷VçG”f—3¢f—2À¢7FFT6öFS¢7FFT6öFRçFõWW$66R‚’À¢7FGW3¢&7F—fR"2ç’À¢6÷'D'“¢&æWvW7B"2ç’À¢Æ–Ö—C¢Æ–Ö—E&rÒçVÆÂòçVÖ&W"†Æ–Ö—E&r’¢#À¢öfg6WC¢öfg6WE&rÒçVÆÂòçVÖ&W"†öfg6WE&r’¢À¢Ò“°¢6öç7BWF†÷&—G•W6W$–G2Ò&÷w0¢æÖ‚‡&÷s¢ç’’Óà¢7G&–ær‡&÷sòæ6öçF7EW6W$–BÇÂ&÷sòævVçEW6W$–BÇÂ&÷sòç6VÆÆW%W6W$–BÇÂ""’çG&–Ò‚¢¢æf–ÇFW"‚‡fÇVS¢7G&–ær’ÓâfÇVRæÆVæwF‚â“°¢6öç7BWF†÷&—G”'•W6W$–BÒv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö†WF†÷&—G•W6W$–G2“°¢6öç7BvFVE&÷w2Ò&÷w0¢æf–ÇFW"‚‡&÷s¢ç’’Óâ°¢6öç7BWF†÷&—G•W6W$–BÒ7G&–ær€¢&÷sòæ6öçF7EW6W$–BÇÂ&÷sòævVçEW6W$–BÇÂ&÷sòç6VÆÆW%W6W$–BÇÂ" ¢’çG&–Ò‚“°¢&WGW&âWF†÷&—G”'•W6W$–E¶WF†÷&—G•W6W$–EÒÓÓÒG'VS°¢Ò¢æÖ‚‡&÷s¢ç’’ÓâFõV&Æ–4†öÖU66÷WDÆ—7F–ær‡&÷r’¢æf–ÇFW"„&ööÆVâ“° ¢&WGW&â&W2æ§6öâ†vFVE&÷w2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6V&6†–ær†öÖU66÷WB6÷VçG’Æ—7F–æw3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6V&6‚†öÖU66÷WB6÷VçG’Æ—7F–æw2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BÆ—7F–æt–BÒæ÷&ÖÆ—¦T†öÖU66÷WDÆ—7F–æt–B‡&Wç&×3òæ–B“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚Æ—7F–ær’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B6öçF7EW6W$–BÒvWD†öÖU66÷WDWF†÷&—G•W6W$–B†Æ—7F–ær“°¢ÆWB6æöæ–6Å&öf–ÆUW&Ã¢7G&–ærÂçVÆÂÒçVÆÃ°¢–b†6öçF7EW6W$–B’°¢6öç7B¶6æöæ–6Å&öf–ÆUÒÒv—BF ¢ç6VÆV7B‡²6ÇVs¢&öf–ÆW2ç6ÇVrÒ¢æg&öÒ‡&öf–ÆW2¢çv†W&R€¢æB†W‡&öf–ÆW2æ÷væW%W6W$–BÂ7G&–ær†6öçF7EW6W$–B’’ÂW‡&öf–ÆW2ç7FGW2Â'V&Æ—6†VB"’¢¢æÆ–Ö—Bƒ“°¢–b†6æöæ–6Å&öf–ÆSòç6ÇVr’°¢6æöæ–6Å&öf–ÆUW&ÂÒ÷RòG¶Væ6öFUU$”6ö×öæVçB…7G&–ær†6æöæ–6Å&öf–ÆRç6ÇVr’—Ö°¢Ð¢Ð ¢6öç7BWfVçG2Òv—B7F÷&vRæÆ—7D†öÖU66÷WDÆ—7F–ætWfVçG2‡°¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢Æ–Ö—C¢À¢öfg6WC¢À¢Ò“° ¢6öç7B&VG4çVÒÒ†Æ—7F–ær2ç’’æ&VG2ÒçVÆÂòçVÖ&W"‚†Æ—7F–ær2ç’’æ&VG2’¢çVÆÃ°¢6öç7B&VG4'V6¶WBÐ¢&VG4çVÒÓÒçVÆÂÇÂçVÖ&W"æ—4f–æ—FR†&VG4çVÒ¢òçVÆÀ¢¢&VG4çVÒãÒP¢òP¢¢ÖF‚æÖ‚ƒÂÖF‚çG'Væ2†&VG4çVÒ’“° ¢6öç7B&÷W'G•G—RÒ7G&–ær‚†Æ—7F–ær2ç’’ç&÷W'G•G—RÇÂ&†÷W6R"“°¢6öç7B6÷VçG”f—57G"Ò7G&–ær‚†Æ—7F–ær2ç’’æ6÷VçG”f—2ÇÂ""“°¢6öç7B7FFT6öFU7G"Ò7G&–ær‚†Æ—7F–ær2ç’’ç7FFT6öFRÇÂ""“° ¢6öç7B'FæW%&V6öÖÖVæFF–öç2Òv—B7F÷&vRæÆ—7D†öÖU66÷WE'FæW%&V6öÖÖVæFF–öç2‡°¢6÷VçG”f—3¢6÷VçG”f—57G"À¢7FFT6öFS¢7FFT6öFU7G"À¢Æ–Ö—EW$6FVv÷'“¢2À¢Ò“°¢6öç7B–ç7V7F÷$6æF–FFW2Ò'FæW%&V6öÖÖVæFF–öç0¢æf–ÇFW"‚‡ƒ¢ç’’Óâ7G&–ær‡ƒòæ6FVv÷'’ÇÂ""’ÓÓÒ&–ç7V7F÷""¢ç6Æ–6RƒÂ2“°¢6öç7B–ç7V7F÷$WF†÷&—G”'•W6W$–BÒv—B'V–ÆDW‡÷7W&TWF†÷&—G”Ö€¢–ç7V7F÷$6æF–FFW0¢æÖ‚†6æF–FFS¢ç’’Óâ7G&–ær†6æF–FFSòçW6W$–BÇÂ""’çG&–Ò‚’¢æf–ÇFW"‚†6æF–FFT–C¢7G&–ær’Óâ6æF–FFT–BæÆVæwF‚â¢“°¢6öç7B–ç7V7F÷%&V6öÖÖVæFF–öç2Ò–ç7V7F÷$6æF–FFW0¢æf–ÇFW"‚†6æF–FFS¢ç’’Óâ°¢6öç7B6æF–FFT–BÒ7G&–ær†6æF–FFSòçW6W$–BÇÂ""’çG&–Ò‚“°¢&WGW&â&ööÆVâ†6æF–FFT–B’bb–ç7V7F÷$WF†÷&—G”'•W6W$–E¶6æF–FFT–EÒÓÓÒG'VS°¢Ò¢æÖ‡FõV&Æ–4†öÖU66÷WE'FæW%&V6öÖÖVæFF–öâ¢æf–ÇFW"„&ööÆVâ“° ¢6öç7BÖ&¶WD'V6¶WBÐ¢†v—B7F÷&vRævWD†öÖU66÷WDÖ&¶WD'V6¶WB‡°¢6÷VçG”f—3¢6÷VçG”f—57G"À¢7FFT6öFS¢7FFT6öFU7G"À¢&÷W'G•G—RÀ¢&VG4'V6¶WBÀ¢Ò’’ÇÀ¢†v—B7F÷&vRævWD†öÖU66÷WDÖ&¶WD'V6¶WB‡°¢6÷VçG”f—3¢6÷VçG”f—57G"À¢7FFT6öFS¢7FFT6öFU7G"À¢&÷W'G•G—RÀ¢&VG4'V6¶WC¢çVÆÂÀ¢Ò’’ÇÀ¢çVÆÃ° ¢6öç7B6÷VçG”ÖWG&–72Òv—B7F÷&vRævWD6÷VçG”ÖWG&–74f÷$6÷VçG’‡°¢6÷VçG”f—3¢6÷VçG”f—57G"À¢ÖWG&–4¶W—3¢°¢&†öÖW66÷WEö7F—fUöÆ—7F–æw2"À¢&†öÖW66÷WEöÖVF–å÷&–6R"À¢&†öÖW66÷WEöÖVF–åöFöÕöF—2"À¢&†öÖW66÷WE÷&–6UöG&÷5óvB"À¢ÒÀ¢Ò“° ¢6öç7B–ç7V7F–öå&W÷'G2Òv—B7F÷&vRæÆ—7D†öÖU66÷WD–ç7V7F–öå&W÷'G2‡°¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢f—6–&–Æ—G“¢'V&Æ–2"À¢7FGW3¢'V&Æ—6†VB"À¢Æ–Ö—C¢SÀ¢öfg6WC¢À¢Ò2ç’“° ¢òòWF†VçF–6FVBf–WvW'2Ö’6VRF†V—"÷vâWÆöG2†WfVâ–bVæF–ær÷&—fFR÷&VÖ÷fVB’à¢6öç7Bf–WvW$–BÒ66W72çf–WvW%W6W$–C°¢ÆWB×”–ç7V7F–öå&W÷'G3¢ç•µÒÒµÓ°¢ÆWBVæF–æt–ç7V7F–öå&W÷'G3¢ç•µÒÒµÓ°¢–b‡f–WvW$–B’°¢G'’°¢×”–ç7V7F–öå&W÷'G2Òv—B7F÷&vRæÆ—7D†öÖU66÷WD–ç7V7F–öå&W÷'G2‡°¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢7V&Ö—GFVD'•W6W$–C¢7G&–ær‡f–WvW$–B’À¢Æ–Ö—C¢SÀ¢öfg6WC¢À¢Ò2ç’“° ¢–b†66W72æ—4FÖ–äÆ–¶Uf–WvW"ÇÂ66W72æ—4÷væW%f–WvW"’°¢VæF–æt–ç7V7F–öå&W÷'G2Òv—B7F÷&vRæÆ—7D†öÖU66÷WD–ç7V7F–öå&W÷'G2‡°¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢f—6–&–Æ—G“¢'V&Æ–2"À¢7FGW3¢'VæF–æu÷&Wf–Wr"À¢Æ–Ö—C¢SÀ¢öfg6WC¢À¢Ò2ç’“°¢Ð¢Ò6F6‚°¢òòFòæ÷Bf–ÂF†RÆ—7F–ærvR–b&—f–ÆVvVB–ç7V7F–öâÖWFFF6âwB&RÆöFVBà¢×”–ç7V7F–öå&W÷'G2ÒµÓ°¢VæF–æt–ç7V7F–öå&W÷'G2ÒµÓ°¢Ð¢Ð ¢ÆWB÷Vä–ç7V7F–öå&WVW7G3¢ç•µÒÒµÓ°¢–b‡f–WvW$–B’°¢÷Vä–ç7V7F–öå&WVW7G2Òv—B7F÷&vRæÆ—7D†öÖU66÷WD–ç7V7F–öå&WVW7G2‡°¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢7FGW3¢&÷Vâ"À¢&WVW7FW%W6W$–C ¢66W72æ—4FÖ–äÆ–¶Uf–WvW"ÇÂ66W72æ—4÷væW%f–WvW"òVæFVf–æVB¢7G&–ær‡f–WvW$–B’À¢Æ–Ö—C¢SÀ¢öfg6WC¢À¢Ò2ç’“°¢Ð ¢6öç7BV&Æ–4Æ—7F–ærÒFõV&Æ–4†öÖU66÷WDÆ—7F–ær†Æ—7F–ærÂ²6æöæ–6Å&öf–ÆUW&ÂÒ“°¢–b‚V&Æ–4Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢&WGW&â&W2æ§6öâ‡°¢Æ—7F–æs¢V&Æ–4Æ—7F–ærÀ¢WfVçG3¢WfVçG2æÖ‡FõV&Æ–4†öÖU66÷WDÆ—7F–ætWfVçB’æf–ÇFW"„&ööÆVâ’À¢Ö&¶WD'V6¶WC¢FõV&Æ–4†öÖU66÷WDÖ&¶WD'V6¶WB†Ö&¶WD'V6¶WB’À¢6÷VçG”ÖWG&–73¢6÷VçG”ÖWG&–72æÖ‡FõV&Æ–4†öÖU66÷WD6÷VçG”ÖWG&–2’æf–ÇFW"„&ööÆVâ’À¢–ç7V7F÷%&V6öÖÖVæFF–öç2À¢–ç7V7F–öå&W÷'G3¢–ç7V7F–öå&W÷'G2æÖ‡FõV&Æ–4†öÖU66÷WD–ç7V7F–öå&W÷'B’æf–ÇFW"„&ööÆVâ’À¢×”–ç7V7F–öå&W÷'G3¢×”–ç7V7F–öå&W÷'G0¢æÖ‡FõV&Æ–4†öÖU66÷WD–ç7V7F–öå&W÷'B¢æf–ÇFW"„&ööÆVâ’À¢VæF–æt–ç7V7F–öå&W÷'G3¢VæF–æt–ç7V7F–öå&W÷'G0¢æÖ‡FõV&Æ–4†öÖU66÷WD–ç7V7F–öå&W÷'B¢æf–ÇFW"„&ööÆVâ’À¢÷Vä–ç7V7F–öå&WVW7G3¢÷Vä–ç7V7F–öå&WVW7G0¢æÖ‡Fõf—6–&ÆT†öÖU66÷WD–ç7V7F–öå&WVW7B¢æf–ÇFW"„&ööÆVâ’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær†öÖU66÷WBÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚†öÖU66÷WBÆ—7F–ær"Ò“°¢Ð¢Ò“° ¢gVæ7F–öâW‡G&7D–ç7V7F–öå‡&6W2‡&W÷'G3¢ç•µÒ“¢7G&–æuµÒ°¢6öç7B÷WC¢7G&–æuµÒÒµÓ°¢f÷"†6öç7B"öb&W÷'G2’°¢–b‡G—Vöb#òç7VÖÖ'’ÓÓÒ'7G&–ær"bb"ç7VÖÖ'’çG&–Ò‚’’÷WBçW6‚‡"ç7VÖÖ'’çG&–Ò‚’“°¢–b„'&’æ—4'&’‡#òæ†–v†Æ–v‡G2’’°¢f÷"†6öç7B‚öb"æ†–v†Æ–v‡G2’°¢–b‡G—Vöb‚ÓÓÒ'7G&–ær"bb‚çG&–Ò‚’’÷WBçW6‚†‚çG&–Ò‚’“°¢Ð¢Ð¢Ð¢&WGW&â÷WC°¢Ð ¢gVæ7F–öâ66÷&T¶W—v÷&D†—G2†Æ–æW3¢7G&–æuµÒÂ¶W—v÷&G3¢7G&–æuµÒ“¢çVÖ&W"°¢6öç7BÆ÷vW"ÒÆ–æW2æÖ‚‡‚’Óâ‚çFôÆ÷vW$66R‚’“°¢ÆWB†—G2Ò°¢f÷"†6öç7B²öb¶W—v÷&G2’°¢6öç7B·rÒ²çFôÆ÷vW$66R‚“°¢–b†Æ÷vW"ç6öÖR‚†Æâ’ÓâÆâæ–æ6ÇVFW2†·r’’’†—G2³Ò°¢Ð¢&WGW&â†—G3°¢Ð ¢gVæ7F–öâ'V–ÆD–ç7V7F–öä–ç6–v‡G2†Æ—7F–æs¢ç’Â&W÷'G3¢ç•µÒ’°¢6öç7B‡&6W2ÒW‡G&7D–ç7V7F–öå‡&6W2‡&W÷'G2“°¢6öç7Bæ÷&ÖÆ—¦VD†–v†Æ–v‡G2Ò‡&6W0¢æÖ‚‡‚’Óâ‚ç&WÆ6R‚õÇ2²örÂ""’çG&–Ò‚’¢æf–ÇFW"„&ööÆVâ¢ç6Æ–6RƒÂC“° ¢6öç7B6÷VçG2ÒæWrÖÇ7G&–ærÂçVÖ&W#â‚“°¢f÷"†6öç7B‚öbæ÷&ÖÆ—¦VD†–v†Æ–v‡G2’°¢6öç7B¶W’Ò‚çFôÆ÷vW$66R‚“°¢6÷VçG2ç6WB†¶W’Â†6÷VçG2ævWB†¶W’’ÇÂ’²“°¢Ð ¢6öç7BÆÄ†–v†Æ–v‡G2Ò'&’æg&öÒ†6÷VçG2æVçG&–W2‚’¢ç6÷'B‚†Â"’Óâ%³ÒÒ³Ò¢ç6Æ–6RƒÂc¢æÖ‚…·FW‡BÂÖVçF–öç5Ò’Óâ‡²FW‡BÂÖVçF–öç2Ò’“° ¢6öç7B6öç6Vç7W4†–v†Æ–v‡G2ÒÆÄ†–v†Æ–v‡G2æf–ÇFW"‚‡‚’Óâ‚æÖVçF–öç2ãÒ"’ç6Æ–6RƒÂ#“° ¢6öç7B&ööd†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢'&ööb"À¢&ÆV²"À¢'6†–ævÆR"À¢&fÆ6†–ær"À¢Ò“°¢6öç7Bf÷VæFF–öä†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢&f÷VæFF–öâ"À¢'6WGFÆVÖVçB"À¢&7&6²"À¢'7G'V7GW&Â"À¢Ò“°¢6öç7BVÆV7G&–6Ä†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢&VÆV7G&–6Â"À¢'æVÂ"À¢'v—&–ær"À¢&'&V¶W""À¢&vf6’"À¢Ò“°¢6öç7BÇVÖ&–æt†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢'ÇVÖ&–ær"À¢&ÆV²"À¢'vFW"†VFW""À¢'—R"À¢'6WvW""À¢Ò“°¢6öç7B‡f4†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢&‡f2"À¢&2"À¢&gW&æ6R"À¢&—"†æFÆW""À¢Ò“°¢6öç7BÖö—7GW&T†—G2Ò66÷&T¶W—v÷&D†—G2†æ÷&ÖÆ—¦VD†–v†Æ–v‡G2Â°¢&ÖöÆB"À¢&Öö—7GW&R"À¢'&÷B"À¢&‡VÖ–F—G’"À¢Ò“° ¢6öç7B6WfW&—G•6–væÇ2Ò&ööd†—G2²f÷VæFF–öä†—G2¢"²Öö—7GW&T†—G2¢"²VÆV7G&–6Ä†—G3° ¢6öç7B'W–W%&V6öÖÖVæFF–öç3¢7G&–æuµÒÒµÓ°¢6öç7B6VÆÆW%&V6öÖÖVæFF–öç3¢7G&–æuµÒÒµÓ°¢6öç7BVW7F–öç5Fô6³¢7G&–æuµÒÒµÓ°¢6öç7BæVv÷F–F–öåö–çG3¢7G&–æuµÒÒµÓ° ¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$7&÷72Ö6†V6²&WVFVBf–æF–æw27&÷72×VÇF—ÆR&W÷'G2&Vf÷&RÖ¶–ær6öæ6W76–öç2â ¢“°¢VW7F–öç5Fô6²çW6‚‚%v†B—FV×2&R6fWG’×&VÆFVBg2âÖ–çFVææ6R×&VÆFVCò"“°¢VW7F–öç5Fô6²çW6‚‚%v†–6‚f–æF–æw2&R7F—fR—77VW2g2âö'6W'fVB†—7F÷'“ò"“° ¢–b†f÷VæFF–öä†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$–bf÷VæFF–öâ÷7G'V7GW&Â—FV×2V"Â6²f÷"Æ–6Vç6VB7G'V7GW&ÂWfÇVF–öââ ¢“°¢VW7F–öç5Fô6²çW6‚‚$&R7&6·27F—fRÂæBv†BWf–FVæ6R7W÷'G2F†Cò"“°¢æVv÷F–F–öåö–çG2çW6‚‚%7G'V7GW&Â—FV×3¢&WVW7B7&VF—G2F–VBFòF†—&B×'G’W7F–ÖFW2â"“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢$–bç’7G'V7GW&Âæ÷FW2W†—7BÂvF†W"Væv–æVW"ÆWGFW'2÷"&W—"–çfö–6W2&Vf÷&R6†÷v–æw2â ¢“°¢Ð¢–b‡&ööd†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$–b&ööb6öæ6W&ç2V"Â&WVW7Bâ–ç7V7F–öâ'’&ööf–ær6öçG&7F÷"f÷"66÷R²&VÖ–æ–ærÆ–fRâ ¢“°¢æVv÷F–F–öåö–çG2çW6‚€¢%&ööc¢æVv÷F–FR&6VBöâ&VÖ–æ–ærÆ–fRæBFö7VÖVçFVB&W—"V÷FW2â ¢“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢$FG&W72ö'f–÷W2&ööbÆV²6÷W&6W2æBFö7VÖVçB&W—'2v—F‚†÷F÷2ö–çfö–6W2â ¢“°¢Ð¢–b†VÆV7G&–6Ä†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$VÆV7G&–6Âf–æF–æw3¢&–÷&—F—¦R6fWG’f—†W2æB6öæf—&ÒW&Ö—B&WV—&VÖVçG2–â–÷W"6÷VçG’â ¢“°¢æVv÷F–F–öåö–çG2çW6‚€¢$VÆV7G&–6Â6fWG’—FV×3¢æVv÷F–FRf÷"–ÖÖVF–FR&VÖVF–F–öâ÷"7&VF—G2â ¢“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢$f—‚ö'f–÷W2VÆV7G&–6Â6fWG’—FV×2„td4’ÂW‡÷6VBv—&–ær’&Vf÷&RÆ—7F–ær†÷F÷2æB÷Vâ†÷W6W2â ¢“°¢Ð¢–b‡ÇVÖ&–æt†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢%ÇVÖ&–ærf–æF–æw3¢6öæf—&Òv†WF†W"ÆV·2&R7F—fRæB&WVW7B6ÖW&66÷R–b6WvW"—2ÖVçF–öæVBâ ¢“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢%&W—"7F—fRÆV·2æB&WÆ6Rv÷&â7WÇ’Æ–æW3²¶VW&V6V—G2f÷"F—66Æ÷7W&Râ ¢“°¢Ð¢–b†‡f4†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$…d2f–æF–æw3¢6²f÷"6W'f–6R&V6÷&G2æB6öæf—&ÒvRöVff–6–Væ7“²6öç6–FW"GVæR×WFFVæGVÒâ ¢“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢%6W'f–6R…d2Â&WÆ6Rf–ÇFW'2ÂæBFö7VÖVçBÆ7BÖ–çFVææ6RFFR&Vf÷&RÆ—7F–ærâ ¢“°¢Ð¢–b†Öö—7GW&T†—G2â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$Öö—7GW&RöÖöÆB6–væÇ3¢G&VB2F–ÖR×6Vç6—F—fRæB6öæf—&Ò&ö÷BÖ6W6R†G&–ævRÂfVçF–ÆF–öâÂÆV·2’â ¢“°¢æVv÷F–F–öåö–çG2çW6‚‚$Öö—7GW&RÖ—F–vF–öã¢æVv÷F–FRW6–ær—FVÖ—¦VB&VÖVF–F–öâ&–G2â"“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢$†æFÆRÖö—7GW&R6÷W&6W2f—'7C²G'’Ö÷WBÇW2Fö7VÖVçFF–öâ&VGV6W2'W–W"Væ6W'F–çG’â ¢“°¢Ð ¢–b‡6WfW&—G•6–væÇ2ÓÓÒbb&W÷'G2æÆVæwF‚â’°¢'W–W%&V6öÖÖVæFF–öç2çW6‚€¢$æòÖ¦÷"&VBfÆw2FWFV7FVB–âF†RWÆöFVB†–v†Æ–v‡G2â7F–ÆÂfW&–g’W&Ö—G2övRöbÖ¦÷"7—7FV×2â ¢“°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢%W6RF†R6ÆVâ–ç7V7F–öâæ'&F—fRFò'V–ÆB6öæf–FVæ6S¢÷&væ—¦RFö72æB6öæ6—6RF—66Æ÷7W&W2â ¢“°¢Ð ¢òòÆ–v‡BÖ&¶WB6öçFW‡BW6–ær&V6ö×WFVB6÷VçG’ÖWG&–72Ç&VG’&WGW&æVBVÇ6Wv†W&Rà¢6öç7B&÷W'G•G—RÒ7G&–ær†Æ—7F–æsòç&÷W'G•G—RÇÂ&†÷W6R"“°¢6öç7B6öæF—F–öâÒ7G&–ær†Æ—7F–æsòæ6öæF—F–öâÇÂ""“°¢–b‡&÷W'G•G—Rbb6öæF—F–öâ’°¢6VÆÆW%&V6öÖÖVæFF–öç2çW6‚€¢$Æ–vâf—†W2v—F‚–÷W"6öæF—F–öâF–W"6ò&–6–æræB†÷F÷2ÖF6‚'W–W"W‡V7FF–öç2â ¢“°¢Ð ¢&WGW&â°¢&W÷'D6÷VçC¢&W÷'G2æÆVæwF‚À¢&W÷'EG—W3¢'&’æg&öÒ†æWr6WB‡&W÷'G2æÖ‚‡"’Óâ7G&–ær‡#òç&W÷'EG—RÇÂ&÷F†W""’’’’À¢6öç6Vç7W4†–v†Æ–v‡G2À¢ÆÄ†–v†Æ–v‡G2À¢'W–W%&V6öÖÖVæFF–öç3¢'W–W%&V6öÖÖVæFF–öç2ç6Æ–6RƒÂ’À¢6VÆÆW%&V6öÖÖVæFF–öç3¢6VÆÆW%&V6öÖÖVæFF–öç2ç6Æ–6RƒÂ’À¢VW7F–öç5Fô6³¢VW7F–öç5Fô6²ç6Æ–6RƒÂ’À¢æVv÷F–F–öåö–çG3¢æVv÷F–F–öåö–çG2ç6Æ–6RƒÂ’À¢Ó°¢Ð ¢ævWB‚"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–Bö–ç7V7F–öâÖ–ç6–v‡G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BÆ—7F–æt–BÒæ÷&ÖÆ—¦T†öÖU66÷WDÆ—7F–æt–B‡&Wç&×3òæ–B“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢òòöæÇ’V&Æ—6†VBV&Æ–2&W÷'G2&RW6VBf÷"V&Æ–2–ç6–v‡G2à¢6öç7B&W÷'G2Òv—B7F÷&vRæÆ—7D†öÖU66÷WD–ç7V7F–öå&W÷'G2‡°¢Æ—7F–æt–BÀ¢f—6–&–Æ—G“¢'V&Æ–2"À¢7FGW3¢'V&Æ—6†VB"À¢Æ–Ö—C¢À¢öfg6WC¢À¢Ò2ç’“° ¢6öç7B–ç6–v‡G2Ò'V–ÆD–ç7V7F–öä–ç6–v‡G2†Æ—7F–ærÂ&W÷'G22ç•µÒ“°¢&WGW&â&W2æ§6öâ‡²Æ—7F–æt–BÂ–ç6–v‡G2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"'V–ÆF–ær–ç7V7F–öâ–ç6–v‡G3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò'V–ÆB–ç7V7F–öâ–ç6–v‡G2"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’ö†öÖW66÷WB÷&W6ÆR×7VvvW7F–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7B7FFT6öFRÒG—Vöb&öG’ç7FFT6öFRÓÓÒ'7G&–ær"ò&öG’ç7FFT6öFRçG&–Ò‚’¢"#°¢6öç7B6÷VçG”f—2ÒG—Vöb&öG’æ6÷VçG”f—2ÓÓÒ'7G&–ær"ò&öG’æ6÷VçG”f—2çG&–Ò‚’¢"#°¢6öç7B6öæF—F–öâÒG—Vöb&öG’æ6öæF—F–öâÓÓÒ'7G&–ær"ò&öG’æ6öæF—F–öâçG&–Ò‚’¢"#°¢6öç7B–V$'V–ÇBÒ&öG’ç–V$'V–ÇBÒçVÆÂòçVÖ&W"†&öG’ç–V$'V–ÇB’¢çVÆÃ°¢6öç7B7gBÒ&öG’ç7gBÒçVÆÂòçVÖ&W"†&öG’ç7gB’¢çVÆÃ°¢6öç7BfVGW&W3¢7G&–æuµÒÒ'&’æ—4'&’†&öG’æfVGW&W2¢ò&öG’æfVGW&W0¢æf–ÇFW"‚‡ƒ¢ç’’ÓâG—Vöb‚ÓÓÒ'7G&–ær"¢æÖ‚‡ƒ¢7G&–ær’Óâ‚çG&–Ò‚’¢æf–ÇFW"„&ööÆVâ¢ç6Æ–6RƒÂc¢¢µÓ° ¢–b‚7FFT6öFRÇÂ7FFT6öFRæÆVæwF‚ÓÒ"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'7FFT6öFR&WV—&VB"Ò“°¢Ð¢–b‚6÷VçG”f—2ÇÂõå³Ó•×³WÒBòçFW7B†6÷VçG”f—2’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&6÷VçG”f—2&WV—&VB"Ò“°¢Ð ¢6öç7B7VvvW7F–öç3¢ç•µÒÒµÓ° ¢òòVæ—fW'6Â&W6VçFF–öâv–ç0¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢$FVW6ÆVâ²FV6ÇWGFW"F†RVçG'’æBÖ–âÆ—f–ær76W2"À¢v‡“¢$'W–W'2æ6†÷"V–6¶Ç’â7G&öærf—'7B36V6öæG2–×&÷fW2W&6V—fVB6öæF—F–öââ"À¢Vff÷'C¢&ÖVF—VÒ"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢#Ó"F—2"À¢Ò“° ¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢$f—‚f—6–&ÆR6ÖÆÂFVfV7G2†G&—2ÂÆö÷6R†æFÆW2ÂÖ—76–ær6÷fW'2Â7VV·2’"À¢v‡“¢%6ÖÆÂ—77VW2&VB2æVvÆV7BâF–v‡FVæ–ærF†VÒ&—6W2G'W7BæB&VGV6W2–ç7V7F–öâç†–WG’â"À¢Vff÷'C¢&Æ÷r"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢&†ÆbF’"À¢Ò“° ¢6öç7BöÆFW"Ð¢G—Vöb–V$'V–ÇBÓÓÒ&çVÖ&W""bbçVÖ&W"æ—4f–æ—FR‡–V$'V–ÇB’ò–V$'V–ÇBÂ““¢fÇ6S°¢–b†öÆFW"’°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢%&RÖÆ—7BVÆV7G&–6Â²ÇVÖ&–ær6fWG’6†V6²"À¢v‡“¢$öÆFW"†öÖW2&VæVf—Bg&öÒ&ö7F—fR6fWG’fÆ–FF–öâF†B&VGV6W2'W–W"ö&¦V7F–öç2â"À¢Vff÷'C¢&ÖVF—VÒ"À¢6÷7E&ævS¢&ÖVF—VÒ"À¢F–ÖVÆ–æS¢#vVV²"À¢Ò“°¢Ð ¢–b†6öæF—F–öâÓÓÒ&f—""ÇÂ6öæF—F–öâÓÓÒ&æVVG5÷v÷&²"’°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS ¢%&–÷&—F—¦R7W&"VÃ¢ÆæG66–ærÂ÷vW"v6‚Âg&W6‚×VÆ6‚ÂF÷V6‚×WW‡FW&–÷"–çB"À¢v‡“¢$f÷"f—†W"ÖÆVæ–ærÆ—7F–æw2Â7W&"VÂ&÷FV7G2fÇVR'’6–væÆ–ær÷FVçF–ÂæB6&Râ"À¢Vff÷'C¢&ÖVF—VÒ"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢#Ó2F—2"À¢Ò“°¢ÒVÇ6R°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢$æWWG&Â–çBæB6öç6—7FVçBÆ–v‡F–ærFV×W&GW&W2"À¢v‡“¢$ÖöFW&â†÷F÷2æB6†÷v–æw2Æöö²6ÆVæW"æBÆ&vW"v—F‚6öç6—7FVçBÆ–v‡BæBæWWG&ÂFöæW2â"À¢Vff÷'C¢&ÖVF—VÒ"À¢6÷7E&ævS¢&ÖVF—VÒ"À¢F–ÖVÆ–æS¢#"ÓrF—2"À¢Ò“°¢Ð ¢–b‚fVGW&W2ç6öÖR‚†c¢7G&–ær’Óâ÷6Öö¶WÆ6ó'Æ6&&öâö’çFW7B†b’’’°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢$–ç7FÆÂ÷fW&–g’6Öö¶R²4òFWFV7F÷'2"À¢v‡“¢%6fWG’&6–72&VGV6R'W–W"v÷''’æB6â†VÇv—F‚&—6Âö–ç7W&æ6Rg&–7F–öââ"À¢Vff÷'C¢&Æ÷r"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢#†÷W""À¢Ò“°¢Ð ¢–b‡G—Vöb7gBÓÓÒ&çVÖ&W""bbçVÖ&W"æ—4f–æ—FR‡7gB’bb7gBâ#S’°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS¢%7FvR÷"FVf–æR÷fW'6—¦VB&öö×2†öff–6RÂF–æ–ærÂfÆW‚76R’"À¢v‡“¢$&–vvW"†öÖW26VÆÂ&WGFW"v†Vâ76W2†fR6ÆV"W'÷6R–â†÷F÷2æBF÷W'2â"À¢Vff÷'C¢&ÖVF—VÒ"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢#Ó"F—2"À¢Ò“°¢Ð ¢òòÆ–v‡BÆö6Â6öçFW‡C¢&V6ö×WFVB6÷VçG’ÖWG&–72&RF†RWF†÷&—FF—fR–çWG2à¢6öç7B6÷VçG”ÖWG&–72Òv—B7F÷&vRævWD6÷VçG”ÖWG&–74f÷$6÷VçG’‡°¢6÷VçG”f—2À¢ÖWG&–4¶W—3¢²&†öÖW66÷WEöÖVF–åöFöÕöF—2"Â&†öÖW66÷WEöÖVF–å÷&–6R%ÒÀ¢Ò“°¢6öç7BFöÒÒ6÷VçG”ÖWG&–72æf–æB‚†Ó¢ç’’ÓâÒæÖWG&–4¶W’ÓÓÒ&†öÖW66÷WEöÖVF–åöFöÕöF—2"“°¢6öç7BFöÔF—2ÒFöÓòæÖWG&–5fÇVRÒçVÆÂòçVÖ&W"†FöÒæÖWG&–5fÇVR’¢çVÆÃ°¢–b‡G—VöbFöÔF—2ÓÓÒ&çVÖ&W""bbçVÖ&W"æ—4f–æ—FR†FöÔF—2’bbFöÔF—2âCR’°¢7VvvW7F–öç2çW6‚‡°¢F—FÆS ¢$&ö÷7B†÷FòVÆ—G’æBÆ—7F–ær6Æ&—G’†fÆö÷"ÆâÂ&ööÒÆ&VÇ2ÂF–Æ–v‡B6†÷G2’"À¢v‡“¢$–â6Æ÷vW"Ö&¶WG2Â&W6VçFF–öâ&VGV6W2F–ÖRÖöâÖÖ&¶WBæB–×&÷fW26†÷v–ær6öçfW'6–öââ"À¢Vff÷'C¢&Æ÷r"À¢6÷7E&ævS¢&Æ÷r"À¢F–ÖVÆ–æS¢#Ó"F—2"À¢Ò“°¢Ð ¢&WGW&â&W2æ§6öâ‡°¢6÷VçG”f—2À¢7FFT6öFRÀ¢7VvvW7F–öç3¢7VvvW7F–öç2ç6Æ–6RƒÂ’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"vVæW&F–ær&W6ÆR7VvvW7F–öç3¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòvVæW&FR7VvvW7F–öç2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†öÖW66÷WBö–ç7V7F–öâ×&W÷'G2ó§&W÷'D–BöF÷væÆöB"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B&W÷'D–BÒæ÷&ÖÆ—¦T†öÖU66÷WD–ç7V7F–öå&W÷'D–B‡&Wç&×3òç&W÷'D–B“°¢–b‚&W÷'D–B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&W÷'BÒv—B7F÷&vRævWD†öÖU66÷WD–ç7V7F–öå&W÷'B‡&W÷'D–B“°¢–b‚&W÷'B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær…7G&–ær‚‡&W÷'B2ç’’æÆ—7F–æt–BÇÂ""’“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B—5V&Æ–5&W÷'BÐ¢7G&–ær‚‡&W÷'B2ç’’ç7FGW2ÇÂ""’ÓÓÒ'V&Æ—6†VB"b`¢7G&–ær‚‡&W÷'B2ç’’çf—6–&–Æ—G’ÇÂ""’ÓÓÒ'V&Æ–2#° ¢–b‚—5V&Æ–5&W÷'B’°¢6öç7Bf–WvW$–BÒ66W72çf–WvW%W6W$–C°¢–b‚f–WvW$–B’&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“° ¢6öç7B—5&W÷'E7V&Ö—GFW"Ð¢7G&–ær‡f–WvW$–B’ÓÓÒ7G&–ær‚‡&W÷'B2ç’’ç7V&Ö—GFVD'•W6W$–BÇÂ""“°¢–b‚66W72æ—4FÖ–äÆ–¶Uf–WvW"bb66W72æ—4÷væW%f–WvW"bb—5&W÷'E7V&Ö—GFW"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“°¢Ð¢Ð ¢6öç7B&W÷'E6÷W&6UW&ÂÒæ÷&ÖÆ—¦T†öÖU66÷WE&W÷'E6÷W&6UW&Â‚‡&W÷'B2ç’’ç&W÷'EW&Â“°¢–b‚&W÷'E6÷W&6UW&Â’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%&W÷'Bf–ÆRVæf–Æ&ÆR"Ò“°¢Ð¢–b‡&W÷'E6÷W&6UW&Âç7F'G5v—F‚‚"ò"’’°¢&W2ç6WD†VFW"‚$66†RÔ6öçG&öÂ"Â'&—fFRÂÖ‚ÖvSÓ3"“°¢&WGW&â&W2ç&VF—&V7Bƒ3"Â&W÷'E6÷W&6UW&Â“°¢Ð ¢6öç7B6öçG&öÆÆW"ÒæWr&÷'D6öçG&öÆÆW"‚“°¢6öç7BF–ÖV÷WBÒ6WEF–ÖV÷WB‚‚’Óâ6öçG&öÆÆW"æ&÷'B‚’Âó“°¢6öç7B6ÆV$F÷væÆöEF–ÖV÷WBÒ‚’Óâ6ÆV%F–ÖV÷WB‡F–ÖV÷WB“°¢&W2æöæ6R‚&f–æ—6‚"Â6ÆV$F÷væÆöEF–ÖV÷WB“°¢&W2æöæ6R‚&6Æ÷6R"Â6ÆV$F÷væÆöEF–ÖV÷WB“°¢6öç7BW7G&VÒÒv—BfWF6‚‡&W÷'E6÷W&6UW&ÂÂ°¢†VFW'3¢°¢66WC¢&Æ–6F–öâ÷FbÆ–ÖvR÷ærÆ–ÖvRö§VrÆ–ÖvR÷vV'ÆÆ–6F–öâöö7FWB×7G&VÒ"À¢ÒÀ¢&VF—&V7C¢&ÖçVÂ"À¢6–væÃ¢6öçG&öÆÆW"ç6–væÂÀ¢Ò“°¢–b‚W7G&VÒæö²’°¢&WGW&â&W2ç7FGW2ƒS"’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&W÷'Bf–ÆR"Ò“°¢Ð ¢6öç7BFV6Æ&VDÆVæwF‚ÒçVÖ&W"‡W7G&VÒæ†VFW'2ævWB‚&6öçFVçBÖÆVæwF‚"’ÇÂ“°¢–b€¢çVÖ&W"æ—4f–æ—FR†FV6Æ&VDÆVæwF‚’b`¢FV6Æ&VDÆVæwF‚â„ôÔUõ44õUEõ$Uõ%EôDõtäÄôEôÔ…ô%•DU0¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%&W÷'Bf–ÆR—2FöòÆ&vR"Ò“°¢Ð ¢6öç7B6öçFVçEG—RÒW7G&VÒæ†VFW'2ævWB‚&6öçFVçB×G—R"’ÇÂ&Æ–6F–öâöö7FWB×7G&VÒ#°¢6öç7B6÷W&6UF‚Ò‚‚’Óâ°¢G'’°¢&WGW&âæWrU$Â‡&W÷'E6÷W&6UW&Â’çF†æÖRÇÂ"#°¢Ò6F6‚°¢&WGW&â"#°¢Ð¢Ò’‚“°¢6öç7BW‡FVç6–öä'”6öçFVçEG—S¢&V6÷&CÇ7G&–ærÂ7G&–æsâÒ°¢&Æ–6F–öâ÷Fb#¢'Fb"À¢&–ÖvR÷ær#¢'ær"À¢&–ÖvRö§Vr#¢&§r"À¢&–ÖvR÷vV'#¢'vV'"À¢Ó°¢6öç7Bæ÷&ÖÆ—¦VD6öçFVçEG—RÒ6öçFVçEG—Rç7Æ—B‚#²"•³ÒçG&–Ò‚’çFôÆ÷vW$66R‚“°¢6öç7BW‡BÒ€¢6÷W&6UF‚æÖF6‚‚õÂâ…¶×¤Õ£Ó•×³"Ã‡Ò’Bò“òå³ÒÇÀ¢W‡FVç6–öä'”6öçFVçEG—U¶æ÷&ÖÆ—¦VD6öçFVçEG—UÒÇÀ¢'Fb ¢’çFôÆ÷vW$66R‚“°¢6öç7B6fTW‡BÒõå¶×£Ó•×³"Ã‡ÒBòçFW7B†W‡B’òW‡B¢'Fb#°¢6öç7B&6TæÖRÒ†öÖW66÷WBÖ–ç7V7F–öâÒG·&W÷'D–GÒâG·6fTW‡GÖ° ¢–b‚W7G&VÒæ&öG’’°¢&WGW&â&W2ç7FGW2ƒS"’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&W÷'Bf–ÆR"Ò“°¢Ð¢6öç7B&VFW"ÒW7G&VÒæ&öG’ævWE&VFW"‚“°¢6öç7B6‡Væ·3¢V–çC„'&•µÒÒµÓ°¢ÆWB'—FTÆVæwF‚Ò°¢v†–ÆR‡G'VR’°¢6öç7B²FöæRÂfÇVRÒÒv—B&VFW"ç&VB‚“°¢–b†FöæR’'&V³°¢–b‚fÇVR’6öçF–çVS°¢'—FTÆVæwF‚³ÒfÇVRæ'—FTÆVæwFƒ°¢–b†'—FTÆVæwF‚â„ôÔUõ44õUEõ$Uõ%EôDõtäÄôEôÔ…ô%•DU2’°¢v—B&VFW"æ6æ6VÂ‚“°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%&W÷'Bf–ÆR—2FöòÆ&vR"Ò“°¢Ð¢6‡Væ·2çW6‚‡fÇVR“°¢Ð ¢&W2ç6WD†VFW"‚$6öçFVçBÕG—R"Â6öçFVçEG—R“°¢&W2ç6WD†VFW"‚$6öçFVçBÔF—7÷6—F–öâ"ÂGF6†ÖVçC²f–ÆVæÖSÒ"G¶&6TæÖWÒ&“°¢&W2ç6WD†VFW"‚$66†RÔ6öçG&öÂ"Â'&—fFRÂÖ‚ÖvSÓ3"“° ¢6öç7B&öG’Ò'VffW"æ6öæ6B€¢6‡Væ·2æÖ‚†6‡Væ²’Óâ'VffW"æg&öÒ†6‡Væ²’’À¢'—FTÆVæwF€¢“°¢&W2ç6WD†VFW"‚$6öçFVçBÔÆVæwF‚"Â7G&–ær†&öG’æ'—FTÆVæwF‚’“°¢&WGW&â&W2ç7FGW2ƒ#’ç6VæB†&öG’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"F÷væÆöF–ær†öÖU66÷WB–ç7V7F–öâ&W÷'C¢"ÂW'&÷"“°¢–b†W'&÷#òææÖRÓÓÒ$&÷'DW'&÷""’°¢&WGW&â&W2ç7FGW2ƒSB’æ§6öâ‡²ÖW76vS¢%&W÷'BF÷væÆöBF–ÖVB÷WB"Ò“°¢Ð¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòF÷væÆöB–ç7V7F–öâ&W÷'B"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–Bö–ç7V7F–öâ×&WVW7G2"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7BÆ—7F–æt–BÒæ÷&ÖÆ—¦T†öÖU66÷WDÆ—7F–æt–B‡&Wç&×3òæ–B“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7BFV6—6–öäWF†÷&—G’Ò&VD†öÖU66÷WDFV6—6–öäWF†÷&—G’€¢&öG’À¢'V–ÆD†öÖU66÷WD–ç7V7F–öå&WVW7DFV6—6–öå66÷R†Æ—7F–æt–B¢“°¢–b‚FV6—6–öäWF†÷&—G’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$fÆ–BFV6—6–öâ6&B—2&WV—&VB"Ò“°¢Ð¢6öç7B&WVW7DÖW76vRÐ¢G—Vöb&öG’ç&WVW7DÖW76vRÓÓÒ'7G&–ær"ò&öG’ç&WVW7DÖW76vRçG&–Ò‚’¢"#°¢6öç7B&VfW'&VEv–æF÷rÐ¢G—Vöb&öG’ç&VfW'&VEv–æF÷rÓÓÒ'7G&–ær"ò&öG’ç&VfW'&VEv–æF÷rçG&–Ò‚’¢"#° ¢–b‚&WVW7DÖW76vRÇÂ&WVW7DÖW76vRæÆVæwF‚Â"ÇÂ&WVW7DÖW76vRæÆVæwF‚â#’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'&WVW7DÖW76vR×W7B&R"Ó#6†&7FW'2"Ò“°¢Ð¢–b‡&VfW'&VEv–æF÷ræÆVæwF‚â#’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'&VfW'&VEv–æF÷r×W7B&RÃÒ#6†&7FW'2"Ò“°¢Ð ¢6öç7B7&VFVBÒv—BF"çG&ç67F–öâ†7–æ2‡G‚’Óâ°¢v—B6ö×ÆWFT†öÖU66÷WDFV6—6–öä6&B‡°¢G‚À¢6÷W&6TFV6—6–öä6&D–C¢FV6—6–öäWF†÷&—G’ç6÷W&6TFV6—6–öä6&D–BÀ¢W6W$–C¢7G&–ær‡W6W$–B’À¢FV6—6–öå66÷S¢FV6—6–öäWF†÷&—G’æFV6—6–öå66÷RÀ¢Ò“°¢6öç7B¶–ç7V7F–öå&WVW7EÒÒv—BG€¢æ–ç6W'B††öÖU66÷WD–ç7V7F–öå&WVW7G2¢çfÇVW2‡°¢Æ—7F–æt–BÀ¢&WVW7FW%W6W$–C¢7G&–ær‡W6W$–B’À¢7FGW3¢&÷Vâ"2ç’À¢&WVW7DÖW76vRÀ¢&VfW'&VEv–æF÷s¢&VfW'&VEv–æF÷rÇÂçVÆÂÀ¢gVÆf–ÆÆVDC¢çVÆÂÀ¢6æ6VÆÆVDC¢çVÆÂÀ¢7&VFVDC¢æWrFFR‚’À¢WFFVDC¢æWrFFR‚’À¢Ò2ç’¢ç&WGW&æ–ær‚“°¢&WGW&â–ç7V7F–öå&WVW7C°¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡²–C¢7&VFVBæ–BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢–b†W'&÷"–ç7Fæ6Vöb†öÖU66÷WDFV6—6–öäWF†÷&—G”W'&÷"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$–çfÆ–B÷"Ç&VG’W6VBFV6—6–öâ6&B"Ò“°¢Ð¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær†öÖU66÷WB–ç7V7F–öâ&WVW7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–ç7V7F–öâ&WVW7B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–Bö–ç7V7F–öâ×&W÷'G2"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7BÆ—7F–æt–BÒæ÷&ÖÆ—¦T†öÖU66÷WDÆ—7F–æt–B‡&Wç&×3òæ–B“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7B&W÷'EG—RÐ¢G—Vöb&öG’ç&W÷'EG—RÓÓÒ'7G&–ær"bb&öG’ç&W÷'EG—RçG&–Ò‚¢ò&öG’ç&W÷'EG—RçG&–Ò‚¢¢&÷F†W"#°¢6öç7B&W÷'EW&ÂÒæ÷&ÖÆ—¦T†öÖU66÷WE&W÷'E6÷W&6UW&Â†&öG’ç&W÷'EW&Â“°¢6öç7B–ç7V7F–öäFFRÐ¢G—Vöb&öG’æ–ç7V7F–öäFFRÓÓÒ'7G&–ær"bb&öG’æ–ç7V7F–öäFFRçG&–Ò‚¢ò&öG’æ–ç7V7F–öäFFRçG&–Ò‚¢¢çVÆÃ°¢6öç7B–ç7V7F÷$æÖRÐ¢G—Vöb&öG’æ–ç7V7F÷$æÖRÓÓÒ'7G&–ær"ò&öG’æ–ç7V7F÷$æÖRçG&–Ò‚’¢"#°¢6öç7B–ç7V7F÷$6ö×ç’Ð¢G—Vöb&öG’æ–ç7V7F÷$6ö×ç’ÓÓÒ'7G&–ær"ò&öG’æ–ç7V7F÷$6ö×ç’çG&–Ò‚’¢"#°¢6öç7B–ç7V7F÷$Æ–6Vç6RÐ¢G—Vöb&öG’æ–ç7V7F÷$Æ–6Vç6RÓÓÒ'7G&–ær"ò&öG’æ–ç7V7F÷$Æ–6Vç6RçG&–Ò‚’¢"#°¢6öç7B7VÖÖ'’ÒG—Vöb&öG’ç7VÖÖ'’ÓÓÒ'7G&–ær"ò&öG’ç7VÖÖ'’çG&–Ò‚’¢"#°¢6öç7B6÷W&6U&WVW7D–BÐ¢G—Vöb&öG’ç6÷W&6U&WVW7D–BÓÓÒ'7G&–ær"ò&öG’ç6÷W&6U&WVW7D–BçG&–Ò‚’¢"#°¢6öç7B†–v†Æ–v‡G2Ò'&’æ—4'&’†&öG’æ†–v†Æ–v‡G2¢ò&öG’æ†–v†Æ–v‡G0¢æf–ÇFW"‚‡ƒ¢ç’’ÓâG—Vöb‚ÓÓÒ'7G&–ær"¢æÖ‚‡ƒ¢7G&–ær’Óâ‚çG&–Ò‚’¢æf–ÇFW"„&ööÆVâ¢ç6Æ–6RƒÂ#¢¢µÓ° ¢6öç7BÆÆ÷vVE&W÷'EG—W2Ò°¢'6VÆÆW%÷&UöÆ—7F–ær"À¢&'W–W%ö–æFWVæFVçB"À¢&×Væ–6—Â"À¢&÷F†W""À¢Ó°¢–b‚ÆÆ÷vVE&W÷'EG—W2æ–æ6ÇVFW2‡&W÷'EG—R’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B&W÷'EG—R"Ò“°¢Ð¢–b‚&W÷'EW&Â’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$G&FU66÷WB&W÷'BWÆöB—2&WV—&VB"Ò“°¢Ð¢–b‡7VÖÖ'’æÆVæwF‚âC’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'7VÖÖ'’FöòÆöær"Ò“°¢Ð¢–b€¢–ç7V7F÷$æÖRæÆVæwF‚âCÇÀ¢–ç7V7F÷$6ö×ç’æÆVæwF‚âCÇÀ¢–ç7V7F÷$Æ–6Vç6RæÆVæwF‚âƒ ¢’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–ç7V7F÷"f–VÆG2W†6VVBÖ‚ÆVæwF‚"Ò“°¢Ð ¢6öç7B—4÷væW"Ò66W72æ—4÷væW%f–WvW#° ¢ÆWB6÷W&6U&WVW7C¢ç’ÒçVÆÃ°¢–b‡6÷W&6U&WVW7D–B’°¢6÷W&6U&WVW7BÒv—B7F÷&vRævWD†öÖU66÷WD–ç7V7F–öå&WVW7B‡6÷W&6U&WVW7D–B“°¢–b‚6÷W&6U&WVW7BÇÂ7G&–ær‚‡6÷W&6U&WVW7B2ç’’æÆ—7F–æt–B’ÓÒÆ—7F–æt–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B6÷W&6U&WVW7D–Bf÷"Æ—7F–ær"Ò“°¢Ð¢Ð ¢–b‡&W÷'EG—RÓÓÒ'6VÆÆW%÷&UöÆ—7F–ær"bb—4÷væW"’°¢&WGW&â&W0¢ç7FGW2ƒC2¢æ§6öâ‡²ÖW76vS¢$öæÇ’Æ—7F–ær÷væW"övVçB6âWÆöB6VÆÆW"&W÷'G2"Ò“°¢Ð¢òò'W–W"–æFWVæFVçBWÆöG2&RÆÆ÷vVBv—F†÷WB6÷W&6R&WVW7BÂ'WBFVfVÇBFòVæF–æu÷&Wf–Wp¢òò6òF†RÆ—7F–ær÷væW"†÷"FÖ–â’6â&÷fRf÷"V&Æ–2f—6–&–Æ—G’à¢–b€¢6÷W&6U&WVW7Bb`¢7G&–ær‚‡6÷W&6U&WVW7B2ç’’ç&WVW7FW%W6W$–B’ÓÒ7G&–ær‡W6W$–B’b`¢—4÷væW"b`¢66W72æ—4FÖ–äÆ–¶Uf–WvW ¢’°¢&WGW&â&W0¢ç7FGW2ƒC2¢æ§6öâ‡²ÖW76vS¢%–÷R6âöæÇ’gVÆf–ÆÂ–÷W"÷vâ–ç7V7F–öâ&WVW7B"Ò“°¢Ð ¢6öç7B6†÷VÆDWFõV&Æ—6‚Ð¢&W÷'EG—RÓÓÒ'6VÆÆW%÷&UöÆ—7F–ær"ò—4÷væW"¢&ööÆVâ‡6÷W&6U&WVW7B’ÇÂ—4÷væW#²òògVÆf–ÆÆ–ær&WVW7B÷"÷væW"WÆöG0 ¢6öç7B7&VFVBÒv—B7F÷&vRæ7&VFT†öÖU66÷WD–ç7V7F–öå&W÷'B‡°¢Æ—7F–æt–BÀ¢7V&Ö—GFVD'•W6W$–C¢7G&–ær‡W6W$–B’À¢&W÷'EG—S¢&W÷'EG—R2ç’À¢–ç7V7F–öäFFS¢–ç7V7F–öäFFRÇÂçVÆÂÀ¢–ç7V7F÷$æÖS¢–ç7V7F÷$æÖRÇÂçVÆÂÀ¢–ç7V7F÷$6ö×ç“¢–ç7V7F÷$6ö×ç’ÇÂçVÆÂÀ¢–ç7V7F÷$Æ–6Vç6S¢–ç7V7F÷$Æ–6Vç6RÇÂçVÆÂÀ¢7VÖÖ'“¢7VÖÖ'’ÇÂçVÆÂÀ¢†–v†Æ–v‡G2À¢&W÷'EW&ÂÀ¢6÷W&6U&WVW7D–C¢6÷W&6U&WVW7D–BÇÂçVÆÂÀ¢f—6–&–Æ—G“¢'V&Æ–2"2ç’À¢7FGW3¢‡6†÷VÆDWFõV&Æ—6‚ò'V&Æ—6†VB"¢'VæF–æu÷&Wf–Wr"’2ç’À¢Ò2ç’“° ¢–b‡6÷W&6U&WVW7D–B’°¢v—B7F÷&vRæÖ&´†öÖU66÷WD–ç7V7F–öå&WVW7DgVÆf–ÆÆVB‡²&WVW7D–C¢6÷W&6U&WVW7D–BÒ“°¢Ð ¢&W2ç7FGW2ƒ#’æ§6öâ‡²–C¢7&VFVBæ–BÂ7FGW3¢†7&VFVB2ç’’ç7FGW2ÇÂçVÆÂÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær†öÖU66÷WB–ç7V7F–öâ&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWÆöB–ç7V7F–öâ&W÷'B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBö–ç7V7F–öâ×&W÷'G2ó§&W÷'D–B÷V&Æ—6‚"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B&W÷'D–BÒæ÷&ÖÆ—¦T†öÖU66÷WD–ç7V7F–öå&W÷'D–B‡&Wç&×3òç&W÷'D–B“°¢–b‚&W÷'D–B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&W÷'BÒv—B7F÷&vRævWD†öÖU66÷WD–ç7V7F–öå&W÷'B‡&W÷'D–B“°¢–b‚&W÷'B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær…7G&–ær‚‡&W÷'B2ç’’æÆ—7F–æt–BÇÂ""’“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7Bf–WvW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7Bf–WvW%&öÆRÒ7G&–ær‚‡f–WvW"2ç’“òç&öÆRÇÂ""“°¢6öç7B—4FÖ–äÆ–¶RÒ²'7WW%öFÖ–â"Â&÷5öFÖ–â"Â&ÖöFW&F÷"%Òæ–æ6ÇVFW2‡f–WvW%&öÆR“°¢6öç7B—4÷væW"Ð¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’ç6VÆÆW%W6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’ævVçEW6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’æ6öçF7EW6W$–BÇÂ""“° ¢–b‚—4FÖ–äÆ–¶Rbb—4÷væW"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“°¢Ð ¢6öç7BWFFVBÒv—B7F÷&vRçWFFT†öÖU66÷WD–ç7V7F–öå&W÷'E7FGW2‡°¢&W÷'D–BÀ¢7FGW3¢'V&Æ—6†VB"À¢Ò2ç’“° ¢&WGW&â&W2æ§6öâ‡²–C¢&W÷'D–BÂ7FGW3¢‡WFFVB2ç’“òç7FGW2ÇÂ'V&Æ—6†VB"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"V&Æ—6†–ær†öÖU66÷WB–ç7V7F–öâ&W÷'C¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòV&Æ—6‚&W÷'B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBö–ç7V7F–öâ×&W÷'G2ó§&W÷'D–B÷&VÖ÷fR"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B&W÷'D–BÒæ÷&ÖÆ—¦T†öÖU66÷WD–ç7V7F–öå&W÷'D–B‡&Wç&×3òç&W÷'D–B“°¢–b‚&W÷'D–B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&W÷'BÒv—B7F÷&vRævWD†öÖU66÷WD–ç7V7F–öå&W÷'B‡&W÷'D–B“°¢–b‚&W÷'B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær…7G&–ær‚‡&W÷'B2ç’’æÆ—7F–æt–BÇÂ""’“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7Bf–WvW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7Bf–WvW%&öÆRÒ7G&–ær‚‡f–WvW"2ç’“òç&öÆRÇÂ""“°¢6öç7B—4FÖ–äÆ–¶RÒ²'7WW%öFÖ–â"Â&÷5öFÖ–â"Â&ÖöFW&F÷"%Òæ–æ6ÇVFW2‡f–WvW%&öÆR“°¢6öç7B—4÷væW"Ð¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’ç6VÆÆW%W6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’ævVçEW6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†Æ—7F–ær2ç’’æ6öçF7EW6W$–BÇÂ""“° ¢–b‚—4FÖ–äÆ–¶Rbb—4÷væW"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“°¢Ð ¢6öç7BWFFVBÒv—B7F÷&vRçWFFT†öÖU66÷WD–ç7V7F–öå&W÷'E7FGW2‡°¢&W÷'D–BÀ¢7FGW3¢'&VÖ÷fVB"À¢Ò2ç’“° ¢&WGW&â&W2æ§6öâ‡²–C¢&W÷'D–BÂ7FGW3¢‡WFFVB2ç’“òç7FGW2ÇÂ'&VÖ÷fVB"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&VÖ÷f–ær†öÖU66÷WB–ç7V7F–öâ&W÷'C¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&VÖ÷fR&W÷'B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBö–ç7V7F–öâ×&W÷'G2ó§&W÷'D–B÷6W'f–6R×&WVW7G2"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WD–ç7V7F–öäÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B&W÷'D–BÒæ÷&ÖÆ—¦T†öÖU66÷WD–ç7V7F–öå&W÷'D–B‡&Wç&×3òç&W÷'D–B“°¢–b‚&W÷'D–B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“°¢Ð ¢6öç7B&W÷'BÒv—B7F÷&vRævWD†öÖU66÷WD–ç7V7F–öå&W÷'B‡&W÷'D–B“°¢–b‚&W÷'B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$–ç7V7F–öâ&W÷'Bæ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær…7G&–ær‚‡&W÷'B2ç’’æÆ—7F–æt–BÇÂ""’“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7BFV6—6–öäWF†÷&—G’Ò&VD†öÖU66÷WDFV6—6–öäWF†÷&—G’€¢&öG’À¢'V–ÆD†öÖU66÷WD–ç7V7F–öå6W'f–6TFV6—6–öå66÷R‡&W÷'D–B¢“°¢–b‚FV6—6–öäWF†÷&—G’’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$fÆ–BFV6—6–öâ6&B—2&WV—&VB"Ò“°¢Ð¢6öç7B6W'f–6T6FVv÷'’Ð¢G—Vöb&öG’ç6W'f–6T6FVv÷'’ÓÓÒ'7G&–ær"ò&öG’ç6W'f–6T6FVv÷'’çG&–Ò‚’¢"#°¢6öç7B6W'f–6TFW67&—F–öâÐ¢G—Vöb&öG’ç6W'f–6TFW67&—F–öâÓÓÒ'7G&–ær"ò&öG’ç6W'f–6TFW67&—F–öâçG&–Ò‚’¢"#° ¢6öç7B—5V&Æ–5&W÷'BÐ¢7G&–ær‚‡&W÷'B2ç’’ç7FGW2ÇÂ""’ÓÓÒ'V&Æ—6†VB"b`¢7G&–ær‚‡&W÷'B2ç’’çf—6–&–Æ—G’ÇÂ""’ÓÓÒ'V&Æ–2#°¢6öç7B—5&W÷'E7V&Ö—GFW"Ð¢7G&–ær†66W72çf–WvW%W6W$–BÇÂ""’ÓÓÒ7G&–ær‚‡&W÷'B2ç’’ç7V&Ö—GFVD'•W6W$–BÇÂ""“°¢–b€¢—5V&Æ–5&W÷'Bb`¢66W72æ—4FÖ–äÆ–¶Uf–WvW"b`¢66W72æ—4÷væW%f–WvW"b`¢—5&W÷'E7V&Ö—GFW ¢’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“°¢Ð ¢6öç7BÆÆ÷vVD6FVv÷&–W2Ò°¢'&ööf–ær"À¢'ÇVÖ&–ær"À¢&VÆV7G&–6Â"À¢&‡f2"À¢&f÷VæFF–öâ"À¢'7G'V7GW&Â"À¢'W7B"À¢&ÖöÆB"À¢&vVæW&Å÷&W—""À¢&föÆÆ÷u÷Wö–ç7V7F–öâ"À¢Ó°¢–b‚ÆÆ÷vVD6FVv÷&–W2æ–æ6ÇVFW2‡6W'f–6T6FVv÷'’’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B6W'f–6T6FVv÷'’"Ò“°¢Ð¢–b€¢6W'f–6TFW67&—F–öâÇÀ¢6W'f–6TFW67&—F–öâæÆVæwF‚Â"ÇÀ¢6W'f–6TFW67&—F–öâæÆVæwF‚âC ¢’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢'6W'f–6TFW67&—F–öâ×W7B&R"ÓC6†&7FW'2"À¢Ò“°¢Ð ¢6öç7B6fU6W'f–6TFW67&—F–öâÒ6æ—F—¦UV&Æ–4Æ—7F–æuFW‡B‡6W'f–6TFW67&—F–öâÂC“°¢–b‡6fU6W'f–6TFW67&—F–öâæÆVæwF‚Â"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$FW67&–&RF†Rv÷&²v—F†÷WBF—&V7B6öçF7BFWF–Ç2"À¢Ò“°¢Ð ¢6öç7B6fTÆ—7F–æuF—FÆRÐ¢6æ—F—¦UV&Æ–4Æ—7F–æuFW‡B‚†Æ—7F–ær2ç’’çF—FÆRÂ#’ÇÂ%&÷W'G’#° ¢6öç7B²7&VFVBÂv÷&µ&WVW7BÒÒv—BF"çG&ç67F–öâ†7–æ2‡G‚’Óâ°¢v—B6ö×ÆWFT†öÖU66÷WDFV6—6–öä6&B‡°¢G‚À¢6÷W&6TFV6—6–öä6&D–C¢FV6—6–öäWF†÷&—G’ç6÷W&6TFV6—6–öä6&D–BÀ¢W6W$–C¢7G&–ær‡W6W$–B’À¢FV6—6–öå66÷S¢FV6—6–öäWF†÷&—G’æFV6—6–öå66÷RÀ¢Ò“° ¢6öç7B¶7&VFVEv÷&µ&WVW7EÒÒv—BG€¢æ–ç6W'B‡v÷&µ&WVW7G2¢çfÇVW2‡°¢7&VFVD'•W6W$–C¢7G&–ær‡W6W$–B’À¢F—FÆS¢–ç7V7F–öâföÆÆ÷r×W¢G·6W'f–6T6FVv÷'’ç&WÆ6R‚õòörÂ""—ÖÀ¢FW67&—F–öã¢°¢†öÖU66÷WBÆ—7F–æs¢G·6fTÆ—7F–æuF—FÆWÖÀ¢$–ç7V7F–öâ&W÷'B&Wf–WvVBF‡&÷Vv‚†öÖU66÷WBâ"À¢""À¢6fU6W'f–6TFW67&—F–öâÀ¢Òæ¦ö–â‚%Æâ"’À¢6FVv÷'“¢6W'f–6T6FVv÷'’À¢6÷VçG”f—3¢†Æ—7F–ær2ç’’æ6÷VçG”f—2ÇÂçVÆÂÀ¢7FFT6öFS¢†Æ—7F–ær2ç’’ç7FFT6öFRÇÂçVÆÂÀ¢66÷S¢&6öÖ×Væ—G’"À¢6÷W&6S¢'66÷WB"À¢6÷W&6U&Vd–C¢†öÖW66÷WE÷&W÷'C¢G·&W÷'D–GÖÀ¢7FGW3¢&÷Vâ"À¢f—6–&–Æ—G“¢&6öÖ×Væ—G’"À¢W‡÷7W&TÖöFS¢&wV–FVB"À¢6ö×WF—F–öäÖöFS¢&æöæR"À¢Ò¢ç&WGW&æ–ær‚“° ¢v—BG‚æ–ç6W'B‡v÷&µ&WVW7DWfVçG2’çfÇVW2‡°¢v÷&µ&WVW7D–C¢7&VFVEv÷&µ&WVW7Bæ–BÀ¢G—S¢&7&VFVB"À¢7F÷%W6W$–C¢7G&–ær‡W6W$–B’À¢ÖWFFF¢°¢6÷W&6S¢&†öÖW66÷WEö–ç7V7F–öå÷&W÷'B"À¢&W÷'D–BÀ¢Æ—7F–æt–C¢†Æ—7F–ær2ç’’æ–BÀ¢WF†÷&—G”vFS¢&FV6—6–öåö6&B"À¢6÷W&6TFV6—6–öä6&D–C¢FV6—6–öäWF†÷&—G’ç6÷W&6TFV6—6–öä6&D–BÀ¢FV6—6–öå66÷S¢FV6—6–öäWF†÷&—G’æFV6—6–öå66÷RÀ¢ÒÀ¢Ò“° ¢6öç7B¶7&VFVE6W'f–6U&WVW7EÒÒv—BG€¢æ–ç6W'B††öÖU66÷WD–ç7V7F–öå6W'f–6U&WVW7G2¢çfÇVW2‡°¢&W÷'D–BÀ¢Æ—7F–æt–C¢7G&–ær‚†Æ—7F–ær2ç’’æ–B’À¢&WVW7FW%W6W$–C¢7G&–ær‡W6W$–B’À¢6÷VçG”f—3¢7G&–ær‚†Æ—7F–ær2ç’’æ6÷VçG”f—2ÇÂ""’À¢7FFT6öFS¢7G&–ær‚†Æ—7F–ær2ç’’ç7FFT6öFRÇÂ""’À¢6W'f–6T6FVv÷'’À¢6W'f–6TFW67&—F–öã¢6fU6W'f–6TFW67&—F–öâÀ¢7FGW3¢&÷Vâ"2ç’À¢v÷&µ&WVW7D–C¢7&VFVEv÷&µ&WVW7Bæ–BÀ¢7&VFVDC¢æWrFFR‚’À¢WFFVDC¢æWrFFR‚’À¢Ò2ç’¢ç&WGW&æ–ær‚“° ¢&WGW&â²7&VFVC¢7&VFVE6W'f–6U&WVW7BÂv÷&µ&WVW7C¢7&VFVEv÷&µ&WVW7BÓ°¢Ò“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡°¢–C¢7&VFVBæ–BÀ¢v÷&µ&WVW7D–C¢v÷&µ&WVW7Bæ–BÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢–b†W'&÷"–ç7Fæ6Vöb†öÖU66÷WDFV6—6–öäWF†÷&—G”W'&÷"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$–çfÆ–B÷"Ç&VG’W6VBFV6—6–öâ6&B"Ò“°¢Ð¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær†öÖU66÷WB–ç7V7F–öâ6W'f–6R&WVW7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6W'f–6R&WVW7B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–B÷&W÷'B"À¢—4WF†VçF–6FVBÀ¢†öÖU66÷WE&W÷'DÆ–Ö—FW"À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7BÆ—7F–æt–BÒæ÷&ÖÆ—¦T†öÖU66÷WDÆ—7F–æt–B‡&Wç&×3òæ–B“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7BÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚Æ—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“°¢6öç7B66W72Òv—B&W6öÇfT†öÖU66÷WDÆ—7F–æt66W72‡&WÂÆ—7F–ær“°¢–b‚66W72æ6åf–Wr’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7B&V6öâÒG—Vöb&öG’ç&V6öâÓÓÒ'7G&–ær"ò&öG’ç&V6öâçG&–Ò‚’¢"#°¢6öç7BÖW76vRÒG—Vöb&öG’æÖW76vRÓÓÒ'7G&–ær"ò&öG’æÖW76vRçG&–Ò‚’¢"#° ¢–b‚&V6öâÇÂ&V6öâæÆVæwF‚Â2ÇÂ&V6öâæÆVæwF‚âcB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'&V6öâƒ2ÓcB6†'2’&WV—&VB"Ò“°¢Ð¢–b†ÖW76vRbbÖW76vRæÆVæwF‚â#’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&ÖW76vRFöòÆöær"Ò“°¢Ð ¢6öç7B&W÷'BÒv—B7F÷&vRæ7&VFT†öÖU66÷WDÆ—7F–æu&W÷'B‡°¢Æ—7F–æt–BÀ¢&W÷'FW%W6W$–C¢7G&–ær‡W6W$–B’À¢&V6öâÀ¢ÖW76vS¢ÖW76vRÇÂçVÆÂÀ¢7FGW3¢&÷Vâ"2ç’À¢6Æ÷6VDC¢çVÆÂÀ¢6Æ÷6VD'•W6W$–C¢çVÆÂÀ¢Ò2ç’“° ¢&W2ç7FGW2ƒ#’æ§6öâ‡²–C¢&W÷'Bæ–BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&W÷'F–ær†öÖU66÷WBÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&W÷'BÆ—7F–ær"Ò“°¢Ð¢Ð¢“° ¢ævWB€¢"ö’ö†öÖW66÷WBö×’ÖÆ—7F–æw2"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B²Æ–Ö—BÒSÂöfg6WBÒÒÒ&WçVW'’óò·Ó° ¢6öç7B&÷w2Òv—B7F÷&vRæÆ—7D†öÖU66÷WDÆ—7F–æw4f÷%6VÆÆW"‡°¢6VÆÆW%W6W$–C¢7G&–ær‡W6W$–B’À¢Æ–Ö—C¢çVÖ&W"†Æ–Ö—B’À¢öfg6WC¢çVÖ&W"†öfg6WB’À¢Ò“° ¢&W2æ§6öâ‡&÷w2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær×’†öÖU66÷WBÆ—7F–æw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚Æ—7F–æw2"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’ö†öÖW66÷WBöÆ—7F–æw2"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó° ¢6öç7B6÷VçG”f—2ÒG—Vöb&öG’æ6÷VçG”f—2ÓÓÒ'7G&–ær"ò&öG’æ6÷VçG”f—2¢"#°¢6öç7B7FFT6öFRÒG—Vöb&öG’ç7FFT6öFRÓÓÒ'7G&–ær"ò&öG’ç7FFT6öFR¢"#°¢6öç7BF—FÆRÒG—Vöb&öG’çF—FÆRÓÓÒ'7G&–ær"ò&öG’çF—FÆRçG&–Ò‚’¢"#°¢6öç7B&–6U&rÒ&öG’ç&–6S°¢6öç7B&–6RÒçVÖ&W"‡&–6U&r“° ¢–b‚6÷VçG”f—2ÇÂõå³Ó•×³WÒBòçFW7B†6÷VçG”f—2’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&6÷VçG”f—2ƒRF–v—G2’&WV—&VB"Ò“°¢Ð¢–b‚7FFT6öFRÇÂ7G&–ær‡7FFT6öFR’æÆVæwF‚ÓÒ"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'7FFT6öFRƒ"ÆWGFW'2’&WV—&VB"Ò“°¢Ð¢–b‚F—FÆRÇÂF—FÆRæÆVæwF‚Â’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'F—FÆR×W7B&RBÆV7B6†&7FW'2"Ò“°¢Ð¢–b‚çVÖ&W"æ—4f–æ—FR‡&–6R’ÇÂ&–6RÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'&–6R×W7B&R÷6—F—fRçVÖ&W""Ò“°¢Ð ¢6öç7B&WVW7FVDWF†÷%G—U&rÐ¢G—Vöb&öG’æÆ—7F–ætWF†÷%G—RÓÓÒ'7G&–ær"ò&öG’æÆ—7F–ætWF†÷%G—RçG&–Ò‚’¢"#°¢6öç7B&WVW7FVDWF†÷%G—RÐ¢&WVW7FVDWF†÷%G—U&rÓÓÒ&vVçB"ÇÂ&WVW7FVDWF†÷%G—U&rÓÓÒ&÷væW" ¢ò&WVW7FVDWF†÷%G—U&p¢¢çVÆÃ° ¢òòÆÆ÷rvVçB×÷7FVBÆ—7F–æw2öæÇ’f÷"&÷fVB&VÇF÷'2à¢ÆWB&W6öÇfVDWF†÷%G—S¢&÷væW""Â&vVçB"Ò&÷væW"#°¢–b‡&WVW7FVDWF†÷%G—RÓÓÒ&vVçB"’°¢6öç7B&VÇF÷%&öf–ÆRÒv—B7F÷&vRævWE&VÇF÷%&öf–ÆT'•W6W$–B…7G&–ær‡W6W$–B’“°¢6öç7Bö²Ð¢&VÇF÷%&öf–ÆRb`¢7G&–ær‚‡&VÇF÷%&öf–ÆR2ç’’çfW&–f–6F–öå7FGW2ÇÂ""’ÓÓÒ&&÷fVB"b`¢&ööÆVâ‚‡&VÇF÷%&öf–ÆR2ç’’æ—47F—fRóòG'VR“°¢–b‚ö²’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢$vVçB×÷7FVBÆ—7F–æw2&WV—&Râ&÷fVB&VÇF÷"&öf–ÆR"À¢Ò“°¢Ð¢&W6öÇfVDWF†÷%G—RÒ&vVçB#°¢Ð ¢6öç7BÖçVÅ6÷W&6T–FVçF—G’Ò'V–ÆDÖçVÄ†öÖU66÷WE6÷W&6TÆ—7F–æt–B‡°¢W6W$–C¢7G&–ær‡W6W$–B’À¢6÷VçG”f—2À¢7FFT6öFRÀ¢FG&W73¢G—Vöb&öG’æFG&W73ÓÓÒ'7G&–ær"ò&öG’æFG&W73¢çVÆÂÀ¢6—G“¢G—Vöb&öG’æ6—G’ÓÓÒ'7G&–ær"ò&öG’æ6—G’¢çVÆÂÀ¢¦—6öFS¢G—Vöb&öG’ç¦—6öFRÓÓÒ'7G&–ær"ò&öG’ç¦—6öFR¢çVÆÂÀ¢6÷W&6T†öÖT–C¢G—Vöb&öG’ç6÷W&6T†öÖT–BÓÓÒ'7G&–ær"ò&öG’ç6÷W&6T†öÖT–BçG&–Ò‚’¢çVÆÂÀ¢Ò“° ¢–b‚ÖçVÅ6÷W&6T–FVçF—G’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS ¢$†öÖU66÷WBÆ—7F–æw2&WV—&R7F&ÆR&÷W'G’–FVçF—G’f–6÷W&6T†öÖT–B÷"FG&W73â"À¢&V6öä6öFS¢%$õU%E•ô”DTåD•E•õ$UT•$TB"À¢Ò“°¢Ð ¢6öç7BGWÆ–6FTÖçVÄÆ—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–æt'•6÷W&6R‡°¢6÷W&6T¶W“¢&ÖçVÂ"À¢6÷W&6TÆ—7F–æt–C¢ÖçVÅ6÷W&6T–FVçF—G’ç6÷W&6TÆ—7F–æt–BÀ¢Ò“° ¢–b€¢GWÆ–6FTÖçVÄÆ—7F–ærb`¢7G&–ær‚†GWÆ–6FTÖçVÄÆ—7F–ær2ç’’ç6VÆÆW%W6W$–BÇÂ""’ÓÓÒ7G&–ær‡W6W$–B¢’°¢&WGW&â&W2ç7FGW2ƒC’’æ§6öâ‡°¢ÖW76vS¢$ÖF6†–ær†öÖU66÷WBÆ—7F–ær—2Ç&VG’VæF–ær÷"7F—fRâ"À¢Æ—7F–æt–C¢GWÆ–6FTÖçVÄÆ—7F–æræ–BÀ¢&V6öä6öFS¢$EUÄ”4DUô„ôÔU44õUEôÄ•5D”är"À¢Ò“°¢Ð ¢6öç7BÆ—7F–ærÒv—B7F÷&vRæ7&VFT†öÖU66÷WDÆ—7F–ær‡°¢6÷W&6T¶W“¢&ÖçVÂ"À¢ââæÖçVÅ6÷W&6T–FVçF—G’À¢7FGW3¢'VæF–æu÷&Wf–Wr"2ç’À¢F—FÆS¢æ÷&ÖÆ—¦U&VF7FVEFW‡B‡F—FÆRÂ#’À¢FW67&—F–öã¢æ÷&ÖÆ—¦T÷F–öæÅ&VF7FVEFW‡B†&öG’æFW67&—F–öâÂC’À¢&–6S¢7G&–ær‡&–6R’2ç’À¢&–6U&Wf–÷W3¢çVÆÂÀ¢&–6T6†ævVDC¢çVÆÂÀ¢Æ—7FVDC¢çVÆÂÀ¢öfdÖ&¶WDC¢çVÆÂÀ¢&÷W'G•G—S¢‡G—Vöb&öG’ç&÷W'G•G—RÓÓÒ'7G&–ær ¢ò&öG’ç&÷W'G•G—P¢¢&†÷W6R"’2ç’À¢&VG3¢&öG’æ&VG2ÒçVÆÂòçVÖ&W"†&öG’æ&VG2’¢çVÆÂÀ¢&F‡3¢&öG’æ&F‡2ÒçVÆÂò7G&–ær„çVÖ&W"†&öG’æ&F‡2’’¢çVÆÂÀ¢7gC¢&öG’ç7gBÒçVÆÂòçVÖ&W"†&öG’ç7gB’¢çVÆÂÀ¢Æ÷E7gC¢&öG’æÆ÷E7gBÒçVÆÂòçVÖ&W"†&öG’æÆ÷E7gB’¢çVÆÂÀ¢–V$'V–ÇC¢&öG’ç–V$'V–ÇBÒçVÆÂòçVÖ&W"†&öG’ç–V$'V–ÇB’¢çVÆÂÀ¢fVGW&W3¢æ÷&ÖÆ—¦U&VF7FVE7G&–æt'&’†&öG’æfVGW&W2ÂCÂ#’À¢6÷VçG”f—2À¢7FFT6öFRÀ¢6—G“¢æ÷&ÖÆ—¦T÷F–öæÅFW‡B†&öG’æ6—G’’À¢¦—6öFS¢æ÷&ÖÆ—¦T÷F–öæÅ¦—6öFR†&öG’ç¦—6öFR’À¢FG&W73¢æ÷&ÖÆ—¦T÷F–öæÅFW‡B†&öG’æFG&W73’À¢FG&W73#¢æ÷&ÖÆ—¦T÷F–öæÅFW‡B†&öG’æFG&W73"’À¢FG&W75f—6–&–Æ—G“¢†&öG’æFG&W75f—6–&–Æ—G’ÓÓÒ&&÷†–ÖFR ¢ò&&÷†–ÖFR ¢¢&W†7B"’2ç’À¢ÆF—GVFS¢&öG’æÆF—GVFRÒçVÆÂò7G&–ær„çVÖ&W"†&öG’æÆF—GVFR’’¢çVÆÂÀ¢Æöæv—GVFS¢&öG’æÆöæv—GVFRÒçVÆÂò7G&–ær„çVÖ&W"†&öG’æÆöæv—GVFR’’¢çVÆÂÀ¢†÷F÷3¢æ÷&ÖÆ—¦U7G&–æt'&’†&öG’ç†÷F÷2Â#BÂ’À¢6VÆÆW%W6W$–C¢W6W$–BÀ¢vVçEW6W$–C¢&W6öÇfVDWF†÷%G—RÓÓÒ&vVçB"òW6W$–B¢çVÆÂÀ¢6öçF7EW6W$–C¢W6W$–BÀ¢Æ—7F–ætWF†÷%G—S¢&W6öÇfVDWF†÷%G—R2ç’À¢&÷fVDC¢çVÆÂÀ¢&÷fVD'•W6W$–C¢çVÆÂÀ¢Ò2ç’“° ¢6öç7B6÷W&6T†öÖT–BÒG—Vöb&öG’ç6÷W&6T†öÖT–BÓÓÒ'7G&–ær"ò&öG’ç6÷W&6T†öÖT–BçG&–Ò‚’¢"#°¢–b‡6÷W&6T†öÖT–B’°¢G'’°¢6öç7B²W6W$†öÖW2ÒÒv—B–×÷'B‚"ââ÷6†&VB÷66†VÖ"“°¢v—BF ¢çWFFR‡W6W$†öÖW2¢ç6WB‡²†öÖU66÷WDÆ—7F–æt–C¢Æ—7F–æræ–BÂWFFVDC¢æWrFFR‚’Ò2ç’¢çv†W&R€¢æB†W‡W6W$†öÖW2æ–BÂ6÷W&6T†öÖT–B’ÂW‡W6W$†öÖW2æ÷væW%W6W$–BÂ7G&–ær‡W6W$–B’’¢“°¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFòÆ–æ²†öÖRfVÇB&V6÷&BFò†öÖU66÷WBÆ—7F–æs¢"ÂW'"“°¢Ð¢Ð ¢&W2ç7FGW2ƒ#’æ§6öâ‡²–C¢Æ—7F–æræ–BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær†öÖU66÷WBÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR†öÖU66÷WBÆ—7F–ær"Ò“°¢Ð¢Ð¢“° ¢çF6‚€¢"ö’ö†öÖW66÷WBöÆ—7F–æw2ó¦–B"À¢—4WF†VçF–6FVBÀ¢&WV—&Töæ&ö&F–æt6ö×ÆWFRÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“° ¢6öç7BÆ—7F–æt–BÒ7G&–ær‡&Wç&×2æ–BÇÂ""“°¢–b‚Æ—7F–æt–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&Æ—7F–æt–B&WV—&VB"Ò“° ¢6öç7BW†—7F–ærÒv—B7F÷&vRævWD†öÖU66÷WDÆ—7F–ær†Æ—7F–æt–B“°¢–b‚W†—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢6öç7Bf–WvW"Òv—B7F÷&vRævWEW6W"…7G&–ær‡W6W$–B’“°¢6öç7Bf–WvW%&öÆRÒ‡f–WvW"2ç’“òç&öÆRÇÂ"#°¢6öç7B—4FÖ–äÆ–¶RÒ²'7WW%öFÖ–â"Â&÷5öFÖ–â"Â&ÖöFW&F÷"%Òæ–æ6ÇVFW2…7G&–ær‡f–WvW%&öÆR’“° ¢6öç7B—4÷væW"Ð¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†W†—7F–ær2ç’’ç6VÆÆW%W6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†W†—7F–ær2ç’’ævVçEW6W$–BÇÂ""’ÇÀ¢7G&–ær‡W6W$–B’ÓÓÒ7G&–ær‚†W†—7F–ær2ç’’æ6öçF7EW6W$–BÇÂ""“° ¢–b‚—4FÖ–äÆ–¶Rbb—4÷væW"’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BÆÆ÷vVB"Ò“°¢Ð ¢6öç7B&öG’Ò&Wæ&öG’óò·Ó°¢6öç7BWFFW3¢ç’Ò·Ó° ¢–b‡G—Vöb&öG’çF—FÆRÓÓÒ'7G&–ær"’°¢6öç7BF—FÆRÒæ÷&ÖÆ—¦U&VF7FVEFW‡B†&öG’çF—FÆRÂ#“°¢–b‡F—FÆRæÆVæwF‚ÂÇÂF—FÆRæÆVæwF‚â#’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'F—FÆR×W7B&RÓ#6†&7FW'2"Ò“°¢Ð¢WFFW2çF—FÆRÒF—FÆS°¢Ð ¢–b‡G—Vöb&öG’æFW67&—F–öâÓÓÒ'7G&–ær"’°¢WFFW2æFW67&—F–öâÒæ÷&ÖÆ—¦T÷F–öæÅ&VF7FVEFW‡B†&öG’æFW67&—F–öâÂC“°¢Ð ¢–b†&öG’ç&–6RÒçVÆÂ’°¢6öç7BæW‡E&–6RÒçVÖ&W"†&öG’ç&–6R“°¢–b‚çVÖ&W"æ—4f–æ—FR†æW‡E&–6R’ÇÂæW‡E&–6RÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'&–6R×W7B&R÷6—F—fRçVÖ&W""Ò“°¢Ð¢6öç7B&WbÒçVÖ&W"…7G&–ær‚†W†—7F–ær2ç’’ç&–6Róò’“°¢–b„çVÖ&W"æ—4f–æ—FR‡&Wb’bb&WbÓÒæW‡E&–6R’°¢WFFW2ç&–6U&Wf–÷W2Ò†W†—7F–ær2ç’’ç&–6S°¢WFFW2ç&–6T6†ævVDBÒæWrFFR‚“°¢Ð¢WFFW2ç&–6RÒ7G&–ær†æW‡E&–6R“°¢Ð ¢6öç7B–çDf–VÆBÒ†¶W“¢7G&–ærÂÖ–ã¢çVÖ&W"ÂÖƒ¢çVÖ&W"’Óâ°¢–b†&öG•¶¶W•ÒÓÒçVÆÂ’&WGW&ã°¢6öç7BâÒçVÖ&W"†&öG•¶¶W•Ò“°¢–b‚çVÖ&W"æ—4f–æ—FR†â’’&WGW&ã°¢WFFW5¶¶W•ÒÒÖF‚æÖ‚†Ö–âÂÖF‚æÖ–â†Ö‚ÂÖF‚çG'Væ2†â’’“°¢Ó° ¢6öç7BçVÔf–VÆBÒ†¶W“¢7G&–ærÂÖ–ã¢çVÖ&W"ÂÖƒ¢çVÖ&W"’Óâ°¢–b†&öG•¶¶W•ÒÓÒçVÆÂ’&WGW&ã°¢6öç7BâÒçVÖ&W"†&öG•¶¶W•Ò“°¢–b‚çVÖ&W"æ—4f–æ—FR†â’’&WGW&ã°¢WFFW5¶¶W•ÒÒ7G&–ær„ÖF‚æÖ‚†Ö–âÂÖF‚æÖ–â†Ö‚Ââ’’“°¢Ó° ¢–b‡G—Vöb&öG’ç&÷W'G•G—RÓÓÒ'7G&–ær"bb&öG’ç&÷W'G•G—RçG&–Ò‚’’°¢WFFW2ç&÷W'G•G—RÒ&öG’ç&÷W'G•G—RçG&–Ò‚“°¢Ð¢–çDf–VÆB‚&&VG2"ÂÂS“°¢çVÔf–VÆB‚&&F‡2"ÂÂS“°¢–çDf–VÆB‚'7gB"ÂÂ#“°¢–çDf–VÆB‚&Æ÷E7gB"ÂÂS“°¢–çDf–VÆB‚'–V$'V–ÇB"ÂcÂ##“° ¢–b„'&’æ—4'&’†&öG’æfVGW&W2’’°¢WFFW2æfVGW&W2Òæ÷&ÖÆ—¦U&VF7FVE7G&–æt'&’†&öG’æfVGW&W2ÂCÂ#“°¢Ð¢–b„'&’æ—4'&’†&öG’ç†÷F÷2’’°¢WFFW2ç†÷F÷2Òæ÷&ÖÆ—¦U7G&–æt'&’†&öG’ç†÷F÷2Â#BÂ“°¢Ð ¢–b„ö&¦V7Bæ¶W—2‡WFFW2’æÆVæwF‚ÓÓÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$æòWFFW2&÷f–FVB"Ò“°¢Ð ¢6öç7BWFFVBÒv—B7F÷&vRçWFFT†öÖU66÷WDÆ—7F–ær‡²Æ—7F–æt–BÂWFFW2Ò2ç’“°¢–b‚WFFVB’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$Æ—7F–æræ÷Bf÷VæB"Ò“° ¢òòF–ÖVÆ–æRWfVçG2†¦ö"õT’&VG2¢–b‡WFFW2ç&–6T6†ævVDB’°¢v—B7F÷&vRæ7&VFT†öÖU66÷WDÆ—7F–ætWfVçB‡°¢Æ—7F–æt–BÀ¢WfVçEG—S¢'&–6Uö6†ævVB"2ç’À¢ö'6W'fVDC¢WFFW2ç&–6T6†ævVDBÀ¢–ÆöC¢²g&öÓ¢†W†—7F–ær2ç’’ç&–6RÂFó¢‡WFFVB2ç’’ç&–6RÒÀ¢Ò2ç’“°¢Ð¢v—B7F÷&vRæ7&VFT†öÖU66÷WDÆ—7F–ætWfVçB‡°¢Æ—7F–æt–BÀ¢WfVçEG—S¢'WFFVB"2ç’À¢ö'6W'fVDC¢æWrFFR‚’À¢–ÆöC¢²f–VÆG3¢ö&¦V7Bæ¶W—2‡WFFW2’ÒÀ¢Ò2ç’“° ¢&W2æ§6öâ‡WFFVB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ær†öÖU66÷WBÆ—7F–æs¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR†öÖU66÷WBÆ—7F–ær"Ò“°¢Ð¢Ð¢“° ¢òò6fVB6V&6†W0¢ç÷7B‚"ö’÷6fVB×6V&6†W2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B6V&6„FFÒ°¢ââç&Wæ&öG’À¢W6W$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢Ó° ¢6öç7B6fVE6V&6‚Òv—B7F÷&vRæ7&VFU6fVE6V&6‚‡6V&6„FF“°¢&W2æ§6öâ‡6fVE6V&6‚“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6f–ær6V&6ƒ¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6fR6V&6‚"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’÷6fVB×6V&6†W2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7B6fVE6V&6†W2Òv—B7F÷&vRævWEW6W%6fVE6V&6†W2‡W6W$–B“°¢&W2æ§6öâ‡6fVE6V&6†W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6fVB6V&6†W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6fVB6V&6†W2"Ò“°¢Ð¢Ò“° ¢æFVÆWFR‚"ö’÷6fVB×6V&6†W2ó¦–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–BÒÒ&Wç&×3°¢v—B7F÷&vRæFVÆWFU6fVE6V&6‚†–B“°¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"FVÆWF–ær6fVB6V&6ƒ¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòFVÆWFR6fVB6V&6‚"Ò“°¢Ð¢Ò“° ¢òòG&ç67F–öâF—7WFW0¢ç÷7B‚"ö’öF—7WFW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BF—7WFTFFÒ°¢ââç&Wæ&öG’À¢–æ—F–F÷$–C¢‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–BÀ¢Ó° ¢6öç7BF—7WFRÒv—B7F÷&vRæ7&VFUG&ç67F–öäF—7WFR†F—7WFTFF“° ¢&W2æ§6öâ†F—7WFR“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærF—7WFS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRF—7WFR"Ò“°¢Ð¢Ò“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ”ÔTåB5•5DTÒ$õUDU2ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢òò–ÖVçBÖWF†öG2æB6öæf–wW&F–öç0¢ævWB‚"ö’÷–ÖVçG2öÖWF†öG2"Â—4WF†VçF–6FVBÂ‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BÖ÷VçE&rÒ‡&WçVW'’2ç’“òæÖ÷VçC°¢6öç7B–ÖVçEG—U&rÒ‡&WçVW'’2ç’“òç–ÖVçEG—S°¢6öç7BÖ÷VçBÒÖ÷VçE&rÒçVÆÂòçVÖ&W"†Ö÷VçE&r’¢VæFVf–æVC°¢6öç7B–ÖVçEG—RÐ¢G—Vöb–ÖVçEG—U&rÓÓÒ'7G&–ær"bb–ÖVçEG—U&rçG&–Ò‚¢ò‡–ÖVçEG—U&rçG&–Ò‚’2ç’¢¢VæFVf–æVC° ¢6öç7BÖWF†öG2Ò–ÖVçE6W'f–6RævWDf–Æ&ÆU–ÖVçDÖWF†öG2‡G'VRÂ²Ö÷VçBÂ–ÖVçEG—RÒ“°¢&W2æ§6öâ†ÖWF†öG2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær–ÖVçBÖWF†öG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–ÖVçBÖWF†öG2"Ò“°¢Ð¢Ò“° ¢òòvÆÆWB&Ææ6Rf÷"7W'&VçBW6W ¢ævWB‚"ö’÷vÆÆWBö&Ææ6R"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B&Ææ6RÒv—B7F÷&vRævWEvÆÆWD&Ææ6R‡W6W$–B“°¢&W2æ§6öâ‡²&Ææ6RÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærvÆÆWB&Ææ6S¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚vÆÆWB&Ææ6R"Ò“°¢Ð¢Ò“° ¢òòvÆÆWBG&ç67F–öç2f÷"7W'&VçBW6W ¢ævWB‚"ö’÷vÆÆWB÷G&ç67F–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7BÆ–Ö—E&ÒÒ&WçVW'’æÆ–Ö—C°¢6öç7BÆ–Ö—BÒG—VöbÆ–Ö—E&ÒÓÓÒ'7G&–ær"òçVÖ&W"†Æ–Ö—E&Ò’¢S°¢6öç7B6fTÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR†Æ–Ö—B’ÇÂÆ–Ö—BÃÒÇÂÆ–Ö—Bâ#òS¢Æ–Ö—C° ¢6öç7BG&ç67F–öç2Òv—B7F÷&vRævWEvÆÆWEG&ç67F–öç4f÷%W6W"‡W6W$–BÂ6fTÆ–Ö—B“°¢&W2æ§6öâ‡²G&ç67F–öç2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærvÆÆWBG&ç67F–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚vÆÆWBG&ç67F–öç2"Ò“°¢Ð¢Ò“° ¢òò7WW"ÖFÖ–âf–ææ6RÆVFvW#¢vw&VvFRvÆÆWBG&ç67F–öç27&÷72ÆÂW6W'0¢ævWB‚"ö’öFÖ–âöf–ææ6RöÆVFvW""Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BÆ–Ö—E&ÒÒ&WçVW'’æÆ–Ö—C°¢6öç7BÆ–Ö—BÒG—VöbÆ–Ö—E&ÒÓÓÒ'7G&–ær"òçVÖ&W"†Æ–Ö—E&Ò’¢#°¢6öç7B6fTÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR†Æ–Ö—B’ÇÂÆ–Ö—BÃÒÇÂÆ–Ö—Bâò#¢Æ–Ö—C° ¢6öç7Bg&öÕ&ÒÒG—Vöb&WçVW'’æg&öÒÓÓÒ'7G&–ær"ò&WçVW'’æg&öÒ¢VæFVf–æVC°¢6öç7BFõ&ÒÒG—Vöb&WçVW'’çFòÓÓÒ'7G&–ær"ò&WçVW'’çFò¢VæFVf–æVC°¢6öç7BF—&V7F–öå&ÒÐ¢G—Vöb&WçVW'’æF—&V7F–öâÓÓÒ'7G&–ær"ò&WçVW'’æF—&V7F–öâ¢VæFVf–æVC°¢6öç7BG—U&ÒÐ¢G—Vöb&WçVW'’çG&ç67F–öåG—RÓÓÒ'7G&–ær"ò&WçVW'’çG&ç67F–öåG—R¢VæFVf–æVC° ¢6öç7Bg&öÔFFRÒg&öÕ&ÒòæWrFFR†g&öÕ&Ò’¢VæFVf–æVC°¢6öç7BFôFFRÒFõ&ÒòæWrFFR‡Fõ&Ò’¢VæFVf–æVC°¢6öç7B†4g&öÒÒg&öÔFFRbbçVÖ&W"æ—4æâ†g&öÔFFRævWEF–ÖR‚’“°¢6öç7B†5FòÒFôFFRbbçVÖ&W"æ—4æâ‡FôFFRævWEF–ÖR‚’“° ¢6öç7Bæ÷&ÖÆ—¦VDF—&V7F–öâÐ¢F—&V7F–öå&ÒÓÓÒ&7&VF—B"ÇÂF—&V7F–öå&ÒÓÓÒ&FV&—B"òF—&V7F–öå&Ò¢VæFVf–æVC°¢6öç7Bæ÷&ÖÆ—¦VEG—RÐ¢G—U&ÒbbG—U&ÒçG&–Ò‚’æÆVæwF‚âòG—U&ÒçG&–Ò‚’¢VæFVf–æVC° ¢6öç7B&6UVW'’ÒF"ç6VÆV7B‚’æg&öÒ‡vÆÆWEG&ç67F–öç2“°¢6öç7B6öæF—F–öç3¢ç•µÒÒµÓ° ¢–b††4g&öÒbbg&öÔFFR’°¢6öæF—F–öç2çW6‚†wFR‡vÆÆWEG&ç67F–öç2æ7&VFVDBÂg&öÔFFR’“°¢Ð¢–b††5FòbbFôFFR’°¢6öæF—F–öç2çW6‚†ÇFR‡vÆÆWEG&ç67F–öç2æ7&VFVDBÂFôFFR’“°¢Ð¢–b†æ÷&ÖÆ—¦VDF—&V7F–öâ’°¢6öæF—F–öç2çW6‚†W‡vÆÆWEG&ç67F–öç2æF—&V7F–öâÂæ÷&ÖÆ—¦VDF—&V7F–öâ2ç’’“°¢Ð¢–b†æ÷&ÖÆ—¦VEG—R’°¢6öæF—F–öç2çW6‚†W‡vÆÆWEG&ç67F–öç2çG&ç67F–öåG—RÂæ÷&ÖÆ—¦VEG—R2ç’’“°¢Ð ¢6öç7Bf–ÇFW&VEVW'’Ò6öæF—F–öç2æÆVæwF‚âò&6UVW'’çv†W&R†æB‚ââæ6öæF—F–öç2’’¢&6UVW'“° ¢6öç7B&÷w2Òv—Bf–ÇFW&VEVW'’æ÷&FW$'’†FW62‡vÆÆWEG&ç67F–öç2æ7&VFVDB’’æÆ–Ö—B‡6fTÆ–Ö—B“° ¢6öç7BG&ç67F–öç2Ò‡&÷w22ç•µÒ’æÖ‚‡&÷r’Óâ‡°¢–C¢7G&–ær‡&÷ræ–Bóò""’À¢W6W$–C¢7G&–ær‡&÷rçW6W$–Bóò""’À¢6÷VçFW''G•W6W$–C¢&÷ræ6÷VçFW''G•W6W$–Bò7G&–ær‡&÷ræ6÷VçFW''G•W6W$–B’¢çVÆÂÀ¢F—&V7F–öã¢&÷ræF—&V7F–öâÓÓÒ&FV&—B"ò&FV&—B"¢&7&VF—B"À¢Ö÷VçC¢çVÖ&W"‡&÷ræÖ÷VçBóò’À¢G&ç67F–öåG—S¢7G&–ær‡&÷rçG&ç67F–öåG—Róò'Væ¶æ÷vâ"’À¢&VfW&Væ6UG—S¢&÷rç&VfW&Væ6UG—Rò7G&–ær‡&÷rç&VfW&Væ6UG—R’¢çVÆÂÀ¢&VfW&Væ6T–C¢&÷rç&VfW&Væ6T–Bò7G&–ær‡&÷rç&VfW&Væ6T–B’¢çVÆÂÀ¢ÖVÖó¢&÷ræÖVÖòò7G&–ær‡&÷ræÖVÖò’¢çVÆÂÀ¢7&VFVDC¢&÷ræ7&VFVDBòæWrFFR‡&÷ræ7&VFVDB2ç’’çFô•4õ7G&–ær‚’¢çVÆÂÀ¢Ò’“° ¢ÆWB&Ææ6TFVÇFÒ°¢ÆWBF÷FÄ7&VF—G2Ò°¢ÆWBF÷FÄFV&—G2Ò°¢f÷"†6öç7BG‚öbG&ç67F–öç2’°¢–b‚çVÖ&W"æ—4f–æ—FR‡G‚æÖ÷VçB’’6öçF–çVS°¢–b‡G‚æF—&V7F–öâÓÓÒ&7&VF—B"’°¢F÷FÄ7&VF—G2³ÒG‚æÖ÷VçC°¢&Ææ6TFVÇF³ÒG‚æÖ÷VçC°¢ÒVÇ6R°¢F÷FÄFV&—G2³ÒG‚æÖ÷VçC°¢&Ææ6TFVÇFÓÒG‚æÖ÷VçC°¢Ð¢Ð ¢&W2æ§6öâ‡°¢G&ç67F–öç2À¢7VÖÖ'“¢°¢6÷VçC¢G&ç67F–öç2æÆVæwF‚À¢F÷FÄ7&VF—G2À¢F÷FÄFV&—G2À¢&Ææ6TFVÇFÀ¢ÒÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFÖ–âf–ææ6RÆVFvW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚f–ææ6RÆVFvW""Ò“°¢Ð¢Ò“° ¢òòvÆÆWBF‚7FFVÖVçB‡–V&Ç’÷V'FW&Ç’’f÷"7W'&VçBW6W ¢ævWB‚"ö’÷vÆÆWB÷F‚×7FFVÖVçB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7BW&–öEG—RÒ‡&WçVW'’çW&–öEG—R27G&–ær’ÇÂ'–V"#²òò'–V""Â'V'FW" ¢6öç7B–V%&ÒÒ&WçVW'’ç–V"27G&–ærÂVæFVf–æVC°¢6öç7BV'FW%&ÒÒ&WçVW'’çV'FW"27G&–ærÂVæFVf–æVC°¢6öç7Bf÷&ÖBÒ‡&WçVW'’æf÷&ÖB27G&–ær’ÇÂ&§6öâ#²òò&§6öâ"Â&77b  ¢6öç7Bæ÷rÒæWrFFR‚“°¢6öç7B–V"Ò–V%&ÒòçVÖ&W"‡–V%&Ò’¢æ÷rævWDgVÆÅ–V"‚“°¢–b‚çVÖ&W"æ—4f–æ—FR‡–V"’ÇÂ–V"Â#ÇÂ–V"â#’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B–V""Ò“°¢Ð ¢ÆWB7F'C¢FFS°¢ÆWBVæC¢FFS°¢ÆWBV'FW#¢çVÖ&W"ÂVæFVf–æVC° ¢–b‡W&–öEG—RÓÓÒ'V'FW""’°¢V'FW"ÒV'FW%&ÒòçVÖ&W"‡V'FW%&Ò’¢VæFVf–æVC°¢–b‚V'FW"ÇÂçVÖ&W"æ—4f–æ—FR‡V'FW"’ÇÂV'FW"ÂÇÂV'FW"âB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'V'FW"×W7B&RÓBv†VâW&–öEG—S×V'FW""Ò“°¢Ð ¢6öç7B7F'DÖöçF‚Ò‡V'FW"Ò’¢3²òòÖ&6VBÖöçF‚–æFW€¢7F'BÒæWrFFR‡–V"Â7F'DÖöçF‚ÂÂÂÂÂ“°¢VæBÒæWrFFR‡–V"Â7F'DÖöçF‚²2ÂÂ#2ÂS’ÂS’Â““’“°¢ÒVÇ6R°¢7F'BÒæWrFFR‡–V"ÂÂÂÂÂÂ“°¢VæBÒæWrFFR‡–V"ÂÂ3Â#2ÂS’ÂS’Â““’“°¢Ð ¢6öç7B&÷w2Òv—BF ¢ç6VÆV7B‚¢æg&öÒ‡vÆÆWEG&ç67F–öç2¢çv†W&R€¢æB€¢W‡vÆÆWEG&ç67F–öç2çW6W$–BÂW6W$–B’À¢wFR‡vÆÆWEG&ç67F–öç2æ7&VFVDBÂ7F'B’À¢ÇFR‡vÆÆWEG&ç67F–öç2æ7&VFVDBÂVæB¢¢¢æ÷&FW$'’†62‡vÆÆWEG&ç67F–öç2æ7&VFVDB’“° ¢ÆWBF÷FÄ7&VF—G2Ò°¢ÆWBF÷FÄFV&—G2Ò°¢ÆWBF†&ÆT–æ6öÖUF÷FÂÒ°¢6öç7BF÷FÇ4'•G—S¢&V6÷&CÇ7G&–ærÂ²7&VF—G3¢çVÖ&W#²FV&—G3¢çVÖ&W"ÓâÒ·Ó° ¢òòö'f–÷W2–æ6öÖRÖÆ–¶RvÆÆWB7&VF—G2F†B6†÷VÆBvVæW&ÆÇ’&R6öç6–FW&VBf÷"F‚W'÷6W2à¢òòF†—2—2–çFVçF–öæÆÇ’6öç6W'fF—fS²W6W'2æBF†V—"F‚&÷26â÷fW'&–FRF†—2W6–ærF†R55bà¢6öç7BF†&ÆT–æ6öÖUG—W2ÒæWr6WCÇ7G&–æsâ…²&ff–Æ–FUö6öÖÖ—76–öâ"Â&Ö&¶WGÆ6U÷6ÆR%Ò“° ¢f÷"†6öç7B&÷röb&÷w22ç•µÒ’°¢6öç7B×BÒçVÖ&W"‡&÷ræÖ÷VçBÇÂ“°¢–b‚çVÖ&W"æ—4f–æ—FR†×B’’6öçF–çVS°¢6öç7BG—RÒ‡&÷rçG&ç67F–öåG—RÇÂ'Væ¶æ÷vâ"’çFõ7G&–ær‚“°¢6öç7BF—"Ò&÷ræF—&V7F–öâÓÓÒ&FV&—B"ò&FV&—B"¢&7&VF—B#° ¢–b‚F÷FÇ4'•G—U·G—UÒ’°¢F÷FÇ4'•G—U·G—UÒÒ²7&VF—G3¢ÂFV&—G3¢Ó°¢Ð ¢–b†F—"ÓÓÒ&7&VF—B"’°¢F÷FÄ7&VF—G2³Ò×C°¢F÷FÇ4'•G—U·G—UÒæ7&VF—G2³Ò×C° ¢–b‡F†&ÆT–æ6öÖUG—W2æ†2‡G—R’’°¢F†&ÆT–æ6öÖUF÷FÂ³Ò×C°¢Ð¢ÒVÇ6R°¢F÷FÄFV&—G2³Ò×C°¢F÷FÇ4'•G—U·G—UÒæFV&—G2³Ò×C°¢Ð¢Ð ¢6öç7BæWD6†ævRÒF÷FÄ7&VF—G2ÒF÷FÄFV&—G3° ¢6öç7B7VÖÖ'’Ò°¢W6W$–BÀ¢W&–öC¢°¢G—S¢W&–öEG—RÓÓÒ'V'FW""ò'V'FW""¢'–V""À¢–V"À¢V'FW#¢W&–öEG—RÓÓÒ'V'FW""òV'FW"¢VæFVf–æVBÀ¢7F'DFFS¢7F'BçFô•4õ7G&–ær‚’À¢VæDFFS¢VæBçFô•4õ7G&–ær‚’À¢ÒÀ¢F÷FÇ3¢°¢F÷FÄ7&VF—G2À¢F÷FÄFV&—G2À¢æWD6†ævRÀ¢F†&ÆT–æ6öÖUF÷FÂÀ¢ÒÀ¢F÷FÇ4'•G—S¢ö&¦V7BæVçG&–W2‡F÷FÇ4'•G—R’æÖ‚…·G&ç67F–öåG—RÂeÒ’Óâ‡°¢G&ç67F–öåG—RÀ¢F÷FÄ7&VF—G3¢bæ7&VF—G2À¢F÷FÄFV&—G3¢bæFV&—G2À¢æWD6†ævS¢bæ7&VF—G2ÒbæFV&—G2À¢Ò’’À¢G&ç67F–öç3¢&÷w2À¢Ó° ¢–b†f÷&ÖBÓÓÒ&77b"’°¢6öç7B†VFW"Ò°¢'G&ç67F–öåö–B"À¢&7&VFVEöB"À¢&F—&V7F–öâ"À¢&Ö÷VçB"À¢'G&ç67F–öå÷G—R"À¢'&VfW&Væ6U÷G—R"À¢'&VfW&Væ6Uö–B"À¢&6÷VçFW''G•÷W6W%ö–B"À¢&ÖVÖò"À¢Ó° ¢6öç7B77dÆ–æW2Ò¶†VFW"æ¦ö–â‚"Â"•Ó°¢f÷"†6öç7B&÷röb&÷w22ç•µÒ’°¢6öç7BÆ–æRÒ°¢&÷ræ–BÀ¢&÷ræ7&VFVDCòçFô•4õ7G&–æsòâ‚’ÇÂæWrFFR‡&÷ræ7&VFVDB’çFô•4õ7G&–ær‚’À¢&÷ræF—&V7F–öâÀ¢&÷ræÖ÷VçBÀ¢&÷rçG&ç67F–öåG—RÀ¢&÷rç&VfW&Væ6UG—RÇÂ""À¢&÷rç&VfW&Væ6T–BÇÂ""À¢&÷ræ6÷VçFW''G•W6W$–BÇÂ""À¢‡&÷ræÖVÖòÇÂ""’çFõ7G&–ær‚’ç&WÆ6R‚ò"örÂr""r’À¢Ó°¢77dÆ–æW2çW6‚†Æ–æRæÖ‚‡b’Óâ"Gµ7G&–ær‡bóò""’ç&WÆ6R‚ò"örÂr""r—Ò&’æ¦ö–â‚"Â"’“°¢Ð ¢&W2ç6WD†VFW"‚$6öçFVçBÕG—R"Â'FW‡Bö77b"“°¢&W2ç6WD†VFW"€¢$6öçFVçBÔF—7÷6—F–öâ"À¢GF6†ÖVçC²f–ÆVæÖSÒ'vÆÆWB×F‚×7FFVÖVçBÒG·W6W$–GÒÒG·–V'ÒG°¢W&–öEG—RÓÓÒ'V'FW""bbG—VöbV'FW"ÓÓÒ&çVÖ&W""òÕG·V'FW'Ö¢" ¢Òæ77b& ¢“°¢&WGW&â&W2ç6VæB†77dÆ–æW2æ¦ö–â‚%Æâ"’“°¢Ð ¢&W2æ§6öâ‡7VÖÖ'’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"vVæW&F–ærvÆÆWBF‚7FFVÖVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòvVæW&FRvÆÆWBF‚7FFVÖVçB"Ò“°¢Ð¢Ò“° ¢òòVW"×Fò×VW"vÆÆWBG&ç6fW ¢ç÷7B‚"ö’÷vÆÆWB÷G&ç6fW""Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bg&öÕW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢6öç7B²FõW6W$–BÂÖ÷VçBÂÖVÖòÒÒ&Wæ&öG’ÇÂ·Ó° ¢–b‚g&öÕW6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢–b‚FõW6W$–BÇÂÖ÷VçB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'FõW6W$–BæBÖ÷VçB&R&WV—&VB"Ò“°¢Ð ¢6öç7BçVÖW&–4Ö÷VçBÒçVÖ&W"†Ö÷VçB“°¢–b‚çVÖ&W"æ—4f–æ—FR†çVÖW&–4Ö÷VçB’ÇÂçVÖW&–4Ö÷VçBÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&Ö÷VçB×W7B&R÷6—F—fRçVÖ&W""Ò“°¢Ð ¢òòFV&—B6VæFW"æB7&VF—B&V6—–Vç@¢v—B7F÷&vRæFV&—EvÆÆWB†g&öÕW6W$–BÂçVÖW&–4Ö÷VçBÂ°¢G—S¢''÷6VæB"À¢&VfW&Væ6UG—S¢'vÆÆWE÷G&ç6fW""À¢&VfW&Væ6T–C¢FõW6W$–BÀ¢ÖVÖòÀ¢6÷VçFW''G•W6W$–C¢FõW6W$–BÀ¢Ò“° ¢v—B7F÷&vRæ7&VF—EvÆÆWB‡FõW6W$–BÂçVÖW&–4Ö÷VçBÂ°¢G—S¢''÷&V6V—fR"À¢&VfW&Væ6UG—S¢'vÆÆWE÷G&ç6fW""À¢&VfW&Væ6T–C¢g&öÕW6W$–BÀ¢ÖVÖòÀ¢6÷VçFW''G•W6W$–C¢g&öÕW6W$–BÀ¢Ò“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"W&f÷&Ö–ærvÆÆWBG&ç6fW#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòG&ç6fW"gVæG2"Ò“°¢Ð¢Ò“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ44õUD4ô”â„D•4$ÄTBÔ%’ÔDTdTÅB’ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢ævWB‚"ö’÷66÷WF6ö–âö6öæf–r"Â—4WF†VçF–6FVBÂ7–æ2…÷&W¢ç’Â&W3¢ç’’Óâ°¢&WGW&â&W2æ§6öâ‡°¢Fö¶Vã¢66÷WF6ö–å6W'f–6RævWEFö¶Vä6öæf–r‚’À¢6ö×Æ–æ6S¢66÷WF6ö–å6W'f–6RævWD6ö×Æ–æ6T6öæf–r‚’À¢&–6S¢66÷WF6ö–å6W'f–6RævWE&–6T6öæf–r‚’À¢Ò“°¢Ò“° ¢ævWB‚"ö’÷66÷WF6ö–â÷vÆÆWB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢6öç7B&Vv—7G'’Ò66÷WF6ö–å6W'f–6RævWEvÆÆWE&Vv—7G'”VçG'’…7G&–ær‡W6W$–B’“°¢6öç7B&Ææ6RÒ66÷WF6ö–å6W'f–6RævWEW6W$&Ææ6R…7G&–ær‡W6W$–B’“°¢&WGW&â&W2æ§6öâ‡°¢&Vv—7G'’À¢&Ææ6RÀ¢Fö¶Vã¢66÷WF6ö–å6W'f–6RævWEFö¶Vä6öæf–r‚’À¢&–6S¢66÷WF6ö–å6W'f–6RævWE&–6T6öæf–r‚’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB66÷WD6ö–âvÆÆWB"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’÷66÷WF6ö–â÷G&ç67F–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢6öç7BÆ–Ö—E&rÒçVÖ&W"‡&WçVW'’æÆ–Ö—BóòS“°¢6öç7BÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR†Æ–Ö—E&r’òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒSÂÆ–Ö—E&r’’¢S°¢&WGW&â&W2æ§6öâ‡°¢G&ç67F–öç3¢66÷WF6ö–å6W'f–6RævWEW6W%G&ç67F–öç2…7G&–ær‡W6W$–B’ÂÆ–Ö—B’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB66÷WD6ö–â†—7F÷'’"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’÷66÷WF6ö–âö'W’"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢6öç7BÖ÷VçBÒ&Wæ&öG“òæÖ÷VçC°¢6öç7BG‚Ò66÷WF6ö–å6W'f–6Ræ'W’…7G&–ær‡W6W$–B’ÂÖ÷VçB“°¢&WGW&â&W2æ§6öâ‡²7V66W73¢G'VRÂG&ç67F–öã¢G‚Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFò'W’66÷WD6ö–â"’Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’÷66÷WF6ö–â÷6VæB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢6öç7BFõW6W$–BÒ7G&–ær‡&Wæ&öG“òçFõW6W$–BÇÂ""’çG&–Ò‚“°¢6öç7BÖ÷VçBÒ&Wæ&öG“òæÖ÷VçC°¢6öç7B&W7VÇBÒ66÷WF6ö–å6W'f–6Rç6VæB…7G&–ær‡W6W$–B’ÂFõW6W$–BÂÖ÷VçB“°¢&WGW&â&W2æ§6öâ‡²7V66W73¢G'VRÂââç&W7VÇBÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFò6VæB66÷WD6ö–â"’Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’÷66÷WF6ö–â÷&VFVVÒ"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢6öç7BÖ÷VçBÒ&Wæ&öG“òæÖ÷VçC°¢6öç7BF&vWBÒ7G&–ær‡&Wæ&öG“òçF&vWBÇÂ""’2'G&FU÷66÷WE÷W&²"Â&ÖVÅ÷'FæW%÷W&²#°¢6öç7BG‚Ò66÷WF6ö–å6W'f–6Rç&VFVVÒ…7G&–ær‡W6W$–B’ÂÖ÷VçBÂF&vWB“°¢&WGW&â&W2æ§6öâ‡²7V66W73¢G'VRÂG&ç67F–öã¢G‚Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFò&VFVVÒ66÷WD6ö–â"’Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’öFÖ–â÷66÷WF6ö–âöVF—BÖÆör"À¢—4WF†VçF–6FVBÀ¢—57WW$FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢6öç7BÆ–Ö—E&rÒçVÖ&W"‡&WçVW'’æÆ–Ö—Bóò#“°¢6öç7BÆ–Ö—BÒçVÖ&W"æ—4f–æ—FR†Æ–Ö—E&r’òÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂÆ–Ö—E&r’’¢#°¢&WGW&â&W2æ§6öâ‡°¢Æös¢66÷WF6ö–å6W'f–6RævWDVF—DÆör†Æ–Ö—B’À¢6÷VçC¢ÖF‚æÖ–â†Æ–Ö—BÂ66÷WF6ö–å6W'f–6RævWDVF—DÆör†Æ–Ö—B’æÆVæwF‚’À¢Ò“°¢Ð¢“° ¢ç÷7B€¢"ö’öFÖ–â÷66÷WF6ö–âö·–2"À¢—4WF†VçF–6FVBÀ¢—57WW$FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7F÷$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–BÇÂçVÆÃ°¢6öç7BW6W$–BÒ7G&–ær‡&Wæ&öG“òçW6W$–BÇÂ""’çG&–Ò‚“°¢6öç7B·–57FGW2Ò7G&–ær‡&Wæ&öG“òæ·–57FGW2ÇÂ""’çG&–Ò‚’0¢Â'VçfW&–f–VB ¢Â'VæF–ær ¢Â'fW&–f–VB ¢Â'&V¦V7FVB#°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'W6W$–B—2&WV—&VB"Ò“°¢6öç7B&Vv—7G'’Ò66÷WF6ö–å6W'f–6Rç6WD·–57FGW2€¢W6W$–BÀ¢·–57FGW2À¢7F÷$–Bò7G&–ær†7F÷$–B’¢VæFVf–æV@¢“°¢&WGW&â&W2æ§6öâ‡²7V66W73¢G'VRÂ&Vv—7G'’Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFòWFFRµ”2"’Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’öFÖ–â÷66÷WF6ö–âög&VW¦R"À¢—4WF†VçF–6FVBÀ¢—57WW$FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7F÷$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–BÇÂçVÆÃ°¢6öç7BW6W$–BÒ7G&–ær‡&Wæ&öG“òçW6W$–BÇÂ""’çG&–Ò‚“°¢6öç7Bg&÷¦VâÒ&ööÆVâ‡&Wæ&öG“òæg&÷¦Vâ“°¢6öç7B&V6öâÒ7G&–ær‡&Wæ&öG“òç&V6öâÇÂ""’çG&–Ò‚“°¢–b‚W6W$–B’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢'W6W$–B—2&WV—&VB"Ò“°¢6öç7B&Vv—7G'’Ò66÷WF6ö–å6W'f–6Ræg&VW¦UvÆÆWB€¢W6W$–BÀ¢g&÷¦VâÀ¢7F÷$–Bò7G&–ær†7F÷$–B’¢VæFVf–æVBÀ¢&V6öâÇÂVæFVf–æV@¢“°¢&WGW&â&W2æ§6öâ‡²7V66W73¢G'VRÂ&Vv—7G'’Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFòWFFRg&VW¦R7FFR"’Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’öFÖ–â÷66÷WF6ö–âö6öæf–r"À¢—4WF†VçF–6FVBÀ¢—57WW$FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B&öG’Ò&Wæ&öG’ÇÂ·Ó°¢–b†&öG“òçFö¶Vå7FGW2’°¢66÷WF6ö–å6W'f–6Rç6WEFö¶Vå7FGW2€¢7G&–ær†&öG’çFö¶Vå7FGW2’2&F—6&ÆVB"Â'FW7FæWB"Â&Ö–ææWB ¢“°¢Ð¢–b†&öG“òç&–6R’°¢66÷WF6ö–å6W'f–6Rç6WE&–6T6öæf–r†&öG’ç&–6R“°¢Ð¢–b†&öG“òæ6ö×Æ–æ6R’°¢66÷WF6ö–å6W'f–6Rç6WD6ö×Æ–æ6T6öæf–r†&öG’æ6ö×Æ–æ6R“°¢Ð¢&WGW&â&W2æ§6öâ‡°¢7V66W73¢G'VRÀ¢Fö¶Vã¢66÷WF6ö–å6W'f–6RævWEFö¶Vä6öæf–r‚’À¢&–6S¢66÷WF6ö–å6W'f–6RævWE&–6T6öæf–r‚’À¢6ö×Æ–æ6S¢66÷WF6ö–å6W'f–6RævWD6ö×Æ–æ6T6öæf–r‚’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢7G&–ær†W'&÷#òæÖW76vRÇÂ%Væ&ÆRFòWFFR66÷WD6ö–â6öæf–r"’Ò“°¢Ð¢Ð¢“° ¢òò7&VFR6öçG&7F÷"–ÖVçB–çFVç@¢ç÷7B€¢"ö’÷–ÖVçG2ö6öçG&7F÷"ö7&VFRÖ–çFVçB"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6öçG&7F÷%–ÖVçD–BÒÒ&Wæ&öG“° ¢–b‚6öçG&7F÷%–ÖVçD–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%–ÖVçB”B&WV—&VB"Ò“°¢Ð ¢6öç7B–ÖVçBÒv—B7F÷&vRævWD6öçG&7F÷%–ÖVçB†6öçG&7F÷%–ÖVçD–B“°¢–b‚–ÖVçB’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%–ÖVçBæ÷Bf÷VæB"Ò“°¢Ð ¢òòfW&–g’W6W"WF†÷&—¦F–öâ†V—F†W"†öÖV÷væW"÷"6öçG&7F÷"¢6öç7BW6W"Ò&WçW6W#°¢–b‡–ÖVçBæ†öÖV÷væW$–BÓÒW6W#òæ–Bbb–ÖVçBæ6öçG&7F÷$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFò66W72F†—2–ÖVçB"Ò“°¢Ð ¢6öç7B&W7VÇBÒv—B–ÖVçE6W'f–6Ræ7&VFT6öçG&7F÷%–ÖVçD–çFVçB‡–ÖVçB“°¢&W2æ§6öâ‡&W7VÇB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær6öçG&7F÷"–ÖVçB–çFVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–ÖVçB–çFVçB"Ò“°¢Ð¢Ð¢“° ¢òò7&VFRÖ&¶WGÆ6R–ÖVçB–çFVç@¢ç÷7B€¢"ö’÷–ÖVçG2öÖ&¶WGÆ6Rö7&VFRÖ–çFVçB"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²G&ç67F–öä–BÂ&ö6W76–ætÖWF†öBÒÒ&Wæ&öG“° ¢–b‚G&ç67F–öä–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâ”B&WV—&VB"Ò“°¢Ð ¢6öç7BG&ç67F–öâÒv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öâ‡G&ç67F–öä–B“°¢–b‚G&ç67F–öâ’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâæ÷Bf÷VæB"Ò“°¢Ð ¢òòfW&–g’W6W"WF†÷&—¦F–öâ†V—F†W"'W–W"÷"6VÆÆW"¢6öç7BW6W"Ò&WçW6W#°¢–b‡G&ç67F–öâæ'W–W$–BÓÒW6W#òæ–BbbG&ç67F–öâç6VÆÆW$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFò66W72F†—2G&ç67F–öâ"Ò“°¢Ð ¢6öç7BÖWF†öBÐ¢&ö6W76–ætÖWF†öBÓÓÒ&6‚"ò&6‚"¢&ö6W76–ætÖWF†öBÓÓÒ&6&B"ò&6&B"¢VæFVf–æVC° ¢6öç7B&W7VÇBÒv—B–ÖVçE6W'f–6Ræ7&VFTÖ&¶WGÆ6U–ÖVçD–çFVçB‡G&ç67F–öâ2ç’Â°¢&ö6W76–ætÖWF†öC¢ÖWF†öB2ç’À¢Ò“°¢&W2æ§6öâ‡&W7VÇB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærÖ&¶WGÆ6R–ÖVçB–çFVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–ÖVçB–çFVçB"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’÷–ÖVçG2÷&öf–ÆRÖ&öö¶–ærö7&VFRÖ–çFVçB"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B'W–W%W6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢6öç7B&öö¶–æu&WVW7D–BÒ7G&–ær‡&Wæ&öG“òæ&öö¶–æu&WVW7D–BÇÂ""’çG&–Ò‚“°¢6öç7B&WVW7FVDÖ÷VçBÒçVÖ&W"‡&Wæ&öG“òæÖ÷VçB“°¢6öç7BFW67&—F–öå&rÐ¢G—Vöb&Wæ&öG“òæFW67&—F–öâÓÓÒ'7G&–ær"ò&Wæ&öG’æFW67&—F–öâçG&–Ò‚’¢"#°¢6öç7B6Æ÷D–BÒG—Vöb&Wæ&öG“òç6Æ÷D–BÓÓÒ'7G&–ær"ò&Wæ&öG’ç6Æ÷D–BçG&–Ò‚’¢"#°¢–b‚'W–W%W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢–b‚&öö¶–æu&WVW7D–B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$&öö¶–ær&WVW7Bæ÷Bf÷VæB"Ò“°¢Ð¢6öç7Bæ÷&ÖÆ—¦VD'W–W%W6W$–BÒ7G&–ær†'W–W%W6W$–B“°¢6öç7B&WVW7E&V6÷&BÒv—B7F÷&vRævWE&öf–ÆT&öö¶–æu&WVW7D'”–B†&öö¶–æu&WVW7D–B“°¢6öç7B&öö¶–æt6öçFW‡BÐ¢&WVW7E&V6÷&Còæ&öö¶–æt6öçFW‡BbbG—Vöb&WVW7E&V6÷&Bæ&öö¶–æt6öçFW‡BÓÓÒ&ö&¦V7B ¢ò&WVW7E&V6÷&Bæ&öö¶–æt6öçFW‡@¢¢·Ó° ¢–b‚&WVW7E&V6÷&B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$&öö¶–ær&WVW7Bæ÷Bf÷VæB"Ò“°¢Ð ¢–b‡&WVW7E&V6÷&Bç&WVW7FW%W6W$–BÓÒæ÷&ÖÆ—¦VD'W–W%W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFò’F†—2&öö¶–ær&WVW7B"Ò“°¢Ð ¢6öç7BW†—7F–æu–ÖVçBÒfÆ–FFTW†—7F–æu&öf–ÆT&öö¶–æu–ÖVçB€¢&WVW7E&V6÷&BÀ¢&WVW7FVDÖ÷Vç@¢“°¢–b‚W†—7F–æu–ÖVçBæö²’°¢&WGW&â&W2ç7FGW2†W†—7F–æu–ÖVçBç7FGW2’æ§6öâ‡²ÖW76vS¢W†—7F–æu–ÖVçBæÖW76vRÒ“°¢Ð ¢6öç7B&öö¶–æt–FVçF—G’Òv—B&W6öÇfU&öf–ÆT&öö¶–æt÷væW"€¢7F÷&vRÀ¢&Wæ&öG’À¢&WVW7E&V6÷&Bæ÷væW%W6W$–@¢“°¢–b‚&öö¶–æt–FVçF—G’æö²’°¢&WGW&â&W2ç7FGW2†&öö¶–æt–FVçF—G’ç7FGW2’æ§6öâ‡²ÖW76vS¢&öö¶–æt–FVçF—G’æÖW76vRÒ“°¢Ð¢6öç7B²÷væW%W6W$–C¢&W6öÇfVD÷væW%W6W$–BÂ÷væW"ÒÒ&öö¶–æt–FVçF—G“° ¢–b‡&W6öÇfVD÷væW%W6W$–BÓÓÒæ÷&ÖÆ—¦VD'W–W%W6W$–B’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢%–÷R6ææ÷B7&VFR–B&öö¶–ær–çFVçBf÷"–÷W"÷vâ&öf–ÆR"Ò“°¢Ð ¢6öç7B&W6öÇfVD&öö¶–æt6öçFW‡BÒ&W6öÇfT&öö¶–æufW&–f–6F–öä6öçFW‡B€¢÷væW"À¢&öö¶–æt6öçFW‡BÀ¢&WVW7E&V6÷&BæFVÆ—fW'”ÖöFRÇÂ&öç6—FR"À¢&WVW7E&V6÷&Bç6W'f–6TÆ&VÂÇÂçVÆÀ¢“° ¢6öç7BfW&–f–6F–öävFRÒWfÇVFTæ÷F'•–E&VÖ÷FTvFR‡°¢÷væW#¢°¢fW&–f–6F–öå7FGW3¢÷væW"çfW&–f–6F–öå7FGW2À¢FG&W75fW&–f–VC¢÷væW"æFG&W75fW&–f–VBÀ¢&öÆS¢÷væW"ç&öÆRÀ¢&öÆW3¢÷væW"ç&öÆW2ÇÂµÒÀ¢&VfW&Væ6W3¢÷væW"ç&VfW&Væ6W2À¢ÒÀ¢&öö¶–æt6öçFW‡C¢&W6öÇfVD&öö¶–æt6öçFW‡B2ç’À¢–D&öö¶–æs¢&WVW7E&V6÷&BæFW÷6—E&WV—&VBÓÓÒG'VRÀ¢Ò“° ¢–b‡fW&–f–6F–öävFRæÆ–VBbbfW&–f–6F–öävFRæÆÆ÷vVB’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡°¢ÖW76vS¢$Æ÷V—6–æ&VÖ÷FRæ÷F'’–B&öö¶–æw2&WV—&RFF—F–öæÂfW&–f–6F–öâ"À¢fW&–f–6F–öävFRÀ¢Ò“°¢Ð ¢6öç7Bf–æÄÖ÷VçBÒW†—7F–æu–ÖVçBæÖ÷VçEW6C° ¢6öç7BFW67&—F–öâÐ¢FW67&—F–öå&ræÆVæwF‚â ¢òFW67&—F–öå&rç6Æ–6RƒÂ#ƒ¢¢&öö¶–ærFW÷6—Bf÷"G¶÷væW"æf—'7DæÖRÇÂ%G&FU66÷WB'ÒG¶÷væW"æÆ7DæÖRÇÂ%W6W"'ÖçG&–Ò‚“° ¢6öç7B7G&—RÒvWE7G&—T6Æ–VçB‚“°¢–b‚7G&—R’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%7G&—Ræ÷B6öæf–wW&VB"Ò“°¢Ð ¢6öç7B–ÖVçD–çFVçE&W7VÇBÒv—B&W6öÇfU&öf–ÆT&öö¶–æu–ÖVçD–çFVçB‡°¢7G&—RÀ¢&öö¶–æu&WVW7D–C¢7G&–ær‡&WVW7E&V6÷&Bæ–B’À¢W†—7F–æu–ÖVçD–çFVçD–C¢&WVW7E&V6÷&Bç–ÖVçD–çFVçD–BÀ¢7W'&VçE–ÖVçE7FGW3¢W†—7F–æu–ÖVçBç–ÖVçE7FGW2À¢Ö÷VçEW6C¢f–æÄÖ÷VçBÀ¢FW67&—F–öâÀ¢÷væW%W6W$–C¢&W6öÇfVD÷væW%W6W$–BÀ¢'W–W%W6W$–C¢æ÷&ÖÆ—¦VD'W–W%W6W$–BÀ¢&öf–ÆT–C¢&öö¶–æt–FVçF—G’ç&öf–ÆT–BÀ¢6Æ÷D–BÀ¢WFFU–ÖVçE7FFS¢‡F6‚’Óà¢7F÷&vRçWFFU&öf–ÆT&öö¶–æu&WVW7B‡&WVW7E&V6÷&Bæ–BÂF6‚2ç’’À¢Ò“°¢–b‚–ÖVçD–çFVçE&W7VÇBæö²’°¢&WGW&â&W0¢ç7FGW2‡–ÖVçD–çFVçE&W7VÇBç7FGW2¢æ§6öâ‡²ÖW76vS¢–ÖVçD–çFVçE&W7VÇBæÖW76vRÒ“°¢Ð¢6öç7B²–çFVçBÒÒ–ÖVçD–çFVçE&W7VÇC° ¢òò÷F–öæÃ¢7–æ2–ÖVçB–çFVçB7&VF–öâ–çFòÆ–æ¶VB&÷W'G’&öw&Òà¢G'’°¢6öç7B7G‚Ð¢&WVW7E&V6÷&Còæ&öö¶–æt6öçFW‡BbbG—Vöb&WVW7E&V6÷&Bæ&öö¶–æt6öçFW‡BÓÓÒ&ö&¦V7B ¢ò‡&WVW7E&V6÷&Bæ&öö¶–æt6öçFW‡B2ç’¢¢‡&W6öÇfVD&öö¶–æt6öçFW‡B2ç’’ÇÂ·Ó°¢6öç7B&÷W'G•&öw&Ô–BÐ¢G—Vöb7G‚ç&÷W'G•&öw&Ô–BÓÓÒ'7G&–ær"ò7G&–ær†7G‚ç&÷W'G•&öw&Ô–B’çG&–Ò‚’¢"#°¢–b‡&÷W'G•&öw&Ô–B’°¢v—B&WV—&U&÷W'G•&öw&Ô66W72‡°¢&÷W'G•&öw&Ô–BÀ¢W6W$–C¢7G&–ær†'W–W%W6W$–BÇÂ""’À¢Ò“°¢v—BFE&÷W'G”Æ–fV7–6ÆTWfVçB‡°¢&÷W'G•&öw&Ô–BÀ¢7F–öåG—S¢&&öö¶–æu÷–ÖVçEö–çFVçEö7&VFVB"À¢†6S¢&&öö¶–æw2"À¢F—FÆS¢$&öö¶–ær–ÖVçB7F'FVB"À¢FW67&—F–öã¢FW67&—F–öâÇÂçVÆÂÀ¢ö67W'&VDC¢æWrFFR‚’À¢6÷W&6S¢'7—7FVÒ"À¢7FGW3¢&FöæR"À¢ÖWFFF¢°¢&öö¶–æu&WVW7D–C¢&WVW7E&V6÷&Còæ–BóòçVÆÂÀ¢–ÖVçD–çFVçD–C¢–çFVçBæ–BÀ¢Ö÷VçEW6C¢f–æÄÖ÷VçBÀ¢ÒÀ¢7&VFVD'•W6W$–C¢7G&–ær†'W–W%W6W$–BÇÂ""’À¢6÷W&6U7W&f6S¢'&öf–ÆUö&öö¶–ær"À¢–FV×÷FVæ7”¶W“¢&öf–ÆUö&öö¶–æs§–ÖVçEö–çFVçC¢G¶–çFVçBæ–GÖÀ¢Ò“°¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%·&öf–ÆRÖ&öö¶–æuÒf–ÆVBFò7–æ2–ÖVçB–çFVçBFò&÷W'G’&öw&Ó¢"ÂW'"“°¢Ð ¢&W2æ§6öâ‡°¢6Æ–VçE6V7&WC¢–çFVçBæ6Æ–VçE÷6V7&WBÀ¢–ÖVçD–çFVçD–C¢–çFVçBæ–BÀ¢&öö¶–æu&WVW7D–C¢&WVW7E&V6÷&Bæ–BÀ¢Ö÷VçC¢f–æÄÖ÷VçBÀ¢7W'&Væ7“¢'W6B"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær&öf–ÆR&öö¶–ær–ÖVçB–çFVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR&öö¶–ær–ÖVçB–çFVçB"Ò“°¢Ð¢Ð¢“° ¢òò’Ö&¶WGÆ6RG&ç67F–öâW6–æröâ×ÆFf÷&ÒvÆÆWB&Ææ6P¢ç÷7B€¢"ö’÷–ÖVçG2öÖ&¶WGÆ6R÷’×v—F‚×vÆÆWB"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ&WçW6W#òæ6Æ–×3òç7V"ÇÂ&WçW6W#òæ–C°¢6öç7B²G&ç67F–öä–BÒÒ&Wæ&öG’ÇÂ·Ó° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢–b‚G&ç67F–öä–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâ”B&WV—&VB"Ò“°¢Ð ¢6öç7BG&ç67F–öâÒv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öâ‡G&ç67F–öä–B“°¢–b‚G&ç67F–öâ’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâæ÷Bf÷VæB"Ò“°¢Ð ¢–b‡G&ç67F–öâæ'W–W$–BÓÒW6W$–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$öæÇ’F†R'W–W"6â’f÷"F†—2G&ç67F–öâ"Ò“°¢Ð ¢–b‡G&ç67F–öâç7FGW2ÓÒ'VæF–ær"’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâ—2æ÷BVæF–ær–ÖVçB"Ò“°¢Ð ¢6öç7BF÷FÄÖ÷VçBÒçVÖ&W"‡G&ç67F–öâçF÷FÄÖ÷VçB2ç’“°¢6öç7B6VÆÆW$Ö÷VçBÒçVÖ&W"‡G&ç67F–öâç6VÆÆW$Ö÷VçB2ç’“° ¢–b‚çVÖ&W"æ—4f–æ—FR‡F÷FÄÖ÷VçB’ÇÂF÷FÄÖ÷VçBÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–BG&ç67F–öâÖ÷VçB"Ò“°¢Ð ¢–b‚çVÖ&W"æ—4f–æ—FR‡6VÆÆW$Ö÷VçB’ÇÂ6VÆÆW$Ö÷VçBÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B6VÆÆW"Ö÷VçB"Ò“°¢Ð ¢6öç7B&Ææ6U7G"Òv—B7F÷&vRævWEvÆÆWD&Ææ6R‡W6W$–B“°¢6öç7B&Ææ6RÒçVÖ&W"†&Ææ6U7G"“°¢–b‚çVÖ&W"æ—4f–æ—FR†&Ææ6R’ÇÂ&Ææ6RÂF÷FÄÖ÷VçB’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–ç7Vff–6–VçBvÆÆWB&Ææ6R"Ò“°¢Ð ¢òòFV&—B'W–W"vÆÆWBf÷"gVÆÂG&ç67F–öâF÷FÀ¢v—B7F÷&vRæFV&—EvÆÆWB‡W6W$–BÂF÷FÄÖ÷VçBÂ°¢G—S¢&Ö&¶WGÆ6U÷W&6†6R"À¢&VfW&Væ6UG—S¢&Ö&¶WGÆ6U÷G&ç67F–öâ"À¢&VfW&Væ6T–C¢G&ç67F–öâæ–BÀ¢ÖVÖó¢Ö&¶WGÆ6RW&6†6Rf÷"Æ—7F–ærG·G&ç67F–öâæÆ—7F–æt–GÖÀ¢6÷VçFW''G•W6W$–C¢G&ç67F–öâç6VÆÆW$–BÀ¢Ò“° ¢òò7&VF—B6VÆÆW"vÆÆWBf÷"6VÆÆW$Ö÷VçB‡ÆFf÷&Ò¶VW2F†RfVR÷'F–öâ¢v—B7F÷&vRæ7&VF—EvÆÆWB‡G&ç67F–öâç6VÆÆW$–BÂ6VÆÆW$Ö÷VçBÂ°¢G—S¢&Ö&¶WGÆ6U÷6ÆR"À¢&VfW&Væ6UG—S¢&Ö&¶WGÆ6U÷G&ç67F–öâ"À¢&VfW&Væ6T–C¢G&ç67F–öâæ–BÀ¢ÖVÖó¢Ö&¶WGÆ6R6ÆRf÷"Æ—7F–ærG·G&ç67F–öâæÆ—7F–æt–GÖÀ¢6÷VçFW''G•W6W$–C¢W6W$–BÀ¢Ò“° ¢6öç7BWFFVBÒv—B7F÷&vRçWFFTÖ&¶WGÆ6UG&ç67F–öå–ÖVçB‡G&ç67F–öâæ–BÂ°¢–ÖVçDÖWF†öC¢&öå÷ÆFf÷&Õ÷vÆÆWB"À¢—4öfeÆFf÷&Ó¢fÇ6RÀ¢7FGW3¢&6ö×ÆWFVB"À¢Ò“° ¢&W2æ§6öâ‡WFFVB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"––ærÖ&¶WGÆ6RG&ç67F–öâv—F‚vÆÆWC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò’v—F‚vÆÆWB"Ò“°¢Ð¢Ð¢“° ¢òò6öæf—&Òöfb×ÆFf÷&Ò–ÖVç@¢ç÷7B‚"ö’÷–ÖVçG2ö6öæf—&ÒÖöfb×ÆFf÷&Ò"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–ÖVçD–BÂ–ÖVçEG—RÂ6öæf—&ÖF–öäFFÒÒ&Wæ&öG“° ¢–b‚–ÖVçD–BÇÂ–ÖVçEG—RÇÂ6öæf—&ÖF–öäFF’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$Ö—76–ær&WV—&VBf–VÆG2"Ò“°¢Ð ¢6öç7BW6W"Ò&WçW6W#°¢6öç7B&W7VÇBÒv—B–ÖVçE6W'f–6Ræ6öæf—&ÔöfeÆFf÷&Õ–ÖVçB‡–ÖVçD–BÂ–ÖVçEG—RÂ°¢ââæ6öæf—&ÖF–öäFFÀ¢6öæf—&ÖVD'“¢W6W#òæ–BÀ¢Ò“° ¢&W2æ§6öâ‡&W7VÇB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6öæf—&Ö–æröfb×ÆFf÷&Ò–ÖVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6öæf—&Ò–ÖVçB"Ò“°¢Ð¢Ò“° ¢òòvWB–ÖVçBFWF–Ç0¢ævWB‚"ö’÷–ÖVçG2ö6öçG&7F÷"ó§–ÖVçD–B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²–ÖVçD–BÒÒ&Wç&×3°¢6öç7B–ÖVçBÒv—B7F÷&vRævWD6öçG&7F÷%–ÖVçB‡–ÖVçD–B“° ¢–b‚–ÖVçB’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%–ÖVçBæ÷Bf÷VæB"Ò“°¢Ð ¢òòfW&–g’W6W"WF†÷&—¦F–öà¢6öç7BW6W"Ò&WçW6W#°¢–b‡–ÖVçBæ†öÖV÷væW$–BÓÒW6W#òæ–Bbb–ÖVçBæ6öçG&7F÷$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFò66W72F†—2–ÖVçB"Ò“°¢Ð ¢&W2æ§6öâ‡–ÖVçB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6öçG&7F÷"–ÖVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–ÖVçB"Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’÷–ÖVçG2öÖ&¶WGÆ6Ró§G&ç67F–öä–B"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²G&ç67F–öä–BÒÒ&Wç&×3°¢6öç7BG&ç67F–öâÒv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öâ‡G&ç67F–öä–B“° ¢–b‚G&ç67F–öâ’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%G&ç67F–öâæ÷Bf÷VæB"Ò“°¢Ð ¢òòfW&–g’W6W"WF†÷&—¦F–öà¢6öç7BW6W"Ò&WçW6W#°¢–b‡G&ç67F–öâæ'W–W$–BÓÒW6W#òæ–BbbG&ç67F–öâç6VÆÆW$–BÓÒW6W#òæ–B’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢$æ÷BWF†÷&—¦VBFò66W72F†—2G&ç67F–öâ"Ò“°¢Ð ¢&W2æ§6öâ‡G&ç67F–öâ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÖ&¶WGÆ6RG&ç67F–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚G&ç67F–öâ"Ò“°¢Ð¢Ð¢“° ¢òòvWBW6W"–ÖVçB†—7F÷'¢ævWB‚"ö’÷–ÖVçG2ö†—7F÷'’"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W#°¢6öç7B²G—RÒ&ÆÂ"ÒÒ&WçVW'“° ¢6öç7B†—7F÷'“¢ç’Ò·Ó° ¢–b‡G—RÓÓÒ&ÆÂ"ÇÂG—RÓÓÒ&6öçG&7F÷""’°¢òòvWB6öçG&7F÷"–ÖVçG2v†W&RW6W"—2†öÖV÷væW ¢6öç7B†öÖV÷væW%–ÖVçG2Òv—B7F÷&vRævWD6öçG&7F÷%–ÖVçG4'”†öÖV÷væW"‡W6W#òæ–B“°¢òòvWB6öçG&7F÷"–ÖVçG2v†W&RW6W"—26öçG&7F÷ ¢6öç7B6öçG&7F÷%–ÖVçG2Òv—B7F÷&vRævWD6öçG&7F÷%–ÖVçG4'”6öçG&7F÷"‡W6W#òæ–B“°¢†—7F÷'’æ6öçG&7F÷%–ÖVçG2Ò°¢4†öÖV÷væW#¢†öÖV÷væW%–ÖVçG2À¢46öçG&7F÷#¢6öçG&7F÷%–ÖVçG2À¢Ó°¢Ð ¢–b‡G—RÓÓÒ&ÆÂ"ÇÂG—RÓÓÒ&Ö&¶WGÆ6R"’°¢òòvWBÖ&¶WGÆ6RG&ç67F–öç2v†W&RW6W"—2'W–W ¢6öç7B'W–W%G&ç67F–öç2Òv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öç4'•W6W"‡W6W#òæ–BÂ&'W–W""“°¢òòvWBÖ&¶WGÆ6RG&ç67F–öç2v†W&RW6W"—26VÆÆW ¢6öç7B6VÆÆW%G&ç67F–öç2Òv—B7F÷&vRævWDÖ&¶WGÆ6UG&ç67F–öç4'•W6W"€¢W6W#òæ–BÀ¢'6VÆÆW" ¢“°¢†—7F÷'’æÖ&¶WGÆ6UG&ç67F–öç2Ò°¢4'W–W#¢'W–W%G&ç67F–öç2À¢56VÆÆW#¢6VÆÆW%G&ç67F–öç2À¢Ó°¢Ð ¢&W2æ§6öâ††—7F÷'’“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær–ÖVçB†—7F÷'“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–ÖVçB†—7F÷'’"Ò“°¢Ð¢Ò“° ¢òò6Æ7VÆFR–ÖVçBfVW0¢ç÷7B‚"ö’÷–ÖVçG2ö6Æ7VÆFRÖfVW2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²Ö÷VçBÂ–ÖVçEG—RÒ&6öçG&7F÷%÷6W'f–6R"Â&ö6W76–ætÖWF†öBÒÒ&Wæ&öG“° ¢–b‚Ö÷VçBÇÂÖ÷VçBÃÒ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%fÆ–BÖ÷VçB&WV—&VB"Ò“°¢Ð ¢6öç7BfVW2Òv—B–ÖVçE6W'f–6Ræ6Æ7VÆFU–ÖVçDfVW2†Ö÷VçBÂ–ÖVçEG—RÂ°¢&ö6W76–ætÖWF†öC¢&ö6W76–ætÖWF†öBÓÓÒ&6‚"ò&6‚"¢&6&B"À¢Ò“°¢&W2æ§6öâ†fVW2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6Æ7VÆF–ærfVW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6Æ7VÆFRfVW2"Ò“°¢Ð¢Ò“° ¢&Vv—7FW%–ÖVçEvV&†ööµ&÷WFW2†Â°¢7G&—U&÷f–FW#¢vWE7G&—T6Æ–VçBÀ¢vV&†ööµ6V7&WE&÷f–FW#¢‚’Óâ&ö6W72æVçbå5E$•UõtT$„ôôµõ4T5$UBÀ¢–ÖVçE6W'f–6RÀ¢6öÖ×Væ—G”'V–ÆFW%–ÖVçE6W'f–6RÀ¢ÆFf÷&Õ7W÷'E–ÖVçE6W'f–6RÀ¢Ò“° ¢òòFÖ–â–ÖVçB6öæf–wW&F–öâ&÷WFW0¢ævWB‚"ö’öFÖ–â÷–ÖVçBÖ6öæf–r"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6öæf–uG—RÒ&6öçG&7F÷%÷6W'f–6R"ÒÒ&WçVW'“°¢6öç7Bæ÷&ÖÆ—¦VD6öæf–uG—RÐ¢†6öæf–uG—R2&Ö&¶WGÆ6U÷G&ç67F–öâ"Â&6öçG&7F÷%÷6W'f–6R"Â'&VÖ—VÕ÷7V'67&—F–öâ"’óð¢&6öçG&7F÷%÷6W'f–6R#°¢6öç7B6öæf–rÒv—B7F÷&vRævWE–ÖVçD6öæf–wW&F–öâ†æ÷&ÖÆ—¦VD6öæf–uG—R“°¢&W2æ§6öâ†6öæf–rÇÂ·Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær–ÖVçB6öæf–s¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6öæf–wW&F–öâ"Ò“°¢Ð¢Ò“° ¢ç÷7B‚"ö’öFÖ–â÷–ÖVçBÖ6öæf–r"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B6öæf–tFFÒ&Wæ&öG“°¢6öç7B6öæf–rÒv—B7F÷&vRæ7&VFU–ÖVçD6öæf–wW&F–öâ†6öæf–tFF“°¢&W2ç7FGW2ƒ#’æ§6öâ†6öæf–r“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær–ÖVçB6öæf–s¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR6öæf–wW&F–öâ"Ò“°¢Ð¢Ò“° ¢òòvWBW6W"w2FöæF–öç0¢ævWB‚"ö’öf÷VæFF–öâö×’ÖFöæF–öç2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7B²7FGW2ÂG—RÒÒ&WçVW'“° ¢6öç7Bf–ÇFW'2Ò°¢7FGW3¢7FGW227G&–ærÀ¢G—S¢G—R27G&–ærÀ¢Ó° ¢6öç7BFöæF–öç2Òv—B7F÷&vRævWEW6W$FöæF–öç2‡W6W$–BÂf–ÇFW'2“°¢&W2æ§6öâ†FöæF–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærW6W"FöæF–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚FöæF–öç2"Ò“°¢Ð¢Ò“° ¢òòvWBõWFFRW6W"FöæF–öâ&VfW&Væ6W0¢ævWB‚"ö’öf÷VæFF–öâ÷&VfW&Væ6W2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7B&VfW&Væ6W2Òv—B7F÷&vRævWEW6W$FöæF–öå&VfW&Væ6W2‡W6W$–B“°¢&W2æ§6öâ‡&VfW&Væ6W2ÇÂ·Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFöæF–öâ&VfW&Væ6W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&VfW&Væ6W2"Ò“°¢Ð¢Ò“° ¢çWB‚"ö’öf÷VæFF–öâ÷&VfW&Væ6W2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7B&VfW&Væ6W2Òv—B7F÷&vRçW6W'EW6W$FöæF–öå&VfW&Væ6W2‡W6W$–BÂ&Wæ&öG’“°¢&W2æ§6öâ‡&VfW&Væ6W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"WFF–ærFöæF–öâ&VfW&Væ6W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòWFFR&VfW&Væ6W2"Ò“°¢Ð¢Ò“° ¢òòvWB&V6VçBFöæF–öç2‡V&Æ–2fVVB¢ævWB‚"ö’öf÷VæFF–öâ÷&V6VçBÖFöæF–öç2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BÆ–Ö—BÒ'6T–çB‡&WçVW'’æÆ–Ö—B27G&–ær’ÇÂ#°¢6öç7BFöæF–öç2Òv—B7F÷&vRævWE&V6VçDFöæF–öç2†Æ–Ö—B“°¢&W2æ§6öâ†FöæF–öç2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær&V6VçBFöæF–öç3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚&V6VçBFöæF–öç2"Ò“°¢Ð¢Ò“° ¢òòvWBf÷VæFF–öâ–×7B&W÷'G0¢ævWB‚"ö’öf÷VæFF–öâö–×7B×&W÷'G2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6W6T–BÒÒ&WçVW'“°¢6öç7B&W÷'G2Òv—B7F÷&vRævWDf÷VæFF–öä–×7E&W÷'G2†6W6T–B27G&–ær“°¢&W2æ§6öâ‡&W÷'G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær–×7B&W÷'G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚–×7B&W÷'G2"Ò“°¢Ð¢Ò“° ¢òòV&Æ–3¢'&÷w6R7F—fRf÷VæFF–öâ6W6W0¢ævWB‚"ö’öf÷VæFF–öâö6W6W2"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6FVv÷'’Â7FFRÂ6÷'BÒÒ&WçVW'’2°¢6FVv÷'“ó¢7G&–æs°¢7FFSó¢7G&–æs°¢6÷'Có¢7G&–æs°¢Ó° ¢ÆWBv†W&T6ÆW6S¢ç’ÒW†f÷VæFF–öä6W6W2æ—47F—fRÂG'VR“° ¢–b†6FVv÷'’bb6FVv÷'’ÓÒ&ÆÂ"’°¢v†W&T6ÆW6RÒæB‡v†W&T6ÆW6RÂW†f÷VæFF–öä6W6W2æ6FVv÷'’Â6FVv÷'’’“°¢Ð ¢–b‡7FFRbb7FFRÓÒ&ÆÂ"’°¢v†W&T6ÆW6RÒæB‡v†W&T6ÆW6RÂW†6÷VçF–W2ç7FFT6öFRÂ7FFR’“°¢Ð ¢ÆWB÷&FW$'”W‡#¢ç’ÒFW62†f÷VæFF–öä6W6W2æ7&VFVDB“°¢–b‡6÷'BÓÓÒ'G&VæF–ær"’°¢÷&FW$'”W‡"ÒFW62†f÷VæFF–öä6W6W2ç&—6VDÖ÷VçB“°¢ÒVÇ6R–b‡6÷'BÓÓÒ&æWvW7B"’°¢÷&FW$'”W‡"ÒFW62†f÷VæFF–öä6W6W2æ7&VFVDB“°¢Ð ¢6öç7B&÷w2Òv—BF ¢ç6VÆV7B‡°¢–C¢f÷VæFF–öä6W6W2æ–BÀ¢æÖS¢f÷VæFF–öä6W6W2ææÖRÀ¢FW67&—F–öã¢f÷VæFF–öä6W6W2æFW67&—F–öâÀ¢6FVv÷'“¢f÷VæFF–öä6W6W2æ6FVv÷'’À¢F&vWDÖ÷VçC¢f÷VæFF–öä6W6W2çF&vWDÖ÷VçBÀ¢&—6VDÖ÷VçC¢f÷VæFF–öä6W6W2ç&—6VDÖ÷VçBÀ¢fW&–f–VDæöç&öf—C¢f÷VæFF–öä6W6W2çfW&–f–VDæöç&öf—BÀ¢–ÖvUW&Ã¢f÷VæFF–öä6W6W2æ–ÖvUW&ÂÀ¢6÷VçG”æÖS¢6÷VçF–W2ææÖRÀ¢6÷VçG•7FFT6öFS¢6÷VçF–W2ç7FFT6öFRÀ¢Ò¢æg&öÒ†f÷VæFF–öä6W6W2¢æÆVgD¦ö–â†6÷VçF–W2ÂW†f÷VæFF–öä6W6W2æ6÷VçG”–BÂ6÷VçF–W2æ–B’¢çv†W&R‡v†W&T6ÆW6R¢æ÷&FW$'’†÷&FW$'”W‡"“° ¢6öç7B6W6W2Ò&÷w2æÖ‚‡&÷r’Óâ‡°¢–C¢&÷ræ–BÀ¢F—FÆS¢&÷rææÖRÀ¢FW67&—F–öã¢&÷ræFW67&—F–öâÀ¢6FVv÷'“¢&÷ræ6FVv÷'’À¢Æö6F–öã ¢&÷ræ6÷VçG”æÖRbb&÷ræ6÷VçG•7FFT6öFP¢òG·&÷ræ6÷VçG”æÖWÒÂG·&÷ræ6÷VçG•7FFT6öFWÖ ¢¢$æF–öçv–FR"À¢6÷VçG“¢&÷ræ6÷VçG”æÖRÀ¢7FFS¢&÷ræ6÷VçG•7FFT6öFRÀ¢F&vWDÖ÷VçC¢çVÖ&W"‡&÷rçF&vWDÖ÷VçBóò’À¢7W'&VçDÖ÷VçC¢çVÖ&W"‡&÷rç&—6VDÖ÷VçBóò’À¢Föæ÷$6÷VçC¢À¢÷&væ—¦F–öäæÖS¢&÷rææÖRÀ¢÷&væ—¦F–öåfW&–f–VC¢&ööÆVâ‡&÷rçfW&–f–VDæöç&öf—B’À¢–ÖvUW&Ã¢&÷ræ–ÖvUW&ÂóòVæFVf–æVBÀ¢W&vVæ7“¢&ÖVF—VÒ"À¢fVGW&VC¢fÇ6RÀ¢Ò’“° ¢&W2æ§6öâ†6W6W2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærf÷VæFF–öâ6W6W3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6W6W2"Ò“°¢Ð¢Ò“° ¢òòf÷VæFF–öâvw&VvFR–×7B7FG2f÷"f÷VæFF–öâvP¢ævWB‚"ö’öf÷VæFF–öâö–×7B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7FG2Òv—B7F÷&vRævWDf÷VæFF–öå7FG2‚“° ¢&W2æ§6öâ‡°¢F÷FÅ&—6VC¢çVÖ&W"‡7FG3òçF÷FÅ&—6VBóò’À¢F÷FÄFöæ÷'3¢çVÖ&W"‡7FG3òçF÷FÄFöæ÷'2óò’À¢7F—fT6W6W3¢çVÖ&W"‡7FG3òæ7F—fT6W6W2óò’À¢6÷VçF–W57W÷'FVC¢çVÖ&W"‡7FG3òæ6÷VçF–W57W÷'FVBóò’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærf÷VæFF–öâ–×7B7FG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚f÷VæFF–öâ–×7B"Ò“°¢Ð¢Ò“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒÄô4Â”Õ5B5TÔÔ%’ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢òòvw&VvFVB$Æö6Â–×7B"6æ6†÷Bf÷"F†RWF†VçF–6FVBW6W"æBF†V—"&–Ö'’6÷VçG¢òòF†—2—2&VBÖöæÇ’æB6fRFòW‡÷6R–âF6†&ö&G2æBFòF†R66÷WBvVçBà¢ævWB‚"ö’öÆö6ÂÖ–×7B÷7VÖÖ'’"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7BW6W%&V6÷&BÒv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W%&V6÷&Còæ6÷VçG’ÇÂW6W%&V6÷&Còç7FFR’°¢&W2ç7FGW2ƒC’æ§6öâ‡°¢ÖW76vS¢$FB–÷W"6÷VçG’æB7FFRFòf–Wr–÷W"Æö6Â–×7Bâ"À¢Ò“°¢&WGW&ã°¢Ð ¢òò6÷VçG’fVÇB6æ6†÷B‡6†&VB6öÖ×Væ—G’gVæG2¢6öç7B6æ6†÷BÒv—B7F÷&vRævWD6÷VçG•fVÇE6æ6†÷B‡°¢6÷VçG”æÖS¢W6W%&V6÷&Bæ6÷VçG’À¢7FFT6öFS¢W6W%&V6÷&Bç7FFRÀ¢Ò“° ¢6öç7BÆö6ÅfVÇD&Ææ6RÒ6æ6†÷BçfVÇBòçVÖ&W"‡6æ6†÷BçfVÇBæ7W'&VçD&Ææ6Róò’¢° ¢òòfVÇB6öçG&–'WF–öç3 ¢òòÒF—&V7C¢–÷WG2×Fò×fVÇBg&öÒF†R7W'&VçBW6W"w26öÖ×Væ—G’'V–ÆFW"6öçG&–'WF–öç2†ç’6÷VçG’fVÇB’à¢òòÒæWGv÷&³¢–÷WG2×Fò×fVÇBg&öÒ'V–ÆFW'2F†W’&VfW'&VB†ç’6÷VçG’fVÇB’à¢òòÒF÷FÂFò†öÖR6÷VçG’fVÇC¢F—&V7B²æWGv÷&²6öç7G&–æVBFòF†RW6W"w2†öÖR6÷VçG’fVÇBà¢ÆWBW6W$F—&V7D6öçG&–'WF–öâÒ°¢ÆWBW6W$–æF—&V7D6öçG&–'WF–öâÒ°¢ÆWBW6W%F÷FÄ6öçG&–'WF–öåFô6÷VçG•fVÇBÒ°¢G'’°¢6öç7B'V–ÆFW%&öf–ÆRÒv—B7F÷&vRævWD'V–ÆFW%&öf–ÆR‡W6W$–B“°¢–b†'V–ÆFW%&öf–ÆR’°¢6öç7B7VÔF—&V7EfVÇE–÷WG2Ò7–æ2‡&×3ó¢°¢6÷VçG”–Có¢7G&–ærÂçVÆÃ°¢Ò“¢&öÖ—6SÆçVÖ&W#âÓâ°¢6öç7B6÷VçG”–BÒ&×3òæ6÷VçG”–BóòçVÆÃ°¢6öç7B·&÷uÒÒv—BF ¢ç6VÆV7B‡°¢F÷FÃ¢7ÃÇ7G&–æsæ ¢6öÆW66R€¢7VÒ†6öÆW66R‚G¶'V–ÆFW$6öçG&–'WF–öç2ç–D÷WDÖ÷VçGÒÂG¶'V–ÆFW$6öçG&–'WF–öç2æ7GVÅfÇVWÒÂ’’À¢ ¢¢À¢Ò¢æg&öÒ†'V–ÆFW$6öçG&–'WF–öç2¢çv†W&R€¢æB€¢W†'V–ÆFW$6öçG&–'WF–öç2æ'V–ÆFW$–BÂ'V–ÆFW%&öf–ÆRæ–B’À¢W†'V–ÆFW$6öçG&–'WF–öç2æ—5–D÷WBÂG'VR’À¢W†'V–ÆFW$6öçG&–'WF–öç2ç–D÷WEFõfVÇBÂG'VR’À¢6÷VçG”–BòW†'V–ÆFW$6öçG&–'WF–öç2æ6÷VçG”–BÂ6÷VçG”–B’¢7ÆG'VV ¢¢“° ¢&WGW&âçVÖ&W"‡&÷sòçF÷FÂóò’ÇÂ°¢Ó° ¢6öç7B7VÔæWGv÷&µfVÇE–÷WG2Ò7–æ2‡&×3ó¢°¢6÷VçG”–Có¢7G&–ærÂçVÆÃ°¢Ò“¢&öÖ—6SÆçVÖ&W#âÓâ°¢6öç7B6÷VçG”–BÒ&×3òæ6÷VçG”–BóòçVÆÃ°¢6öç7B·&÷uÒÒv—BF ¢ç6VÆV7B‡°¢F÷FÃ¢7ÃÇ7G&–æsæ ¢6öÆW66R€¢7VÒ†6öÆW66R‚G¶'V–ÆFW$6öçG&–'WF–öç2ç–D÷WDÖ÷VçGÒÂG¶'V–ÆFW$6öçG&–'WF–öç2æ7GVÅfÇVWÒÂ’’À¢ ¢¢À¢Ò¢æg&öÒ†'V–ÆFW$6öçG&–'WF–öç2¢æ–ææW$¦ö–â€¢'V–ÆFW%&VfW'&Ç2À¢W†'V–ÆFW%&VfW'&Ç2ç&VfW'&VD'V–ÆFW$–BÂ'V–ÆFW$6öçG&–'WF–öç2æ'V–ÆFW$–B¢¢çv†W&R€¢æB€¢W†'V–ÆFW%&VfW'&Ç2ç&VfW'&W$–BÂ'V–ÆFW%&öf–ÆRæ–B’À¢W†'V–ÆFW$6öçG&–'WF–öç2æ—5–D÷WBÂG'VR’À¢W†'V–ÆFW$6öçG&–'WF–öç2ç–D÷WEFõfVÇBÂG'VR’À¢6÷VçG”–BòW†'V–ÆFW$6öçG&–'WF–öç2æ6÷VçG”–BÂ6÷VçG”–B’¢7ÆG'VV ¢¢“° ¢&WGW&âçVÖ&W"‡&÷sòçF÷FÂóò’ÇÂ°¢Ó° ¢òòF—&V7BFòç’6÷VçG’fVÇ@¢W6W$F—&V7D6öçG&–'WF–öâÒv—B7VÔF—&V7EfVÇE–÷WG2‚“° ¢òòæWGv÷&³¢Ö†÷&VfW'&VB'V–ÆFW'2Fòç’6÷VçG’fVÇ@¢W6W$–æF—&V7D6öçG&–'WF–öâÒv—B7VÔæWGv÷&µfVÇE–÷WG2‚“° ¢òòF÷FÂF—&V7B¶æWGv÷&²FòF†RW6W"w2†öÖR6÷VçG’fVÇB†–b&W6öÇf&ÆR¢6öç7B†öÖT6÷VçG”–BÒ6æ6†÷Bæ6÷VçG“òæ–BóòçVÆÃ°¢–b††öÖT6÷VçG”–B’°¢6öç7BF—&V7EFô†öÖRÒv—B7VÔF—&V7EfVÇE–÷WG2‡²6÷VçG”–C¢†öÖT6÷VçG”–BÒ“°¢6öç7BæWGv÷&µFô†öÖRÒv—B7VÔæWGv÷&µfVÇE–÷WG2‡²6÷VçG”–C¢†öÖT6÷VçG”–BÒ“°¢W6W%F÷FÄ6öçG&–'WF–öåFô6÷VçG•fVÇBÒF—&V7EFô†öÖR²æWGv÷&µFô†öÖS°¢Ð¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%¶Æö6ÂÖ–×7EÒf–ÆVBFò6ö×WFRfVÇB6öçG&–'WF–öâÖWG&–72"ÂW'"“°¢Ð ¢òòff–Æ–FRV&æ–æw2böæ&ö&FVB6÷VçC¢FW&—fVBg&öÒF†Rff–Æ–FR&öw&ÒÂ–bç’à¢ÆWBff–Æ–FTV&æ–æw2Ò°¢ÆWBff–Æ–FW4öæ&ö&FVD6÷VçBÒ°¢G'’°¢6öç7B&öw&ÒÒv—B7F÷&vRævWDff–Æ–FU&öw&Ò‡W6W$–B“°¢–b‡&öw&Ò’°¢6öç7B7FG2Òv—B7F÷&vRævWDff–Æ–FU7FG2‡&öw&Òæ–B“°¢ff–Æ–FTV&æ–æw2ÒçVÖ&W"‡7FG2çF÷FÄ6öÖÖ—76–öäV&æVBóò“°¢ff–Æ–FW4öæ&ö&FVD6÷VçBÒ7FG2çF÷FÅ&VfW'&Ç2óò°¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%¶Æö6ÂÖ–×7EÒf–ÆVBFòÆöBff–Æ–FR7FG2"ÂW'"“°¢Ð ¢&W2æ§6öâ‡°¢Æö6ÅfVÇD&Ææ6RÀ¢W6W$F—&V7D6öçG&–'WF–öâÀ¢W6W$–æF—&V7D6öçG&–'WF–öâÀ¢W6W%F÷FÄ6öçG&–'WF–öåFô6÷VçG•fVÇBÀ¢ff–Æ–FTV&æ–æw2À¢ff–Æ–FW4öæ&ö&FVD6÷VçBÀ¢6÷VçG”–C¢6æ6†÷Bæ6÷VçG“òæ–BóòçVÆÂÀ¢6÷VçG”æÖS¢6æ6†÷Bæ6÷VçG“òææÖRóòW6W%&V6÷&Bæ6÷VçG’óòçVÆÂÀ¢7FFT6öFS¢6æ6†÷Bæ6÷VçG“òç7FFT6öFRóòW6W%&V6÷&Bç7FFRóòçVÆÂÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærÆö6Â–×7B7VÖÖ'“¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöBÆö6Â–×7B7VÖÖ'’"Ò“°¢Ð¢Ò“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ4ôåDU…ETÂtu$TtDU2…5DD”2ÄäuTtR5Uõ%B’ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢òò&VBÖöæÇ’vw&VvFRVæGö–çB&6¶–ær6öçFW‡BÖv&R'WBæöâÖ7&VW’7FF–2ÆæwVvRà¢òòF†—2–çFVçF–öæÆÇ’W‡÷6W2öæÇ’w&÷WÖÆWfVÂ6÷VçG2F†B6â&R&6¶VB'’&VÂVW&–W2à¢òò–bÆö6Æ—G’—2Ö—76–ær÷"6÷VçG2&R¦W&òÂ6ÆÆW'26†÷VÆBfÆÂ&6²FòæWWG&Â6÷’à¢ævWB‚"ö’övw&VvFW2ö6öçFW‡B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B7FFT6öFRÒG—Vöb&WçVW'’ç7FFT6öFRÓÓÒ'7G&–ær"ò&WçVW'’ç7FFT6öFR¢VæFVf–æVC°¢6öç7B6÷VçG”f—2Ð¢G—Vöb&WçVW'’æ6÷VçG”f—2ÓÓÒ'7G&–ær"ò&WçVW'’æ6÷VçG”f—2¢VæFVf–æVC°¢6öç7BF–ÖVg&ÖRÒG—Vöb&WçVW'’çF–ÖVg&ÖRÓÓÒ'7G&–ær"ò&WçVW'’çF–ÖVg&ÖR¢VæFVf–æVC° ¢òòf÷"æ÷rvR7W÷'B6–ævÆR–çFW&W7B6VvÖVçB&W&W6VçF–ærWFò×&VÆFVB&÷f–FW'2à¢6öç7B–çFW&W7G3¢7G&–æuµÒÒ²&WFõöFVÆW'2%Ó° ¢òò–bvR†fRæòÆö6Æ—G’†–çG2BÆÂÂ&WGW&âæWWG&ÂÂFFÖV×G’–ÆöBà¢–b‚7FFT6öFRbb6÷VçG”f—2’°¢&W2æ§6öâ‡°¢Æö6F–öã¢çVÆÂÀ¢–çFW&W7G2À¢7F—f—G“¢°¢WFõöFVÆW'3¢°¢Æ7EóuöF—3¢çVÆÂÀ¢Æ7Eó3öF—3¢çVÆÂÀ¢ÒÀ¢ÒÀ¢4öc¢æWrFFR‚’çFô•4õ7G&–ær‚’ç6Æ–6RƒÂ’À¢Ò“°¢&WGW&ã°¢Ð ¢6öç7Bæ÷rÒæWrFFR‚“°¢6öç7Bg&öÓrÒæWrFFR†æ÷r“°¢g&öÓrç6WDFFR†g&öÓrævWDFFR‚’Òr“°¢6öç7Bg&öÓ3ÒæWrFFR†æ÷r“°¢g&öÓ3ç6WDFFR†g&öÓ3ævWDFFR‚’Ò3“° ¢6öç7B&öÆTf–ÇFW"Ò–ä'&’‡W6W'2ç&öÆRÂ²&6%öFVÆW""Â&WFõ÷6W'f–6R%Ò“°¢6öç7BÆö6Æ—G”f–ÇFW'3¢ç•µÒÒ·&öÆTf–ÇFW%Ó° ¢–b‡7FFT6öFR’°¢Æö6Æ—G”f–ÇFW'2çW6‚†W‡W6W'2ç7FFT6öFRÂ7FFT6öFR’“°¢Ð¢–b†6÷VçG”f—2’°¢Æö6Æ—G”f–ÇFW'2çW6‚†W‡W6W'2æ6÷VçG”f—2Â6÷VçG”f—2’“°¢Ð ¢6öç7B&6Uv†W&RÒæB‚ââæÆö6Æ—G”f–ÇFW'2“° ¢6öç7B·&÷w3rÂ&÷w33ÒÒv—B&öÖ—6RæÆÂ…°¢F ¢ç6VÆV7B‡²6÷VçC¢7ÃÆçVÖ&W#æ4õTåB‚¢–Ò¢æg&öÒ‡W6W'2¢çv†W&R†æB†&6Uv†W&RÂwFR‡W6W'2æ7&VFVDBÂg&öÓr’’’À¢F ¢ç6VÆV7B‡²6÷VçC¢7ÃÆçVÖ&W#æ4õTåB‚¢–Ò¢æg&öÒ‡W6W'2¢çv†W&R†æB†&6Uv†W&RÂwFR‡W6W'2æ7&VFVDBÂg&öÓ3’’’À¢Ò“° ¢6öç7B6÷VçCrÒ&÷w3u³Óòæ6÷VçBóò°¢6öç7B6÷VçC3Ò&÷w33³Óòæ6÷VçBóò° ¢òòÆöö²W‡VÖâÖg&–VæFÇ’6÷VçG’Æ&VÂv†VâvR†fRd•26öFS²÷F†W'v—6RfÆÂ&6²Fò7FFRÖöæÇ’à¢ÆWBÆö6F–öã¢²6—G“¢7G&–ærÂçVÆÃ²7FFS¢7G&–ærÂçVÆÃ²6÷VçG“¢7G&–ærÂçVÆÂÒÂçVÆÂÐ¢çVÆÃ°¢–b†6÷VçG”f—2’°¢G'’°¢6öç7B6÷VçG’Òv—B7F÷&vRævWD6÷VçG”'”f—2†6÷VçG”f—2“°¢–b†6÷VçG’’°¢Æö6F–öâÒ°¢6—G“¢çVÆÂÀ¢7FFS¢6÷VçG’ç7FFT6öFRÀ¢6÷VçG“¢6÷VçG’ææÖRÀ¢Ó°¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%¶vw&VvFW3¦6öçFW‡EÒf–ÆVBFò&W6öÇfR6÷VçG’'’d•2"ÂW'"“°¢Ð¢Ð ¢–b‚Æö6F–öâbb7FFT6öFR’°¢Æö6F–öâÒ°¢6—G“¢çVÆÂÀ¢7FFS¢7FFT6öFRÀ¢6÷VçG“¢çVÆÂÀ¢Ó°¢Ð ¢6öç7B–ÆöBÒ°¢Æö6F–öâÀ¢–çFW&W7G2À¢7F—f—G“¢°¢WFõöFVÆW'3¢°¢Æ7EóuöF—3¢6÷VçCrâòçVÖ&W"†6÷VçCr’¢çVÆÂÀ¢Æ7Eó3öF—3¢6÷VçC3âòçVÖ&W"†6÷VçC3’¢çVÆÂÀ¢ÒÀ¢ÒÀ¢4öc¢æ÷rçFô•4õ7G&–ær‚’ç6Æ–6RƒÂ’À¢Ò26öç7C° ¢òòÆ–v‡Bö'6W'f&–Æ—G“¢WfVçBÖÆWfVÂÆövv–ærv—F‚æòW6W"–FVçF–f–W'2à¢6öç7B66÷S¢'7FFR"Â&6÷VçG’"Ò6÷VçG”f—2ò&6÷VçG’"¢'7FFR#°¢6öç7BVffV7F—fUF–ÖVg&ÖRÒF–ÖVg&ÖRÓÓÒ#3B"ò#3B"¢#vB#°¢6öç7B6W&–W4f÷%v–æF÷rÐ¢VffV7F—fUF–ÖVg&ÖRÓÓÒ#vB ¢ò–ÆöBæ7F—f—G’æWFõöFVÆW'2æÆ7EóuöF—0¢¢–ÆöBæ7F—f—G’æWFõöFVÆW'2æÆ7Eó3öF—3° ¢6öç7B†4FFÒ6W&–W4f÷%v–æF÷rÓÒçVÆÃ° ¢G'’°¢v—B7F÷&vRæÆötWfVçB‚&vw&VvFW2æ6öçFW‡Bç&WVW7FVB"Â°¢66÷RÀ¢–çFW&W7C¢&WFõöFVÆW'2"À¢F–ÖVg&ÖS¢VffV7F—fUF–ÖVg&ÖRÀ¢†4FFÀ¢4öc¢–ÆöBæ4öbÀ¢òòW‡Æ–6—FÇ’öÖ—Bç’W6W"Ö–FVçF–g––ærf–VÆG0¢—FG&W73¢çVÆÂÀ¢W6W$vVçC¢çVÆÂÀ¢W6W$–C¢çVÆÂÀ¢6öçG&7F÷$–C¢çVÆÂÀ¢Ò“°¢Ò6F6‚†W'"’°¢6öç6öÆRçv&â‚%¶vw&VvFW3¦6öçFW‡EÒf–ÆVBFòÆörö'6W'f&–Æ—G’WfVçB"ÂW'"“°¢Ð ¢&W2æ§6öâ‡–ÆöB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚%¶vw&VvFW3¦6öçFW‡EÒf–ÆVBFò6ö×WFR6öçFW‡GVÂvw&VvFW2"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6öçFW‡GVÂvw&VvFW2"Ò“°¢Ð¢Ò“° ¢òò6÷VçG’fVÇB&Ææ6W2†6öÖ×Væ—G’&V–çfW7FÖVçB¢ævWB‚"ö’÷fVÇG2ö×’Ö6÷VçG’"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢6öç7BW6W%&V6÷&BÒv—B7F÷&vRævWEW6W"‡W6W$–B“° ¢–b‚W6W%&V6÷&Còæ6÷VçG’ÇÂW6W%&V6÷&Còç7FFR’°¢&WGW&â&W0¢ç7FGW2ƒC¢æ§6öâ‡²ÖW76vS¢$FB–÷W"6÷VçG’æB7FFRFòf–Wr–÷W"6öÖ×Væ—G’fVÇB&Ææ6Râ"Ò“°¢Ð ¢6öç7B6æ6†÷BÒv—B7F÷&vRævWD6÷VçG•fVÇE6æ6†÷B‡°¢6÷VçG”æÖS¢W6W%&V6÷&Bæ6÷VçG’À¢7FFT6öFS¢W6W%&V6÷&Bç7FFRÀ¢Ò“° ¢&W2æ§6öâ‡°¢6÷VçG“¢6æ6†÷Bæ6÷VçG’À¢fVÇC¢6æ6†÷BçfVÇ@¢ò°¢ââç6æ6†÷BçfVÇBÀ¢7W'&VçD&Ææ6S¢çVÖ&W"‡6æ6†÷BçfVÇBæ7W'&VçD&Ææ6Róò’À¢Æ–fWF–ÖT–æfÆ÷s¢çVÖ&W"‡6æ6†÷BçfVÇBæÆ–fWF–ÖT–æfÆ÷róò’À¢Æ–fWF–ÖT÷WFfÆ÷s¢çVÖ&W"‡6æ6†÷BçfVÇBæÆ–fWF–ÖT÷WFfÆ÷róò’À¢Ð¢¢çVÆÂÀ¢Æ7C3D–æfÆ÷s¢6æ6†÷BæÆ7C3D–æfÆ÷rÀ¢6÷W&6W4'&V¶F÷vã¢6æ6†÷Bç6÷W&6W4'&V¶F÷vâÀ¢ÆVFvW#¢6æ6†÷BæÆVFvW"æÖ‚†VçG'’’Óâ‡°¢ââæVçG'’À¢Ö÷VçC¢çVÖ&W"†VçG'’æÖ÷VçBóò’À¢Ò’’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6÷VçG’fVÇC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöBfVÇB&Ææ6R"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’÷fVÇG2ö6÷VçG’ó¦6÷VçG”–B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7B²6÷VçG”–BÒÒ&Wç&×3°¢6öç7B6æ6†÷BÒv—B7F÷&vRævWD6÷VçG•fVÇE6æ6†÷B‡²6÷VçG”–BÒ“° ¢&W2æ§6öâ‡°¢6÷VçG“¢6æ6†÷Bæ6÷VçG’À¢fVÇC¢6æ6†÷BçfVÇ@¢ò°¢ââç6æ6†÷BçfVÇBÀ¢7W'&VçD&Ææ6S¢çVÖ&W"‡6æ6†÷BçfVÇBæ7W'&VçD&Ææ6Róò’À¢Æ–fWF–ÖT–æfÆ÷s¢çVÖ&W"‡6æ6†÷BçfVÇBæÆ–fWF–ÖT–æfÆ÷róò’À¢Æ–fWF–ÖT÷WFfÆ÷s¢çVÖ&W"‡6æ6†÷BçfVÇBæÆ–fWF–ÖT÷WFfÆ÷róò’À¢Ð¢¢çVÆÂÀ¢Æ7C3D–æfÆ÷s¢6æ6†÷BæÆ7C3D–æfÆ÷rÀ¢6÷W&6W4'&V¶F÷vã¢6æ6†÷Bç6÷W&6W4'&V¶F÷vâÀ¢ÆVFvW#¢6æ6†÷BæÆVFvW"æÖ‚†VçG'’’Óâ‡°¢ââæVçG'’À¢Ö÷VçC¢çVÖ&W"†VçG'’æÖ÷VçBóò’À¢Ò’’À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6÷VçG’fVÇB'’–C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöBfVÇB&Ææ6R"Ò“°¢Ð¢Ò“° ¢òòFÖ–ã¢7&VFRf÷VæFF–öâ6W6P¢ç÷7B€¢"ö’öFÖ–âöf÷VæFF–öâö6W6W2"À¢—4WF†VçF–6FVBÀ¢&WV—&U&öÆR…²&÷5öFÖ–â"Â'7WW%öFÖ–â%Ò’À¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7B°¢æÖRÀ¢FW67&—F–öâÀ¢6FVv÷'’À¢6÷VçG”–BÀ¢F&vWDÖ÷VçBÀ¢–ÖvUW&ÂÀ¢vV'6—FUW&ÂÀ¢6öçF7DVÖ–ÂÀ¢F„–BÀ¢ÒÒ&Wæ&öG’ÇÂ·Ó° ¢–b‚æÖRÇÂFW67&—F–öâÇÂ6FVv÷'’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$Ö—76–ær&WV—&VBf–VÆG2"Ò“°¢Ð ¢6öç7BW6W%&÷w2Òv—BF"ç6VÆV7B‚’æg&öÒ‡W6W'2’çv†W&R†W‡W6W'2æ–BÂW6W$–B’’æÆ–Ö—Bƒ“° ¢6öç7BW6W"ÒW6W%&÷w5³Ó°¢–b‚W6W"’°¢&WGW&â&W0¢ç7FGW2ƒC2¢æ§6öâ‡²ÖW76vS¢$öæÇ’÷2÷7WW"FÖ–ç26â7&VFRf÷VæFF–öâ6W6W2"Ò“°¢Ð ¢6öç7B–ç6W'FVBÒv—BF ¢æ–ç6W'B†f÷VæFF–öä6W6W2¢çfÇVW2‡°¢æÖRÀ¢FW67&—F–öâÀ¢6FVv÷'’À¢6÷VçG”–BÀ¢F&vWDÖ÷VçBÀ¢–ÖvUW&ÂÀ¢vV'6—FUW&ÂÀ¢6öçF7DVÖ–ÂÀ¢F„–BÀ¢7&VFVD'“¢W6W$–BÀ¢—47F—fS¢G'VRÀ¢Ò2ç’¢ç&WGW&æ–ær‚“° ¢&W2ç7FGW2ƒ#’æ§6öâ†–ç6W'FVCòå³ÒóòçVÆÂ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ærf÷VæFF–öâ6W6S¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFRf÷VæFF–öâ6W6R"Ò“°¢Ð¢Ð¢“° ¢ç÷7B‚"ö’÷W6W"ö66÷VçBÖFVÆWF–öâ×&WVW7B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B&WVW7BÒv—BFFÖævVÖVçE6W'f–6Ræ7&VFTFF&WVW7B‡°¢W6W$–C¢W6W#òæ–BÀ¢&WVW7EG—S¢&66÷VçEö6Æ÷7W&R"À¢&V6öã¢&Wæ&öG’ç&V6öâÀ¢&WVW7FVD'“¢W6W#òæ–BÀ¢Ò“° ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢W6W$–C¢W6W#òæ–BÀ¢66W76÷$–C¢W6W#òæ–BÀ¢66W76÷%&öÆS¢W6W"ç&öÆRÀ¢7F–öåG—S¢&FVÆWFR"À¢&W6÷W&6UG—S¢'&öf–ÆR"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢ÖWFFF¢²&WVW7D–C¢&WVW7Bæ–BÒÀ¢Ò“° ¢&W2æ§6öâ‡°¢ÖW76vS¢$66÷VçBFVÆWF–öâ&WVW7B7&VFVBâF†—2&WV—&W2FÖ–â&÷fÂâ"À¢&WVW7D–C¢&WVW7Bæ–BÀ¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær66÷VçBFVÆWF–öâ&WVW7C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR66÷VçBFVÆWF–öâ&WVW7B"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’÷W6W"öFFÖW‡÷'B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7BW6W$–BÒW6W#òæ–BÇÂW6W#òæ6Æ–×3òç7V#° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%VæWF†÷&—¦VB"Ò“°¢Ð ¢6öç7B&WVW7BÒv—BFFÖævVÖVçE6W'f–6Ræ7&VFTFF&WVW7B‡°¢W6W$–BÀ¢&WVW7EG—S¢&FFöW‡÷'B"À¢&WVW7FVD'“¢W6W$–BÀ¢Ò“° ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢W6W$–BÀ¢66W76÷$–C¢W6W$–BÀ¢66W76÷%&öÆS¢W6W#òç&öÆRÇÂ'W6W""À¢7F–öåG—S¢&W‡÷'B"À¢&W6÷W&6UG—S¢'&öf–ÆR"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢ÖWFFF¢²&WVW7D–C¢&WVW7Bæ–BÒÀ¢Ò“° ¢6öç7BW‡÷'DFFÒv—BFFÖævVÖVçE6W'f–6RæW‡÷'EW6W$FF‡W6W$–B“°¢6öç7B¦—'VffW"Òv—BFFÖævVÖVçE6W'f–6Ræ7&VFTFFW‡÷'Df–ÆR†W‡÷'DFF“° ¢&W2ç6WD†VFW"‚$6öçFVçBÕG—R"Â&Æ–6F–öâ÷¦—"“°¢&W2ç6WD†VFW"€¢$6öçFVçBÔF—7÷6—F–öâ"À¢GF6†ÖVçC²f–ÆVæÖSÒ'G&FW66÷WBÖFFÖW‡÷'BÒG·W6W$–GÒç¦—& ¢“°¢&W2ç6VæB‡¦—'VffW"“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"W‡÷'F–ærW6W"FF¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòW‡÷'BW6W"FF"Ò“°¢Ð¢Ò“° ¢òòFÖ–âFFÖævVÖVçB&÷WFW0¢ævWB‚"ö’öFÖ–âöFF×&WVW7G2"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²7FGW2ÒÒ&WçVW'“° ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢66W76÷$–C¢W6W#òæ–BÀ¢66W76÷%&öÆS¢W6W"ç&öÆRÀ¢7F–öåG—S¢'f–Wr"À¢&W6÷W&6UG—S¢&æÇ—F–72"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢Ò“° ¢6öç7B&WVW7G2Òv—BFFÖævVÖVçE6W'f–6RævWDÆÄFF&WVW7G2‡7FGW227G&–ær“°¢&W2æ§6öâ‡&WVW7G2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærFF&WVW7G3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚FF&WVW7G2"Ò“°¢Ð¢Ò“° ¢ç÷7B€¢"ö’öFÖ–â÷&ö6W72ÖFFÖW‡÷'Bó¦–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢6öç7B&WVW7G2Òv—BFFÖævVÖVçE6W'f–6RævWDÆÄFF&WVW7G2‚“°¢6öç7B&WVW7BÒ&WVW7G2æf–æB‚‡#¢ç’’Óâ"æ–BÓÓÒ–B“° ¢–b‚&WVW7BÇÂ&WVW7Bç&WVW7EG—RÓÒ&FFöW‡÷'B"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$FFW‡÷'B&WVW7Bæ÷Bf÷VæB"Ò“°¢Ð ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢W6W$–C¢&WVW7BçW6W$–BÀ¢66W76÷$–C¢W6W#òæ–BÀ¢66W76÷%&öÆS¢W6W"ç&öÆRÀ¢7F–öåG—S¢&W‡÷'B"À¢&W6÷W&6UG—S¢'&öf–ÆR"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢ÖWFFF¢²FÖ–å&ö6W76VC¢G'VRÂ&WVW7D–C¢–BÒÀ¢Ò“° ¢6öç7BW‡÷'DFFÒv—BFFÖævVÖVçE6W'f–6RæW‡÷'EW6W$FF‡&WVW7BçW6W$–B“°¢6öç7B¦—'VffW"Òv—BFFÖævVÖVçE6W'f–6Ræ7&VFTFFW‡÷'Df–ÆR†W‡÷'DFF“° ¢&W2ç6WD†VFW"‚$6öçFVçBÕG—R"Â&Æ–6F–öâ÷¦—"“°¢&W2ç6WD†VFW"€¢$6öçFVçBÔF—7÷6—F–öâ"À¢GF6†ÖVçC²f–ÆVæÖSÒ'G&FW66÷WBÖFFÖW‡÷'BÒG·&WVW7BçW6W$–GÒç¦—& ¢“°¢&W2ç6VæB‡¦—'VffW"“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&ö6W76–ærFFW‡÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&ö6W72FFW‡÷'B"Ò“°¢Ð¢Ð¢“° ¢ç÷7B€¢"ö’öFÖ–âö&÷fRÖ66÷VçBÖFVÆWF–öâó¦–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²–BÒÒ&Wç&×3° ¢6öç7B&WVW7G2Òv—BFFÖævVÖVçE6W'f–6RævWDÆÄFF&WVW7G2‚“°¢6öç7B&WVW7BÒ&WVW7G2æf–æB‚‡#¢ç’’Óâ"æ–BÓÓÒ–B“° ¢–b‚&WVW7BÇÂ&WVW7Bç&WVW7EG—RÓÒ&66÷VçEö6Æ÷7W&R"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$66÷VçBFVÆWF–öâ&WVW7Bæ÷Bf÷VæB"Ò“°¢Ð ¢v—BFFÖævVÖVçE6W'f–6RæFVÆWFUW6W$FF‡&WVW7BçW6W$–BÂW6W#òæ–B“° ¢&W2æ§6öâ‡²ÖW76vS¢$66÷VçB7V66W76gVÆÇ’FVÆWFVB"Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&ö6W76–ær66÷VçBFVÆWF–öã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&ö6W7266÷VçBFVÆWF–öâ"Ò“°¢Ð¢Ð¢“° ¢ævWB‚"ö’öFÖ–â÷6V7W&—G’Ö–æ6–FVçG2"Â—4WF†VçF–6FVBÂ—4FÖ–âÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²7FGW2ÒÒ&WçVW'“° ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢66W76÷$–C¢W6W#òæ–BÀ¢66W76÷%&öÆS¢W6W"ç&öÆRÀ¢7F–öåG—S¢'f–Wr"À¢&W6÷W&6UG—S¢&æÇ—F–72"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢Ò“° ¢6öç7B–æ6–FVçG2Òv—BFFÖævVÖVçE6W'f–6RævWE6V7W&—G”–æ6–FVçG2‡7FGW227G&–ær“°¢&W2æ§6öâ†–æ6–FVçG2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6V7W&—G’–æ6–FVçG3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6V7W&—G’–æ6–FVçG2"Ò“°¢Ð¢Ò“° ¢ævWB€¢"ö’öFÖ–â÷W6W"Ö66W72ÖÆöw2ó§W6W$–B"À¢—4WF†VçF–6FVBÀ¢—4FÖ–âÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W"Ò&WçW6W"2ç“°¢6öç7B²W6W$–BÒÒ&Wç&×3°¢6öç7B²Æ–Ö—BÒÒÒ&WçVW'“° ¢v—BFFÖævVÖVçE6W'f–6RæÆötFF66W72‡°¢W6W$–C¢W6W$–BÀ¢66W76÷$–C¢W6W#òæ–BÀ¢66W76÷%&öÆS¢W6W"ç&öÆRÀ¢7F–öåG—S¢'f–Wr"À¢&W6÷W&6UG—S¢&æÇ—F–72"À¢—FG&W73¢&Wæ—À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢Ò“° ¢6öç7BÆöw2Òv—BFFÖævVÖVçE6W'f–6RævWEW6W$66W74Æöw2€¢W6W$–BÀ¢'6T–çB†Æ–Ö—B27G&–ær¢“°¢&W2æ§6öâ†Æöw2“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærW6W"66W72Æöw3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚66W72Æöw2"Ò“°¢Ð¢Ð¢“° ¢òòFWf–6RÖævVÖVçBVæGö–çG2f÷"Ö7FW"FÖ–âÒFV×÷&&–Ç’&VÖ÷fVBf÷"FV'Vvv–æp ¢òò&Vv—7FW"6ö6–ÂÖVF–&÷WFW0¢&Vv—7FW%6ö6–Å&÷WFW2†“° ¢òò&Vv—7FW"6ö6–ÂfVGW&W2‡6V&6‚Âg&–VæG2ÂÖW76v–ær¢&Vv—7FW%6ö6–ÄfVGW&W2†“° ¢òò&Vv—7FW"66÷WB&V6öÖÖVæFF–öç2„C#¢6öæf–FVæ6RÖ&6VB6öçF7B&V6öÖÖVæFF–öç2¢&Vv—7FW%66÷WE&V6öÖÖVæFF–öç2†“° ¢òòfÆÆ&6²f÷"ÆVv7’6Æ–VçBG&VæF–ærVæGö–ç@¢6öç7BG&VæF–æt†æFÆW#¢W‡&W74†æFÆW"Ò…÷&WÂ&W2’Óâ°¢&W2æ§6öâ‡²—FV×3¢µÒÂÖW76vS¢%G&VæF–ærFFæ÷Bf–Æ&ÆR–WBâ"Ò“°¢Ó° ¢ævWB‚"ö’÷G&VæF–ær"ÂG&VæF–æt†æFÆW"“° ¢òò6WBW6öÖ×Væ—G’ÖöFW&F–öâ&÷WFW0¢6WGWÖöFW&F–öå&÷WFW2†“°¢6WGWFÖ–äÖöFW&F–öå&÷WFW2†“° ¢òò6WGWT’Ööæ—F÷&–ær&÷WFW0¢&Vv—7FW%T”—77VW5&÷WFW2†“° ¢òò&Vv—7FW"’6öFRf—†–ær&÷WFW0¢&Vv—7FW$”6öFTf—…&÷WFW2†“° ¢òò&Vv—7FW"5$Ò&÷WFW0¢&Vv—7FW$7&Õ&÷WFW2†“° ¢òò&Vv—7FW"66÷WDf—GFW'2†ÖW&6‚òÖ&¶WF–ærFööÇ2¢&Vv—7FW%66÷WDf—GFW'5&÷WFW2†“° ¢òò&Vv—7FW"æ÷F–f–6F–öâ&÷WFW0¢&Vv—7FW$æ÷F–f–6F–öå&÷WFW2†“°¢&Vv—7FW%&ö7W&VÖVçE&÷WFW2†“°¢&Vv—7FW$F—&V7D6öææV7E&÷WFW2†“°¢&Vv—7FW$V×Æ÷–ÖVçE&÷WFW2†“°¢&Vv—7FW$–FVçF—G•fW&–f–6F–öå&÷WFW2†“°¢&Vv—7FW$ö&¦V7F—fW5&÷WFW2†“° ¢òò&Vv—7FW"æÇ—F–72&÷WFW0¢&Vv—7FW$æÇ—F–75&÷WFW2†“° ¢òò&Vv—7FW"&V6öÖÖVæFF–öâvVæW&F÷"&÷WFW0¢&Vv—7FW%&V6öÖÖVæFF–öävVæW&F÷%&÷WFW2†“° ¢òò&Vv—7FW"'W6–æW72&öf–ÆR&÷WFW2…„4R6BÔ3¢V&Æ—6†VB&W6Væ6R¢&Vv—7FW$'W6–æW75&öf–ÆU&÷WFW2†“°¢&Vv—7FW$'W6–æW746öçF7E&÷WFW2†“°¢&Vv—7FW%G&FU'FæW$W‡&W75&÷WFW2†“°¢&Vv—7FW$§u7FöæU6fVE7FöæW4VÖ–Å&÷WFW2†“°¢&Vv—7FW%7FöæT–çfVçF÷'•&÷WFW2†“°¢&Vv—7FW$&–E&ö6µ&÷WFW2†“°¢&Vv—7FW$'W6–æW746Æ–Õ&÷WFW2†“°¢&Vv—7FW$FÖ–ä'W6–æW746÷VçG”Vç&–6†ÖVçE&÷WFW2†“°¢&Vv—7FW$6öçG&7F÷%&öÖõ&÷WFW2†“° ¢òò&Vv—7FW"'W6–æW72&öf–ÆR&÷WFW0¢çW6R†'W6–æW74F—&V7F÷'•V&Æ–5&÷WFW"“°¢çW6R†6—G•V&Æ–5&÷WFW"“°¢çW6R†FF6WG5V&Æ–5&÷WFW"“°¢çW6R†'W6–æW76W5&÷WFW"“° ¢òò&Vv—7FW"&öf–ÆRvV'6—FR&÷WFW0¢çW6R‡&öf–ÆW5&÷WFW"“° ¢òò&÷W'G’Æ–fV7–6ÆRõ2&÷WFW2„'V–ÆBòW†—7F–æròWw&FW2òÖ–çF–âò6VÆÂ¢çW6R‡&÷W'G•&öw&×5&÷WFW"“° ¢òò66÷VçBÖöæÇ’†öÖRfVÇB&÷WFW2‚$6&f‚f÷"–÷W"†öÖR"¢çW6R††öÖW5&÷WFW"“° ¢òò66÷VçBÖöæÇ’fV†–6ÆRfVÇB&÷WFW2‚$6&f‚f÷"–÷W"fV†–6ÆR"¢çW6R‡fV†–6ÆW5&÷WFW"“° ¢òòÖ&¶WGÆ6RÖWFÇ2W†6†ævR‡‡—6–6ÂÖöæÇ’ÂU4BÖöæÇ’¢çW6R†ÖWFÇ5&÷WFW"“° ¢òò&Vv—7FW"6öçG&7F÷"6–vçW&÷WFW0¢çW6R†6öçG&7F÷%6–vçW&÷WFW"“° ¢òò&Vv—7FW"†&G&ö6²6öÖÖW&6–ÂÆæF–ær²7FfbF—&V7F÷'’&÷WFW0¢&Vv—7FW$†&G&ö6µ&÷WFW2†“°¢òò&Vv—7FW"6öÖÖW&6–Â&ö¦V7B&ö&B²6×–vâÆæF–ær&÷WFW0¢&Vv—7FW$6öÖÖW&6–ÄF—&V7F÷'•&÷WFW2†“° ¢òòV&Æ–2vVöw&†–26÷fW&vRVæGö–çG2W6VB'’6÷VçG’vW0¢çW6R‚"ö’övVöw&†–2Ö6÷fW&vR"ÂvVöw&†–46÷fW&vU&÷WFW"“° ¢òò&Vv—7FW"6öÖ×Væ—G’'V–ÆFW"&÷WFW0¢çW6R‚"ö’ö6öÖ×Væ—G’Ö'V–ÆFW""Â6öÖ×Væ—G”'V–ÆFW%&÷WFW"“°¢çW6R‚"ö’öFÖ–âö6öÖ×Væ—G’Ö'V–ÆFW""ÂFÖ–ä6öÖ×Væ—G”'V–ÆFW%&÷WFW"“°¢çW6R‚"ö’÷G&FW'FæW"ÖÆæF–ær"ÂG&FU'FæW$ÆæF–æu&÷WFW"“°¢çW6R‚"ö’÷'FæW"Ö–çFW&W7B"Â'FæW$–çFW&W7E&÷WFW"“°¢çW6R‚"ö’÷G&FW'FæW"×'7g"ÂG&FU'FæW%'7g&÷WFW"“°¢çW6R‚"ö’öFÖ–â÷FööÂÖæ÷F–f–6F–öç2"ÂFÖ–åFööÄæ÷F–f–6F–öç5&÷WFW"“° ¢òò&Vv—7FW"6öÖ×Væ—G’fVÇBÕe&÷WFW2‡&öf–ÆR×66÷VB¢çW6R‚"ö’ö6öÖ×Væ—G’×fVÇB"Â6öÖ×Væ—G•fVÇE&÷WFW"“°¢çW6R‚"ö’ö6öÖ×Væ—G’Ö6W6W2"Â6öÖ×Væ—G”6W6W5&÷WFW"“°¢çW6R‚"ö’÷ÆFf÷&Ò×7W÷'B"ÂÆFf÷&Õ7W÷'E&÷WFW"“°¢çW6R‚"ö’÷¦W&òÖ&6RÖfVR"Â¦W&ô&6TfVT–ç7V7F–öå&÷WFW"“°¢çW6R‚"ö’ö–ç7V7F–öâ"Â–ç7V7F–öä–çFVÆÆ–vVæ6U&÷WFW"“°¢çW6R‚"ö’öÆVvÂöæ÷F'’"ÂÆVvÄæ÷F'•&÷WFW"“° ¢òò&Vv—7FW"&ö×BFÖ–â&÷WFW2‡7WW"FÖ–âöæÇ’¢6öç7B&ö×DFÖ–å&÷WFW"Ò†v—B–×÷'B‚"â÷&÷WFW2÷&ö×DFÖ–â"’’æFVfVÇC°¢çW6R‚"ö’÷&ö×BÖFÖ–â"Â&ö×DFÖ–å&÷WFW"“°¢çW6R‚"ö’öFÖ–â÷&ö×BÖFÖ–â"Â&ö×DFÖ–å&÷WFW"“° ¢òò&Vv—7FW"’66÷WB&÷WFW2‡v—F‚76—7FçBÆ–2f÷"&6·v&B6ö×F–&–Æ—G’¢6öç7B66÷WDVæ†æ6VEcE&÷WFW"Ò†v—B–×÷'B‚"â÷&÷WFW2÷66÷WBÖVæ†æ6VB×cB"’’æFVfVÇC°¢6öç7B66÷WEc%&÷WFW"Ò†v—B–×÷'B‚"â÷&÷WFW2÷66÷WB×c""’’æFVfVÇC°¢çW6R‚"ö’÷66÷WBÖVæ†æ6VB×cB"Â66÷WDVæ†æ6VEcE&÷WFW"“°¢òò66÷WB"ã¢FÖ–âÖöæÇ’æWrfW'6–öâv—F‚÷Vä’ÂvV"6V&6‚ÂæB¶æ÷vÆVFvR–çFVw&F–öà¢çW6R‚"ö’÷66÷WB×c""Â66÷WEc%&÷WFW"“°¢òò66÷WB"ãÆV&æ–æs¢v—F‚WFöÖF–2–æFW†–æræBÄ•4–çFVw&F–öà¢çW6R‚"ö’÷66÷WB×c"ÖÆV&æ–ær"Â66÷WEc%&÷WFW"“°¢çW6R‚"ö’÷66÷WBÖ†VFÖ"Â66÷WEc%&÷WFW"“°¢òò66÷WB"ã†VFÖ¢f—7VÂ66÷WF–ær6öÖÖæB6VçFW"f÷"f–ÆR6÷'F–æræB&Vv–öæÂ–çFVÆÆ–vVæ6P¢çW6R‚"ö’÷66÷WB"Â66÷WD†VFÖ&÷WFW2“°¢çW6R‚"ö’ö†VFÖ"Â66÷WD†VFÖ&÷WFW2“°¢çW6R‚"ò"Â66÷WDæ÷&ÖÆ—¦U&÷WFW"“°¢çW6R‚"ö’÷66÷WB"Â66÷WD†öÖU6æ6†÷E&÷WFW"“°¢çW6R‚"ö’÷66÷WB"Â66÷WE&÷WFR“°¢çW6R‚"ö’ö76—7FçB"Â66÷WE&÷WFR“° ¢òòFÖ–âÖöæÇ“¢WF†÷&—G’F–væ÷7F–72†ö'6W'fRÂæ÷BfVGW&R¢6öç7B66÷WDæÇ—F–75&÷WFW"Ò†v—B–×÷'B‚"â÷&÷WFW2÷66÷WBÖæÇ—F–72"’’æFVfVÇC°¢çW6R‚"ö’÷66÷WBÖæÇ—F–72"Â66÷WDæÇ—F–75&÷WFW"“° ¢òò7WW"FÖ–âöæÇ“¢6öçG&öÂÆæR†VÖW&vVæ7’'&¶W2æBv÷fW&æ÷'2¢6öç7BFÖ–ä6öçG&öÅ&÷WFW"Ò†v—B–×÷'B‚"â÷&÷WFW2öFÖ–âÖ6öçG&öÂ"’’æFVfVÇC°¢çW6R‚"ö’öFÖ–âÖ6öçG&öÂ"ÂFÖ–ä6öçG&öÅ&÷WFW"“° ¢òò66÷WB5DWF†÷&—G’6†V6²†Æ–v‡GvV–v‡BÂ66†VB¢6öç7B²6WGW66÷WD5D6†V6µ&÷WFW2ÒÒv—B–×÷'B‚"â÷&÷WFW2÷66÷WBÖ7FÖ6†V6²"“°¢6WGW66÷WD5D6†V6µ&÷WFW2†“° ¢òòFÖ–â–ç6–v‡G2f÷"66÷WBW6vP¢6öç7B66÷WD–ç6–v‡G4†æFÆW#¢W‡&W74†æFÆW"Ò7–æ2‡&WÂ&W2’Óâ°¢G'’°¢6öç7B²ÖW76vRÂÖöFRÂÆö6Æ—G’Â7V66W72ÂÆFVæ7”×2ÂW'&÷"ÒÒ&Wæ&öG’ÇÂ·Ó° ¢òò&6–2fÆ–FF–öã²Fòæ÷BF‡&÷rf÷"Ö—76–ær÷F–öæÂf–VÆG0¢–b‚ÖW76vRÇÂG—Vöb7V66W72ÓÒ&&ööÆVâ"’°¢&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–B66÷WB–ç6–v‡G2–ÆöB"Ò“°¢&WGW&ã°¢Ð ¢òòf÷"æ÷rÂÆörFò6W'fW"6öç6öÆS²6â&Rv—&VBFòD"öæÇ—F–72ÆFW ¢6öç6öÆRæ–æfò‚%µ66÷WD–ç6–v‡EÒ"Â°¢v†Vã¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢W6W$–C¢‡&WçW6W"2ç’“òæ–BÇÂ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"À¢ÖöFRÀ¢Æö6Æ—G’À¢7V66W72À¢ÆFVæ7”×2À¢W'&÷"À¢&Wf–Ws¢7G&–ær†ÖW76vR’ç6Æ–6RƒÂ#ƒ’À¢Ò“° ¢&W2ç7FGW2ƒ#B’æVæB‚“°¢&WGW&ã°¢Ò6F6‚†R’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFò&V6÷&B66÷WB–ç6–v‡B"ÂR“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&V6÷&B66÷WB–ç6–v‡B"Ò“°¢&WGW&ã°¢Ð¢Ó° ¢ç÷7B‚"ö’öFÖ–â÷66÷WBÖ–ç6–v‡G2"Â—4WF†VçF–6FVBÂ&WV—&TFÖ–âÂ66÷WD–ç6–v‡G4†æFÆW"“° ¢òò'Vr&W÷'BVæGö–çBv—F‚f÷&×7&VR–çFVw&F–öà¢ç÷7B‚"ö’ö'Vr×&W÷'B"Â7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7Bf÷&×7&VUW&ÂÒ&ö6W72æVçbädõ$Õ5$TUôdõ$Õô”C° ¢–b‚f÷&×7&VUW&Â’°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$'Vr&W÷'F–ær6W'f–6Ræ÷B6öæf–wW&VB"Ò“°¢Ð ¢òòW‡G&7Bf÷&Ò”Bg&öÒU$Â–b—Bw2gVÆÂU$À¢6öç7Bf÷&Ô–BÒf÷&×7&VUW&Âç&WÆ6R‚&‡GG3¢òöf÷&×7&VRæ–òöbò"Â""“°¢6öç7Bf÷&×7&VTVæGö–çBÒ‡GG3¢òöf÷&×7&VRæ–òöbòG¶f÷&Ô–GÖ° ¢òòf÷'v&BF†Rf÷&ÒFFFòf÷&×7&VP¢6öç7BfWF6‚Ò†v—B–×÷'B‚&æöFRÖfWF6‚"’’æFVfVÇC°¢6öç7B&W7öç6RÒv—BfWF6‚†f÷&×7&VTVæGö–çBÂ°¢ÖWF†öC¢%õ5B"À¢&öG“¢&Wæ&öG’2ç’Âòòf÷&ÔFFg&öÒ6Æ–Vç@¢Ò“° ¢–b‡&W7öç6Ræö²’°¢òòÆörF†R'Vr&W÷'Bf÷"FÖ–âv&VæW70¢v—B7F÷&vRæÆötWfVçB‚&'Vu÷&W÷'E÷7V&Ö—GFVB"Â°¢F–ÖW7F×¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢W6W$vVçC¢&WævWB‚%W6W"ÔvVçB"’À¢—¢&Wæ—À¢W6W$–C¢‡&WçW6W"2ç’“òæ–BÇÂ&æöç–Ö÷W2"À¢Ò“° ¢&W2æ§6öâ‡²ÖW76vS¢$'Vr&W÷'B7V&Ö—GFVB7V66W76gVÆÇ’"Ò“°¢ÒVÇ6R°¢F‡&÷ræWrW'&÷"†f÷&×7&VR&W7öæFVBv—F‚7FGW2G·&W7öç6Rç7FGW7Ö“°¢Ð¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7V&Ö—GF–ær'Vr&W÷'C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7V&Ö—B'Vr&W÷'B"Ò“°¢Ð¢Ò“° ¢v—B&Vv—7FW$6öÖÖW&6–Å&öÖ÷F–öå&÷WFW2†Â²—4WF†VçF–6FVBÂ—57WW$FÖ–âÒ“° ¢òò†6R3¢w&÷W2b6ö6–ÂfVGW&W2&÷WFW0¢6öç7B°¢vWDw&÷W2À¢vWDw&÷WFWF–Ç2À¢¦ö–äw&÷WÀ¢vWDw&÷W÷7G2À¢7&VFTw&÷W÷7BÀ¢vWEW6W$w&÷W2À¢7&VFTw&÷WÀ¢ÒÒv—B–×÷'B‚"â÷&÷WFW2öw&÷W2"“° ¢ævWB‚"ö’öw&÷W2"ÂvWDw&÷W2“°¢ævWB‚"ö’öw&÷W2÷W6W""Â—4WF†VçF–6FVBÂvWEW6W$w&÷W2“°¢ævWB‚"ö’öw&÷W2ó¦w&÷W–B"ÂvWDw&÷WFWF–Ç2“°¢ç÷7B‚"ö’öw&÷W2"Â—4WF†VçF–6FVBÂ7&VFTw&÷W“°¢ç÷7B‚"ö’öw&÷W2ó¦w&÷W–Bö¦ö–â"Â—4WF†VçF–6FVBÂ¦ö–äw&÷W“°¢ævWB‚"ö’öw&÷W2ó¦w&÷W–B÷÷7G2"ÂvWDw&÷W÷7G2“°¢ç÷7B‚"ö’öw&÷W2ó¦w&÷W–B÷÷7G2"Â—4WF†VçF–6FVBÂ7&VFTw&÷W÷7B“° ¢òò†6RC¢„ôÖævVÖVçB&÷WFW0¢6öç7B°¢vWD„ôÀ¢vWD„ôf–ææ6W2À¢vWD„ôfVæF÷'2À¢vWD„ôf÷FW2À¢7V&Ö—Ef÷FRÀ¢&WVW7EfVæF÷%6W'f–6RÀ¢6öÆÆV7D„ôfVRÀ¢6V&6„„ô2À¢vWD„ôÖVÖ&W"À¢vWD„ôÖVÖ&W'2À¢FD„ôÖVÖ&W"À¢WFFT„ôÖVÖ&W%&öÆRÀ¢ÒÒv—B–×÷'B‚"â÷&÷WFW2ö†ö"“° ¢ævWB‚"ö’ö†ö÷6V&6‚"Â6V&6„„ô2“°¢ævWB‚"ö’ö†öó¦†ö–BöÖVÖ&W""Â—4WF†VçF–6FVBÂvWD„ôÖVÖ&W"“°¢ævWB‚"ö’ö†öó¦†ö–BöÖVÖ&W'2"Â—4WF†VçF–6FVBÂvWD„ôÖVÖ&W'2“°¢ç÷7B‚"ö’ö†öó¦†ö–BöÖVÖ&W'2"Â—4WF†VçF–6FVBÂFD„ôÖVÖ&W"“°¢çWB‚"ö’ö†öó¦†ö–BöÖVÖ&W'2ó¦ÖVÖ&W$–B÷&öÆR"Â—4WF†VçF–6FVBÂWFFT„ôÖVÖ&W%&öÆR“°¢ævWB‚"ö’ö†öó¦†ö–Böf–ææ6W2"ÂvWD„ôf–ææ6W2“°¢ævWB‚"ö’ö†öó¦†ö–B÷fVæF÷'2"ÂvWD„ôfVæF÷'2“°¢ævWB‚"ö’ö†öó¦†ö–B÷f÷FW2"ÂvWD„ôf÷FW2“°¢ç÷7B‚"ö’ö†ö÷f÷FW2ó§f÷FT–B÷7V&Ö—B"Â—4WF†VçF–6FVBÂ7V&Ö—Ef÷FR“°¢ç÷7B‚"ö’ö†ö÷fVæF÷'2ó§fVæF÷$–B÷&WVW7B"Â—4WF†VçF–6FVBÂ&WVW7EfVæF÷%6W'f–6R“°¢ç÷7B‚"ö’ö†öö6öÆÆV7BÖfVR"Â—4WF†VçF–6FVBÂ6öÆÆV7D„ôfVR“° ¢òò„ôÆWfVÂ"ÖVÖ&W'6†—²F6†&ö&BVæGö–çG0¢ævWB‚"ö’ö†ö"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7BÖVÖ&W'6†—2Òv—B7F÷&vRævWD†öf÷%W6W"‡W6W$–B“°¢&W2æ§6öâ‡²ÖVÖ&W'6†—2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær„ôÖVÖ&W'6†—3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB„ôÖVÖ&W'6†—2"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†ööF6†&ö&B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7BÖVÖ&W'6†—2Òv—B7F÷&vRævWD†öf÷%W6W"‡W6W$–B“°¢–b‚ÖVÖ&W'6†—2ÇÂÖVÖ&W'6†—2æÆVæwF‚ÓÓÒ’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%W6W"—2æ÷BÖVÖ&W"öbç’„ô"Ò“°¢Ð ¢6öç7B&WVW7FVD†ö–BÒ‡&WçVW'’æ†ö–B27G&–ær’ÇÂÖVÖ&W'6†—5³Òæ†ö–C°¢6öç7B—4ÖVÖ&W$öe&WVW7FVBÒÖVÖ&W'6†—2ç6öÖR‚†Ò’ÓâÒæ†ö–BÓÓÒ&WVW7FVD†ö–B“°¢–b‚—4ÖVÖ&W$öe&WVW7FVB’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%W6W"—2æ÷BÖVÖ&W"öbF†—2„ô"Ò“°¢Ð ¢6öç7BF6†&ö&BÒv—B‡7F÷&vR2ç’’ævWD†öF6†&ö&B‡&WVW7FVD†ö–B“°¢–b‚F6†&ö&B’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢$„ôF6†&ö&Bæ÷Bf÷VæB"Ò“°¢Ð ¢&W2æ§6öâ‡²F6†&ö&BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær„ôF6†&ö&C¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB„ôF6†&ö&B"Ò“°¢Ð¢Ò“° ¢ævWB‚"ö’ö†ö÷f÷FW2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7BÖVÖ&W'6†—2Òv—B7F÷&vRævWD†öf÷%W6W"‡W6W$–B“°¢–b‚ÖVÖ&W'6†—2ÇÂÖVÖ&W'6†—2æÆVæwF‚ÓÓÒ’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%W6W"—2æ÷BÖVÖ&W"öbç’„ô"Ò“°¢Ð ¢6öç7B&WVW7FVD†ö–BÒ‡&WçVW'’æ†ö–B27G&–ær’ÇÂÖVÖ&W'6†—5³Òæ†ö–C°¢6öç7B—4ÖVÖ&W$öe&WVW7FVBÒÖVÖ&W'6†—2ç6öÖR‚†Ò’ÓâÒæ†ö–BÓÓÒ&WVW7FVD†ö–B“°¢–b‚—4ÖVÖ&W$öe&WVW7FVB’°¢&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²ÖW76vS¢%W6W"—2æ÷BÖVÖ&W"öbF†—2„ô"Ò“°¢Ð ¢6öç7Bf÷FW2Òv—B‡7F÷&vR2ç’’ævWD†öf÷FW4f÷%W6W"‡&WVW7FVD†ö–BÂW6W$–B“°¢&W2æ§6öâ‡²f÷FW2Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær„ôf÷FW3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòÆöB„ôf÷FW2"Ò“°¢Ð¢Ò“° ¢òò¶VWvVæW&–2¦†ö–B&÷WFRgFW"7FF–2„ô&÷WFW26òö’ö†ööF6†&ö&BæBö’ö†ö÷f÷FW2Fòæ÷BvWB6†F÷vVBà¢ævWB‚"ö’ö†öó¦†ö–B"ÂvWD„ô“° ¢ç÷7B€¢"ö’ö†ö÷f÷FW2ó¦–B÷f÷FR"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ6Æ–×3òç7V"ÇÂ‡&WçW6W"2ç’“òæ–C°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$WF†VçF–6F–öâ&WV—&VB"Ò“°¢Ð ¢6öç7B²–BÒÒ&Wç&×3°¢6öç7B²÷F–öâÒÒ&Wæ&öG’ÇÂ·Ó°¢–b‚÷F–öâ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&÷F–öâ—2&WV—&VB"Ò“°¢Ð ¢òòFVÆVvFRÖVÖ&W'6†—æBf÷FRv–æF÷rfÆ–FF–öâFò7F÷&vR†VÇW ¢v—B‡7F÷&vR2ç’’ç7V&Ö—D„ôf÷FR‡W6W$–BÂ–BÂ÷F–öâ“° ¢&W2æ§6öâ‡²7V66W73¢G'VRÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"67F–ær„ôf÷FS¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò67Bf÷FR"Ò“°¢Ð¢Ð¢“° ¢òò†6RS¢æF–öçv–FRW‡ç6–öâ&÷WFW0¢6öç7B°¢vWDæF–öçv–FTÖWG&–72À¢vWEF÷6÷VçF–W2À¢vWDW‡ç6–öå—VÆ–æRÀ¢vWDf÷VæFF–öä–×7BÀ¢&WVW7D6÷VçG”7F—fF–öâÀ¢vWD6÷fW&vTÖFFÀ¢vWDff–Æ–FUW&f÷&Öæ6RÀ¢ÒÒv—B–×÷'B‚"â÷&÷WFW2öæF–öçv–FR"“° ¢ævWB‚"ö’öæF–öçv–FRöÖWG&–72"ÂvWDæF–öçv–FTÖWG&–72“°¢ævWB‚"ö’öæF–öçv–FR÷F÷Ö6÷VçF–W2"ÂvWEF÷6÷VçF–W2“°¢ævWB‚"ö’öæF–öçv–FRöW‡ç6–öâ×—VÆ–æR"ÂvWDW‡ç6–öå—VÆ–æR“°¢ævWB‚"ö’öæF–öçv–FRöf÷VæFF–öâÖ–×7B"ÂvWDf÷VæFF–öä–×7B“°¢ævWB‚"ö’öæF–öçv–FRö6÷fW&vRÖÖ"ÂvWD6÷fW&vTÖFF“°¢ævWB‚"ö’öæF–öçv–FRöff–Æ–FR×W&f÷&Öæ6R"ÂvWDff–Æ–FUW&f÷&Öæ6R“°¢ç÷7B‚"ö’öæF–öçv–FR÷&WVW7BÖ7F—fF–öâ"Â—4WF†VçF–6FVBÂ&WVW7D6÷VçG”7F—fF–öâ“° ¢&Vv—7FW%7F÷'•&÷WFW2†“° ¢òòF6†&ö&BFFVæGö–çBÒW'6öæÆ—¦VBW6W"F6†&ö&BFF¢ævWB‚"ö’öF6†&ö&B"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢6öç7B·W6W%ÒÒv—BF"ç6VÆV7B‚’æg&öÒ‡W6W'2’çv†W&R†W‡W6W'2æ–BÂW6W$–B’’æÆ–Ö—Bƒ“° ¢–b‚W6W"’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%W6W"æ÷Bf÷VæB"Ò“°¢Ð ¢6öç7BF6†&ö&DFF¢ç’Ò°¢7FG3¢°¢7F—fU&ö¦V7G3¢À¢6fVD6öçG&7F÷'3¢À¢Ö&¶WGÆ6TÆ—7F–æw3¢À¢&VÄW7FFTÆ—7F–æw3¢À¢F÷FÅf–Ww3¢À¢æ÷F–f–6F–öç3¢À¢ÒÀ¢&V6VçD7F—f—G“¢µÒÀ¢×•&ö¦V7G3¢µÒÀ¢×”Æ—7F–æw3¢µÒÀ¢6fVD—FV×3¢µÒÀ¢V÷FW3¢µÒÀ¢6öçfW'6F–öç3¢µÒÀ¢Ó° ¢6öç7B6fUVW'’Ò7–æ2ÅCâ†Æ&VÃ¢7G&–ærÂfã¢‚’Óâ&öÖ—6SÅCâÂfÆÆ&6³¢B“¢&öÖ—6SÅCâÓâ°¢G'’°¢&WGW&âv—Bfâ‚“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRçv&â†¶F6†&ö&EÒf–ÆVBFòÆöBG¶Æ&VÇÓ²W6–ærfÆÆ&6¶ÂW'&÷"“°¢&WGW&âfÆÆ&6³°¢Ð¢Ó° ¢òòfWF6‚6öçG&7F÷"×7V6–f–2FF¢–b‡W6W"ç&öÆRÓÓÒ&6öçG&7F÷""’°¢6öç7B6öçG&7F÷"Òv—B7F÷&vRævWD6öçG&7F÷$'•W6W$–B‡W6W$–B“° ¢–b†6öçG&7F÷"’°¢òòvWB6öçG&7F÷"w276–væVBÆVG2‡&ö¦V7G2¢6öç7B6öçG&7F÷$ÆVG2Òv—B6fUVW'’€¢&6öçG&7F÷"ÆVG2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†ÆVG2¢çv†W&R†W†ÆVG2æ6öçG&7F÷$–BÂ6öçG&7F÷"æ–B’¢æ÷&FW$'’†FW62†ÆVG2æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFæ×•&ö¦V7G2Ò6öçG&7F÷$ÆVG2æÖ‚†ÆVC¢ç’’Óâ‡°¢–C¢ÆVBæ–BÀ¢F—FÆS¢G¶ÆVBç&ö¦V7EG—WÒÒG¶ÆVBçW&vVæ7—ÖÀ¢7FGW3¢ÆVBç7FGW2À¢fÇVS¢ÆVBæW7F–ÖFVEfÇVRÀ¢7&VFVDC¢ÆVBæ7&VFVDBÀ¢Ò’“° ¢F6†&ö&DFFç7FG2æ7F—fU&ö¦V7G2Ò6öçG&7F÷$ÆVG2æf–ÇFW"€¢†Ã¢ç’’ÓâÂç7FGW2ÓÓÒ&æWr"ÇÂÂç7FGW2ÓÓÒ&6öçF7FVB"ÇÂÂç7FGW2ÓÓÒ'VÆ–f–VB ¢’æÆVæwFƒ° ¢òòvWB6öçG&7F÷"w2V÷FW0¢6öç7B6öçG&7F÷%V÷FW2Òv—B6fUVW'’€¢&6öçG&7F÷"V÷FW2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ‡V÷FW2¢çv†W&R†W‡V÷FW2æ6öçG&7F÷$–BÂ6öçG&7F÷"æ–B’¢æ÷&FW$'’†FW62‡V÷FW2æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFçV÷FW2Ò6öçG&7F÷%V÷FW3° ¢òòvWB6öçG&7F÷"w26öçfW'6F–öç0¢6öç7B6öçG&7F÷$6öçfW'6F–öç2Òv—B6fUVW'’€¢&6öçG&7F÷"6öçfW'6F–öç2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†6öçfW'6F–öç2¢çv†W&R†W†6öçfW'6F–öç2æ6öçG&7F÷$–BÂ6öçG&7F÷"æ–B’¢æ÷&FW$'’†FW62†6öçfW'6F–öç2æÆ7DÖW76vTB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFæ6öçfW'6F–öç2Ò6öçG&7F÷$6öçfW'6F–öç3°¢Ð¢Ð ¢òòfWF6‚†öÖV÷væW"×7V6–f–2FF¢–b‡W6W"ç&öÆRÓÓÒ&†öÖV÷væW""’°¢òòvWB†öÖV÷væW"w2ÆVG2‡&ö¦V7B&WVW7G2¢6öç7B†öÖV÷væW$ÆVG2Òv—B6fUVW'’€¢&†öÖV÷væW"ÆVG2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†ÆVG2¢çv†W&R†W†ÆVG2çW6W$–BÂW6W$–B’¢æ÷&FW$'’†FW62†ÆVG2æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFæ×•&ö¦V7G2Ò†öÖV÷væW$ÆVG2æÖ‚†ÆVC¢ç’’Óâ‡°¢–C¢ÆVBæ–BÀ¢F—FÆS¢G¶ÆVBç&ö¦V7EG—WÒÒG¶ÆVBçW&vVæ7—ÖÀ¢7FGW3¢ÆVBç7FGW2À¢fÇVS¢ÆVBæW7F–ÖFVEfÇVRÀ¢7&VFVDC¢ÆVBæ7&VFVDBÀ¢Ò’“° ¢F6†&ö&DFFç7FG2æ7F—fU&ö¦V7G2Ò†öÖV÷væW$ÆVG2æf–ÇFW"€¢†Ã¢ç’’ÓâÂç7FGW2ÓÓÒ&æWr"ÇÂÂç7FGW2ÓÓÒ&6öçF7FVB"ÇÂÂç7FGW2ÓÓÒ'VÆ–f–VB ¢’æÆVæwFƒ° ¢òòvWB†öÖV÷væW"w26öçfW'6F–öç0¢6öç7B†öÖV÷væW$6öçfW'6F–öç2Òv—B6fUVW'’€¢&†öÖV÷væW"6öçfW'6F–öç2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†6öçfW'6F–öç2¢çv†W&R†W†6öçfW'6F–öç2æ†öÖV÷væW$–BÂW6W$–B’¢æ÷&FW$'’†FW62†6öçfW'6F–öç2æÆ7DÖW76vTB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFæ6öçfW'6F–öç2Ò†öÖV÷væW$6öçfW'6F–öç3° ¢òòvWBV÷FW2g&öÒ6öçfW'6F–öç0¢–b††öÖV÷væW$6öçfW'6F–öç2æÆVæwF‚â’°¢6öç7B6öçfW'6F–öä–G2Ò†öÖV÷væW$6öçfW'6F–öç2æÖ‚†3¢ç’’Óâ2æ–B“°¢6öç7B†öÖV÷væW%V÷FW2Òv—B6fUVW'’€¢&†öÖV÷væW"V÷FW2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ‡V÷FW2¢çv†W&R‡7ÆG·V÷FW2æ6öçfW'6F–öä–GÒÒå’‚G¶6öçfW'6F–öä–G7Ò–¢æ÷&FW$'’†FW62‡V÷FW2æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFçV÷FW2Ò†öÖV÷væW%V÷FW3°¢Ð ¢òòvWB6fVB6öçG&7F÷'26÷Vç@¢6öç7B6fVD6öçG&7F÷'5F&ÆRÒ†F"2ç’’çVW'“òç6fVD6öçG&7F÷'3òçF&ÆS°¢–b‡6fVD6öçG&7F÷'5F&ÆR’°¢6öç7B6fVD6öçG&7F÷%&÷w2Òv—B6fUVW'’€¢'6fVB6öçG&7F÷'2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ‡6fVD6öçG&7F÷'5F&ÆR¢çv†W&R†W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’çW6W$–BÂW6W$–B’’À¢µÒ2ç•µÐ¢“°¢F6†&ö&DFFç7FG2ç6fVD6öçG&7F÷'2Ò6fVD6öçG&7F÷%&÷w2æÆVæwFƒ°¢ÒVÇ6R°¢F6†&ö&DFFç7FG2ç6fVD6öçG&7F÷'2Ò°¢Ð¢Ð ¢òòvWBÖ&¶WGÆ6RÆ—7F–æw2f÷"ÆÂW6W'0¢6öç7BW6W$Æ—7F–æw2Òv—B6fUVW'’€¢&Ö&¶WGÆ6RÆ—7F–æw2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†Ö&¶WGÆ6TÆ—7F–æw2¢çv†W&R†W†Ö&¶WGÆ6TÆ—7F–æw2ç6VÆÆW$–BÂW6W$–B’¢æ÷&FW$'’†FW62†Ö&¶WGÆ6TÆ—7F–æw2æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFæ×”Æ—7F–æw2ÒW6W$Æ—7F–æw3°¢F6†&ö&DFFç7FG2æÖ&¶WGÆ6TÆ—7F–æw2ÒW6W$Æ—7F–æw2æf–ÇFW"€¢†Ã¢ç’’ÓâÂç7FGW2ÓÓÒ&7F—fR ¢’æÆVæwFƒ° ¢òòvWB&VÇF÷"Æ—7F–æw2–bW6W"—2&VÇF÷ ¢6öç7B&VÄW7FFTÆ—7F–æw5F&ÆRÒ†F"2ç’’çVW'“òç&VÄW7FFTÆ—7F–æw3òçF&ÆS°¢–b‡W6W"ç&öÆRÓÓÒ'&VÇF÷""bb&VÄW7FFTÆ—7F–æw5F&ÆR’°¢6öç7B&VÇF÷$Æ—7F–æw2Òv—B6fUVW'’€¢'&VÇF÷"Æ—7F–æw2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ‡&VÄW7FFTÆ—7F–æw5F&ÆR¢çv†W&R†W‚‡&VÄW7FFTÆ—7F–æw5F&ÆR2ç’’ç6VÆÆW$–BÂW6W$–B’¢æ÷&FW$'’†FW62‚‡&VÄW7FFTÆ—7F–æw5F&ÆR2ç’’æ7&VFVDB’¢æÆ–Ö—Bƒ’À¢µÒ2ç•µÐ¢“°¢F6†&ö&DFFç&VÄW7FFTÆ—7F–æw2Ò&VÇF÷$Æ—7F–æw3°¢F6†&ö&DFFç7FG2ç&VÄW7FFTÆ—7F–æw2Ò&VÇF÷$Æ—7F–æw2æf–ÇFW"€¢†Ã¢ç’’ÓâÂç7FGW2ÓÓÒ&7F—fR ¢’æÆVæwFƒ°¢Ð ¢òòvWB&V6VçB6öÖ×Væ—G’7F—f—G¢6öç7B&V6VçE÷7G2Òv—B6fUVW'’€¢'&V6VçB÷7G2"À¢‚’Óà¢F ¢ç6VÆV7B‚¢æg&öÒ†6öÖ×Væ—G•÷7G2¢çv†W&R†W†6öÖ×Væ—G•÷7G2æWF†÷$–BÂW6W$–B’¢æ÷&FW$'’†FW62†6öÖ×Væ—G•÷7G2æ7&VFVDB’¢æÆ–Ö—BƒR’À¢µÒ2ç•µÐ¢“° ¢F6†&ö&DFFç&V6VçD7F—f—G’Ò&V6VçE÷7G2æÖ‚‡÷7C¢ç’’Óâ‡°¢–C¢÷7Bæ–BÀ¢F—FÆS¢÷7FVC¢G·÷7BçF—FÆRÇÂ÷7Bæ6öçFVçBç7V'7G&–ærƒÂS—ÖÀ¢7&VFVDC¢÷7Bæ7&VFVDBÀ¢G—S¢'÷7B"À¢Ò’“° ¢òò&öf–ÆRf–Ww2ÖWG&–2æ÷Bf–Æ&ÆR–â66†VÖ²FVfVÇBFò ¢F6†&ö&DFFç7FG2çF÷FÅf–Ww2Ò° ¢&W2æ§6öâ†F6†&ö&DFF“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ærF6†&ö&BFF¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚F6†&ö&BFF"Ò“°¢Ð¢Ò“° ¢òò6fVB6öçG&7F÷'2Æ—7Bf÷"F†R7W'&VçBW6W ¢ævWB‚"ö’÷6fVBÖ6öçG&7F÷'2"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ&WçW6W#òæ6Æ–×3òç7V#°¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð ¢6öç7B6fVD6öçG&7F÷'5F&ÆRÒ†F"2ç’’çVW'“òç6fVD6öçG&7F÷'3òçF&ÆS°¢–b‚6fVD6öçG&7F÷'5F&ÆR’°¢&WGW&â&W2æ§6öâ…µÒ“°¢Ð ¢6öç7B&÷w2Òv—BF ¢ç6VÆV7B‚¢æg&öÒ‡6fVD6öçG&7F÷'5F&ÆR¢çv†W&R†W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’çW6W$–BÂW6W$–B’“° ¢–b‚&÷w2æÆVæwF‚’°¢&WGW&â&W2æ§6öâ…µÒ“°¢Ð ¢6öç7B6öçG&7F÷$–G2Ò'&’æg&öÒ€¢æWr6WB€¢&÷w0¢æÖ‚‡#¢ç’’Óâ"æ6öçG&7F÷$–BÇÂ"æ6öçG&7F÷%ö–BÇÂ"ç&ô–BÇÂ"ç&õö–B¢æf–ÇFW"„&ööÆVâ¢¢“° ¢–b‚6öçG&7F÷$–G2æÆVæwF‚’°¢&WGW&â&W2æ§6öâ…µÒ“°¢Ð ¢6öç7B6öçG&7F÷%&V6÷&G2Òv—BF ¢ç6VÆV7B‚¢æg&öÒ†6öçG&7F÷'2¢çv†W&R†–ä'&’†6öçG&7F÷'2æ–BÂ6öçG&7F÷$–G227G&–æuµÒ’“° ¢6öç7B–ÆöBÒ6öçG&7F÷%&V6÷&G2æÖ‚†3¢ç’’Óâ‡°¢–C¢2æ–BÀ¢æÖS¢2æF—7Æ”æÖRÇÂ2æ'W6–æW74æÖRÇÂ2æÆVvÄæÖRÇÂ%Væ¶æ÷vâ6öçG&7F÷""À¢fF%W&Ã¢2æÆövõW&ÂÇÂ2æfF%W&ÂÇÂçVÆÂÀ¢6FVv÷'“¢2ç&–Ö'•G&FRÇÂ2çG&FRÇÂçVÆÂÀ¢Æö6F–öã¢2æ6—G’bb2ç7FFRòG¶2æ6—G—ÒÂG¶2ç7FFWÖ¢2æ6—G’ÇÂ2ç7FFRÇÂçVÆÂÀ¢fW&–f–VC¢&ööÆVâ†2æ—5fW&–f–VBÇÂ2çfW&–f–VBÇÂfÇ6R’À¢Ò’“° ¢&W2æ§6öâ‡–ÆöB“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"fWF6†–ær6fVB6öçG&7F÷'3¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFòfWF6‚6fVB6öçG&7F÷'2"Ò“°¢Ð¢Ò“° ¢òò&VÖ÷fR6öçG&7F÷"g&öÒF†R7W'&VçBW6W"w26fVBÆ—7@¢æFVÆWFR€¢"ö’÷6fVBÖ6öçG&7F÷'2ó¦6öçG&7F÷$–B"À¢—4WF†VçF–6FVBÀ¢7–æ2‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢6öç7BW6W$–BÒ‡&WçW6W"2ç’“òæ–BÇÂ&WçW6W#òæ6Æ–×3òç7V#°¢6öç7B²6öçG&7F÷$–BÒÒ&Wç&×3° ¢–b‚W6W$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%W6W"æ÷BWF†VçF–6FVB"Ò“°¢Ð¢–b‚6öçG&7F÷$–B’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&6öçG&7F÷$–B—2&WV—&VB"Ò“°¢Ð ¢6öç7B6fVD6öçG&7F÷'5F&ÆRÒ†F"2ç’’çVW'“òç6fVD6öçG&7F÷'3òçF&ÆS°¢–b‚6fVD6öçG&7F÷'5F&ÆR’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6fVB6öçG&7F÷'2F&ÆRæ÷Bf–Æ&ÆR"Ò“°¢Ð ¢v—BF ¢æFVÆWFR‡6fVD6öçG&7F÷'5F&ÆR¢çv†W&R€¢æB€¢W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’çW6W$–BÂW6W$–B’À¢÷"€¢W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’æ6öçG&7F÷$–BÂ6öçG&7F÷$–B2ç’’À¢W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’æ6öçG&7F÷%ö–BÂ6öçG&7F÷$–B2ç’’À¢W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’ç&ô–BÂ6öçG&7F÷$–B2ç’’À¢W‚‡6fVD6öçG&7F÷'5F&ÆR2ç’’ç&õö–BÂ6öçG&7F÷$–B2ç’¢¢¢“° ¢&W2ç7FGW2ƒ#B’ç6VæB‚“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"&VÖ÷f–ær6fVB6öçG&7F÷#¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò&VÖ÷fR6fVB6öçG&7F÷""Ò“°¢Ð¢Ð¢“° ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ¢òò5$•D”4ÂdõTäDD”ôâTäEô”åE2…†6R¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÐ ¢òòâ„TÅD‚4„T4²TäEô”åB‡V&Æ–2Âæöâ×6Vç6—F—fR&VÆV6R6öçG&7B7W&f6R¢ævWB‚"ö’ö†VÇF‚"Â7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7BWF–ÖRÒ&ö6W72çWF–ÖR‚“°¢6öç7BÖVÖ÷'•W6vRÒ&ö6W72æÖVÖ÷'•W6vR‚“°¢6öç7BF–ÖW7F×ÒæWrFFR‚’çFô•4õ7G&–ær‚“°¢6öç7B6öÖÖ—BÒ'V–ÆE&Wf—6–öã° ¢òòV–6²FF&6R6öææV7F—f—G’6†V6°¢ÆWBF%7FGW3¢&6öææV7FVB"Â&F—66öææV7FVB"Ò&F—66öææV7FVB#°¢G'’°¢6öç7BF$6†V6²Òv—BF"æW†V7WFR‡7Æ4TÄT5B“°¢F%7FGW2ÒF$6†V6²ò&6öææV7FVB"¢&F—66öææV7FVB#°¢Ò6F6‚°¢F%7FGW2Ò&F—66öææV7FVB#°¢Ð ¢ÆWBÖ–w&F–öç3¢°¢6ö×F–&–Æ—G“¢7G&–æs°¢Æ–VD6÷VçC¢çVÖ&W"ÂçVÆÃ°¢W‡V7FVD6÷VçC¢çVÖ&W"ÂçVÆÃ°¢&WV—&VE66†VÖö³¢&ööÆVâÂçVÆÃ°¢ÒÒ°¢6ö×F–&–Æ—G“¢'Væ¶æ÷vâ"À¢Æ–VD6÷VçC¢çVÆÂÀ¢W‡V7FVD6÷VçC¢çVÆÂÀ¢&WV—&VE66†VÖö³¢çVÆÂÀ¢Ó° ¢–b†F%7FGW2ÓÓÒ&6öææV7FVB"bbööÂ’°¢G'’°¢6öç7B²vWDÖ–w&F–öä6ö×F–&–Æ—G•7FGW2ÒÐ¢v—B–×÷'B‚"â÷6W'f–6W2öÖ–w&F–öä6ö×F–&–Æ—G•7FGW2"“°¢Ö–w&F–öç2Òv—BvWDÖ–w&F–öä6ö×F–&–Æ—G•7FGW2‡ööÂ“°¢Ò6F6‚°¢Ö–w&F–öç2Ò°¢6ö×F–&–Æ—G“¢'Væ¶æ÷vâ"À¢Æ–VD6÷VçC¢çVÆÂÀ¢W‡V7FVD6÷VçC¢çVÆÂÀ¢&WV—&VE66†VÖö³¢çVÆÂÀ¢Ó°¢Ð¢Ð ¢6öç7BÖ–w&F–öäö²ÒÖ–w&F–öç2æ6ö×F–&–Æ—G’ÓÓÒ&6ö×F–&ÆR#°¢6öç7B7FGW2ÒF%7FGW2ÓÒ&6öææV7FVB"ò'Væ†VÇF‡’"¢Ö–w&F–öäö²ò&†VÇF‡’"¢&FVw&FVB#° ¢6öç7B–ÆöBÒ°¢7FGW2À¢WF–ÖS¢ÖF‚ç&÷VæB‡WF–ÖR’À¢F–ÖW7F×À¢6öÖÖ—BÀ¢FF&6S¢F%7FGW2À¢Ö–w&F–öç2À¢ÖVÖ÷'“¢°¢'73¢ÖF‚ç&÷VæB†ÖVÖ÷'•W6vRç'72ò#Bò#B’ÂòòÔ ¢†VW6VC¢ÖF‚ç&÷VæB†ÖVÖ÷'•W6vRæ†VW6VBò#Bò#B’À¢†VF÷FÃ¢ÖF‚ç&÷VæB†ÖVÖ÷'•W6vRæ†VF÷FÂò#Bò#B’À¢ÒÀ¢Vçf—&öæÖVçC¢°¢äôDUôTåc¢&ö6W72æVçbääôDUôTåbÀ¢dU%4”ôã¢#ãã"À¢ÒÀ¢Ó° ¢–b‡7FGW2ÓÓÒ'Væ†VÇF‡’"’°¢&WGW&â&W2ç7FGW2ƒS2’æ§6öâ‡–ÆöB“°¢Ð¢&WGW&â&W2æ§6öâ‡–ÆöB“°¢Ò6F6‚†W'&÷#¢ç’’°¢&W2ç7FGW2ƒS2’æ§6öâ‡°¢7FGW3¢'Væ†VÇF‡’"À¢W'&÷#¢W'&÷"æÖW76vRÀ¢F–ÖW7F×¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢6öÖÖ—C¢'V–ÆE&Wf—6–öâÀ¢Ò“°¢Ð¢Ò“° ¢òò"âdU%4”ôâTäEô”åB†&6¶VæB'V–ÆBÖWFFF¢ævWB‚"ö’÷fW'6–öâ"Â‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢6öç7B6öÖÖ—BÒ'V–ÆE&Wf—6–öã°¢6öç7B'V–ÇDBÒ&ö6W72æVçbä%T”ÄEôBÇÂ&ö6W72æVçbådU$4TÅô%T”ÄEõD”ÔRÇÂVæFVf–æVC° ¢&W2æ§6öâ‡°¢6W'f–6S¢'G&FW66÷WBÖ&6¶VæB"À¢6öÖÖ—BÀ¢'V–ÇDC¢'V–ÇDBÇÂVæFVf–æVBÀ¢Vçc¢&ö6W72æVçbääôDUôTåbÇÂ&FWfVÆ÷ÖVçB"À¢Ò“°¢Ò“° ¢òò2âT$Ä”24ôäd”r‡6fRÂæöâÖWF‚Âæöâ×6V7&WB¢òòW6VB'’6Æ–VçBÖöæÇ’fVGW&W2F†BÖ’æVVBV&Æ–2¶W’B'VçF–ÖP¢òò†RærâvöövÆRÖ2¥2’¶W’’âFòäõB–æ6ÇVFR6V7&WG2†W&Rà¢ævWB‚"ö’÷V&Æ–2Ö6öæf–r"Â‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢&W2ç6WD†VFW"‚$66†RÔ6öçG&öÂ"Â&æò×7F÷&RÂæòÖ66†RÂ×W7B×&WfÆ–FFRÂ&—fFR"“°¢&W2ç6WD†VFW"‚%&vÖ"Â&æòÖ66†R"“° ¢6öç7BvöövÆTÖ4”¶W’Ò7G&–ær‡&ö6W72æVçbåE$DU44õUEôtôôtÄUôÔ5ô•ô´U’ÇÂ""’çG&–Ò‚“° ¢&W2æ§6öâ‡²vöövÆTÖ4”¶W’Ò“°¢Ò“° ¢òò6öÆ"c¢&÷f–FW"v÷&¶&Væ6‚W7F–ÖFRVæGö–çB†6öçG&7F÷"ÖWF‚öæÇ’’à¢ç÷7B‚"ö’÷6öÆ"÷&÷f–FW"öW7F–ÖFR"Â—4WF†VçF–6FVBÂ—46öçG&7F÷"Â‡&W¢ç’Â&W3¢ç’’Óâ°¢G'’°¢–b‚—56öÆ%cVæ&ÆVB‚’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6öÆ"c—2F—6&ÆVB"Â6öFS¢$dTEU$UôD•4$ÄTB"Ò“°¢Ð ¢6öç7BÆBÒçVÖ&W"‡&Wæ&öG“òæÆB“°¢6öç7BÆærÒçVÖ&W"‡&Wæ&öG“òæÆær“°¢–b‚çVÖ&W"æ—4f–æ—FR†ÆB’ÇÂçVÖ&W"æ—4f–æ—FR†Æær’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢&ÆBæBÆær&R&WV—&VBçVÖW&–2f–VÆG2"Ò“°¢Ð ¢6öç7BW7F–ÖFRÒ'V–ÆE6öÆ%&÷f–FW$W7F–ÖFR‡°¢ÆBÀ¢ÆærÀ¢ÖöçF†Ç”&–ÆÅW6C¢&Wæ&öG“òæÖöçF†Ç”&–ÆÅW6BÀ¢6÷VçG”f—3¢&Wæ&öG“òæ6÷VçG”f—2À¢7FFT6öFS¢&Wæ&öG“òç7FFT6öFRÀ¢Ò“° ¢&WGW&â&W2ç7FGW2ƒ#’æ§6öâ‡°¢W7F–ÖFRÀ¢ÖöFS¢'&÷f–FW%÷v÷&¶&Væ6…÷c"À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"'V–ÆF–ær&÷f–FW"6öÆ"W7F–ÖFS¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò'V–ÆB&÷f–FW"6öÆ"W7F–ÖFR"Ò“°¢Ð¢Ò“° ¢òò6öÆ"c¢V&Æ–2&VBÖöæÇ’&–6R&ævRVæGö–çB†æò6öçF7Bö7F–öâWF†÷&—G’’à¢ævWB‚"ö’÷V&Æ–2÷6öÆ"÷&–6R×&ævR"Â‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢–b‚—56öÆ%cVæ&ÆVB‚’’°¢&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢%6öÆ"c—2F—6&ÆVB"Â6öFS¢$dTEU$UôD•4$ÄTB"Ò“°¢Ð ¢6öç7B6÷VçG”f—2Ð¢G—Vöb&WçVW'’æ6÷VçG”f—2ÓÓÒ'7G&–ær"ò&WçVW'’æ6÷VçG”f—2çG&–Ò‚’¢VæFVf–æVC°¢6öç7B7FFT6öFRÐ¢G—Vöb&WçVW'’ç7FFT6öFRÓÓÒ'7G&–ær"ò&WçVW'’ç7FFT6öFRçG&–Ò‚’¢VæFVf–æVC° ¢6öç7B–ç6–v‡BÒ'V–ÆEV&Æ–56öÆ%&–6T–ç6–v‡B‡²6÷VçG”f—2Â7FFT6öFRÒ“° ¢&W2ç6WD†VFW"‚$66†RÔ6öçG&öÂ"Â'V&Æ–2ÂÖ‚ÖvSÓ3Â7FÆR×v†–ÆR×&WfÆ–FFSÓ3"“°¢&WGW&â&W2ç7FGW2ƒ#’æ§6öâ‡²–ç6–v‡BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"'V–ÆF–ærV&Æ–26öÆ"&–6R&ævS¢"ÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò'V–ÆB6öÆ"&–6R&ævR"Ò“°¢Ð¢Ò“° ¢òò"âÔU54t”är¢òòæ÷FS¢ö’ö6öçfW'6F–öç2†æFÆW'2Æ—fRV&Æ–W"VæFW"$6†B7—7FVÒ&÷WFW2"à ¢òò2â5E$•R”ÔTåBÒ6WGWVæGö–ç@¢ç÷7B‚"ö’÷–ÖVçG2ö–çFVçB"Â—4WF†VçF–6FVBÂ7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B7G&—RÒvWE7G&—T6Æ–VçB‚“°¢–b‚7G&—R’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢%7G&—Ræ÷B6öæf–wW&VB"Ò“°¢Ð ¢6öç7B²Ö÷VçBÂ7W'&Væ7’Ò'W6B"ÂFW67&—F–öâÒÒ&Wæ&öG“°¢6öç7BW6W$–BÒ&WçW6W#òæ–Bóò'Væ¶æ÷vâ#° ¢–b‚Ö÷VçBÇÂÖ÷VçBÂ’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$–çfÆ–BÖ÷VçB"Ò“°¢Ð ¢6öç7B–çFVçBÒv—B7G&—Rç–ÖVçD–çFVçG2æ7&VFR‡°¢Ö÷VçC¢ÖF‚ç&÷VæB†Ö÷VçB¢’Âòò6öçfW'BFò6VçG0¢7W'&Væ7’À¢FW67&—F–öâÀ¢ÖWFFF¢°¢W6W$–BÀ¢F–ÖW7F×¢æWrFFR‚’çFô•4õ7G&–ær‚’À¢ÒÀ¢Ò“° ¢&W2æ§6öâ‡°¢6Æ–VçE6V7&WC¢–çFVçBæ6Æ–VçE÷6V7&WBÀ¢–çFVçD–C¢–çFVçBæ–BÀ¢Ö÷VçC¢–çFVçBæÖ÷VçBÀ¢7FGW3¢–çFVçBç7FGW2À¢Ò“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"7&VF–ær–ÖVçB–çFVçC¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò7&VFR–ÖVçB–çFVçB"Ò“°¢Ð¢Ò“° ¢òò6–×ÆR7—7FVÒ×v–FR†VÇF‚²6&–Æ—G’6æ6†÷@¢ævWB‚"ö’÷7—7FVÒö†VÇF‚"Â7–æ2‡&W¢WF†VE&WVW7BÂ&W3¢&W7öç6R’Óâ°¢6öç7B62Ò&W6öÇfT6&–Æ—F–W2‡&W“° ¢òò&6–2D"&V6†&–Æ—G’6†V6³¢Fòæ÷BF‡&÷rÂ§W7B&VfÆV7BFVw&FVBöâf–ÇW&P¢ÆWBF%7FGW3¢6&–Æ—G•7FGW2Ò62æ66÷VçF–æs°¢G'’°¢v—BF"ç6VÆV7B‡²–C¢W6W'2æ–BÒ’æg&öÒ‡W6W'2’æÆ–Ö—Bƒ“°¢F%7FGW2Ò&ö²#°¢Ò6F6‚°¢F%7FGW2Ò&FVw&FVB#°¢Ð ¢&W2æ§6öâ‡°¢66÷VçF–æs¢F%7FGW2À¢FÖ–ã¢62æFÖ–âÀ¢Ò“°¢Ò“° ¢òòBâ4TäDu$”BTÔ”ÂÒ6WGWVæGö–ç@¢ç÷7B‚"ö’öVÖ–Â÷6VæB"Â—4FÖ–âÂ7–æ2‡&W¢&WVW7BÂ&W3¢&W7öç6R’Óâ°¢G'’°¢6öç7B°¢FòÀ¢7V&¦V7BÀ¢‡FÖÂÀ¢FW‡BÀ¢g&öÒÒ&ö6W72æVçbå4TäDu$”Eôe$ôÕôTÔ”ÂÀ¢62À¢&62À¢&WÇ•FòÀ¢ÒÒ&Wæ&öG“° ¢–b‚FòÇÂ7V&¦V7BÇÂ†‡FÖÂÇÂFW‡B’’°¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ÖW76vS¢$Ö—76–ær&WV—&VBf–VÆG2"Ò“°¢Ð ¢–b‚VÖ–Å6W'f–6Ræ—46öæf–wW&VB‚’’°¢&WGW&â&W2ç7FGW2ƒS2’æ§6öâ‡²ÖW76vS¢%6VæDw&–Bæ÷B6öæf–wW&VB"Ò“°¢Ð ¢6öç7B&W7VÇBÒv—BVÖ–Å6W'f–6Rç6VæDVÖ–Â‡°¢FòÀ¢7V&¦V7BÀ¢‡FÖÂÀ¢FW‡BÀ¢g&öÒÀ¢62À¢&62À¢&WÇ•FòÀ¢W'÷6S¢&FÖ–åöÖçVÂ"À¢Ò“° ¢&W2æ§6öâ‡²ÖW76vS¢$VÖ–Â6VçB7V66W76gVÆÇ’"ÂÖW76vT–C¢&W7VÇBæÖW76vT–BÒ“°¢Ò6F6‚†W'&÷#¢ç’’°¢6öç6öÆRæW'&÷"‚$W'&÷"6VæF–ærVÖ–Ã¢"ÂW'&÷"“°¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢$f–ÆVBFò6VæBVÖ–Â"Ò“°¢Ð¢Ò“° ¢&WGW&â‡GG6W'fW#°§Ð