import type { Express, Request, Response } from "express";
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
import { emailService } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
import { notificationService } from "../notification-service";
import { notifySuperAdminsOfDirectConnectRequest } from "../services/directConnectBetaOversight";
import {
  canExposePublishedProfilePublicly,
  hasTradeScoutPendingOwnerCustody,
} from "../services/ownerConfirmedDirectProfile";
import { normalizeDirectConnectPhone } from "../services/directConnectPhone";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { redactContactDetails } from "../utils/workRequestShare";
import { ISSA_BUILD_LEGACY_PROFILE_SLUG, ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";
import { resolveJwStonePublicRequestName } from "@shared/jwStonePresentation";

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
    serviceName: z.string().trim().max(180).optional(),
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
  phone: string;
  // Where new-request emails go. Separate from the owner's login email --
  // a business may want requests routed to a shared inbox instead of
  // whatever address the account owner personally signed in with.
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
      businessClaimStatus: businesses.claimStatus,
      businessSources: businesses.sources,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      profileData: businesses.profileData,
      ownerProvider: users.provider,
      ownerPreferences: users.preferences,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerPhone: users.phone,
    })
    .from(profiles)
    .innerJoin(businesses, eq(profiles.businessId, businesses.id))
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .where(eq(profiles.slug, normalizedSlug))
    .limit(1);

  const directProfileCandidate = {
    profileSlug: row?.profileSlug,
    profileStatus: row?.profileStatus,
    profileOwnerUserId: row?.ownerUserId,
    businessStatus: row?.businessStatus,
    businessOwnerUserId: row?.businessOwnerUserId,
    publicDiscoveryEnabled: row?.publicDiscoveryEnabled,
    businessSources: row?.businessSources,
    businessClaimStatus: row?.businessClaimStatus,
    ownerProvider: row?.ownerProvider,
    ownerPreferences: row?.ownerPreferences,
  };
  const deliveryCustody = hasTradeScoutPendingOwnerCustody(directProfileCandidate)
    ? "tradescout_pending_owner"
    : "business";
  const profileData = (row?.profileData || {}) as Record<string, any>;
  const phone = String(profileData.phone || row?.ownerPhone || "").trim();
  const notificationEmail = String(profileData.notificationEmail || "").trim();
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
    phone,
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
        const publicStoneName = resolveJwStonePublicRequestName({
          profileSlug: target.profileSlug,
          itemId: body.itemId,
          stoneName: body.stoneName,
        });
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

        const sanitizedMessage = redactContactDetails(body.message).trim();
        const title = requestTitle(body.requestType, target.businessName);
        const now = new Date();
        const [created] = await db.transaction(async (tx: any) => {
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
              actorUserId: String(requester.id),
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                profileId: target.profileId,
                businessId: target.businessId,
                requestType: body.requestType,
                stoneName: publicStoneName,
                serviceName: body.serviceName || null,
                itemId: body.itemId || null,
                deliveryCustody: target.deliveryCustody,
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
                deliveryCustody: target.deliveryCustody,
              },
            },
          ]);
          return [request];
        });

        try {
          await notificationService.createNotification({
            userId: target.ownerUserId,
            type: "new_project_request",
            title: `New request for ${target.businessName}`,
            message: `${body.name} sent a request from the public profile.`,
            actionUrl: "/direct-connect/inbox",
            actionText: "Open request",
            iconName: "briefcase",
            iconColor: "orange",
            deliveryMethods: ["in_app", "push"],
          });
        } catch (error) {
          // The request is already committed. A notification outage must not
          // report a false submission failure and invite duplicate requests.
          console.warn("[tradepartner-express] owner notification failed", {
            requestId: created.id,
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
            error,
          });
        }

        if (target.notificationEmail && emailService.isConfigured()) {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const inboxUrl = `${publicBase}/direct-connect/inbox`;
          void emailService
            .sendEmail({
              to: target.notificationEmail,
              subject: `New request for ${target.businessName}`,
              html: [
                `<p>${escapeHtml(body.name)} sent a request through your ${escapeHtml(target.businessName)} profile on TradeScout.</p>`,
                publicStoneName
                  ? `<p><strong>Stone:</strong> ${escapeHtml(publicStoneName)}</p>`
                  : "",
                body.serviceName
                  ? `<p><strong>Service:</strong> ${escapeHtml(body.serviceName)}</p>`
                  : "",
                `<p><strong>Request type:</strong> ${escapeHtml(requestTitle(body.requestType, target.businessName))}</p>`,
                `<p>Contact details stay inside TradeScout until you respond -- open Direct Connect to view the full message and reply.</p>`,
                `<p><a href=\"${inboxUrl}\">Open Direct Connect inbox</a>.</p>`,
              ]
                .filter(Boolean)
                .join("\n"),
              text: [
                `${body.name} sent a request through your ${target.businessName} profile on TradeScout.`,
                publicStoneName ? `Stone: ${publicStoneName}` : null,
                body.serviceName ? `Service: ${body.serviceName}` : null,
                `Request type: ${requestTitle(body.requestType, target.businessName)}`,
                `Open Direct Connect inbox: ${inboxUrl}`,
              ]
                .filter(Boolean)
                .join("\n"),
              purpose: "tradepartner_request_notification",
            })
            .catch((error) =>
              console.warn("[tradepartner-express] business notification email failed", {
                requestId: created.id,
                notificationEmail: target.notificationEmail,
                error,
              })
            );
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
        const requestWorkspacePath = `/direct-connect/engagements?${requestWorkspaceParams.toString()}`;
        const activation = requesterWasCreated
          ? passwordResetService.createToken(String(requester.id))
          : null;
        const verification = requesterWasCreated
          ? emailVerificationService.createToken(String(requester.id))
          : null;
        const onboardingPath = activation
          ? `/reset-password?token=${encodeURIComponent(activation.token)}&next=${encodeURIComponent(requestWorkspacePath)}`
          : null;
        let onboardingEmailStatus: "sent" | "skipped" | "failed" = "skipped";

        if (emailService.isConfigured()) {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const activationUrl = onboardingPath
            ? `${publicBase}${onboardingPath}`
            : `${publicBase}${requestWorkspacePath}`;
          const verificationUrl = verification
            ? `${publicBase}/verify-email?token=${verification.token}&next=${encodeURIComponent(requestWorkspacePath)}`
            : null;
          try {
            // A no-reply confirmation from TradeScout itself -- generic
            // across every business. Real back-and-forth with the business
            // happens separately, through whatever contact the business
            // owner uses, once they accept the request.
            const emailResult = await emailService.sendEmail({
              to: requester.email,
              subject:
                target.deliveryCustody === "tradescout_pending_owner"
                  ? `TradeScout received your request for ${target.businessName}`
                  : `Your request was sent to ${target.businessName}`,
              html: [
                target.deliveryCustody === "tradescout_pending_owner"
                  ? `<p>TradeScout received your request for ${escapeHtml(target.businessName)}. The owner has not connected this profile yet, so TradeScout is holding the request for owner handoff.</p>`
                  : `<p>Your request was sent directly to ${escapeHtml(target.businessName)}. This is a no-reply confirmation -- ${escapeHtml(target.businessName)} will follow up using the contact info you sent.</p>`,
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
                  : `Your request was sent directly to ${target.businessName}. This is a no-reply confirmation -- ${target.businessName} will follow up using the contact info you sent.`,
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
              purpose: requesterWasCreated ? "account_creation" : "notification",
            });
            onboardingEmailStatus = emailResult.skipped ? "skipped" : "sent";
          } catch (error) {
            onboardingEmailStatus = "failed";
            console.warn("[tradepartner-express] requester onboarding email failed", {
              requestId: created.id,
              requesterUserId: requester.id,
              error,
            });
          }
        }

        console.info("[tradepartner-express] phone-gated request created", {
          requestId: created.id,
          profileId: target.profileId,
          businessId: target.businessId,
          requesterUserId: requester.id,
          source: "tradepartner_profile",
          connectionMode: "express",
          deliveryCustody: target.deliveryCustody,
          accountCreated: requesterWasCreated,
        });
        return res.status(201).json({
          requestId: created.id,
          status: created.status,
          businessName: target.businessName,
          delivered: target.deliveryCustody === "business",
          deliveryCustody: target.deliveryCustody,
          accountCreated: requesterWasCreated,
          onboardingPath,
          onboardingEmailStatus,
          requestWorkspacePath,
          membershipNext: requesterWasCreated
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
        });
        return res.json({ sent: !result.skipped, messageId: result.messageId || null });
      } catch (error) {
        console.error("[tradepartner-express] test notification email failed", error);
        return res.status(500).json({ message: "Test email failed to send." });
      }
    }
  );
}
