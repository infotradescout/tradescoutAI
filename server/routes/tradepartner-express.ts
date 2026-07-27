import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import {
  businesses,
  profiles,
  users,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { storage } from "../storage";
import { notificationService } from "../notification-service";
import { notifySuperAdminsOfDirectConnectRequest } from "../services/directConnectBetaOversight";
import { isOwnerConfirmedDirectProfile } from "../services/ownerConfirmedDirectProfile";
import { normalizeDirectConnectPhone } from "../services/directConnectPhone";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { redactContactDetails } from "../utils/workRequestShare";
import { buildWorkRequestAssignmentProviderKey } from "../utils/workRequestAssignmentProviderKey";
import { ISSA_BUILD_LEGACY_PROFILE_SLUG, ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: any };
};

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

const revealSchema = z.object({
  authorityGate: z.literal("profile_direct_connect"),
  decision: z.literal("call"),
});

const requestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    phone: z
      .string()
      .trim()
      .min(10)
      .max(40)
      .refine((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      }, "Enter a complete phone number."),
    requestType: z.enum(EXPRESS_REQUEST_TYPES),
    message: z.string().trim().min(10).max(3000),
    stoneName: z.string().trim().max(180).optional(),
    /** Stable material slug (e.g. multi-green-onyx). Preferred over display name for source context. */
    itemId: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    // Quiet bot trap. Real browsers never populate this hidden field.
    website: z.string().max(0).optional(),
  })
  .strict();

type TradePartnerTarget = {
  profileId: string;
  profileSlug: string;
  businessId: string;
  businessName: string;
  ownerUserId: string;
  ownerEmail: string;
  phone: string;
  // Where new-request emails go. Separate from the owner's login email --
  // a business may want requests routed to a shared inbox instead of
  // whatever address the account owner personally signed in with.
  notificationEmail: string;
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
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
      profileSlug: profiles.slug,
      profileStatus: profiles.status,
      ownerUserId: profiles.ownerUserId,
      businessId: businesses.id,
      businessName: businesses.name,
      businessOwnerUserId: businesses.ownerUserId,
      businessStatus: businesses.status,
      businessSources: businesses.sources,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      profileData: businesses.profileData,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerPhone: users.phone,
      ownerEmail: users.email,
    })
    .from(profiles)
    .innerJoin(businesses, eq(profiles.businessId, businesses.id))
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .where(eq(profiles.slug, normalizedSlug))
    .limit(1);

  const verificationStatus = String(row?.ownerVerificationStatus || "").toLowerCase();
  const ownerDiscoverable = row?.ownerVerifiedBadge === true || verificationStatus === "approved";
  const ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile({
    profileSlug: row?.profileSlug,
    profileStatus: row?.profileStatus,
    profileOwnerUserId: row?.ownerUserId,
    businessStatus: row?.businessStatus,
    businessOwnerUserId: row?.businessOwnerUserId,
    publicDiscoveryEnabled: row?.publicDiscoveryEnabled,
    businessSources: row?.businessSources,
  });
  const profileData = (row?.profileData || {}) as Record<string, any>;
  const phone = String(profileData.phone || row?.ownerPhone || "").trim();
  const notificationEmail = String(profileData.notificationEmail || "").trim();
  if (
    !row ||
    String(row.profileStatus) !== "published" ||
    String(row.businessStatus) !== "active" ||
    (!ownerDiscoverable && !ownerConfirmedDirectProfile)
  ) {
    return null;
  }

  return {
    profileId: String(row.profileId),
    profileSlug: String(row.profileSlug),
    businessId: String(row.businessId),
    businessName: String(row.businessName),
    ownerUserId: String(row.ownerUserId),
    ownerEmail: String(row.ownerEmail || "").trim(),
    phone,
    notificationEmail,
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

  // Clicking Direct Connect records intent; choosing Call is the decision.
  // Only then is the number returned. It never appears in the public profile.
  app.post(
    "/api/tradepartner-profiles/:slug/express-contact/reveal",
    revealLimiter,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const parsed = revealSchema.safeParse(req.body ?? {});
        if (!parsed.success) return res.status(400).json({ message: "Choose a contact option." });
        const target = await resolveTradePartnerTarget(req.params.slug);
        if (!target) return res.status(404).json({ message: "Profile not found." });
        const phone = normalizeDirectConnectPhone(target.phone);
        if (!phone) return res.status(404).json({ message: "Calling is unavailable right now." });

        console.info("[tradepartner-express] phone revealed after profile decision", {
          profileId: target.profileId,
          businessId: target.businessId,
          source: "tradepartner_profile",
          connectionMode: "express",
          actor: req.user?.id || req.user?.claims?.sub || "anonymous",
          requestId: (req as any).requestId || null,
        });
        return res.json({
          businessName: target.businessName,
          phone: phone.display,
          tel: phone.tel,
        });
      } catch (error) {
        console.error("[tradepartner-express] phone reveal failed", error);
        return res.status(500).json({ message: "Calling is unavailable right now." });
      }
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
        const email = normalizeEmail(body.email);
        const { firstName, lastName } = splitName(body.name);
        const viewerId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        let requester = viewerId ? await storage.getUser(viewerId) : null;
        if (!requester) requester = await storage.getUserByEmail(email);
        const requesterWasCreated = !requester;
        if (!requester) {
          requester = await storage.createUser({
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
            preferences: {
              provisional: {
                userTypes: ["homeowner"],
                source: "tradepartner_profile_express_request",
                capturedAt: new Date().toISOString(),
              },
            },
          } as any);
        } else if (viewerId) {
          // Only mutate an existing account when the visitor owns the current
          // authenticated session. A logged-out email match may receive the
          // request, but cannot silently replace that member's profile data.
          const updates: Record<string, any> = {};
          if (!requester.firstName) updates.firstName = firstName;
          if (!requester.lastName && lastName) updates.lastName = lastName;
          if (!requester.phone) updates.phone = body.phone;
          if (Object.keys(updates).length > 0) {
            requester = await storage.updateUser(String(requester.id), updates);
          }
        }
        const requesterNeedsSetup =
          typeof requester.password !== "string" ||
          requester.password.length === 0 ||
          requester.emailVerified !== true;

        const sanitizedMessage = redactContactDetails(body.message).trim();
        const providerVisibleName =
          redactContactDetails(body.name).trim() || "A TradeScout requester";
        const providerVisibleStoneName = body.stoneName
          ? redactContactDetails(body.stoneName).trim()
          : null;
        const title = requestTitle(body.requestType, target.businessName);
        const now = new Date();
        const providerRecipientEmail =
          normalizeEmail(target.notificationEmail) || normalizeEmail(target.ownerEmail) || null;
        const creationResult = await db.transaction(async (tx: any) => {
          const [request] = await tx
            .insert(workRequests)
            .values({
              createdByUserId: String(requester.id),
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

          await tx.insert(workRequestAssignments).values({
            workRequestId: request.id,
            providerKey: buildWorkRequestAssignmentProviderKey("business", target.businessId),
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
          const providerNotification =
            await notificationService.enqueueTradePartnerRequestNotification(tx, {
              ownerUserId: target.ownerUserId,
              workRequestId: String(request.id),
              recipientEmail: providerRecipientEmail,
              businessName: target.businessName,
              requesterDisplayName: providerVisibleName,
              requestSummary: title,
              stoneName: providerVisibleStoneName,
            });
          const requesterNotification = requesterNeedsSetup
            ? await notificationService.enqueueDirectConnectAccountSetupEmail(tx, {
                userId: String(requester.id),
                workRequestId: String(request.id),
              })
            : await notificationService.enqueueDirectConnectRequestEmail(tx, {
                userId: String(requester.id),
                workRequestId: String(request.id),
                requestTitle: title,
                metadata: {
                  notificationContext: "tradepartner_express_requester_confirmation",
                  profileId: target.profileId,
                  businessId: target.businessId,
                },
              });
          await tx.insert(workRequestEvents).values([
            {
              workRequestId: request.id,
              type: "created",
              actorUserId: String(requester.id),
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                profileId: target.profileId,
                businessId: target.businessId,
                requestType: body.requestType,
                stoneName: providerVisibleStoneName,
                itemId: body.itemId || null,
                contactCheck: "phone_required",
                membershipOnboarding: requesterWasCreated
                  ? "provisional_account_created"
                  : viewerId
                    ? "signed_in_account_attached"
                    : "existing_account_match_unverified",
              },
            },
            {
              workRequestId: request.id,
              type: "provider_invited",
              actorUserId: String(requester.id),
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                businessId: target.businessId,
                responderUserId: target.ownerUserId,
              },
            },
            {
              workRequestId: request.id,
              type: "updated",
              actorUserId: String(requester.id),
              metadata: {
                operation: "tradepartner_notification_email_dispatch",
                emailPurpose: "tradepartner_request_notification",
                deliveryStatus: providerNotification.delivery?.status || "not_requested",
                externalId: null,
                errorCode: null,
                errorMessage: null,
                provider: null,
                recipientUserId: target.ownerUserId,
                recipientTarget: target.notificationEmail
                  ? "shared_business_inbox"
                  : "owner_login_email",
                notificationId: providerNotification.notification.id,
                deliveryIntentId: providerNotification.delivery?.id || null,
              },
            },
            {
              workRequestId: request.id,
              type: "updated",
              actorUserId: String(requester.id),
              metadata: {
                operation: "tradepartner_requester_email_dispatch",
                emailPurpose: requesterNeedsSetup
                  ? "direct_connect_account_setup"
                  : "direct_connect_request",
                deliveryStatus: requesterNotification.delivery?.status || "pending",
                externalId: null,
                errorCode: null,
                errorMessage: null,
                recipientUserId: String(requester.id),
                notificationId: requesterNotification.notification.id,
                deliveryIntentId: requesterNotification.delivery?.id || null,
              },
            },
          ]);
          return {
            request,
            providerNotification,
            requesterNotification,
          };
        });
        const created = creationResult.request;

        try {
          await notifySuperAdminsOfDirectConnectRequest({
            requestId: String(created.id),
            requestTitle: title,
            businessName: target.businessName,
          });
        } catch {
          console.warn("[tradepartner-express] beta admin notification failed", {
            requestId: created.id,
          });
        }

        const dispatchDurableEmail = async (
          enqueued: typeof creationResult.providerNotification,
          channel: "provider" | "requester"
        ) => {
          if (!enqueued.delivery) return enqueued;
          try {
            return await notificationService.dispatchDirectConnectEmail(
              String(enqueued.notification.id)
            );
          } catch {
            // The durable pending row remains owned by the bounded retry lane.
            // Never log provider errors here: setup attempts may contain
            // in-memory bearer credentials and provider echoes are untrusted.
            console.warn("[tradepartner-express] durable email remains queued", {
              requestId: created.id,
              notificationId: enqueued.notification.id,
              deliveryIntentId: enqueued.delivery.id,
              channel,
            });
            return enqueued;
          }
        };
        const [providerEmailResult, requesterEmailResult] = await Promise.all([
          dispatchDurableEmail(creationResult.providerNotification, "provider"),
          dispatchDurableEmail(creationResult.requesterNotification, "requester"),
        ]);
        const providerNotificationEmailStatus =
          providerEmailResult.delivery?.status || "not_requested";
        const providerNotificationEmailErrorCode = providerEmailResult.delivery?.errorCode || null;
        const onboardingEmailStatus = requesterEmailResult.delivery?.status || "pending";

        const requestWorkspaceParams = new URLSearchParams({
          requestId: String(created.id),
          offerHomeId: "1",
          source: "profile_express",
          from: "public_profile",
          profile: target.profileSlug,
          profileName: target.businessName,
        });
        if (body.itemId) {
          requestWorkspaceParams.set("item", body.itemId);
          requestWorkspaceParams.set("itemId", body.itemId);
        } else if (providerVisibleStoneName) {
          requestWorkspaceParams.set("item", providerVisibleStoneName);
        }
        const requestWorkspacePath = `/direct-connect/engagements?${requestWorkspaceParams.toString()}`;
        const onboardingPath = requesterNeedsSetup
          ? `/pre-scout-setup?mode=signin&email=${encodeURIComponent(email)}&next=${encodeURIComponent(requestWorkspacePath)}`
          : null;

        console.info("[tradepartner-express] phone-gated request created", {
          requestId: created.id,
          profileId: target.profileId,
          businessId: target.businessId,
          requesterUserId: requester.id,
          source: "tradepartner_profile",
          connectionMode: "express",
          accountCreated: requesterWasCreated,
          accountNeedsSetup: requesterNeedsSetup,
        });
        return res.status(201).json({
          requestId: created.id,
          status: created.status,
          businessName: target.businessName,
          submitted: true,
          requestPersisted: true,
          providerNotificationEmail: {
            requested: Boolean(providerRecipientEmail),
            status: providerNotificationEmailStatus,
            errorCode: providerNotificationEmailErrorCode,
          },
          accountCreated: requesterWasCreated,
          accountNeedsSetup: requesterNeedsSetup,
          onboardingPath,
          onboardingEmailStatus,
          requestWorkspacePath,
          membershipNext: requesterNeedsSetup
            ? "Set up your TradeScout access to follow this request."
            : viewerId
              ? "Open My Requests to follow this request in Direct Connect."
              : "Sign in to follow this request in Direct Connect.",
        });
      } catch (error) {
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
      const actorUserId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      try {
        if (!actorUserId) return res.status(401).json({ message: "Unauthorized." });
        const parsedEmail = z.string().trim().email().max(320).safeParse(req.body?.to);
        if (!parsedEmail.success) {
          return res.status(400).json({ message: "Provide a valid 'to' email address." });
        }
        const probeId = `tradepartner-email-probe:${randomUUID()}`;
        const enqueued = await db.transaction((tx: any) =>
          notificationService.enqueueTradePartnerRequestNotification(tx, {
            ownerUserId: actorUserId,
            workRequestId: probeId,
            recipientEmail: normalizeEmail(parsedEmail.data),
            businessName: "TradeScout email test",
            requesterDisplayName: "TradeScout",
            requestSummary: "Admin business-notification delivery probe",
            stoneName: null,
          })
        );
        const result = await notificationService.dispatchDirectConnectEmail(
          String(enqueued.notification.id)
        );
        return res.status(202).json({
          sent: ["sent", "delivered"].includes(String(result.delivery?.status || "")),
          status: result.delivery?.status || "pending",
          messageId: result.delivery?.externalId || null,
        });
      } catch {
        console.error("[tradepartner-express] durable test notification could not be queued", {
          actorUserId,
        });
        return res.status(500).json({ message: "Test email failed to send." });
      }
    }
  );
}
