import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import {
  businesses,
  contactPermissionEvents,
  contactPermissions,
  decisionCards,
  notifications,
  profiles,
  users,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { storage } from "../storage";
import { emailService, maskEmailForLog } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
import { notificationService } from "../notification-service";
import { notifySuperAdminsOfDirectConnectRequest } from "../services/directConnectBetaOversight";
import {
  canExposePublishedProfilePublicly,
  hasTradeScoutPendingOwnerCustody,
} from "../services/ownerConfirmedDirectProfile";
import { durableProfessionalProfileApprovalSql } from "../services/profileTargetAuthority";
import { hasDirectConnectPhone } from "../services/directConnectPhone";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { isReservedSignupIdentityEmail } from "../utils/authorityPolicy";
import { ensureSuperAdminConnectionForUser } from "../utils/superAdminConnection";
import { redactContactDetails } from "../utils/workRequestShare";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";
import { ISSA_BUILD_LEGACY_PROFILE_SLUG, ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";
import { resolveJwStonePublicRequestName } from "@shared/jwStonePresentation";
import {
  JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT,
  sanitizeJwStoneDirectConnectSelections,
} from "@shared/jwStoneDirectConnect";
import { DiscoveryObservatoryService } from "../services/discoveryObservatoryService";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: any };
};

const discoveryObservatory = new DiscoveryObservatoryService(pool, async (eventType, data) =>
  storage.logEvent(eventType, data)
);

const EXPRESS_REQUEST_TYPES = [
  "request_material",
  "match_project",
  "ask_about_bundle",
  "schedule_showroom",
  "request_service",
  "request_quote",
  "ask_question",
  "schedule_service",
  "other",
] as const;

const requestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a phone number.")
      .max(40)
      .refine((value) => hasDirectConnectPhone(value), "Enter a complete phone number."),
    requestType: z.enum(EXPRESS_REQUEST_TYPES),
    contactPreference: z.enum(["platform_message", "call"]).default("platform_message"),
    message: z.string().trim().min(10).max(3000),
    stoneName: z.string().trim().max(180).optional(),
    serviceName: z.string().trim().max(180).optional(),
    /** Stable material slug (e.g. multi-green-onyx). Preferred over display name for source context. */
    itemId: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    stoneSelections: z
      .array(
        z
          .object({
            itemId: z
              .string()
              .trim()
              .max(120)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            stoneName: z.string().trim().min(1).max(180),
          })
          .strict()
      )
      .min(2)
      .max(JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT)
      .optional(),
    // Quiet bot trap. Real browsers never populate this hidden field.
    website: z.string().max(0).optional(),
    // Explicit marketing consent. Default unchecked on the client; never
    // treat absence as opt-in.
    updatesOptIn: z.boolean().optional(),
    discoveryAttributionToken: z
      .string()
      .trim()
      .max(4096)
      .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();

type TradePartnerTarget = {
  profileId: string;
  profileSlug: string;
  businessId: string;
  businessName: string;
  ownerUserId: string;
  // Where new-request emails go. Prefer profileData.notificationEmail
  // (shared inbox), then profileData.email, then the owner login email.
  notificationEmail: string;
  deliveryCustody: "business" | "tradescout_pending_owner";
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "TradeScout",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function requestTitle(requestType: (typeof EXPRESS_REQUEST_TYPES)[number], businessName: string) {
  const labels: Record<(typeof EXPRESS_REQUEST_TYPES)[number], string> = {
    request_material: "Material request",
    match_project: "Stone selection for a project",
    ask_about_bundle: "Bundle availability request",
    schedule_showroom: "Showroom visit request",
    request_service: "Service request",
    request_quote: "Quote request",
    ask_question: "Business question",
    schedule_service: "Service scheduling request",
    other: "Direct request",
  };
  return `${labels[requestType]} for ${businessName}`.slice(0, 180);
}

const EXPRESS_AUTHORITY_GATE = "decision_card";
const EXPRESS_AUTHORITY_INTENT = "hire";

export class ExpressContactAuthorityError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ExpressContactAuthorityError";
  }
}

type ExpressContactAuthorityResult = {
  sourceDecisionCardId: string;
  contactPermissionId: string;
  contactRequestNotificationId: string;
  intent: typeof EXPRESS_AUTHORITY_INTENT;
  decisionScope: string;
  contactGateState: "pending_provider_response";
  permissionDisposition: "created_pending" | "accepted_reused";
};

export async function createExpressDirectConnectAuthority(
  tx: any,
  params: {
    workRequestId: string;
    requesterUserId: string;
    providerUserId: string;
    profileId: string;
    profileSlug: string;
    businessId: string;
    title: string;
    description: string;
    contactPreference: "platform_message" | "call";
    now: Date;
  }
): Promise<ExpressContactAuthorityResult> {
  const pairLockKey = `${params.requesterUserId}:${params.providerUserId}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${pairLockKey}, 0))`);
  const existingResult = await tx.execute(sql`
    SELECT *
    FROM contact_permissions
    WHERE requester_id = ${params.requesterUserId}
      AND target_user_id = ${params.providerUserId}
    FOR UPDATE
  `);
  const existingPermission = (existingResult.rows?.[0] as any) || null;
  const existingStatus = existingPermission ? String(existingPermission.status || "pending") : null;
  const existingCooldown = existingPermission
    ? (existingPermission.cooldownUntil ?? existingPermission.cooldown_until)
    : null;
  const cooldownUntil = existingCooldown ? new Date(existingCooldown) : null;
  const hasActiveCooldown = Boolean(
    cooldownUntil && Number.isFinite(cooldownUntil.getTime()) && cooldownUntil > params.now
  );

  if (existingStatus === "blocked") {
    throw new ExpressContactAuthorityError(
      403,
      "EXPRESS_CONTACT_BLOCKED",
      "This contact relationship is blocked."
    );
  }
  if (hasActiveCooldown) {
    throw new ExpressContactAuthorityError(
      409,
      "EXPRESS_CONTACT_COOLDOWN_ACTIVE",
      "A contact cooldown is still active for this provider."
    );
  }
  // contact_permissions is pair-unique on (requester_id, target_user_id), so a
  // second scoped pending/declined authority cannot be represented without
  // overwriting the first scope. Fail closed. Supporting concurrent/retry
  // scopes requires a migration that keeps contact_permissions as the pair-level
  // relationship and adds contact_permission_authorities with unique
  // source_decision_card_id and work_request_id FKs plus decision_scope, intent,
  // status, responded_by/at, and cooldown fields.
  if (existingStatus === "pending") {
    throw new ExpressContactAuthorityError(
      409,
      "EXPRESS_CONTACT_ALREADY_PENDING",
      "A contact request for this provider is already awaiting a response."
    );
  }
  if (existingStatus === "declined") {
    throw new ExpressContactAuthorityError(
      403,
      "EXPRESS_CONTACT_PREVIOUSLY_DECLINED",
      "This contact relationship was previously declined."
    );
  }
  if (existingStatus && existingStatus !== "accepted") {
    throw new ExpressContactAuthorityError(
      409,
      "EXPRESS_CONTACT_AUTHORITY_CONFLICT",
      "The existing contact authority cannot be safely reused."
    );
  }

  const decisionScope = JSON.stringify({
    kind: "tradepartner_profile_express",
    workRequestId: params.workRequestId,
    requesterUserId: params.requesterUserId,
    providerUserId: params.providerUserId,
    profileId: params.profileId,
    profileSlug: params.profileSlug,
    businessId: params.businessId,
    contactPreference: params.contactPreference,
  });
  const [decisionCard] = await tx
    .insert(decisionCards)
    .values({
      userId: params.requesterUserId,
      status: "active",
      intent: EXPRESS_AUTHORITY_INTENT,
      decisionScope,
      title: params.title,
      description: params.description,
      createdAt: params.now,
      updatedAt: params.now,
      decidedAt: null,
    })
    .returning({ id: decisionCards.id });
  if (!decisionCard?.id) {
    throw new ExpressContactAuthorityError(
      500,
      "EXPRESS_DECISION_CARD_CREATE_FAILED",
      "The contact Decision Card could not be created."
    );
  }

  const [contactRequestNotification] = await tx
    .insert(notifications)
    .values({
      userId: params.providerUserId,
      type: "new_project_request",
      priority: "normal",
      title:
        params.contactPreference === "call"
          ? "New protected call request"
          : "New Direct Connect request",
      message:
        params.contactPreference === "call"
          ? "A requester asked you to call after you accept their Direct Connect request."
          : "A requester is waiting for your response in Direct Connect.",
      actionUrl: "/direct-connect/inbox",
      actionText: "Open request",
      iconName: "briefcase",
      iconColor: "orange",
      deliveryMethods: ["in_app", "push"],
      metadata: {
        kind: "express_contact_authority_request",
        workRequestId: params.workRequestId,
        requesterUserId: params.requesterUserId,
        providerUserId: params.providerUserId,
        profileId: params.profileId,
        profileSlug: params.profileSlug,
        businessId: params.businessId,
        sourceDecisionCardId: String(decisionCard.id),
        intent: EXPRESS_AUTHORITY_INTENT,
        decisionScope,
        contactPreference: params.contactPreference,
        contactGateState: "pending_provider_response",
      },
      createdAt: params.now,
      updatedAt: params.now,
    })
    .returning({ id: notifications.id });
  const contactRequestNotificationId = String(contactRequestNotification?.id || "");
  if (!contactRequestNotificationId) {
    throw new ExpressContactAuthorityError(
      500,
      "EXPRESS_CONTACT_NOTIFICATION_CREATE_FAILED",
      "The provider contact request notification could not be created."
    );
  }

  let contactPermissionId = String(
    existingPermission?.id ?? existingPermission?.contactPermissionId ?? ""
  );
  const permissionDisposition =
    existingStatus === "accepted" ? "accepted_reused" : "created_pending";
  // The pair-level relationship may already be accepted, but this new scoped
  // request remains pending until its assigned provider responds.
  const contactGateState = "pending_provider_response" as const;

  if (!existingPermission) {
    const [permission] = await tx
      .insert(contactPermissions)
      .values({
        requesterId: params.requesterUserId,
        targetUserId: params.providerUserId,
        status: "pending",
        lastRequestType: params.contactPreference === "call" ? "call" : "message",
        lastRequestPreview: params.description.slice(0, 280) || null,
        lastRequestNotificationId: contactRequestNotificationId,
        authorityGate: EXPRESS_AUTHORITY_GATE,
        sourceDecisionCardId: String(decisionCard.id),
        sourceScoutRecommendationId: null,
        intent: EXPRESS_AUTHORITY_INTENT,
        decisionScope,
        respondedAt: null,
        respondedBy: null,
        responseReason: null,
        cooldownUntil: null,
        createdAt: params.now,
        updatedAt: params.now,
      })
      .returning({ id: contactPermissions.id });
    contactPermissionId = String(permission?.id || "");
  }
  if (!contactPermissionId) {
    throw new ExpressContactAuthorityError(
      500,
      "EXPRESS_CONTACT_PERMISSION_CREATE_FAILED",
      "The contact permission could not be created."
    );
  }

  await tx.insert(contactPermissionEvents).values({
    contactPermissionId,
    requesterId: params.requesterUserId,
    targetUserId: params.providerUserId,
    actorId: params.requesterUserId,
    eventType:
      permissionDisposition === "accepted_reused"
        ? "express_authority_reused"
        : "express_authority_created",
    fromStatus: permissionDisposition === "accepted_reused" ? "accepted" : null,
    toStatus: permissionDisposition === "accepted_reused" ? "accepted" : "pending",
    reasonCode:
      permissionDisposition === "accepted_reused" ? "existing_accepted_relationship" : null,
    metadata: {
      workRequestId: params.workRequestId,
      profileId: params.profileId,
      profileSlug: params.profileSlug,
      businessId: params.businessId,
      providerUserId: params.providerUserId,
      contactPreference: params.contactPreference,
      contactRequestNotificationId,
      contactGateState,
      permissionDisposition,
    },
    authorityGate: EXPRESS_AUTHORITY_GATE,
    sourceDecisionCardId: String(decisionCard.id),
    sourceScoutRecommendationId: null,
    intent: EXPRESS_AUTHORITY_INTENT,
    decisionScope,
  });

  return {
    sourceDecisionCardId: String(decisionCard.id),
    contactPermissionId,
    contactRequestNotificationId,
    intent: EXPRESS_AUTHORITY_INTENT,
    decisionScope,
    contactGateState,
    permissionDisposition,
  };
}

async function resolveTradePartnerTarget(slug: string): Promise<TradePartnerTarget | null> {
  const requestedSlug = String(slug || "")
    .trim()
    .toLowerCase();
  const normalizedSlug =
    requestedSlug === ISSA_BUILD_LEGACY_PROFILE_SLUG ? ISSA_BUILD_PROFILE_SLUG : requestedSlug;
  if (!normalizedSlug) return null;

  const [row] = await db
    .select({
      profileId: profiles.id,
      profilePubliclyReleased: profiles.publiclyReleased,
      profileSlug: profiles.slug,
      profileStatus: profiles.status,
      profileRoleContext: profiles.roleContext,
      profileHeadline: profiles.headline,
      profileContentBlocks: profiles.contentBlocks,
      ownerUserId: profiles.ownerUserId,
      businessId: businesses.id,
      businessName: businesses.name,
      businessOwnerUserId: businesses.ownerUserId,
      businessStatus: businesses.status,
      businessClaimStatus: businesses.claimStatus,
      businessSources: businesses.sources,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      profileData: businesses.profileData,
      ownerProvider: users.provider,
      ownerPreferences: users.preferences,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerEmail: users.email,
      professionalRoleApproved: durableProfessionalProfileApprovalSql,
    })
    .from(profiles)
    .innerJoin(businesses, eq(profiles.businessId, businesses.id))
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .where(eq(profiles.slug, normalizedSlug))
    .limit(1);

  const directProfileCandidate = {
    profileSlug: row?.profileSlug,
    profileStatus: row?.profileStatus,
    profilePubliclyReleased: row?.profilePubliclyReleased,
    profileRoleContext: row?.profileRoleContext,
    profileHeadline: row?.profileHeadline,
    profileContentBlocks: row?.profileContentBlocks,
    profileOwnerUserId: row?.ownerUserId,
    businessStatus: row?.businessStatus,
    businessOwnerUserId: row?.businessOwnerUserId,
    publicDiscoveryEnabled: row?.publicDiscoveryEnabled,
    businessSources: row?.businessSources,
    businessClaimStatus: row?.businessClaimStatus,
    ownerProvider: row?.ownerProvider,
    ownerPreferences: row?.ownerPreferences,
    professionalRoleApproved: row?.professionalRoleApproved,
  };
  const deliveryCustody = hasTradeScoutPendingOwnerCustody(directProfileCandidate)
    ? "tradescout_pending_owner"
    : "business";
  const profileData = (row?.profileData || {}) as Record<string, any>;
  // Business-facing request mail must not silently no-op when only the
  // owner login email exists. Prefer an explicit shared inbox, then any
  // stored business email, then the account owner.
  const notificationEmail = normalizeEmail(
    profileData.notificationEmail || profileData.email || row?.ownerEmail || ""
  );
  if (
    !row ||
    String(row.businessStatus) !== "active" ||
    !canExposePublishedProfilePublicly({
      profileId: row.profileId,
      businessId: row.businessId,
      ...directProfileCandidate,
      ownerVerifiedBadge: row.ownerVerifiedBadge,
      ownerVerificationStatus: row.ownerVerificationStatus,
    })
  ) {
    return null;
  }

  return {
    profileId: String(row.profileId),
    profileSlug: String(row.profileSlug),
    businessId: String(row.businessId),
    businessName: String(row.businessName),
    ownerUserId: String(row.ownerUserId),
    notificationEmail,
    deliveryCustody,
  };
}

export function registerTradePartnerExpressRoutes(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const noopLimiter: any = (_req: Request, _res: Response, next: () => void) => next();
  const store = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix,
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
    });
  const keyGenerator = (req: OptionalAuthedRequest) => {
    const userId = req.user?.id || req.user?.claims?.sub;
    return userId ? `u:${userId}` : String(req.ip || "unknown");
  };
  const revealLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: store("tradepartner_express_reveal"),
      })
    : noopLimiter;
  const submitLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 8,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: store("tradepartner_express_submit"),
      })
    : noopLimiter;

  // Keep every legacy ISSA Build contact action on the canonical profile.
  // The method-preserving redirect retains POST bodies and query context;
  // resolveTradePartnerTarget also canonicalizes as defense in depth.
  app.use("/api/tradepartner-profiles/:slug", (req, res, next) => {
    const slug = String(req.params.slug || "")
      .trim()
      .toLowerCase();
    if (slug !== ISSA_BUILD_LEGACY_PROFILE_SLUG) return next();

    const remainingUrl = String(req.url || "");
    const suffix =
      remainingUrl === "/"
        ? ""
        : remainingUrl.startsWith("/?")
          ? remainingUrl.slice(1)
          : remainingUrl;
    const canonicalUrl = `/api/tradepartner-profiles/${ISSA_BUILD_PROFILE_SLUG}${suffix}`;
    return res.redirect(308, canonicalUrl);
  });

  // Compatibility tombstone for clients that still call the former public
  // phone-reveal endpoint. A caller-asserted literal is not durable authority,
  // so this endpoint never resolves a profile or returns contact data. Call
  // intent must be submitted through the private Express request lifecycle.
  app.post(
    "/api/tradepartner-profiles/:slug/express-contact/reveal",
    revealLimiter,
    (_req: OptionalAuthedRequest, res: Response) => {
      return res.status(410).json({
        code: "DIRECT_CONNECT_REQUEST_REQUIRED",
        contactPreference: "call",
        nextAction: "submit_express_request",
        message:
          "Request a call through Direct Connect. Contact stays gated until the business responds.",
      });
    }
  );

  app.post(
    "/api/tradepartner-profiles/:slug/express-request",
    submitLimiter,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const parsed = requestSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({
            message: "Enter your name, email, phone number, and request details.",
            issues: parsed.error.flatten(),
          });
        }
        const target = await resolveTradePartnerTarget(req.params.slug);
        if (!target) return res.status(404).json({ message: "Profile not found." });

        const body = parsed.data;
        const verifiedDiscoveryAttribution = body.discoveryAttributionToken
          ? verifyDiscoveryAttributionToken(body.discoveryAttributionToken, {
              businessSlug: target.profileSlug,
            })
          : null;
        if (body.discoveryAttributionToken && !verifiedDiscoveryAttribution) {
          return res.status(400).json({ message: "This discovery link is no longer valid." });
        }
        if (body.stoneSelections && (body.itemId || body.stoneName)) {
          return res.status(400).json({
            message: "Use either one stone or a saved-stone selection, not both.",
          });
        }
        const publicStoneName = resolveJwStonePublicRequestName({
          profileSlug: target.profileSlug,
          itemId: body.itemId,
          stoneName: body.stoneName,
        });
        const publicStoneSelections = sanitizeJwStoneDirectConnectSelections({
          profileSlug: target.profileSlug,
          selections: body.stoneSelections,
        });
        if (body.stoneSelections && publicStoneSelections.length < 2) {
          return res.status(400).json({
            message: "Choose at least two named stones for a saved-selection request.",
          });
        }
        const email = normalizeEmail(body.email);
        const { firstName, lastName } = splitName(body.name);
        const viewerId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!viewerId && isReservedSignupIdentityEmail(email)) {
          // Use the same response as any logged-out existing account. Reserved
          // recovery identifiers must never enter guest onboarding, but the
          // public endpoint must not reveal whether an address is privileged.
          return res.status(401).json({
            code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
            message: "Sign in to continue with this email.",
          });
        }
        let requester: Awaited<ReturnType<typeof storage.getUser>> | null = null;
        if (viewerId) {
          requester = await storage.getUser(viewerId);
          if (!requester) {
            return res.status(401).json({
              code: "SESSION_USER_NOT_FOUND",
              message: "Your session is no longer valid. Sign in again.",
            });
          }

          const authenticatedEmail = normalizeEmail(requester.email);
          if (!authenticatedEmail || authenticatedEmail !== email) {
            return res.status(400).json({
              code: "AUTHENTICATED_EMAIL_MISMATCH",
              message: "Use the email address for your signed-in account.",
            });
          }
        } else {
          requester = await storage.getUserByEmail(email);
          if (requester) {
            return res.status(401).json({
              code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
              message: "Sign in to continue with this email.",
            });
          }
        }

        if (requester && String(requester.id) === String(target.ownerUserId)) {
          return res.status(400).json({
            code: "EXPRESS_SELF_REQUEST_NOT_ALLOWED",
            message: "You cannot send a Direct Connect request to your own business profile.",
          });
        }

        const requesterWasCreated = !requester;
        const authenticatedRequester = requester;
        const updatesOptIn = body.updatesOptIn === true;
        const sanitizedMessage = redactContactDetails(body.message).trim();
        const title =
          body.contactPreference === "call"
            ? `Call request for ${target.businessName}`.slice(0, 180)
            : requestTitle(body.requestType, target.businessName);
        const now = new Date();
        const guestPreferences = {
          // Targeting later uses preferences.marketingEmails (admin segments).
          // No ESP sync is claimed here — consent is stored truthfully.
          marketingEmails: updatesOptIn,
          provisional: {
            userTypes: ["homeowner"],
            source: "tradepartner_profile_express_request",
            capturedAt: now.toISOString(),
          },
          ...(updatesOptIn
            ? {
                marketingConsent: {
                  source: "tradepartner_profile_express_request",
                  profileSlug: target.profileSlug,
                  businessId: target.businessId,
                  topics: ["new_arrivals", "first_cuts", "promotions"],
                  optedInAt: now.toISOString(),
                },
              }
            : {}),
        };
        const authenticatedUpdates: Record<string, any> = {};
        if (authenticatedRequester) {
          // Existing accounts reach this branch only through their authoritative
          // authenticated session with a matching normalized email.
          if (!authenticatedRequester.firstName) authenticatedUpdates.firstName = firstName;
          if (!authenticatedRequester.lastName && lastName) {
            authenticatedUpdates.lastName = lastName;
          }
          // The submitted number is the requester's explicit callback choice
          // for this request lifecycle. Its mutation is committed only with the
          // exact request and authority that can later release it.
          if (String(authenticatedRequester.phone || "").trim() !== body.phone.trim()) {
            authenticatedUpdates.phone = body.phone;
          }
          if (updatesOptIn) {
            const existingPreferences =
              authenticatedRequester.preferences &&
              typeof authenticatedRequester.preferences === "object"
                ? (authenticatedRequester.preferences as Record<string, any>)
                : {};
            authenticatedUpdates.preferences = {
              ...existingPreferences,
              marketingEmails: true,
              marketingConsent: {
                source: "tradepartner_profile_express_request",
                profileSlug: target.profileSlug,
                businessId: target.businessId,
                topics: ["new_arrivals", "first_cuts", "promotions"],
                optedInAt: now.toISOString(),
              },
            };
          }
        }

        const {
          request: created,
          authority,
          requester: committedRequester,
        } = await db.transaction(async (tx: any) => {
          let transactionRequester = authenticatedRequester as any;
          if (!transactionRequester) {
            [transactionRequester] = await tx
              .insert(users)
              .values({
                email,
                firstName,
                lastName,
                phone: body.phone,
                role: "homeowner" as any,
                roles: ["homeowner"],
                activeRole: "homeowner",
                provider: "express_profile",
                emailVerified: false,
                addressVerified: false,
                onboardingCompleted: false,
                preferences: guestPreferences,
              } as any)
              .returning();
            if (!transactionRequester?.id) {
              throw new ExpressContactAuthorityError(
                500,
                "EXPRESS_REQUESTER_CREATE_FAILED",
                "The requester account could not be created."
              );
            }
          } else if (Object.keys(authenticatedUpdates).length > 0) {
            const [updatedRequester] = await tx
              .update(users)
              .set({ ...authenticatedUpdates, updatedAt: now })
              .where(eq(users.id, String(transactionRequester.id)))
              .returning();
            if (!updatedRequester?.id) {
              throw new ExpressContactAuthorityError(
                409,
                "EXPRESS_REQUESTER_UPDATE_CONFLICT",
                "The requester account changed before this request was saved."
              );
            }
            transactionRequester = updatedRequester;
          }
          const requesterId = String(transactionRequester.id);
          const [request] = await tx
            .insert(workRequests)
            .values({
              createdByUserId: requesterId,
              title,
              description: sanitizedMessage,
              category: "business_request",
              scope: "personal",
              source: "direct_connect",
              sourceRefId: target.profileId,
              status: "routed",
              visibility: "private",
              exposureMode: "guided",
              competitionMode: "none",
            })
            .returning();

          const authority = await createExpressDirectConnectAuthority(tx, {
            workRequestId: String(request.id),
            requesterUserId: requesterId,
            providerUserId: target.ownerUserId,
            profileId: target.profileId,
            profileSlug: target.profileSlug,
            businessId: target.businessId,
            title,
            description: sanitizedMessage,
            contactPreference: body.contactPreference,
            now,
          });

          await tx.insert(workRequestAssignments).values({
            workRequestId: request.id,
            contractorId: null,
            responderUserId: target.ownerUserId,
            status: "invited",
            scoreSnapshot: {
              routingMode: "tradepartner_profile_express",
              reasons: ["Visitor selected this business from its clean profile link."],
            },
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(workRequestEvents).values([
            {
              workRequestId: request.id,
              type: "created",
              actorUserId: requesterId,
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                profileId: target.profileId,
                businessId: target.businessId,
                businessSlug: target.profileSlug,
                ...(verifiedDiscoveryAttribution
                  ? { entryRequestId: verifiedDiscoveryAttribution.entryRequestId }
                  : {}),
                requestType: body.requestType,
                contactPreference: body.contactPreference,
                authorityGate: EXPRESS_AUTHORITY_GATE,
                sourceDecisionCardId: authority.sourceDecisionCardId,
                contactPermissionId: authority.contactPermissionId,
                contactRequestNotificationId: authority.contactRequestNotificationId,
                intent: authority.intent,
                decisionScope: authority.decisionScope,
                contactGateState: authority.contactGateState,
                contactReleaseState: authority.contactGateState,
                permissionDisposition: authority.permissionDisposition,
                stoneName: publicStoneName,
                ...(publicStoneSelections.length ? { stoneSelections: publicStoneSelections } : {}),
                serviceName: body.serviceName || null,
                itemId: body.itemId || null,
                deliveryCustody: target.deliveryCustody,
                contactCheck: "phone_required",
                updatesOptIn,
                ...(updatesOptIn
                  ? {
                      marketingConsent: {
                        topics: ["new_arrivals", "first_cuts", "promotions"],
                        profileSlug: target.profileSlug,
                      },
                    }
                  : {}),
                membershipOnboarding: requesterWasCreated
                  ? "provisional_account_created"
                  : "signed_in_account_attached",
              },
            },
            {
              workRequestId: request.id,
              type: "provider_invited",
              actorUserId: requesterId,
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                businessId: target.businessId,
                responderUserId: target.ownerUserId,
                deliveryCustody: target.deliveryCustody,
                contactPreference: body.contactPreference,
                authorityGate: EXPRESS_AUTHORITY_GATE,
                sourceDecisionCardId: authority.sourceDecisionCardId,
                contactPermissionId: authority.contactPermissionId,
                contactRequestNotificationId: authority.contactRequestNotificationId,
                intent: authority.intent,
                decisionScope: authority.decisionScope,
                contactGateState: authority.contactGateState,
                contactReleaseState: authority.contactGateState,
                permissionDisposition: authority.permissionDisposition,
              },
            },
          ]);
          return { request, authority, requester: transactionRequester };
        });
        requester = committedRequester;
        if (!requester?.id) {
          throw new ExpressContactAuthorityError(
            500,
            "EXPRESS_REQUESTER_COMMIT_MISSING",
            "The requester account was not committed with this request."
          );
        }

        if (requesterWasCreated) {
          try {
            await ensureSuperAdminConnectionForUser(String(requester.id));
          } catch (connectionError) {
            // Social support discoverability is non-authoritative and remains
            // best effort after the account/request transaction commits.
            console.error("[tradepartner-express] Failed to add support discovery follows", {
              userId: requester.id,
              error: connectionError,
            });
          }
        }

        const httpRequestId =
          String((req as any).requestId || req.get("x-request-id") || "").trim() || null;
        try {
          await discoveryObservatory.recordRequestAction({
            workRequestId: String(created.id),
            businessSlug: target.profileSlug,
            businessId: target.businessId,
            entryRequestId: verifiedDiscoveryAttribution?.entryRequestId || null,
            occurredAt: now,
          });
        } catch (observatoryError) {
          // The request is authoritative and already committed. Observatory
          // availability may never turn a successful customer action into a failure.
          console.warn("[tradepartner-express] discovery action capture failed", {
            requestId: created.id,
            error: observatoryError,
          });
        }
        const emailConfigured = emailService.isConfigured();
        let ownerNotificationStatus: "sent" | "failed" = "sent";
        let businessNotificationEmailStatus: "sent" | "skipped" | "failed" | "not_requested" =
          "not_requested";
        let businessNotificationEmailReason: string | null = target.notificationEmail
          ? null
          : "no_notification_recipient";
        let businessNotificationMessageId: string | null = null;

        console.info("[tradepartner-express] recipients resolved", {
          requestId: created.id,
          correlationId: httpRequestId,
          profileSlug: target.profileSlug,
          businessId: target.businessId,
          ownerUserId: target.ownerUserId,
          notificationRecipient: target.notificationEmail
            ? maskEmailForLog(target.notificationEmail)
            : null,
          requesterRecipient: maskEmailForLog(requester.email),
          emailConfigured,
          deliveryCustody: target.deliveryCustody,
          accountCreated: requesterWasCreated,
        });

        console.info("[tradepartner-express] owner notification attempted", {
          requestId: created.id,
          correlationId: httpRequestId,
          ownerUserId: target.ownerUserId,
          deliveryMethods: ["in_app", "push"],
        });
        try {
          // The in-app notification is created in the same transaction as the
          // Decision Card and permission. Dispatch its configured channels only
          // after commit so a delivery outage cannot orphan the authority rows.
          await notificationService.sendNotification(authority.contactRequestNotificationId);
          console.info("[tradepartner-express] owner notification queued", {
            requestId: created.id,
            correlationId: httpRequestId,
            ownerUserId: target.ownerUserId,
            deliveryMethods: ["in_app", "push"],
          });
        } catch (error) {
          // The request is already committed. A notification outage must not
          // report a false submission failure and invite duplicate requests.
          ownerNotificationStatus = "failed";
          console.warn("[tradepartner-express] owner notification failed", {
            requestId: created.id,
            correlationId: httpRequestId,
            ownerUserId: target.ownerUserId,
            error,
          });
        }

        try {
          await notifySuperAdminsOfDirectConnectRequest({
            requestId: String(created.id),
            requestTitle: title,
            businessName: target.businessName,
          });
        } catch (error) {
          console.warn("[tradepartner-express] beta admin notification failed", {
            requestId: created.id,
            correlationId: httpRequestId,
            error,
          });
        }

        // Await business notify (do not fire-and-forget). A prior regression
        // used `void sendEmail(...).catch(...)`, so 201 could return before
        // send finished and successes never logged against requestId.
        if (!emailConfigured) {
          businessNotificationEmailStatus = "skipped";
          businessNotificationEmailReason = "email_provider_not_configured";
          console.warn(
            "[tradepartner-express] business notification email skipped: email provider not configured",
            {
              requestId: created.id,
              correlationId: httpRequestId,
              businessId: target.businessId,
              reason: businessNotificationEmailReason,
            }
          );
        } else if (!target.notificationEmail) {
          businessNotificationEmailStatus = "skipped";
          businessNotificationEmailReason = "no_notification_recipient";
          console.warn(
            "[tradepartner-express] business notification email skipped: no notification recipient",
            {
              requestId: created.id,
              correlationId: httpRequestId,
              businessId: target.businessId,
              profileSlug: target.profileSlug,
              reason: businessNotificationEmailReason,
            }
          );
        } else {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const inboxUrl = `${publicBase}/direct-connect/inbox`;
          console.info("[tradepartner-express] business notification email send start", {
            requestId: created.id,
            correlationId: httpRequestId,
            purpose: "tradepartner_request_notification",
            notificationRecipient: maskEmailForLog(target.notificationEmail),
          });
          try {
            const businessEmailResult = await emailService.sendEmail({
              to: target.notificationEmail,
              subject: `New request for ${target.businessName}`,
              html: [
                `<p>${escapeHtml(body.name)} sent a request through your ${escapeHtml(target.businessName)} profile on TradeScout.</p>`,
                body.contactPreference === "call"
                  ? `<p><strong>Contact preference:</strong> Call requested</p>`
                  : "",
                publicStoneName
                  ? `<p><strong>Stone:</strong> ${escapeHtml(publicStoneName)}</p>`
                  : "",
                publicStoneSelections.length
                  ? `<p><strong>Saved stones:</strong></p><ul>${publicStoneSelections
                      .map((selection) => `<li>${escapeHtml(selection.stoneName)}</li>`)
                      .join("")}</ul>`
                  : "",
                body.serviceName
                  ? `<p><strong>Service:</strong> ${escapeHtml(body.serviceName)}</p>`
                  : "",
                `<p><strong>Request type:</strong> ${escapeHtml(requestTitle(body.requestType, target.businessName))}</p>`,
                `<p>Your public profile phone number was not exposed. Open Direct Connect to review and respond before contact continues.</p>`,
                `<p><a href=\"${inboxUrl}\">Open Direct Connect inbox</a>.</p>`,
              ]
                .filter(Boolean)
                .join("\n"),
              text: [
                `${body.name} sent a request through your ${target.businessName} profile on TradeScout.`,
                body.contactPreference === "call" ? "Contact preference: Call requested" : null,
                publicStoneName ? `Stone: ${publicStoneName}` : null,
                publicStoneSelections.length
                  ? `Saved stones:\n${publicStoneSelections
                      .map((selection) => `- ${selection.stoneName}`)
                      .join("\n")}`
                  : null,
                body.serviceName ? `Service: ${body.serviceName}` : null,
                `Request type: ${requestTitle(body.requestType, target.businessName)}`,
                "Your public profile phone number was not exposed. Review and respond before contact continues.",
                `Open Direct Connect inbox: ${inboxUrl}`,
              ]
                .filter(Boolean)
                .join("\n"),
              purpose: "tradepartner_request_notification",
              requestId: String(created.id),
              correlationId: httpRequestId,
            });
            if (businessEmailResult.skipped) {
              businessNotificationEmailStatus = "skipped";
              businessNotificationEmailReason =
                businessEmailResult.skippedReason || "suppressed_or_unconfigured";
              console.warn("[tradepartner-express] business notification email skipped", {
                requestId: created.id,
                correlationId: httpRequestId,
                reason: businessNotificationEmailReason,
                provider: businessEmailResult.provider,
                notificationRecipient: maskEmailForLog(target.notificationEmail),
              });
            } else {
              businessNotificationEmailStatus = "sent";
              businessNotificationMessageId = businessEmailResult.messageId || null;
              console.info("[tradepartner-express] business notification email sent", {
                requestId: created.id,
                correlationId: httpRequestId,
                provider: businessEmailResult.provider,
                messageId: businessNotificationMessageId,
                notificationRecipient: maskEmailForLog(target.notificationEmail),
              });
            }
          } catch (error) {
            businessNotificationEmailStatus = "failed";
            businessNotificationEmailReason = "provider_send_failed";
            console.warn("[tradepartner-express] business notification email failed", {
              requestId: created.id,
              correlationId: httpRequestId,
              notificationRecipient: maskEmailForLog(target.notificationEmail),
              reason: businessNotificationEmailReason,
              error,
            });
          }
        }

        const requestWorkspaceParams = new URLSearchParams({
          requestId: String(created.id),
          offerHomeId: "1",
          source: "profile_express",
          from: "public_profile",
          profile: target.profileSlug,
          profileName: target.businessName,
        });
        if (publicStoneName) {
          requestWorkspaceParams.set("item", publicStoneName);
        }
        if (body.itemId) {
          requestWorkspaceParams.set("itemId", body.itemId);
        }
        if (body.serviceName) {
          requestWorkspaceParams.set("service", body.serviceName);
        }
        if (publicStoneSelections.length) {
          requestWorkspaceParams.set("selectionCount", String(publicStoneSelections.length));
        }
        const requestWorkspacePath = `/direct-connect/engagements?${requestWorkspaceParams.toString()}`;
        const activation = requesterWasCreated
          ? await passwordResetService.createToken(String(requester.id))
          : null;
        const verification = requesterWasCreated
          ? await emailVerificationService.createToken(String(requester.id))
          : null;
        const onboardingPath = activation
          ? `/reset-password?token=${encodeURIComponent(activation.token)}&next=${encodeURIComponent(requestWorkspacePath)}`
          : null;
        let onboardingEmailStatus: "sent" | "skipped" | "failed" = "skipped";
        let onboardingEmailReason: string | null = null;
        let onboardingEmailMessageId: string | null = null;
        // A no-reply confirmation from TradeScout itself -- generic
        // across every business. Real back-and-forth with the business
        // happens separately, through whatever contact the business
        // owner uses, once they accept the request.
        // New accounts keep purpose account_creation (already allow-listed).
        // Signed-in existing accounts use tradepartner_request_confirmation
        // — purpose "notification" is suppressed under EMAIL_MODE=
        // account_creation_only (production).
        const requesterEmailPurpose = requesterWasCreated
          ? "account_creation"
          : "tradepartner_request_confirmation";

        if (!emailConfigured) {
          onboardingEmailStatus = "skipped";
          onboardingEmailReason = "email_provider_not_configured";
          console.warn("[tradepartner-express] requester confirmation email skipped", {
            requestId: created.id,
            correlationId: httpRequestId,
            requesterUserId: requester.id,
            purpose: requesterEmailPurpose,
            accountCreated: requesterWasCreated,
            reason: onboardingEmailReason,
            requesterRecipient: maskEmailForLog(requester.email),
          });
        } else {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const activationUrl = onboardingPath
            ? `${publicBase}${onboardingPath}`
            : `${publicBase}${requestWorkspacePath}`;
          const verificationUrl = verification
            ? `${publicBase}/verify-email?token=${verification.token}&next=${encodeURIComponent(requestWorkspacePath)}`
            : null;
          console.info("[tradepartner-express] requester confirmation email send start", {
            requestId: created.id,
            correlationId: httpRequestId,
            requesterUserId: requester.id,
            purpose: requesterEmailPurpose,
            accountCreated: requesterWasCreated,
            requesterRecipient: maskEmailForLog(requester.email),
          });
          try {
            const emailResult = await emailService.sendEmail({
              to: requester.email,
              subject:
                target.deliveryCustody === "tradescout_pending_owner"
                  ? `TradeScout received your request for ${target.businessName}`
                  : `Your request was sent to ${target.businessName}`,
              html: [
                target.deliveryCustody === "tradescout_pending_owner"
                  ? `<p>TradeScout received your request for ${escapeHtml(target.businessName)}. The owner has not connected this profile yet, so TradeScout is holding the request for owner handoff.</p>`
                  : body.contactPreference === "call"
                    ? `<p>Your protected call request was sent to ${escapeHtml(target.businessName)}. They can call using the contact information you provided after accepting the request in Direct Connect.</p>`
                    : `<p>Your request was sent directly to ${escapeHtml(target.businessName)}. They can continue contact after responding in Direct Connect.</p>`,
                "<hr />",
                requesterWasCreated
                  ? target.deliveryCustody === "tradescout_pending_owner"
                    ? "<p>We also set up a free TradeScout account so you can track the request and any owner handoff in one place.</p>"
                    : `<p>We also set up a free TradeScout account with your contact details, so you can manage this request, message ${escapeHtml(target.businessName)} directly once they respond, and track the project in one place.</p>`
                  : target.deliveryCustody === "tradescout_pending_owner"
                    ? "<p>This request is attached to your existing TradeScout account so you can track it and any owner handoff.</p>"
                    : `<p>This request is attached to your existing TradeScout account, where you can manage it, message ${escapeHtml(target.businessName)} directly once they respond, and track the project alongside anything else you're working on.</p>`,
                `<p><a href="${activationUrl}">${requesterWasCreated ? "Set up account access" : "Open My Requests"}</a>.</p>`,
                verificationUrl ? `<p><a href="${verificationUrl}">Verify your email</a>.</p>` : "",
              ].join("\n"),
              text: [
                target.deliveryCustody === "tradescout_pending_owner"
                  ? `TradeScout received your request for ${target.businessName}. The owner has not connected this profile yet, so TradeScout is holding the request for owner handoff.`
                  : body.contactPreference === "call"
                    ? `Your protected call request was sent to ${target.businessName}. They can call using the contact information you provided after accepting the request in Direct Connect.`
                    : `Your request was sent directly to ${target.businessName}. They can continue contact after responding in Direct Connect.`,
                requesterWasCreated
                  ? target.deliveryCustody === "tradescout_pending_owner"
                    ? "We also set up a free TradeScout account so you can track the request and any owner handoff in one place."
                    : `We also set up a free TradeScout account with your contact details, so you can manage this request, message ${target.businessName} directly, and track the project in one place.`
                  : target.deliveryCustody === "tradescout_pending_owner"
                    ? "This request is attached to your existing TradeScout account so you can track it and any owner handoff."
                    : `This request is attached to your existing TradeScout account, where you can manage it and message ${target.businessName} directly once they respond.`,
                `Open My Requests: ${activationUrl}`,
                verificationUrl ? `Verify your email: ${verificationUrl}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              purpose: requesterEmailPurpose,
              requestId: String(created.id),
              correlationId: httpRequestId,
            });
            onboardingEmailStatus = emailResult.skipped ? "skipped" : "sent";
            onboardingEmailReason = emailResult.skipped
              ? emailResult.skippedReason || "suppressed_or_unconfigured"
              : null;
            onboardingEmailMessageId = emailResult.messageId || null;
            if (emailResult.skipped) {
              console.warn("[tradepartner-express] requester confirmation email skipped", {
                requestId: created.id,
                correlationId: httpRequestId,
                requesterUserId: requester.id,
                purpose: requesterEmailPurpose,
                accountCreated: requesterWasCreated,
                reason: onboardingEmailReason,
                provider: emailResult.provider,
                requesterRecipient: maskEmailForLog(requester.email),
              });
            } else {
              console.info("[tradepartner-express] requester confirmation email sent", {
                requestId: created.id,
                correlationId: httpRequestId,
                requesterUserId: requester.id,
                purpose: requesterEmailPurpose,
                accountCreated: requesterWasCreated,
                provider: emailResult.provider,
                messageId: onboardingEmailMessageId,
                requesterRecipient: maskEmailForLog(requester.email),
              });
            }
          } catch (error) {
            onboardingEmailStatus = "failed";
            onboardingEmailReason = "provider_send_failed";
            console.warn("[tradepartner-express] requester onboarding email failed", {
              requestId: created.id,
              correlationId: httpRequestId,
              requesterUserId: requester.id,
              purpose: requesterEmailPurpose,
              accountCreated: requesterWasCreated,
              reason: onboardingEmailReason,
              requesterRecipient: maskEmailForLog(requester.email),
              error,
            });
          }
        }

        console.info("[tradepartner-express] contact-gated request created", {
          requestId: created.id,
          correlationId: httpRequestId,
          profileId: target.profileId,
          businessId: target.businessId,
          requesterUserId: requester.id,
          source: "tradepartner_profile",
          connectionMode: "express",
          contactPreference: body.contactPreference,
          sourceDecisionCardId: authority.sourceDecisionCardId,
          contactPermissionId: authority.contactPermissionId,
          contactRequestNotificationId: authority.contactRequestNotificationId,
          contactGateState: authority.contactGateState,
          deliveryCustody: target.deliveryCustody,
          accountCreated: requesterWasCreated,
          ownerNotificationStatus,
          businessNotificationEmailStatus,
          businessNotificationEmailReason,
          businessNotificationMessageId,
          onboardingEmailStatus,
          onboardingEmailReason,
          onboardingEmailMessageId,
          requesterEmailPurpose,
        });
        try {
          await discoveryObservatory.recordProviderDeliveryAttempt({
            workRequestId: String(created.id),
            state:
              ownerNotificationStatus === "sent" || businessNotificationEmailStatus === "sent"
                ? "target_delivery_queued_or_sent"
                : "target_delivery_not_confirmed",
            details: {
              ownerNotificationStatus,
              businessNotificationEmailStatus,
              deliveryCustody: target.deliveryCustody,
            },
          });
        } catch (observatoryError) {
          console.warn("[tradepartner-express] discovery delivery capture failed", {
            requestId: created.id,
            error: observatoryError,
          });
        }
        return res.status(201).json({
          requestId: created.id,
          status: created.status,
          businessName: target.businessName,
          contactPreference: body.contactPreference,
          contactGateState: authority.contactGateState,
          delivered: target.deliveryCustody === "business",
          deliveryCustody: target.deliveryCustody,
          accountCreated: requesterWasCreated,
          onboardingPath,
          onboardingEmailStatus,
          requestWorkspacePath,
          membershipNext: requesterWasCreated
            ? "Set up your TradeScout access to follow this request."
            : "Open My Requests to follow this request in Direct Connect.",
        });
      } catch (error) {
        if (error instanceof ExpressContactAuthorityError) {
          return res.status(error.status).json({ code: error.code, message: error.message });
        }
        console.error("[tradepartner-express] request creation failed", error);
        return res.status(500).json({ message: "The request could not be sent." });
      }
    }
  );

  // Super-admin only: verify the business-notification email path (purpose,
  // EMAIL_MODE allow-list, provider) actually delivers without creating a
  // real work request against a live TradePartner's Direct Connect inbox.
  app.post(
    "/api/admin/tradepartner-express/test-notification-email",
    isAuthenticated,
    isSuperAdmin,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const to = String(req.body?.to || "").trim();
        if (!to) return res.status(400).json({ message: "Provide a 'to' email address." });
        if (!emailService.isConfigured()) {
          return res.status(503).json({ message: "Email provider is not configured." });
        }
        const result = await emailService.sendEmail({
          to,
          subject: "TradeScout test: business notification email",
          html: "<p>This is an admin-triggered test of the tradepartner_request_notification email path. If you received this, the EMAIL_MODE allow-list and provider config are working.</p>",
          text: "This is an admin-triggered test of the tradepartner_request_notification email path. If you received this, the EMAIL_MODE allow-list and provider config are working.",
          purpose: "tradepartner_request_notification",
          correlationId:
            String((req as any).requestId || req.get("x-request-id") || "").trim() || null,
        });
        console.info("[tradepartner-express] test notification email result", {
          sent: !result.skipped,
          skipped: result.skipped,
          skippedReason: result.skippedReason || null,
          provider: result.provider,
          messageId: result.messageId || null,
          to: maskEmailForLog(to),
        });
        return res.json({
          sent: !result.skipped,
          skipped: result.skipped,
          skippedReason: result.skippedReason || null,
          messageId: result.messageId || null,
          provider: result.provider,
        });
      } catch (error) {
        console.error("[tradepartner-express] test notification email failed", error);
        return res.status(500).json({ message: "Test email failed to send." });
      }
    }
  );
}
